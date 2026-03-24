"""Public API module for external integrations."""

from app.api.v1.public.webhooks import router as public_router

__all__ = ["public_router"]
