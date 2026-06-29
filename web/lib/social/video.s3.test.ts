import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";

// Exercises the PRODUCTION ffmpeg resolution path: in the deployed Amplify SSR
// function the @ffmpeg-installer package isn't present (it's kept off the bundle),
// so video.ts must fetch a static linux ffmpeg from S3 into /tmp and run THAT. The
// sibling video.test.ts covers the local-installer path; this file forces the
// installer import to fail so the S3 fallback is the one under test.

// 1. Make the computed `@ffmpeg-installer/ffmpeg` import throw → localFfmpeg() = null.
vi.mock("@ffmpeg-installer/ffmpeg", () => {
  throw new Error("not installed in this deployment");
});

// 2. Capture the binary spawn so we can assert WHICH ffmpeg path got run.
const spawnMock = vi.hoisted(() => ({ exitCode: 0 as number, lastBin: "" }));
vi.mock("node:child_process", () => ({
  spawn: vi.fn((bin: string) => {
    spawnMock.lastBin = bin;
    const handlers: Record<string, (arg?: unknown) => void> = {};
    const proc = {
      stderr: { on: () => {} },
      on: (ev: string, cb: (arg?: unknown) => void) => {
        handlers[ev] = cb;
        return proc;
      },
    };
    queueMicrotask(() => handlers.close?.(spawnMock.exitCode));
    return proc;
  }),
}));

// 3. fs: no cached binary yet (stat rejects), and the render's own temp I/O.
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn(async () => "/tmp/yt-short-mock"),
  writeFile: vi.fn(async () => {}),
  readFile: vi.fn(async () => Buffer.from("FAKEMP4")),
  rm: vi.fn(async () => {}),
  stat: vi.fn(async () => {
    throw new Error("ENOENT"); // binary not yet fetched into /tmp this container
  }),
  chmod: vi.fn(async () => {}),
}));
vi.mock("node:fs", () => ({ createWriteStream: vi.fn(() => ({})) }));
vi.mock("node:stream/promises", () => ({ pipeline: vi.fn(async () => {}) }));

// 4. S3 returns a Body so the download path completes and chmods the binary.
const s3SendMock = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = s3SendMock.fn;
  },
  GetObjectCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { renderStillToMp4 } from "@/lib/social/video";

beforeEach(() => {
  spawnMock.exitCode = 0;
  process.env.S3_ASSETS_BUCKET = "matt-grant-for-congress";
  s3SendMock.fn.mockResolvedValue({ Body: { pipe: () => {} } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response));
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.S3_ASSETS_BUCKET;
});

describe("renderStillToMp4 — ffmpeg-from-S3 fallback (deployed path)", () => {
  // video.ts caches the resolved binary path in module scope, and only ON SUCCESS.
  // Run the no-bucket (failure → no cache write) case FIRST so it can't read a path
  // the success case below would otherwise have cached. Order matters here.
  it("reports render unavailable (degrades cleanly) when no bucket is configured", async () => {
    delete process.env.S3_ASSETS_BUCKET;
    await expect(renderStillToMp4("https://cdn.example.com/still.png")).rejects.toThrow(/unavailable in this deployment/);
  });

  it("fetches the static binary from S3 into /tmp and runs that, not the installer", async () => {
    const out = await renderStillToMp4("https://cdn.example.com/still.png");
    expect(out.toString()).toBe("FAKEMP4");
    // The binary it ran is the /tmp copy pulled from S3, not an installer path.
    expect(spawnMock.lastBin).toBe(path.join(tmpdir(), "ffmpeg"));
    expect(s3SendMock.fn).toHaveBeenCalledTimes(1);
  });
});
