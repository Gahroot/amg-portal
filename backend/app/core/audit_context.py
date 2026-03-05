"""ContextVar bridging HTTP request context to SQLAlchemy event listener."""

import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field


@dataclass
class AuditContext:
    user_id: uuid.UUID | None = field(default=None)
    user_email: str | None = field(default=None)
    ip_address: str | None = field(default=None)
    user_agent: str | None = field(default=None)


audit_context_var: ContextVar[AuditContext | None] = ContextVar("audit_context_var", default=None)
