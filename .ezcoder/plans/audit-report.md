# AMG Portal — Full Audit Report
*April 2026 — Pre-Client Deployment Assessment*

---

## The Core Question: Is This Ready to Deploy to a Client?

**Short answer: Not yet — but it's closer than it looks.**

The backend is nearly production-ready. The client portal (the only thing a client sees) is functional but has several rough edges that would not meet "concierge-grade UX" expectations for UHNW clients. There are also infrastructure gaps (no Dockerfiles, no deployment config) that must be resolved before any cloud deploy.

Below is a prioritised, honest breakdown across three questions you asked.

---

## 1. Deployment Readiness

### What's Solid
- **Backend is mature.** ~70 models, ~70 services, 80+ API routes, comprehensive test suite (30 test files including integration workflows, RBAC, scheduling, KYC). This is not prototype code.
- **Security is properly thought through.** `SECRET_KEY` and `MFA_ENCRYPTION_KEY` required in production (raises `ValueError` on boot). Rate limiting on auth endpoints. JWT refresh tokens. CORS locked to `localhost:3000` by default.
- **Config is env-driven.** `pydantic-settings` reads from `.env`, easy to override per environment.
- **Infrastructure defined.** PostgreSQL 17, Redis 7, MinIO all in `docker-compose.yml`.

### What's Blocking a Deploy
1. **No `.env` files exist anywhere.** There are no `.env.example` files for either backend or frontend. No documentation of required env vars. A new deployment would have to guess from the code.
2. **No Dockerfiles.** The project has `docker-compose.yml` for infra but no Dockerfiles for the backend or frontend apps. You cannot containerise or deploy the application services as-is.
3. **No deployment config.** No Nginx config, no `railway.toml`, no Vercel config, no ECS task definitions — nothing indicating *how* this gets to a server.
4. **No seed data / demo data.** For a client UAT, you need pre-populated demo content (programs, documents, milestones). There are seeding scripts in `backend/scripts/` — unclear if they work.
5. **SMTP is unconfigured.** `SMTP_HOST` defaults to `None`. Password reset, email notifications, and document delivery emails will silently fail without a real SMTP provider (Resend, SendGrid, Postmark).
6. **MinIO is local-only.** For production you'd point at S3 or a managed MinIO instance — the config supports it, but no guidance exists.
7. **DocuSign is in demo/sandbox mode.** `DOCUSIGN_BASE_URI` defaults to `account-d.docusign.com` (sandbox). Fine for testing, needs switching for real contracts.
8. **Frontend `.env.local` absent.** The Next.js frontend almost certainly requires `NEXT_PUBLIC_API_URL` — not documented anywhere.

### Verdict
You need 1–2 days of devops work (Dockerfiles, `.env.example`, deployment config) before this can go anywhere near a server. Before client testing specifically, you also need SMTP working and seed data loaded.

---

## 2. UX — Cleanliness & Friction Audit (Client Portal)

The client portal (`/portal/*`) is the only surface your clients see. Here's what's rough:

### High-Priority Friction

**A. Loading states are lazy text, not skeletons everywhere**
- `portal/programs/page.tsx` shows plain `<p>Loading...</p>` on load instead of card skeletons.
- `portal/decisions/page.tsx` shows `<p className="text-sm text-muted-foreground">Loading decisions…</p>`.
- The dashboard has proper skeletons, but sub-pages regressed to text. For a UHNW client, a blank-looking page feels broken.

**B. Messages page has a desktop-only layout bug**
- `portal/messages/page.tsx` renders a fixed `w-80` conversation sidebar that has no responsive behaviour. On mobile, the sidebar doesn't collapse — both panels try to render. The `md:block` class means the sidebar *hides* on mobile, but then there's no way to see the conversation list. The mobile experience is broken.

**C. Settings page has a hard-coded white background**
- `portal/settings/page.tsx` uses `<div className="min-h-screen bg-white">` — ignores the warm cream theme token (`bg-background`) and breaks in dark mode (white flash).

**D. Empty states are generic and cold**
- "No programs found. Your programs will appear here once your relationship manager assigns them." — functional but feels like a SaaS startup, not a private client firm.
- "No messages yet" — same issue.
- For UHNW context, empty states should feel intentional and reassuring, not like a missing database entry.

**E. Breadcrumbs are missing the Playfair serif font**
- The portal header shows breadcrumbs in Geist Sans. Every page heading uses `font-serif`. The breadcrumb text style is inconsistent with the page's own title.

**F. No back navigation on portal program detail page**
- The `[id]/page.tsx` has `<Link href="/portal/programs">← Back</Link>` — need to confirm this actually renders correctly (the code starts at line 60 but uses `<ArrowLeft>` — fine). This is okay.

**G. Survey nav item is always visible**
- The `portalNavConfig` shows "Survey" as a permanent nav item. A client who has completed or has no survey will see this link go to an empty state. It should be conditionally surfaced (only when `activeSurvey` is non-null) or at minimum show a completion state.

**H. "What's New" is always visible**
- Same issue. If the feed is empty, this is a dead link in the nav.

### Medium-Priority UX Issues

**I. Portal layout has no user menu or account access in the header**
- The portal header (`(portal)/layout.tsx`) has: sidebar trigger, breadcrumbs, help button, notification bell. There is no avatar/name/account link in the header itself. The only way to access settings is via the sidebar footer. On mobile with sidebar collapsed, account access is buried.

**J. No toast feedback on document download**
- `portal/documents/page.tsx` calls `getDocumentDownloadUrl` and `window.open` — no loading state, no error handling. If the presigned URL fails, nothing happens.

**K. Document action buttons are icon-only with no labels**
- Download, Sign, Share are icon-only ghost buttons. For a client unfamiliar with the system, these are ambiguous without the `title` tooltip (which isn't keyboard/touch accessible).

**L. The "Account Status" card just shows "Active" — no context**
- `portal/dashboard/page.tsx` shows a card with just the word "Active" in large type. For a new client, this communicates nothing. It should say something like "Your account is active and in good standing" with a brief description.

---

## 3. UI Premium Feel — What Needs Elevating

This is where the biggest gap exists between the current UI and "concierge-grade UX for UHNW individuals."

### What's Already Good
- Brand tokens are correct: Playfair Display serif for headings, warm cream `#f5f3ef` background, gold `#c4a060` accent, subtle grain texture overlay. The palette is right.
- Dark mode and high-contrast mode are implemented.
- Accessibility is seriously considered (skip links, announcer, focus trap, ARIA landmarks, keyboard shortcuts).
- The layout structure (sidebar + main content) is clean and professional.

### What Undermines the Premium Feel

**A. Primary color is too muted for interactive elements**
- `--primary: #8b7d5e` (mid-brown) on buttons looks washed out — more like a disabled state than a call to action. The gold accent `#c4a060` is better but isn't used on primary buttons. First impression on action buttons is underwhelming.

**B. Card borders are nearly invisible**
- `--border: rgba(139, 125, 94, 0.12)` — at 12% opacity, card borders essentially disappear. Cards blend into the cream background. The result is a flat, formless layout rather than a structured, considered one. Luxury interfaces use *intentional* whitespace AND visible structure, not structural ambiguity.

**C. No elevation system**
- Cards have no `box-shadow` by default. Hover states use `hover:shadow-md` on some cards (programs list) but not others (dashboard cards). There's no consistent elevation hierarchy — no baseline card shadow, no elevated modal shadow. Everything reads at the same depth.

**D. Progress bars are default styled**
- The `<Progress>` component on program cards is the default shadcn/Radix implementation — a flat grey track with a flat primary-colored fill. No animation on load, no gradient. For a client tracking their own program progress, this deserves more craft.

**E. Typography scale has gaps**
- Page headings (`text-3xl font-bold font-serif`) are strong. But body text, card descriptions, and metadata (`text-sm text-muted-foreground`) all compress into the same small, muted style. There's no typographic middle tier — a comfortable `text-base` or `text-lg` weight for primary content. Reading the portal feels dense.

**F. The login page is minimal to the point of feeling sparse**
- A 48×48px logo, a title, and a form inside a plain card. For a portal serving UHNWs, the login experience sets the first impression. It should feel like entering a private members' space — a full-bleed background, larger logo treatment, possibly a brand statement, and significantly more visual ceremony.

**G. Badge styles are too utilitarian**
- RAG status badges (`green`, `amber`, `red`) use default shadcn variant colors. `variant="default"` renders in the primary brown. `variant="destructive"` is a flat red. These need custom semantic classes: a subtle green pill, a warm amber pill, a deep red pill — not generic component variants.

**H. No micro-interactions or transitions**
- Page transitions: none (Next.js default hard cuts between routes).
- Card hover: `hover:shadow-md` on some cards is a start, but no lift/translate.
- Button press states: default.
- These small moments — a 150ms card lift, a smooth sidebar collapse, a page fade — are what distinguish a premium interface from a competent one.

**I. The sidebar brand header shows "AMG Portal" in plain text**
- For a private wealth firm, the sidebar header should use the actual wordmark (image) at a larger scale, not a text label. The logo image exists (`/logo.webp`) but is rendered at 32×32px next to plain text. On a white/cream sidebar, this reads as a generic SaaS app.

**J. The feedback widget floats in the corner of the dashboard**
- A persistent `FeedbackWidget` floating in the bottom corner of the internal dashboard is fine. Having it visible to clients (it's excluded via `!isFocusMode` check, but appears in all non-focus states) would be inappropriate for the client/partner portals — check it's not leaking there.

---

## Summary Scorecard

| Area | Score | Status |
|------|-------|--------|
| Backend architecture & APIs | 9/10 | ✅ Production-quality |
| Backend test coverage | 8/10 | ✅ Comprehensive |
| Security & auth | 8/10 | ✅ Solid |
| Deployment infrastructure | 3/10 | ❌ Dockerfiles / env docs missing |
| Client portal functional completeness | 7/10 | ⚠️ Core flows work, edges rough |
| Client portal UX cleanliness | 5/10 | ⚠️ Several friction points |
| Client portal premium feel | 5/10 | ⚠️ Brand tokens right, execution inconsistent |
| Internal dashboard | 7/10 | ✅ Functional and feature-rich |
| Mobile responsiveness | 4/10 | ❌ Messages page broken, others untested |

---

## Recommended Sequence

### Before ANY client deployment
1. Create Dockerfiles + `.env.example` files
2. Configure SMTP (email delivery)
3. Load seed/demo data for UAT
4. Fix messages mobile layout

### Before client UAT (polish sprint)
5. Fix loading states (skeletons everywhere)
6. Fix `bg-white` in settings page
7. Elevate login page
8. Improve empty states (warmer copy)
9. Add card shadows / elevation system
10. Fix primary button color (use gold accent)
11. Fix badge semantic styling (RAG colors)
12. Conditionally show Survey/What's New nav items
13. Add document download feedback (toast + error handling)

### Phase 2 / polish (post-UAT)
14. Page transition animations
15. Progress bar polish
16. Typography middle tier
17. Mobile-first review of all portal pages
18. Sidebar brand header treatment

## Steps
1. Create backend `Dockerfile` and `docker-compose.override.yml` for the app service
2. Create frontend `Dockerfile` for production Next.js build
3. Create `backend/.env.example` with all required variables documented
4. Create `frontend/.env.example` with all required frontend variables
5. Fix messages page mobile layout (responsive sidebar collapse)
6. Fix settings page `bg-white` → `bg-background` (dark mode support)
7. Replace text loading states with skeleton loaders on programs, decisions pages
8. Elevate login page — full-bleed background, larger logo, brand statement
9. Improve empty states in portal (warmer, on-brand copy)
10. Add card elevation system (base shadow, hover lift) globally
11. Fix primary button color — map to gold accent token
12. Create semantic RAG badge variants (proper green/amber/red pill styles)
13. Conditionally render Survey and What's New sidebar items
14. Add toast + error handling to document download flow
15. Load seed/demo data script for UAT environment
