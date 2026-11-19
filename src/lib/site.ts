/**
 * Site-wide settings. Edit text and images here.
 *
 * IMAGES: drop files into /public/images and put the path here, e.g. "/images/hero.jpg".
 * Leave as null to use the built-in placeholder.
 */
export const site = {
  name: "Georgia State Patrol",
  subtitle: "Department of Public Safety",
  community: "South Fulton Roleplay",
  game: "Emergency Response: Liberty County",
  shortName: "GSP",

  images: {
    logo: "/images/gsp-seal.png" as string | null,
    hero: "/images/post-charger.jpg" as string | null,
    // Looping background video on the home page (plays muted, on repeat). Set to null to use the hero photo instead.
    heroVideo: {
      webm: "/images/hero.webm",
      mp4: "/images/hero.mp4",
      poster: "/images/hero-poster.jpg",
    } as { webm: string; mp4: string; poster: string } | null,
    mission: "/images/traffic-stop.jpg" as string | null,
    // Background photos behind each page's title banner (set to null for plain navy)
    headers: {
      commandStaff: "/images/explorer-pier.jpg",
      divisions: "/images/charger-profile.jpg",
      apply: "/images/moonlight-charger.jpg",
      report: "/images/explorer-rear.jpg",
      roster: "/images/post-charger.jpg",
      department: "/images/traffic-stop.jpg",
      notifications: "/images/moonlight-charger.jpg",
      profile: "/images/explorer-pier.jpg",
    } as Record<string, string | null>,
    // "On Patrol" photo strip on the home page
    gallery: [
      { src: "/images/charger-profile.jpg", alt: "Georgia State Patrol Charger at night" },
      { src: "/images/moonlight-charger.jpg", alt: "GSP K-9 unit under a full moon" },
      { src: "/images/explorer-rear.jpg", alt: "GSP Explorer with lights activated" },
      { src: "/images/explorer-pier.jpg", alt: "GSP Explorer parked on the pier" },
    ],
  },

  discordInvite: null as string | null, // e.g. "https://discord.gg/xxxx"

  /** #cadet-dashboard — accepted applicants are told to read this channel. */
  cadetDashboardChannelId: "1571798585769463860",

  cadetRequirements: [
    "You must be a member of the South Fulton Roleplay Discord.",
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
