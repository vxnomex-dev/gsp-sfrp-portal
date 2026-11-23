#!/bin/bash
# Florida Highway Patrol — voice recorder for Mac.
# Double-click to start. Keep this window open while you record. Close it when you're done.
cd "$(dirname "$0")" || exit 1
clear
echo "=========================================="
echo "  Florida Highway Patrol - Voice Recorder"
echo "=========================================="
echo

# 1. Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed yet."
  echo "Opening the download page — install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

# 2. Settings (asked once, saved in this folder only)
if [ ! -f .env ]; then
  echo "First-time setup. These stay on this computer, in the file .env in this folder."
  echo
  echo "Bot token: Discord Developer Portal -> your bot -> Bot -> Token"
  echo "           (the same token the website uses)"
  read -r -s -p "Paste the bot token, then press Enter: " TOKEN; echo
  echo
  echo "Database URL: Vercel -> gsp-sfrp-portal -> Settings -> Environment Variables -> DATABASE_URL"
  read -r -s -p "Paste the database URL, then press Enter: " DBURL; echo
  if [ -z "$TOKEN" ] || [ -z "$DBURL" ]; then
    echo "Both are needed. Double-click this file to try again."
    read -n 1 -s -r -p "Press any key to close."
    exit 1
  fi
  printf "DISCORD_BOT_TOKEN='%s'\nDATABASE_URL='%s'\n" "$TOKEN" "$DBURL" > .env
  chmod 600 .env
  echo "Saved."
  echo
fi

# 3. Install (first run only, or after an update)
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "Installing (first run takes a minute or two)..."
  npm install --omit=dev --no-audit --no-fund || { read -n 1 -s -r -p "Install failed. Press any key to close."; exit 1; }
  touch node_modules
  echo
fi

set -a; source .env; set +a
echo "Recorder is ON. In Discord: join a voice channel and use /record start."
echo "Use /record stop when the conversation is over — wait for the files to post before closing this window."
echo "(To change the token or database URL, delete the .env file in this folder.)"
echo
# caffeinate keeps the Mac awake while this window is open
exec caffeinate -i npx tsx src/index.ts
