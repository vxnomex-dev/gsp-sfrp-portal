import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { MAX_ATTACHMENT_BYTES } from "@/lib/ia-constants";

/** Lets the upload box know whether storage is connected. */
export function GET() {
  return NextResponse.json({ ready: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}

/** Hands Internal Affairs a short-lived token so the browser can upload evidence straight to private Blob storage. */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File uploads aren't set up yet (no Blob store connected)." }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const viewer = await getViewer();
        if (!viewer || !viewer.can("ia")) throw new Error("Only Internal Affairs can upload evidence.");
        if (!pathname.startsWith("ia-evidence/")) throw new Error("Invalid upload path.");
        return {
          allowedContentTypes: ["image/*", "video/*"],
          maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ by: viewer.uid }),
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
