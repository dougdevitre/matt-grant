# Local County Workforce Intelligence
## Configure for any local workforce area
### Source: Missouri WIOA State Plan PY 2024-2027

> REDEPLOYMENT NOTE: This file is the only thing that changes when deploying
> this skill to a different Missouri county. Update:
>   1. LWDA name and WIOA region assignment
>   2. Job Center address and contact
>   3. Local employer directory
>   4. Local training providers
>   5. Any county-specific programs or gaps
> Everything else in the skill (WIOA programs, modules, guardrails) stays identical.

> DEFAULT CONFIGURATION: St. Charles County, Missouri

---

```mermaid
flowchart TD
    JC[Missouri Job Center<br/>St. Charles County] --> JS[Job Seekers]
    JC --> EMP[Employers]
    
    subgraph SERVICES ["Services Available"]
        S1[MoJobs Registration]
        S2[Career Advising]
        S3[Resume Help]
        S4[Job Matching]
        S5[WIOA Enrollment]
        S6[Veteran Priority]
        S7[Computer/Phone Access]
    end
    
    subgraph LOCAL ["Local Employers"]
        E1[Boeing / Amazon / WWT]
        E2[SSM Health / Mercy / BJC]
        E3[Retail / Service Corridor]
        E4[Municipal / School Districts]
    end
    
    subgraph TRAIN ["Training Providers"]
        T1[St. Charles Community College]
        T2[Career Center - CTE]
        T3[Lindenwood University]
    end
    
    JS --> SERVICES
    EMP --> LOCAL
    JC --> TRAIN

    style JC fill:#2563eb,color:#fff
```

---

# Local County Workforce Intelligence
## Configure for any local workforce area — default: St. Charles County
### Source: Missouri WIOA State Plan PY2024-2027 + local context
### DEPLOYMENT NOTE: Replace county-specific sections below for other Missouri LWDAs
### Source: Missouri WIOA State Plan PY2024-2027 + Local context

---

## ST. CHARLES COUNTY LWDA STATUS

St. Charles County is a **standalone Local Workforce Development Area (LWDA)** — one of only
a few Missouri counties that operates as its own LWDA separate from surrounding regions.

- **WIOA Region:** St. Louis Region (bi-state planning region)
  - Includes: City of St. Louis, County of St. Louis, **County of St. Charles**,
    Jefferson/Franklin Consortium, and Madison and St. Clair counties in Illinois
- **St. Charles County LWDB:** Local Workforce Development Board governs services
- **IWT data (PY2024):** St. Charles County reported 0 Incumbent Worker Training participants
  — significant opportunity gap to address with employers

---

## ST. CHARLES COUNTY JOB CENTER

**Missouri Job Center — St. Charles County**
- Primary WIOA services access point for county residents
- Services: MoJobs registration, career advising, resume help, job matching, WIOA enrollment,
  veteran priority services, employer services, workshops
- Technology access: Computers, phones, fax, copiers available to job seekers at no cost
- **Always route job seekers here first** for official program enrollment

**Online access:** jobs.mo.gov → "Find a Job Center" → St. Charles County

---

## ST. CHARLES COUNTY ECONOMIC PROFILE

St. Charles County is part of the St. Louis metro area — Missouri's largest labor market.

**St. Louis Region (St. Charles + surrounding):**
- 1,056,400 workers (35% of all Missouri employment)
- Unemployment rate (2024): 3.5% (below state avg of 3.7%)
- Largest industry by employment: Retail Trade (194,600+ jobs)
- Second largest: Health Care and Social Assistance
- Strong professional services, financial services, manufacturing presence

**St. Charles County characteristics:**
- Suburban growth corridor — one of Missouri's fastest-growing counties
- Strong manufacturing base (Boeing, major distribution centers)
- Healthcare sector growth (SSM Health, BJC, Mercy adjacent market)
- Major retail corridor (Mid Rivers Mall area)
- Significant white-collar commuter population (St. Louis financial/professional services)

**Local high-demand sectors for job matching:**
1. Healthcare (CNA, LPN, Medical Assistants — high volume openings)
2. Manufacturing / Distribution / Logistics (high NOW-tier volume)
3. Retail / Customer Service (highest posting count region-wide)
4. Construction and Skilled Trades (shortage — apprenticeship opportunities)
5. Information Technology (NEXT/LATER tier — growth sector)

---

## KEY LOCAL EMPLOYERS TO REFERENCE IN JOB MATCHING

**Manufacturing / Distribution:**
- Boeing (St. Charles operations)
- Major Amazon fulfillment / distribution centers
- Emerson Electric (regional)
- World Wide Technology (O'Fallon — IT/tech)

**Healthcare:**
- SSM Health St. Joseph Hospital (Lake Saint Louis / St. Peters)
- Mercy (adjacent market)
- BJC HealthCare (system-wide, accessible from county)
- DaVita Dialysis, dialysis centers
- Home health agencies (high volume CNA/HHA demand)

**Retail / Service:**
- Mid Rivers Mall area retailers
- Restaurant and hospitality groups
- Major grocery chains

**Government / Public Sector:**
- City of St. Charles, O'Fallon, St. Peters, Wentzville (municipal)
- St. Charles County government
- Fort Zumwalt / Francis Howell / Wentzville school districts
  (paraprofessional, custodial, food service — often entry-level with benefits)

---

## LOCAL TRAINING PROVIDERS (St. Charles County area)

Always verify current program availability at jobs.mo.gov/eligible-training-providers

**Community Colleges:**
- **St. Charles Community College (SCC)** — Primary provider; O'Fallon campus
  - Healthcare programs (CNA, LPN pathway, Medical Assisting)
  - Business, IT, skilled trades
  - Participates in Fast Track Scholarship

**Career and Technical Education:**
- **St. Charles County Career Center** — CTE programs, industry credentials

**Other nearby:**
- Lindenwood University (St. Charles) — degree programs
- Missouri Baptist University (adjacent) — healthcare and business degrees
- Columbia College — online (adult learners)

---

## RAPID RESPONSE PROTOCOL (for staff)

**Trigger:** Any layoff of 25+ workers in St. Charles County.

**Missouri Rapid Response Team process:**
1. OWD Rapid Response Team notified (Policy 02-2025)
2. On-site or in-person services provided to all workers
3. Meeting includes: DES (UI information), MJC representative (programs), union rep (if applicable)
4. Handouts: Rapid Response brochure, DES UI fact sheet, MERIC Regional Real Time Labor Market Summary
5. Trade Act Navigator notified if trade-related layoff suspected
6. Workers informed of TAA petition filing (without promising certification)
7. Referrals to Job Center initiated immediately

**For layoffs of 24 or fewer:**
- Informational packets provided at minimum
- On-site services offered if requested

**Key contacts:**
- TAA information: jobs.mo.gov/trade-adjustment-assistance
- Dislocated Worker program access: nearest Job Center or OWD

**Staff action:** When a job seeker mentions a recent layoff, always ask:
- Was it a mass layoff (25+)?
- Was the employer in a trade-affected industry?
- How long ago was the layoff?
- Are they currently receiving UI? (If yes, route to RESEA awareness)

---

## SHOW-ME HEROES (Veterans OJT Program)

**What it is:** Missouri's veteran-specific OJT reimbursement program.

**Who qualifies:**
- Veterans who have exited the military
- Active Guard and Reserve (AGR) members returning from deployment
- National Guard and Reserve members
- Spouses of veterans AND spouses of active duty military members

**Benefits:**
- 50% wage reimbursement to employer during OJT agreement period
- Additional financial assistance with classroom and apprenticeship training
- Job Center representatives coordinate directly with employers
- Monthly monitoring and support throughout training period

**How to access:**
- Identify veteran status at intake (all veterans get priority of service)
- Connect veteran to DVOP/CODL staff at St. Charles Job Center
- DVOP/CODL coordinates Show-Me Heroes OJT with employer

**Staff note:** Always screen for veteran status at intake — it unlocks Show-Me Heroes,
DVOP intensive services, and priority queue placement.

---

## INCUMBENT WORKER TRAINING (IWT) — Employer Tool

**What it is:** Offsets costs of training existing employees to prevent layoffs or enable advancement.

**Key features:**
- Designed for workers with established history at their company
- Employer must give wage increase upon completion
- Administered by local WDB
- Missouri has requested waiver to expand IWT flexibility (PY2026-2027)

**St. Charles County IWT gap:** 0 participants in PY2021-2024 — significant opportunity for
employer engagement. Staff should proactively pitch IWT to local employers.

**How to pitch to employers:**
"We can help offset the cost of training your existing employees, prevent turnover, and
increase their productivity — at no cost to you beyond the wage increase upon completion."

---

## WIOA WAIVERS ACTIVE IN MISSOURI (PY2026-2027)

**Waiver 1:** Out-of-school youth and in-school youth (ages 16-21) ITAs
- Youth can now receive Individual Training Accounts for post-secondary training
- Expands apprenticeship access for high school age youth

**Waiver 2:** OJT reimbursement up to 90%
- Normal WIOA cap is 50%; Missouri requested up to 90% for some employers
- Increases employer willingness to hire and train barrier populations

**Waiver 3:** Incumbent Worker Training expansion
- Allows more IWT opportunities at local WDB discretion

**Staff implication:** These waivers make OJT and apprenticeship pitches significantly stronger
for employer outreach. Lead with the 90% reimbursement potential.

---

## UI CLAIMANT FAST-TRACK PROTOCOL

When a job seeker mentions they are currently receiving Unemployment Insurance (UI):

1. **Confirm MoJobs registration** — UI claimants are auto-registered but may not have engaged
2. **RESEA awareness** — Selected claimants receive mandatory Reemployment Services and
   Eligibility Assessment appointment; participation at Job Center counts toward work search
3. **Coursera access** — All UI claimants receive free Coursera license (6,000+ courses);
   prompt them to use it for skill-building while searching
4. **Work search rules** — Job Center participation counts toward weekly work search requirement
5. **Reemployment Advantage Program** — RESEA-selected claimants get curated course set
6. **Urgency:** UI benefits have a finite duration — treat as medium-high urgency regardless
   of what the user indicates

**Staff note:** UI claimants who engage with Job Center services have better re-employment
outcomes. Every UI claimant is a warm lead for WIOA co-enrollment.
