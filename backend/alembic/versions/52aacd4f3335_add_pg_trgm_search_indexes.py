"""Add pg_trgm extension and GIN trigram indexes for fast search

Revision ID: 52aacd4f3335
Revises: add_password_reset_token_table, docusign0001
Create Date: 2026-04-01 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "52aacd4f3335"
down_revision: tuple[str, str] = ("add_password_reset_token_table", "docusign0001")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable the trigram extension (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # GIN trigram indexes on text columns used by global search and suggestions
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_programs_title_trgm "
        "ON programs USING GIN (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_clients_name_trgm "
        "ON clients USING GIN (name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_partner_profiles_firm_name_trgm "
        "ON partner_profiles USING GIN (firm_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_file_name_trgm "
        "ON documents USING GIN (file_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_title_trgm "
        "ON tasks USING GIN (title gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tasks_title_trgm")
    op.execute("DROP INDEX IF EXISTS ix_documents_file_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_partner_profiles_firm_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_clients_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_programs_title_trgm")
