# SabuyJukebox 🎵

An internal, LAN-only music queue for the office. Coworkers add YouTube songs
from their own desks; a single mini-PC wired to the speakers plays them back in
order. No accounts, no cloud, no external database.

- **Employees** search/queue songs and react — no login.
- **Admin** controls playback (play/pause/skip/reorder) and settings — password-protected.
- **Player** is the kiosk tab on the mini-PC that actually produces sound.

---

## How it works

```
Browser (employees)  ──HTTP/WebSocket──┐
                                        ▼
                          ┌─────────────────────────────┐
                          │  Next.js 15 + custom server  │  server.ts
                          │  • Socket.IO (realtime)      │
                          │  • p-queue download worker   │
                          │  • 1 Hz playback tick        │
                          └───────────┬──────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                         ▼
      SQLite (Prisma)          downloads/*.mp3           yt-dlp + ffmpeg
      queue • history          cached audio              (spawned per download)
      now-playing • settings
```

- **Single process.** The custom `server.ts` runs the Next.js app, the Socket.IO
  realtime channel, and the in-process download worker together.
- **Audio pipeline.** Adding a song spawns `yt-dlp` (with `ffmpeg`) to download
  and extract an `.mp3` into `downloads/`. Progress streams to clients live.
- **State** lives in SQLite; the `.mp3` files live on disk. The DB only stores
  the file path, not the audio itself.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 |
| Realtime | Socket.IO |
| Custom server | Node `http` + `tsx` (`server.ts`) |
| Download queue | `p-queue` (in-process) |
| Media fetch | `yt-dlp` + `ffmpeg` (external binaries) |
| Database | SQLite via Prisma |

---

## Prerequisites

Install these on any machine that runs the app (dev or production):

| Tool | Version | Notes |
| --- | --- | --- |
| **Node.js** | 22.x | https://nodejs.org |
| **yt-dlp** | latest | must be on `PATH` |
| **ffmpeg** | any recent | must be on `PATH`; `yt-dlp -x` uses it to extract mp3 |

### Windows (recommended: winget)

```powershell
winget install OpenJS.NodeJS.LTS
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

> After installing, **open a new terminal** so `PATH` refreshes, then verify:
> ```powershell
> node -v
> yt-dlp --version
> ffmpeg -version
> ```

### Linux (Ubuntu/Debian)

```bash
# Node 22 via nodesource, then:
sudo apt-get install -y ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp
```

---

## Setup

```bash
# 1. Install dependencies (postinstall runs `prisma generate` automatically)
npm install

# 2. Create your environment file
cp .env.example .env
#    then edit .env — at minimum set a real ADMIN_PASSWORD

# 3. Create the SQLite database + schema
npm run db:push
```

### Run in development

```bash
npm run dev        # tsx watch server.ts — hot reload
```

Open http://localhost:3000

### Run in production (non-Docker)

```bash
npm run build      # prisma generate + next build
npm run start      # NODE_ENV=production tsx server.ts
```

---

## Configuration (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite file location (Prisma) |
| `DOWNLOAD_DIR` | `./downloads` | Where extracted `.mp3` files are cached |
| `DOWNLOAD_CONCURRENCY` | `3` | Simultaneous downloads (clamped 1–9) |
| `ADMIN_PASSWORD` | `changeme` | Password for the Admin tab — **change this** |
| `PORT` | `3000` | HTTP port |

> Runtime settings (max song length, queue limit, per-user limit, auto-cleanup)
> live in the database, not `.env` — change them in the **Admin** tab.

---

## URLs

Replace `localhost` with the mini-PC's LAN IP (e.g. `192.168.1.50`) for coworkers.

| Who | URL | Notes |
| --- | --- | --- |
| Employees | `http://<host>:3000` | Search & queue songs |
| Admin | `http://<host>:3000/admin` | Password-protected controls |
| Player (kiosk) | `http://<host>:3000/player` | Open on the mini-PC; **produces the sound** |

> The Player tab must stay open on the machine wired to the speakers. Click
> **Tap to start** once to unlock browser autoplay; songs then advance
> automatically.

---

## What the database stores

SQLite holds queue **state and metadata only** — never the audio (that's on disk
in `DOWNLOAD_DIR`). Models:

| Model | Stores |
| --- | --- |
| `Media` | Cached song info: youtubeId, title, channel, duration, thumbnail, `filePath`, fileSize — prevents re-downloading the same video |
| `QueueItem` | The queue: requester, owner session, position, status (`downloading`→`ready`→`playing`→`played`), progress %, retry attempts |
| `NowPlaying` | Single row — currently playing item, start time, paused flag |
| `Setting` | Single row — maxDurationMin, queueLimit, perUserLimit, autoCleanup |
| `PlaybackHistory` | Log of finished songs |

Deleting the DB clears the queue and history; cached `.mp3` files in
`downloads/` survive.

---

## Deploy on a Windows mini-PC (auto-start on boot)

For the kiosk to survive reboots, two pieces must auto-start:

### A. The app as a Windows service (via [NSSM](https://nssm.cc))

```bat
nssm install SabuyJukebox "C:\Program Files\nodejs\npm.cmd" run start
nssm set SabuyJukebox AppDirectory "D:\path\to\2026-sabuy-jukebox"
nssm set SabuyJukebox AppEnvironmentExtra NODE_ENV=production
nssm start SabuyJukebox
```

NSSM restarts the process automatically if it crashes.

### B. The Chrome kiosk (needs a logged-in desktop for audio output)

Enable Windows **auto-login**, then drop a `.bat` in the Startup folder
(`Win+R` → `shell:startup`):

```bat
start chrome --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/player
```

> ⚠️ The app service runs headless, but **sound requires the Chrome Player tab
> open in a logged-in desktop session**. A service alone plays no audio.

### C. Let coworkers reach it (firewall)

```bat
netsh advfirewall firewall add rule name="SabuyJukebox" dir=in action=allow protocol=TCP localport=3000
```

Find the IP with `ipconfig`, then share `http://<ip>:3000`.

---

## Deploy with Docker (alternative)

A single-container setup is also provided — see [`DEPLOY.md`](./DEPLOY.md). The
image bakes in Node, `yt-dlp`, `ffmpeg`, and `python3`, so you don't install
them by hand.

```bash
docker compose up -d --build
```

---

## npm scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run build` | `prisma generate` + `next build` |
| `npm run start` | Production server |
| `npm run db:push` | Sync Prisma schema to the SQLite file |

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Add song → stuck "Downloading…" then fails | `yt-dlp` missing from `PATH`, or out of date (YouTube changed format). Update it and retry. |
| Downloads fail with an ffmpeg error | `ffmpeg` not on `PATH`. |
| No sound on speakers | Player tab not started (click **Tap to start**), or OS output device isn't the speakers. |
| Coworkers can't open the link | Firewall port 3000 closed, wrong IP, or not on the same LAN. |
| Playback doesn't auto-advance | Player tab was closed on the kiosk — reopen it. |
| Port 3000 already in use | Change `PORT` in `.env`. |
