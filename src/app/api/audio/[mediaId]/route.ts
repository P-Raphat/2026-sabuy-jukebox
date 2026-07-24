import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { getAudioPath } from "@/lib/player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stream cached audio to the player's <audio> element, with range support
// so seeking works.
export async function GET(req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const path = await getAudioPath(mediaId);
  if (!path) return new NextResponse("Not found", { status: 404 });

  const size = statSync(path).size;
  const range = req.headers.get("range");
  const toWeb = (s: ReturnType<typeof createReadStream>) =>
    Readable.toWeb(s) as unknown as ReadableStream;

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    return new NextResponse(toWeb(createReadStream(path, { start, end })), {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  return new NextResponse(toWeb(createReadStream(path)), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
    },
  });
}
