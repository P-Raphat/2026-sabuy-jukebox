"use client";
import { useEffect, useRef, useState } from "react";
import { api, EMOJI, fmt, type State } from "@/lib/useJukebox";
import type { MutableRefObject } from "react";
import type { Socket } from "socket.io-client";

type Jb = { state: State | null; refetch: () => void; socket: MutableRefObject<Socket | null> };

export default function PlayerView({ jb }: { jb: Jb }) {
  const s = jb.state!;
  const np = s.nowPlaying;
  const audioRef = useRef<HTMLAudioElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);

  // Load + play the current song's audio when it changes (needs prior gesture).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !np) {
      a?.pause();
      return;
    }
    const src = `/api/audio/${np.mediaId}`;
    if (!a.src.endsWith(src)) {
      a.src = src;
      if (armed) a.play().catch(() => {});
    }
  }, [np?.mediaId, armed]);

  // Mirror server pause state onto the element.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !np) return;
    if (s.paused) a.pause();
    else if (armed) a.play().catch(() => {});
  }, [s.paused, armed, np?.mediaId]);

  // Big floating reactions.
  useEffect(() => {
    const sock = jb.socket.current;
    if (!sock) return;
    const onReact = (p: { key: string }) => spawn(layerRef.current, EMOJI[p.key], true);
    sock.on("reaction", onReact);
    return () => {
      sock.off("reaction", onReact);
    };
  }, [jb.socket]);

  const npProgress = np ? Math.min(100, (s.elapsedSec / np.durationSec) * 100) : 0;
  const nextUp = s.queue.filter((q) => q.status === "ready").slice(0, 3);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 26px 60px" }}>
      <audio
        ref={audioRef}
        onEnded={() => np && api("/api/player/finished", { queueItemId: np.id })}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a && s.elapsedSec > 2 && Math.abs(a.currentTime - s.elapsedSec) > 3) a.currentTime = s.elapsedSec;
        }}
      />
      <div style={{ position: "relative", height: 560, background: "radial-gradient(120% 120% at 15% 10%,#2a1a2e 0%,#161018 55%,#101018 100%)", borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 70px -28px rgba(0,0,0,.7)", display: "flex", flexDirection: "column", padding: "34px 40px" }}>
        <div ref={layerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }} />

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#ff6b00,#0099a8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff" }}>♪</div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 21, letterSpacing: "-.02em" }}>Sabuy<span style={{ color: "#ff6b00" }}>Jukebox</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", padding: "8px 8px 8px 16px", borderRadius: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#9a8ca0" }}>Add a song from your desk</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ffb47d" }}>music.office.local</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 9, fontFamily: "ui-monospace,monospace", lineHeight: 1, textAlign: "center" }}>
              ▚▙▜<br />▛▟▚<br />▜▙▛
            </div>
          </div>
        </div>

        {/* now playing */}
        {np ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 42, marginTop: 6, position: "relative", zIndex: 2 }}>
            <div style={{ width: 250, height: 250, borderRadius: 24, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, color: "rgba(255,255,255,.9)", boxShadow: "0 24px 60px -18px rgba(255,107,0,.5)", background: np.gradient }}>♫</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "#ff9b52", fontWeight: 700 }}>
                Now playing
                <span style={{ display: "inline-flex", gap: 4, alignItems: "flex-end", height: 26 }}>
                  {["#ff6b00", "#0099a8", "#e0448a", "#0099a8", "#ff6b00"].map((c, i) => (
                    <span key={i} style={{ width: 5, height: 26, background: c, borderRadius: 3, transformOrigin: "bottom", animation: `eq ${0.5 + i * 0.12}s ${i * 0.05}s ease-in-out infinite alternate` }} />
                  ))}
                </span>
              </div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 48, letterSpacing: "-.03em", lineHeight: 1.02, margin: "12px 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{np.title}</div>
              <div style={{ fontSize: 20, color: "#c9b9cf" }}>{np.channel}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, background: "rgba(0,153,168,.16)", padding: "6px 14px 6px 6px", borderRadius: 999 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#0099a8,#00c2b0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{np.initial}</div>
                <span style={{ fontSize: 14, color: "#7fe3da", fontWeight: 600 }}>requested by {np.requester}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22, fontSize: 14, color: "#c9b9cf" }}>
                <span>{fmt(s.elapsedSec)}</span>
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,.12)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "linear-gradient(90deg,#ff6b00,#e0448a)", width: `${npProgress}%` }} />
                </div>
                <span>{fmt(np.durationSec)}</span>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
                {Object.keys(EMOJI).map((k) => {
                  const count = (s.reactions as any)[k] as number;
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 22 }}>
                      {EMOJI[k]}
                      {count > 0 && <span style={{ fontSize: 16, fontWeight: 700, color: "#c9b9cf" }}>{count}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 60, opacity: 0.5 }}>🎧</div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 26, color: "#c9b9cf" }}>Waiting for the first song…</div>
            <div style={{ fontSize: 15, color: "#8f8195" }}>Scan the code to add one from your desk</div>
          </div>
        )}

        {/* up next */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "#8f8195", fontWeight: 700, whiteSpace: "nowrap" }}>Up next</div>
          {nextUp.length === 0 && <div style={{ fontSize: 13, color: "#8f8195" }}>Nothing queued yet</div>}
          <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden" }}>
            {nextUp.map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 14px 8px 8px", flex: 1, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, flex: "none", background: n.gradient }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: "#9a8ca0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.channel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* start gate — browsers need a gesture before audio can autoplay */}
        {!armed && (
          <div
            onClick={() => {
              setArmed(true);
              audioRef.current?.play().catch(() => {});
            }}
            style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(16,12,20,.8)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, cursor: "pointer" }}
          >
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b00,#0099a8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, color: "#fff" }}>▶</div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 22 }}>Tap to start the player</div>
            <div style={{ fontSize: 13, color: "#9a8ca0" }}>Open this on the office speaker machine</div>
          </div>
        )}
      </div>
    </div>
  );
}

function spawn(layer: HTMLDivElement | null, emoji: string, big: boolean) {
  if (!layer) return;
  const el = document.createElement("div");
  el.textContent = emoji;
  el.style.cssText = `position:absolute;bottom:10px;left:${10 + Math.random() * 70}%;font-size:${big ? 40 : 22}px;pointer-events:none;will-change:transform,opacity;`;
  layer.appendChild(el);
  const dx = Math.random() * 60 - 30;
  el.animate(
    [
      { transform: "translate(0,0) scale(.6)", opacity: 0 },
      { transform: `translate(${dx * 0.4}px,-40px) scale(1.1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${dx}px,-${big ? 300 : 150}px) scale(1)`, opacity: 0 },
    ],
    { duration: big ? 2200 : 1600, easing: "cubic-bezier(.4,0,.2,1)" },
  ).onfinish = () => el.remove();
}
