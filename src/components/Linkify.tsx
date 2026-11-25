/** Turns http(s) links in plain text into clickable links. */
export function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        /^https?:\/\/\S+$/.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="break-all text-navy underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
