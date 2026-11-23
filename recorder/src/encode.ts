import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const BITRATE = 48_000;

function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(ffmpegPath as unknown as string, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    let err = "";
    ff.stderr.on("data", (d) => (err += d));
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`))));
  });
}

/** Seconds per part so each file stays under Discord's upload limit. */
export const partSeconds = (limitBytes: number) => Math.max(60, Math.floor((limitBytes * 0.85 * 8) / BITRATE));

const segmentArgs = (seconds: number) => ["-c:a", "libopus", "-b:a", "48k", "-application", "voip", "-f", "segment", "-segment_time", String(seconds), "-reset_timestamps", "1"];

async function outputs(dir: string, prefix: string) {
  return (await readdir(dir)).filter((f) => f.startsWith(prefix) && f.endsWith(".ogg")).sort().map((f) => path.join(dir, f));
}

/** Everyone mixed together, split into parts. */
export async function mixTracks(files: string[], outDir: string, seconds: number) {
  if (!files.length) return [];
  const inputs = files.flatMap((f) => ["-i", f]);
  const filter =
    files.length === 1
      ? ["-af", "alimiter=limit=0.95"]
      : ["-filter_complex", `${files.map((_, i) => `[${i}:a]`).join("")}amix=inputs=${files.length}:duration=longest:normalize=0,alimiter=limit=0.95`];
  await run([...inputs, ...filter, ...segmentArgs(seconds), path.join(outDir, "everyone_%02d.ogg")]);
  return outputs(outDir, "everyone_");
}

/** One speaker's file, split into parts. */
export async function splitTrack(file: string, outDir: string, label: string, seconds: number) {
  await run(["-i", file, ...segmentArgs(seconds), path.join(outDir, `${label}_%02d.ogg`)]);
  return outputs(outDir, `${label}_`);
}
