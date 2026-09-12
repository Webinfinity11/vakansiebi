#!/bin/zsh
# Collects the sources a GitHub-hosted runner cannot reach. vacancy.hr.gov.ge times out from
# every runner (verified 2026-09-09); the state employment agency is on the same government
# network, so it is retried here too even though it is also in the cloud matrix.
#
#   zsh scripts/local-gov-sources.sh          one pass over the due government sources
#   zsh scripts/local-gov-sources.sh --loop   keep passing every 30 minutes (Ctrl+C to stop)
#
# PostgreSQL advisory locks make this safe to run while the scheduled workflow is also running.
set -u
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p .local
pass() {
  for source in hrgov worknet; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') start $source"
    CRAWL_BATCH_SIZE="${CRAWL_BATCH_SIZE:-300}" \
      SCRAPE_BUDGET_MINUTES="${SCRAPE_BUDGET_MINUTES:-12}" \
      npx tsx worker/main.ts --source="$source" --due --once
    echo "$(date '+%Y-%m-%d %H:%M:%S') end $source exit=$?"
  done
}
if [[ "${1:-}" == '--loop' ]]; then
  while true; do
    pass
    sleep "${GOV_LOOP_SECONDS:-1800}"
  done
else
  pass
fi
