import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { setIo, setEnqueue } from "./src/lib/runtime";
import { createWorker } from "./src/lib/downloader";
import { tick } from "./src/lib/player";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  // Realtime channel. Internal tool → permissive CORS is fine.
  const io = new SocketServer(server, { cors: { origin: "*" } });
  setIo(io);

  // Download worker (in-process p-queue). Route handlers enqueue via runtime.
  const worker = createWorker();
  setEnqueue(worker.enqueue);

  // 1 Hz heartbeat: auto-advance finished songs + push elapsed to clients.
  setInterval(() => {
    tick().catch((e) => console.error("[tick]", e));
    io.emit("np.tick");
  }, 1000);

  server.listen(port, () => {
    console.log(`▶ SabuyJukebox on http://localhost:${port}`);
  });
});
