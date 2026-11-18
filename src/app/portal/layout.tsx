import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employee Portal", robots: { index: false } };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <section className="hero-pattern text-white">
        <div className="container-x py-10">
          <div className="eyebrow mb-1">Georgia State Patrol</div>
          <h1 className="text-4xl font-semibold uppercase">Employee Portal</h1>
        </div>
      </section>
      <div className="container-x py-10">{children}</div>
    </>
  );
}
