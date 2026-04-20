"""restrict audit_log role perms (Phase 1.15)

Revision ID: restrict_audit_perms
Revises: add_audit_checkpoint
Create Date: 2026-04-20 10:10:00.000000

Creates the ``amg_audit_maintainer`` role and revokes UPDATE/DELETE/TRUNCATE
on ``audit_logs`` + ``audit_checkpoints`` from ``amg_app`` (the app's runtime
role).  Maintenance operations must be performed by a human explicitly
connecting as ``amg_audit_maintainer`` per the runbook.

If the ``amg_app`` role doesn't exist (e.g. local dev connecting as the
``postgres`` superuser) the role-specific statements are skipped; the role
DDL stays idempotent.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "restrict_audit_perms"
down_revision: str | Sequence[str] | None = "add_audit_checkpoint"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create the maintainer role if it doesn't exist.  NOLOGIN — the app
    # never connects as this role; a human uses `SET ROLE` from a superuser
    # session during approved maintenance.
    op.execute(
        """
        DO $$
        BEGIN
            CREATE ROLE amg_audit_maintainer NOLOGIN;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        """
    )

    # 2. Tighten perms on the two audit tables.  Scoped under a `pg_roles`
    # check so running on a dev DB that lacks the amg_app role doesn't fail.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amg_app') THEN
                REVOKE UPDATE, DELETE, TRUNCATE
                    ON TABLE audit_logs, audit_checkpoints
                    FROM amg_app;
            END IF;
        END
        $$;
        """
    )

    # 3. Maintainer gets exactly UPDATE/DELETE (never TRUNCATE/ALTER).
    op.execute(
        """
        GRANT UPDATE, DELETE
            ON TABLE audit_logs, audit_checkpoints
            TO amg_audit_maintainer;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amg_app') THEN
                GRANT UPDATE, DELETE, TRUNCATE
                    ON TABLE audit_logs, audit_checkpoints
                    TO amg_app;
            END IF;
        END
        $$;
        """
    )
    op.execute(
        "REVOKE UPDATE, DELETE "
        "ON TABLE audit_logs, audit_checkpoints "
        "FROM amg_audit_maintainer;"
    )
    # Leave the role in place — dropping it can fail if other objects depend
    # on it.  Operators can drop it manually if really desired.
