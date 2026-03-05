# Wiring Checkpoint

Find where things silently break between layers. Not "does it compile" — "does the config/feature/option actually survive from entry point to the thing that uses it."

**What this catches that other checks don't:**
- CLI wrapper exposes 8 flags, but the real implementation accepts 20
- API key enters at layer 1, gets quietly dropped at layer 3
- A module exports 15 functions but only 3 are imported anywhere
- Interactive prompts exist in some flows but not others
- Same feature built in two places, one quietly falls behind
- Config/options silently dropped or defaulted away mid-pipeline

## Instructions

### 1. Map the Project Architecture

Read CLAUDE.md, package.json, and directory structure. Identify:

**Entry points** — Where users/callers enter the system:
- CLI commands, API routes, exported functions, event handlers
- Look for: `bin/`, `src/cli/`, `src/api/`, `src/index.ts`, main exports

**Orchestration layer** — Where entry points delegate to:
- Orchestrators, controllers, routers, middleware chains
- Look for: `*orchestrator*`, `*controller*`, `*router*`, `*pipeline*`

**Capability modules** — Where real work happens:
- Packages, services, utilities, external integrations
- Look for: `packages/`, `src/services/`, `src/lib/`, `src/modules/`

**Config surface** — Where options/config flow:
- Types/interfaces, config loaders, env vars, option objects
- Look for: `*Options`, `*Config`, `*Settings` interfaces, `.env`

Build a mental model:
```
Entry Points → Orchestration → Capability Modules → External (APIs, DB, browser, network)
     ↑                                                    ↑
  Config/Options flow rightward through these layers
```

### 2. Identify Traceable Capabilities

From the architecture, extract capabilities that MUST work end-to-end. These are things that:
- Enter at the top (CLI flag, API param, config option)
- Must survive through multiple layers
- Actually get used at the bottom (passed to an API, library, external call)

**Common capability categories (adapt to project):**

| Category | What to trace | Example gap |
|----------|--------------|-------------|
| **Config propagation** | CLI flags → options object → module that uses them | Flag exists but never passed to the function |
| **Auth/credentials** | Token/key from entry → through middleware → to API call | Auth header built but never attached to request |
| **Feature parity** | Wrapper vs wrapped (CLI vs library, public vs internal API) | Wrapper is a stale subset of the real interface |
| **Error paths** | Error thrown deep → caught/propagated → surfaced to user | Error swallowed silently, user sees "unknown error" |
| **Interactive flow** | Decision points that should pause for user input | Some paths auto-proceed when they should ask |
| **Module consumption** | Package exports → actual imports elsewhere | Module built and exported but never imported |
| **Resource lifecycle** | Resource created → used → cleaned up | Connection opened but never closed on error path |
| **Data transformation** | Shape at entry → transformations → shape at destination | Field renamed mid-pipeline, destination gets undefined |

**Project-specific capabilities to always check:**
- If proxy/network: trace proxy config through every HTTP-making layer
- If CLI tool: compare every subcommand's options against the underlying function's full interface
- If monorepo: check each package's exports are actually consumed
- If auth: trace credentials from login through every protected operation
- If plugin/hook system: verify hooks fire at every documented point

### 3. Spawn Trace Agents

Ask the user:

**Question 1 - Parallel Execution:**
> Run with parallel agents? (Spawn separate agents per capability trace)
> - Yes - Parallel tracing (faster, recommended for large projects)
> - No - Sequential tracing (default)

**Question 2 - Scope:**
> What to trace?
> - Full project (all capabilities detected in step 2)
> - Specific area (user specifies which capability/module)

**For each capability**, spawn an Explore agent (or trace sequentially) with this mandate:

```
Trace [CAPABILITY] through every layer of the project at [DIRECTORY].

Start at the entry point(s) and follow it through to where it's actually consumed.

CHECK FOR:
1. **Dropped config**: Option/flag exists at entry but never reaches the function that needs it
2. **Silent defaults**: Value gets replaced with a default mid-pipeline instead of being passed through
3. **Partial wiring**: Feature works in path A but not path B
4. **Stale wrappers**: A wrapper/adapter exposes a subset of the underlying interface and has fallen behind
5. **Missing gates**: Decision points where the user should be prompted but isn't
6. **Dead exports**: Module exports capability X but nothing imports it
7. **Shape mismatches**: Data enters as type A, gets transformed, arrives at destination missing fields

For each issue found, report:
- WHERE: exact file:line at each end (entry point AND consumption point)
- WHAT: what gets lost/broken between those two points
- WHY IT MATTERS: what fails or silently degrades as a result

Do NOT report:
- Style issues, naming, code quality
- Theoretical problems that can't actually be triggered
- Things that work correctly end-to-end
```

### 4. Cross-Reference Traces

After all traces complete, look for **systemic patterns**:

- **Same gap in multiple places**: If auth is broken in one module, is it also broken in the others?
- **Wrapper drift**: If one wrapper is behind, are there OTHER wrappers that are also stale?
- **Missing symmetry**: If feature X has validation but feature Y doesn't, should Y also have it?

### 5. Fix or Report

Ask the user:

**Question 3 - Action:**
> What to do with findings?
> - Fix all (implement fixes now)
> - Report only (produce report, fix later)
> - Fix critical, report rest

**If fixing:** Fix each issue, re-trace the affected capability to confirm the fix, move to next.

**If reporting:** Generate `reports/wiring-[date].md`:

```markdown
# Wiring Report: [Project Name]

Date: [YYYY-MM-DD]
Scope: [Full project / specific area]

## Architecture Map

[Entry Points] → [Orchestration] → [Modules] → [External]

## Capabilities Traced

### [Capability 1: e.g., Auth Token Propagation]
- Entry: [where it enters]
- Layers: [what it passes through]
- Destination: [where it's consumed]

**Gaps Found:**

| # | Where | What's Lost | Impact | Severity |
|---|-------|------------|--------|----------|
| 1 | api.ts:42 → service.ts:181 | Auth token not forwarded to downstream service | Service calls fail silently with defaults | Critical |

**Details:**
[For each gap, explain the full trace: enters here → passes through here → breaks here → this is what fails]

### [Capability 2: e.g., CLI Flag Parity]
...

## Systemic Patterns
- [Pattern 1: e.g., "Auth handling is inconsistent across 3 modules"]
- [Pattern 2: e.g., "Wrapper CLIs lag behind their underlying implementations"]

## Summary
- Capabilities traced: [N]
- Gaps found: [N] (Critical: X, Moderate: Y, Minor: Z)
- Systemic patterns: [N]
```

### 6. Output Summary

Display findings summary and let the user decide what to do next.

---

## COMMAND COMPLETE - STOP HERE

**DO NOT proceed to next steps automatically.**
**DO NOT execute any further actions.**

This command ends when you display the summary above.

Wait for user to decide next action.

---

## What Makes This Different

Most checks look at code **vertically** — one file or one feature at a time. "Does this function work?" "Does this file compile?" "Does this test pass?"

This command picks a **capability** (auth support, config propagation, CLI flags) and traces it **horizontally through every layer**, catching where it silently drops. That's the perspective nobody else checks.

## Guidelines

- Trace capabilities, not files. The question is "does this config work everywhere" not "is this file correct"
- Silent failures are the priority. If something throws an error, other tools catch it. This catches things that **silently degrade** (credential stripped, option defaulted, feature missing)
- Wrapper drift is the #1 most common find. Whenever a wrapper/adapter/CLI exposes an underlying interface, check if it's kept up
- "Works in path A but not path B" is the signature pattern. Same capability, two code paths, one is wired and one isn't
- Don't report style issues. If data flows correctly end-to-end, it's fine no matter how ugly the code is
- Negative results are findings. "Auth config survives all 5 layers cleanly" is worth noting
