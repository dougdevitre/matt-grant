# Campaign Roles

This reference defines the 5 user roles recognized by the get-elected skill. Each role shapes the tone, detail level, and compliance emphasis of responses.

---

## 1. Candidate

The person whose name appears on the ballot. This is the default role when no other role is specified.

**Responsibilities:**
- Make final decisions on strategy, messaging, and budget
- Personally solicit donations (call time)
- Attend events, debates, forums, and media appearances
- Approve all public communications sent on behalf of the campaign
- Sign campaign finance reports (or review before treasurer files)
- Represent the campaign to voters, press, and community leaders
- Set the tone and values of the campaign

**What They Need from the Skill:**
- Plain-language explanations of rules and processes
- Step-by-step guidance for first-time candidates
- Quick answers to "can I do this?" compliance questions
- Encouragement balanced with realistic expectations
- Time management and prioritization advice
- Messaging and talking-point development

**Key Compliance Duties:**
- Do not personally accept contributions above legal limits
- Disclose personal financial interests as required
- Ensure campaign materials carry required disclaimers
- Do not use official/government resources for campaign purposes
- File or co-sign required financial disclosure reports

---

## 2. Treasurer

The campaign finance officer legally responsible for tracking money in and money out. Federal campaigns must have a designated treasurer; most states require one as well.

**Responsibilities:**
- Maintain accurate records of all contributions and expenditures
- Ensure contributions comply with source and amount limits
- File campaign finance reports on time and accurately
- Deposit contributions promptly into the campaign bank account
- Authorize or co-sign disbursements
- Collect and record donor information (name, address, employer, occupation)
- Return or refund prohibited or excessive contributions
- Retain all records for the legally required period

**What They Need from the Skill:**
- Specific compliance rules with citations to statute/regulation
- Filing deadline calendars and reminders
- Itemization threshold guidance
- Help distinguishing contribution types (monetary, in-kind, loan)
- Report preparation checklists
- Guidance on handling edge cases (returned checks, disputed amounts)

**Key Compliance Duties:**
- Personal liability for accuracy of filed reports (federal level)
- Timely refund of excessive or prohibited contributions
- Proper record retention (3 years federal; varies by state)
- Accurate categorization of receipts and disbursements

---

## 3. Campaign Manager

Oversees day-to-day strategy and operations. In small campaigns this may be the candidate; in larger campaigns it is a dedicated staffer.

**Responsibilities:**
- Develop and execute the campaign plan
- Manage staff, contractors, and volunteer coordination
- Control the budget and approve expenditures
- Coordinate messaging, media, and voter contact programs
- Monitor polling, voter contact data, and opponent activity
- Manage the campaign calendar and candidate schedule
- Serve as primary liaison between candidate and team
- Make tactical decisions within the strategic framework

**What They Need from the Skill:**
- Strategic frameworks and planning templates
- Budget modeling and burn-rate analysis tools
- Voter targeting and win-number calculations
- Competitor analysis approaches
- Volunteer management best practices
- Timeline and milestone planning

**Key Compliance Duties:**
- Ensure all campaign activity complies with applicable law
- Coordinate with treasurer on expenditure approvals
- Verify that vendors and consultants are properly contracted
- Ensure paid communications carry required disclaimers

---

## 4. Volunteer / Supporter

A person helping the campaign in a non-staff capacity. This includes door-knockers, phone bankers, event hosts, and donors who want to understand the process.

**Responsibilities:**
- Execute assigned voter contact tasks (canvassing, phone banking, texting)
- Follow campaign scripts and messaging guidance
- Report results accurately (doors knocked, voters contacted)
- Attend trainings and briefings
- Recruit additional volunteers
- Contribute financially within legal limits

**What They Need from the Skill:**
- Simple, jargon-free answers about how campaigns work
- Guidance on what volunteers can and cannot do legally
- GOTV logistics and best practices
- Donation process and contribution limit information
- How to host a house party or community event for the candidate

**Key Compliance Duties:**
- Do not represent yourself as an official campaign spokesperson unless authorized
- Understand that volunteer time is generally not an in-kind contribution
- Know that certain expenses (over $50 for federal) by volunteers may count as contributions
- Do not coordinate with outside groups on behalf of the campaign unless authorized

---

## 5. Advisor / Consultant

A professional (paid or pro bono) providing specialized expertise: pollsters, media consultants, fundraising consultants, field directors, compliance attorneys.

**Responsibilities:**
- Provide expert guidance in area of specialty
- Deliver actionable recommendations backed by data or experience
- Meet contracted deliverables on schedule
- Maintain confidentiality of campaign strategy and data
- Flag compliance risks proactively
- Coordinate with campaign manager on implementation

**What They Need from the Skill:**
- Detailed, technical information with regulatory citations
- Professional-grade frameworks and methodologies
- Comparative data and benchmarks
- Nuanced discussion of trade-offs and edge cases
- Integration with other campaign functions and vendors

**Key Compliance Duties:**
- Ensure consulting fees are properly reported as expenditures
- Do not coordinate between the campaign and any outside group (PAC, Super PAC)
- Understand that discounted services may constitute in-kind contributions
- Comply with any "paid for by" disclaimer requirements for produced materials
- Maintain required vendor documentation and contracts

---

## Role Detection

The skill infers role from context when not explicitly stated. Indicators include:
- **Candidate:** "I'm running for...", "my campaign", "should I..."
- **Treasurer:** "filing deadline", "itemization", "how do I report..."
- **Campaign Manager:** "our strategy", "voter targets", "budget allocation"
- **Volunteer:** "I'm helping with...", "how do I canvass", "I want to donate"
- **Advisor:** Technical jargon, references to multiple clients or campaigns

When the role is ambiguous, the skill defaults to Candidate and adjusts if later context suggests otherwise.

---

## Role-to-Module Map

```mermaid
flowchart TD
    CA["**Candidate**\nAll modules"]
    TR["**Treasurer**\nCompliance-heavy:\ncontribution limits, filings,\nreporting, expenditure tracking"]
    CM["**Campaign Manager**\nStrategy + Ops:\ncampaign plan, voter targeting,\nbudget, volunteer management"]
    VO["**Volunteer / Supporter**\nGOTV + Donations:\ncanvassing, phone banking,\ndonation rules, events"]
    AD["**Advisor / Consultant**\nFull access:\nprofessional-grade frameworks,\nregulatory citations, benchmarks"]

    CA --- TR
    CA --- CM
    CA --- VO
    CA --- AD
```
