#!/bin/sh
set -e

# Run migrations
alembic upgrade head

# Start the application
exec gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
