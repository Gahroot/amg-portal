# Fix Synchronous Blocking I/O in Async FastAPI Handlers

## Analysis

### Pattern A — MinIO SDK calls in `storage.py`

**Current issues:**
- `StorageService._ensure_bucket()` calls `client.bucket_exists()` + `client.make_bucket()` + `client.set_bucket_versioning()` + `client.set_bucket_encryption()` — all sync, called on every upload
- `StorageService.upload_file()` calls `client.put_object()` synchronously
- `StorageService.delete_file()` calls `client.remove_object()` synchronously (not in hot path but still sync)

**Plan:**
1. Add `_bucket_initialized: bool = False` flag to cache the bucket-ready state
2. Make `_ensure_bucket()` a proper async method (or keep sync but move the cache flag)
3. Add `async upload_bytes()` helper that wraps `put_object` in `run_in_threadpool`
4. Add `async download_file()` helper that wraps `get_object` + `.read()` in `run_in_threadpool`
5. In `upload_file()`: wrap `put_object` and bucket check in `run_in_threadpool`

**Specific approach:** Make `_ensure_bucket` sync (it's fine to call once) but add an `_initialized` flag so it only runs once. Then wrap each MinIO SDK call site in `run_in_threadpool(lambda: ...)`. Add a new `async download_file(object_name)` method for Pattern C callers.

**Import to add:** `from fastapi.concurrency import run_in_threadpool`

### Pattern B — WeasyPrint in `pdf_service.py`

**Current issues:**
- `PDFService.render_html_to_pdf()` is sync, CPU-intensive (1-5s), called from:
  - `pdf_service.py:89` — `store_report_pdf` (already async) 
  - `certificate_service.py:358` — `generate_certificate_pdf` (already async)
  - `report_generator_service.py:54-60` — `_generate_attachment_bytes` (sync, called from async `generate_report_for_schedule`)
  - `reports.py:560,595,634,659` — called directly in async handlers via `generate_*_pdf` methods
  - `exports/pdf.py:72,188,322,412,480` — called in async handlers via `pdf_export_service.*`

**Plan:** Make `render_html_to_pdf` async in BOTH `PDFService` and `PDFExportService`, using `await run_in_threadpool(...)` internally.

This requires:
1. `pdf_service.PDFService.render_html_to_pdf` → `async def`, with `await run_in_threadpool(lambda: HTML(string=html).write_pdf())`
2. All callers of `render_html_to_pdf` in `pdf_service.py` (`generate_*_pdf` methods) → make them all `async def`, add `await`
3. `pdf_export_service.PDFExportService.render_html_to_pdf` → same
4. All callers of `render_html_to_pdf` in `pdf_export_service.py` → make them `async def`, add `await`
5. `_generate_attachment_bytes` in `report_generator_service.py` → make it `async def`, change callers
6. All call sites in `reports.py` and `exports/pdf.py` → add `await`
7. `certificate_service.py:358` → already in async method, just add `await`
8. `pdf_service.py:89` (store_report_pdf) → wrap `put_object` in `run_in_threadpool` + `await render_html_to_pdf`

### Pattern C — Direct MinIO calls outside storage service

**Locations:**
- `clearance_certificates.py:587-590` — `storage_service.client.get_object(...).read()`
- `docusign.py:53-58` — `storage_service.client.get_object(...).read()` + close/release
- `document_diff_service.py:43-47` — `_fetch_content()` sync helper (already correctly wrapped in `asyncio.to_thread` at line 281-283, no change needed)
- `intake_workflow_service.py:446-451` — `_fetch_pdf_from_storage()` sync helper, called directly at line 399 without thread wrapping
- `certificate_service.py:370-376` — `storage_service.client.put_object()` in async method
- `pdf_service.py:89-96` — `storage_service.client.put_object()` in async method
- `report_generator_service.py:100-107` — `_ensure_bucket()` + `put_object()` in async

**Plan:**
- Add `async download_file(object_name: str) -> bytes` to `StorageService` — wraps get_object + read in `run_in_threadpool`
- Add `async upload_bytes(object_name: str, data: bytes, content_type: str) -> None` to `StorageService` — wraps put_object in `run_in_threadpool`
- Update `clearance_certificates.py` to use `await storage_service.download_file(cert.pdf_path)`
- Update `docusign.py` to use `await storage_service.download_file(doc.file_path)`
- Update `intake_workflow_service.py` — make `_fetch_pdf_from_storage` async, wrap call in `await asyncio.to_thread(...)` or use new `download_file`
- Update `certificate_service.py:store_certificate_pdf` to use `await storage_service.upload_bytes(...)`
- Update `pdf_service.py:store_report_pdf` to use `await storage_service.upload_bytes(...)`
- Update `report_generator_service.py` to use `await storage_service.upload_bytes(...)` and move `_ensure_bucket` to init

### `_ensure_bucket` caching

Move bucket initialization out of the hot path:
- Add `_bucket_initialized: bool = False` class attribute
- In `_ensure_bucket()`, check the flag and skip if already done
- Make `_ensure_bucket()` async (wrapping sync SDK calls in `run_in_threadpool`)
- Call `await storage_service._ensure_bucket()` once at app startup OR just lazily with the flag — lazy is fine
- The `upload_file` method already calls `_ensure_bucket` — after making it async+cached, it won't be a hot path cost anymore

---

## Files to Change

1. `backend/app/services/storage.py` — add `download_file`, `upload_bytes`, make `_ensure_bucket` async+cached
2. `backend/app/services/pdf_service.py` — make `render_html_to_pdf` async, cascade to all `generate_*_pdf`, fix `store_report_pdf` 
3. `backend/app/services/pdf_export_service.py` — make `render_html_to_pdf` async, cascade
4. `backend/app/services/certificate_service.py` — await `render_html_to_pdf` + fix `store_certificate_pdf`
5. `backend/app/services/report_generator_service.py` — make `_generate_attachment_bytes` async, fix MinIO calls
6. `backend/app/services/intake_workflow_service.py` — make `_fetch_pdf_from_storage` async
7. `backend/app/api/v1/reports.py` — await the `generate_*_pdf` calls
8. `backend/app/api/v1/exports/pdf.py` — await the `generate_*_pdf` calls
9. `backend/app/api/v1/clearance_certificates.py` — use `download_file`
10. `backend/app/api/v1/docusign.py` — use `download_file`

---

## Steps
1. Read all affected files fully (already done in plan mode exploration)
2. Update `backend/app/services/storage.py`: add `_bucket_initialized` flag, make `_ensure_bucket` async with `run_in_threadpool`, add `async download_file(object_name) -> bytes` method, add `async upload_bytes(object_name, data, content_type) -> None` method, wrap `delete_file` in `run_in_threadpool`, update `upload_file` to use `await _ensure_bucket()` and `await upload_bytes()`
3. Update `backend/app/services/pdf_service.py`: make `render_html_to_pdf` async using `run_in_threadpool`, make all `generate_*_pdf` methods async, update `store_report_pdf` to use `await storage_service.upload_bytes()`
4. Update `backend/app/services/pdf_export_service.py`: make `render_html_to_pdf` async using `run_in_threadpool`, make all `generate_*_pdf` methods async
5. Update `backend/app/services/certificate_service.py`: await `render_html_to_pdf` in `generate_certificate_pdf`, update `store_certificate_pdf` to use `await storage_service.upload_bytes()`
6. Update `backend/app/services/report_generator_service.py`: make `_generate_attachment_bytes` async, await all pdf_service calls in it, update `generate_report_for_schedule` to await `_generate_attachment_bytes`, use `await storage_service.upload_bytes()`
7. Update `backend/app/services/intake_workflow_service.py`: make `_fetch_pdf_from_storage` async using `await storage_service.download_file()`, add `await` at call site
8. Update `backend/app/api/v1/reports.py`: add `await` to the four `pdf_service.generate_*_pdf()` call sites (lines 560, 595, 634, 659)
9. Update `backend/app/api/v1/exports/pdf.py`: add `await` to the five `pdf_export_service.generate_*_pdf()` call sites (lines 72, 188, 322, 412, 480)
10. Update `backend/app/api/v1/clearance_certificates.py`: replace direct MinIO calls with `await storage_service.download_file(cert.pdf_path)`
11. Update `backend/app/api/v1/docusign.py`: replace direct MinIO calls with `await storage_service.download_file(doc.file_path)`
12. Run `cd backend && ruff check . && mypy .` and fix all errors
