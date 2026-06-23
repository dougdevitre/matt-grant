import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the static ffmpeg binary, the child process, and fs so renderStillToMp4 is
// exercised without actually encoding video in CI.
vi.mock("@ffmpeg-installer/ffmpeg", () => ({ default: { path: "/bin/ffmpeg", version: "x", url: "u" } }));

const spawnMock = vi.hoisted(() => ({ exitCode: 0 as number, lastArgs: [] as string[], lastBin: "" }));
vi.mock("node:child_process", () => ({
  spawn: vi.fn((bin: string, args: string[]) => {
    spawnMock.lastBin = bin;
    spawnMock.lastArgs = args;
    const handlers: Record<string, (arg?: unknown) => void> = {};
    const proc = {
      stderr: { on: () => {} },
      on: (ev: string, cb: (arg?: unknown) => void) => {
        handlers[ev] = cb;
        return proc;
      },
    };
    queueMicrotask(() => handlers.close?.(spawnMock.exitCode)); // fire after .on() registers
    return proc;
  }),
}));
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn(async () => "/tmp/yt-short-mock"),
  writeFile: vi.fn(async () => {}),
  readFile: vi.fn(async () => Buffer.from("FAKEMP4")),
  rm: vi.fn(async () => {}),
}));

import { ffmpegArgs, renderStillToMp4 } from "@/lib/social/video";

beforeEach(() => {
  spawnMock.exitCode = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("ffmpegArgs", () => {
  it("builds a 1080×1920 held-still Short with silent audio", () => {
    const args = ffmpegArgs("/tmp/in.png", "/tmp/out.mp4", 7).join(" ");
    expect(args).toContain("-loop 1");
    expect(args).toContain("anullsrc"); // silent audio track
    expect(args).toContain("scale=1080:1920");
    expect(args).toContain("libx264");
    expect(args).toContain("-t 7");
    expect(args).toMatch(/\/tmp\/out\.mp4$/);
  });
});

describe("renderStillToMp4", () => {
  it("fetches the still, runs ffmpeg, and returns the encoded bytes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response));
    const out = await renderStillToMp4("https://cdn.example.com/still.png");
    expect(out.toString()).toBe("FAKEMP4");
    expect(spawnMock.lastBin).toBe("/bin/ffmpeg");
    expect(spawnMock.lastArgs).toContain("/tmp/yt-short-mock/short.mp4");
  });

  it("throws when the still can't be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 } as unknown as Response));
    await expect(renderStillToMp4("https://cdn.example.com/missing.png")).rejects.toThrow(/could not fetch image/);
  });

  it("rejects when ffmpeg exits non-zero", async () => {
    spawnMock.exitCode = 1;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response));
    await expect(renderStillToMp4("https://cdn.example.com/still.png")).rejects.toThrow(/ffmpeg exited 1/);
  });
});
