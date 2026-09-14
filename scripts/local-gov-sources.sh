#!/bin/zsh
# Collects the sources a GitHub-hosted runner cannot reach. vacancy.hr.gov.ge times out from
# every runner (verified 2026-09-09); the state employment agency is on the same government
# network, so both government sources are collected here.
#
#   zsh scripts/local-gov-sources.sh          one pass over the due government sources
#   zsh scripts/local-gov-sources.sh --loop   keep passing every 3 hours (Ctrl+C to stop)
#
# Respect each source interval and failure backoff; government sources are not in the cloud matrix.
# PostgreSQL advisory locks make this safe to run while the scheduled workflow is also running.
set -u
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p .local
pass() {
  for source in hrgov worknet; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') start $source"
    CRAWL_BATCH_SIZE="${CRAWL_BATCH_SIZE:-100}" \
      SCRAPE_BUDGET_MINUTES="${SCRAPE_BUDGET_MINUTES:-5}" \
      DISCOVERY_PAGE_BUDGET="${DISCOVERY_PAGE_BUDGET:-3}" \
      npx tsx worker/main.ts --source="$source" --due --once
    echo "$(date '+%Y-%m-%d %H:%M:%S') end $source exit=$?"
  done
}
if [[ "${1:-}" == '--loop' ]]; then
  while true; do
    pass
    sleep "${GOV_LOOP_SECONDS:-10800}"
  done
else
  pass
fi
