# Resource Directory — Schema & Query Guide

## Overview

The resource directory at `data/mo-resources.json` is a structured, queryable database of
social service organizations. Use this instead of the prose-based `references/mo-resources.md`
when you need to find specific resources by domain, geography, or population.

## Schema

Each resource entry has these fields:

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Organization name |
| `domain` | string[] | ✓ | Service domains (food, housing, mental_health, etc.) |
| `type` | string | ✓ | Organization type (hotline, cmhc, food_bank, legal_aid, government, etc.) |
| `phone` | string | | Primary phone number |
| `phone_alt` | string | | Alternative phone / text line |
| `address` | string | | Physical address |
| `website` | string | | Website URL |
| `hours` | string | | Operating hours |
| `coverage` | string | ✓ | Geographic coverage (national, statewide, eastern_mo, stl_metro, etc.) |
| `counties` | string[] | | Specific counties served (for sub-state orgs) |
| `population` | string[] | ✓ | Target population (all, low_income, seniors, disabled, children, veterans, etc.) |
| `cost` | string | | Cost model (free, sliding_scale, income_based, suggested_donation) |
| `insurance` | string[] | | Insurance accepted (medicaid, medicare, private, uninsured) |
| `description` | string | ✓ | Brief description of services |
| `verified` | string | ✓ | Date the entry was last verified (YYYY-MM-DD) |
| `note` | string | | Special notes (waitlist info, restrictions, seasonal availability) |

## Query Patterns

### By domain
Find all resources matching a service domain:
```
domain includes "food" → returns food banks, pantries, SNAP, WIC
domain includes "mental_health" → returns CMHCs, hotlines, peer support
domain includes "crisis" → returns crisis hotlines and stabilization
```

### By geography
```
coverage = "statewide" → returns state-level resources
coverage = "stl_metro" → returns St. Louis metro area resources
coverage = "national" → returns national hotlines and programs
counties includes "St. Louis County" → returns county-specific resources
```

### By population
```
population includes "seniors" → returns aging-specific resources
population includes "disabled" → returns disability-specific resources
population includes "all" → returns general-population resources
```

### Combined queries
```
domain = "mental_health" AND coverage = "stl_metro" AND insurance includes "medicaid"
→ returns Medicaid-accepting mental health providers in St. Louis metro
```

## How to Use in Practice

### When generating a referral
1. Identify the client's domain need, location, and special characteristics
2. Query the directory for matching resources
3. **Verify via web search** before sharing phone numbers or addresses
4. Format as a Referral Card (see `references/output-formats.md`)

### When building a service plan
1. Query multiple domains for the client's identified needs
2. Include the organization name, phone, and how-to-access in the plan
3. Note the `verified` date — if older than 6 months, verify before sharing

### Adding new resources
To add a resource, append a new entry to the `resources` array with all required fields.
Ensure:
- `id` is unique (use pattern: `region-shortname`)
- `domain` uses the standard domain vocabulary
- `verified` is set to today's date
- `description` is brief and accurate

## Standard Domain Vocabulary

```
food, housing, mental_health, substance_use, healthcare, education,
employment, legal, children, family, public_safety, disability,
aging, transportation, crisis, financial, immigration, reentry
```

## Standard Population Vocabulary

```
all, low_income, seniors, disabled, children, children_0_3,
children_under5, school_age, families_with_children, veterans,
pregnant, lgbtq_youth, justice_involved, homeless, immigrants,
caregivers, medicare, families_prenatal_5, families_children_disabilities,
all_rural
```

## Maintenance

- **Quarterly review:** Check all `verified` dates; re-verify entries older than 6 months
- **Phone number changes:** These are the most common updates — verify before sharing
- **New entries:** Community partners, navigators, and staff can submit new resources
- **Removal:** If an organization closes, remove the entry (don't just mark it — stale entries cause harm)
- **Audit trail:** Update `verified` date with every verification, even if nothing changed
