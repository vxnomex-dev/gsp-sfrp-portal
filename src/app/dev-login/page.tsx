import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";

/** Local preview only: pick a fake role to see the site as different users. 404s in production. */
export default function DevLoginPage({ searchParams }: PageProps<"/dev-login">) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-xl px-5">
        <Suspense>
          <Picker searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function Picker({ searchParams }: { searchParams: PageProps<"/dev-login">["searchParams"] }) {
  await connection();
  if (!env.devLogin) notFound();
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/portal";
  const options = [
    ["public", "Member of the public (no GSP roles)"],
    ["employee", "Trooper (employee role)"],
    ["command", "Command Staff"],
    ["psb", "Human Resources"],
    ["all", "Command Staff + Human Resources"],
    ["ootc", "Office of the Colonel"],
    ["press", "Press Release Team (civilian)"],
  ];
  return (
    <div className="card card-gold p-8">
      <h1 className="text-2xl font-semibold uppercase text-navy-ink">Local preview login</h1>
      <p className="mt-2 text-muted-foreground">
        Discord isn&apos;t configured yet, so pick who to preview the site as. This page only exists when
        DEV_LOGIN=true and is disabled in production.
      </p>
      <div className="mt-6 grid gap-2">
        {options.map(([as, label]) => (
          <form key={as} action="/api/auth/dev" method="post">
            <input type="hidden" name="as" value={as} />
            <input type="hidden" name="next" value={next} />
            <button className="btn btn-outline w-full !justify-start">{label}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
