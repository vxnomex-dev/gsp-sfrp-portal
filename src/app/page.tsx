import Link from "next/link";
import { ArrowRight, ShieldCheck, Siren, Users, FileWarning, ClipboardList } from "lucide-react";
import { site } from "@/lib/site";
import { Logo } from "@/components/Logo";

const features = [
  {
    icon: ShieldCheck,
    title: "Traffic Enforcement",
    body: "Troopers patrol the interstates and state routes, enforcing traffic law, working collisions and keeping the highways safe for every citizen.",
  },
  {
    icon: Siren,
    title: "Specialized Divisions",
    body: "From the Nighthawks to the Special Response Team, our divisions give experienced troopers a place to specialize and lead.",
    href: "/divisions",
  },
  {
    icon: Users,
    title: "Community Trust",
    body: "Every trooper answers to the public. Our Professional Standards Bureau reviews every complaint made against a member of the Patrol.",
    href: "/report",
  },
];

const divisionNames = [
  "Nighthawks",
  "Crime Suppression Unit",
  "Special Response Team",
  "Criminal Interdiction Unit",
  "Professional Standards Bureau",
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden text-white">
        {site.images.heroVideo ? (
          <>
            {/* Looping background video. Muted + playsInline lets it autoplay on phones too. */}
            <video
              className="absolute inset-0 h-full w-full object-cover brightness-[1.3] motion-reduce:hidden"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={site.images.heroVideo.poster}
              aria-hidden="true"
            >
              <source src={site.images.heroVideo.webm} type="video/webm" />
              <source src={site.images.heroVideo.mp4} type="video/mp4" />
            </video>
            {/* People who turn off animations in their device settings get a still frame instead. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={site.images.heroVideo.poster}
              alt=""
              className="absolute inset-0 hidden h-full w-full object-cover brightness-[1.3] motion-reduce:block"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/95 via-navy-deep/55 to-transparent" />
          </>
        ) : site.images.hero ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.images.hero} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center] brightness-[1.35]" />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/95 via-navy-deep/55 to-transparent" />
          </>
        ) : (
          <div className="hero-pattern absolute inset-0">
            <div className="absolute -right-24 top-1/2 hidden -translate-y-1/2 opacity-[0.12] lg:block">
              <Logo size={560} />
            </div>
          </div>
        )}
        <div className="container-x relative py-28 md:py-36">
          <div className="eyebrow mb-4">{site.subtitle}</div>
          <h1 className="text-5xl font-semibold uppercase leading-[1.05] md:text-7xl">{site.name}</h1>
          <p className="mt-6 max-w-xl text-lg text-white/90 md:text-xl">
            Highway safety, traffic enforcement and public service across {site.community} on {site.game}.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/apply" className="btn btn-gold">
              Apply as a Cadet <ArrowRight size={18} />
            </Link>
            <Link href="/command-staff" className="btn btn-outline-light">
              Command Staff
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-16">
        <div className="container-x grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body, href }) => (
            <div key={title} className="card card-gold p-7">
              <Icon className="text-navy" size={30} strokeWidth={1.8} />
              <h3 className="mt-5 text-2xl font-semibold uppercase text-navy-ink">{title}</h3>
              <p className="mt-3 text-muted-foreground">{body}</p>
              {href && (
                <Link href={href} className="mt-4 inline-flex items-center gap-1 font-display text-sm uppercase tracking-wide text-navy hover:text-gold">
                  Learn more <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* MISSION */}
      <section className="bg-panel py-20">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-navy-deep shadow-lg">
            {site.images.mission ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.images.mission} alt="Georgia State Patrol troopers on duty" className="h-full w-full object-cover" />
            ) : (
              <div className="hero-pattern flex h-full w-full flex-col items-center justify-center gap-4 text-white/80">
                <Logo size={120} />
                <span className="font-display text-sm uppercase tracking-[0.2em]">Department photo coming soon</span>
              </div>
            )}
          </div>
          <div>
            <div className="eyebrow mb-3">Our Mission</div>
            <h2 className="text-4xl font-semibold uppercase text-navy-ink">Courtesy. Professionalism. Integrity.</h2>
            <p className="mt-5 text-lg text-muted-foreground">
              The Georgia State Patrol is the primary state law enforcement agency of {site.community}. Troopers hold the
              line on the highways, assist local agencies, and represent the department to the public with discipline
              and respect.
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              Every trooper is expected to uphold the standards of the department both in service and in conduct — on
              duty, in the Discord, and in public channels.
            </p>
            <Link href="/divisions" className="mt-6 inline-flex items-center gap-2 font-display uppercase tracking-wide text-navy hover:text-gold">
              Explore our divisions <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ON PATROL GALLERY */}
      {site.images.gallery.length > 0 && (
        <section className="bg-navy-deep py-16 text-white">
          <div className="container-x">
            <div className="eyebrow mb-2">On Patrol</div>
            <h2 className="text-3xl font-semibold uppercase">Across {site.community}</h2>
            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {site.images.gallery.map((g) => (
                <figure key={g.src} className="group relative aspect-[4/3] overflow-hidden rounded-sm border-b-[3px] border-gold bg-navy">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.src}
                    alt={g.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DIVISIONS STRIP */}
      <section className="py-16">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2 !text-navy">Specialized Units</div>
              <h2 className="text-3xl font-semibold uppercase text-navy-ink">Divisions of the Patrol</h2>
            </div>
            <Link href="/divisions" className="btn btn-outline">
              View all divisions
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {divisionNames.map((n) => (
              <Link
                key={n}
                href="/divisions"
                className="card group flex min-h-24 items-end border-l-4 !border-l-navy p-4 transition-colors hover:!border-l-gold"
              >
                <span className="font-display text-lg uppercase leading-tight text-navy-ink group-hover:text-navy">{n}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="container-x grid gap-6 md:grid-cols-2">
          <div className="hero-pattern rounded-sm p-8 text-white">
            <ClipboardList className="text-gold" size={30} />
            <h3 className="mt-4 text-3xl font-semibold uppercase">Join the Patrol</h3>
            <p className="mt-2 text-white/85">
              Think you have what it takes to wear the badge? Submit a cadet application — command staff review every one.
            </p>
            <Link href="/apply" className="btn btn-gold mt-6">
              Start your application <ArrowRight size={18} />
            </Link>
          </div>
          <div className="card card-gold p-8">
            <FileWarning className="text-navy" size={30} />
            <h3 className="mt-4 text-3xl font-semibold uppercase text-navy-ink">Report a Trooper</h3>
            <p className="mt-2 text-muted-foreground">
              Had a negative experience with a member of the Patrol? Reports go directly and confidentially to the
              Professional Standards Bureau.
            </p>
            <Link href="/report" className="btn btn-navy mt-6">
              File a report <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
