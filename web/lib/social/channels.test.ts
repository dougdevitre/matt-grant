import { describe, it, expect } from "vitest";
import { renderChannelText, composeText, toChannelIds, CHANNELS } from "@/lib/social/channels";
import { CAMPAIGN } from "@/lib/site";

const DISC = CAMPAIGN.paidForBy; // "Paid for by Matt Grant for Congress."

describe("renderChannelText", () => {
  const post = {
    caption: "Early voting is open. Make your plan to vote.",
    hashtags: ["MO02", "Vote"],
    link: "https://mattgrantforcongress.org/vote",
    cta: "Vote August 4",
  };

  it("assembles caption + CTA + hashtags + link + disclaimer, in order", () => {
    const r = renderChannelText(post, "facebook");
    expect(r.text).toContain(post.caption);
    expect(r.text).toContain("#MO02 #Vote");
    expect(r.text).toContain(post.link);
    expect(r.text.endsWith(DISC)).toBe(true); // disclaimer always last
    expect(r.fitted).toBe(false);
  });

  it("ALWAYS includes the disclaimer, even when the post is tiny", () => {
    const r = renderChannelText({ caption: "Vote.", hashtags: [], link: "" }, "x");
    expect(r.text).toContain(DISC);
  });

  it("never lets the disclaimer be trimmed — caption gives way first on X's 280", () => {
    const long = { caption: "word ".repeat(120).trim(), hashtags: ["a", "b", "c"], link: "https://x.co/y", cta: "Vote now" };
    const r = renderChannelText(long, "x");
    expect(r.chars).toBeLessThanOrEqual(CHANNELS.x.maxChars);
    expect(r.text).toContain(DISC); // compliance survives the fit
    expect(r.text).toContain("https://x.co/y"); // link survives too
    expect(r.fitted).toBe(true);
    expect(r.text).toMatch(/\.\.\.\n/); // caption was word-truncated with an ellipsis
  });

  it("drops hashtags from the end before truncating the caption", () => {
    // A caption that fits once a couple hashtags are dropped keeps the caption whole.
    const caption = "a".repeat(230);
    const r = renderChannelText({ caption, hashtags: ["one", "two", "three", "four"], link: "" }, "x");
    expect(r.chars).toBeLessThanOrEqual(280);
    expect(r.droppedHashtags).toBeGreaterThan(0);
    expect(r.text).toContain(caption); // caption intact; hashtags absorbed the overflow
  });

  it("caps hashtags to the channel maximum (Threads = 1)", () => {
    const r = renderChannelText({ caption: "Hi", hashtags: ["a", "b", "c"], link: "" }, "threads");
    expect((r.text.match(/#/g) ?? []).length).toBe(1);
    expect(r.droppedHashtags).toBe(2);
  });

  it("omits the link on Instagram and notes link-in-bio", () => {
    const r = renderChannelText(post, "instagram");
    expect(r.text).not.toContain(post.link);
    expect(r.notes.some((n) => /bio/i.test(n))).toBe(true);
    expect(r.text).toContain(DISC);
  });

  it("does not double-inject a CTA the caption already makes", () => {
    const r = renderChannelText({ caption: "Please Vote on August 4.", hashtags: [], link: "", cta: "Vote" }, "facebook");
    // "Vote" appears in the caption; the CTA line shouldn't repeat it as a separate block.
    const blocks = r.text.split("\n\n");
    expect(blocks.filter((b) => b.trim() === "Vote").length).toBe(0);
  });

  it("injects the CTA as its own line when the caption doesn't cover it", () => {
    const r = renderChannelText({ caption: "Big news this week.", hashtags: [], link: "", cta: "RSVP at the town hall" }, "facebook");
    expect(r.text).toContain("RSVP at the town hall");
  });

  it("is deterministic", () => {
    expect(renderChannelText(post, "linkedin").text).toBe(renderChannelText(post, "linkedin").text);
  });
});

describe("composeText (unchanged legacy helper)", () => {
  it("joins caption and hashtags with a blank line", () => {
    expect(composeText("Hello", [])).toBe("Hello");
    expect(composeText("Hello", ["#MO02"])).toBe("Hello\n\n#MO02");
    expect(composeText("Hi", ["MO02"])).toBe("Hi\n\n#MO02"); // adds the #
  });
});

describe("toChannelIds", () => {
  it("maps legacy display names and drops unknowns", () => {
    expect(toChannelIds(["X", "Facebook", "Instagram", "nope"])).toEqual(["x", "facebook", "instagram"]);
  });
});
