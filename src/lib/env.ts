import "server-only";

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  baseUrl: (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  sessionSecret: process.env.SESSION_SECRET || "",

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    /** Developer Portal → General Information → Public Key. Used to verify button clicks really come from Discord. */
    publicKey: process.env.DISCORD_PUBLIC_KEY || "01bba59ada9f629a098ed1406081e0147332b375c4e87c536581d702d05a068c",
    guildId: process.env.DISCORD_GUILD_ID || "1558194098890874971", // South Fulton Roleplay
  },

  /** Optional: normally read automatically from the applications webhook. */
  applicationsChannelId: process.env.APPLICATIONS_CHANNEL_ID || "",

  webhooks: {
    applications: process.env.APPLICATIONS_WEBHOOK_URL || "",
    reports: process.env.REPORTS_WEBHOOK_URL || "",
  },

  roles: {
    /** Supervisor, Patrol, Department Personnel — access to the employee portal. */
    employee: list(
      process.env.ROLE_EMPLOYEE_IDS || "1558194099268358282,1558194099268358274,1558194099197059241",
    ),
    /** Office of the Colonel + High Command — review applications AND edit site content. */
    commandStaff: list(process.env.ROLE_COMMAND_STAFF_IDS || "1558194099327074422,1558194099327074418"),
    /** Command — can review applications (no content editing). */
    applicationReviewers: list(process.env.ROLE_APPLICATION_REVIEWER_IDS || "1558194099297853566"),
    /** Professional Standards Bureau. The ONLY role that can see trooper reports. */
    psb: list(process.env.ROLE_PSB_IDS || "1558194098995732496"),
  },

  pingRoles: {
    applications: process.env.APPLICATIONS_PING_ROLE_ID || "1558194099327074418",
    reports: process.env.REPORTS_PING_ROLE_ID || "1558194098995732496",
  },

  /** Only works when NODE_ENV !== "production". Lets you preview the portal without Discord set up. */
  devLogin: process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production",
};

export const discordConfigured = () =>
  Boolean(env.discord.clientId && env.discord.clientSecret && env.sessionSecret);
