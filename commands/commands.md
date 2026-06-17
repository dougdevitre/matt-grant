# Campaign Commands

Instant-generation triggers. When a user types any of these commands, generate the specified artifact immediately using the user's campaign context (jurisdiction, office, candidate name, party, issues). If context is missing, ask for it first.

---

## Command Reference

### Getting Started
| Command | Output |
|---|---|
| `/launch` | Complete first-30-days action plan personalized to their race |
| `/plan` | Full campaign plan document (theory of victory, vote goals, budget, timeline, org chart) |
| `/viability` | Viability scorecard — filled out interactively with the candidate |
| `/checklist` | Filing and setup checklist customized to their jurisdiction |
| `/budget [amount]` | Complete campaign budget allocated by category for the specified total |

### Issue Response
| Command | Output |
|---|---|
| `/issue [paste text]` | **All 8 response formats at once:** 🚪 Door (30 sec), 🎤 Forum (2 min), 📝 Position statement, 📱 Social media (short + long), 💬 Empathy-first, 📋 Surrogate talking points, 🛡️ Inoculation language, 🔄 Bridge phrases |
| `/respond [topic]` | Quick response to a specific topic — generates door + social versions |
| `/position [issue]` | Full position statement for website or questionnaire |
| `/inoculate [issue]` | Preemptive defense language for an issue the opponent will attack on |

### Influence Network Targeting
| Command | Output |
|---|---|
| `/powermap` | **Full influence targeting analysis:** 12-category power map worksheet, scoring matrix, prioritized outreach sequence, and ready-to-send outreach packages for top targets |
| `/target [name or category]` | Outreach package for a specific person or category: personalized ask letter, endorsement request, fundraising script, event invite, and post-activation deployment plan |
| `/activate [name]` | Post-activation package: announcement press release, social media posts, surrogate briefing sheet, and thank-you note |
| `/cascade [name]` | "Who else should I talk to?" follow-up: generates introduction request and next-tier targeting suggestions based on the activated person's network |

### Fundraising
| Command | Output |
|---|---|
| `/callscript` | Fundraising call script personalized with candidate name, office, and ask amounts |
| `/askemail [amount]` | Fundraising email draft for the specified ask amount |
| `/thankyou [donor name]` | Personalized donor thank-you letter |
| `/houseparty` | Complete house party planning packet (host guide, invite text, run-of-show, ask script) |
| `/deadline [days]` | Deadline fundraising email sequence (3 emails: setup, urgency, final push) |
| `/matchemail` | Matching gift fundraising email |
| `/milestonemail [metric]` | Milestone celebration email ("We just hit 500 donors!") |
| `/recurringask` | Email asking supporters to set up monthly recurring donations |

### Messaging & Content
| Command | Output |
|---|---|
| `/speech [minutes]` | Stump speech draft for the specified length |
| `/elevator` | 30-second elevator pitch |
| `/bio [length]` | Candidate bio (short/medium/long versions) |
| `/onesheet` | Campaign one-sheet / leave-behind (print-ready) |
| `/announcement` | Campaign announcement press release + email + social posts |
| `/endorsement [name]` | Endorsement announcement press release |
| `/position [issue]` | Issue position statement (press release format) |
| `/response [topic]` | Rapid response statement to an attack or news event |
| `/contrast` | Side-by-side contrast document (your candidate vs. opponent) |
| `/op-ed [issue]` | Op-ed draft for submission to local newspaper |
| `/lte [topic]` | Letter to the editor draft |

### Social Media
| Command | Output |
|---|---|
| `/socialweek` | One week of social media posts (7 days, all platforms) |
| `/announcesocial` | Announcement day social media package (all platforms) |
| `/endorsesocial [name]` | Endorsement social media posts |
| `/gotvsocial` | GOTV social media posts for the final week |
| `/issuegraphic [issue]` | Social media graphic concept with copy |

### Podcast Campaign
| Command | Output |
|---|---|
| `/podcastpitch [podcast name]` | Personalized pitch email to a specific podcast host |
| `/podcastprep [podcast name]` | Pre-interview briefing sheet: host research, likely questions, key messages, stories, the ask |
| `/podcastquestions` | Suggested questions to send the host, personalized to candidate's story and issues |
| `/podcastpromo [episode title]` | Full social media promotion package: all platforms + audiogram clip concepts + guest share kit + hashtags |
| `/podcastpage` | Campaign website podcast page copy |
| `/podcastshownotes [guest]` | Episode show notes: description, timestamps, pull quotes, links |
| `/podcastlaunch` | Complete podcast launch plan: name, format, branding, first 8 episodes, production workflow, distribution |
| `/guestpackage` | Guest package to send podcast hosts: bio, headshot specs, suggested topics, intro script, social handles |

### Voter Contact
| Command | Output |
|---|---|
| `/doorscript` | Canvass script with ID question, issue pivot, and close |
| `/phonescript` | Phone banking script (ID + persuasion version and GOTV version) |
| `/textscript` | Peer-to-peer texting scripts (intro, persuasion, GOTV, event invite) |
| `/voicemail` | Voicemail script for robocall or volunteer phone banking |
| `/walkcard` | Walk card / palm card content (front and back) |

### Outreach & Correspondence
| Command | Output |
|---|---|
| `/endorseask [name]` | Endorsement request letter to a specific person or organization |
| `/eventinvite [event]` | Event invitation (email + text message versions) |
| `/volunteerask [name]` | Personalized volunteer recruitment message |
| `/communityintro [group]` | Introduction letter to a community organization |
| `/mediakit` | Complete media kit (bio, headshot specs, issue summary, endorsement list, contact info) |
| `/questionnaire [org]` | Candidate questionnaire response framework for an endorsing organization |

### Compliance
| Command | Output |
|---|---|
| `/disclaimer [type]` | Disclaimer text for the specified communication type |
| `/limitcheck [state]` | Contribution limit lookup table for the specified state |
| `/reportchecklist` | Pre-filing reconciliation checklist with the next deadline |
| `/calendar [state]` | Filing deadline calendar for the specified jurisdiction |
| `/treasurermemo` | Monthly treasurer status memo template |

### Voter Engagement Tools
| Command | Output |
|---|---|
| `/votingplan` | Personalized voting plan builder: questions, logic, shareable output card |
| `/regcheck [state]` | Branded registration checker with state-specific links and deadlines |
| `/countdown [date]` | Election countdown content for all platforms with key dates |
| `/ridesignup` | Ride-to-polls signup form and volunteer driver matching workflow |
| `/issueguide` | Scannable issue guide: top 5–8 positions in plain language |
| `/compare [opponent]` | Sourced side-by-side candidate comparison on key issues |
| `/issuequiz` | Interactive values match quiz: questions, answer mapping, results page |
| `/storycollector` | "Why I'm voting for..." form, prompt, permission language, social templates |
| `/endorsementcard` | Shareable personal endorsement card generator template |
| `/relationalkit` | Voter-to-voter outreach kit: text template, social post, talking points, tracker |
| `/pledgecard` | Pledge to vote form with counter and shareable confirmation graphic |
| `/volunteermatch` | Volunteer role matching quiz: questions, role logic, signup workflow |
| `/districtdashboard` | District facts page: demographics, representatives, election history, key issues |
| `/officexplainer [office]` | Plain-language explainer of what the office does and why it matters |
| `/voterguide` | Printable endorsement voter guide with dates and polling info |

### GOTV & Events
| Command | Output |
|---|---|
| `/gotvplan` | Complete GOTV operations plan for the final 2 weeks |
| `/electionday` | Election day operations timeline (5 AM to polls close) |
| `/rallyrunofshow` | Rally or large event run-of-show document |
| `/townhall` | Town hall event plan (format, logistics, Q&A prep) |
| `/debatebriefing [opponent]` | Debate prep briefing book outline |

### Voter Personas & Strategy
| Command | Output |
|---|---|
| `/personas` | 4–6 psychographic voter profiles with messages, channels, and asks per persona |
| `/primaryplan` | Primary-specific strategy: target electorate, message, endorsement priorities, resource allocation |
| `/generalplan` | General election strategy: pivot plan, expanded targets, broadened message, channel allocation |
| `/pivotplan` | Transition plan from primary to general: what to keep, what to shift, timeline, messaging bridge |

### Candidate Performance
| Command | Output |
|---|---|
| `/mediatraining` | Media training prep sheet: do's and don'ts for TV, radio, print, and hostile interviews |
| `/debatepractice` | Mock debate Q&A: 10 hostile questions with model answers and coaching notes |
| `/familybrief` | Family conversation guide: what to discuss, how to prepare, what to protect |
| `/wellnesscheck` | Candidate wellness assessment: energy, sleep, exercise, mood, warning signs, adjustments |

### Election Protection
| Command | Output |
|---|---|
| `/electionprotection` | Election protection plan: lawyer checklist, recount rules, poll watcher training, boiler room setup |
| `/watchers` | Poll watcher program: recruitment, training agenda, credentialing checklist, incident report template |
| `/recountprep` | Recount preparation: state rules, attorney briefing, observer deployment, fundraising for legal costs |

### Post-Election
| Command | Output |
|---|---|
| `/victoryspeech` | Victory speech draft |
| `/concessionspeech` | Concession speech draft |
| `/thankyouall` | Post-election thank-you package (email to donors, volunteers, endorsers) |
| `/winddown` | Committee wind-down checklist and timeline |

---

## How Commands Work

When a user types a command:

1. **Check for campaign context.** Does the skill know: candidate name, office, jurisdiction, party, key issues, opponent name? If not, ask for the missing essentials.
2. **Generate the artifact immediately.** Don't explain what you're going to do — produce the output.
3. **Personalize everything.** Use the candidate's name, office, district, issues, and opponent throughout. Never produce generic templates with [BRACKET PLACEHOLDERS] when you have the actual information.
4. **Offer variants when appropriate.** "Here's version A (warm/personal) and version B (urgent/direct). Which resonates?"
5. **Include the compliance disclaimer** on any artifact that contains campaign finance information.
6. **Make it copy-paste ready.** The output should be usable as-is with minimal editing.
