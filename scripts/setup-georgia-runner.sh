#!/usr/bin/env bash
# Turns a fresh Ubuntu VPS in Tbilisi into the GitHub Actions runner that reads the two
# government sources (vacancy.hr.gov.ge, worknet.moh.gov.ge). Both answer only from Georgian
# networks, so the `scrape-gov` job in .github/workflows/scrape.yml runs here, on the same
# schedule as the cloud sources.
#
#   sudo RUNNER_TOKEN=<registration token> bash setup-georgia-runner.sh
#
# The token comes from GitHub (valid one hour):
#   gh api -X POST repos/Webinfinity11/vakansiebi/actions/runners/registration-token -q .token
#
# Nothing secret is stored on this machine: the database URL reaches each job from GitHub
# Secrets and is gone when the job ends. The runner runs as an unprivileged user.
set -euo pipefail

REPO_URL=https://github.com/Webinfinity11/vakansiebi
RUNNER_USER=runner
RUNNER_DIR=/home/$RUNNER_USER/actions-runner
: "${RUNNER_TOKEN:?Set RUNNER_TOKEN to a registration token from GitHub}"
[[ $EUID -eq 0 ]] || { echo 'Run as root (sudo).'; exit 1; }

echo '== Can this machine reach the government sources?'
for host in vacancy.hr.gov.ge worknet.moh.gov.ge; do
  if curl -s -o /dev/null --max-time 20 "https://$host/"; then
    echo "   $host: reachable"
  else
    echo "   $host: NOT reachable — this VPS is not on a Georgian network; stop here."
    exit 1
  fi
done

echo '== System packages and security updates'
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl jq tar git ca-certificates unattended-upgrades ufw
dpkg-reconfigure -f noninteractive unattended-upgrades

echo '== Firewall: SSH in, everything out'
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable

# A small VPS has 512 MB–1 GB of memory; `npm ci` needs more for a moment.
if ! swapon --show | grep -q .; then
  echo '== 2 GB swap'
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo '== Runner user and GitHub Actions runner'
id "$RUNNER_USER" &>/dev/null || useradd --create-home --shell /bin/bash "$RUNNER_USER"
arch=$(uname -m); case $arch in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; esac
version=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/^v//')
sudo -u "$RUNNER_USER" mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"
sudo -u "$RUNNER_USER" curl -sL -o runner.tgz \
  "https://github.com/actions/runner/releases/download/v$version/actions-runner-linux-$arch-$version.tar.gz"
sudo -u "$RUNNER_USER" tar xzf runner.tgz && rm runner.tgz
./bin/installdependencies.sh
sudo -u "$RUNNER_USER" ./config.sh --unattended --replace \
  --url "$REPO_URL" --token "$RUNNER_TOKEN" \
  --name "georgia-$(hostname)" --labels georgia --work _work
./svc.sh install "$RUNNER_USER"
./svc.sh start

echo
echo 'Done. The runner should show as Idle under the repository: Settings → Actions → Runners.'
echo 'Then switch the job on: gh variable set GEORGIA_RUNNER --body true'
