/**
 * Site-wide settings. Edit text and images here.
 *
 * IMAGES: drop files into /public/images and put the path here, e.g. "/images/hero.jpg".
 * Leave as null to use the built-in placeholder.
 */
export const site = {
  name: "Florida Highway Patrol",
  subtitle: "Highway Safety and Motor Vehicles",
  community: "Florida State Roleplay",
  game: "Emergency Response: Liberty County",
  shortName: "FHP",

  images: {
    logo: "/images/fhp-seal.png" as string | null,
    /** Florida State Roleplay logo, shown next to the community name at the very top of the site. */
    communityLogo: "/images/fsrp-logo.png" as string | null,
    hero: "/images/fhp-hero.jpg" as string | null,
    // Looping background video on the home page (plays muted, on repeat). Set to null to use the hero photo instead.
    heroVideo: null as { webm: string; mp4: string; poster: string } | null,
    mission: null as string | null,
    // Background photos behind each page's title banner (set to null for plain navy)
    headers: {
      commandStaff: "/images/fhp-hero-2.jpg",
      divisions: "/images/fhp-hero.jpg",
      apply: "/images/fhp-hero-2.jpg",
      report: "/images/fhp-hero.jpg",
      roster: "/images/fhp-hero-2.jpg",
      department: "/images/fhp-hero.jpg",
      notifications: "/images/fhp-hero-2.jpg",
      profile: "/images/fhp-hero.jpg",
    } as Record<string, string | null>,
    // "On Patrol" photo strip on the home page — add FHP screenshots here
    gallery: [] as { src: string; alt: string }[],
  },

  discordInvite: null as string | null, // e.g. "https://discord.gg/xxxx"

  cadetRequirements: [
    "You must be a member of the Florida State Roleplay Discord.",
    "You must be at least 13 years of age.",
    "You must have a working microphone and be able to use radio communication.",
    "You must be professional, mature and respectful toward civilians and staff.",
  ],
  minimumAge: 13,
};

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/command-staff", label: "Command Staff" },
  { href: "/divisions", label: "Divisions" },
  { href: "/roster", label: "Roster" },
  { href: "/apply", label: "Cadet Application" },
  { href: "/report", label: "Report a Trooper" },
];

/** Extra nav links shown only to logged-in department personnel (never to the public). */
export const personnelNavLinks = [{ href: "/department", label: "Department Info" }];
