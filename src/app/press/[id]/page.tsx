import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/400-italic.css";
import "@fontsource/merriweather/700.css";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Pencil } from "lucide-react";
import { PressDocument } from "@/components/PressDocument";
import { getPressRelease, pressImageUrl, toPressDoc } from "@/lib/press";
import { getViewer } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/press/[id]">): Promise<Metadata> {
  const n = await getPressRelease(Number((await params).id)).catch(() => null);
  if (!n) return { title: "Press Release" };
  return {
    title: n.title,
    description: n.body.slice(0, 180),
    openGraph: { title: n.title, images: [{ url: pressImageUrl(n) }] },
  };
}

export default function PressReleasePage({ params }: PageProps<"/press/[id]">) {
  return (
    <section className="bg-panel py-10 sm:py-14">
      <div className="mx-auto max-w-4xl px-3 sm:px-6">
        <Suspense fallback={<div className="h-[80vh] animate-pulse rounded-sm bg-card" />}>
          <Release params={params} />
        </Suspense>
      </div>
    </section>
  );
}

async function Release({ params }: { params: PageProps<"/press/[id]">["params"] }) {
  const id = Number((await params).id);
  const [n, viewer] = await Promise.all([getPressRelease(id), getViewer()]);
  if (!n) notFound();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/notifications?type=press" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
          <ArrowLeft size={16} /> All press releases
        </Link>
        {viewer?.can("press") && (
          <Link href={`/portal/notifications?edit=${n.id}`} className="btn btn-navy text-sm">
            <Pencil size={14} /> Edit release
          </Link>
        )}
      </div>
      <article className="overflow-hidden rounded-sm shadow-lg ring-1 ring-black/10">
        <PressDocument doc={toPressDoc(n)} sealUrl="/images/fhp-seal.png" k={0.72} padX="8%" />
      </article>
    </>
  );
}
