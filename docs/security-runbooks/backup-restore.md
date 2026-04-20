# Backup & Restore Runbook (Phase 3.12)

Encrypted off-platform Postgres backup pipeline.

> Related: `backend/scripts/backup_encrypted.py`, `docs/security-plan.md`
> §6 Phase 3.12 / §9 Blindspot #3 / §10 Open Question 5.

---

## 1. Overview

```
pg_dump --format=custom --no-owner --no-acl   →   age -r <pubkey>...   →   S3-compat bucket
                  |                                       |                        |
              streamed                              encrypted blob           amg-portal-YYYYMMDDTHHMMSSZ.dump.age
                                                                            + .manifest.json
```

- **Encryption:** [age](https://age-encryption.org) (X25519 + ChaCha20-Poly1305).
- **Recipients:** `AGE_RECIPIENTS` env var, comma-separated. Multiple recipients
  let any *one* identity decrypt — primary + breakglass.
- **Bucket:** any S3-compatible target (Cloudflare R2 free 10 GB/mo,
  Backblaze B2 10 GB free, AWS S3) via `BACKUP_S3_*` env vars.
- **Retention:** 7 daily / 4 weekly / 12 monthly / 7 yearly (auto-pruned).
- **Audit:** every successful run writes an `AuditLog` row (action=`backup`)
  so the tamper-evident chain covers backups too.
- **Schedule:** APScheduler nightly at 03:30 UTC, gated behind `BACKUP_ENABLED=true`.

---

## 2. Generate the age keypair

On a clean offline machine (NOT a Railway pod):

```bash
age-keygen -o /secure/path/amg-backup-primary.key
# stdout prints "Public key: age1xyz..." — capture this; it goes in the env var.
```

Repeat for `amg-backup-breakglass.key`. Set:

```bash
AGE_RECIPIENTS="age1primary...,age1breakglass..."
```

Encrypted blobs can be decrypted by **either** identity. Loss of one is not loss of access.

---

## 3. Custody plan (Open Question §10.5)

| Identity | Holder | Storage | Recovery |
|---|---|---|---|
| Primary | MD (Nick) | YubiKey via [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey) — touch required to decrypt | Hardware key in office safe; copy of public key in 1Password vault |
| Breakglass | Compliance officer | 5 paper shares via [`ssss-split -t 3 -n 5`](https://manpages.debian.org/ssss); 3-of-5 threshold | Distributed: 1 office safe, 1 home safe (MD), 1 home safe (Compliance), 1 attorney, 1 sealed bank safe-deposit |

Custody review is part of the quarterly access audit. Rotate identities on any
holder departure: generate fresh keypair, run a one-shot backup against the new
recipients, archive the old identity (do NOT destroy — older blobs still need it).

---

## 4. Local restore drill

Quarterly restore drill — run on a non-prod machine:

```bash
# 1. Download blob + manifest
aws s3 cp s3://amg-backups/amg-portal-20260420T033000Z.dump.age ./
aws s3 cp s3://amg-backups/amg-portal-20260420T033000Z.dump.age.manifest.json ./

# 2. Verify the SHA-256 matches the manifest
sha256sum amg-portal-20260420T033000Z.dump.age
jq -r .sha256 amg-portal-20260420T033000Z.dump.age.manifest.json

# 3. Decrypt with one of the identity files
age -d -i /secure/path/amg-backup-primary.key \
    -o restore.dump \
    amg-portal-20260420T033000Z.dump.age

# 4. Restore into a fresh DB
createdb amg_portal_restore
pg_restore --no-owner --no-acl --dbname=amg_portal_restore restore.dump

# 5. Smoke-test
psql amg_portal_restore -c "SELECT count(*) FROM users;"
psql amg_portal_restore -c "SELECT count(*) FROM audit_logs;"

# 6. Drop the restore DB; shred local artifacts
dropdb amg_portal_restore
shred -u restore.dump amg-portal-20260420T033000Z.dump.age
```

---

## 5. Quarterly drill checklist

- [ ] Pick a random backup from the last 90 days (do not use yesterday's).
- [ ] Verify blob SHA-256 matches the manifest.
- [ ] Decrypt with the **primary** identity. Time taken: ____.
- [ ] Decrypt the same blob with the **breakglass** identity. Time taken: ____.
- [ ] Run `pg_restore` into a fresh DB; confirm row counts roughly match prod.
- [ ] Spot-check a small encrypted column decrypts cleanly with current `AMG_KEK_KEYS`.
- [ ] File the drill report in `docs/security-runbooks/drills/YYYY-Qn.md`.
- [ ] Confirm next-quarter calendar reminder is set.

---

## 6. Configuration reference

| Env var | Required | Notes |
|---|---|---|
| `BACKUP_ENABLED` | yes | `true` to enable the nightly APScheduler job. |
| `AGE_RECIPIENTS` | yes | Comma-separated `age1...` public keys. |
| `BACKUP_S3_ENDPOINT` | optional | Set for R2/B2; omit for AWS S3. |
| `BACKUP_S3_BUCKET` | yes | Target bucket name. |
| `BACKUP_S3_ACCESS_KEY` | yes | Bucket-scoped credential. |
| `BACKUP_S3_SECRET_KEY` | yes | Bucket-scoped credential. |
| `BACKUP_S3_REGION` | optional | Defaults to `auto` (R2 / generic). |
| `DATABASE_URL` | yes | Source DSN; `+asyncpg` suffix is stripped. |

The script accepts `--dry-run`, `--no-upload`, and `--retention-only` for
manual operation:

```bash
cd backend && BACKUP_ENABLED=true AGE_RECIPIENTS=age1... \
  python -m scripts.backup_encrypted --dry-run
```
