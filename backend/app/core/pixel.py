"""Initialize ez-pixel error tracking."""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)
_initialized = False


def init_pixel() -> None:
    """Initialize the ez-pixel SDK if configured."""
    global _initialized
    if _initialized:
        return
    if not settings.PIXEL_PROJECT_KEY:
        logger.debug("Pixel project key not set — error tracking disabled")
        return
    try:
        import ez_pixel

        ez_pixel.init_pixel(
            project_key=settings.PIXEL_PROJECT_KEY,
            ingest_url=settings.PIXEL_INGEST_URL,
        )
        _initialized = True
        logger.info("Pixel error tracking initialized")
    except Exception:
        logger.warning("Failed to initialize pixel error tracking", exc_info=True)
