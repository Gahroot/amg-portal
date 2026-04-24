"""Dump the FastAPI OpenAPI schema as JSON — no DB or server required.

Used by the frontend's ``npm run generate:types`` to regenerate
``frontend/src/types/generated.ts`` without having to run infra or start uvicorn.

Usage:
    python scripts/dump_openapi.py [output_path]

If ``output_path`` is omitted or ``-``, the schema is written to stdout.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Dummy infra URLs — the lifespan hook is never triggered by ``app.openapi()``,
# but settings are loaded at import time and expect these to be set.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost:5433/x")
os.environ.setdefault("REDIS_URL", "redis://localhost:6380/0")

from app.main import app  # noqa: E402


def main() -> None:
    schema = app.openapi()
    payload = json.dumps(schema)
    target = sys.argv[1] if len(sys.argv) > 1 else "-"
    if target == "-":
        sys.stdout.write(payload)
    else:
        Path(target).write_text(payload)


if __name__ == "__main__":
    main()
