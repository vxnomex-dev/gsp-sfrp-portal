import Link from "next/link";

export default function NotFound() {
  return (
    <section className="py-28 text-center">
      <div className="font-display text-8xl font-semibold text-navy-ink">404</div>
      <h1 className="mt-2 text-2xl uppercase text-navy-ink">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <Link href="/" className="btn btn-navy mt-6">
        Go home
      </Link>
    </section>
  );
}
