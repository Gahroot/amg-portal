"""Tests for custom exceptions and error sanitization."""


from app.core.exceptions import (
    AppException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
    ValidationException,
    _sanitize_error_message,
)


class TestExceptionHierarchy:
    def test_app_exception_defaults(self) -> None:
        exc = AppException("Something went wrong")
        assert exc.message == "Something went wrong"
        assert exc.status_code == 500
        assert exc.details == {}

    def test_app_exception_custom_status(self) -> None:
        exc = AppException("Bad", status_code=418, details={"tea": True})
        assert exc.status_code == 418
        assert exc.details == {"tea": True}

    def test_not_found_exception(self) -> None:
        exc = NotFoundException()
        assert exc.status_code == 404
        assert exc.message == "Resource not found"

    def test_not_found_custom_message(self) -> None:
        exc = NotFoundException("Client not found", details={"id": "123"})
        assert exc.message == "Client not found"
        assert exc.details == {"id": "123"}

    def test_bad_request_exception(self) -> None:
        exc = BadRequestException()
        assert exc.status_code == 400

    def test_unauthorized_exception(self) -> None:
        exc = UnauthorizedException()
        assert exc.status_code == 401

    def test_forbidden_exception(self) -> None:
        exc = ForbiddenException()
        assert exc.status_code == 403

    def test_conflict_exception(self) -> None:
        exc = ConflictException()
        assert exc.status_code == 409

    def test_validation_exception(self) -> None:
        exc = ValidationException()
        assert exc.status_code == 422

    def test_all_inherit_from_app_exception(self) -> None:
        exceptions = [
            NotFoundException(),
            BadRequestException(),
            UnauthorizedException(),
            ForbiddenException(),
            ConflictException(),
            ValidationException(),
        ]
        for exc in exceptions:
            assert isinstance(exc, AppException)


class TestSanitizeErrorMessage:
    def test_removes_file_paths(self) -> None:
        msg = "Error in /home/user/app/models/user.py line 42"
        sanitized = _sanitize_error_message(msg)
        assert "/home/user" not in sanitized
        assert "user.py" not in sanitized

    def test_removes_database_relation(self) -> None:
        msg = 'relation "users.email" does not exist'
        sanitized = _sanitize_error_message(msg)
        assert '"users.email"' not in sanitized

    def test_removes_column_reference(self) -> None:
        msg = "column users.hashed_password is not valid"
        sanitized = _sanitize_error_message(msg)
        assert "users.hashed_password" not in sanitized

    def test_removes_sql_queries(self) -> None:
        msg = "Error executing SELECT id, email FROM users WHERE id = 1"
        sanitized = _sanitize_error_message(msg)
        assert "SELECT" not in sanitized or "FROM" not in sanitized

    def test_preserves_safe_messages(self) -> None:
        msg = "Invalid email or password"
        assert _sanitize_error_message(msg) == msg

    def test_preserves_empty_string(self) -> None:
        assert _sanitize_error_message("") == ""
