"""Tests for MFA/TOTP service."""

import pyotp

from app.services.mfa_service import (
    generate_backup_codes,
    generate_provisioning_uri,
    generate_qr_code_base64,
    generate_totp_secret,
    verify_backup_code,
    verify_totp,
)


class TestTOTPSecret:
    def test_generates_base32_secret(self) -> None:
        secret = generate_totp_secret()
        assert len(secret) > 0
        # Valid base32 characters
        import re

        assert re.match(r"^[A-Z2-7]+=*$", secret)

    def test_generates_unique_secrets(self) -> None:
        secrets = {generate_totp_secret() for _ in range(10)}
        assert len(secrets) == 10


class TestProvisioningURI:
    def test_generates_valid_uri(self) -> None:
        secret = generate_totp_secret()
        uri = generate_provisioning_uri(secret, "user@example.com")
        assert uri.startswith("otpauth://totp/")
        assert "AMG%20Portal" in uri or "AMG+Portal" in uri
        assert "user%40example.com" in uri or "user@example.com" in uri

    def test_different_emails_produce_different_uris(self) -> None:
        secret = generate_totp_secret()
        uri1 = generate_provisioning_uri(secret, "a@example.com")
        uri2 = generate_provisioning_uri(secret, "b@example.com")
        assert uri1 != uri2


class TestQRCode:
    def test_generates_base64_png(self) -> None:
        secret = generate_totp_secret()
        uri = generate_provisioning_uri(secret, "test@example.com")
        b64 = generate_qr_code_base64(uri)
        assert len(b64) > 100
        # Validate it's valid base64 by decoding
        import base64

        decoded = base64.b64decode(b64)
        assert decoded[:4] == b"\x89PNG"  # PNG magic bytes


class TestVerifyTOTP:
    def test_valid_code_accepted(self) -> None:
        secret = generate_totp_secret()
        totp = pyotp.TOTP(secret)
        code = totp.now()
        assert verify_totp(secret, code) is True

    def test_invalid_code_rejected(self) -> None:
        secret = generate_totp_secret()
        assert verify_totp(secret, "000000") is False

    def test_wrong_secret_rejected(self) -> None:
        secret1 = generate_totp_secret()
        secret2 = generate_totp_secret()
        totp = pyotp.TOTP(secret1)
        code = totp.now()
        assert verify_totp(secret2, code) is False


class TestBackupCodes:
    def test_generates_correct_count(self) -> None:
        codes = generate_backup_codes(8)
        assert len(codes) == 8

    def test_custom_count(self) -> None:
        codes = generate_backup_codes(5)
        assert len(codes) == 5

    def test_code_format(self) -> None:
        codes = generate_backup_codes()
        for code in codes:
            assert len(code) == 8
            assert code.isalnum()
            assert code == code.upper()

    def test_codes_are_unique(self) -> None:
        codes = generate_backup_codes(100)
        assert len(set(codes)) == 100


class TestVerifyBackupCode:
    def test_valid_code_returns_true_and_removes_it(self) -> None:
        codes = ["ABCD1234", "EFGH5678", "IJKL9012"]
        valid, remaining = verify_backup_code(codes, "ABCD1234")
        assert valid is True
        assert "ABCD1234" not in remaining
        assert len(remaining) == 2

    def test_invalid_code_returns_false(self) -> None:
        codes = ["ABCD1234", "EFGH5678"]
        valid, remaining = verify_backup_code(codes, "ZZZZ0000")
        assert valid is False
        assert remaining == codes

    def test_case_insensitive(self) -> None:
        codes = ["ABCD1234"]
        valid, remaining = verify_backup_code(codes, "abcd1234")
        assert valid is True
        assert len(remaining) == 0

    def test_empty_codes_list(self) -> None:
        valid, remaining = verify_backup_code([], "ABCD1234")
        assert valid is False
        assert remaining == []
