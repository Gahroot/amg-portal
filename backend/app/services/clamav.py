"""ClamAV INSTREAM virus scanning for file uploads (Phase 2.2).

Minimal, self-contained clamd INSTREAM client — no third-party dependency.
The clamd INSTREAM protocol:

  1.  Open TCP socket to clamd
  2.  Send ``nINSTREAM\\n``
  3.  Send repeated ``[length:4BE][chunk]`` blocks until done
  4.  Send ``\\x00\\x00\\x00\\x00`` (zero-length block) as EOF
  5.  Read a single-line response:
        ``stream: OK``
        ``stream: <signature> FOUND``
        ``stream: <reason> ERROR``

We don't talk directly to clamd via filesystem — ClamAV must never see
container paths.  A TCP socket keeps the backend stateless and portable.

``scan_bytes`` is the only public surface.  It returns ``ScanResult``:

  * ``result = "OK"`` — clean
  * ``result = "FOUND"`` with ``signature`` set — reject the upload
  * ``result = "ERROR"`` with ``signature`` = error reason — respect
    ``CLAMAV_FAIL_OPEN`` (production: fail closed)
  * ``result = "DISABLED"`` — scanner not configured; caller decides
"""

from __future__ import annotations

import logging
import socket
import struct
from dataclasses import dataclass
from typing import Literal

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.exceptions import BadRequestException

logger = logging.getLogger(__name__)

ScanVerdict = Literal["OK", "FOUND", "ERROR", "DISABLED"]


@dataclass(frozen=True)
class ScanResult:
    verdict: ScanVerdict
    signature: str | None = None

    def as_column(self) -> str:
        """Render for the documents.clam_result column."""
        if self.signature:
            return f"{self.verdict}:{self.signature}"[:100]
        return self.verdict


_CHUNK = 64 * 1024  # 64 KiB per INSTREAM block


def _scan_sync(data: bytes) -> ScanResult:
    host = settings.CLAMAV_HOST
    if not host:
        return ScanResult("DISABLED")
    port = settings.CLAMAV_PORT
    timeout = settings.CLAMAV_TIMEOUT_SECONDS

    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(b"nINSTREAM\n")
            # Stream chunks
            view = memoryview(data)
            for i in range(0, len(view), _CHUNK):
                chunk = view[i : i + _CHUNK]
                sock.sendall(struct.pack("!L", len(chunk)) + bytes(chunk))
            sock.sendall(struct.pack("!L", 0))

            # Read response (single line, up to ~1024 bytes)
            buf = bytearray()
            while True:
                piece = sock.recv(1024)
                if not piece:
                    break
                buf.extend(piece)
                if b"\n" in piece:
                    break
    except (TimeoutError, OSError) as exc:
        logger.warning("ClamAV scan failed: %s", exc)
        return ScanResult("ERROR", str(exc)[:100])

    response = bytes(buf).strip().decode("utf-8", errors="replace")
    # Expected: "stream: OK" or "stream: <sig> FOUND" or "stream: <msg> ERROR"
    if response.endswith("OK"):
        return ScanResult("OK")
    if response.endswith("FOUND"):
        # Example: "stream: Eicar-Test-Signature FOUND"
        sig = response[len("stream: ") : -len(" FOUND")].strip()
        return ScanResult("FOUND", sig)
    if response.endswith("ERROR"):
        msg = response[len("stream: ") : -len(" ERROR")].strip()
        return ScanResult("ERROR", msg)
    logger.warning("ClamAV unexpected response: %s", response)
    return ScanResult("ERROR", f"unexpected response: {response[:80]}")


async def scan_bytes(data: bytes) -> ScanResult:
    """Run an INSTREAM scan on ``data``; never raises on scanner errors."""
    return await run_in_threadpool(_scan_sync, data)


async def enforce_clean(data: bytes) -> ScanResult:
    """Scan + raise ``BadRequestException`` on a hit.

    On scanner error, respects ``settings.CLAMAV_FAIL_OPEN``.  Returns the
    ScanResult for caller to persist on the document row regardless.
    """
    result = await scan_bytes(data)
    if result.verdict == "FOUND":
        raise BadRequestException(
            f"Upload rejected: malware detected ({result.signature or 'unknown'})"
        )
    if result.verdict == "ERROR" and not settings.CLAMAV_FAIL_OPEN:
        raise BadRequestException("Upload rejected: virus scanner unavailable")
    return result
