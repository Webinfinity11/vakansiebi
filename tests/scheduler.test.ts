import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceScheduler } from '../worker/scheduler';

void test('a slow source does not block other sources; active work is never duplicated', async () => {
  const started: string[] = [];
  const finish = new Map<string, () => void>();
  const queue = new SourceScheduler(
    (source) =>
      new Promise<void>((resolve) => {
        started.push(source);
        finish.set(source, resolve);
      }),
    () => {},
    2,
  );
  queue.tick(['jobs', 'hr', 'ss']);
  await Promise.resolve();
  assert.deepEqual(started, ['jobs', 'hr']);
  queue.tick(['jobs', 'hr', 'ss']);
  finish.get('hr')!();
  await queue.active.get('hr');
  queue.tick(['jobs', 'hr', 'ss']);
  await Promise.resolve();
  assert.deepEqual(started, ['jobs', 'hr', 'ss']);
  finish.get('jobs')!();
  finish.get('ss')!();
  await queue.stop();
});

void test('failure cools down, allows another source, and retries after the cooldown', async () => {
  let now = 1_000;
  const started: string[] = [];
  const errors: string[] = [];
  const queue = new SourceScheduler(
    async (source) => {
      started.push(source);
      if (source === 'hr') throw new Error('network failed');
    },
    (source) => {
      errors.push(source);
    },
    1,
    60_000,
    () => now,
  );
  queue.tick(['hr']);
  await queue.active.get('hr');
  queue.tick(['hr', 'ss']);
  await queue.active.get('ss');
  assert.deepEqual(started, ['hr', 'ss']);
  now += 60_000;
  queue.tick(['hr']);
  await queue.active.get('hr');
  assert.deepEqual(started, ['hr', 'ss', 'hr']);
  assert.deepEqual(errors, ['hr', 'hr']);
  await queue.stop();
});

void test('shutdown drains in-flight work and refuses new work', async () => {
  let finish!: () => void;
  const queue = new SourceScheduler(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    () => {},
  );
  queue.tick(['jobs']);
  await Promise.resolve();
  const stopped = queue.stop();
  queue.tick(['hr']);
  assert.deepEqual([...queue.active.keys()], ['jobs']);
  finish();
  await stopped;
  assert.equal(queue.active.size, 0);
});
