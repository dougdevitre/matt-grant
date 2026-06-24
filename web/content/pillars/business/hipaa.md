# HIPAA Compliance for Startups

```mermaid
graph LR
    A[PHI Identification] --> B[Technical Safeguards]
    B --> C[Administrative Safeguards]
    C --> D[BAA Execution]
    D --> E[Risk Assessment]
    E --> F[Ongoing Audit]

    style A fill:#d94a4a,stroke:#a83232,color:#fff
    style B fill:#4a90d9,stroke:#2c5f8a,color:#fff
    style C fill:#5ba85b,stroke:#3d7a3d,color:#fff
    style D fill:#e8a838,stroke:#b8832c,color:#fff
    style E fill:#7b68ae,stroke:#5a4d82,color:#fff
    style F fill:#d97a4a,stroke:#a85a32,color:#fff
```

**Disclaimer:** HIPAA is complex and penalties are severe. This is educational context only. Engage a HIPAA compliance specialist or healthcare attorney before handling PHI.

---

## Do You Need to Worry About HIPAA?

HIPAA applies if you are a **Covered Entity** or a **Business Associate.**

### Covered Entities
- Healthcare providers (doctors, hospitals, clinics)
- Health plans (insurance)
- Healthcare clearinghouses

**If you're a startup, you're likely NOT a covered entity** — unless you're directly providing clinical care.

### Business Associates
- Any company that creates, receives, maintains, or transmits **Protected Health Information (PHI)** on behalf of a covered entity
- Examples: EHR software, telehealth platforms, medical billing software, clinical trial apps, healthcare analytics tools

**If you sell to hospitals, clinics, or health insurers and your product touches patient data → you are likely a Business Associate and HIPAA applies.**

### The Practical Test
Ask: "Does my product access, store, or transmit information about a specific person's health, medical care, or payment for healthcare?"

If YES → HIPAA almost certainly applies. Get counsel.

---

## Protected Health Information (PHI) — What It Is

PHI is any **individually identifiable health information** that relates to:
- The individual's past, present, or future physical or mental health
- Provision of healthcare to the individual
- Past, present, or future payment for healthcare

**The 18 HIPAA identifiers** (any of these combined with health info = PHI):
1. Name
2. Geographic subdivisions smaller than state
3. Dates (except year) related to the individual
4. Phone numbers
5. Fax numbers
6. Email addresses
7. Social security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers
13. Device identifiers
14. Web URLs
15. IP addresses
16. Biometric identifiers (fingerprints, voice)
17. Full-face photos
18. Any other unique identifying number or code

**If your app stores a user's email address AND their diagnosis → that's PHI.**

---

## Business Associate Agreement (BAA)

**What it is:** A contract between a covered entity and a business associate that establishes permitted uses and disclosures of PHI and sets safeguards.

**When you need one:** Before any covered entity shares PHI with your company.

**If a hospital wants to use your product and it touches patient data → they will require a signed BAA before going live.**

**Key BAA terms:**
- Permitted uses and disclosures of PHI
- Obligation to implement HIPAA safeguards
- Breach notification obligations (within 60 days of discovery)
- Return or destruction of PHI upon termination
- Sub-contractor (sub-BA) requirements

**Your cloud vendors must also sign BAAs with you:**
- AWS: Has a BAA — request at aws.amazon.com/compliance/hipaa-eligible-services-reference
- Google Cloud: Has a BAA
- Microsoft Azure: Has a BAA
- Stripe: Does NOT cover PHI — don't use standard Stripe for healthcare payments without review
- Twilio: Has a BAA for qualifying accounts

---

## HIPAA Technical Safeguards (What You Must Build)

### Access Controls
- Unique user IDs for every person accessing PHI
- Automatic logoff after inactivity
- Encryption and decryption of PHI
- Audit controls logging who accessed what and when

### Audit Controls
- Log all access to PHI — who, when, what
- Retain logs for 6 years
- Review logs regularly for unauthorized access

### Integrity Controls
- Ensure PHI isn't altered or destroyed improperly
- Transmission security — encrypt PHI in transit (TLS 1.2+)

### Transmission Security
- All PHI transmitted over networks must be encrypted
- TLS 1.2 minimum; TLS 1.3 preferred
- No PHI in email without encryption

### Encryption Requirements
- PHI at rest: AES-256 encryption
- PHI in transit: TLS 1.2+
- Mobile devices with PHI: Full-device encryption + remote wipe capability

---

## HIPAA Administrative Safeguards

- **Privacy Officer:** Designate someone (can be a founder early-stage)
- **Security Officer:** Designate someone responsible for security policies
- **Workforce training:** All employees with PHI access must be trained annually
- **Policies and procedures:** Document everything — access control, breach response, device policies
- **Risk Analysis:** Annual assessment of PHI risks and vulnerabilities
- **Sanctions policy:** What happens when employees violate HIPAA

---

## HIPAA Breach Notification

If PHI is breached (unauthorized access, disclosure, or use):

- **< 500 individuals affected:** Notify affected individuals within 60 days; notify HHS annually
- **> 500 individuals affected:** Notify affected individuals AND HHS AND local media within 60 days
- **HHS notification:** hhs.gov/hipaa/for-professionals/breach-notification

**Penalties:**
- Tier 1 (unknowing violation): $100–$50,000 per violation; max $1.9M/year
- Tier 2 (reasonable cause): $1,000–$50,000 per violation
- Tier 3 (willful neglect, corrected): $10,000–$50,000 per violation
- Tier 4 (willful neglect, uncorrected): $50,000 per violation; max $1.9M/year
- Criminal: Up to 10 years in prison for intentional misuse

---

## HIPAA Compliance Vendors for Startups

| Vendor | What They Do | Cost Range |
|--------|-------------|------------|
| Vanta | Automated HIPAA + SOC 2 compliance | $1,000–$3,000/mo |
| Drata | Automated compliance management | $1,000–$3,000/mo |
| Compliancy Group | HIPAA-specific; guided implementation | $500–$1,500/mo |
| HIPAA One | Risk assessments, policies, training | $500–$2,000/mo |
| Datica (now Aptible) | HIPAA-compliant hosting platform | $1,500+/mo |
| Aptible | Deploy HIPAA-compliant apps on AWS | $500+/mo |
| TrueVault | HIPAA-compliant data storage API | Usage-based |

**For very early-stage:** Use Compliancy Group or HIPAA One for policy documentation; build on Aptible or AWS with BAA for infrastructure.

---

## Healthcare-Adjacent Startups That Often Misunderstand HIPAA

**You likely DO need HIPAA compliance if your product:**
- Manages patient records, even indirectly
- Integrates with EHR systems (Epic, Cerner, Athena)
- Processes health insurance claims
- Handles mental health notes or substance abuse records
- Enables telehealth visits
- Manages clinical trial data

**You likely DON'T need HIPAA compliance if:**
- You sell wellness apps directly to consumers (not on behalf of a covered entity)
- You collect de-identified health data (properly de-identified per HIPAA Safe Harbor)
- You're a general productivity tool used incidentally by healthcare workers

**Gray area:** Consumer health apps that partner with health systems. Get counsel.
