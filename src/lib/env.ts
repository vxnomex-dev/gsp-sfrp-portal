import "server-only";

export const env = {
  /** The live website address (Discord login, links in bot messages). SITE_URL overrides it. */
  baseUrl: (
    process.env.SITE_URL ||
    (process.env.VERCEL_ENV === "production" ? "https://fhpvcfsrp.site" : process.env.PUBLIC_BASE_URL || "http://localhost:3000")
  ).replace(/\/$/, ""),
  sessionSecret: process.env.SESSION_SECRET || "",

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    /** Developer Portal → General Information → Public Key. Used to verify button clicks really come from Discord. */
    publicKey: process.env.DISCORD_PUBLIC_KEY || "01bba59ada9f629a098ed1406081e0147332b375c4e87c536581d702d05a068c",
  },

  /** Dock (docksys.xyz) — links Discord accounts to Roblox for the Verify button. Key from the Dock dashboard. */
  dock: {
    apiKey: process.env.DOCK_API_KEY || "",
    /** Where unverified members are sent to link their Roblox account. */
    verifyUrl: process.env.DOCK_VERIFY_URL || "https://docksys.xyz",
  },

  // Server, roles and channels are chosen on Portal → Discord Setup (see lib/config.ts).

  /** Only works when NODE_ENV !== "production". Lets you preview the portal without Discord set up. */
  devLogin: process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production",
};

export const discordConfigured = () =>
  Boolean(env.discord.clientId && env.discord.clientSecret && env.sessionSecret);
