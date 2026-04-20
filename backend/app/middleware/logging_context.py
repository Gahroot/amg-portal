"""Re-export of ``LoggingContextMiddleware`` for use in ``main.py``.

Lives next to other middleware modules so ``app/main.py`` can import it from
``app.middleware`` like the rest of the stack; the implementation lives in
``app.core.logging`` because it is tightly coupled with the JSON formatter
that consumes the ContextVar it sets.
"""

from app.core.logging import LoggingContextMiddleware

__all__ = ["LoggingContextMiddleware"]
