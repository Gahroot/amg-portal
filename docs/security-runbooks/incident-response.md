# Incident Response Runbook

> Phase 3.1 of `docs/security-plan.md`. AMG is itself an incident-response firm — the platform team **is** the IR firm. Role separation below is **internal discipline**, not separate organisations.

## Sources

- PagerDuty Incident Response Docs — `github.com/PagerDuty/incident-response-docs/blob/master/docs/before/different_roles.md` (IC / Comms / Scribe / SME role definitions, public-domain reference).
- CivicActions Security IRP — `github.com/CivicActions/ssp-toolkit/blob/master/appendices/security-irp.md` (sitrep cadence, explicit hand-off ceremony, Slack-channel templates).
- Viet-ERP runbook — `github.com/nclamvn/Viet-ERP/blob/main/TPM/docs/runbooks/incident-response.md` (severity matrix layout with TTA / TTM columns).

---

## 1. Severity matrix

| Severity | Definition | Time-to-Acknowledge (TTA) | Time-to-Mitigate (TTM) | Examples |
|---|---|---|---|---|
| **P0** | Confirmed data breach, active intrusion, full outage, or any loss of confidentiality on KYC / IR-case material | **15 min, 24/7** | 4 hours to containment, 24 hours to mitigation | DB exfil in progress; KEK leaked; audit-chain mismatch alert; signed-cookie forgery seen in prod |
| **P1** | Probable security incident, partial outage, or precursor to P0 | 30 min business hours / 1 h after-hours | 8 hours | OAuth/DocuSign token compromise; presigned-URL leakage; CSP violation spike from one tenant; failed login storm beyond rate limits |
| **P2** | Suspected vulnerability, single-user impact, or hardening gap actively exploitable | 4 business hours | 5 business days | Single account suspected stuffing; new CVE in dependency with known prod exposure |
| **P3** | Low-risk finding, no active exploitation | 2 business days | Next sprint | Pen-test finding without exploit; security-headers regression on a non-auth route |

**Reassess every 30 minutes** during an active incident. Re-baseline severity in writing in the incident channel.

## 2. Roles

For AMG (small team, IR-firm in-house), the same person may hold multiple roles in a P2/P3, but in any **P0 or P1** these three roles **must be different humans**:

| Role | Owns | Hand-off cadence |
|---|---|---|
| **Incident Commander (IC)** | Single decision-maker. Triage, severity, declaring, mitigation calls, declaring resolved. **Does not touch keyboards.** | Re-confirm IC every 30 min; explicit hand-off ceremony if rotating |
| **Communications Lead** | Drafts and sends client notifications, internal comms, regulator-facing language. Owns Blindspot §9.14 (client-first before public). | Hands off only at the end of the incident |
| **Scribe** | Real-time timeline in the incident channel. Captures every command run, every decision, every observation. Source of truth for the post-mortem. | Rotates every 60 min in long incidents |
| **Subject-Matter Experts (SMEs)** | One per affected component (backend / frontend / database / MinIO / mobile / third-party connector). On call as IC requests. | Continuous |

**Explicit hand-off ceremony** (when any role rotates):

> "I, `<outgoing>`, am handing off `<role>` for incident `<INC-id>` to `<incoming>`. Current state: `<one-line summary>`. Open actions: `<list>`. Acknowledge?" — incoming responds "I, `<incoming>`, accept `<role>`."

Posted in the incident channel by the outgoing person.

## 3. On-call rotation skeleton (initial 2-week)

| Week | Primary IC / SME | Secondary | Comms Lead |
|---|---|---|---|
| Week 1 | `<MD>` | `<Tech Lead>` | `<MD>` |
| Week 2 | `<Tech Lead>` | `<MD>` | `<MD>` |

Rotation flips Monday 09:00 ET. Update this table in-place; do not duplicate. Add a third on-call when team grows beyond two engineers.

## 4. Paging path (no PagerDuty / Opsgenie)

Tiered, fail-loud:

1. **Tier 1 — Twilio SMS (free trial credit).** Trigger from Railway alert or manual via `scripts/page.sh` (TBD). Sends to primary + secondary. Subject: `[AMG-IR P<n>] <one-line>`.
2. **Tier 2 — Direct phone call tree.** Numbers maintained in `~/.amg-oncall.json` (encrypted with `age`, identity held by `<MD>` and `<Tech Lead>`):

   | Order | Person | Phone |
   |---|---|---|
   | 1 | `<MD>` | `<+1-…>` |
   | 2 | `<Tech Lead>` | `<+1-…>` |
   | 3 | `<Backup contact>` | `<+1-…>` |

3. **Tier 3 — Signal direct message** to the `#amg-ir-oncall` group (see §5).
4. **Tier 4 — Email** with `[URGENT][P0]` subject. **Never** the only channel; only as a paper trail.

If Tier 1 fails to ack within 5 min → Tier 2 immediately. **Do not assume the page was received.**

## 5. War room

- **Voice / video:** standing Google Meet at `https://meet.google.com/<amg-ir-room>` (book a permanent room, paste here). No ad-hoc room creation under stress.
- **Real-time chat:** Signal group **`#amg-ir-oncall`** (members: MD, Tech Lead, on-call SMEs, Comms Lead). Disappearing messages **OFF** during an incident, **ON** otherwise (the runbook is the record, not chat).
- **Sitrep cadence:** every 30 min into the incident channel. Format:

  ```
  SITREP <INC-id> @ <UTC time>
  Severity: P<n>
  IC: <name>   Comms: <name>   Scribe: <name>
  What we know: <bullets>
  What we don't: <bullets>
  Next decision point: <when, what>
  ```

- **Per-incident folder:** `docs/incidents/INC-YYYYMMDD-NN/` (created by the Scribe at declaration). Drop transcripts, screenshots, exported logs, signed evidence here.

## 6. Evidence preservation

Run **before** mitigation starts wherever possible (containment may destroy evidence). Scribe owns the checklist; SMEs execute.

- [ ] **Snapshot Railway Postgres.** `pg_dump --format=custom --no-owner --no-privileges` from the public DB URL (see CLAUDE.md for the override pattern). Encrypt with `age -r <archival-pubkey>` and store in the incident folder + off-platform backup target.
- [ ] **Snapshot MinIO buckets** under investigation (or all if unsure). `mc mirror --preserve` to a write-once location. Object Lock COMPLIANCE buckets (KYC, contracts, IR evidence) need no extra protection — they're already immutable.
- [ ] **Capture the latest audit-chain checkpoint.** Pull the most recent row from `audit_checkpoints` (Merkle root + Ed25519 signature + FreeTSA token) and pin it to the incident folder. This timestamps the boundary between "before incident" and "during incident".
- [ ] **Freeze relevant logs.** Pull Railway runtime logs for the affected service (`railway logs --service=<svc> --lines=10000`) and the build logs for the last deployment. Store as `<svc>-runtime-<utc>.log`.
- [ ] **Export `security_intelligence_service` records.** Per `backend/app/services/security_intelligence_service.py`, this is the source of truth for detected anomalies — dump everything in the incident window.
- [ ] **Export `access_audit_service` records.** Per `backend/app/services/access_audit_service.py`, this captures every authorisation decision; pull rows for the affected actor(s) and subject(s).
- [ ] **Hash everything.** `sha256sum` every artefact at capture time, write `MANIFEST.sha256` into the incident folder, sign with the IC's `age` identity.

## 7. Per-class response scripts

Each script is a starting checklist; the IC may deviate with explicit reasoning logged by the Scribe.

### 7.1 Leaked credential (env var, KEK, JWT signing key, DB password, OAuth token)

1. Declare **P0** if KEK / JWT signing / DB password; **P1** otherwise.
2. Rotate immediately:
   - Env-var rotation runbook applies (`docs/security-runbooks/key-rotation.md` — pending). Add new key version, flip `CURRENT_*_ID`, redeploy.
   - For JWT: bump `SECRET_KEY_V<N+1>`, leave V<N> in verification window for 15 min, then drop.
3. Force re-auth: invalidate all refresh tokens (`UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL`).
4. If KEK leaked: assume **all data ever encrypted with that KEK is compromised**. Notify Comms Lead. Plan re-encryption (lazy on next write; bulk re-encrypt for high-sensitivity fields).
5. Post-rotation: verify no decryption errors in logs (legitimate writes use new KEK; reads must still find old KEK in the version table).

### 7.2 Suspected DB exfiltration

1. **P0**.
2. **Do not** mass-revoke DB roles before snapshotting — destroys evidence of which role was used.
3. Snapshot DB (§6).
4. Identify the suspect connection: `pg_stat_activity` filtered to non-app roles. Capture `application_name`, `client_addr`, `query_start`.
5. Revoke the suspect role: `ALTER ROLE <role> NOLOGIN`. Then `pg_terminate_backend` its sessions.
6. Rotate every credential the role owns + every credential that role could have read (env vars in Railway, KEKs, OAuth tokens).
7. Pull `access_audit_service` rows for the time window — what subject rows did anyone touch?
8. Comms: see §8 templates. **Client-first.**

### 7.3 Third-party token compromise (Google, Outlook, DocuSign)

1. **P1** (P0 if DocuSign private key — that's signing authority).
2. Revoke at the third party: Google Workspace admin → revoke OAuth grant; DocuSign admin → revoke integration key + reissue.
3. Disable the connector in AMG: set the user's `*_calendar_token` / `docusign_*` fields to NULL. Worker will alert on next refresh attempt.
4. Audit: which connector actions occurred since the suspected compromise window? Pull from the connector's audit table + `audit_log`.
5. Rotate AMG-side encrypted-at-rest tokens (Phase 1.3 wrapper) so the wrapper key isn't trusted across the boundary.
6. Notify the affected user (the token-holder) and the Comms Lead (they decide on client comms based on what casework the token could touch).

### 7.4 CSP violation spike

1. **P1** if the violation pattern looks like an injection (`script-src` blocked-uri to a non-AMG host); **P2** if it looks like a misconfigured page.
2. Pull the CSP report payloads (endpoint TBD per security-plan §3.10 follow-up; today: Railway logs grep for `csp-violation`).
3. Diff: did we deploy a new third-party script? If yes, roll back deploy.
4. If not a deploy artefact: assume injection. Audit recent commits for any change that could have introduced reflected/stored XSS. Pull `security_intelligence_service` flags.
5. Tighten CSP narrowing window: drop any `unsafe-inline` from `style-src` if the spike originates there (currently still required for Tailwind/Radix — flag as known risk in incident notes).

### 7.5 Audit-chain mismatch alert

1. **P0**. The audit chain is a product feature for IR clients — a break is treated as a breach of integrity even before we know how it happened.
2. **Do not** truncate or reset the audit table. Snapshot DB first (§6).
3. Identify the broken row(s): the daily verification cron logs the `(day, row_id, expected_hash, computed_hash)` triplet — pull from APScheduler job output / Railway logs.
4. Determine: was it tampering (DB write outside the app role) or a code bug (SQLAlchemy event listener regression)?
   - Tampering: rotate `amg_audit_maintainer` credentials, audit who held them, escalate per §7.2.
   - Bug: capture the offending commit, write a regression test, re-derive the chain from the last verified checkpoint forward (Merkle root + FreeTSA token at the boundary is your anchor — see security-plan §5 D5).
5. Publish a notice on `.well-known/audit-incidents.json` (new) with the affected day + remediation summary, since IR clients independently verify.

### 7.6 Presigned-URL leak

1. **P1**.
2. Identify the leaked URL(s): source (Slack message, browser history, APM breadcrumb, support ticket, etc.) and what object they point to.
3. **Invalidate immediately:** rotate the MinIO access key the URL was signed with. Note: this invalidates *every* URL signed with that key, including legitimate ones still in flight; that's the trade-off and is correct.
4. Pull the MinIO access log (or, since default audit logs miss fetch on presigned URLs, pull whatever proxy-through audit exists) for the URL's object — was it actually fetched?
5. If fetched by a non-AMG IP: treat as exfil of that one file. Comms per §8.
6. Migrate the affected file class to proxy-through downloads if not already (security-plan §7.9).

## 8. Communications templates

**Rule (Blindspot §9.14):** for any incident affecting client data, **client notification precedes any public disclosure**, including security.txt updates, status-page entries, blog posts, or regulator filings. The Comms Lead drafts; the IC approves; the MD signs off on outbound.

### 8.1 Client notification (P0/P1, before public)

```
Subject: [AMG] Action required — security event affecting your account

<Client first name>,

At <UTC time> on <date> our security team detected <one-sentence
factual description, no speculation>. Your account is among those
potentially affected.

What we know:
- <bullet — facts only>
- <bullet>

What we are doing:
- <bullet>
- <bullet>

What we ask of you:
- <bullet — concrete action, e.g. rotate password, review recent
  document access, contact your relationship manager>

We will follow up within <24 / 48 / 72> hours with an updated assessment.
You may reach us directly at <phone> / <signal handle> at any time.

— <Sender name>, <title>
  Anchor Mill Group
```

### 8.2 Internal all-hands (after client notification dispatched)

```
Team — incident <INC-id>, severity <P0/P1>, declared <UTC time>.

What happened: <2-3 sentences>
Who is affected: <client list / cohort>
What clients have been told: <link to template, time of dispatch>
On-call IC: <name>   Comms: <name>   Scribe: <name>

Until further notice:
- <ops impact, e.g. no deploys until containment confirmed>
- <comms discipline, e.g. no Slack chatter outside #amg-ir-oncall>

Updates here every 30 min via SITREP.
```

### 8.3 Public disclosure (only after client notification has landed)

Pre-draft template lives in `docs/incidents/templates/public-disclosure.md`. **Never** post-publish before MD signs off.

## 9. 24-hour and 72-hour timeline checklists

### Within 1 hour
- [ ] Severity declared, IC named
- [ ] Incident channel + folder created
- [ ] Initial SITREP posted
- [ ] Evidence preservation started (§6)

### Within 4 hours
- [ ] Containment in place (or written explanation why not)
- [ ] First client notification draft prepared (Comms Lead)
- [ ] Hourly SITREPs cadence confirmed
- [ ] First external-fact disclosure to MD complete

### Within 24 hours (the "24-hour clock")
- [ ] Client notifications sent (P0/P1)
- [ ] Affected scope characterised (which clients, what data, what time window)
- [ ] Mitigation deployed (or P0/P1 escalation rationale logged)
- [ ] Evidence package signed and archived (Manifest + `age`-encrypted to off-platform target)
- [ ] First internal lessons-learned timestamped (raw notes — not the post-mortem yet)
- [ ] If applicable: regulatory disclosure clock evaluated (US state breach laws, future GDPR/CCPA — currently US-only per security-plan §2.2)

### Within 72 hours
- [ ] All affected clients individually contacted by their relationship manager (not just bulk email)
- [ ] Public statement decision made (publish / not publish — written justification either way)
- [ ] Root-cause analysis draft (RCA) circulated to IR team
- [ ] Compensating controls deployed or scheduled with owner + ETA
- [ ] Audit-chain integrity reverified end-to-end (and a fresh signed checkpoint published)
- [ ] Post-mortem scheduled (see §10)

## 10. Post-mortem & lessons learned

- **Template:** `docs/incidents/templates/post-mortem.md` (to be written; mirror Google SRE blameless format — what happened / impact / root cause / detection / response / what went well / what went poorly / action items with owners + dates).
- **Cadence:** every Friday at 14:00 ET following any P0/P1 in the prior 7 days. If none, the meeting is cancelled (do not pad agendas).
- **Output:** action items land in GitHub Issues with label `incident-action`, owner, and target date. The IC owns nag-rights until close.
- **Distribution:** post-mortems live in `docs/incidents/INC-*/post-mortem.md` and are visible to the entire AMG team. Externally redacted version is shareable with affected clients on request.

## 11. Yearly tabletop exercise schedule

Quarterly tabletop, full-day. Scenario rotates so muscle memory covers the breadth of the threat model (security-plan §3).

| Quarter | Scenario | Lead |
|---|---|---|
| Q1 | Insider DB-credential abuse (threat #1) | `<MD>` |
| Q2 | Third-party token compromise + lateral to client data (threat #2) | `<Tech Lead>` |
| Q3 | Audit-chain tamper attempt by privileged insider (IR-product differentiator scenario) | `<MD>` |
| Q4 | Reputational scenario: presigned-URL leak picked up by a journalist (Blindspot §9.14) | `<Tech Lead>` |

Each tabletop produces:
- A timed run-through using this runbook (no improvisation, find the gaps).
- A delta list: where the runbook was wrong, ambiguous, or missing.
- Updates merged to this runbook within 5 working days.

---

**Last reviewed:** 2026-04-20
**Owner:** Tech Lead
