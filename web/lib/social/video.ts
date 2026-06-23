import { spawn } from "node:child_process";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

// Render a still graphic into a short vertical MP4 for YouTube Shorts. YouTube has
// no image-post API (only videos.insert), so the composer's /api/graphics PNG is
// held for a few seconds, scaled/padded to 1080×1920, and encoded H.264 + silent
// AAC using the bundled static ffmpeg binary (a child process). Returns the MP4
// bytes for a resumable upload.
//
// Operational note: ffmpeg adds bundle/cold-start/`/tmp` weight to the Amplify SSR
// Lambda. A single-still encode is light (~1–3s). If bundle limits bite, move this
// to a dedicated render Lambda or AWS MediaConvert (out of scope here).

export const SHORT_SECONDS = 7;

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

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg.path, args, { stdio: ["ignore", "ignore", "pipe"] });
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
