// Each source keeps its database schedule and lock. This queue only prevents a
// slow source from blocking the others inside a long-lived worker process.
export class SourceScheduler {
  readonly active = new Map<string, Promise<void>>();
  private readonly retryAfter = new Map<string, number>();
  private stopped = false;

  constructor(
    private readonly run: (source: string) => Promise<void>,
    private readonly reportError: (source: string, error: unknown) => void,
    private readonly concurrency = 3,
    private readonly cooldownMs = 60_000,
    private readonly now = Date.now,
  ) {}

  tick(due: string[]) {
    for (const source of due) {
      if (this.stopped || this.active.size >= this.concurrency) break;
      if (
        this.active.has(source) ||
        (this.retryAfter.get(source) ?? 0) > this.now()
      )
        continue;
      const task = Promise.resolve()
        .then(() => this.run(source))
        .catch((error) => this.reportError(source, error))
        .finally(() => {
          this.active.delete(source);
          this.retryAfter.set(source, this.now() + this.cooldownMs);
        });
      this.active.set(source, task);
    }
  }

  async stop() {
    this.stopped = true;
    await Promise.allSettled(this.active.values());
  }
}

export const dueSourcesSql = `SELECT s.id FROM sources s
  WHERE s.id=ANY($1::text[]) AND s.enabled AND NOT s.retired AND (
    s.requested_at IS NOT NULL OR (s.auto_enabled AND s.next_run_at<=now()) OR EXISTS (
      SELECT 1 FROM source_items i WHERE i.source_id=s.id
      AND i.refresh_requested_at IS NOT NULL
      AND (i.refresh_completed_at IS NULL OR i.refresh_requested_at>i.refresh_completed_at)
      AND i.next_check_at<=now()
    )
  ) ORDER BY s.requested_at NULLS LAST, s.next_run_at, s.id`;
