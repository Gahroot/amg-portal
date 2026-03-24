# i18n Language Preference — Implementation Plan

## Overview

Add preferred language selection for UI localization. Uses **next-intl in client-only mode** (no locale routing changes needed — no middleware, no `[locale]` route restructuring). Language preference is persisted per-user on the backend via the `User` model.

Supported languages: `en`, `es`, `fr`, `de`, `zh`, `ja`, `ar`

---

## Architecture Decisions

1. **next-intl client-only mode** — avoids restructuring all routes. `NextIntlClientProvider` wraps the app; no `middleware.ts` needed for routing.
2. **`preferred_language` on `User` model** — all user types (internal staff + client) can store their preference server-side.
3. **Auto-detect from `navigator.language`** as fallback if no preference saved.
4. **Translation scope** — cover common UI strings, settings pages, and portal pages. Other pages migrated incrementally.

---

## Step-by-Step Implementation

### 1. Backend — User model (`backend/app/models/user.py`)
Add `preferred_language: Mapped[str | None] = mapped_column(String(10), nullable=True)` to the `User` class.

### 2. Backend — Alembic migration
Create `backend/alembic/versions/add_preferred_language_to_users.py` with a simple `op.add_column` for `users.preferred_language VARCHAR(10)`.

### 3. Backend — Schemas (`backend/app/schemas/auth.py`)
- Add `preferred_language: str | None = None` to `UserResponse`
- Add `preferred_language: str | None = None` to `ProfileUpdateRequest`

### 4. Frontend — Install next-intl
`cd frontend && npm install next-intl`

### 5. Frontend — Translation message files
Create `frontend/src/i18n/messages/{en,es,fr,de,zh,ja,ar}.json` with shared UI string keys covering:
- Common: save, cancel, loading, error, success
- Navigation: settings, logout, profile, notifications
- Settings: profile, appearance, language, notifications, security
- Portal: dashboard, programs, documents, communications, settings

### 6. Frontend — Language constants (`frontend/src/i18n/locales.ts`)
Export `SUPPORTED_LOCALES` array and `Locale` type.

### 7. Frontend — Language provider (`frontend/src/providers/language-provider.tsx`)
- Client component
- Reads `user.preferred_language` from auth context
- Falls back to `localStorage.getItem("preferred_language")`
- Falls back to `navigator.language` (first 2 chars)
- Falls back to `"en"`
- Dynamically imports messages JSON for selected locale
- Wraps children in `NextIntlClientProvider`
- Exposes `setLanguage(locale)` via context
- When language changes: saves to `localStorage`, calls `updateProfile({ preferred_language: locale })` API

### 8. Frontend — `useLanguage` hook (`frontend/src/hooks/use-language.ts`)
Exposes `{ locale, setLanguage, isSupported }` from LanguageContext.

### 9. Frontend — `LanguageSelector` component (`frontend/src/components/ui/language-selector.tsx`)
- Dropdown with flag emoji + native language name for each locale
- Calls `setLanguage()` on selection

### 10. Frontend — Update `providers.tsx`
Wrap with `LanguageProvider` (inside `AuthProvider` so it can read user preference).

### 11. Frontend — Sidebar user footer (`frontend/src/components/navigation/sidebar-user-footer.tsx`)
Add a "Language" `DropdownMenuSub` alongside the existing "Theme" sub-menu. Shows current language name. Clicking an option calls `setLanguage`.

### 12. Frontend — Dashboard settings (`frontend/src/app/(dashboard)/settings/page.tsx`)
Add a 5th tab "Language" (Globe icon) with the `LanguageSelector` card. Use `useTranslations()` on the appearance and language tabs as a demo.

### 13. Frontend — Portal settings (`frontend/src/app/(portal)/settings/page.tsx`)
Add a language card section with `LanguageSelector`. Apply `useTranslations()` to the page for all string labels.

### 14. Frontend — User type (`frontend/src/types/user.ts`)
Add `preferred_language?: string | null` to `User` interface and `preferred_language?: string` to `ProfileUpdateRequest`.

---

## Files Created/Modified

**Backend:**
- `backend/app/models/user.py` — add `preferred_language` column
- `backend/alembic/versions/add_preferred_language_to_users.py` — migration
- `backend/app/schemas/auth.py` — schema updates

**Frontend:**
- `frontend/src/i18n/messages/en.json` (+ es, fr, de, zh, ja, ar)
- `frontend/src/i18n/locales.ts`
- `frontend/src/providers/language-provider.tsx` (new)
- `frontend/src/hooks/use-language.ts` (new)
- `frontend/src/components/ui/language-selector.tsx` (new)
- `frontend/src/providers/providers.tsx` — add LanguageProvider
- `frontend/src/components/navigation/sidebar-user-footer.tsx` — add language sub-menu
- `frontend/src/app/(dashboard)/settings/page.tsx` — add Language tab
- `frontend/src/app/(portal)/settings/page.tsx` — add language selector
- `frontend/src/types/user.ts` — add `preferred_language`

---

## Out of Scope (noted for future)
- Email template translations (backend Jinja2 templates — would need per-language template variants)
- Translating all 50+ dashboard pages (should be done incrementally using `useTranslations()`)
- `middleware.ts` locale-based routing (requires full route restructure)
