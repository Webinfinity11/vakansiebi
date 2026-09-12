#!/bin/zsh
# Registers scripts/local-gov-sources.sh with launchd, every 30 minutes while this Mac is awake.
#
# macOS privacy protection blocks a launchd agent from reading files under ~/Desktop, where this
# project lives, so the agent needs Full Disk Access for /bin/zsh — or the project has to live
# outside ~/Desktop, ~/Documents and ~/Downloads. This script installs the agent and then
# verifies it can actually read the project, telling you which of the two to fix.
#
# Without launchd, `zsh scripts/local-gov-sources.sh --loop` in a terminal tab does the same job.
# Remove with: launchctl bootout gui/$(id -u)/ge.ertad.gov-sources
#              rm ~/Library/LaunchAgents/ge.ertad.gov-sources.plist ~/.ertad-project
set -eu
project="$(cd "$(dirname "$0")/.." && pwd)"
link="$HOME/.ertad-project"
plist="$HOME/Library/LaunchAgents/ge.ertad.gov-sources.plist"
log="$project/.local/gov-sources.log"
mkdir -p "$HOME/Library/LaunchAgents" "$project/.local"
# launchd mangles the Georgian letters in the project path; an ASCII symlink avoids that.
rm -f "$link"
ln -s "$project" "$link"
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ge.ertad.gov-sources</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$link/scripts/local-gov-sources.sh</string></array>
  <key>WorkingDirectory</key><string>$link</string>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$link/.local/gov-sources.log</string>
  <key>StandardErrorPath</key><string>$link/.local/gov-sources.log</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)/ge.ertad.gov-sources" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "installed: $plist"
echo "log: $log"
sleep 8
if grep -q 'Operation not permitted\|can.t open input file' "$log" 2>/dev/null; then
  echo
  echo 'The agent cannot read this project. macOS privacy protection is blocking it.'
  echo 'Either grant Full Disk Access to /bin/zsh in System Settings > Privacy & Security,'
  echo 'or move the project out of ~/Desktop. Until then run it in a terminal tab:'
  echo '  zsh scripts/local-gov-sources.sh --loop'
fi
