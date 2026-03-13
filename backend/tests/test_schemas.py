"""Tests for Pydantic schema validation."""

import pytest
from pydantic import ValidationError

from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    Token,
    UserCreate,
)
from app.schemas.risk_forecast import RiskFactors


class TestUserCreate:
    def test_valid_user(self) -> None:
        user = UserCreate(email="test@example.com", password="StrongPass1!", full_name="Test User")
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"

    def test_password_too_short(self) -> None:
        with pytest.raises(ValidationError, match="at least 8 characters"):
            UserCreate(email="test@example.com", password="Sh1!", full_name="Test")

    def test_password_no_uppercase(self) -> None:
        with pytest.raises(ValidationError, match="uppercase"):
            UserCreate(email="test@example.com", password="lowercase1!", full_name="Test")

    def test_password_no_lowercase(self) -> None:
        with pytest.raises(ValidationError, match="lowercase"):
            UserCreate(email="test@example.com", password="UPPERCASE1!", full_name="Test")

    def test_password_no_digit(self) -> None:
        with pytest.raises(ValidationError, match="digit"):
            UserCreate(email="test@example.com", password="NoDigits!!", full_name="Test")

    def test_password_no_special_char(self) -> None:
        with pytest.raises(ValidationError, match="special character"):
            UserCreate(email="test@example.com", password="NoSpecial1a", full_name="Test")

    def test_invalid_email(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="Valid123!@#", full_name="Test")


class TestLoginRequest:
    def test_valid_login(self) -> None:
        req = LoginRequest(email="test@example.com", password="mypass")
        assert req.mfa_code is None

    def test_login_with_mfa(self) -> None:
        req = LoginRequest(email="test@example.com", password="mypass", mfa_code="123456")
        assert req.mfa_code == "123456"


class TestToken:
    def test_default_token_type(self) -> None:
        token = Token(access_token="abc", refresh_token="def")
        assert token.token_type == "bearer"
        assert token.mfa_required is False

    def test_mfa_required_token(self) -> None:
        token = Token(access_token="", refresh_token="", mfa_required=True)
        assert token.mfa_required is True


class TestChangePasswordRequest:
    def test_valid_change(self) -> None:
        req = ChangePasswordRequest(current_password="old", new_password="NewPass123!")
        assert req.current_password == "old"

    def test_weak_new_password(self) -> None:
        with pytest.raises(ValidationError, match="uppercase"):
            ChangePasswordRequest(current_password="old", new_password="weakpass1!")


class TestProfileUpdateRequest:
    def test_partial_update(self) -> None:
        req = ProfileUpdateRequest(full_name="New Name")
        assert req.full_name == "New Name"
        assert req.phone_number is None

    def test_empty_update(self) -> None:
        req = ProfileUpdateRequest()
        assert req.full_name is None


class TestRiskFactors:
    def test_defaults(self) -> None:
        factors = RiskFactors()
        assert factors.overdue_task_ratio == 0.0
        assert factors.sla_breach_count == 0
        assert factors.open_escalation_count == 0
        assert factors.budget_variance == 0.0
        assert factors.avg_nps_score is None

    def test_valid_factors(self) -> None:
        factors = RiskFactors(
            overdue_task_ratio=0.5,
            sla_breach_count=3,
            open_escalation_count=2,
            budget_variance=-0.1,
            avg_nps_score=7.5,
        )
        assert factors.overdue_task_ratio == 0.5

    def test_overdue_ratio_range(self) -> None:
        with pytest.raises(ValidationError):
            RiskFactors(overdue_task_ratio=-0.1)

    def test_negative_sla_breach_count(self) -> None:
        with pytest.raises(ValidationError):
            RiskFactors(sla_breach_count=-1)

    def test_nps_score_range(self) -> None:
        with pytest.raises(ValidationError):
            RiskFactors(avg_nps_score=11.0)
