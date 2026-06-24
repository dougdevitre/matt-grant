import { describe, it, expect } from "vitest";
import { extractTextFromMime, parseSesNotification } from "./mime";

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("extractTextFromMime", () => {
  it("returns a plain singlepart body", () => {
    const raw = ["Content-Type: text/plain; charset=UTF-8", "", "Rally at the square, noon."].join("\n");
    expect(extractTextFromMime(raw)).toBe("Rally at the square, noon.");
  });

  it("decodes base64 transfer encoding", () => {
    const raw = ["Content-Type: text/plain", "Content-Transfer-Encoding: base64", "", b64("Town hall Tuesday")].join("\n");
    expect(extractTextFromMime(raw)).toBe("Town hall Tuesday");
  });

  it("decodes quoted-printable (incl. UTF-8 and soft breaks)", () => {
    const raw = [
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Caf=C3=A9 meet 5=2D6pm with a long line that wraps=",
      "onto the next line",
    ].join("\n");
    expect(extractTextFromMime(raw)).toBe("Café meet 5-6pm with a long line that wrapsonto the next line");
  });

  it("prefers the text/plain part of multipart/alternative", () => {
    const raw = [
      'Content-Type: multipart/alternative; boundary="XYZ"',
      "",
      "--XYZ",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "Plain: canvass Saturday 10am",
      "--XYZ",
      "Content-Type: text/html; charset=UTF-8",
      "",
      "<p>HTML version</p>",
      "--XYZ--",
      "",
    ].join("\n");
    expect(extractTextFromMime(raw)).toBe("Plain: canvass Saturday 10am");
  });

  it("falls back to stripped HTML when there is no text/plain part", () => {
    const raw = [
      'Content-Type: multipart/alternative; boundary="B"',
      "",
      "--B",
      "Content-Type: text/html; charset=UTF-8",
      "",
      "<p>Town hall</p><p>Tuesday &amp; Friday</p>",
      "--B--",
      "",
    ].join("\n");
    expect(extractTextFromMime(raw)).toBe("Town hall\nTuesday & Friday");
  });
});

describe("parseSesNotification", () => {
  it("uses commonHeaders for from/subject and MIME-parses base64 content", () => {
    const rawMime = ["Content-Type: text/plain", "", "Doors at 6, program at 7."].join("\n");
    const msg = {
      notificationType: "Received",
      mail: { source: "bounce@x.com", commonHeaders: { from: ["Jane Doe <jane@x.com>"], subject: "Fundraiser!" } },
      content: b64(rawMime),
    };
    const r = parseSesNotification(msg)!;
    expect(r.from).toBe("Jane Doe <jane@x.com>");
    expect(r.subject).toBe("Fundraiser!");
    expect(r.text).toBe("Doors at 6, program at 7.");
  });

  it("handles raw (non-base64) content too", () => {
    const msg = {
      mail: { commonHeaders: { subject: "Hi" } },
      content: ["Content-Type: text/plain", "", "Plain inline body"].join("\n"),
    };
    expect(parseSesNotification(msg)!.text).toBe("Plain inline body");
  });

  it("returns null when there is no mail object", () => {
    expect(parseSesNotification({})).toBeNull();
  });
});
