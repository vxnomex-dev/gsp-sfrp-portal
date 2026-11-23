/**
 * A press release laid out like an official letter: navy bar, seal, office block, headline, body, PIO signature.
 * Written with inline flexbox styles only, so the same markup renders on the website and as the PNG
 * posted to Discord (next/og, which supports only a subset of CSS).
 */

export const PRESS_NAVY = "#14245a";
export const PRESS_GOLD = "#e3b23c";

export type PressDoc = { title: string; body: string; author: string; date: string };

/** Splits the body into paragraphs: blank lines start a new paragraph, single line breaks are kept. */
export function pressParagraphs(body: string) {
  return body
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Rough height (px) the 1240px-wide image needs, so the PNG isn't cut off or mostly empty. */
export function pressImageHeight(doc: PressDoc) {
  const lines = (s: string, perLine: number) => s.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  const title = lines(doc.title, 34) * 66;
  const body = pressParagraphs(doc.body).reduce((h, p) => h + lines(p, 80) * 39 + 30, 0);
  return Math.max(1000, 64 + 300 + title + 90 + body + 220);
}

export function PressDocument({ doc, sealUrl, k = 1, padX = 110 }: { doc: PressDoc; sealUrl: string; k?: number; padX?: number | string }) {
  const px = (n: number) => Math.round(n * k);
  const rule = { display: "flex", height: 2, background: "#c9ccd4" };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#ffffff",
        color: "#151515",
        fontFamily: "Merriweather, Georgia, serif",
      }}
    >
      {/* Navy bar with a gold stripe */}
      <div style={{ display: "flex", height: px(46), background: PRESS_NAVY }} />
      <div style={{ display: "flex", height: px(7), background: PRESS_GOLD }} />

      {/* Seal + "Florida Highway Patrol / Press Release" */}
      <div style={{ display: "flex", alignItems: "center", padding: `${px(22)}px ${px(30)}px 0` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sealUrl} width={px(110)} height={px(110)} alt="" style={{ width: px(110), height: px(110) }} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: px(26), fontStyle: "italic", fontSize: px(25), lineHeight: 1.35 }}>
          <span>Florida Highway Patrol</span>
          <span>Press Release</span>
        </div>
      </div>

      {/* Office block */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: px(23), lineHeight: 1.45, marginTop: px(4) }}>
        <span style={{ fontWeight: 700 }}>Office of Public Affairs</span>
        <span>Florida Highway Patrol</span>
        <span>{doc.date}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: typeof padX === "number" ? `0 ${px(padX)}px` : `0 ${padX}` }}>
        <div style={{ ...rule, marginTop: px(30) }} />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
            fontWeight: 700,
            fontSize: px(52),
            lineHeight: 1.25,
            padding: `${px(14)}px 0 ${px(18)}px`,
          }}
        >
          {doc.title}
        </div>
        <div style={{ display: "flex", height: px(3), background: "#151515" }} />

        <div style={{ display: "flex", flexDirection: "column", fontSize: px(24), lineHeight: 1.62, marginTop: px(20) }}>
          {pressParagraphs(doc.body).map((p, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", marginBottom: px(28) }}>
              {p.split("\n").map((line, j) => (
                <span key={j}>{line}</span>
              ))}
            </div>
          ))}
        </div>

        <div style={{ ...rule, marginTop: px(16) }} />
        <div style={{ display: "flex", flexDirection: "column", fontSize: px(24), lineHeight: 1.5, marginTop: px(12), paddingBottom: px(50) }}>
          <div style={{ display: "flex" }}>
            <span style={{ fontWeight: 700 }}>PIO</span>
            <span style={{ fontStyle: "italic", marginLeft: px(9) }}>{doc.author}</span>
          </div>
          <span style={{ fontWeight: 700 }}>Public Affairs Division</span>
        </div>
      </div>
    </div>
  );
}
