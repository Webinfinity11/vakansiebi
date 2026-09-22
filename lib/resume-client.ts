import type { Cv, CvStorage } from './cv';

const identityKey = 'jobx-resume-server-v1';
const pendingKey = 'jobx-resume-delete-v1';
type Identity = { id: string; token: string };

// The queue orders print/clear requests, including a clear while saving is in flight.
// Pending deletions survive offline clears and are retried on the next visit/online event.
export function createResumeSync(
  storage: CvStorage,
  send: typeof fetch = fetch,
) {
  let queue = Promise.resolve();
  function enqueue(work: () => Promise<void>) {
    queue = queue.then(work).catch(() => {});
    return queue;
  }
  function pending(): Identity[] {
    return JSON.parse(storage.getItem(pendingKey) || '[]');
  }
  async function flushDeletes() {
    for (const identity of pending()) {
      try {
        const response = await send('/api/resumes', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(identity),
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok)
          storage.setItem(
            pendingKey,
            JSON.stringify(pending().filter((item) => item.id !== identity.id)),
          );
      } catch {
        /* Keep the deletion for the next attempt. */
      }
    }
  }
  return {
    retry: () => enqueue(flushDeletes),
    save(cv: Cv) {
      try {
        let identity: Identity = JSON.parse(
          storage.getItem(identityKey) || 'null',
        );
        if (!identity) {
          identity = { id: crypto.randomUUID(), token: crypto.randomUUID() };
          // Persist before sending: a lost response must not orphan the server copy.
          storage.setItem(identityKey, JSON.stringify(identity));
        }
        const { photo, ...text } = cv;
        const body = JSON.stringify({
          ...identity,
          cv: text,
          photo: photo.length <= 170000 ? photo : '',
        });
        return enqueue(async () => {
          await send('/api/resumes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: AbortSignal.timeout(15000),
          });
        });
      } catch {
        return Promise.resolve();
      }
    },
    clear() {
      try {
        const identity: Identity | null = JSON.parse(
          storage.getItem(identityKey) || 'null',
        );
        if (identity) {
          storage.setItem(pendingKey, JSON.stringify([...pending(), identity]));
          storage.removeItem(identityKey);
        }
        return enqueue(flushDeletes);
      } catch {
        return Promise.resolve();
      }
    },
  };
}
