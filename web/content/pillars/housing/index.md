---
layout: home
title: Home
nav_order: 1
description: "Access to Housing — PropTech Intelligence Platform with 80 analytical modules, 85+ data sources, and full Fair Housing compliance."
permalink: /
---

# Access to Housing
{: .fs-9 }

PropTech Intelligence Platform — Market analysis, climate risk scoring, and Fair Housing-safe tooling for everyone.
{: .fs-6 .fw-300 }

[Get Started](#quick-start){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/dougdevitre/access-to-housing){: .btn .fs-5 .mb-4 .mb-md-0 }

---

**7 Core Modules** · **7 Reference Pods** · **80 Analytical Frameworks** · **85+ Data Sources** · **Zero Protected-Class Proxies**

---

## The Problem

Housing decisions are some of the highest-stakes financial choices people make, yet the data that drives them is **fragmented across dozens of systems** — MLS, tax records, climate models, permit databases, and demographic forecasts.

Real estate professionals, first-time homebuyers, housing advocates, and community planners need intelligence tools that are:

- **Comprehensive** — not siloed by data type
- **Compliant** — safe under Fair Housing law
- **Accessible** — no enterprise budget required

---

## How It Works

Access to Housing is a [Claude Custom Skill](https://docs.claude.com) that acts as your PropTech intelligence analyst. Ask a question, and the platform matches it to the right analytical framework, pulls from authoritative data sources, and delivers cited, structured analysis.

**Every output includes**: signal summary, key findings with evidence, methodology transparency, data caveats, and actionable next steps.

### Who It's For

| Audience | Key Questions | Modules |
|----------|--------------|---------|
| First-Time Homebuyers | Is this neighborhood safe and livable? | Module 4 — Livability Score |
| Real Estate Professionals | Where is the market heading? | Modules 2–3 — Supply Forecast |
| Investors & Fund Managers | What's the best investment opportunity? | Module 7 — Opportunity Scanner |
| Housing Advocates | Are residents being displaced? | Community Trust — Displacement Warning |
| Community Planners | Where should we invest infrastructure? | Module 5 — Infrastructure Heatmap |

---

## Core Modules

### Detection & Supply

| # | Module | Lead Time |
|:-:|--------|:---------:|
| 1 | **Satellite Housing Detection** | Pre-permit |
| 2 | **Construction Permit Intelligence** | 6–24 months |
| 3 | **Global Housing Supply Forecast** | 12–36 months |

### Scoring & Opportunity

| # | Module | Scope |
|:-:|--------|:-----:|
| 4 | **Neighborhood Livability Score** | Local |
| 5 | **Infrastructure Growth Heatmap** | Regional |
| 6 | **Climate Migration Model** | National |
| 7 | **Global Opportunity Scanner** | Global |

> Modules feed upward — detection informs forecasts, scoring informs opportunity ranking, and everything converges in the **Platform Brief**.

---

## Reference Pods — 80 Modules

Seven specialized pods extend the core modules with deep analytical frameworks:

| Pod | Modules | Key Frameworks |
|-----|:-------:|----------------|
| [Market Intelligence]({% link references/market-intelligence/pod.md %}) | 16 | Pricing trends, absorption rates, inventory analysis, demographic forecasting |
| [Investment & Deal]({% link references/investment-deal/pod.md %}) | 16 | Opportunity scanning, underwriting, portfolio analysis, capital flows |
| [Risk & Climate]({% link references/risk-climate/pod.md %}) | 6 | Flood/fire/heat/hurricane risk scoring, insurance market health |
| [Property Intelligence]({% link references/property-intelligence/pod.md %}) | 10 | AVM, valuation modeling, neighborhood scoring, pricing strategy |
| [Brokerage Ops]({% link references/brokerage-ops/pod.md %}) | 18 | CRM health, lead generation, pipeline management, transaction management |
| [Brokerage Strategy]({% link references/brokerage-strategy/pod.md %}) | 10 | Brokerage growth modeling, recruiting, financial modeling |
| [Community Trust]({% link references/community-trust/pod.md %}) | 6 | Civic transparency, displacement early warning, government accountability |

---

## Quick Start

### Option 1: Claude Custom Skill

```
1. Download the .skill file from Releases
2. Claude.ai → Settings → Custom Skills → Upload
3. Start asking questions
```

**Try these prompts:**

| Prompt | Module Triggered |
|--------|:----------------:|
| *"Run a neighborhood livability score for Clayton, MO"* | Module 4 |
| *"What's the permit pipeline in north St. Louis County?"* | Module 2 |
| *"Score Denver vs. Nashville as investment markets"* | Module 7 |
| *"Climate migration risk assessment for coastal Florida"* | Module 6 |
| *"Where is infrastructure spending signaling future growth?"* | Module 5 |
| *"12-month housing supply forecast for Austin, TX"* | Module 3 |
| *"Displacement risk assessment for East Nashville"* | Community Trust Pod |

### Option 2: Reference Library

Browse the [Reference Pods](/access-to-housing/reference-pods/) directly — each pod contains scoring rubrics, data source recommendations, output templates, and methodology notes you can use independently.

---

## Scoring Frameworks

### Neighborhood Livability Score (Module 4)

```
                         LIVABILITY SCORE: 0-100
    ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
    │  TRANSIT        │  PARKS &        │  SAFETY         │  EDUCATION      │
    │  ACCESS         │  AMENITIES      │  INDICATORS     │  ACCESS         │
    │                 │                 │                 │                 │
    │  0-25 points    │  0-25 points    │  0-25 points    │  0-25 points    │
    │                 │                 │                 │                 │
    │  Walk Score     │  Acreage per    │  Crime rates    │  Schools in     │
    │  Transit dist.  │  1K residents   │  vs. city avg   │  1.5 mi radius  │
    │  Bike infra     │  Grocery &      │  Trend (3-yr)   │  Childcare      │
    │  Frequency      │  healthcare     │  Density-norm.  │  Higher ed      │
    └─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

> All inputs are **objective infrastructure metrics** — never demographics or protected-class proxies.

### Global Opportunity Scanner (Module 7)

**Five-factor scoring (1-5 each, total 5-25):**

| Factor | What It Measures | Data Sources |
|--------|-----------------|--------------|
| **Price-to-Income** | Affordability signal | Census ACS, BLS, Zillow ZHVI |
| **Migration Flows** | Demand tailwind | IRS SOI, Census, Redfin search |
| **Capital Inflows** | Institutional activity | JLL, CBRE, Preqin PE data |
| **Infrastructure Momentum** | 2–7 year growth signals | MPO TIPs, FTA, USDOT RAISE |
| **Supply/Demand Balance** | Months of inventory | MLS, Census permits, NAHB |

---

## Data Sources

All analyses cite **primary, verifiable sources** with vintage dates. No invented data — ever.

| Category | Sources |
|----------|---------|
| **Supply & Permits** | Census Building Permits, NAHB Housing Market Index, CoStar, Dodge Construction |
| **Pricing & Transactions** | FHFA HPI, Case-Shiller, Zillow ZHVI/ZORI, Redfin Data Center, NAR |
| **Migration & Demographics** | IRS SOI (county-to-county), Census ACS, Redfin migration, U-Haul growth markets |
| **Climate & Risk** | First Street Foundation, FEMA FIRM maps, NOAA sea level projections, CAL FIRE WUI |
| **Infrastructure** | MPO Transportation Plans, FTA Capital Grants, USDOT RAISE grants, JLL, CBRE |
| **Livability** | Walk Score / Transit Score, Trust for Public Land, FBI UCR/NIBRS, LEHD LODES |
| **Community Trust** | Eviction Lab, NLIHC, HUD Counseling, 211 United Way, Municipal 311 / Open Data |

See [Data Sources]({% link assets/data-sources.md %}) for the full reference with 85+ sources and direct links.

---

## Fair Housing Compliance

Every module is designed to comply with the **Fair Housing Act**. This is not an afterthought — it is foundational to the architecture.

**Core rules:**
- No analysis based on race, color, national origin, religion, sex, familial status, or disability
- No proxy metrics that score on demographics
- School quality scored on **proximity/access only** — never test scores framed demographically
- Crime expressed as **density-normalized rates** — never raw counts
- Neighborhood comparisons use **objective infrastructure metrics only**

See [Fair Housing Framework]({% link FAIR-HOUSING.md %}) for the full compliance documentation.

---

## CoTrackPro Access Projects

Access to Housing is **pillar #3** of CoTrackPro's five-pillar open-source initiative — making critical intelligence freely accessible.

| Pillar | Repository | Focus |
|:------:|-----------|-------|
| Justice | [access-to](https://github.com/CoTrackPro/access-to) | Family law, expungement, protection orders |
| Education | [access-to-education](https://github.com/CoTrackPro/access-to-education) | K-12 standards, IEP/504, educator tools |
| **Housing** | **access-to-housing** | **PropTech intelligence, Fair Housing-safe analysis** |
| Services | [access-to-services](https://github.com/CoTrackPro/access-to-services) | Legal aid, mental health, advocacy navigation |
| Peace | *coming soon* | De-escalation, communication, conflict resolution |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](https://github.com/dougdevitre/access-to-housing/blob/main/CONTRIBUTING.md) for full guidelines.

**High-impact areas:** Data Sources, Module Expansions, Fair Housing Review, Accessibility, Reference Pods

---

**MIT License** — [Doug Devitre](https://linkedin.com/in/dougdevitre), Founder of [CoTrackPro](https://cotrackpro.com)
