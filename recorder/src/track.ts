import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const RATE = 48_000;
const BYTES_PER_FRAME = 2; // mono s16le
const SILENCE_GAP = RATE / 10; // pad gaps longer than 100 ms

/**
 * One speaker's audio. Decoded PCM is downmixed to mono and piped into ffmpeg, which writes a small Opus file
 * as we go (so a long recording doesn't fill the disk). Silence is inserted for the time they weren't talking,
 * so every speaker's file lines up with the start of the recording.
 */
export class Track {
  private ff: ChildProcessWithoutNullStreams;
  private written = 0; // frames written so far
  private done: Promise<number>;
  bytesIn = 0;

  constructor(
    readonly userId: string,
    readonly name: string,
    readonly file: string,
    private readonly startedAt: number,
  ) {
    this.ff = spawn(ffmpegPath as unknown as string, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "s16le",
      "-ar",
      String(RATE),
      "-ac",
      "1",
      "-i",
      "pipe:0",
      "-c:a",
      "libopus",
      "-b:a",
      "48k",
      "-application",
      "voip",
      "-y",
      file,
    ]);
    this.ff.stderr.on("data", (d) => console.error(`[track ${name}] ${String(d).trim()}`));
    this.ff.stdin.on("error", () => {});
    this.done = new Promise((resolve) => this.ff.on("close", (code) => resolve(code ?? 0)));
  }

  /** `stereo` is interleaved 48 kHz s16le from the Opus decoder. */
  push(stereo: Buffer, now = Date.now()) {
    const frames = stereo.length / 4;
    const expectedStart = Math.round(((now - this.startedAt) / 1000) * RATE) - frames;
    if (expectedStart - this.written > SILENCE_GAP) this.silence(expectedStart - this.written);
    const mono = Buffer.allocUnsafe(frames * BYTES_PER_FRAME);
    for (let i = 0; i < frames; i++) {
      mono.writeInt16LE((stereo.readInt16LE(i * 4) + stereo.readInt16LE(i * 4 + 2)) >> 1, i * 2);
    }
    this.ff.stdin.write(mono);
    this.written += frames;
    this.bytesIn += stereo.length;
  }

  private silence(frames: number) {
    const chunk = Buffer.alloc(RATE * BYTES_PER_FRAME); // 1 s
    let left = frames;
    while (left > 0) {
      const n = Math.min(left, RATE);
      this.ff.stdin.write(n === RATE ? chunk : chunk.subarray(0, n * BYTES_PER_FRAME));
      left -= n;
    }
    this.written += frames;
  }

  get seconds() {
    return this.written / RATE;
  }

  /** Closes the file. Resolves once ffmpeg has finished writing it. */
  async finish() {
    this.ff.stdin.end();
    return this.done;
  }
}
