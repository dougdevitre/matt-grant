# Changelog

All notable changes to Access to Jobs are documented here.

## [4.2.3] — 2026-04-09

### Added
- **MODULE 22: Workday Workflows** — generates copy/paste-ready content for Workday HCM fields including job requisitions (posting title, description, qualifications, KSAs), candidate evaluation (interview feedback by competency, disposition reasons), onboarding tasks (pre-hire checklist, 30/60/90-day check-ins), performance reviews (manager comments, competency ratings, SMART goals), compensation changes (justification with compa-ratio and market data), job changes (transfer/promotion documentation), and termination/exit (separation reasons, exit interview summaries)
- `references/workday-workflows.md` — complete reference for Module 22 with field-by-field content generation, character limits, and copy/paste workflow guide
- 4 new slash commands: `/workday`, `/wdjob`, `/wdreview`, `/wdfeedback`
- 8 new Workday-specific prompts in `prompt-library.md`
- Updated SKILL.md task router, progressive intake, and reference file table for Module 22
- Updated module map architecture diagram and quick reference

---

## [4.2.2] — 2026-04-09

### Added
- **Total Compensation Calculator** in `jobseeker-experience.md` (Module 18 expansion) — teaches job seekers to calculate full offer value including health insurance ($6K–$22K), retirement matching (3–15%), PTO dollar value, life/disability insurance, tuition reimbursement, and all other benefits; includes 3-offer comparison worksheet and typical benefits-as-%-of-salary by employer type
- **Federal Government Benefits Package** in `public-service-hiring.md` (Module 20) — complete FEHB, FERS pension, TSP matching, step increase schedule, leave accrual, transit subsidy, student loan repayment, and FSA; includes side-by-side federal vs. private sector total comp example showing a GS-9 at $86K total comp vs. private sector at $58K
- **State and Local Government Benefits** in `public-service-hiring.md` — MOSERS pension, state health plan, 457(b), and local government benefits overview
- **Competitive Compensation & Benefits Benchmarking** in `hr-manager-toolkit.md` (Module 21) — total comp formula for HR managers, benchmarking table by employer type (federal/state/local/large private/small private), competitor research sources, benefits gap analysis framework, and total compensation statement template for offer letters
- **Total Compensation Comparison template** in `output-templates.md` — detailed 3-offer comparison with cash compensation, insurance, retirement, PTO, and other benefits sections
- `/totalcomp` slash command for comparing offers side by side
- ~15 new glossary terms: 401(k), Compa-ratio, eNPS, FEHB, FERS, FSA, HSA, MOSERS, Total Compensation, TSP
- 6 new job seeker prompts for total compensation comparison
- 12 new HR manager prompts for benefits benchmarking and pay equity

---

## [4.2.1] — 2026-04-09

### Added
- **HR Performance Dashboard** — comprehensive KPI reference in `hr-manager-toolkit.md` covering 10 metric categories with 75+ individual KPIs, targets, formulas, and action triggers
  - Recruitment KPIs (9 metrics): time-to-fill, cost-per-hire, source of hire, applicant ratios, drop-off rate
  - Retention KPIs (9 metrics): 90-day/1-year/2-year retention, voluntary/involuntary/regrettable turnover, tenure, by-source retention
  - Employee Performance KPIs (6 metrics): review completion, performance distribution, high performer retention, PIP success
  - Compensation KPIs (6 metrics): compa-ratio, pay equity, benefits utilization, overtime, total comp competitiveness
  - Compliance KPIs (7 metrics): EEO adverse impact (80% rule), I-9 completion, training compliance, grievance resolution, accommodation response
  - Workforce Planning KPIs (7 metrics): vacancy rate, internal fill rate, succession coverage, diversity by level, promotion rate
  - Onboarding KPIs (5 metrics): task completion, time-to-productivity, new hire satisfaction, buddy effectiveness, first-year turnover
  - Training & Development KPIs (7 metrics): hours per employee, completion rate, training ROI, skills gap closure, certification pass rate, WIOA training completion
  - Employee Engagement KPIs (6 metrics): engagement score, eNPS, absenteeism, internal mobility, optional program participation, stay interviews
  - WIOA Employer Success KPIs (6 metrics): OJT completion/conversion, WOTC retention, apprenticeship completion, Job Center referral quality, cost savings
- HR Performance Dashboard template in `output-templates.md` — ready-to-fill quarterly tracking template with status indicators
- `schemas/hr-metrics.json` — full JSON schema for HR performance data (all 10 categories)
- `/hrdashboard` slash command — generates quarterly HR performance dashboard
- 12 new HR performance prompts in `prompt-library.md` (turnover analysis, pay equity, adverse impact, engagement diagnostics, etc.)
- Dashboard building guide: how to select starter metrics, set baselines, choose report cadence, and create action protocols

---

## [4.2.0] — 2026-04-09

### Added
- **MODULE 20: Public Service & Government Applications** — federal (USAJobs), state, and local government hiring guidance including federal resume format (4–6 pages), KSA/CCAR narrative writing, GS grade qualification standards, civil service exam preparation, veteran preference (5/10-point), Schedule A disability hiring authority, and government application checklist
- **MODULE 21: HR Manager Toolkit** — job description writing (13-section template with inclusive language guidance), structured interview building (competency mapping, behavior-based questions, anchored scoring rubrics), candidate evaluation framework (pre-screening, interview scorecard, ranking summary), EEO/ADA compliance in hiring, onboarding plans (90-day manager checklist), WIOA employer program reference, and workforce pipeline building
- `references/public-service-hiring.md` — complete reference for Module 20 (federal, state, local government hiring processes)
- `references/hr-manager-toolkit.md` — complete reference for Module 21 (job descriptions, interviews, evaluation, compliance, onboarding)
- `evals/public-service-eval.json` — 14 test cases for government application and HR manager module routing
- 4 new output templates: Government Resume, KSA Statement (CCAR), Job Description, Interview Scorecard
- 6 new HR manager email templates: interview invitation, interview reminder, rejection letter, reference check request, welcome email, conditional offer with background check
- Workshop F: Hiring Best Practices for Managers (90 minutes) — structured interview training for HR managers and supervisors
- 7 new slash commands: `/govresume`, `/ksa`, `/govapply`, `/jobdesc`, `/interviewguide`, `/scorecard`, `/onboard`
- ~20 new glossary terms for government HR (GS, KSA, OPM, Schedule A, VEOA, VRA, CCAR, USAJobs, Fair Chance Act, etc.)
- Public sector hiring adjustments for all 9 barrier populations in `barrier-populations.md`
- Public service and HR manager prompt sections in `prompt-library.md` (~20 new curated prompts)

### Changed
- **Tri-user detection** in SKILL.md: system now detects job seeker, Job Center staff, AND HR manager signals (previously only dual-user: job seeker vs. staff)
- SKILL.md task router expanded with Module 20 and Module 21 routing
- SKILL.md progressive intake table expanded with public service and HR manager fields
- SKILL.md reference file table expanded with 2 new reference files
- Module map architecture diagram updated from dual-user to tri-user layout
- Module map quick reference and population routing matrix expanded with Module 20 and Module 21 columns
- `schemas/jobseeker-intake.json`: added `hr_manager` user type, `government_target` object (target level, GS grade, vacancy number, veteran preference, Schedule A, clearance), `hr_manager_context` object, `federal_full` resume length option
- `schemas/population-routing.json`: added `public_service_guidance`, `veteran_preference_impact`, `schedule_a_applicability`, `government_qualification_note`, and `hr_manager_guidance` fields
- `schemas/application-tracker.json`: added government application fields (vacancy announcement number, GS grade, government level, announcement closing date, veteran preference, clearance required)
- `schemas/case-note.json`: added `hr_consultation`, `recruitment_support`, `interview_panel_support` service types and `hr_manager_notes` object
- `guides/quick-start.md`: added government job application section and employer/HR manager section
- `guides/staff-onboarding.md`: added HR manager section with Module 20/21 workflows and updated cheat sheet with new commands
- `scripts/deploy-state.sh`: now copies `public-service-hiring.md` and `hr-manager-toolkit.md` during state scaffolding
- `scripts/validate-state.sh`: now validates presence of 2 new reference files

---

## [4.1.0] — 2026-04-01

### Added
- `SECURITY.md` — PII handling guidelines, privacy policy for deployers, sensitive population data rules
- `.github/workflows/ci.yml` — GitHub Actions CI pipeline (JSON validation, internal link checking, state deployment validation, required file checks)
- `scripts/validate-state.sh` — validates that a state deployment is complete (checks for TODO placeholders, missing files, source citations, minimum content length)
- `scripts/build-skill.sh` — packages repo content into `.skill` zip file for Claude upload
- `guides/quick-start.md` — one-page end-user guide for job seekers (plain language, no jargon)
- `guides/guia-rapida-es.md` — Spanish-language quick start guide for ELL users
- `evals/negative-eval.json` — 12 test cases for prompts that should NOT trigger the skill (legal, medical, off-topic, fabrication requests)
- `evals/edge-cases-eval.json` — 15 test cases for ambiguous inputs, boundary scenarios, multi-role users, privacy requests, and under-age users

### Changed
- Extracted all content from `.skill` zip to repo root for GitHub browsability and easier contribution
- Added `.gitignore` for OS files, editor files, and compiled `.skill` packages
- Updated README: new directory structure entries, expanded eval stats (40 → 67 test cases), new guides table rows, new scripts listing, version badge to 4.1.0, repo stats updated

---

## [4.0.0] — 2026-04-01

### Added
- Rebranded from `mo-jobs` to `access-to-jobs` as part of the Access To open-source family
- State-deployable architecture with clear replace/customize/keep-as-is file classification
- `DEPLOYMENT.md` — full guide for deploying to any U.S. state
- `CONTRIBUTING.md` — contribution guidelines and content standards
- `CHANGELOG.md` — version history
- MIT License, `.gitignore`
- **`templates/`** subfolder (3 files):
  - `output-templates.md` — exact output format for every module (12 templates)
  - `email-templates.md` — 12 extended email templates (networking, offers, references, staff)
  - `workshop-templates.md` — 5 full workshop scripts (Resume, Interview, Job Search, LinkedIn, Financial Literacy)
- **`schemas/`** subfolder (4 files):
  - `jobseeker-intake.json` — progressive intake data model
  - `application-tracker.json` — application tracking with 12-status workflow
  - `case-note.json` — staff case note schema
  - `population-routing.json` — population → program → adjustment mapping
- **`assets/`** subfolder (4 files):
  - `module-map.md` — visual architecture, dependency graph, population routing matrix
  - `prompt-library.md` — 50+ curated prompts by audience and scenario
  - `data-sources.md` — full citation table with URLs, vintage, refresh schedule
  - `glossary.md` — 55+ WIOA/workforce acronyms with plain-English definitions
- **`slash-commands/`** subfolder (1 file):
  - `commands.md` — 22 slash commands with usage examples
- **`guides/`** subfolder (2 files):
  - `community-org-guide.md` — deployment for nonprofits, libraries, reentry, shelters, refugee agencies
  - `staff-onboarding.md` — 30-min training plan, 4 core workflows, printable cheat sheet
- **`evals/`** subfolder (3 files):
  - `trigger-eval.json` — 20 skill triggering test cases
  - `population-routing-eval.json` — 12 multi-population edge cases
  - `output-quality-eval.json` — 8 output quality checklists
- **`states/missouri/`** subfolder — reference implementation with README and program crosswalk
- **`scripts/`** subfolder:
  - `deploy-state.sh` — scaffolds new state deployment with TODO templates
- Comprehensive README with full directory documentation, TOC, stats, and badges

### Changed
- Renamed reference files for clarity:
  - `wioa-programs-mo.md` → `state-programs.md`
  - `mo-labor-market.md` → `state-labor-market.md`
  - `mo-training-pathways.md` → `state-training-pathways.md`
  - `local-county.md` → `local-area.md`
- Updated SKILL.md task router to include reference file loading column
- Updated SKILL.md to include deployment notes in reference file table
- Rebranded all internal headers from `stc-jobs` / `STC` to `Access to Jobs`
- Added Access To family cross-reference table to SKILL.md

### Unchanged
- All 20 modules (0–19) — content preserved from mo-jobs v3.0
- All 10 reference files — content preserved, headers rebranded
- Progressive intake system
- Dual-user detection (job seeker vs. staff)
- Population-specific adjustments
- Guardrails
- Output defaults

## [3.0.0] — 2026-02 (as mo-jobs)

### Added
- Modules 10–19 (staff workflows, advanced job seeker tools)
- Local county layer (configurable per county)
- Dual-user detection (job seeker vs. staff)
- Workshop facilitator guides (Module 19)
- Salary negotiation framework (Module 18)
- Job fair prep kit (Module 17)
- LinkedIn profile builder (Module 16)
- Job retention 30/60/90 plan (Module 15)
- Employment readiness assessment (Module 14)
- Employer outreach scripts: OJT, IWT, WOTC, Federal Bonding, Apprenticeship (Module 13)
- Referral letter drafts (Module 12)
- Case notes generator (Module 11)
- Intake & triage script (Module 10)

## [2.0.0] — 2025 (as mo-jobs)

### Added
- Modules 0–9 (core job seeker experience)
- Missouri WIOA State Plan integration
- Barrier population adjustments
- Special modes (Multi-output, Quick, Coach)
- Progressive intake system

## [1.0.0] — 2025 (as stc-jobs)

### Added
- Initial skill for St. Charles County, Missouri
- Core resume, cover letter, and interview prep modules
- WIOA program reference
