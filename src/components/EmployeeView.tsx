"use client";
import { useEffect, useRef, useState } from "react";
import { api, EMOJI, fmt, type QItem, type State } from "@/lib/useJukebox";
import type { MutableRefObject } from "react";
import type { Socket } from "socket.io-client";

type Jb = { state: State | null; refetch: () => void; socket: MutableRefObject<Socket | null> };
type SearchResult = { youtubeId: string; title: string; channel: string; durationSec: number };

export default function EmployeeView({ jb, flash }: { jb: Jb; flash: (m: string) => void }) {
  const s = jb.state!;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  // Debounced realtime search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const t0 = performance.now();
      setLoading(true);
      setError(false);
      console.debug(`[search] querying "${q}"…`);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await r.json().catch(() => ({ results: [] }));
        if (cancelled) return;
        const ms = Math.round(performance.now() - t0);
        if (!r.ok || j.error) {
          console.warn(`[search] failed (${r.status}) in ${ms}ms`, j.error);
          setError(true);
          setResults([]);
        } else {
          console.debug(`[search] "${q}" → ${j.results?.length ?? 0} results in ${ms}ms`);
          setResults(j.results ?? []);
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[search] network error", e);
        setError(true);
        setResults([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Floating reaction emojis.
  useEffect(() => {
    const sock = jb.socket.current;
    if (!sock) return;
    const onReact = (p: { key: string }) => spawn(layerRef.current, EMOJI[p.key], false);
    sock.on("reaction", onReact);
    return () => {
      sock.off("reaction", onReact);
    };
  }, [jb.socket]);

  async function add(input: { youtubeId?: string; input?: string }) {
    const r = await api("/api/queue", input);
    if (r.ok) {
      flash(r.cached ? "Added — already cached ⚡" : `Added “${r.title}” — downloading…`);
      setQuery("");
      setResults([]);
      setSearched(false);
    } else {
      flash(r.error || "Could not add");
    }
    jb.refetch();
  }

  function addTop() {
    if (results[0]) add({ youtubeId: results[0].youtubeId });
    else if (query.trim()) add({ input: query.trim() });
  }

  const np = s.nowPlaying;
  const npProgress = np ? Math.min(100, (s.elapsedSec / np.durationSec) * 100) : 0;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "30px 26px 90px" }}>
      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 27, letterSpacing: "-.02em", margin: "0 0 4px" }}>
        What should we play next? 🎶
      </div>
      <div style={{ color: "#9a8ca0", fontSize: 14, marginBottom: 18 }}>
        Paste a YouTube link or search — we download it, then it joins the queue.
      </div>

      {/* input */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#2c2231", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "6px 6px 6px 16px" }}>
        <span style={{ color: "#8f8195", display: "flex" }}>
          {loading ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ animation: "spin .8s linear infinite" }}>
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.15)" strokeWidth="2.5" />
              <path d="M12 3a9 9 0 0 1 9 9" stroke="#ff6b00" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTop()}
          placeholder="Search a song, artist, or paste a link…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f5ede7", fontSize: 15, padding: "10px 0" }}
        />
        <div onClick={addTop} style={{ background: "#ff6b00", color: "#fff", fontWeight: 600, fontSize: 13, padding: "11px 18px", borderRadius: 11, cursor: "pointer" }}>
          Add
        </div>
      </div>

      {/* results */}
      {results.length > 0 && (
        <div style={{ marginTop: 10, background: "#241c2b", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, overflow: "hidden" }}>
          {results.map((r, i) => (
            <div key={r.youtubeId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: "1px solid rgba(255,255,255,.04)" }}>
              <div style={{ width: 52, height: 38, borderRadius: 8, flex: "none", background: "linear-gradient(135deg,#ff6b00,#0099a8)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "#9a8ca0" }}>{r.channel} · {fmt(r.durationSec)}</div>
              </div>
              {i === 0 && (
                <div style={{ fontSize: 10.5, color: "#0fd0c0", background: "rgba(0,153,168,.16)", padding: "3px 8px", borderRadius: 999, fontWeight: 700, whiteSpace: "nowrap" }}>
                  Top match
                </div>
              )}
              <div onClick={() => add({ youtubeId: r.youtubeId })} style={{ width: 30, height: 30, borderRadius: 9, background: "#ff6b00", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* loading skeleton */}
      {loading && results.length === 0 && (
        <div style={{ marginTop: 10, background: "#241c2b", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, overflow: "hidden" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i ? "1px solid rgba(255,255,255,.04)" : "none" }}>
              <div style={{ width: 52, height: 38, borderRadius: 8, flex: "none", background: "rgba(255,255,255,.06)", animation: "pulse 1.2s ease-in-out infinite" }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 11, width: "60%", borderRadius: 5, background: "rgba(255,255,255,.08)", animation: "pulse 1.2s ease-in-out infinite" }} />
                <div style={{ height: 9, width: "35%", borderRadius: 5, background: "rgba(255,255,255,.05)", marginTop: 7, animation: "pulse 1.2s ease-in-out infinite" }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* network / search error */}
      {error && !loading && (
        <div style={{ marginTop: 10, padding: 16, textAlign: "center", color: "#ffb47d", fontSize: 13.5, background: "rgba(255,107,0,.08)", border: "1px solid rgba(255,107,0,.25)", borderRadius: 14 }}>
          Couldn&rsquo;t reach YouTube — check your network and try again.
        </div>
      )}
      {searched && !loading && !error && results.length === 0 && (
        <div style={{ marginTop: 10, padding: 16, textAlign: "center", color: "#9a8ca0", fontSize: 13.5, background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14 }}>
          No matches for &ldquo;{query}&rdquo; — try another title.
        </div>
      )}

      {/* now playing */}
      {np ? (
        <div style={{ position: "relative", marginTop: 22, background: "linear-gradient(135deg,rgba(255,107,0,.14),rgba(0,153,168,.12))", border: "1px solid rgba(255,107,0,.2)", borderRadius: 16, padding: 16, overflow: "hidden" }}>
          <div ref={layerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "rgba(255,255,255,.85)", background: np.gradient }}>♫</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "#ffb47d", fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                Now playing
                <span style={{ display: "inline-flex", gap: 2, alignItems: "flex-end", height: 12 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 3, height: 12, background: "#ff6b00", borderRadius: 2, transformOrigin: "bottom", animation: `eq ${0.5 + i * 0.2}s ${i * 0.05}s ease-in-out infinite alternate` }} />
                  ))}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{np.title}</div>
              <div style={{ fontSize: 12, color: "#c9b9cf" }}>{np.channel} · requested by {np.requester}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13, fontSize: 11, color: "#c9b9cf", position: "relative" }}>
            <span>{fmt(s.elapsedSec)}</span>
            <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.14)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#ff6b00,#ff9b52)", width: `${npProgress}%` }} />
            </div>
            <span>{fmt(np.durationSec)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, position: "relative" }}>
            {Object.keys(EMOJI).map((k) => {
              const count = (s.reactions as any)[k] as number;
              return (
                <div
                  key={k}
                  onClick={() => {
                    api("/api/react", { key: k });
                    spawn(layerRef.current, EMOJI[k], false);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", padding: "7px 12px", borderRadius: 999, cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ fontSize: 16 }}>{EMOJI[k]}</span>
                  {count > 0 && <span style={{ fontSize: 12, fontWeight: 700 }}>{count}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 22, padding: 28, textAlign: "center", background: "#241c2b", border: "1px dashed rgba(255,255,255,.14)", borderRadius: 16, color: "#9a8ca0" }}>
          Nothing playing right now — add the first song! 🎧
        </div>
      )}

      {/* up next */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "22px 2px 10px" }}>
        <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 16 }}>
          Up next · {s.queue.length} songs
        </div>
        {s.eta != null && s.myCount > 0 && (
          <div style={{ fontSize: 12, color: "#0fd0c0", fontWeight: 700 }}>Your song in ~{fmt(s.eta)}</div>
        )}
      </div>
      {s.queue.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#9a8ca0", fontSize: 13.5, background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14 }}>
          Queue is empty. Be the DJ 🎛️
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {s.queue.map((q, i) => (
            <QueueRow key={q.id} q={q} pos={i + 1} onRemove={() => cancel(q, jb, flash)} />
          ))}
        </div>
      )}
    </div>
  );
}

async function cancel(q: QItem, jb: Jb, flash: (m: string) => void) {
  const r = await fetch(`/api/queue/${q.id}`, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) flash(j.error || "Could not cancel");
  jb.refetch();
}

function QueueRow({ q, pos, onRemove }: { q: QItem; pos: number; onRemove: () => void }) {
  const downloading = q.status === "downloading";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 12px",
        borderRadius: 12,
        ...(q.mine
          ? { background: "rgba(0,153,168,.1)", border: "1px solid rgba(0,153,168,.3)" }
          : { border: "1px solid transparent" }),
      }}
    >
      <div style={{ width: 22, textAlign: "center", color: q.mine ? "#0fd0c0" : "#8f8195", fontWeight: 700, fontSize: 13 }}>{pos}</div>
      <div style={{ width: 42, height: 42, borderRadius: 9, flex: "none", position: "relative", overflow: "hidden", background: downloading ? "#3a2f42" : q.gradient }}>
        {downloading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,12,24,.72)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#ffb47d", fontWeight: 700 }}>
            ↓{Math.floor(q.progress)}%
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.title}</div>
        <div style={{ fontSize: 11.5, color: downloading ? "#ffb47d" : "#9a8ca0" }}>
          {downloading ? "Downloading…" : q.status === "failed" ? "Failed" : `${q.channel} · ${q.requester}`}
        </div>
      </div>
      {q.mine && (
        <div style={{ background: "rgba(0,153,168,.2)", color: "#7fe3da", padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
          Your song
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "#9a8ca0", whiteSpace: "nowrap" }}>{fmt(q.durationSec)}</div>
      {q.mine && (
        <div onClick={onRemove} style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#cbbcd0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", flex: "none" }}>
          ×
        </div>
      )}
    </div>
  );
}

// Emoji burst animation, mirroring the prototype.
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
