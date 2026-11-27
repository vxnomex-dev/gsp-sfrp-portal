import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/400-italic.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/dancing-script/600.css";
import { NDA_INTRO, NDA_TERMS, NDA_TITLE } from "@/lib/nda-text";

type Party = { signature: string | null; name: string | null; date: string | null };

const serif = { fontFamily: "Merriweather, Georgia, serif" };
const script = { fontFamily: "'Dancing Script', cursive" };

function SignatureLine({ label, party }: { label: string; party: Party }) {
  return (
    <div className="grid grid-cols-[1fr_9rem] items-end gap-6">
      <div>
        <div className="flex min-h-12 items-end border-b-2 border-[#151515] pb-1">
          {party.signature ? (
            <span style={script} className="text-3xl leading-none text-[#14245a]">
              {party.signature}
            </span>
          ) : (
            <span className="text-sm italic text-[#8a8f9c]">Not yet signed</span>
          )}
        </div>
        <div className="mt-1 text-sm">
          <strong>{label}:</strong> {party.name ?? "—"}
        </div>
      </div>
      <div>
        <div className="flex min-h-12 items-end border-b-2 border-[#151515] pb-1 text-[0.95rem]">{party.date ?? ""}</div>
        <div className="mt-1 text-sm">
          <strong>Date</strong>
        </div>
      </div>
    </div>
  );
}

/** The agreement laid out as a signed document (FHP letterhead). */
export function NdaDocument({ invitee, rep, reference }: { invitee: Party; rep: Party; reference?: string }) {
  return (
    <div className="overflow-hidden rounded-sm bg-white text-[#151515] shadow-lg ring-1 ring-black/10" style={serif}>
      <div className="h-8 bg-[#14245a]" />
      <div className="h-1.5 bg-[#e3b23c]" />
      <div className="px-6 pb-10 pt-6 sm:px-14">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/fhp-seal.png" alt="" className="h-16 w-16" />
          <div className="text-lg italic leading-snug">
            Florida Highway Patrol
            <br />
            Office of the Colonel
          </div>
          {reference && <div className="ml-auto self-start font-sans text-xs uppercase tracking-widest text-[#8a8f9c]">{reference}</div>}
        </div>

        <h1 className="mt-8 border-b-[3px] border-[#151515] pb-3 text-center text-2xl font-bold uppercase leading-tight sm:text-3xl">{NDA_TITLE}</h1>
        <p className="mt-4 text-center italic">{NDA_INTRO}</p>

        <ol className="mt-6 space-y-4 leading-relaxed">
          {NDA_TERMS.map((t, i) => (
            <li key={t.title}>
              <strong>
                {i + 1}. {t.title}.
              </strong>{" "}
              {t.text}
            </li>
          ))}
        </ol>

        <div className="mt-10 border-t-2 border-[#c9ccd4] pt-6">
          <div className="mb-5 font-bold uppercase tracking-wide">Signatures</div>
          <div className="space-y-8">
            <SignatureLine label="Invitee" party={invitee} />
            <SignatureLine label="Department Representative" party={rep} />
          </div>
        </div>
      </div>
    </div>
  );
}
