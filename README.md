# Georgia State Patrol — South Fulton Roleplay (ERLC)

Website + employee portal for the Georgia State Patrol in South Fulton Roleplay.

**Public pages:** Home · Command Staff · Divisions · Cadet Application · Report a Trooper
**Employee portal** (Discord login, permissions synced from Discord roles):

| Discord role | What they can do on the site |
|---|---|
| Supervisor, Patrol, Department Personnel | Open the employee portal |
| Command | Portal **+** view / accept / deny cadet applications |
| Office of the Colonel, High Command | Applications **+** edit Command Staff and Divisions pages (High Command is pinged on new applications) |
| Professional Standards Bureau (`1558194098995732496`) | **Only role** that can see and work trooper reports (pinged on new reports) |

Role changes in Discord apply on the site within about 60 seconds.

---

## 1. Create the Discord application + bot (≈10 minutes)

The bot never has to be "running" — the website only uses its token to look up members' roles
(and to DM applicants when they're accepted/denied). There is nothing to host for the bot.

1. Go to <https://discord.com/developers/applications> → **New Application** → name it `GSP Portal`.
2. **OAuth2** tab:
   - Copy **Client ID** → `DISCORD_CLIENT_ID`
   - Click **Reset Secret**, copy it → `DISCORD_CLIENT_SECRET`
   - Under **Redirects**, add both:
     - `http://localhost:3000/api/auth/callback` (for testing on your PC)
     - `https://YOUR-SITE-URL/api/auth/callback` (your live URL, once you have it)
3. **Bot** tab:
   - Click **Reset Token**, copy it → `DISCORD_BOT_TOKEN` (never share this)
   - Turn **Public Bot** off
   - Turn on **Server Members Intent**
4. **Invite the bot to South Fulton Roleplay:** OAuth2 → **URL Generator** → tick `bot` →
   no permissions needed → open the generated link and add it to your server.
5. In Discord: **User Settings → Advanced → Developer Mode = ON.** Then:
   - The server ID and all role IDs are already filled in. You only need to change them if you
     create new roles (see `ROLE_*` in `.env.local`).

## 2. Run it on your computer (optional, to try it first)

Needs [Node.js 20+](https://nodejs.org).

```bash
npm install
cp .env.example .env.local   # skip if .env.local already exists, then fill it in
npm run dev
```

Open <http://localhost:3000>. No database setup is needed locally — a built-in one is stored in `./.data`.

Want to click around the portal before Discord is set up? Put `DEV_LOGIN=true` in `.env.local` and leave
`DISCORD_CLIENT_ID` empty. "Login" will then let you pick a fake role. This never works on the live site.

## 3. Put it online (free: Vercel + Neon)

1. **Database:** create a free Postgres database at <https://neon.tech> → copy the connection string → `DATABASE_URL`.
   Tables are created automatically the first time the site runs.
2. **Code:** upload this folder to a **private** GitHub repository.
3. **Hosting:** <https://vercel.com> → **Add New → Project** → import the repo.
   Before deploying, open **Environment Variables** and add every variable from `.env.local`
   (with `PUBLIC_BASE_URL` set to your Vercel URL, and `DEV_LOGIN` removed or `false`).
4. Deploy. Then add `https://YOUR-SITE.vercel.app/api/auth/callback` to the Discord app's OAuth2 Redirects.

Using a custom domain later? Update `PUBLIC_BASE_URL` and add the new callback URL to Discord.

## 4. Pictures

Your seal and patrol photos are in `public/images/`. Which photo goes where (home hero, mission section,
page banners, the "On Patrol" strip) is set in `src/lib/site.ts`. To swap one, drop a new file into
`public/images/` and change the path there.

Command staff photos can be set from the portal (**Portal → Website Content → Photo URL**), using either a
`/images/...` path or an `https://` link.

## Accept / Deny buttons in Discord

New applications are posted **by the bot** (not the webhook) so the Accept / Deny buttons work. Setup:

1. The app's **Public Key** is built into `src/lib/env.ts` (override with the `DISCORD_PUBLIC_KEY` env var).
2. Developer Portal → General Information → **Interactions Endpoint URL** =
   `https://gspsfrp.xyz/api/discord/interactions` → Save (Discord tests it immediately).
3. The bot needs **View Channel**, **Send Messages** and **Mention All Roles** in the applications channel
   (or make the High Command role mentionable). If the bot can't post, the site falls back to the webhook
   without buttons, and the portal still works.

Accepting sends the applicant a DM with their next steps (#cadet-dashboard → wait for training → FTI issues a
callsign); denying sends a short denial DM. Only Office of the Colonel, High Command and Command can click them.
Decisions made in the portal update the Discord message too.

## Support tickets (Discord)

- `/support-panel` (Manage Server only) posts the Department Assistance panel in the current channel.
- Picking **General / Divisional / Command Support** opens a "What's up?" pop-up, then the bot creates
  `general-{user}`, `divisional-{user}` or `command-{user}` in that panel's category, visible only to the opener,
  the bot and that panel's team, and replies privately with a link to the new channel.
- General → Supervisor role. Divisional and Command → High Command + Command roles.
- Staff commands inside a ticket: `/claim`, `/close [reason]`, `/close-request [reason]` (opener confirms or keeps it open).
  Closed tickets are deleted after 5 seconds. An HTML transcript is sent to the opener by DM and posted in
  #ticket-transcripts (`TRANSCRIPT_CHANNEL_ID` in `src/lib/tickets.ts`).
- Transcripts need **Message Content Intent** turned on (Developer Portal → Bot), otherwise message text is blank.
- Register the commands once from **Portal → Discord Bot**. Categories and roles live in `src/lib/tickets.ts`.
- Bot permissions needed: Manage Channels, Manage Roles, View Channels, Send Messages, Embed Links, Attach Files,
  Read Message History, Mention All Roles.

## Webhooks

New applications and reports are posted to Discord as **Components V2** messages (container + sections, not
classic embeds) and ping the matching role. The webhook URLs live in environment variables only — they are never
sent to visitors' browsers. Anyone who has a webhook URL can post into that channel, so if one leaks, delete it in
Discord (Channel Settings → Integrations → Webhooks) and paste the new URL into your env vars.

## Where to change things

| What | File |
|---|---|
| Site name, images, cadet requirements, minimum age, Discord invite | `src/lib/site.ts` |
| Cadet application questions, report categories | `src/lib/forms.ts` |
| Discord message layout | `src/lib/webhooks.ts` |
| Who can do what | `src/lib/permissions.ts` |
| Colors and fonts | `src/app/globals.css` |
| Command staff, division commanders, recruitment status | Live on the site: **Portal → Website Content** |
