# SabuyJukebox — single container: Next.js app + Socket.IO + download worker.
FROM node:22-bookworm-slim

# yt-dlp (standalone binary needs python3) + ffmpeg for audio extraction.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl python3 \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Data (SQLite + cached audio) lives on a mounted volume.
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/prod.db"
ENV DOWNLOAD_DIR="/data/downloads"

RUN npx prisma generate && npm run build

EXPOSE 3000

# Apply schema to the mounted DB on boot, then launch the custom server.
CMD ["sh", "-c", "mkdir -p /data/downloads && npx prisma db push --skip-generate && npm run start"]
