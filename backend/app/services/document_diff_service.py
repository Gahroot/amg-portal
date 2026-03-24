"""Document version diff/comparison service."""

import asyncio
import contextlib
import difflib
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.schemas.document import (
    DiffLine,
    DocumentCompareResponse,
    DocumentDiffHunk,
    DocumentVersionResponse,
)
from app.services.storage import storage_service

MAX_DIFF_BYTES = 500 * 1024  # 500 KB cap for text diffing
CONTEXT_LINES = 3

TEXT_TYPES = {
    "application/json",
    "application/xml",
    "text/csv",
    "text/html",
    "text/markdown",
    "text/plain",
    "text/xml",
}


def _is_text(content_type: str | None) -> bool:
    if not content_type:
        return False
    base = content_type.split(";")[0].strip().lower()
    return base in TEXT_TYPES or base.startswith("text/")


def _fetch_content(file_path: str) -> bytes:
    """Download object bytes from MinIO (synchronous SDK call)."""
    response = storage_service.client.get_object(storage_service.bucket, file_path)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def _deleted_lines(lines_a: list[str], ai1: int, ai2: int) -> tuple[list[DiffLine], int]:
    result = [
        DiffLine(line_number_a=ai1 + i + 1, line_number_b=None, content=ln, change_type="deleted")
        for i, ln in enumerate(lines_a[ai1:ai2])
    ]
    return result, len(result)


def _added_lines(lines_b: list[str], bi1: int, bi2: int) -> tuple[list[DiffLine], int]:
    result = [
        DiffLine(line_number_a=None, line_number_b=bi1 + i + 1, content=ln, change_type="added")
        for i, ln in enumerate(lines_b[bi1:bi2])
    ]
    return result, len(result)


def _context_lines(
    lines_a: list[str], ai1: int, ai2: int, bi1: int
) -> list[DiffLine]:
    return [
        DiffLine(
            line_number_a=ai1 + i + 1,
            line_number_b=bi1 + i + 1,
            content=ln,
            change_type="context",
        )
        for i, ln in enumerate(lines_a[ai1:ai2])
    ]


def _opcode_to_lines(
    tag: str,
    ai1: int,
    ai2: int,
    bi1: int,
    bi2: int,
    lines_a: list[str],
    lines_b: list[str],
    is_first: bool,
    is_last: bool,
) -> tuple[list[DiffLine], int, int]:
    """Convert one opcode to DiffLines with context trimming. Returns (lines, adds, dels)."""
    if tag == "equal":
        if is_first:
            trim = max(0, (ai2 - ai1) - CONTEXT_LINES)
            ai1, bi1 = ai1 + trim, bi1 + trim
        elif is_last:
            keep = min(CONTEXT_LINES, ai2 - ai1)
            ai2, bi2 = ai1 + keep, bi1 + keep
        return _context_lines(lines_a, ai1, ai2, bi1), 0, 0

    lines: list[DiffLine] = []
    adds = dels = 0
    if tag in ("replace", "delete"):
        dl, cnt = _deleted_lines(lines_a, ai1, ai2)
        lines.extend(dl)
        dels += cnt
    if tag in ("replace", "insert"):
        al, cnt = _added_lines(lines_b, bi1, bi2)
        lines.extend(al)
        adds += cnt
    return lines, adds, dels


def _group_into_hunks(
    opcodes: list[tuple[str, int, int, int, int]],
) -> list[list[tuple[str, int, int, int, int]]]:
    """Group opcodes into hunk slices (changed blocks + surrounding context)."""
    changed = {i for i, (tag, *_) in enumerate(opcodes) if tag != "equal"}
    if not changed:
        return []
    n = len(opcodes)
    groups: list[list[tuple[str, int, int, int, int]]] = []
    i = 0
    while i < n:
        if i not in changed:
            i += 1
            continue
        start = i - 1 if i > 0 and opcodes[i - 1][0] == "equal" else i
        end = i + 1
        while end < n:
            if end in changed:
                end += 1
                continue
            _tag, ae1, ae2, *_ = opcodes[end]
            eq_len = ae2 - ae1
            next_changed = end + 1 < n and (end + 1) in changed
            if _tag == "equal" and next_changed and eq_len <= CONTEXT_LINES * 2:
                end += 1
                continue
            end += 1
            break
        groups.append(list(opcodes[start:end]))
        i = end
    return groups


def _build_hunk(
    group: list[tuple[str, int, int, int, int]],
    lines_a: list[str],
    lines_b: list[str],
) -> tuple[DocumentDiffHunk | None, int, int]:
    """Convert an opcode group into a single hunk. Returns (hunk, adds, dels)."""
    all_lines: list[DiffLine] = []
    total_add = total_del = 0
    n = len(group)
    for idx, (tag, ai1, ai2, bi1, bi2) in enumerate(group):
        chunk, add, delete = _opcode_to_lines(
            tag, ai1, ai2, bi1, bi2, lines_a, lines_b, idx == 0, idx == n - 1
        )
        all_lines.extend(chunk)
        total_add += add
        total_del += delete
    if not all_lines:
        return None, 0, 0
    a_nums = [ln.line_number_a for ln in all_lines if ln.line_number_a is not None]
    b_nums = [ln.line_number_b for ln in all_lines if ln.line_number_b is not None]
    return (
        DocumentDiffHunk(
            a_start=a_nums[0] if a_nums else 1,
            a_count=len(a_nums),
            b_start=b_nums[0] if b_nums else 1,
            b_count=len(b_nums),
            lines=all_lines,
        ),
        total_add,
        total_del,
    )


def _compute_text_diff(
    content_a: bytes,
    content_b: bytes,
) -> tuple[list[DocumentDiffHunk], int, int]:
    """Decode, compute unified diff, return (hunks, additions, deletions)."""
    lines_a = content_a.decode("utf-8", errors="replace").splitlines()
    lines_b = content_b.decode("utf-8", errors="replace").splitlines()
    raw_opcodes = difflib.SequenceMatcher(None, lines_a, lines_b, autojunk=False).get_opcodes()
    opcodes: list[tuple[str, int, int, int, int]] = [
        (tag, i1, i2, j1, j2) for tag, i1, i2, j1, j2 in raw_opcodes
    ]
    groups = _group_into_hunks(opcodes)
    hunks: list[DocumentDiffHunk] = []
    total_additions = total_deletions = 0
    for group in groups:
        hunk, add, delete = _build_hunk(group, lines_a, lines_b)
        if hunk:
            hunks.append(hunk)
            total_additions += add
            total_deletions += delete
    return hunks, total_additions, total_deletions


def _build_version_response(doc: Document) -> DocumentVersionResponse:
    data: dict[str, object] = {
        "id": doc.id,
        "version": doc.version,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at,
        "file_size": doc.file_size,
        "download_url": None,
    }
    if doc.file_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(str(doc.file_path))
    return DocumentVersionResponse.model_validate(data)


async def compare_document_versions(
    db: AsyncSession,
    version_a_id: UUID,
    version_b_id: UUID,
) -> DocumentCompareResponse:
    """Fetch two document versions, validate they're the same file, compute diff."""
    result_a = await db.execute(select(Document).where(Document.id == version_a_id))
    doc_a = result_a.scalar_one_or_none()
    if not doc_a:
        raise ValueError(f"Document {version_a_id} not found")

    result_b = await db.execute(select(Document).where(Document.id == version_b_id))
    doc_b = result_b.scalar_one_or_none()
    if not doc_b:
        raise ValueError(f"Document {version_b_id} not found")

    # Validate they represent the same logical file
    if (
        doc_a.entity_type != doc_b.entity_type
        or str(doc_a.entity_id) != str(doc_b.entity_id)
        or doc_a.file_name != doc_b.file_name
    ):
        raise ValueError(
            "Cannot compare documents from different entities or with different file names"
        )

    version_a_resp = _build_version_response(doc_a)
    version_b_resp = _build_version_response(doc_b)

    is_text = _is_text(str(doc_a.content_type) if doc_a.content_type else None) or _is_text(
        str(doc_b.content_type) if doc_b.content_type else None
    )
    metadata: dict[str, object] = {
        "version_a": {
            "version": doc_a.version,
            "file_size": doc_a.file_size,
            "content_type": doc_a.content_type,
            "created_at": doc_a.created_at.isoformat() if doc_a.created_at else None,
        },
        "version_b": {
            "version": doc_b.version,
            "file_size": doc_b.file_size,
            "content_type": doc_b.content_type,
            "created_at": doc_b.created_at.isoformat() if doc_b.created_at else None,
        },
    }

    if not is_text:
        return DocumentCompareResponse(
            version_a=version_a_resp,
            version_b=version_b_resp,
            is_text=False,
            diff_available=False,
            hunks=[],
            total_additions=0,
            total_deletions=0,
            metadata=metadata,
        )

    # Fetch both files in thread pool (synchronous MinIO SDK)
    try:
        content_a, content_b = await asyncio.gather(
            asyncio.to_thread(_fetch_content, str(doc_a.file_path)),
            asyncio.to_thread(_fetch_content, str(doc_b.file_path)),
        )
    except Exception:
        return DocumentCompareResponse(
            version_a=version_a_resp,
            version_b=version_b_resp,
            is_text=True,
            diff_available=False,
            hunks=[],
            total_additions=0,
            total_deletions=0,
            metadata=metadata,
        )

    # Cap large files
    if len(content_a) > MAX_DIFF_BYTES or len(content_b) > MAX_DIFF_BYTES:
        return DocumentCompareResponse(
            version_a=version_a_resp,
            version_b=version_b_resp,
            is_text=True,
            diff_available=False,
            hunks=[],
            total_additions=0,
            total_deletions=0,
            metadata={**metadata, "diff_skipped_reason": "file_too_large"},
        )

    hunks, total_additions, total_deletions = await asyncio.to_thread(
        _compute_text_diff, content_a, content_b
    )

    return DocumentCompareResponse(
        version_a=version_a_resp,
        version_b=version_b_resp,
        is_text=True,
        diff_available=True,
        hunks=hunks,
        total_additions=total_additions,
        total_deletions=total_deletions,
        metadata=metadata,
    )
