/** Process 9 new records before each published-vacancy recheck.
 * A time-limited run must not spend its entire budget on the new-item backlog.
 * Preserve each input's ordering and drain the other input when one runs out. */
export function detailQueue<T>(pending: readonly T[], existing: readonly T[]): T[] {
  const queue: T[] = [];
  let nextNew = 0;
  let nextExisting = 0;
  while (nextNew < pending.length || nextExisting < existing.length) {
    for (let n = 0; n < 9 && nextNew < pending.length; n++) {
      queue.push(pending[nextNew++]);
    }
    if (nextExisting < existing.length) queue.push(existing[nextExisting++]);
  }
  return queue;
}
