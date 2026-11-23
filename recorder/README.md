# FHP voice recorder

The always-on half of `/record`. The website receives the slash command and queues the recording; this program
(logged in as the **same bot**) joins the voice channel, records everyone, and posts the audio when it stops.

It has to run 24/7 on something that stays on — the website (Vercel) can't hold a voice connection.

## What it records
- **Everyone** — the whole conversation mixed into one file.
- **One file per speaker**, all lined up to the start of the recording.
- Opus (`.ogg`) audio. Long recordings are split into parts that fit Discord's upload limit.
- Posted in the **Voice recordings** channel picked on Portal → Discord Setup (or DMed to whoever started it if none is set).

While recording, the bot's nickname starts with `[RECORDING]` and it posts a notice in the voice channel's chat.
It stops on `/record stop`, when everyone has left for a minute, or after 4 hours (`MAX_RECORDING_HOURS`).

## Settings (environment variables)
| Name | Value |
| --- | --- |
| `DISCORD_BOT_TOKEN` | The same bot token the website uses |
| `DATABASE_URL` | The same database URL the website uses (Neon) |
| `MAX_RECORDING_HOURS` | Optional, default `4` |

## Run it
**Railway / Render / Fly.io:** deploy this repository with the root directory set to `recorder` (it has a Dockerfile),
add the variables above, and start it. One instance only.

**Any computer or VPS with Node 22+:**
```
cd recorder
npm ci
DISCORD_BOT_TOKEN=... DATABASE_URL=... npm start
```
