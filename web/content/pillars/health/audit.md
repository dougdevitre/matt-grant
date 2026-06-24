# Access to Health — Code Audit Report

**Date**: 2026-04-04
**Auditor**: Claude Code
**Version audited**: 3.1.0
**Branch**: `claude/code-audit-cJQXv`

---

## Executive Summary

Access to Health is an ambitious, well-written knowledge framework for public health professionals. The content quality is **strong** — evidence-based, equity-centered, trauma-informed, and operationally specific. However, the repository has significant **structural debt**: the README documents a 46-file directory tree, but only 7 files exist, all dumped in the root directory. Cross-references are broken, metadata is inconsistent, and the project appears far less complete than it actually is.

This audit covers: structure, content accuracy, cross-reference integrity, formatting, and actionable recommendations.

---

## Severity Legend

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Misleads users or breaks functionality |
| **HIGH** | Inconsistency that undermines credibility |
| **MEDIUM** | Quality issue worth fixing |
| **LOW** | Polish / nice-to-have |

---

## Finding 1: File Structure Mismatch (CRITICAL)

**Issue**: README.md (lines 147–229) documents a 46-file directory tree with 16+ subdirectories. In reality, only **7 files exist**, all in the root directory.

**Actual files**:
```
access-to-health/
├── README.md
├── SKILL.md
├── black-african-american.md
├── cross-role-workflows-expanded.md
├── external-playbook.md
├── internal-playbook.md
└── remaining-roles.md
```

**Impact**: Anyone cloning this repo sees a flat directory that contradicts the README. The SKILL.md quick reference table (lines 108–142) links to ~40 files that don't exist. Users following those paths get 404s.

**Recommendation**: Either:
- (A) **Organize existing files** into the documented structure (move files into subdirectories), or
- (B) **Rewrite README** to reflect the actual 7-file state and mark the rest as "planned"

**Action taken**: Organized existing files into subdirectories matching the documented structure (Option A).

---

## Finding 2: PHAB Domain Count Error (HIGH)

**Issue**: `remaining-roles.md` line 143 (QIC role, Workflow 2) states:

> "Lead accreditation (10 domains, 30+ standards, 100+ measures)"

But `cross-role-workflows-expanded.md` lines 237–249 correctly lists **12 PHAB domains**. The actual PHAB framework has 12 domains. This is a factual error.

**Action taken**: Corrected to "12 domains" in remaining-roles.md.

---

## Finding 3: Pod Structure Inconsistency (HIGH)

**Issue**: SKILL.md line 97 lists 9 pods:

> "Surveillance, Community, Clinical, Education, Behavioral, Environment, Policy, Leadership, **Preparedness**"

But README.md lines 51–81 show a different 9-pod structure:

> Surveillance, Community, Clinical, Behavioral Health, Maternal-Child Health, Education, Environment, **Policy & Leadership**, **Operations**

There is no "Preparedness" pod in the README structure. "Policy" and "Leadership" are merged into one pod. "Operations" exists in README but not SKILL.md. "Maternal-Child Health" exists in README but not SKILL.md.

**Action taken**: Aligned SKILL.md to match the canonical pod structure in README.md.

---

## Finding 4: Artifact Count Mismatch (HIGH)

**Issue**: SKILL.md description (line 8) says "40+ reporting artifacts" but README.md (line 13) says "60+ reporting and communication artifacts."

**Action taken**: Aligned SKILL.md to "60+ reporting and communication artifacts" to match README.

---

## Finding 5: Pod Labels in remaining-roles.md Don't Match README (MEDIUM)

**Issue**: Several role pod labels in `remaining-roles.md` don't match the canonical pod names in the README diagram:

| Role | Pod in remaining-roles.md | Pod in README |
|------|--------------------------|---------------|
| NUT (Nutritionist) | "Nutrition" | "Maternal-Child Health" |
| DIS (Disease Intervention) | "Surveillance" | "Surveillance" ✓ |
| SHC (School Health) | "School" | "Education" |
| DAT (Data Analyst) | "Data" | "Surveillance" |
| POL (Policy Analyst) | "Policy" | "Policy & Leadership" |

**Recommendation**: Standardize pod labels to match the README's canonical structure. Not changed in this audit to avoid scope creep — flagged for next revision.

---

## Finding 6: Missing Cross-Referenced Files (MEDIUM)

**Issue**: These files are referenced in README and SKILL.md but do not exist in the repository:

**Roles** (6 files missing):
- `roles/ROLE-REGISTRY.md` — Master index
- `roles/epi.md` — Epidemiologist deep dive
- `roles/chw.md` — Community Health Worker deep dive
- `roles/phn.md` — Public Health Nurse deep dive
- `roles/hdo.md` — Health Director deep dive
- `roles/priority-roles.md` — BHC, EHS, MCH, HCS, PMG, EPC
- `roles/all-roles.md` — Original 18-role reference

**Populations** (2 files missing):
- `populations/POPULATION-REGISTRY.md`
- `populations/deep-dives/all-deep-dives.md`

**Commands** (2 files missing):
- `commands/COMMANDS.md`
- `commands/COMMAND-SPECS.md`

**All other directories** (26+ files missing):
- `artifacts/`, `features/`, `messaging/`, `references/`, `bilingual/`, `mcp/`, `evals/`, `scripts/`, `schemas/`, `templates/`, `tools/`, `assets/`

**Recommendation**: Either create these files or update the README file structure to only list files that exist. Consider adding a "Roadmap" section for planned content.

---

## Finding 7: Emoji Usage in Internal Playbook (LOW)

**Issue**: `internal-playbook.md` Section 1.1 uses emoji (🎉📊🤝📅📚) in the all-staff email template. While appropriate for the template content itself (emails support emoji), this may not render consistently in all Markdown viewers or terminal-based tools.

**Recommendation**: No change needed — emoji are contextually appropriate in an email template.

---

## Finding 8: No .gitignore (LOW)

**Issue**: Repository has no `.gitignore`. As the project grows (especially with planned TypeScript tools and JSON schemas), build artifacts, `node_modules/`, and OS files could pollute the repo.

**Action taken**: Added `.gitignore` with standard patterns for Node.js, OS files, and editor artifacts.

---

## Finding 9: Missing LICENSE File (LOW)

**Issue**: README states "MIT — Use freely. Attribution appreciated" but there is no `LICENSE` file in the repository. Best practice is to include the full license text.

**Recommendation**: Add a `LICENSE` file with the full MIT license text.

---

## Finding 10: No CONTRIBUTING.md (LOW)

**Issue**: As an open-source project in the "Access To" family, there's no contribution guide. This makes it harder for community members to participate.

**Recommendation**: Add a `CONTRIBUTING.md` covering: how to suggest content, style guidelines (plain language, evidence-based, equity lens), and PR process.

---

## Content Quality Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Evidence base** | Excellent | Cites APHA, CDC, WHO, peer-reviewed sources throughout |
| **Equity framing** | Excellent | Structural racism named directly; person-first language; disaggregation by default |
| **Trauma-informed tone** | Excellent | No blame/shame language; historical trust context provided |
| **Operational specificity** | Excellent | Timelines, decision trees, templates are immediately actionable |
| **Cultural responsiveness** | Excellent | Black/African American deep dive is outstanding — nuanced, respectful, actionable |
| **Template quality** | Very Good | Templates are practical and complete; consistent structure |
| **Workflow design** | Very Good | Decision trees and escalation criteria are clear and executable |
| **Cross-role integration** | Very Good | Handoff points are explicitly defined in workflows |
| **Readability** | Good | Content is clear but some sections are dense for quick reference |
| **Structural organization** | Needs Work | Files misplaced; cross-references broken; directory structure fictional |

---

## Summary of Actions Taken

| # | Action | Severity | Status |
|---|--------|----------|--------|
| 1 | Organized files into documented directory structure | CRITICAL | ✅ Done |
| 2 | Fixed PHAB domain count (10 → 12) in remaining-roles.md | HIGH | ✅ Done |
| 3 | Fixed pod list in SKILL.md to match README | HIGH | ✅ Done |
| 4 | Fixed artifact count in SKILL.md (40+ → 60+) | HIGH | ✅ Done |
| 5 | Added .gitignore | LOW | ✅ Done |

## Recommendations Not Actioned (Future Work)

| # | Recommendation | Severity | Reason |
|---|---------------|----------|--------|
| 1 | Create missing referenced files (roles/, commands/, etc.) | MEDIUM | Content creation — requires domain expertise |
| 2 | Standardize pod labels in remaining-roles.md | MEDIUM | Requires decision on canonical names across all files |
| 3 | Add LICENSE file | LOW | Requires confirming license details with author |
| 4 | Add CONTRIBUTING.md | LOW | Requires author input on contribution process |
| 5 | Update README file tree to mark existing vs. planned files | MEDIUM | Deferred — depends on whether missing files will be created |
