"""Encrypted off-platform Postgres backup (Phase 3.12 / Blindspot #3).

Pipeline:
    pg_dump --format=custom --no-owner --no-acl  |  age -r <recipient>...
                            └── stdout                    └── encrypted blob

The encrypted blob + a JSON manifest are uploaded to an S3-compatible
bucket (Cloudflare R2, Backblaze B2, or AWS S3).  Audit-log row is written
via SQLAlchemy so the chain captures the operation.

Designed to run from cron / APScheduler with no human interaction:
    python -m scripts.backup_encrypted

References:
- ``getmoto/moto`` ``tests/test_s3/test_s3_custom_endpoint.py`` — boto3
  with ``endpoint_url`` for S3-compatible providers.
- ``apptension/saas-boilerplate`` ``services/export/services/export.py`` —
  ``boto3.client("s3", endpoint_url=...)`` upload pattern.
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import datetime as dt
import hashlib
import json
import logging
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@dataclasses.dataclass(slots=True)
class BackupConfig:
    db_url: str
    age_recipients: list[str]
    s3_endpoint: str | None
    s3_bucket: str
    s3_access_key: str
    s3_secret_key: str
    s3_region: str
    enabled: bool

    @classmethod
    def from_env(cls) -> BackupConfig:
        recipients = [
            r.strip() for r in os.environ.get("AGE_RECIPIENTS", "").split(",") if r.strip()
        ]
        return cls(
            db_url=os.environ.get("DATABASE_URL", ""),
            age_recipients=recipients,
            s3_endpoint=os.environ.get("BACKUP_S3_ENDPOINT") or None,
            s3_bucket=os.environ.get("BACKUP_S3_BUCKET", ""),
            s3_access_key=os.environ.get("BACKUP_S3_ACCESS_KEY", ""),
            s3_secret_key=os.environ.get("BACKUP_S3_SECRET_KEY", ""),
            s3_region=os.environ.get("BACKUP_S3_REGION", "auto"),
            enabled=os.environ.get("BACKUP_ENABLED", "false").lower() == "true",
        )

    def validate(self, *, allow_no_upload: bool = False) -> None:
        if not self.db_url:
            raise RuntimeError("DATABASE_URL is required for backup")
        if not self.age_recipients:
            raise RuntimeError("AGE_RECIPIENTS is required (comma-separated)")
        if allow_no_upload:
            return
        for field in ("s3_bucket", "s3_access_key", "s3_secret_key"):
            if not getattr(self, field):
                raise RuntimeError(
                    f"BACKUP_S3_{field.upper().removeprefix('S3_')} is required for upload"
                )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalised_pg_dsn(db_url: str) -> str:
    """Strip the ``+asyncpg``/``+psycopg`` suffix so ``pg_dump`` accepts it."""
    if db_url.startswith("postgresql+"):
        scheme_end = db_url.index("://")
        return "postgresql" + db_url[scheme_end:]
    return db_url


def _db_host(db_url: str) -> str:
    return urlparse(_normalised_pg_dsn(db_url)).hostname or "unknown"


def _pg_connection_flags(db_url: str) -> tuple[list[str], dict[str, str]]:
    """Split a DSN into discrete flags + a ``PGPASSWORD`` env overlay.

    Passing the password on argv leaks it through ``/proc/<pid>/cmdline`` to
    anything running as the same user.  pg_dump reads ``PGPASSWORD`` from env
    instead, so we hand it over that channel and keep argv password-free.
    """
    parsed = urlparse(_normalised_pg_dsn(db_url))
    flags: list[str] = []
    if parsed.hostname:
        flags += ["-h", parsed.hostname]
    if parsed.port:
        flags += ["-p", str(parsed.port)]
    if parsed.username:
        flags += ["-U", parsed.username]
    dbname = (parsed.path or "").lstrip("/")
    if dbname:
        flags += ["-d", dbname]
    env_overlay: dict[str, str] = {}
    if parsed.password:
        env_overlay["PGPASSWORD"] = parsed.password
    # Force C locale so error parsing (future enhancement) isn't locale-dependent.
    env_overlay["LC_MESSAGES"] = "C"
    return flags, env_overlay


_DSN_CRED_RE: re.Pattern[str] = re.compile(r"(postgres(?:ql)?(?:\+\w+)?://)[^@\s]+@")


def _scrub_dsn(text: str) -> str:
    """Redact ``user:password@`` from any DSN-shaped substring in *text*.

    pg_dump's stderr can echo the connection string on failure; this keeps
    the credentials out of the re-raised ``RuntimeError`` message and the
    downstream audit row.
    """
    return _DSN_CRED_RE.sub(r"\1[REDACTED]@", text)


def _pg_dump_version() -> str:
    try:
        out = subprocess.check_output(["pg_dump", "--version"], text=True)
        return out.strip()
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:  # pragma: no cover
        return f"pg_dump unavailable: {exc}"


def _require_binaries() -> None:
    for binary in ("pg_dump", "age"):
        if shutil.which(binary) is None:
            raise RuntimeError(f"{binary!r} not found on PATH; install it before running backups")


def _build_filename(now: dt.datetime) -> str:
    return f"amg-portal-{now.strftime('%Y%m%dT%H%M%SZ')}.dump.age"


def _retention_bucket(name: str) -> str:
    """Classify a backup filename into a retention bucket.

    Filenames look like ``amg-portal-YYYYMMDDTHHMMSSZ.dump.age``.  We bucket by
    date math so ``_prune`` can keep N most-recent of each cadence.
    """
    if not name.startswith("amg-portal-"):
        return "other"
    prefix_len = len("amg-portal-")
    try:
        ts = dt.datetime.strptime(name[prefix_len : prefix_len + 16], "%Y%m%dT%H%M%S")
    except ValueError:
        return "other"
    if ts.month == 1 and ts.day == 1:
        return "yearly"
    if ts.day == 1:
        return "monthly"
    if ts.weekday() == 6:  # Sunday
        return "weekly"
    return "daily"


_RETENTION_KEEP: dict[str, int] = {
    "daily": 7,
    "weekly": 4,
    "monthly": 12,
    "yearly": 7,
}


# ---------------------------------------------------------------------------
# pg_dump | age pipeline
# ---------------------------------------------------------------------------


def _run_dump_and_encrypt(cfg: BackupConfig, output_path: Path) -> tuple[int, str]:
    """Stream ``pg_dump | age`` into ``output_path``; return (bytes, sha256)."""
    _require_binaries()
    conn_flags, env_overlay = _pg_connection_flags(cfg.db_url)
    pg_cmd = [
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        *conn_flags,
    ]
    pg_env = {**os.environ, **env_overlay}
    age_cmd = ["age"]
    for r in cfg.age_recipients:
        age_cmd += ["-r", r]
    age_cmd += ["-o", str(output_path)]

    logger.info(
        "backup: starting %s | %s",
        # Safe to log the full argv — password is in PGPASSWORD env, not argv.
        " ".join(shlex.quote(p) for p in pg_cmd),
        " ".join(shlex.quote(p) for p in age_cmd),
    )
    pg = subprocess.Popen(
        pg_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=pg_env,
    )
    assert pg.stdout is not None
    try:
        age = subprocess.Popen(age_cmd, stdin=pg.stdout, stderr=subprocess.PIPE)
    finally:
        pg.stdout.close()  # let pg_dump receive SIGPIPE if age dies
    age_err = age.communicate()[1]
    pg_err = pg.stderr.read() if pg.stderr else b""
    pg.wait()
    if pg.returncode != 0:
        msg = _scrub_dsn(pg_err.decode(errors="replace"))[:500]
        raise RuntimeError(f"pg_dump failed (code {pg.returncode}): {msg}")
    if age.returncode != 0:
        msg = _scrub_dsn(age_err.decode(errors="replace"))[:500]
        raise RuntimeError(f"age failed (code {age.returncode}): {msg}")

    digest = hashlib.sha256()
    byte_count = 0
    with output_path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
            byte_count += len(chunk)
    return byte_count, digest.hexdigest()


# ---------------------------------------------------------------------------
# Upload + prune (S3 / R2 / B2)
# ---------------------------------------------------------------------------


def _s3_client(cfg: BackupConfig) -> Any:
    # Local import: boto3 isn't a hard dep of the app; only the backup script needs it.
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=cfg.s3_endpoint,
        aws_access_key_id=cfg.s3_access_key,
        aws_secret_access_key=cfg.s3_secret_key,
        region_name=cfg.s3_region,
    )


def _upload(cfg: BackupConfig, blob_path: Path, manifest: dict[str, Any]) -> None:
    client = _s3_client(cfg)
    blob_name = blob_path.name
    manifest_name = blob_name + ".manifest.json"
    with blob_path.open("rb") as f:
        client.put_object(
            Bucket=cfg.s3_bucket,
            Key=blob_name,
            Body=f,
            ContentType="application/octet-stream",
        )
    client.put_object(
        Bucket=cfg.s3_bucket,
        Key=manifest_name,
        Body=json.dumps(manifest, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    logger.info("backup: uploaded %s + %s", blob_name, manifest_name)


def _prune(client: Any, bucket: str, now: dt.datetime) -> dict[str, int]:
    """Apply the daily/weekly/monthly/yearly retention policy."""
    paginator = client.get_paginator("list_objects_v2")
    keys: list[tuple[str, dt.datetime]] = []
    for page in paginator.paginate(Bucket=bucket, Prefix="amg-portal-"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".manifest.json"):
                continue
            try:
                ts = dt.datetime.strptime(
                    key[len("amg-portal-") : len("amg-portal-") + 16],
                    "%Y%m%dT%H%M%S",
                )
            except ValueError:
                continue
            keys.append((key, ts))

    keys.sort(key=lambda x: x[1], reverse=True)
    keep: set[str] = set()
    seen: dict[str, int] = {"daily": 0, "weekly": 0, "monthly": 0, "yearly": 0}
    for key, _ts in keys:
        bucket_name = _retention_bucket(key)
        if bucket_name not in _RETENTION_KEEP:
            continue
        if seen[bucket_name] < _RETENTION_KEEP[bucket_name]:
            keep.add(key)
            seen[bucket_name] += 1

    deleted = 0
    for key, _ts in keys:
        if key in keep:
            continue
        try:
            client.delete_object(Bucket=bucket, Key=key)
            client.delete_object(Bucket=bucket, Key=key + ".manifest.json")
            deleted += 1
        except Exception:  # noqa: BLE001 — best-effort prune
            logger.exception("prune: failed to delete %s", key)
    logger.info("prune: kept=%d deleted=%d (now=%s)", len(keep), deleted, now.isoformat())
    return {"kept": len(keep), "deleted": deleted}


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------


async def _audit_backup(manifest: dict[str, Any], status: str) -> None:
    """Emit an AuditLog row so the tamper-evident chain covers backups."""
    try:
        from app.db.session import AsyncSessionLocal
        from app.middleware.audit import audit_context
        from app.models.audit_log import AuditLog
    except Exception:  # pragma: no cover — defensive: don't fail the backup
        logger.exception("audit: imports failed")
        return

    with audit_context(user_email="system:backup"):
        try:
            async with AsyncSessionLocal() as db:
                entry = AuditLog(
                    action="backup",
                    entity_type="system",
                    entity_id=str(manifest.get("sha256", uuid.uuid4().hex))[:64],
                    after_state={"status": status, **manifest},
                )
                db.add(entry)
                await db.commit()
        except Exception:
            logger.exception("audit: failed to write backup row")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


async def run(
    *,
    dry_run: bool = False,
    no_upload: bool = False,
    retention_only: bool = False,
) -> dict[str, Any]:
    cfg = BackupConfig.from_env()
    cfg.validate(allow_no_upload=no_upload or dry_run or retention_only)

    now = dt.datetime.now(dt.UTC)
    if retention_only:
        client = _s3_client(cfg)
        result = _prune(client, cfg.s3_bucket, now)
        logger.info("backup.retention_only complete: %s", result)
        return {"status": "retention_only", **result}

    started_at = now.isoformat()
    with tempfile.TemporaryDirectory(prefix="amg-backup-") as tmpdir:
        out_path = Path(tmpdir) / _build_filename(now)
        if dry_run:
            logger.info("backup: DRY RUN — would write %s", out_path.name)
            return {"status": "dry_run", "filename": out_path.name}

        byte_count, sha256 = _run_dump_and_encrypt(cfg, out_path)
        completed_at = dt.datetime.now(dt.UTC).isoformat()
        manifest = {
            "filename": out_path.name,
            "db_url_host": _db_host(cfg.db_url),
            "started_at": started_at,
            "completed_at": completed_at,
            "byte_count": byte_count,
            "sha256": sha256,
            "age_recipients": cfg.age_recipients,
            "pg_dump_version": _pg_dump_version(),
        }
        if no_upload:
            logger.info("backup: --no-upload — produced %s (%d bytes)", out_path, byte_count)
            await _audit_backup(manifest, "no_upload")
            return {"status": "no_upload", **manifest}

        try:
            _upload(cfg, out_path, manifest)
        except Exception as e:
            logger.exception("backup: upload failed")
            await _audit_backup(manifest, f"upload_failed: {e}")
            raise

    # Prune after a successful upload only — never delete history if today's
    # backup didn't make it off-platform.
    try:
        client = _s3_client(cfg)
        _prune(client, cfg.s3_bucket, now)
    except Exception:
        logger.exception("backup: prune failed (non-fatal)")

    await _audit_backup(manifest, "ok")
    logger.info("backup.completed", extra={"event": "backup.completed", **manifest})
    return {"status": "ok", **manifest}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Encrypted off-platform Postgres backup",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip pg_dump; just log what would happen",
    )
    parser.add_argument(
        "--no-upload",
        action="store_true",
        help="Run dump+encrypt locally; skip S3 upload",
    )
    parser.add_argument(
        "--retention-only",
        action="store_true",
        help="Apply retention policy without dumping",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    try:
        asyncio.run(
            run(
                dry_run=args.dry_run,
                no_upload=args.no_upload,
                retention_only=args.retention_only,
            )
        )
    except Exception:
        logger.exception("backup.failed", extra={"event": "backup.failed"})
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
