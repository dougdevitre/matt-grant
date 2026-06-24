# SOC 2 for Startups

```mermaid
graph LR
    A[Readiness Assessment] --> B[Gap Analysis]
    B --> C[Remediation]
    C --> D[Type I Audit]
    D --> E[Observation Period]
    E --> F[Type II Audit]

    style A fill:#4a90d9,stroke:#2c5f8a,color:#fff
    style B fill:#e8a838,stroke:#b8832c,color:#fff
    style C fill:#d94a4a,stroke:#a83232,color:#fff
    style D fill:#5ba85b,stroke:#3d7a3d,color:#fff
    style E fill:#7b68ae,stroke:#5a4d82,color:#fff
    style F fill:#2c8c6e,stroke:#1d6b53,color:#fff
```

**Disclaimer:** SOC 2 is a significant undertaking. Cost and timeline vary widely. This is educational context — work with a qualified auditor for your actual compliance program.

---

## What Is SOC 2 and Do You Need It?

SOC 2 (System and Organization Controls 2) is a security audit framework that verifies your company has adequate controls around security, availability, processing integrity, confidentiality, and privacy.

**You need SOC 2 when:**
- Enterprise customers (especially large companies, healthcare, finance, government) require it before signing
- Prospects ask "are you SOC 2 compliant?" during security reviews
- You're selling to regulated industries
- You store or process sensitive customer data

**You probably don't need SOC 2 yet if:**
- All your customers are SMBs and none have asked for it
- You're pre-revenue or very early stage
- Your sales cycle doesn't include a security questionnaire

**Rule:** Wait until you lose a deal because of SOC 2, or it comes up in 3+ sales conversations. Then prioritize it.

---

## SOC 2 Type I vs. Type II

| | Type I | Type II |
|--|--------|---------|
| **What it covers** | Controls are designed appropriately at a point in time | Controls operated effectively over a period of time (usually 6–12 months) |
| **Time to get** | 2–4 months | 6–12+ months |
| **Cost** | $15K–$40K | $30K–$80K+ |
| **What customers want** | Acceptable as a starting point | Preferred; more credible |
| **Best for** | First SOC 2 report; early enterprise customers | Mature enterprise sales; regulated industries |

**Path:** Get Type I first to unblock sales. Begin Type II observation period immediately after.

---

## The 5 Trust Service Criteria

SOC 2 audits are organized around Trust Service Criteria (TSC). Most startups pursue **Security** (required) plus optionally others.

| Criteria | What It Covers | Typically Required? |
|----------|---------------|---------------------|
| **Security** | Protection from unauthorized access | Yes — always |
| **Availability** | System is available as agreed | Often — if uptime matters |
| **Processing Integrity** | System processes data correctly | Rare for SaaS |
| **Confidentiality** | Confidential data is protected | Common — if B2B with sensitive data |
| **Privacy** | Personal information is collected/used appropriately | Sometimes — especially with GDPR |

**Start with:** Security + Availability. Add Confidentiality if you handle sensitive B2B data.

---

## SOC 2 Readiness Checklist

Before beginning your audit, you should have:

**Access Control**
- [ ] Unique user accounts for all employees (no shared logins)
- [ ] Multi-factor authentication (MFA) on all critical systems
- [ ] Role-based access control — least privilege
- [ ] Process for revoking access when employees leave (< 24 hours)
- [ ] Password policy enforced (complexity, rotation)

**Encryption**
- [ ] Data encrypted at rest (AES-256 or equivalent)
- [ ] Data encrypted in transit (TLS 1.2+)
- [ ] Encryption keys managed securely (AWS KMS, Google KMS)

**Logging and Monitoring**
- [ ] Audit logs for all access to production systems
- [ ] Centralized log management (Datadog, Splunk, AWS CloudWatch)
- [ ] Alerting on suspicious activity
- [ ] Log retention: minimum 12 months

**Vulnerability Management**
- [ ] Dependency scanning (Snyk, Dependabot)
- [ ] Regular penetration testing (annually minimum)
- [ ] Patch management process documented
- [ ] SAST/DAST in CI/CD pipeline

**Incident Response**
- [ ] Incident response plan documented
- [ ] Roles assigned for security incidents
- [ ] Communication plan for breach notification
- [ ] Tabletop exercise conducted

**Change Management**
- [ ] All code changes go through pull request review
- [ ] No direct commits to production
- [ ] Deployment approval process documented

**Vendor Management**
- [ ] Inventory of all vendors with access to data
- [ ] Security review of critical vendors
- [ ] BAAs or DPAs in place where required

**HR & People**
- [ ] Background checks for employees with system access
- [ ] Security awareness training (annual)
- [ ] Acceptable use policy signed by all employees
- [ ] Offboarding checklist includes system access revocation

**Business Continuity**
- [ ] Data backup and restore tested
- [ ] Recovery time objective (RTO) and recovery point objective (RPO) defined
- [ ] Disaster recovery plan documented

---

## SOC 2 Tooling — Automation Platforms

These platforms significantly reduce the time and cost of SOC 2 by automating evidence collection.

| Platform | Cost (approximate) | Best For |
|----------|-------------------|----------|
| **Vanta** | $1,000–$3,000/mo | Most popular; integrates with 100+ tools; excellent for first-time |
| **Drata** | $1,000–$3,000/mo | Strong automation; slightly more enterprise-focused |
| **Secureframe** | $800–$2,000/mo | Good value; faster to implement |
| **Tugboat Logic** (OneTrust) | $1,500–$4,000/mo | Enterprise focus |
| **Strike Graph** | $500–$1,500/mo | Good for smaller companies |
| **Manual (no platform)** | Lower $$, more time | Only if you have a dedicated compliance person |

**Recommended path:** Start with Vanta or Drata — they pay for themselves in auditor time savings.

---

## SOC 2 Auditors (CPA Firms)

SOC 2 reports must be issued by a licensed CPA firm. Common firms used by startups:

**National / Remote**
- Schellman & Company
- A-LIGN
- AssuranceLab (popular with startups using Vanta/Drata)
- KPMG, Deloitte, EY, PwC (for enterprise-scale)

**Pricing range:**
- Type I: $15,000–$35,000
- Type II: $25,000–$75,000+
- Using a compliance automation platform typically reduces auditor cost 20–40%

---

## SOC 2 Timeline (Using Automation Platform)

```
Month 1–2: Gap Assessment + Remediation
  → Connect systems to Vanta/Drata
  → Identify gaps vs. controls
  → Fix critical gaps (MFA, access control, logging)
  → Write required policies

Month 3: Pre-Audit Preparation
  → Evidence collection
  → Policy documentation complete
  → Penetration test completed
  → Select auditor

Month 4: Type I Audit
  → Auditor reviews controls at a point in time
  → Respond to auditor questions
  → Receive Type I report

Month 5–10: Type II Observation Period
  → Maintain controls for 6 months
  → Continuous monitoring via automation platform

Month 11–12: Type II Audit
  → Auditor reviews 6-month evidence
  → Receive Type II report
```

---

## Security Questionnaires (Before You Have SOC 2)

Enterprise prospects often send security questionnaires before you have a SOC 2 report. How to handle:

1. **Answer honestly** — don't claim controls you don't have
2. **Show your roadmap** — "We don't have SOC 2 yet; here's our timeline"
3. **Highlight what you do have** — encryption, MFA, access controls
4. **Use Whistic or SecurityPal** — tools that help manage and respond to questionnaires
5. **Get a penetration test** — a clean pentest report often satisfies prospects while you complete SOC 2
