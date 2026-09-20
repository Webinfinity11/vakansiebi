import type { ActiveSourceId } from '../lib/types';
import type { refreshDescriptions } from './refresh';
import type { runSource } from './run';

type RefreshResult = Awaited<ReturnType<typeof refreshDescriptions>>;
type DiscoveryResult =
  | Awaited<ReturnType<typeof runSource>>
  | { source: ActiveSourceId; skipped: true; reason: string };

type CycleDependencies = {
  refresh: typeof refreshDescriptions;
  discover: typeof runSource;
  reconcile: (source: string) => Promise<Record<string, number>>;
  isDue: (source: ActiveSourceId) => Promise<boolean>;
  stopped: () => boolean;
  reportRefresh: (result: RefreshResult) => void;
  reportDiscovery: (result: DiscoveryResult) => void;
  reportAutomation: (result: Record<string, number>) => void;
};

// New-only mode never invokes historical description repairs.
export async function runSourceCycle(
  source: ActiveSourceId,
  deps: CycleDependencies,
) {
  if (deps.stopped()) return;
  if (await deps.isDue(source)) {
    const result = await deps.discover(source);
    deps.reportAutomation(await deps.reconcile(source));
    deps.reportDiscovery(result);
  } else {
    deps.reportDiscovery({
      source,
      skipped: true,
      reason: 'No enabled sources are due',
    });
  }
}
