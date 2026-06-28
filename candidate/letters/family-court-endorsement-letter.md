# Family-Court Reform — Outreach / Endorsement Letter

Adapted from the `mo-gov` advocacy-letter template for the Matt Grant for Congress campaign. Uses
`{{variable}}` mail-merge syntax (Word / Google Docs / label software). Pair with the targets in
[../coalition-family-court-targets.md](../coalition-family-court-targets.md).

> Integrity: faithful to Matt's published platform; no invented stats, quotes, or endorsements. Fill
> the bracketed data with **verified** Missouri figures before sending. Keep the "Paid for by…" line.

---

## Letter (state legislator — issue ally / endorsement)

```
{{date}}

The Honorable {{full_name}}
Missouri {{chamber}}
201 W. Capitol Ave., Rm. {{room_number}}
Jefferson City, MO 65101

Dear {{salutation}} {{last_name}}:

I'm Matt Grant — a neighbor, a dad, and a problem-solver running for the U.S. House in Missouri's
2nd District. After 23 years in the courtroom, I'm running on one fight no one else is having: cleaning
up our family courts so they protect children instead of insiders.

You serve on the {{committee_name}}, where Missouri's custody and family-court questions land. That's
exactly why I'm writing to you. I'm championing the CHILD Protection Act — Corruption Hiding Inside
Legal Dockets — which would tie federal Title IV-D grant money to states that keep their family courts
clean, open, and accountable to the children they serve. It's federal leverage in service of a problem
Missouri families feel at the state and local level every day.

[OPTIONAL — verified Missouri context. Only include figures you can source:]
- "Each year, Missouri family courts handle [verified number] custody and visitation matters; too many
  families navigate them without [specific, sourced gap]."

I'd value your perspective, and I'd be honored to have your support. Specifically, I respectfully ask:
{{specific_ask}}
  - "...your endorsement of this reform effort on the record."
  - "...a short conversation with you or your staff about the family-court provisions."
  - "...your willingness to be an issue ally and help amplify this to Missouri families."

Thank you for your service to the families of District {{district_number}} and to Missouri. I've
enclosed a one-page brief on the CHILD Protection Act, and I'm available at your convenience.

Respectfully,

Matt Grant
Candidate, U.S. House — Missouri's 2nd District
{{campaign_email}} · {{campaign_phone}}

Paid for by Matt Grant for Congress.
```

## Variable map

| Variable | Source |
|---|---|
| `{{full_name}}`, `{{salutation}}`, `{{last_name}}`, `{{chamber}}`, `{{room_number}}`, `{{district_number}}` | verified roster (senate.mo.gov / house.mo.gov) |
| `{{committee_name}}` | the target's committee (Judiciary; Families, Seniors and Health; etc.) |
| `{{specific_ask}}` | pick one ask per target tier |
| `{{campaign_email}}` / `{{campaign_phone}}` | mattgrantforcongress@gmail.com · (314) 255-7760 |
| `{{date}}` | send date |

## Notes
- For a **primary**, confirm party/alignment first and prioritize accordingly.
- Pair each send with the one-page CHILD Protection Act brief (build from `candidate/platform.md`;
  the `mo-gov` `policy-brief.md` format is a good skeleton).
- Log every send in the outreach pipeline (mo-gov `outreach-pipeline.json` → Airtable).

_Paid for by Matt Grant for Congress._
