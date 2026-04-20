# Railway Deployment Plan — AMG Portal

## Architecture on Railway

**Project:** `amg-portal` with 5 services:
- **PostgreSQL** — Railway managed database plugin
- **Redis** — Railway managed Redis plugin  
- **Storage Bucket** — Railway native S3-compatible bucket (replaces MinIO)
- **Backend** — FastAPI (uses existing `backend/Dockerfile`)
- **Frontend** — Next.js (uses existing `frontend/Dockerfile`)

## Key Technical Decisions

### MinIO → Railway Storage Bucket
The backend uses the `minio` Python SDK which is S3-compatible. Railway Buckets expose an S3-compatible endpoint (`storage.railway.app`). The MinIO SDK works against any S3 endpoint, so we just need to:
- Set `MINIO_ENDPOINT=storage.railway.app`
- Set `MINIO_SECURE=true` (Railway uses HTTPS)
- Set `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` from bucket credentials
- The bucket auto-initialization in `StorageService._ensure_bucket()` may fail since Railway manages the bucket — need to handle gracefully

However, the `_ensure_bucket` method calls `make_bucket`, `set_bucket_versioning`, and `set_bucket_encryption` which may not be supported on Railway's S3 implementation. We need to make this fault-tolerant (catch and log instead of crash).

### Database URL Format
Railway gives `DATABASE_URL` as `postgresql://...`. Our backend expects `postgresql+asyncpg://...`. We need to set `DATABASE_URL` explicitly with the `+asyncpg` driver prefix, using Railway's PG connection vars.

### Pre-deploy Command
Railway supports a `pre-deploy` command — use it for `alembic upgrade head` so migrations run before the app starts.

### CORS & Frontend URL
Backend needs `CORS_ORIGINS` set to the Railway-generated frontend domain, and `FRONTEND_URL`/`BACKEND_URL` set accordingly.

### NEXT_PUBLIC_API_URL at Build Time
The frontend Dockerfile takes `NEXT_PUBLIC_API_URL` as a build arg. We need to set this **before** the frontend builds. This is a chicken-and-egg problem — the backend domain doesn't exist until it's deployed. Solution: deploy backend first, get its domain, then set the build arg on frontend.

### DEBUG Mode
For client testing, set `DEBUG=true` initially to avoid the strict production validators for `SECRET_KEY`, `MFA_ENCRYPTION_KEY`, and `MINIO_SECRET_KEY`. Generate proper secrets for production.

### Config as Code
Create `backend/railway.toml` and `frontend/railway.toml` for each service's build/deploy config.

## Files to Create/Modify

- `backend/railway.toml` — Config: Dockerfile builder, pre-deploy command for migrations, healthcheck
- `frontend/railway.toml` — Config: Dockerfile builder, healthcheck  
- `backend/app/services/storage.py` — Make `_ensure_bucket` fault-tolerant for Railway Buckets (catch errors on versioning/encryption config)
- `backend/app/core/config.py` — No changes needed (env vars handle everything)

## Steps

1. Create `backend/railway.toml` with Dockerfile builder, pre-deploy command `cd /app && alembic upgrade head`, healthcheck path `/health`, and restart policy
2. Create `frontend/railway.toml` with Dockerfile builder, healthcheck path `/`, and restart policy
3. Make `StorageService._ensure_bucket()` in `backend/app/services/storage.py` fault-tolerant by wrapping `set_bucket_versioning` and `set_bucket_encryption` in try/except blocks that log warnings instead of crashing
4. Run `railway login` to authenticate (may already be logged in)
5. Run `railway init` to create the Railway project named `amg-portal`
6. Run `railway add --database postgres` to add PostgreSQL
7. Run `railway add --database redis` to add Redis
8. Create an empty backend service with `railway add --service backend`
9. Link to backend service, set environment variables: `DATABASE_URL` (with +asyncpg prefix using Railway PG reference vars), `REDIS_URL` (Railway Redis reference), `SECRET_KEY` (generated), `MFA_ENCRYPTION_KEY` (generated), `DEBUG=true`, `CORS_ORIGINS`, `MINIO_ENDPOINT=storage.railway.app`, `MINIO_SECURE=true`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `PORT=8000`, `FRONTEND_URL`, `BACKEND_URL`
10. Deploy backend with `railway up` from project root (targeting backend service, with root directory set)
11. Generate a public domain for backend with `railway domain`
12. Create an empty frontend service with `railway add --service frontend`
13. Link to frontend service, set `NEXT_PUBLIC_API_URL` to the backend's public URL as a build arg, set `PORT=3000`
14. Deploy frontend with `railway up` targeting frontend service
15. Generate a public domain for frontend with `railway domain`
16. Update backend's `CORS_ORIGINS` and `FRONTEND_URL` with the actual frontend domain, and `BACKEND_URL` with the actual backend domain
17. Redeploy backend so CORS picks up the frontend domain
18. Verify both services are healthy by hitting backend `/health` and frontend domain via `web_fetch`
