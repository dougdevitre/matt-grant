# Changelog

All notable changes to the Access to Housing platform are documented here.

---

## [31.0] — 2026-04-05

### Added
- **Community Trust & Transparency Pod** (6 new modules)
  - Civic Transparency Tracker — surfaces zoning votes, rezoning decisions, public land dispositions
  - Community-Reported Conditions — 311 data, code violations, service gaps normalized per 1K households
  - Displacement Early Warning — 0–100 risk score using rent burden, eviction rates, investor pressure, policy protections
  - Government Accountability Scorecard — 0–100 score for code enforcement, permit processing, complaint resolution, public accessibility
  - Neighborhood Resource Directory — HUD counselors, legal aid, 211, CDFIs, tenant advocacy
  - Community Engagement Guide — public hearing participation, FOIA requests, civic pathways
- **15 new civic transparency data sources** added to `assets/data-sources.md`
  - Eviction Lab, NLIHC, HUD Housing Counseling, 211 United Way, Legal Services Corporation, CDFI Fund, National Fair Housing Alliance, NeighborWorks America, USDA Food Access Research Atlas, HUD AFFH Data, US PIRG Transparency Reports, Municipal 311/Open Data Portals
- **7 new mermaid diagrams** in README (17 total)
  - The Problem (fragmented → unified), Who It's For (persona mapping), Module Scope (local → global), Module Distribution (pie chart), Displacement Early Warning (scoring breakdown), Government Accountability (scorecard), Data Sources (source flow)
- **Fair Housing safeguards** for all Community Trust modules in `FAIR-HOUSING.md`
- **Community Trust workflow diagram** in Key Workflows section
- **Community Trust trigger prompts** in Quick Start and Module Selection Guide
- **Developer resources**
  - `assets/output-schemas.md` — JSON Schema 2020-12 definitions for 6 scoring modules + Platform Brief wrapper + shared types
  - `assets/api-reference.md` — 65+ data sources by auth tier (free/key/freemium/paid/MLS/municipal), endpoints, rate limits, 3 integration patterns
  - `assets/glossary.md` — 40+ plain-language definitions in 5 categories for non-expert users
  - `assets/example-prompts.md` — test prompts for every module with expected output structure
  - `CLAUDE.md` — repo context for Claude Code developers (architecture decisions, file relationships, sync points, conventions)
- **GitHub issue templates** (4 YAML forms)
  - `module-request.yml` — pod selector, Fair Housing checkboxes
  - `data-source.yml` — category dropdown, cost, module mapping
  - `fair-housing-concern.yml` — severity levels, suggested fix
  - `community-resource.yml` — local org submissions with geographic area, services, status
- **SKILL.md enhancements**
  - Full Community Trust pod embedded (6 modules with trigger phrases, scoring frameworks, analysis steps, data sources, Fair Housing notes)
  - Output format templates for all 6 Community Trust modules
  - Cross-module reference guide (7 recommended pairings + combined analysis workflow)
- **7 mermaid workflow diagrams** added to all reference pod files
- **CONTRIBUTING.md overhaul** — community trust contributions, pod expansion table, Fair Housing checklist, developer section

### Changed
- Module count: 74 → 80 (6 new Community Trust modules)
- Reference pod count: 6 → 7
- Data source count: 50+ → 65+
- SKILL.md version: 30.0 → 31.0
- README badges, diagrams, and references updated throughout for consistency
- Removed expanding subtopic mermaid diagram (replaced with clean table)

---

## [30.0] — Initial Release

### Included
- 7 core analytical modules (Satellite Detection → Global Opportunity Scanner)
- 6 reference pods with 74 total modules
  - Market Intelligence (16), Investment & Deal (16), Risk & Climate (6), Property Intelligence (10), Brokerage Ops (18), Brokerage Strategy (10)
- 50+ authoritative data sources across permits, pricing, migration, climate, infrastructure, livability
- Fair Housing compliance framework with pre-delivery checklist
- Claude Custom Skill definition (SKILL.md)
- Platform architecture with structured output standards
- MIT License
