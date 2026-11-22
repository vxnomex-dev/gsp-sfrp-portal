import { site } from "@/lib/site";

/** Department seal. Uses /public image from site.images.logo when set, otherwise an original placeholder badge. */
export function Logo({ size = 56 }: { size?: number }) {
  if (site.images.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={site.images.logo} alt={`${site.name} seal`} className="w-auto shrink-0 object-contain drop-shadow" style={{ height: size }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={`${site.name} badge`} role="img">
      <circle cx="32" cy="32" r="30" fill="oklch(24% 0.1 264)" stroke="oklch(79% 0.15 84)" strokeWidth="3" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="oklch(79% 0.15 84)" strokeWidth="1" strokeDasharray="2 2.5" />
      <path
        d="M32 13l4.7 9.6 10.6 1.5-7.7 7.4 1.8 10.5L32 37l-9.4 5 1.8-10.5-7.7-7.4 10.6-1.5z"
        fill="oklch(79% 0.15 84)"
      />
      <text x="32" y="53" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="600" fontSize="9" fill="white" letterSpacing="1">
        {site.shortName}
      </text>
    </svg>
  );
}
