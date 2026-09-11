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

// Repairs and normal discovery each get a turn. A repeatedly failing old
// employer link must not suppress discovery on every scheduled invocation.
export async function runSourceCycle(
  source: ActiveSourceId,
  deps: CycleDependencies,
) {
  const refresh = await deps.refresh(source, 20, 3 * 60_000);
  deps.reportRefresh(refresh);
  deps.reportAutomation(await deps.reconcile(source));
  if (deps.stopped()) return;
  if (!(await deps.isDue(source))) {
    deps.reportDiscovery({
      source,
      skipped: true,
      reason: 'No enabled sources are due',
    });
    return;
  }
  const result = await deps.discover(source);
  deps.reportAutomation(await deps.reconcile(source));
  deps.reportDiscovery(result);
}
