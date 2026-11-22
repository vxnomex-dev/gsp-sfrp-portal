import "server-only";

export const env = {
  baseUrl: (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  sessionSecret: process.env.SESSION_SECRET || "",

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    /** Developer Portal → General Information → Public Key. Used to verify button clicks really come from Discord. */
    publicKey: process.env.DISCORD_PUBLIC_KEY || "01bba59ada9f629a098ed1406081e0147332b375c4e87c536581d702d05a068c",
  },

  // Server, roles and channels are chosen on Portal → Discord Setup (see lib/config.ts).

  /** Only works when NODE_ENV !== "production". Lets you preview the portal without Discord set up. */
  devLogin: process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production",
};

export const discordConfigured = () =>
  Boolean(env.discord.clientId && env.discord.clientSecret && env.sessionSecret);
