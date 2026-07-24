"use client";
import { useCallback, useRef, useState } from "react";
import { useJukebox } from "@/lib/useJukebox";
import EmployeeView from "./EmployeeView";
import AdminView from "./AdminView";
import PlayerView from "./PlayerView";

type View = "employee" | "admin" | "player";

// One shell, three entry routes (/, /admin, /player). Admin & Player are
// reachable only by their path — no tab buttons, so casual users don't see them.
export default function AppShell({ view }: { view: View }) {
  const jb = useJukebox();
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  const s = jb.state;
  const showNav = view !== "player"; // kiosk player is full-screen, no chrome

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(120% 90% at 80% -10%,#241428 0%,#160f1c 45%,#100c14 100%)",
        color: "#f5ede7",
      }}
    >
      {showNav && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 26px",
            background: "rgba(22,16,26,.82)",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                background: "linear-gradient(135deg,#ff6b00,#0099a8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: "#fff",
              }}
            >
              ♪
            </div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: "-.02em" }}>
              Sabuy<span style={{ color: "#ff6b00" }}>Jukebox</span>
              {view === "admin" && (
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "#ffb47d", background: "rgba(255,107,0,.14)", padding: "3px 10px", borderRadius: 999 }}>
                  Admin
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#7fe3da" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0fd0c0", display: "inline-block", animation: "eq 1.2s ease-in-out infinite alternate" }} />
              Live
            </div>
            {view === "employee" && s && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,107,0,.13)", color: "#ffb47d", padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600 }}>
                You · {s.myCount}/{s.settings.perUserLimit}
              </div>
            )}
          </div>
        </div>
      )}

      {!s ? (
        <div style={{ textAlign: "center", padding: 80, color: "#9a8ca0" }}>Connecting…</div>
      ) : view === "employee" ? (
        <EmployeeView jb={jb} flash={flash} />
      ) : view === "admin" ? (
        <AdminView jb={jb} flash={flash} />
      ) : (
        <PlayerView jb={jb} />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 28,
            transform: "translateX(-50%)",
            zIndex: 60,
            background: "#2c2231",
            border: "1px solid rgba(255,107,0,.4)",
            color: "#f5ede7",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 600,
            boxShadow: "0 16px 40px -12px rgba(0,0,0,.6)",
            animation: "toastin .25s ease",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
