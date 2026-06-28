#!/usr/bin/env python3
"""
Script sizing standard — the single source of truth for "how big is a script."

A campaign script can be sized three ways:
  • by run-time   (seconds / minutes)  — audio & video, and live speech
  • by word count (words)              — captions, voter-contact scripts
  • by characters (chars)              — character-capped channels (X, SMS)

This module defines the size *tiers*, the conversion baseline between words and
seconds, and a `check_length()` QA helper the generator uses to flag any script
that runs over or under its budget. Numbers track the conventions already in
`messaging/stump-speech-builder.md` (1/3/5-min speeches) and
`messaging/paid-media-planning.md` (:30 / :60 radio, :15–:30 video).

Conversion baseline:
  • ~140 spoken words per minute  (a deliberate, on-camera/on-air pace)
  • broadcast spots reserve ~6s for the spoken "stand by your ad" + "Paid for by"
    disclaimer, so the *copy* budget is the spot length minus that reserve.
"""

from dataclasses import dataclass

# Different deliveries fill time at different rates, so the word↔time budget is
# paced per family rather than with one global number:
#   • broadcast  ~150 wpm — tight, energetic VO/announcer reads
#   • speech     ~115 wpm — stump delivery, with pauses, emphasis, and applause
#   • voter-contact ~130 wpm — conversational at the door / on the phone
#   • social     ~140 wpm — only affects the est-seconds shown on captions
FAMILY_WPM = {"broadcast": 150, "speech": 105, "voter-contact": 130, "social": 140}
DEFAULT_WPM = 140
TOLERANCE = 0.20               # ±20% on a word/seconds target counts as "on size"


@dataclass(frozen=True)
class Tier:
    key: str                   # stable id, e.g. "radio_30"
    label: str                 # human label, e.g. ":30 Radio Spot"
    family: str                # broadcast | speech | social | voter-contact
    medium: str                # video | radio | speech | text
    metric: str                # "seconds" | "words" | "chars"
    target: int                # value in the metric's unit (seconds, words, or chars)
    spoken_disclaimer: bool = False   # candidate must speak the approval line
    onscreen_disclaimer: bool = False # "Paid for by…" must appear on screen
    reserve_seconds: int = 0          # run-time reserved for the spoken disclaimer
    note: str = ""             # production guidance shown on the script page


# --------------------------------------------------------------------- tiers
TIERS = [
    # ---- Broadcast spots (audio / video, sized by seconds) ----------------
    Tier("video_15", ":15 Video Spot", "broadcast", "video", "seconds", 15,
         onscreen_disclaimer=True, reserve_seconds=3,
         note="Disclaimer can be the final 4s frame; approval as on-screen text + VO."),
    Tier("video_30", ":30 Video Spot", "broadcast", "video", "seconds", 30,
         spoken_disclaimer=True, onscreen_disclaimer=True, reserve_seconds=6,
         note="Lower-third 'Paid for by…' ≥4s; candidate on camera for the approval line."),
    Tier("radio_30", ":30 Radio Spot", "broadcast", "radio", "seconds", 30,
         spoken_disclaimer=True, reserve_seconds=6,
         note="Spoken disclaimer runs ~5–8s; record the candidate approval line in studio."),
    Tier("radio_60", ":60 Radio Spot", "broadcast", "radio", "seconds", 60,
         spoken_disclaimer=True, reserve_seconds=6,
         note="60s allows a fuller story; same spoken approval + 'Paid for by' close."),
    Tier("video_60", ":60 Video Spot", "broadcast", "video", "seconds", 60,
         spoken_disclaimer=True, onscreen_disclaimer=True, reserve_seconds=6,
         note="Bio/intro length; on-screen 'Paid for by…' ≥4s + spoken approval."),

    # ---- Stump speech segments (live, sized by minutes) -------------------
    Tier("speech_1", "1-Minute Speech Block", "speech", "speech", "seconds", 60,
         note="Elevator/forum length: hook → why → one issue → ask."),
    Tier("speech_3", "3-Minute Speech Block", "speech", "speech", "seconds", 180,
         note="Forum/panel length: hook → why → issue (problem→solution→contrast) → ask."),
    Tier("speech_5", "5-Minute Stump Block", "speech", "speech", "seconds", 300,
         note="Workhorse stump treatment of one issue with a human story."),

    # ---- Social / digital captions (sized by chars or words) -------------
    Tier("social_x", "X / Twitter Post", "social", "text", "chars", 280,
         onscreen_disclaimer=True,
         note="≤280 chars including the 'Paid for by' tag; hard character cap."),
    Tier("social_sms", "SMS / Broadcast Text", "social", "text", "chars", 160,
         onscreen_disclaimer=True,
         note="≤160 chars; uses the abbreviated 'Pd for by' disclaimer + STOP."),
    Tier("social_reel", "Reel / TikTok Caption", "social", "text", "words", 65,
         onscreen_disclaimer=True,
         note="50–80 word caption for short vertical video; 'Paid for by' in copy."),

    # ---- Voter-contact scripts (sized by words or chars) -----------------
    Tier("door", "Door-Knock Script", "voter-contact", "speech", "words", 80,
         note="~45–60s at the door: intro → ID/issue → ask. No disclaimer required."),
    Tier("phone", "Phone-Bank Script", "voter-contact", "speech", "words", 95,
         note="Phone canvass: intro → issue pivot → ask → close."),
    Tier("text_p2p", "Peer-to-Peer Text", "voter-contact", "text", "chars", 320,
         onscreen_disclaimer=True,
         note="Opening P2P text; ≤320 chars including 'Pd for by' + STOP."),
]

TIERS_BY_KEY = {t.key: t for t in TIERS}
FAMILIES = ["broadcast", "speech", "social", "voter-contact"]


# ------------------------------------------------------------- conversions
def words_per_sec(tier: Tier) -> float:
    return FAMILY_WPM.get(tier.family, DEFAULT_WPM) / 60.0


def count_words(text: str) -> int:
    return len(text.split())


def count_chars(text: str) -> int:
    return len(text)


def words_to_seconds(words: int, tier: Tier) -> float:
    return words / words_per_sec(tier)


def seconds_to_words(seconds: float, tier: Tier) -> int:
    return int(round(seconds * words_per_sec(tier)))


def target_words(tier: Tier) -> int:
    """The word budget for a tier, accounting for any disclaimer time reserve."""
    if tier.metric == "seconds":
        return seconds_to_words(tier.target - tier.reserve_seconds, tier)
    if tier.metric == "words":
        return tier.target
    # chars metric — approximate words for display only (~6 chars/word incl. space)
    return max(1, tier.target // 6)


# --------------------------------------------------------------- QA helper
def check_length(text: str, tier: Tier) -> dict:
    """Measure a script body against its tier budget.

    Returns a dict with the measured words/chars/seconds, the budget, and a
    status of 'ok' | 'over' | 'under'. For seconds-metric tiers the budget is
    the *copy* budget (spot length minus disclaimer reserve). For chars-metric
    tiers the target is a hard maximum, so only 'over' fails.
    """
    words = count_words(text)
    chars = count_chars(text)
    est_seconds = words_to_seconds(words, tier)

    if tier.metric == "chars":
        budget = tier.target
        status = "over" if chars > budget else "ok"
        return {"words": words, "chars": chars, "est_seconds": round(est_seconds, 1),
                "metric": "chars", "budget": budget, "measured": chars, "status": status}

    if tier.metric == "words":
        budget = tier.target
        measured = words
    else:  # seconds
        budget = tier.target - tier.reserve_seconds
        measured = est_seconds

    lo, hi = budget * (1 - TOLERANCE), budget * (1 + TOLERANCE)
    status = "under" if measured < lo else "over" if measured > hi else "ok"
    return {"words": words, "chars": chars, "est_seconds": round(est_seconds, 1),
            "metric": tier.metric, "budget": round(budget, 1),
            "measured": round(measured, 1), "status": status}


def size_stamp(text: str, tier: Tier) -> str:
    """A short human stamp for the script page, e.g.
    '≈ 68 words · ~29s of copy · :30 spot (copy budget ~24s) — on size'."""
    r = check_length(text, tier)
    flag = {"ok": "on size", "over": "RUNS LONG", "under": "runs short"}[r["status"]]
    if tier.metric == "chars":
        return f"{r['chars']} characters / {r['words']} words — limit {tier.target} — {flag}"
    if tier.metric == "words":
        return f"≈ {r['words']} words (~{r['est_seconds']}s) — target {tier.target} words — {flag}"
    # seconds
    return (f"≈ {r['words']} words / ~{r['est_seconds']}s of copy — "
            f"{tier.label} (copy budget ~{r['budget']}s) — {flag}")


if __name__ == "__main__":
    # Tiny self-check / reference dump.
    print(f"{'TIER':<14}{'FAMILY':<14}{'METRIC':<9}{'TARGET':<8}{'WORD BUDGET'}")
    for t in TIERS:
        print(f"{t.key:<14}{t.family:<14}{t.metric:<9}{t.target:<8}{target_words(t)}")
