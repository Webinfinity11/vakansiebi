#!/bin/zsh
# Keep launchd outside Desktop so terminal closure and macOS privacy protection
# do not stop collection. Re-run after worker code changes.
set -eu
project="$(cd "$(dirname "$0")/.." && pwd)"
runtime="$HOME/.local/share/jobx-gov-worker"
plist="$HOME/Library/LaunchAgents/ge.ertad.gov-sources.plist"
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$runtime/scripts" "$runtime/.local" "$HOME/Library/LaunchAgents"
chmod 700 "$runtime"
launchctl bootout "gui/$(id -u)/ge.ertad.gov-sources" 2>/dev/null || true
for dir in lib worker; do
  rsync -a --delete "$project/$dir/" "$runtime/$dir/"
done
cp "$project/package.json" "$project/package-lock.json" "$project/tsconfig.json" "$runtime/"
cp "$project/scripts/local-gov-sources.sh" "$runtime/scripts/"
cd "$project"
node --input-type=module - "$runtime/.env" <<'JS'
import dotenv from 'dotenv';
import fs from 'node:fs';
dotenv.config({path:['.env.local','.env'],quiet:true});
if(!process.env.DATABASE_URL) throw Error('DATABASE_URL is not configured');
fs.writeFileSync(process.argv[2],`DATABASE_URL=${JSON.stringify(process.env.DATABASE_URL)}\nAPP_URL=https://jobx.ge\n`,{mode:0o600});
JS
cd "$runtime"
npm ci --ignore-scripts --no-audit --no-fund >/dev/null
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ge.ertad.gov-sources</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$runtime/scripts/local-gov-sources.sh</string></array>
  <key>WorkingDirectory</key><string>$runtime</string>
  <key>StartInterval</key><integer>10800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$runtime/.local/gov-sources.log</string>
  <key>StandardErrorPath</key><string>$runtime/.local/gov-sources.log</string>
</dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$plist"
launchctl print "gui/$(id -u)/ge.ertad.gov-sources" | rg 'state =|pid =|last exit code ='
echo "Government collector installed; logs: $runtime/.local/gov-sources.log"
