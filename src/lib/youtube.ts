import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || "./downloads";

export class RejectError extends Error {}

export type Meta = {
  youtubeId: string;
  title: string;
  channel: string;
  durationSec: number;
  thumbnail?: string;
};

const GRADIENTS = [
  "linear-gradient(135deg,#ff6b00,#e0448a)",
  "linear-gradient(135deg,#0099a8,#00c2b0)",
  "linear-gradient(135deg,#c77dff,#7b2ff7)",
  "linear-gradient(135deg,#ffb03a,#ff6b00)",
  "linear-gradient(135deg,#5ec6d2,#0099a8)",
];
export function gradientFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h + ch.charCodeAt(0)) % GRADIENTS.length;
  return GRADIENTS[h];
}

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("yt-dlp", args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", (e) => resolve({ code: -1, stdout, stderr: stderr + String(e) }));
    p.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

// Extract an 11-char video id from a YouTube URL, or flag a playlist-only URL.
function parseYouTube(input: string): { videoId?: string; isPlaylistOnly?: boolean } {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return { videoId: s };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return {};
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return { videoId: u.pathname.slice(1, 12) || undefined };
  if (host.endsWith("youtube.com")) {
    const v = u.searchParams.get("v");
    if (v) return { videoId: v };
    if (u.pathname.startsWith("/shorts/")) return { videoId: u.pathname.split("/")[2] };
    if (u.pathname === "/playlist" || u.searchParams.get("list")) return { isPlaylistOnly: true };
  }
  return {};
}

// Resolve free-text or a URL to a single validated video's metadata.
export async function resolve(input: string): Promise<Meta> {
  const parsed = parseYouTube(input);
  if (parsed.isPlaylistOnly) {
    throw new RejectError("Playlist is currently not supported. Please choose a single video.");
  }

  const target = parsed.videoId ? parsed.videoId : `ytsearch1:${input.trim()}`;
  const { code, stdout, stderr } = await run(["-J", "--no-playlist", target]);
  if (code !== 0 || !stdout.trim()) {
    if (/private|unavailable|deleted|removed/i.test(stderr)) {
      throw new RejectError("This video is unavailable (private, deleted, or region-blocked).");
    }
    throw new RejectError("Could not find or read that video. Try another link or search.");
  }

  let j: any;
  try {
    j = JSON.parse(stdout.trim().split("\n").pop() as string);
  } catch {
    throw new RejectError("Unexpected response from YouTube. Try again.");
  }
  // Search returns a playlist wrapper; take the first entry.
  if (j._type === "playlist" && Array.isArray(j.entries)) j = j.entries[0];
  if (!j) throw new RejectError(`No matches — try another title.`);

  if (j.is_live || j.live_status === "is_live") throw new RejectError("Live streams are not supported.");
  if (j.duration == null) throw new RejectError("This item has no playable duration (live or unavailable).");

  return {
    youtubeId: j.id,
    title: j.title ?? "Untitled",
    channel: j.channel ?? j.uploader ?? "YouTube",
    durationSec: Math.round(j.duration),
    thumbnail: j.thumbnail,
  };
}

export type SearchResult = Meta;

// Realtime search (debounced client-side). Uses ytsearch — no API key needed.
export async function search(query: string, limit = 5): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { code, stdout } = await run(["-J", "--flat-playlist", `ytsearch${limit}:${q}`]);
  if (code !== 0 || !stdout.trim()) return [];
  let j: any;
  try {
    j = JSON.parse(stdout.trim());
  } catch {
    return [];
  }
  const entries: any[] = j.entries ?? [];
  return entries
    .filter((e) => e && e.id && e.duration != null)
    .map((e) => ({
      youtubeId: e.id,
      title: e.title ?? "Untitled",
      channel: e.channel ?? e.uploader ?? "YouTube",
      durationSec: Math.round(e.duration),
      thumbnail: e.thumbnails?.[0]?.url,
    }));
}

// Download + extract audio to <DOWNLOAD_DIR>/<id>.mp3, reporting 0-100 progress.
export function download(
  youtubeId: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  const outTpl = join(DOWNLOAD_DIR, "%(id)s.%(ext)s");
  const finalPath = join(DOWNLOAD_DIR, `${youtubeId}.mp3`);
  return new Promise((resolve, reject) => {
    const p = spawn(
      "yt-dlp",
      ["-x", "--audio-format", "mp3", "--no-playlist", "--newline", "-o", outTpl, youtubeId],
      { windowsHide: true },
    );
    let stderr = "";
    p.stdout.on("data", (d) => {
      const m = /\[download\]\s+([\d.]+)%/.exec(d.toString());
      if (m) onProgress(Math.min(99, parseFloat(m[1])));
    });
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", (e) => reject(new Error(String(e))));
    p.on("close", (code) => {
      if (code === 0 && existsSync(finalPath)) {
        onProgress(100);
        resolve(finalPath);
      } else {
        reject(new Error(stderr || `yt-dlp exited ${code}`));
      }
    });
  });
}
