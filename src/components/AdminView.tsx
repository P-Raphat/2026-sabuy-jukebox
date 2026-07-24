"use client";
import { useEffect, useState } from "react";
import { api, fmt, type State } from "@/lib/useJukebox";
import type { MutableRefObject } from "react";
import type { Socket } from "socket.io-client";

type Jb = { state: State | null; refetch: () => void; socket: MutableRefObject<Socket | null> };
const PASS_KEY = "sjb_admin";

export default function AdminView({ jb, flash }: { jb: Jb; flash: (m: string) => void }) {
  const s = jb.state!;
  const [pass, setPass] = useState<string | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    setPass(localStorage.getItem(PASS_KEY));
  }, []);

  async function login() {
    const r = await api("/api/admin", { action: "login" }, input);
    if (r.ok) {
      localStorage.setItem(PASS_KEY, input);
      setPass(input);
    } else {
      flash("Wrong password");
    }
  }

  async function act(action: string, extra?: Record<string, unknown>) {
    if (!pass) return;
    const r = await api("/api/admin", { action, ...extra }, pass);
    if (!r.ok) {
      if (r.error === "Unauthorized") {
        localStorage.removeItem(PASS_KEY);
        setPass(null);
      }
      flash(r.error || "Action failed");
    }
    jb.refetch();
  }

  if (!pass) {
    return (
      <div style={{ maxWidth: 380, margin: "60px auto", padding: "0 26px" }}>
        <div style={{ background: "#1c1622", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Admin sign-in</div>
          <div style={{ fontSize: 13, color: "#9a8ca0", marginBottom: 16 }}>Enter the admin password to control the live player.</div>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Password"
            style={{ width: "100%", background: "#241c2b", border: "1px solid rgba(255,255,255,.1)", borderRadius: 11, padding: "12px 14px", color: "#f5ede7", fontSize: 14, outline: "none", marginBottom: 12 }}
          />
          <div onClick={login} style={{ background: "#ff6b00", color: "#fff", fontWeight: 600, fontSize: 14, padding: "12px", borderRadius: 11, textAlign: "center", cursor: "pointer" }}>
            Sign in
          </div>
        </div>
      </div>
    );
  }

  const np = s.nowPlaying;
  const downloads = s.queue.filter((q) => q.status === "downloading");
  const totalSec = s.queue.reduce((a, q) => a + q.durationSec, 0) + (np ? np.durationSec - s.elapsedSec : 0);
  const btn = { display: "flex", alignItems: "center", gap: 7, background: "#2c2231", border: "1px solid rgba(255,255,255,.09)", color: "#f0e6d8", padding: "9px 15px", borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: "pointer" } as const;
  const step: React.CSSProperties = { width: 24, height: 24, borderRadius: 7, background: "#2c2231", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

  return (
    <div style={{ maxWidth: 1020, margin: "0 auto", padding: "26px 26px 90px" }}>
      {/* header + transport */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: "-.02em" }}>Admin Console</div>
          <div style={{ fontSize: 12, color: "#9a8ca0" }}>Controls the live player</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div onClick={() => act(s.paused ? "resume" : "pause")} style={btn}>{s.paused ? "▶ Play" : "❚❚ Pause"}</div>
          <div onClick={() => act("skip")} style={btn}>
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 5v14l9-7z" fill="currentColor" /><rect x="16" y="5" width="3" height="14" rx="1" fill="currentColor" /></svg>Skip
          </div>
          <div onClick={() => act("stop")} style={btn}>
            <svg width="12" height="12" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>Stop
          </div>
          <div onClick={() => act("clearQueue")} style={{ ...btn, background: "rgba(224,68,68,.14)", border: "1px solid rgba(224,68,68,.35)", color: "#ff8f8f" }}>Clear queue</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* queue */}
        <div style={{ flex: 1.6, minWidth: 340, background: "#1c1622", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 15 }}>Queue</div>
            <div style={{ fontSize: 12, color: "#9a8ca0" }}>{s.queue.length} songs · {fmt(totalSec)}</div>
          </div>
          {np && (
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "linear-gradient(135deg,rgba(255,107,0,.14),rgba(0,153,168,.1))", border: "1px solid rgba(255,107,0,.25)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, flex: "none", background: np.gradient }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {np.title}
                  <span style={{ fontSize: 10, color: "#ff9b52", background: "rgba(255,107,0,.16)", padding: "2px 7px", borderRadius: 999, marginLeft: 6, fontWeight: 700 }}>{s.paused ? "PAUSED" : "PLAYING"}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#9a8ca0" }}>{np.channel} · {np.requester} · {fmt(np.durationSec)}</div>
              </div>
            </div>
          )}
          {s.queue.length === 0 ? (
            <div style={{ padding: 22, textAlign: "center", color: "#9a8ca0", fontSize: 13, background: "#241c2b", borderRadius: 12 }}>Queue empty.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.queue.map((q, i) => {
                const dl = q.status === "downloading";
                return (
                  <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "9px 11px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <div onClick={() => act("reorder", { id: q.id, dir: -1 })} style={{ width: 20, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? "#3a3040" : "#8f8195", cursor: "pointer" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 8l6 7H6z" fill="currentColor" /></svg>
                      </div>
                      <div onClick={() => act("reorder", { id: q.id, dir: 1 })} style={{ width: 20, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: i === s.queue.length - 1 ? "#3a3040" : "#8f8195", cursor: "pointer" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 16l-6-7h12z" fill="currentColor" /></svg>
                      </div>
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: 9, flex: "none", position: "relative", overflow: "hidden", background: dl ? "#3a2f42" : q.gradient }}>
                      {dl && <div style={{ position: "absolute", inset: 0, background: "rgba(20,12,24,.72)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#ffb47d", fontWeight: 700 }}>{Math.floor(q.progress)}%</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.title}</div>
                      <div style={{ fontSize: 11, color: "#9a8ca0" }}>{dl ? `Downloading ${Math.floor(q.progress)}%` : `${q.channel} · ${q.requester} · ${fmt(q.durationSec)}`}</div>
                    </div>
                    {q.status === "ready" && (
                      <div onClick={() => act("playNow", { id: q.id })} style={{ display: "flex", alignItems: "center", gap: 5, color: "#0fd0c0", fontSize: 12, fontWeight: 600, background: "rgba(0,153,168,.14)", padding: "6px 10px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M7 5v14l12-7z" fill="currentColor" /></svg>Play now
                      </div>
                    )}
                    <div onClick={() => act("remove", { id: q.id })} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(224,68,68,.12)", color: "#ff8f8f", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* downloads + config */}
        <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#1c1622", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 20px" }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Downloads</div>
            {downloads.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 11, padding: "10px 12px", fontSize: 12.5, color: "#7fe3da" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0fd0c0", display: "inline-block" }} />
                All caught up · {s.cachedCount} cached files
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {downloads.map((d) => (
                  <div key={d.id} style={{ background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 11, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 7 }}>
                      <span style={{ fontWeight: 600 }}>{d.title}</span>
                      <span style={{ fontWeight: 600, color: "#ff9b52" }}>{Math.floor(d.progress)}%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,.1)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.floor(d.progress)}%`, background: "linear-gradient(90deg,#ff6b00,#ff9b52)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "#1c1622", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 20px" }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Config</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
              <ConfigStep label="Max duration" value={`${s.settings.maxDurationMin} min`} onDown={() => act("config", { patch: { maxDurationMin: s.settings.maxDurationMin - 1 } })} onUp={() => act("config", { patch: { maxDurationMin: s.settings.maxDurationMin + 1 } })} step={step} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "9px 12px" }}>
                <span style={{ color: "#c9b9cf" }}>Queue limit</span>
                <span style={{ fontWeight: 600, background: "#2c2231", padding: "3px 10px", borderRadius: 7 }}>{s.settings.queueLimit} songs</span>
              </div>
              <ConfigStep label="Per-user limit" value={`${s.settings.perUserLimit} songs`} onDown={() => act("config", { patch: { perUserLimit: s.settings.perUserLimit - 1 } })} onUp={() => act("config", { patch: { perUserLimit: s.settings.perUserLimit + 1 } })} step={step} />
              <div onClick={() => act("config", { patch: { autoCleanup: !s.settings.autoCleanup } })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>
                <span style={{ color: "#c9b9cf" }}>Auto-cleanup cache</span>
                <span style={{ width: 38, height: 22, borderRadius: 99, position: "relative", flex: "none", background: s.settings.autoCleanup ? "#0099a8" : "rgba(255,255,255,.15)" }}>
                  <span style={{ position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", left: s.settings.autoCleanup ? 18 : 2 }} />
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(224,68,68,.1)", border: "1px solid rgba(224,68,68,.3)", borderRadius: 14, padding: "12px 15px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#ff8f8f" }}>Danger zone</div>
              <div style={{ fontSize: 11, color: "#c99" }}>Wipe queue, history &amp; cache</div>
            </div>
            <div onClick={() => act("clearData")} style={{ background: "#e04444", color: "#fff", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer" }}>Clear data</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigStep({ label, value, onDown, onUp, step }: { label: string; value: string; onDown: () => void; onUp: () => void; step: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#241c2b", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ color: "#c9b9cf" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div onClick={onDown} style={step}>−</div>
        <span style={{ fontWeight: 600, minWidth: 52, textAlign: "center" }}>{value}</span>
        <div onClick={onUp} style={step}>+</div>
      </div>
    </div>
  );
}
