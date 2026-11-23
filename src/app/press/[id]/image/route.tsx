import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { PressDocument, pressImageHeight } from "@/components/PressDocument";
import { getPressRelease, toPressDoc } from "@/lib/press";

/** The press release as a PNG — this is what's posted in the Discord press channel. */
export async function GET(req: NextRequest, ctx: RouteContext<"/press/[id]/image">) {
  const { id } = await ctx.params;
  const n = await getPressRelease(Number(id));
  if (!n) return new Response("Not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const font = (file: string) => fetch(`${origin}/fonts/${file}`).then((r) => r.arrayBuffer());
  const [regular, italic, bold] = await Promise.all([
    font("merriweather-latin-400-normal.woff"),
    font("merriweather-latin-400-italic.woff"),
    font("merriweather-latin-700-normal.woff"),
  ]);
  const doc = toPressDoc(n);

  const seal = `data:image/png;base64,${Buffer.from(await fetch(`${origin}/images/fhp-seal.png`).then((r) => r.arrayBuffer())).toString("base64")}`;
  return new ImageResponse(<PressDocument doc={doc} sealUrl={seal} />, {
    width: 1240,
    height: pressImageHeight(doc),
    fonts: [
      { name: "Merriweather", data: regular, weight: 400, style: "normal" },
      { name: "Merriweather", data: italic, weight: 400, style: "italic" },
      { name: "Merriweather", data: bold, weight: 700, style: "normal" },
    ],
    headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" },
  });
}
