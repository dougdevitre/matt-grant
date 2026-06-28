#!/usr/bin/env python3
"""
Script content library — the four documented issues, written to every size tier.

Each issue is built ONLY from Matt Grant's documented positions in
`candidate/platform.md` and the messaging pillars in `candidate/strategic-plan.md`
/ `messaging/positioning-framework.md`. No new policy, statistics, endorsements,
party labels, or invented local facts are added here.

Geo localization happens at render time: bodies contain the tokens
`{region_hook}`, `{geo_name}`, and `{descriptor}`, which `geo.localize()` fills.
Short tiers are assembled from reusable fragments by the builders below; the
1/3/5-minute speech tiers are authored in full for flow, following the
six-part structure in `messaging/stump-speech-builder.md`.

Public-record note: Matt Grant is described as a whistleblower attorney who
filed a RICO case in federal court over family-court corruption — this is the
documented public record in `candidate/platform.md`, not an invented claim.
"""

from sizing import TIERS_BY_KEY

# --------------------------------------------------------- shared identity
IDENTITY = ("I'm Matt Grant — a neighbor, a dad, and a problem-solver. I'm "
            "running for Congress to put Missouri's children first, and I don't "
            "just talk — I take action.")

CTA_SHORT = "Vote Matt Grant for Congress on August 4th."
CTA_MED = ("On August 4th, vote Matt Grant for Congress. Learn more at "
           "mattgrantforcongress.org.")
CTA_LONG = ("This primary is August 4th. Vote Matt Grant for Congress, "
            "volunteer, or chip in at mattgrantforcongress.org — and let's put "
            "Missouri's children first.")

NAME_TAG = "Matt Grant for Congress."
DISC_FULL = "Paid for by the Matt Grant for Congress Committee."
DISC_SMS = "Pd for by Matt Grant for Congress Cmte. Txt STOP to quit."


# ----------------------------------------------------------------- issues
# Each issue: meta + short-tier fragments + authored speech bodies.
ISSUES = {
    "family-court": {
        "title": "Family-Court Corruption & the CHILD Protection Act",
        "eyebrow": "Priority 1 · Putting Missouri's Children First",
        "core_message": ("Eliminate corruption in the family court system — "
                         "Matt's signature cause and signature bill."),
        "micro": "Clean up the family courts.",
        "hook": ("Our family courts are supposed to protect kids. Too often, "
                 "they don't."),
        "one_liner": ("Matt Grant will clean up corruption in the family courts "
                      "and put Missouri's children first."),
        "problem": ("Behind closed doors, corruption in the family court system "
                    "is failing the very children it's supposed to protect."),
        "solution": ("Matt's CHILD Protection Act ties federal grant money to "
                     "clean, accountable family courts — Corruption Hiding Inside "
                     "Legal Dockets, exposed and ended."),
        "contrast": ("Career politicians look away. Matt's a whistleblower "
                     "attorney who took this fight to federal court."),
        "story": ("Talk to parents {region_hook}, and you'll hear it: a court "
                  "system that should protect children too often works against "
                  "them."),
        "speech_1": (
            "I'm Matt Grant, and I'm running for Congress to put Missouri's "
            "children first. The families I meet {region_hook} tell me the same "
            "thing: our family courts are supposed to protect kids, but too often "
            "corruption "
            "behind closed doors fails them. I'm a whistleblower attorney — I "
            "didn't just complain about it, I filed a RICO case in federal court. "
            "In Congress, I'll pass the CHILD Protection Act: Corruption Hiding "
            "Inside Legal Dockets, ended by tying federal grant money to clean, "
            "accountable family courts. Career politicians look away. I take "
            "action. On August 4th, vote Matt Grant for Congress — and let's put "
            "our children first."),
        "speech_3": (
            "Talk to parents {region_hook}, and you'll hear the same heartbreak: "
            "a family court system that is supposed to protect children, too "
            "often working against them. I've sat across the table from those "
            "parents. That's why I'm running for Congress.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. I'm also a "
            "whistleblower attorney. When I saw corruption hiding inside our "
            "family courts, I didn't just complain about it — I filed a RICO case "
            "in federal court. I put my name on it. I don't just talk. I take "
            "action.\n\n"
            "Here's the problem. Family courts make some of the most important "
            "decisions in a child's life — who they live with, who keeps them "
            "safe — and they make them behind closed doors, with too little "
            "accountability. When those dockets hide corruption, it isn't an "
            "abstraction. It's a child who loses, a parent who's ignored, a "
            "family that walks out of a courtroom knowing the system failed them. "
            "Across Missouri's 2nd District, families have lived exactly that.\n\n"
            "My plan is the CHILD Protection Act. CHILD stands for Corruption "
            "Hiding Inside Legal Dockets, and here's how it works. It ties "
            "federal Title IV-D grant money to state family-court compliance. "
            "Courts that stay clean and accountable keep the federal check. "
            "Courts that don't, don't. It takes the leverage Washington already "
            "has and uses it to force daylight into a system that's grown far too "
            "comfortable operating in the dark — no new bureaucracy, just "
            "accountability finally pointed in the right direction.\n\n"
            "Career politicians have had years to act, and they've looked away "
            "because it was easier. I won't. Here's what I need from you: on "
            "August 4th, vote Matt Grant for Congress. Volunteer. Talk to your "
            "neighbors. Our children can't wait — and neither can we. Thank you."),
        "speech_5": (
            "Two things are true {region_hook}. People here love their kids more "
            "than anything in the world. And far too many of them have walked "
            "into a family court system that broke their trust. I've sat with "
            "those parents — at kitchen tables, in church basements, after long "
            "days — and I've heard the same words again and again: the place that "
            "was supposed to protect my child failed us. That is why I am in this "
            "race, and it is the cause at the very center of my campaign.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. I never "
            "planned to run for office. I'm a whistleblower attorney, and when I "
            "saw corruption hiding inside our family courts, I couldn't sit on the "
            "sidelines and hope someone else would deal with it. So I filed a RICO "
            "case in federal court. I put my name on the line, in public, on the "
            "record. Because I have never believed in just talking about a "
            "problem. I believe in taking action.\n\n"
            "Let me be plain about what's broken, because we don't say it plainly "
            "often enough. Family courts decide the most important things in a "
            "child's life — where that child lives, who is trusted to keep them "
            "safe, what their future looks like — and they decide it behind "
            "closed doors, with far too little accountability. When corruption is "
            "allowed to hide inside those legal dockets, the people who pay the "
            "price are the ones with the least power in the room: the children. "
            "This is not a partisan talking point. It is what families "
            "{region_hook} have lived through, and it is wrong.\n\n"
            "So here is what I'm going to do about it. I'll pass the CHILD "
            "Protection Act. CHILD stands for Corruption Hiding Inside Legal "
            "Dockets, and it does three things. First, it ties federal Title IV-D "
            "grant money to state family-court compliance — real consequences, so "
            "a court that refuses to clean up its house feels it where it counts. "
            "Second, it forces daylight into a system that has grown comfortable "
            "working in the dark, because corruption can't survive being seen. "
            "Third, it puts the full weight of the federal government behind the "
            "parents and children who, for too long, have had no one standing in "
            "their corner.\n\n"
            "Now, the career politicians have had years — decades — to fix this. "
            "They didn't. They looked away, because looking away was easier and "
            "safer for them. I will not look away. I can't. I've already carried "
            "this fight into federal court, and I intend to carry it onto the "
            "floor of Congress.\n\n"
            "This election is August 4th, and in a primary like this one, every "
            "single conversation matters. So here is what I'm asking. If you can "
            "knock on doors, sign up tonight at mattgrantforcongress.org. If you "
            "can chip in, do it there. And if you can do nothing else, talk to "
            "your neighbors about this race, because they need to hear it.\n\n"
            "I got into this for the families who looked me in the eye and told "
            "me their courts had failed their kids. They deserve a representative "
            "who shows up, who is already in the fight, and who actually "
            "delivers. That is what I will do every single day in Congress. "
            "Let's put Missouri's children first. Thank you."),
    },

    "term-limits": {
        "title": "Term Limits for the House & Senate",
        "eyebrow": "Priority 2 · End Careerism in Congress",
        "core_message": ("Term limits for the U.S. House and Senate, applied "
                         "with a grandfather clause."),
        "micro": "Term limits — with a grandfather clause.",
        "hook": "Career politicians don't fix Washington. They are the problem.",
        "one_liner": ("Matt Grant backs term limits for the House and Senate — "
                      "with a grandfather clause — to end careerism in Congress."),
        "problem": ("Too many politicians treat Congress as a lifetime career, "
                    "and the longer they stay, the less they answer to us."),
        "solution": ("Matt supports term limits for both the House and the "
                     "Senate, applied with a grandfather clause, so public "
                     "service goes back to being service — not a career."),
        "contrast": ("The insiders will never limit their own power. Matt will."),
        "story": ("Folks {region_hook} are tired of watching the same names "
                  "cling to power in Washington for decades."),
        "speech_1": (
            "I'm Matt Grant, running for Congress, and I believe career "
            "politicians aren't the cure for what's wrong with Washington — "
            "they're the disease. Folks {region_hook} are tired of watching the "
            "same names cling to power for years on end, answering to lobbyists "
            "and party bosses instead of to us. That's why I support term limits "
            "for both the House and the Senate, applied with a grandfather clause "
            "so we get it done fairly. Public service should be just that — "
            "service, for a season — not a lifetime career. The insiders will "
            "never limit their own power. I will. On August 4th, vote Matt Grant "
            "for Congress."),
        "speech_3": (
            "Here's something both parties' insiders quietly agree on: they like "
            "their jobs, and they intend to keep them for life. Folks "
            "{region_hook} see it clearly — the same names clinging to power in "
            "Washington for years and years, while the problems back home never "
            "seem to change. That's why I'm running for Congress.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. I'm not a "
            "career politician, and I'm not running to become one. I'm running to "
            "fix problems and come home.\n\n"
            "The problem with career politics is simple, and it's not really "
            "about any one person. When a seat in Congress becomes a lifetime "
            "job, the incentives turn upside down. The longer politicians stay, "
            "the less they have to answer to the people back home, and the more "
            "they answer to lobbyists, donors, and party leadership. Seniority "
            "becomes its own reward. And the communities that sent them — places "
            "like ours — become an afterthought between elections.\n\n"
            "My solution is term limits for both the U.S. House and the U.S. "
            "Senate, applied with a grandfather clause so we make the change "
            "fairly and actually get it done instead of arguing about it for "
            "another decade. Term limits put public service back where it "
            "belongs — as service, for a season, by citizens who then go home and "
            "live under the very laws they passed. That's how it was supposed to "
            "work.\n\n"
            "The insiders will never limit their own power. They can't help it — "
            "it's the one thing every career politician agrees on. That's exactly "
            "why we have to send someone who will. On August 4th, vote Matt Grant "
            "for Congress, and tell your neighbors it's time to send Washington a "
            "citizen, not a careerist. Thank you."),
        "speech_5": (
            "Ask just about anyone {region_hook} what they think of Congress, and "
            "you'll get some version of the same answer: the same people have "
            "been there forever, and nothing ever seems to change. They're not "
            "wrong. And that frustration — that sense that Washington has stopped "
            "listening — is a big part of why I'm running for Congress.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. I'm not a "
            "career politician. I've spent my life solving real problems and "
            "taking action, and I want to bring that to Washington — not move "
            "there for the next thirty years and call it a career.\n\n"
            "Let's be honest about the problem, because it's bigger than any one "
            "politician. When a seat in Congress becomes a lifetime job, the "
            "incentives get backwards. The longer politicians stay, the more they "
            "answer to lobbyists, to donors, and to their own party leadership — "
            "and the less they answer to the people who actually sent them there. "
            "Power piles up by seniority. Committee gavels get handed out by "
            "who's been around the longest, not who's right. And the communities "
            "back home, places like ours, become an afterthought — remembered in "
            "campaign season and forgotten the rest of the time.\n\n"
            "Here's what I'll do about it. I support term limits for both the "
            "U.S. House and the U.S. Senate, and let me tell you exactly what "
            "that accomplishes. First, term limits break the careerist grip on "
            "power, so no one treats a seat as a possession to be held for life. "
            "Second, they bring in fresh citizens with real-world experience — "
            "people who've actually lived under the laws Congress writes — "
            "instead of lifelong insiders. And third, I support applying them "
            "with a grandfather clause, because I'd rather make this change "
            "fairly and actually get it passed than hold out for a perfect "
            "version that never happens.\n\n"
            "Now, you already know who's against this. It's the very people whose "
            "careers depend on there being no limits at all. They'll give you a "
            "hundred sophisticated reasons why term limits can't work, and every "
            "one of them comes back to the same thing: they don't want to leave. "
            "That is precisely why we have to send someone who will. A citizen "
            "legislator doesn't fear going home, because home is where they came "
            "from and where they intend to stay. That's the whole idea — you "
            "serve, and then you go back and live among the people you served.\n\n"
            "I'm running because I believe Missouri's 2nd District deserves a "
            "representative who answers to you, not to seniority and not to the "
            "lobbyists who circle this town. Term limits are how we make sure "
            "that stays true long after this election is over.\n\n"
            "This primary is August 4th. If you are as tired of careerism as I "
            "am, I need your help — your vote, your time, and your voice. Join us "
            "at mattgrantforcongress.org. Let's send Washington a citizen who "
            "comes home, not another politician who never leaves. Thank you."),
    },

    "smaller-government": {
        "title": "A Smaller Federal Government",
        "eyebrow": "Priority 3 · Leaner, Accountable Government",
        "core_message": ("A smaller federal government through a hiring freeze "
                         "and early-retirement packages."),
        "micro": "Shrink the federal government.",
        "hook": "Washington keeps growing. Your paycheck doesn't.",
        "one_liner": ("Matt Grant will fight for a smaller federal government — "
                      "through a hiring freeze and early-retirement packages, "
                      "not gimmicks."),
        "problem": ("The federal government has grown bloated and expensive year "
                    "after year, and it's the working families {region_hook} who "
                    "are stuck footing the bill."),
        "solution": ("Matt shrinks Washington responsibly — a federal hiring "
                     "freeze to stop the growth, and early-retirement packages to "
                     "trim the workforce fairly — so government lives within its "
                     "means again."),
        "contrast": ("Career politicians have only ever grown government. Matt "
                     "will finally trim it."),
        "story": ("Working families {region_hook} stretch every single dollar, "
                  "while Washington just keeps getting bigger and more "
                  "expensive."),
        "speech_1": (
            "I'm Matt Grant, running for Congress, and here's a simple truth: "
            "Washington keeps growing, and your paycheck doesn't. Working "
            "families {region_hook} stretch every dollar, while the federal "
            "government gets bigger, slower, and more expensive every single "
            "year. I'll change that — responsibly, not recklessly. My plan is a "
            "federal hiring freeze to stop the growth, and early-retirement "
            "packages to bring the workforce down fairly, without chaos. Step by "
            "step, government starts living within its means again, the way every "
            "family here already has to. Career politicians grow government. I'll "
            "trim it. On August 4th, vote Matt Grant for Congress."),
        "speech_3": (
            "Working families {region_hook} know how to live within a budget — "
            "they don't have a choice. Washington acts like the rules of math "
            "simply don't apply to it. That gap — between how carefully you "
            "manage your money and how carelessly Washington spends it — is a big "
            "reason I'm running for Congress.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. I look at "
            "the size and the cost of the federal government the way you'd look "
            "at a household budget that has quietly gotten out of control: "
            "something has to give, and pretending otherwise only makes it "
            "worse.\n\n"
            "Here's the problem, plainly. The federal government has grown "
            "bloated and expensive — not because of any single program, but "
            "because of decades of steady growth that nobody in Washington has "
            "had the will to stop. And every dollar of that growth comes from "
            "somewhere. It comes out of the paychecks of the families "
            "{region_hook} who are already stretched thin and doing everything "
            "right.\n\n"
            "My solution is to shrink Washington responsibly, not recklessly — "
            "and the distinction matters. A federal hiring freeze stops the "
            "growth before we can ever hope to reverse it. Early-retirement "
            "packages let us bring the size of the workforce down fairly, with "
            "respect for the people who've served, instead of throwing the whole "
            "system into chaos. Done steadily, step by step, government starts "
            "living within its means again.\n\n"
            "Career politicians grow government — it is the one thing they've all "
            "practiced their entire careers. I'll trim it, carefully and on "
            "purpose. On August 4th, vote Matt Grant for Congress, and let's "
            "build a government that finally respects your paycheck. Thank you."),
        "speech_5": (
            "There's a feeling a lot of people share {region_hook}, even if they "
            "don't always say it out loud: that no matter how carefully they "
            "manage their own money, Washington just keeps spending more of it. "
            "That feeling is completely justified, and doing something real about "
            "it is a big reason I'm running for Congress.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. I've spent "
            "my career solving real problems, and the size and cost of the "
            "federal government is exactly the kind of problem that does not fix "
            "itself. Left alone, it only grows.\n\n"
            "Let's name it honestly. The federal government has grown bloated and "
            "expensive. It's not one agency, and it's not one party — it's "
            "decades of steady growth that nobody in Washington has had the "
            "discipline to stop. New programs get added and old ones never go "
            "away. And the whole thing is paid for by working families "
            "{region_hook} who are already stretching every dollar they earn just "
            "to keep up.\n\n"
            "So here's what I'll do, and I want you to notice that every piece of "
            "it is responsible, not reckless. First, a federal hiring freeze. You "
            "stop the growth before you can ever begin to reverse it — that's "
            "just common sense. Second, early-retirement packages, so we bring "
            "the federal workforce down to a reasonable size the fair way, "
            "treating people who've served the country with respect instead of "
            "upending their lives. Third, we hold the line, year after year, so "
            "that government finally starts living within its means the same way "
            "every household in this district already does.\n\n"
            "The career politicians will tell you it can't be done. Of course "
            "they will — growing government is the only skill most of them have "
            "ever practiced. But families do hard budgeting every month, small "
            "businesses do it every quarter, and there is no reason on earth the "
            "most powerful government in the world can't do it too. It just takes "
            "someone willing to say no, and to mean it.\n\n"
            "And understand what's really at stake here. Every dollar Washington "
            "wastes on a government that's bigger than it needs to be is a dollar "
            "taken from a family {region_hook} that earned it — a dollar that "
            "could have gone to groceries, to a mortgage, to a child's future. "
            "That's why getting this right matters. A leaner government isn't an "
            "accounting exercise; it's a promise to the people footing the "
            "bill.\n\n"
            "This primary is August 4th. If you believe government ought to "
            "respect your paycheck instead of taking it for granted, I need your "
            "vote and your help at mattgrantforcongress.org. Let's build a "
            "leaner, more accountable government — together. Thank you."),
    },

    "lower-taxes": {
        "title": "Lower Taxes",
        "eyebrow": "Priority 4 · Let You Keep More of What You Earn",
        "core_message": ("Lower taxes by reducing fraud, waste, and the number "
                         "of government employees."),
        "micro": "Lower taxes by cutting waste.",
        "hook": "You work hard for your money. Washington wastes too much of it.",
        "one_liner": ("Matt Grant will fight for lower taxes — by cutting fraud, "
                      "waste, and the bloated federal payroll."),
        "problem": ("Families {region_hook} are squeezed, while Washington loses "
                    "money to fraud and waste."),
        "solution": ("Matt lowers taxes the honest way: by rooting out fraud, "
                     "cutting waste, and shrinking the number of government "
                     "employees — not by tricks."),
        "contrast": ("Insiders tax more and spend more. Matt will cut waste and "
                     "let you keep more of what you earn."),
        "story": ("Families {region_hook} feel the squeeze every month, while "
                  "Washington wastes money it never should have spent."),
        "speech_1": (
            "I'm Matt Grant, running for Congress, and I think you should keep "
            "more of what you earn. Families {region_hook} feel the squeeze every "
            "single month, while Washington loses staggering amounts to fraud and "
            "waste and then asks you to cover the difference. I'll lower taxes the "
            "honest way — by rooting out fraud, cutting the waste, and shrinking "
            "the bloated federal payroll, not by gimmicks or accounting tricks. "
            "The insiders' only plan is to tax more and spend more. Mine is to cut "
            "the waste first and respect the fact that it's your money. On August "
            "4th, vote Matt Grant for Congress."),
        "speech_3": (
            "Every family {region_hook} feels the same squeeze: the cost of "
            "everything keeps climbing, and a real chunk of what you earn "
            "disappears into a federal government that wastes more of it than it "
            "should. Doing something about that is why I'm running for "
            "Congress.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. And I have "
            "never believed that the right answer to a government that wastes your "
            "money is to send it even more of your money.\n\n"
            "Here's the problem. Washington loses staggering amounts to fraud and "
            "to plain waste every single year — and then it turns right around and "
            "asks taxpayers to cover the gap. The people who end up paying for "
            "that are the families {region_hook} who budget carefully, work hard, "
            "and play by the rules. They're covering the cost of failures they "
            "had nothing to do with.\n\n"
            "My solution is to lower taxes the honest way. Not gimmicks. Not "
            "accounting tricks. Discipline. We root out the fraud and recover "
            "what's being stolen. We cut the waste and the duplication — the "
            "programs that exist mostly to justify themselves. And we shrink the "
            "number of government employees so the federal payroll matches what "
            "the country actually needs. Do those three things, and we create "
            "real room to let you keep more of what you earn.\n\n"
            "The insiders have one move, and they run it every year: tax more, "
            "spend more, repeat. I won't play that game. I'll cut the waste "
            "first, because it's your money — you earned it. On August 4th, vote "
            "Matt Grant for Congress, and let's put your money back where it "
            "belongs. Thank you."),
        "speech_5": (
            "Sit down with just about any family {region_hook} and look at their "
            "budget, and you will see people doing everything right — working "
            "hard, spending carefully, making hard choices so the numbers add up. "
            "Then take a look at Washington's budget, and you'll see the exact "
            "opposite: money lost to fraud and waste on a scale that would put any "
            "household or any business under in a month. That contrast — between "
            "how you live and how Washington spends — is a big reason I'm running "
            "for Congress.\n\n"
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver. I have "
            "never believed that the answer to a government that wastes your money "
            "is to hand it even more of your money and hope for the best.\n\n"
            "Let's be clear about the problem. Every year, the federal government "
            "loses enormous sums — to outright fraud, and to plain, ordinary "
            "waste. And every year, instead of fixing it, Washington looks to "
            "taxpayers to make up the difference. The families {region_hook} who "
            "play by the rules end up paying for the failures of a system that "
            "doesn't. That is backwards. It has been allowed to go on for far too "
            "long, and both parties have let it happen.\n\n"
            "So here is how I'll lower your taxes — the honest way, not with "
            "gimmicks. First, we go after fraud aggressively and recover what's "
            "being stolen, dollar for dollar. Second, we cut the waste, the "
            "duplication, and the programs whose main accomplishment is "
            "justifying their own existence. And third, we shrink the number of "
            "government employees so the federal payroll reflects what the country "
            "actually needs, not what it has drifted into. Do those three things, "
            "and we create the room to let you keep more of what you earn — "
            "without tricks, and without pretending.\n\n"
            "The insiders have a much simpler plan, and they've run it for "
            "decades: tax more, spend more, and repeat it until no one's "
            "watching. I won't. I'll cut the waste first, every time, because I "
            "haven't forgotten whose money it is. It's yours.\n\n"
            "And let me tell you why this is personal for me. I'm a dad. I think "
            "about what kind of country my kids inherit — whether they'll be "
            "buried under the bills for waste they never voted for, or whether "
            "we'll finally have the discipline to fix it now. The families "
            "{region_hook} who do everything right deserve a government that "
            "treats their money with the same respect they do.\n\n"
            "This primary is August 4th. If you are tired of paying for "
            "Washington's waste, vote Matt Grant for Congress, and join us at "
            "mattgrantforcongress.org. Let's let Missouri families keep more of "
            "what they earn. Thank you."),
    },
}


# ----------------------------------------------------- short-tier builders
def _video_15(f):
    return f"{f['hook']} {f['one_liner']} {NAME_TAG}"


def _spot_30(f):
    return f"{f['hook']} {f['problem']} {f['solution']} {CTA_SHORT}"


def _spot_60(f):
    return (f"{f['story']} {f['problem']} {f['solution']} {f['contrast']} "
            f"{IDENTITY} {CTA_MED}")


def _social_x(f):
    # Hard 280-char cap; disclaimer counts toward the limit.
    return f"{f['one_liner']} Vote Aug 4 → mattgrantforcongress.org {DISC_FULL}"


def _social_sms(f):
    # Hard 160-char cap; abbreviated disclaimer.
    return f"{f['micro']} Vote Matt Grant for Congress Aug 4. {DISC_SMS}"


def _social_reel(f):
    return (f"{f['hook']} {f['solution']} {f['contrast']} Vote August 4th — "
            f"mattgrantforcongress.org. {DISC_FULL}")


def _door(f):
    return ("Hi, I'm a volunteer for Matt Grant for Congress. "
            f"{f['one_liner']} {f['problem']} {f['contrast']} Can Matt count on "
            "your vote on August 4th?")


def _phone(f):
    return ("Hi, this is a volunteer with Matt Grant for Congress — do you have "
            f"a quick moment? {f['hook']} {f['problem']} {f['solution']} On "
            "August 4th, can Matt count on your vote? Thank you so much for your "
            "time.")


def _text_p2p(f):
    # Hard 320-char cap; abbreviated disclaimer.
    return (f"Hi, it's the Matt Grant for Congress team. {f['micro']} Matt's on "
            f"the ballot Aug 4 — mattgrantforcongress.org. Can he count on you? "
            f"{DISC_SMS}")


_BUILDERS = {
    "video_15": _video_15,
    "video_30": _spot_30,
    "radio_30": _spot_30,
    "radio_60": _spot_60,
    "video_60": _spot_60,
    "social_x": _social_x,
    "social_sms": _social_sms,
    "social_reel": _social_reel,
    "door": _door,
    "phone": _phone,
    "text_p2p": _text_p2p,
}


def get_body(issue_key: str, tier_key: str) -> str:
    """Return the raw (un-localized) script body for an issue × tier.

    Speech tiers use authored bodies; all other tiers are assembled from the
    issue's fragments by the matching builder. Tokens are filled later by
    `geo.localize()`.
    """
    issue = ISSUES[issue_key]
    if tier_key in ("speech_1", "speech_3", "speech_5"):
        return issue[tier_key]
    builder = _BUILDERS[tier_key]
    return builder(issue)


def all_issue_keys():
    return list(ISSUES.keys())


if __name__ == "__main__":
    from sizing import size_stamp
    for ik in ISSUES:
        for tk in TIERS_BY_KEY:
            body = get_body(ik, tk).replace("{region_hook}", "across MO-02")
            print(f"{ik:<20}{tk:<12}{size_stamp(body, TIERS_BY_KEY[tk])}")
