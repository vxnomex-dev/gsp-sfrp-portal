import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/session";
import { attachmentsOf, getCase } from "@/lib/ia";

/**
 * Streams one piece of uploaded evidence to Internal Affairs. The files are private in Blob storage, so they're
 * only reachable through here, after checking the viewer is allowed. Range requests are passed on so videos seek.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/ia/evidence/[id]/[n]">) {
  const viewer = await getViewer();
  if (!viewer || !viewer.can("ia")) return new Response("Not allowed", { status: 403 });
  const { id, n } = await ctx.params;
  const c = await getCase(Number(id));
  const file = c ? attachmentsOf(c)[Number(n)] : undefined;
  if (!file || !process.env.BLOB_READ_WRITE_TOKEN) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range");
  const upstream = await fetch(file.url, {
    headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`, ...(range ? { range } : {}) },
    cache: "no-store",
  });
  if (!upstream.ok && upstream.status !== 206) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=3600");
  const download = req.nextUrl.searchParams.has("download");
  headers.set("content-disposition", `${download ? "attachment" : "inline"}; filename="${file.name.replace(/[^\w.\- ]/g, "_")}"`);
  return new Response(upstream.body, { status: upstream.status, headers });
}
