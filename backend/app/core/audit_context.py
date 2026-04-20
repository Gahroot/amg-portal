"""ContextVar bridging HTTP request context to SQLAlchemy event listeners.

The same ContextVar powers two listeners:

* ``app.core.audit_listener.after_flush`` — stamps audit rows with actor info.
* ``app.db.session._apply_rls_on_begin`` — ``SET LOCAL`` the Postgres session
  variables that the RLS policies read at the start of every transaction.

``user_role`` is optional because the middleware cannot read it from the JWT
(the token only carries ``sub`` + ``email``). It gets populated by
``get_current_user`` once the user row has been loaded; until then the RLS
listener treats the session as unauthenticated (policies default-deny, which
is the safe failure mode).
"""

import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field


@dataclass
class AuditContext:
    user_id: uuid.UUID | None = field(default=None)
    user_email: str | None = field(default=None)
    user_role: str | None = field(default=None)
    ip_address: str | None = field(default=None)
    user_agent: str | None = field(default=None)


audit_context_var: ContextVar[AuditContext | None] = ContextVar("audit_context_var", default=None)
