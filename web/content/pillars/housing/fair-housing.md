---
layout: default
title: Fair Housing Compliance
nav_order: 3
description: "How Access to Housing ensures compliance with the Fair Housing Act across all modules."
---

# Fair Housing Compliance Framework

This document describes how Access to Housing ensures compliance with the [Fair Housing Act](https://www.justice.gov/crt/fair-housing-act-1) (42 U.S.C. §§ 3601–3619) across all modules and analytical outputs.

## Guiding Principle

All analysis in this platform is based exclusively on **objective infrastructure, supply/demand, and environmental metrics**. No module scores, ranks, recommends, or filters based on race, color, national origin, religion, sex, familial status, disability, or any characteristic that serves as a proxy for these protected classes.

## Pre-Delivery Compliance Checklist

Before delivering any analysis, verify:

- [ ] No analysis based on race, color, national origin, religion, sex, familial status, or disability
- [ ] No proxy metrics that effectively score on protected characteristics
- [ ] School quality scored only on proximity and access, not test scores framed demographically
- [ ] Crime data expressed as rates normalized for density, not raw counts by area
- [ ] Neighborhood comparison uses objective infrastructure metrics only
- [ ] Investment thesis based on supply/demand fundamentals, not population composition

## Redirect Protocol

If a user request would violate Fair Housing, respond with:

> "That analysis would implicate Fair Housing law by [specific reason]. Here's a legally safe alternative approach using objective metrics: [redirect to infrastructure/supply/demand metrics]."

## Module-Specific Safeguards

### Neighborhood Livability Score (Module 4)
- Scores ONLY on transit access, parks/amenities, safety indicators (rate-normalized), and education access (proximity-based)
- Never includes demographic composition as a factor
- Religious institution density is excluded as a scoring factor
- School district scoring uses enrollment capacity and distance — never test scores framed in demographic terms

### Satellite Housing Detection (Module 1)
- Geography-based analysis only
- Construction pattern analysis does not implicate Fair Housing unless correlated with protected class characteristics — such requests are redirected

### Climate Migration Model (Module 6)
- Migration flow analysis uses IRS SOI, Census ACS, and mover data — aggregate economic and environmental signals
- Never frames migration in terms of demographic group movement

### Community Trust & Transparency Pod
- **Community-Reported Conditions**: Complaint rates normalized per 1,000 housing units — never raw counts by area. No demographic overlays on service request data
- **Displacement Early Warning**: Uses economic indicators only (rent burden, eviction rates, investor purchase share). Never analyzes who is being displaced by demographic group — only whether displacement pressure exists based on housing market metrics
- **Government Accountability Scorecard**: Measures government responsiveness using objective metrics (response times, resolution rates). Equity analysis compares service quality across areas without identifying resident demographics
- **Civic Transparency Tracker**: Analyzes government decisions on land use and zoning. Beneficiary analysis focuses on economic impact (existing residents vs. outside capital), not demographic composition

## Applicable Law

- **Federal**: Fair Housing Act (42 U.S.C. §§ 3601–3619)
- **HUD Guidance**: [Guidance on Application of Fair Housing Act Standards to the Use of Criminal Records](https://www.hud.gov/sites/documents/HUD_OGCGUIDAPPFHASTANDCR.PDF)
- **State**: Analyses should also account for state-level fair housing protections, which may be broader than federal law

## Reporting Issues

If you identify a Fair Housing compliance concern in any module or output template, please [open an issue](https://github.com/CoTrackPro/access-to-housing/issues/new?template=fair-housing-concern.md) or contact [dougdevitre@gmail.com](mailto:dougdevitre@gmail.com).

---

> **Disclaimer**: This framework provides analytical guardrails for an AI-powered research tool. It is not legal advice. Consult a licensed attorney for Fair Housing compliance guidance specific to your situation.
