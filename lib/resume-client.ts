import type { Cv, CvStorage } from './cv';

const identityKey = 'jobx-resume-server-v1';

/* A random v4 id. crypto.randomUUID is missing from older phone browsers (iOS before 15.4),
   and a CV must still be saved there; getRandomValues is far older. */
export function randomId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const pendingKey = 'jobx-resume-delete-v1';
type Identity = { id: string; token: string };

// The queue orders print/clear requests, including a clear while saving is in flight.
// Pending deletions survive offline clears and are retried on the next visit/online event.
// AbortSignal.timeout arrived in Safari 16; without it the request simply has no deadline.
const timeout = (ms: number) =>
  typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;

export function createResumeSync(
  storage: CvStorage,
  send: typeof fetch = fetch,
  // Told whether each save reached the server, so presses and saved CVs can be compared.
  onSaved: (ok: boolean) => void = () => {},
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
          signal: timeout(15000),
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
          identity = { id: randomId(), token: randomId() };
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
          let ok = false;
          try {
            const response = await send('/api/resumes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
              signal: timeout(15000),
            });
            ok = response.ok;
          } finally {
            onSaved(ok);
          }
        });
      } catch {
        onSaved(false);
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

/** The CV this browser saved on JOBX, if any; read without touching the server. */
export function savedResumeIdentity(storage: CvStorage): Identity | null {
  try {
    const identity = JSON.parse(storage.getItem(identityKey) || 'null');
    return identity && typeof identity.id === 'string' ? identity : null;
  } catch {
    return null;
  }
}

/* Tells JOBX that the holder of a saved CV pressed send-CV, call or apply on one of our own
   vacancies. Like the usage counts, only production builds send — a local server may point
   at the real database — and a failure never reaches the reader. */
export function sendResumeContact(
  storage: CvStorage,
  job: string,
  kind: 'cv' | 'call' | 'apply',
) {
  if (process.env.NODE_ENV !== 'production') return;
  const identity = savedResumeIdentity(storage);
  if (!identity) return;
  void fetch('/api/resumes/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, job, kind }),
    keepalive: true,
  }).catch(() => {});
}
