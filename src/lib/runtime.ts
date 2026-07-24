import type { Server as SocketServer } from "socket.io";

// Cross-module bridge. The custom server (server.ts) owns the Socket.IO
// instance and the download worker; Next route handlers run in the same
// process but a separate module registry, so they reach these via globalThis.
type Runtime = {
  io?: SocketServer;
  enqueueDownload?: (queueItemId: string) => void;
};

const g = globalThis as unknown as { __jukebox_runtime?: Runtime };
const runtime: Runtime = (g.__jukebox_runtime ??= {});

export function setIo(io: SocketServer) {
  runtime.io = io;
}

export function setEnqueue(fn: (queueItemId: string) => void) {
  runtime.enqueueDownload = fn;
}

export function emit(event: string, payload?: unknown) {
  runtime.io?.emit(event, payload);
}

export function enqueueDownload(queueItemId: string) {
  if (!runtime.enqueueDownload) {
    console.warn("[runtime] download worker not ready; job dropped:", queueItemId);
    return;
  }
  runtime.enqueueDownload(queueItemId);
}
