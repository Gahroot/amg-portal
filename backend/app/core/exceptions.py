"""Custom exception classes for better error handling and security.

This module provides a hierarchy of custom exceptions that allow for:
1. Consistent error responses across the application
2. Sanitization of sensitive information in error messages
3. Better separation of business logic errors from HTTP errors
"""

import logging
import re
from typing import Any

from fastapi import HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request

logger = logging.getLogger(__name__)


class AppException(Exception):  # noqa: N818
    """Base exception for application-specific errors."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundException(AppException):
    """Resource not found exception."""

    def __init__(self, message: str = "Resource not found", details: dict[str, Any] | None = None):
        super().__init__(message, status.HTTP_404_NOT_FOUND, details)


class BadRequestException(AppException):
    """Bad request exception."""

    def __init__(self, message: str = "Bad request", details: dict[str, Any] | None = None):
        super().__init__(message, status.HTTP_400_BAD_REQUEST, details)


class UnauthorizedException(AppException):
    """Unauthorized exception."""

    def __init__(self, message: str = "Unauthorized", details: dict[str, Any] | None = None):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED, details)


class ForbiddenException(AppException):
    """Forbidden exception."""

    def __init__(self, message: str = "Forbidden", details: dict[str, Any] | None = None):
        super().__init__(message, status.HTTP_403_FORBIDDEN, details)


class ConflictException(AppException):
    """Conflict exception."""

    def __init__(self, message: str = "Conflict", details: dict[str, Any] | None = None):
        super().__init__(message, status.HTTP_409_CONFLICT, details)


class ValidationException(AppException):
    """Validation exception."""

    def __init__(self, message: str = "Validation error", details: dict[str, Any] | None = None):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_CONTENT, details)


class GoneException(AppException):
    """Gone exception — resource permanently unavailable (e.g. expired/revoked links)."""

    def __init__(self, message: str = "Gone", details: dict[str, Any] | None = None):
        super().__init__(message, status.HTTP_410_GONE, details)


def _sanitize_error_message(message: str) -> str:
    """Remove potentially sensitive information from error messages.

    This prevents information disclosure by filtering out:
    - File paths
    - Database query details
    - Internal implementation details
    """
    # Remove file paths
    message = re.sub(r"[/\\][\w/\\.-]+\.pyw?", "<file>", message)
    # Remove database table/column details
    message = re.sub(r'relation "[\w.]+"', "relation", message)
    message = re.sub(r"column [\w.]+", "column", message)
    # Remove SQL query details
    message = re.sub(
        r"(SELECT|INSERT|UPDATE|DELETE).*?(FROM|INTO|VALUES)",
        "<query>",
        message,
        flags=re.IGNORECASE,
    )
    return message


async def app_exception_handler(
    request: Request,
    exc: AppException,
) -> JSONResponse:
    """Handler for custom application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "message": _sanitize_error_message(exc.message),
            "details": exc.details,
        },
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handler for Pydantic validation errors with sanitized messages."""
    # Sanitize error messages to prevent information disclosure
    sanitized_errors = []
    for error in exc.errors():
        sanitized_error = error.copy()
        # Remove file paths from error messages
        if "msg" in sanitized_error:
            sanitized_error["msg"] = _sanitize_error_message(str(sanitized_error["msg"]))
        # Pydantic 2 puts the raw exception (e.g. ValueError from a model_validator)
        # in ctx.error, which is not JSON-serializable — stringify any such values.
        ctx = sanitized_error.get("ctx")
        if isinstance(ctx, dict):
            sanitized_error["ctx"] = {
                k: v if isinstance(v, (str, int, float, bool, type(None))) else str(v)
                for k, v in ctx.items()
            }
        sanitized_errors.append(sanitized_error)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"message": "Validation error", "details": sanitized_errors},
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handler for FastAPI HTTPException — normalises shape to match AppException."""
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": _sanitize_error_message(detail), "details": None},
        headers=getattr(exc, "headers", None),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handler for unexpected exceptions - prevents information disclosure."""
    # Log the full error for debugging, but don't expose internal details to the client
    logger.error(f"Unexpected error: {exc}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "An internal error occurred. Please try again later.", "details": {}},
    )
