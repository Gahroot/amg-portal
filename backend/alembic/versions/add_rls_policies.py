"""add_rls_policies

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-03-09 14:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "d3e4f5a6b7c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables that get RLS enabled
RLS_TABLES = [
    "clients",
    "client_profiles",
    "programs",
    "milestones",
    "tasks",
    "deliverables",
    "communications",
    "documents",
    "kyc_documents",
]

INTERNAL_ROLES_CHECK = (
    "current_app_user_role() IN ("
    "'managing_director', 'relationship_manager', "
    "'coordinator', 'finance_compliance')"
)


def upgrade() -> None:
    """Enable RLS and create policies."""

    # 1. Helper functions for session-level settings
    op.execute(
        """
        CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS TEXT AS $$
          SELECT coalesce(current_setting('app.current_user_id', true), '');
        $$ LANGUAGE sql STABLE;
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION current_app_user_role() RETURNS TEXT AS $$
          SELECT coalesce(current_setting('app.current_user_role', true), '');
        $$ LANGUAGE sql STABLE;
        """
    )

    # 2. Enable RLS + FORCE on all tables
    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # ── clients ──────────────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY clients_internal_policy ON clients
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )

    # ── client_profiles ──────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY client_profiles_internal_policy ON client_profiles
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )

    # ── programs ─────────────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY programs_internal_policy ON programs
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )
    op.execute(
        """
        CREATE POLICY programs_client_policy ON programs
            FOR SELECT
            USING (
                current_app_user_role() = 'client'
                AND client_id IN (
                    SELECT id FROM clients
                    WHERE rm_id::text = current_app_user_id()
                )
            );
        """
    )
    op.execute(
        """
        CREATE POLICY programs_partner_policy ON programs
            FOR SELECT
            USING (
                current_app_user_role() = 'partner'
                AND id IN (
                    SELECT pa.program_id
                    FROM partner_assignments pa
                    JOIN partner_profiles pp ON pp.id = pa.partner_id
                    WHERE pp.user_id::text = current_app_user_id()
                )
            );
        """
    )

    # ── milestones ───────────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY milestones_internal_policy ON milestones
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )
    op.execute(
        """
        CREATE POLICY milestones_client_policy ON milestones
            FOR SELECT
            USING (
                current_app_user_role() = 'client'
                AND program_id IN (
                    SELECT p.id FROM programs p
                    JOIN clients c ON c.id = p.client_id
                    WHERE c.rm_id::text = current_app_user_id()
                )
            );
        """
    )
    op.execute(
        """
        CREATE POLICY milestones_partner_policy ON milestones
            FOR SELECT
            USING (
                current_app_user_role() = 'partner'
                AND program_id IN (
                    SELECT pa.program_id
                    FROM partner_assignments pa
                    JOIN partner_profiles pp ON pp.id = pa.partner_id
                    WHERE pp.user_id::text = current_app_user_id()
                )
            );
        """
    )

    # ── tasks ────────────────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY tasks_internal_policy ON tasks
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )
    op.execute(
        """
        CREATE POLICY tasks_client_policy ON tasks
            FOR SELECT
            USING (
                current_app_user_role() = 'client'
                AND milestone_id IN (
                    SELECT m.id FROM milestones m
                    JOIN programs p ON p.id = m.program_id
                    JOIN clients c ON c.id = p.client_id
                    WHERE c.rm_id::text = current_app_user_id()
                )
            );
        """
    )
    op.execute(
        """
        CREATE POLICY tasks_partner_policy ON tasks
            FOR SELECT
            USING (
                current_app_user_role() = 'partner'
                AND milestone_id IN (
                    SELECT m.id FROM milestones m
                    JOIN partner_assignments pa
                        ON pa.program_id = m.program_id
                    JOIN partner_profiles pp ON pp.id = pa.partner_id
                    WHERE pp.user_id::text = current_app_user_id()
                )
            );
        """
    )

    # ── deliverables ─────────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY deliverables_internal_policy ON deliverables
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )
    op.execute(
        """
        CREATE POLICY deliverables_partner_policy ON deliverables
            FOR SELECT
            USING (
                current_app_user_role() = 'partner'
                AND assignment_id IN (
                    SELECT pa.id
                    FROM partner_assignments pa
                    JOIN partner_profiles pp ON pp.id = pa.partner_id
                    WHERE pp.user_id::text = current_app_user_id()
                )
            );
        """
    )
    op.execute(
        """
        CREATE POLICY deliverables_partner_insert_policy ON deliverables
            FOR INSERT
            WITH CHECK (
                current_app_user_role() = 'partner'
                AND assignment_id IN (
                    SELECT pa.id
                    FROM partner_assignments pa
                    JOIN partner_profiles pp ON pp.id = pa.partner_id
                    WHERE pp.user_id::text = current_app_user_id()
                )
            );
        """
    )
    op.execute(
        """
        CREATE POLICY deliverables_partner_update_policy ON deliverables
            FOR UPDATE
            USING (
                current_app_user_role() = 'partner'
                AND assignment_id IN (
                    SELECT pa.id
                    FROM partner_assignments pa
                    JOIN partner_profiles pp ON pp.id = pa.partner_id
                    WHERE pp.user_id::text = current_app_user_id()
                )
            );
        """
    )

    # ── communications ───────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY communications_internal_policy ON communications
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )
    op.execute(
        """
        CREATE POLICY communications_client_policy ON communications
            FOR SELECT
            USING (
                current_app_user_role() = 'client'
                AND (
                    sender_id::text = current_app_user_id()
                    OR recipients ? current_app_user_id()
                )
            );
        """
    )
    op.execute(
        """
        CREATE POLICY communications_partner_policy ON communications
            FOR SELECT
            USING (
                current_app_user_role() = 'partner'
                AND (
                    sender_id::text = current_app_user_id()
                    OR recipients ? current_app_user_id()
                )
            );
        """
    )

    # ── documents ────────────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY documents_internal_policy ON documents
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )

    # ── kyc_documents ────────────────────────────────────────────
    op.execute(
        f"""
        CREATE POLICY kyc_documents_internal_policy ON kyc_documents
            FOR ALL
            USING ({INTERNAL_ROLES_CHECK})
            WITH CHECK ({INTERNAL_ROLES_CHECK});
        """
    )


def downgrade() -> None:
    """Drop all RLS policies and disable RLS."""

    policies = [
        ("clients", "clients_internal_policy"),
        ("client_profiles", "client_profiles_internal_policy"),
        ("programs", "programs_internal_policy"),
        ("programs", "programs_client_policy"),
        ("programs", "programs_partner_policy"),
        ("milestones", "milestones_internal_policy"),
        ("milestones", "milestones_client_policy"),
        ("milestones", "milestones_partner_policy"),
        ("tasks", "tasks_internal_policy"),
        ("tasks", "tasks_client_policy"),
        ("tasks", "tasks_partner_policy"),
        ("deliverables", "deliverables_internal_policy"),
        ("deliverables", "deliverables_partner_policy"),
        ("deliverables", "deliverables_partner_insert_policy"),
        ("deliverables", "deliverables_partner_update_policy"),
        ("communications", "communications_internal_policy"),
        ("communications", "communications_client_policy"),
        ("communications", "communications_partner_policy"),
        ("documents", "documents_internal_policy"),
        ("kyc_documents", "kyc_documents_internal_policy"),
    ]

    for table, policy in policies:
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table}")

    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")

    op.execute("DROP FUNCTION IF EXISTS current_app_user_id()")
    op.execute("DROP FUNCTION IF EXISTS current_app_user_role()")
