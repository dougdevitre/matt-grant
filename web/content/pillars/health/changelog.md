# Changelog

## v3.2.0 (2026-04-05)

### Added
- **52 content files** across roles, populations, workflows, commands, features, messaging, references, and operations
- **6 cross-sector integration guides** for developers, city planners, accountants, government, tech companies, and data engineers
- **10 individual population deep dives** (BLK, HIS, PRG, HML, PWUD, IMM, LGBT, OAD, JUS, RUR)
- **4 developer tools** — SDOH scorer, ROI calculator, campaign generator, APHA fetcher (TypeScript/JS)
- **28 passing tests** across 3 test suites (SDOH scoring, ROI calculator, campaign generator)
- **CI pipeline** — TypeScript compile, markdown lint, internal link validation (441 links), file structure validation, Jest tests
- **MkDocs Material documentation site** with GitHub Pages deployment, dark/light mode, full-text search, Mermaid diagram rendering
- **3 interactive tools** for docs site — SDOH Quick Screen, ROI Calculator, Engagement Calendar
- **10 validated Mermaid diagrams** across README and integration guides
- **CLAUDE.md** — project conventions for future Claude Code sessions
- **CONTRIBUTING.md** — style guide with 10 guardrails
- **NAVIGATION.md** — audience-based quick-start index
- **CHANGELOG.md** — this file
- **3 GitHub issue templates** — content update, bug report, cross-sector integration
- **CI badge** on README
- **MIT LICENSE** file
- **.gitignore** for Node.js, build artifacts, and OS files
- **FHIR R4 SDOH mapping** (JSON Schema) for 9 domains
- **HIPAA-ready SDOH data model** (5-table JSON Schema)

### Changed
- Organized 5 files from flat root into documented directory structure
- Fixed PHAB domain count (10 → 12) in remaining-roles.md
- Fixed pod structure in SKILL.md (aligned to README canonical 9-pod structure)
- Fixed artifact count in SKILL.md (40+ → 60+)
- Standardized pod labels across remaining-roles.md
- Fixed 75 broken cross-references in NAVIGATION.md
- Updated README file structure with ✅ status markers for all files
- Updated README status to "Complete (57 files, ~65K words)"
- README now includes cross-sector partner table

### Infrastructure
- `package.json` with npm scripts for build, test, lint, and tool execution
- `tsconfig.json` targeting ES2020 with strict mode
- `jest.config.js` with ts-jest preset
- `.markdownlint.json` with rules tuned for public health content
- `requirements.txt` for MkDocs Python dependencies
- `mkdocs.yml` with Material theme and full navigation
- `.github/workflows/ci.yml` — build + test + lint + validate
- `.github/workflows/deploy-docs.yml` — GitHub Pages deployment

## v3.1.0 (Initial Upload)

### Added
- README.md with Mermaid diagrams
- SKILL.md (AI routing hub)
- black-african-american.md (population deep dive)
- cross-role-workflows-expanded.md (8 workflows)
- external-playbook.md (media, digital, regulatory)
- internal-playbook.md (staff, leadership, governance)
- remaining-roles.md (10 roles)
