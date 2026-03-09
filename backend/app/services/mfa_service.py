"""MFA / TOTP service."""

import base64
import secrets
import string
from io import BytesIO

import pyotp
import qrcode


def generate_totp_secret() -> str:
    """Generate a random TOTP secret."""
    secret: str = pyotp.random_base32()
    return secret


def generate_provisioning_uri(secret: str, email: str) -> str:
    """Generate an otpauth:// provisioning URI."""
    totp = pyotp.TOTP(secret)
    uri: str = totp.provisioning_uri(name=email, issuer_name="AMG Portal")
    return uri


def generate_qr_code_base64(provisioning_uri: str) -> str:
    """Generate a QR code PNG as a base64-encoded string."""
    img = qrcode.make(provisioning_uri)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code with a 1-step window."""
    totp = pyotp.TOTP(secret)
    result: bool = totp.verify(code, valid_window=1)
    return result


def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate random 8-char alphanumeric backup codes."""
    alphabet = string.ascii_uppercase + string.digits
    return ["".join(secrets.choice(alphabet) for _ in range(8)) for _ in range(count)]


def verify_backup_code(stored_codes: list[str], code: str) -> tuple[bool, list[str]]:
    """Verify a backup code, returning (valid, remaining_codes)."""
    upper_code = code.upper()
    if upper_code in stored_codes:
        remaining = [c for c in stored_codes if c != upper_code]
        return True, remaining
    return False, stored_codes
