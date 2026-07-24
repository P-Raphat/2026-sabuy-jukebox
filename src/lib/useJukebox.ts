"use client";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { io, type Socket } from "socket.io-client";

export type NowPlaying = {
  id: string;
  mediaId: string;
  title: string;
  channel: string;
  requester: string;
  initial: string;
  gradient: string;
  durationSec: number;
} | null;

export type QItem = {
  id: string;
  title: string;
  channel: string;
  requester: string;
  gradient: string;
  durationSec: number;
  status: string;
  progress: number;
  mine: boolean;
};

export type Settings = {
  maxDurationMin: number;
  queueLimit: number;
  perUserLimit: number;
  autoCleanup: boolean;
};

export type State = {
  nowPlaying: NowPlaying;
  elapsedSec: number;
  paused: boolean;
  queue: QItem[];
  reactions: { fire: number; heart: number; joy: number; party: number };
  settings: Settings;
  eta: number | null;
  myCount: number;
  cachedCount: number;
};

export const EMOJI: Record<string, string> = {
  fire: "🔥",
  heart: "❤️",
  joy: "😂",
  party: "🎉",
};

export function fmt(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function api(
  path: string,
  body?: unknown,
  adminPass?: string,
): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(adminPass ? { "x-admin-pass": adminPass } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, ...j };
}

// Central store: fetches /api/state and keeps it fresh from Socket.IO events.
export function useJukebox() {
  const [state, setState] = useState<State | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.ok) setState(await r.json());
    } catch {
      /* transient — next event refetches */
    }
  }, []);

  useEffect(() => {
    refetch();
    const s = io({ transports: ["websocket", "polling"] });
    socketRef.current = s;

    const refetchEvents = [
      "queue.updated",
      "download.completed",
      "download.failed",
      "song.started",
      "song.finished",
      "player.pause",
      "player.resume",
    ];
    refetchEvents.forEach((e) => s.on(e, () => refetch()));

    // Fine-grained updates without a full refetch storm.
    s.on("download.progress", (p: { queueItemId: string; progress: number }) =>
      setState((cur) =>
        cur
          ? {
              ...cur,
              queue: cur.queue.map((q) =>
                q.id === p.queueItemId ? { ...q, progress: p.progress } : q,
              ),
            }
          : cur,
      ),
    );
    s.on("reaction", (p: { key: string; count: number }) =>
      setState((cur) =>
        cur ? { ...cur, reactions: { ...cur.reactions, [p.key]: p.count } } : cur,
      ),
    );
    s.on("np.tick", () =>
      setState((cur) =>
        cur && cur.nowPlaying && !cur.paused
          ? { ...cur, elapsedSec: Math.min(cur.nowPlaying.durationSec, cur.elapsedSec + 1) }
          : cur,
      ),
    );

    return () => {
      s.close();
    };
  }, [refetch]);

  return { state, refetch, socket: socketRef as MutableRefObject<Socket | null> };
}
