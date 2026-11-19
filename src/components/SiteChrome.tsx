import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { UserMenu, UserMenuFallback } from "./UserMenu";
import { navLinks, personnelNavLinks, site } from "@/lib/site";
import { getViewer } from "@/lib/session";

function NavLinksStatic() {
  return (
    <ul className="hidden md:flex">
      {navLinks.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className="block px-4 py-3.5 font-display text-[0.95rem] uppercase tracking-wide text-white">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Public links for everyone, plus Department Info for logged-in personnel. */
async function NavLinksForViewer() {
  const viewer = await getViewer().catch(() => null);
  return <NavLinks links={viewer?.can("portal") ? [...navLinks, ...personnelNavLinks] : navLinks} />;
}

export function Header() {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-navy-deep text-[0.8rem] text-white/85">
        <div className="container-x flex h-7 items-center justify-between gap-4">
          <span className="truncate">
            {site.community} — {site.game}
          </span>
          <span className="hidden sm:inline">Roleplay community · Not a real agency</span>
        </div>
      </div>
      <div className="bg-navy">
        <div className="container-x flex h-20 items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Logo size={48} />
            <div className="leading-none">
              <div className="font-display text-lg font-semibold uppercase leading-tight tracking-wide text-white sm:text-[1.4rem]">
                {site.name}
              </div>
              <div className="mt-1 hidden font-display text-[0.7rem] uppercase tracking-[0.2em] text-gold min-[440px]:block sm:text-xs">
                {site.subtitle}
              </div>
            </div>
          </Link>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
      <nav className="border-b-[3px] border-gold bg-navy-deep">
        <div className="container-x">
          <Suspense fallback={<NavLinksStatic />}>
            <NavLinksForViewer />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t-[3px] border-gold bg-navy-deep text-white">
      <div className="container-x grid gap-10 py-12 md:grid-cols-3">
        <div className="flex gap-4">
          <Logo size={52} />
          <div>
            <div className="font-display text-xl uppercase">{site.name}</div>
            <p className="mt-1 text-sm text-white/75">
              Serving the citizens of {site.community} with courtesy, professionalism and integrity.
            </p>
          </div>
        </div>
        <div>
          <div className="eyebrow mb-3">Department</div>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-gold" href="/command-staff">Command Staff</Link></li>
            <li><Link className="hover:text-gold" href="/divisions">Divisions</Link></li>
            <li><Link className="hover:text-gold" href="/roster">Roster</Link></li>
            <li><Link className="hover:text-gold" href="/apply">Cadet Application</Link></li>
            <li><Link className="hover:text-gold" href="/report">Report a Trooper</Link></li>
            <li><Link className="hover:text-gold" href="/portal">Employee Portal</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Notice</div>
          <p className="text-sm text-white/75">
            This site represents the Georgia State Patrol within {site.community} on {site.game}. It is a roleplay
            community and is not affiliated with the real Georgia Department of Public Safety.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {site.name} — {site.community}
      </div>
    </footer>
  );
}

export function PageHeader({
  eyebrow,
  title,
  image,
  children,
}: {
  eyebrow: string;
  title: string;
  image?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section className="hero-pattern relative overflow-hidden text-white">
      {image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover brightness-125" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy-deep/75 to-navy-deep/10" />
        </>
      )}
      <div className="container-x relative py-14 md:py-20">
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="text-4xl font-semibold uppercase md:text-5xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-lg text-white/85">{children}</div>}
      </div>
    </section>
  );
}
