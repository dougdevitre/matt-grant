import { spawn } from "node:child_process";
import { writeFile, readFile, mkdtemp, rm, chmod, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Render a still graphic into a short vertical MP4 for YouTube Shorts. YouTube has
// no image-post API (only videos.insert), so the composer's /api/graphics PNG is
// held for a few seconds, scaled/padded to 1080×1920, and encoded H.264 + silent
// AAC using a static ffmpeg binary (a child process). Returns the MP4 bytes for a
// resumable upload.
//
// WHERE FFMPEG COMES FROM (the binary is NOT bundled — it would blow the Amplify SSR
// compute's hard 220 MiB cap):
//   1. Local + tests: the @ffmpeg-installer package, loaded via a COMPUTED specifier
//      so the bundler/tracer can't see it (stays out of the deployed function).
//   2. In the deployed function: that package isn't present, so we fetch a static
//      linux ffmpeg from S3 (s3://$S3_ASSETS_BUCKET/bin/ffmpeg-linux-x64) into /tmp
//      once and reuse it across warm invocations (~2-3s on a cold render only).
// If neither resolves, render throws a clear "unavailable" error (publish.ts already
// catches render failures, so the social pipeline degrades cleanly).

export const SHORT_SECONDS = 7;

const FFMPEG_TMP_PATH = path.join(tmpdir(), "ffmpeg");
const FFMPEG_S3_KEY = process.env.FFMPEG_S3_KEY || "bin/ffmpeg-linux-x64";

let ffmpegPathCache: string | undefined; // set only once resolved (success)

async function localFfmpeg(): Promise<string | null> {
  try {
    const spec = ["@ffmpeg-installer", "ffmpeg"].join("/"); // computed → not statically traced/bundled
    const mod = (await import(/* webpackIgnore: true */ spec)) as { default?: { path?: string }; path?: string };
    return mod.default?.path ?? mod.path ?? null;
  } catch {
    return null; // not installed in this deployment
  }
}

// Fetch the static ffmpeg binary from S3 into /tmp once per warm container.
async function ffmpegFromS3(): Promise<string | null> {
  const bucket = process.env.S3_ASSETS_BUCKET;
  if (!bucket) return null;
  try {
    const existing = await stat(FFMPEG_TMP_PATH).catch(() => null);
    if (existing && existing.size > 0) return FFMPEG_TMP_PATH; // already pulled this container
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: FFMPEG_S3_KEY }));
    if (!out.Body) return null;
    await pipeline(out.Body as NodeJS.ReadableStream, createWriteStream(FFMPEG_TMP_PATH));
    await chmod(FFMPEG_TMP_PATH, 0o755);
    return FFMPEG_TMP_PATH;
  } catch {
    return null; // S3 miss / no perms — render reports unavailable, doesn't crash
  }
}

async function ffmpegPath(): Promise<string | null> {
  if (ffmpegPathCache) return ffmpegPathCache;
  const local = await localFfmpeg();
  if (local) return (ffmpegPathCache = local);
  const fromS3 = await ffmpegFromS3();
  if (fromS3) return (ffmpegPathCache = fromS3);
  return null; // not cached → retried on the next render (e.g. transient S3 error)
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
