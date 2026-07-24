import PQueue from "p-queue";
import { mkdirSync } from "node:fs";
import { prisma } from "./db";
import { emit } from "./runtime";
import { download, DOWNLOAD_DIR } from "./youtube";
import { advanceIfIdle, broadcastQueue } from "./player";

const CONCURRENCY = Math.max(1, Math.min(9, Number(process.env.DOWNLOAD_CONCURRENCY) || 3));
const MAX_ATTEMPTS = 3;

// One shared worker pool. Created by the custom server via createWorker().
export function createWorker() {
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const queue = new PQueue({ concurrency: CONCURRENCY });

  async function process(queueItemId: string) {
    const item = await prisma.queueItem.findUnique({
      where: { id: queueItemId },
      include: { media: true },
    });
    if (!item || item.status === "cancelled") return;

    // Cache hit — already downloaded elsewhere.
    if (item.media.filePath) {
      await prisma.queueItem.update({
        where: { id: item.id },
        data: { status: "ready", progress: 100 },
      });
      emit("download.completed", { queueItemId: item.id });
      broadcastQueue();
      await advanceIfIdle();
      return;
    }

    let lastErr = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await prisma.queueItem.update({
          where: { id: item.id },
          data: { status: "downloading", attempts: attempt, progress: 0 },
        });
        let lastEmit = 0;
        const filePath = await download(item.media.youtubeId, (pct) => {
          const now = Date.now();
          if (now - lastEmit > 400) {
            lastEmit = now;
            prisma.queueItem
              .update({ where: { id: item.id }, data: { progress: Math.floor(pct) } })
              .catch(() => {});
            emit("download.progress", { queueItemId: item.id, progress: Math.floor(pct) });
          }
        });

        await prisma.media.update({ where: { id: item.mediaId }, data: { filePath } });
        await prisma.queueItem.update({
          where: { id: item.id },
          data: { status: "ready", progress: 100 },
        });
        emit("download.completed", { queueItemId: item.id });
        broadcastQueue();
        await advanceIfIdle();
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }

    await prisma.queueItem.update({
      where: { id: item.id },
      data: { status: "failed", error: lastErr.slice(0, 300) },
    });
    emit("download.failed", { queueItemId: item.id, error: lastErr });
    broadcastQueue();
  }

  return {
    enqueue(queueItemId: string) {
      queue.add(() => process(queueItemId)).catch((e) => console.error("[worker]", e));
    },
  };
}
