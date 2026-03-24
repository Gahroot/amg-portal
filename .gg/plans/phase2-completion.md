# Phase 2 Completion Plan — AMG Portal

## Phase 2 Scope: "Intelligence Layer"
Reporting, communications architecture, and integration with core third-party systems.

### Phase 2 Deliverables (from Design Doc)
1. **Automated reporting suite (all three classes)** — Program Status Report and Portfolio Overview delivered to live clients
2. **Communications templates and approval workflow** — All client communications traceable in portal
3. **CRM integration (bi-directional sync)** — Zero duplicate records between portal and CRM
4. **In-portal document signing** — Client approvals executed within portal — no email PDFs
5. **Escalation workflow and alert system** — All escalations logged and resolved within defined SLAs
6. **Partner performance scoring system** — Scorecard populated for all active partners

---

## Current State Audit

### What EXISTS:
- ✅ Report service with Class A (Portfolio, Program Status, Completion, Annual) + CSV/PDF export
- ✅ Class B internal reports (RM Portfolio, Escalation Log, Compliance Audit) — backend endpoints
- ✅ Class C partner reports (Brief Summary, Deliverable Feedback, Engagement History) — backend + frontend
- ✅ Report scheduling CRUD (schedules stored but NOT executed)
- ✅ Communication templates (9 seeded: welcome, kickoff, weekly_status, decision_request, milestone_alert, completion_note, partner_dispatch, deliverable_submission, assignment_accepted/declined)
- ✅ Auto-dispatch service for event-triggered notifications
- ✅ Conversations + messaging (list, send, read receipts, unread counts)
- ✅ Document upload/download/versioning with MinIO
- ✅ Document acknowledgment (typed electronic signature) + signing page in client portal
- ✅ Escalation CRUD (create, list, get, acknowledge, resolve, check-risks)
- ✅ SLA tracking (start clock, breach detection, scheduled breach check job)
- ✅ Partner scoring (aggregate ratings, scorecard, rankings, performance history)
- ✅ Calendar integration (iCal, Google/Microsoft OAuth)
- ✅ Dashboard with Program Health table + portfolio summary

### What's MISSING / INCOMPLETE — 10 Feature Areas:

1. **Report schedule execution** — schedules stored but never run
2. **Communication approval workflow** — no draft→review→approve→send flow
3. **External communication logging** — no way to log calls/meetings as portal records
4. **Partner performance governance** — no SLA adherence %, first-pass rate, probation, de-listing
5. **Escalation auto-triggers & chain progression** — mostly manual, no auto-escalation
6. **Document delivery & evidence vault** — no packages, delivery tracking, or vault
7. **Messaging scope enforcement & email digest** — no partner/client message boundaries
8. **Scheduling & coordination tools** — calendar exists but no in-portal scheduling
9. **Communication audit trail** — no per-client comms history view
10. **Real-time dashboard enhancements** — no live updates, missing SLA/escalation metrics

---

## 10 Tasks (Dependency Order)

Each task is a complete, self-contained feature built end-to-end (model → schema → service → API → frontend page → lint/typecheck).
