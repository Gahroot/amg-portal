# SBOM (Software Bill of Materials) Runbook

**Owner:** Engineering · **Audience:** Eng, Security, Procurement responses
**Workflow:** [`.github/workflows/sbom.yml`](../../.github/workflows/sbom.yml)
**Plan refs:** security-plan §6 Phase 3.8, §7.11 Supply chain, §8 (`cyclonedx-py`, `@cyclonedx/cyclonedx-npm`, `syft`)

---

## 1. What CycloneDX is

CycloneDX is the OWASP-stewarded BOM standard (ECMA-424). Each `.cdx.json`
file in this repo's SBOM artifacts records, for one component (`backend`,
`frontend`, `mobile`, or the source tree):

- a globally unique `serialNumber` (URN-UUID) and `specVersion`
- the root component's name + version (read from `pyproject.toml` /
  `package.json`)
- every transitive dependency, including:
  - `purl` (Package URL) — canonical identifier matching OSV/CVE feeds
  - SPDX-style licence
  - resolved version
  - dependency edges (`dependencies[]` graph)
- timestamp + tool metadata

We emit **CycloneDX** (not SPDX) because the CycloneDX `purl` graph is what
`osv-scanner`, GitHub Dependabot, Snyk, Grype and Dependency-Track all index
against. The `anchore/sbom-action` source-tree SBOM uses syft, which emits
identical schema.

## 2. Why we generate one per release

1. **Supply-chain attestation.** When a CVE drops (e.g. an `xz`-style
   backdoor), we can answer "is the affected version in our shipped artifact"
   in seconds by grepping the SBOM, not by re-resolving today's lockfiles
   against historical commits.
2. **Vendor procurement questionnaires.** UHNW family-office and IR-client
   procurement teams increasingly require a current SBOM as part of vendor
   onboarding (NIST SP 800-161 / EO 14028 / CISA SBOM minimum elements).
   Having one auto-generated per release means we ship it without scrambling.
3. **Regulator-ready evidence.** AMG's IR practice means we may be asked to
   demonstrate to a client's regulator (or in litigation) which exact
   software components processed evidence at a given point in time. Per-release
   SBOMs anchored to git tags + the audit chain (Phase 1.13) provide that.
4. **Internal change tracking.** Diffing two release SBOMs gives a precise
   list of dependency drift between deployments.

## 3. How the workflow is triggered

| Trigger | Result |
|---|---|
| Push to `main` | Generates current SBOMs, validates, uploads as workflow artifacts (90-day retention). |
| Pull request | Same — lets reviewers compare PR vs. base SBOM. |
| Weekly Mon 08:00 UTC | Catches indirect dep changes from registry resolutions. |
| `release: published` | Same plus attaches every `*.cdx.json` to the GitHub Release as a downloadable asset. |

Outputs:

- `sbom-backend.cdx.json` — Python deps from the resolved uv venv.
- `sbom-frontend.cdx.json` — frontend npm tree.
- `sbom-mobile.cdx.json` — mobile/Expo npm tree.
- `sbom-source.cdx.json` — whole-tree syft scan (catches things the package
  managers miss: vendored binaries, OS packages declared in Dockerfiles).
- Combined: `amg-portal-sboms-<sha>.zip` (the artifact you usually want).

## 4. Downloading an SBOM artifact

### Via the GitHub UI

1. Open <https://github.com/anchormillgroup/amg-portal/actions/workflows/sbom.yml>.
2. Click the workflow run for the commit/release you care about.
3. Scroll to **Artifacts** and download `amg-portal-sboms-<sha>` (zip).

### Via `gh` CLI

```bash
# Latest run on main
gh run list --workflow=sbom.yml --branch=main --limit=1
# Pick the run id and pull all artifacts:
gh run download <run-id> --name "amg-portal-sboms-<sha>" --dir ./sboms

# Or, for a release:
gh release view v1.2.3 --json assets --jq '.assets[].url'
gh release download v1.2.3 --pattern '*.cdx.json' --dir ./sboms
```

## 5. Querying an SBOM for a CVE-affected component

Install the official CLI once (~15 MB binary, no Docker needed):

```bash
# macOS
brew install cyclonedx/cyclonedx/cyclonedx-cli
# Linux (binary release)
curl -sSL -o /usr/local/bin/cyclonedx \
  https://github.com/CycloneDX/cyclonedx-cli/releases/latest/download/cyclonedx-linux-x64
chmod +x /usr/local/bin/cyclonedx
```

### Find a specific component

```bash
# Did backend ship lxml at the affected version?
cyclonedx component search \
  --input-file sboms/sbom-backend.cdx.json \
  --name lxml

# Same for the frontend
cyclonedx component search \
  --input-file sboms/sbom-frontend.cdx.json \
  --name '@types/node'
```

### Match a CVE alert to a release

```bash
# CVE-2024-12345 affects versions <2.31.0 of "requests".
# Confirm what we shipped in v1.4.0:
gh release download v1.4.0 --pattern 'sbom-backend.cdx.json' -O - | \
  jq '.components[] | select(.name == "requests") | {name, version, purl}'
```

### Diff two releases

```bash
cyclonedx diff \
  --from-file sboms-v1.3.0/sbom-backend.cdx.json \
  --to-file   sboms-v1.4.0/sbom-backend.cdx.json
```

### Run an OSV scan against a saved SBOM

```bash
# Reuse the same osv-scanner that runs in security.yml:
osv-scanner --sbom=sboms/sbom-backend.cdx.json
```

## 6. Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `policy` job fails with "missing fields" | A generator emitted a partial BOM (rare; usually a flag mismatch). | Inspect the artifact locally; re-run the generating job. |
| `cyclonedx-py environment` complains about missing PURL | An editable / local package with no PyPI URL. | Confirm root component carries `--pyproject pyproject.toml`. |
| `npm ci` flakes in `sbom-frontend` | Registry hiccup; same as backend-ci.yml. | Re-run the job. |
| `anchore/sbom-action` produces empty `components` | `path: ./` is empty (cache miss). | Confirm checkout step ran; re-run. |
| `release-attach` fails with 403 | Job-scoped `permissions: contents: write` missing. | Check that the `release-attach` job kept its `permissions:` block. |

## 7. Rotation / updates

- The workflow's pinned action SHAs are owned by **Dependabot**
  (`.github/dependabot.yml` group `github-actions`). Don't bump them by hand;
  let Dependabot open the PR so the SHA + version comment land together.
- `cyclonedx-bom` (Python) and `@cyclonedx/cyclonedx-npm` (Node) are pulled
  with `latest` at runtime so each generator picks up improvements
  automatically. If we ever pin them, do it in this file's commands AND add
  the package to Dependabot.

## 8. References

- **CISA — SBOM Minimum Elements** (2021-07): authoritative US-government
  baseline for what an SBOM must contain. <https://www.cisa.gov/sbom>
- **NIST SP 800-161 Rev. 1** — Cybersecurity Supply Chain Risk Management
  Practices. <https://csrc.nist.gov/pubs/sp/800/161/r1/final>
- **NTIA — The Minimum Elements For a Software Bill of Materials**.
  <https://www.ntia.gov/sites/default/files/publications/sbom_minimum_elements_report_0.pdf>
- **CycloneDX spec**: <https://cyclonedx.org/specification/overview/>
- **OWASP CycloneDX SBOM Examples**: <https://github.com/CycloneDX/bom-examples>
- **EO 14028 §4(e)** — Improving the Nation's Cybersecurity (2021):
  established the SBOM expectation for federal procurement.
- **Dependency-Track** (free, OSS): if we ever want a managed SBOM dashboard.
  <https://dependencytrack.org/>
