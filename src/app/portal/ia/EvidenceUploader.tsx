"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FileVideo, ImagePlus, Loader2, X } from "lucide-react";
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, type Attachment } from "@/lib/ia-constants";

type Item = { att: Attachment; preview?: string; savedIndex?: number };
type Uploading = { key: string; name: string; pct: number };

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const safe = (name: string) => name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80) || "file";

/** Photos and videos for a case. Uploads go straight from the browser to private Blob storage. */
export function EvidenceUploader({ caseId, initial }: { caseId?: number; initial: Attachment[] }) {
  const [items, setItems] = useState<Item[]>(() => initial.map((att, i) => ({ att, savedIndex: i })));
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/ia/upload")
      .then((r) => r.json())
      .then((d: { ready: boolean }) => setReady(d.ready))
      .catch(() => setReady(null));
  }, []);

  async function addFiles(files: FileList | File[]) {
    setError(null);
    if (ready === false) {
      setError("File uploads aren't set up yet — the website needs a private Blob store connected in Vercel.");
      return;
    }
    const list = [...files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (list.length < [...files].length) setError("Only photos and videos can be attached.");
    for (const file of list) {
      if (items.length + uploading.length >= MAX_ATTACHMENTS) {
        setError(`A case can have up to ${MAX_ATTACHMENTS} files.`);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is too big (max ${fmtSize(MAX_ATTACHMENT_BYTES)}).`);
        continue;
      }
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setUploading((u) => [...u, { key, name: file.name, pct: 0 }]);
      try {
        const blob = await upload(`ia-evidence/${safe(file.name)}`, file, {
          access: "private",
          handleUploadUrl: "/api/ia/upload",
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setUploading((u) => u.map((x) => (x.key === key ? { ...x, pct: percentage } : x))),
        });
        setItems((it) => [
          ...it,
          {
            att: { url: blob.url, pathname: blob.pathname, name: file.name, type: file.type || blob.contentType, size: file.size },
            preview: URL.createObjectURL(file),
          },
        ]);
      } catch (e) {
        const msg = (e as Error).message;
        setError(
          /client token/i.test(msg)
            ? `Couldn't upload ${file.name}: the website refused the upload (storage not connected, or you're logged out).`
            : `Couldn't upload ${file.name}: ${msg}`,
        );
      } finally {
        setUploading((u) => u.filter((x) => x.key !== key));
      }
    }
  }

  const src = (it: Item) => it.preview ?? (caseId !== undefined && it.savedIndex !== undefined ? `/api/ia/evidence/${caseId}/${it.savedIndex}` : "");

  return (
    <div>
      <div className="field-label">Photos &amp; videos</div>
      <input type="hidden" name="attachments" value={JSON.stringify(items.map((i) => i.att))} />
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed px-4 py-7 text-center transition-colors ${
          drag ? "border-navy bg-panel" : "border-border hover:border-navy"
        }`}
      >
        <ImagePlus className="text-navy" size={26} />
        <span className="font-display uppercase tracking-wide text-navy">Attach photos or videos</span>
        <span className="text-sm text-muted-foreground">
          {ready === false
            ? "Uploads aren't set up yet — storage needs to be connected in Vercel"
            : `Click or drag files here · up to ${fmtSize(MAX_ATTACHMENT_BYTES)} each · stored privately for Internal Affairs only`}
        </span>
      </button>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {(items.length > 0 || uploading.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <figure key={it.att.url} className="group relative overflow-hidden rounded-sm border border-border bg-black/5">
              {it.att.type.startsWith("video/") ? (
                src(it) ? (
                  <video src={src(it)} controls preload="metadata" className="aspect-video w-full bg-black object-contain" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-black/80 text-white">
                    <FileVideo size={30} />
                  </div>
                )
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src(it)} alt={it.att.name} className="aspect-video w-full bg-black/80 object-contain" />
              )}
              <figcaption className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                <span className="truncate" title={it.att.name}>
                  {it.att.name}
                </span>
                <span className="shrink-0 text-muted-foreground">{fmtSize(it.att.size)}</span>
              </figcaption>
              <button
                type="button"
                onClick={() => setItems((all) => all.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white opacity-90 hover:bg-destructive"
                aria-label={`Remove ${it.att.name}`}
              >
                <X size={14} />
              </button>
            </figure>
          ))}
          {uploading.map((u) => (
            <div key={u.key} className="flex flex-col justify-center gap-2 rounded-sm border border-dashed border-border p-4 text-sm">
              <div className="flex items-center gap-2 truncate">
                <Loader2 size={14} className="shrink-0 animate-spin" /> {u.name}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel">
                <div className="h-full bg-navy transition-[width]" style={{ width: `${u.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {items.some((i) => i.preview) && (
        <p className="mt-2 text-sm text-muted-foreground">New files are added to the case when you save it.</p>
      )}
    </div>
  );
}
