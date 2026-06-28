import { spawn } from "node:child_process";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Render a still graphic into a short vertical MP4 for YouTube Shorts. YouTube has
// no image-post API (only videos.insert), so the composer's /api/graphics PNG is
// held for a few seconds, scaled/padded to 1080×1920, and encoded H.264 + silent
// AAC using a static ffmpeg binary (a child process). Returns the MP4 bytes for a
// resumable upload.
//
// BUNDLE NOTE: the ffmpeg binary is ~35 MB and was pushing the Amplify SSR compute
// bundle past its hard 220 MiB cap (deploys were failing). We now load it LAZILY via
// a COMPUTED specifier so the bundler/tracer can't see it — the binary stays OUT of
// the deployed function. It still resolves from node_modules locally + in tests; in
// the deployed function it's intentionally absent, so render reports a clear
// "unavailable" error (callers in publish.ts already catch render failures). The
// durable fix is to move rendering to a dedicated Lambda / AWS MediaConvert — tracked
// as a follow-up so this feature comes back without the bundle cost.

export const SHORT_SECONDS = 7;

let ffmpegPathCache: string | null | undefined;
async function ffmpegPath(): Promise<string | null> {
  if (ffmpegPathCache !== undefined) return ffmpegPathCache;
  try {
    const spec = ["@ffmpeg-installer", "ffmpeg"].join("/"); // computed → not statically traced/bundled
    const mod = (await import(/* webpackIgnore: true */ spec)) as { default?: { path?: string }; path?: string };
    ffmpegPathCache = mod.default?.path ?? mod.path ?? null;
  } catch {
    ffmpegPathCache = null; // not bundled in this deployment → feature unavailable
  }
  return ffmpegPathCache;
}

/** Build the ffmpeg args that turn a still into a held vertical Short. Exported for tests. */
export function ffmpegArgs(inPath: string, outPath: string, seconds = SHORT_SECONDS): string[] {
  return [
    "-loop", "1", "-i", inPath,
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t", String(seconds),
    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-c:v", "libx264", "-r", "30", "-c:a", "aac", "-shortest", "-movflags", "+faststart",
    "-y", outPath,
  ];
}

async function runFfmpeg(args: string[]): Promise<void> {
  const bin = await ffmpegPath();
  if (!bin) {
    throw new Error("video rendering is unavailable in this deployment (ffmpeg binary not bundled)");
  }
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += String(d)));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))));
  });
}

/** Fetch a still image by URL and render it to an in-memory MP4 Short. */
export async function renderStillToMp4(imageUrl: string, seconds = SHORT_SECONDS): Promise<Buffer> {
  const img = await fetch(imageUrl);
  if (!img.ok) throw new Error(`could not fetch image (${img.status})`);
  const bytes = Buffer.from(await img.arrayBuffer());

  const dir = await mkdtemp(path.join(tmpdir(), "yt-short-"));
  const inPath = path.join(dir, "still.png");
  const outPath = path.join(dir, "short.mp4");
  try {
    await writeFile(inPath, bytes);
    await runFfmpeg(ffmpegArgs(inPath, outPath, seconds));
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
