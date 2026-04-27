"""phase 2 schema changes

Revision ID: phase2_schema
Revises: phase2_merge
Create Date: 2026-04-20 00:05:00.000000

Schema changes for Phase 2 (file vault + messaging + WebAuthn + compliance):

- refresh_tokens.last_active_at (2.12 idle timeout)
- documents.* envelope-encryption columns (2.1)
  kek_version, dek_wrapped, nonce_prefix, sha256, clam_result, crypto_shredded
- conversations.dek_key_id + dek_rotated_at (2.7 per-conversation DEK)
- communications.body_ciphertext + body_nonce + body_key_id (2.7)
  keep communications.body nullable during the backfill window; legacy
  rows still have plaintext until the backfill migration lands.
- webauthn_credentials table (2.9)
- break_glass_requests table (2.8)
- consent_log table (2.15)
- erasure_requests table (2.14)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "phase2_schema"
down_revision: str | Sequence[str] | None = "phase2_merge"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 2.12 — idle timeout
    op.add_column(
        "refresh_tokens",
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2.1 — envelope encryption metadata on documents
    op.add_column(
        "documents",
        sa.Column("kek_version", sa.Integer(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("dek_wrapped", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("nonce_prefix", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("sha256", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("clam_result", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("crypto_shredded", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "documents",
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("object_lock_mode", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("object_lock_retain_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_documents_subject_id", "documents", ["subject_id"], unique=False)

    # 2.7 — per-conversation DEK
    op.add_column(
        "conversations",
        sa.Column("dek_key_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column("dek_rotated_at", sa.DateTime(timezone=True), nullable=True),
    )
    # 2.7 — message body ciphertext (plaintext body kept nullable during backfill)
    op.add_column(
        "communications",
        sa.Column("body_ciphertext", sa.LargeBinary(), nullable=True),
    )
    op.alter_column("communications", "body", nullable=True)

    # 2.9 — WebAuthn credentials
    op.create_table(
        "webauthn_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("credential_id", sa.LargeBinary(), nullable=False),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transports", sa.String(length=200), nullable=True),
        sa.Column("aaguid", sa.String(length=36), nullable=True),
        sa.Column("nickname", sa.String(length=120), nullable=True),
        sa.Column("backup_state", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("credential_id", name="uq_webauthn_credentials_credential_id"),
    )

    # 2.8 — break-glass compliance access
    op.create_table(
        "break_glass_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_scope", sa.String(length=500), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
            index=True,
        ),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_break_glass_requests_resource",
        "break_glass_requests",
        ["resource_type", "resource_id"],
        unique=False,
    )

    # 2.14 — crypto-shred erasure requests (separate from deletion_requests
    # because erasure has different legal semantics than soft-delete)
    op.create_table(
        "erasure_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("subject_type", sa.String(length=50), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("shred_manifest", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_erasure_requests_subject",
        "erasure_requests",
        ["subject_type", "subject_id"],
        unique=False,
    )

    # Subject-level KEK version table used by crypto-shred (2.6, 2.14).
    # Each subject has a current key version; shred writes ``destroyed_at``
    # and purges wrapped DEKs on subject rows.  Derivation uses HKDF with
    # info = "amg|subject|{type}|{uuid}|v{n}" so bumping the version
    # permanently invalidates all prior ciphertext for that subject.
    op.create_table(
        "subject_kek_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("subject_type", sa.String(length=50), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("destroyed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("destroyed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("subject_type", "subject_id", "version", name="uq_subject_kek_version"),
    )
    op.create_index(
        "ix_subject_kek_versions_subject",
        "subject_kek_versions",
        ["subject_type", "subject_id"],
        unique=False,
    )

    # 2.15 — Consent log
    op.create_table(
        "consent_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("consent_type", sa.String(length=80), nullable=False, index=True),
        sa.Column("scope", sa.String(length=200), nullable=True),
        sa.Column("version", sa.String(length=40), nullable=True),
        sa.Column("granted", sa.Boolean(), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 2.5 — one-time redemption tokens (ephemeral; cleaned by a cron)
    op.create_table(
        "download_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "issued_to",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("download_tokens")
    op.drop_table("consent_log")
    op.drop_index("ix_subject_kek_versions_subject", table_name="subject_kek_versions")
    op.drop_table("subject_kek_versions")
    op.drop_index("ix_erasure_requests_subject", table_name="erasure_requests")
    op.drop_table("erasure_requests")
    op.drop_index("ix_break_glass_requests_resource", table_name="break_glass_requests")
    op.drop_table("break_glass_requests")
    op.drop_table("webauthn_credentials")
    op.alter_column("communications", "body", nullable=False)
    op.drop_column("communications", "body_ciphertext")
    op.drop_column("conversations", "dek_rotated_at")
    op.drop_column("conversations", "dek_key_id")
    op.drop_index("ix_documents_subject_id", table_name="documents")
    op.drop_column("documents", "object_lock_retain_until")
    op.drop_column("documents", "object_lock_mode")
    op.drop_column("documents", "subject_id")
    op.drop_column("documents", "crypto_shredded")
    op.drop_column("documents", "clam_result")
    op.drop_column("documents", "sha256")
    op.drop_column("documents", "nonce_prefix")
    op.drop_column("documents", "dek_wrapped")
    op.drop_column("documents", "kek_version")
    op.drop_column("refresh_tokens", "last_active_at")
