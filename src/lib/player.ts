import { prisma } from "./db";
import { emit, enqueueDownload } from "./runtime";
import { getSettings } from "./config";
import { gradientFor, type Meta } from "./youtube";
import { existsSync } from "node:fs";

// In-memory playback extras (single process): reactions for the current song
// and the frozen elapsed value while paused.
type Mem = { reactions: Record<string, number>; reactionKey: string | null; frozen: number };
const g = globalThis as unknown as { __jukebox_mem?: Mem };
const mem: Mem = (g.__jukebox_mem ??= { reactions: {}, reactionKey: null, frozen: 0 });

export const REACTIONS = ["fire", "heart", "joy", "party"] as const;
const ACTIVE = ["downloading", "ready", "failed"];

export class LimitError extends Error {}

function initial(name: string) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

async function nowPlayingRow() {
  return prisma.nowPlaying.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

function elapsedOf(startedAt: Date | null, paused: boolean): number {
  if (!startedAt) return 0;
  if (paused) return mem.frozen;
  return Math.max(0, (Date.now() - startedAt.getTime()) / 1000);
}

// ---- adding songs -------------------------------------------------------

export async function addSong(
  meta: Meta,
  opts: { session: string; requester?: string },
): Promise<{ queueItemId: string; cached: boolean }> {
  const settings = await getSettings();

  if (meta.durationSec > settings.maxDurationMin * 60) {
    throw new LimitError(`Too long — max ${settings.maxDurationMin} min`);
  }
  const active = await prisma.queueItem.count({ where: { status: { in: ACTIVE } } });
  if (active >= settings.queueLimit) throw new LimitError(`Queue is full (${settings.queueLimit})`);

  const mine = await prisma.queueItem.count({
    where: { ownerSession: opts.session, status: { in: ACTIVE } },
  });
  if (mine >= settings.perUserLimit) {
    throw new LimitError(`You've hit your ${settings.perUserLimit}-song limit 🙏`);
  }

  // Cache: reuse Media by youtubeId; only "ready" if the file is still on disk.
  const media = await prisma.media.upsert({
    where: { youtubeId: meta.youtubeId },
    create: {
      youtubeId: meta.youtubeId,
      title: meta.title,
      channel: meta.channel,
      durationSec: meta.durationSec,
      thumbnail: meta.thumbnail,
      gradient: gradientFor(meta.title),
    },
    update: { lastUsedAt: new Date() },
  });
  const cached = !!media.filePath && existsSync(media.filePath);

  const maxPos = await prisma.queueItem.aggregate({ _max: { position: true } });
  const item = await prisma.queueItem.create({
    data: {
      mediaId: media.id,
      ownerSession: opts.session,
      requester: opts.requester?.slice(0, 24) || "Guest",
      position: (maxPos._max.position ?? 0) + 1,
      status: cached ? "ready" : "downloading",
      progress: cached ? 100 : 0,
    },
  });

  if (!cached) enqueueDownload(item.id);
  broadcastQueue();
  await advanceIfIdle();
  return { queueItemId: item.id, cached };
}

// ---- playback transitions ----------------------------------------------

async function pickNextReady() {
  return prisma.queueItem.findFirst({
    where: { status: "ready" },
    orderBy: { position: "asc" },
    include: { media: true },
  });
}

// Promote the next ready song if nothing is currently playing.
export async function advanceIfIdle() {
  const np = await nowPlayingRow();
  if (np.queueItemId) {
    const cur = await prisma.queueItem.findUnique({ where: { id: np.queueItemId } });
    if (cur && cur.status === "playing") return;
  }
  await advance();
}

// Move to the next ready song (or clear when the queue is dry).
export async function advance() {
  const next = await pickNextReady();
  if (!next) {
    await prisma.nowPlaying.update({
      where: { id: 1 },
      data: { queueItemId: null, startedAt: null, paused: false },
    });
    mem.reactions = {};
    mem.reactionKey = null;
    emit("song.finished");
    broadcastQueue();
    return;
  }
  await prisma.queueItem.update({ where: { id: next.id }, data: { status: "playing" } });
  await prisma.nowPlaying.update({
    where: { id: 1 },
    data: { queueItemId: next.id, startedAt: new Date(), paused: false },
  });
  mem.reactions = {};
  mem.reactionKey = next.id;
  mem.frozen = 0;
  emit("song.started", { queueItemId: next.id, mediaId: next.mediaId });
  broadcastQueue();
}

// Called by the player when audio ends, or by the server tick as a fallback.
export async function finished(expectedItemId?: string) {
  const np = await nowPlayingRow();
  if (!np.queueItemId) return;
  if (expectedItemId && expectedItemId !== np.queueItemId) return; // stale report
  const cur = await prisma.queueItem.findUnique({
    where: { id: np.queueItemId },
    include: { media: true },
  });
  if (cur) {
    await prisma.queueItem.update({ where: { id: cur.id }, data: { status: "played" } });
    await prisma.playbackHistory.create({
      data: { mediaId: cur.mediaId, title: cur.media.title },
    });
  }
  await advance();
}

export async function skip() {
  await finished();
}

export async function setPaused(paused: boolean) {
  const np = await nowPlayingRow();
  if (paused) {
    mem.frozen = elapsedOf(np.startedAt, np.paused);
    await prisma.nowPlaying.update({ where: { id: 1 }, data: { paused: true } });
  } else {
    await prisma.nowPlaying.update({
      where: { id: 1 },
      data: { paused: false, startedAt: new Date(Date.now() - mem.frozen * 1000) },
    });
  }
  emit(paused ? "player.pause" : "player.resume");
  broadcastQueue();
}

export async function stop() {
  mem.frozen = 0;
  await prisma.nowPlaying.update({
    where: { id: 1 },
    data: { paused: true, startedAt: new Date() },
  });
  emit("player.pause");
  broadcastQueue();
}

export async function playNow(id: string) {
  const item = await prisma.queueItem.findUnique({ where: { id } });
  if (!item || item.status !== "ready") throw new LimitError("Song isn't downloaded yet");
  await finished(); // retire whatever is playing
  await prisma.queueItem.update({ where: { id }, data: { status: "playing" } });
  await prisma.nowPlaying.update({
    where: { id: 1 },
    data: { queueItemId: id, startedAt: new Date(), paused: false },
  });
  mem.reactions = {};
  mem.reactionKey = id;
  mem.frozen = 0;
  emit("song.started", { queueItemId: id });
  broadcastQueue();
}

export async function reorder(id: string, dir: -1 | 1) {
  const list = await prisma.queueItem.findMany({
    where: { status: { in: ACTIVE } },
    orderBy: { position: "asc" },
  });
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  await prisma.$transaction([
    prisma.queueItem.update({ where: { id: list[i].id }, data: { position: list[j].position } }),
    prisma.queueItem.update({ where: { id: list[j].id }, data: { position: list[i].position } }),
  ]);
  broadcastQueue();
}

export async function remove(id: string, session?: string) {
  const item = await prisma.queueItem.findUnique({ where: { id } });
  if (!item) return;
  if (session && item.ownerSession !== session) throw new LimitError("Not your song");
  if (item.status === "playing") throw new LimitError("Can't cancel the playing song");
  await prisma.queueItem.update({ where: { id }, data: { status: "cancelled" } });
  broadcastQueue();
}

export async function clearQueue() {
  await prisma.queueItem.updateMany({
    where: { status: { in: ACTIVE } },
    data: { status: "cancelled" },
  });
  broadcastQueue();
}

export async function clearData() {
  await prisma.queueItem.updateMany({
    where: { status: { in: [...ACTIVE, "playing"] } },
    data: { status: "cancelled" },
  });
  await prisma.nowPlaying.update({
    where: { id: 1 },
    data: { queueItemId: null, startedAt: null, paused: false },
  });
  await prisma.playbackHistory.deleteMany({});
  mem.reactions = {};
  mem.reactionKey = null;
  emit("song.finished");
  broadcastQueue();
}

export function react(key: string) {
  if (!REACTIONS.includes(key as (typeof REACTIONS)[number])) return;
  mem.reactions[key] = (mem.reactions[key] ?? 0) + 1;
  emit("reaction", { key, count: mem.reactions[key] });
}

// ---- server tick: auto-advance so playback continues without an open player -

export async function tick() {
  const np = await nowPlayingRow();
  if (!np.queueItemId || np.paused || !np.startedAt) return;
  const cur = await prisma.queueItem.findUnique({
    where: { id: np.queueItemId },
    include: { media: true },
  });
  if (!cur) return;
  if (elapsedOf(np.startedAt, false) >= cur.media.durationSec) await finished(cur.id);
}

// ---- read model ---------------------------------------------------------

export function broadcastQueue() {
  emit("queue.updated");
}

export async function getAudioPath(mediaId: string): Promise<string | null> {
  const m = await prisma.media.findUnique({ where: { id: mediaId } });
  return m?.filePath && existsSync(m.filePath) ? m.filePath : null;
}

export async function getState(session?: string) {
  const settings = await getSettings();
  const np = await nowPlayingRow();

  const items = await prisma.queueItem.findMany({
    where: { status: { in: ACTIVE } },
    orderBy: { position: "asc" },
    include: { media: true },
  });

  let nowPlaying: any = null;
  let elapsedSec = 0;
  if (np.queueItemId) {
    const cur = await prisma.queueItem.findUnique({
      where: { id: np.queueItemId },
      include: { media: true },
    });
    if (cur) {
      elapsedSec = Math.min(cur.media.durationSec, elapsedOf(np.startedAt, np.paused));
      nowPlaying = {
        id: cur.id,
        mediaId: cur.mediaId,
        title: cur.media.title,
        channel: cur.media.channel,
        requester: cur.requester,
        initial: initial(cur.requester),
        gradient: cur.media.gradient,
        durationSec: cur.media.durationSec,
      };
    }
  }

  const queue = items.map((q) => ({
    id: q.id,
    title: q.media.title,
    channel: q.media.channel,
    requester: q.requester,
    gradient: q.media.gradient,
    durationSec: q.media.durationSec,
    status: q.status,
    progress: q.progress,
    mine: session ? q.ownerSession === session : false,
  }));

  // ETA to the caller's earliest queued song.
  let eta: number | null = null;
  if (session) {
    let acc = nowPlaying ? nowPlaying.durationSec - elapsedSec : 0;
    for (const q of items) {
      if (q.ownerSession === session) {
        eta = Math.max(0, Math.round(acc));
        break;
      }
      acc += q.media.durationSec;
    }
  }

  const cachedCount = await prisma.media.count({ where: { NOT: { filePath: null } } });

  return {
    nowPlaying,
    elapsedSec,
    paused: np.paused,
    queue,
    reactions: {
      fire: mem.reactions.fire ?? 0,
      heart: mem.reactions.heart ?? 0,
      joy: mem.reactions.joy ?? 0,
      party: mem.reactions.party ?? 0,
    },
    settings,
    eta,
    myCount: session ? items.filter((q) => q.ownerSession === session).length : 0,
    cachedCount,
  };
}
