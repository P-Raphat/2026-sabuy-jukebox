# Deploying SabuyJukebox on an on-prem mini-PC 🖥️🔊

The player must run on the machine physically wired to the office speakers, so
the whole app is deployed as **one Docker container on that mini-PC**. No cloud,
no external database. This guide is the copy-paste path from bare machine →
music playing.

---

## 0. What you need

- A mini-PC / NUC / any always-on machine connected to the speakers.
- Docker installed (below).
- This project folder on the machine.

Everything else — Node, `yt-dlp`, `ffmpeg`, `python3` — is baked into the Docker
image. You do **not** install those by hand.

---

## 1. Install Docker

**Windows**

1. Download Docker Desktop → https://www.docker.com/products/docker-desktop
2. Install, reboot, launch Docker Desktop (wait for "Engine running").
3. Settings → General → enable **Start Docker Desktop when you log in**.

**Linux (Ubuntu/Debian)**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then log out/in so `docker` works without sudo
```

Verify:

```bash
docker --version
docker compose version
```

---

## 2. Get the code onto the mini-PC

Either copy the whole `2026-sabuy-jukebox` folder over (skip `node_modules/`
and `.next/` — they're rebuilt in the image), **or** clone from git:

```bash
git clone <your-repo-url> sabuy-jukebox
cd sabuy-jukebox
```

---

## 3. Set the admin password

Edit `docker-compose.yml`:

```yaml
environment:
  ADMIN_PASSWORD: "changeme" # ← set a real password
```

> This is the password for the **Admin** tab (play/pause/skip/reorder/config).
> Employees don't need any login.

---

## 4. Build and start

First build takes ~3–5 min (it downloads `yt-dlp` + `ffmpeg` into the image).

```bash
docker compose up -d --build
```

Check it's up:

```bash
docker compose ps
docker compose logs -f app     # look for "▶ SabuyJukebox on http://localhost:3000"
```

The app is now on **http://localhost:3000**.

---

## 5. Open the kiosk player (on the mini-PC)

Launch Chrome full-screen pointed at the app, then switch to the **Player** tab:

**Windows**

```bat
start chrome --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/player
```

**Linux**

```bash
google-chrome --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/player
```

Open **`/player`** directly (there is no nav button for it), then click **Tap to
start** once. That single gesture unlocks browser autoplay; after that songs
advance automatically.

> URLs: employees use `http://<host>:3000` · admin `http://<host>:3000/admin`
> (password) · kiosk `http://<host>:3000/player`.

> `--autoplay-policy=no-user-gesture-required` lets it resume playback after
> reboots without a manual tap — handy for an unattended kiosk.

---

## 6. Let coworkers reach it

Employees add songs from their own desks via the mini-PC's LAN address.

1. Find the mini-PC IP: `ipconfig` (Windows) / `ip a` (Linux) → e.g. `192.168.1.50`.
2. Open **port 3000** in the firewall:
   - Windows: `netsh advfirewall firewall add rule name="SabuyJukebox" dir=in action=allow protocol=TCP localport=3000`
   - Linux (ufw): `sudo ufw allow 3000/tcp`
3. Share the link: **http://192.168.1.50:3000**
   (optional: map `music.office.local` → that IP in your DNS/hosts for a pretty URL).

---

## 7. Day-2 operations

**Start on boot** — `restart: unless-stopped` is already set, so the container
comes back after reboots as long as the Docker service auto-starts (default).

**Update yt-dlp** (do this when downloads start failing — YouTube changed format):

```bash
docker compose up -d --build   # rebuild pulls the latest yt-dlp
```

**View logs**

```bash
docker compose logs -f app
```

**Stop / restart**

```bash
docker compose stop
docker compose start
```

**Data lives in a volume** (`jukebox-data` → `/data`: SQLite DB + cached mp3s):

- `docker compose down` — stops & removes the container, **keeps** data.
- `docker compose down -v` — ⚠️ also deletes the volume (wipes queue, history, cache).

**Back up the data**

```bash
docker run --rm -v jukebox-data:/data -v "$PWD":/backup busybox \
  tar czf /backup/jukebox-backup.tar.gz -C /data .
```

---

## 8. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Add song → stuck "Downloading…" then fails | yt-dlp out of date → `docker compose up -d --build`. Check `docker compose logs -f app`. |
| No sound on speakers | Player tab not started (click **Tap to start**), or OS output device not the speakers. |
| Coworkers can't open the link | Firewall port 3000 closed, or wrong IP, or not on the same LAN. |
| Playback doesn't auto-advance | Player tab closed on the kiosk — reopen it. (Server tick still advances state, but audio needs the Player tab.) |
| Port 3000 already used | Change the left side of `"3000:3000"` in `docker-compose.yml`, e.g. `"8080:3000"`. |

---

## One-liner recap

```bash
# on the mini-PC, in the project folder:
docker compose up -d --build
# then open Chrome kiosk → Player tab → Tap to start
```
