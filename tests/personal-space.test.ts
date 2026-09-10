import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readPersonal,
  putPersonal,
  saveSearch,
  recordKey,
  PERSONAL_PREFIX,
  type PersonalStorage,
  type SearchFilters,
  type Application,
} from '../lib/personal-space';
function memory(): PersonalStorage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
const filters: SearchFilters = {
  query: 'React Developer',
  city: 'თბილისი',
  category: 'ყველა',
  source: 'ყველა',
  paid: true,
  remote: false,
  sort: 'შესაბამისობა',
  salaryPeriod: 'month',
  salaryFrom: null,
  salaryTo: null,
  employment: 'all',
  entryLevel: false,
  postedWithin: 0,
};
const application = (): Application => ({
  version: 1,
  kind: 'application',
  id: randomUUID(),
  title: 'Developer',
  company: 'Example',
  city: 'თბილისი',
  url: 'https://jobs.ge/ge/?id=123',
  deadline: '2026-10-10',
  status: 'planned',
  updatedAt: new Date().toISOString(),
});
void test('saved searches preserve every filter and update an identical search instead of duplicating it', () => {
  const store = memory();
  const first = saveSearch(store, 'My search', filters);
  const again = saveSearch(store, 'New name', {
    ...filters,
    query: '  REACT   developer ',
  });
  assert.equal(first.id, again.id);
  assert.equal(readPersonal(store).records.length, 1);
  assert.equal(again.kind === 'search' && again.filters.paid, true);
  saveSearch(store, 'Remote', { ...filters, remote: true });
  assert.equal(readPersonal(store).records.length, 2);
});
void test('corrupt data is isolated and unrelated existing bookmarks are preserved', () => {
  const store = memory();
  store.setItem('ertad-saved', '["legacy-bookmark"]');
  store.setItem(PERSONAL_PREFIX + 'broken', '{broken');
  const app = application();
  putPersonal(store, app);
  const result = readPersonal(store);
  assert.equal(result.records.length, 1);
  assert.equal(result.invalid, 1);
  assert.equal(store.getItem('ertad-saved'), '["legacy-bookmark"]');
});
void test('application snapshots persist independently of public jobs and separate writes do not replace other entries', () => {
  const store = memory();
  const a = application(),
    b = application();
  putPersonal(store, a);
  putPersonal(store, b);
  putPersonal(store, { ...a, status: 'applied' });
  assert.equal(readPersonal(store).records.length, 2);
  const saved = readPersonal(store).records.find((r) => r.id === a.id);
  assert.equal(saved?.kind === 'application' && saved.status, 'applied');
  store.removeItem(recordKey(a));
  assert.equal(readPersonal(store).records.length, 1);
  putPersonal(store, a);
  assert.equal(readPersonal(store).records.length, 2);
});
void test('unsafe snapshots and unsupported versions are rejected', () => {
  const store = memory();
  assert.throws(() =>
    putPersonal(store, { ...application(), url: 'javascript:alert(1)' }),
  );
  assert.throws(() =>
    putPersonal(store, {
      ...application(),
      url: 'https://user:pass@example.com',
    }),
  );
  store.setItem(
    PERSONAL_PREFIX + 'application:' + randomUUID(),
    JSON.stringify({ ...application(), version: 2 }),
  );
  assert.equal(readPersonal(store).records.length, 0);
});
void test('limits do not silently discard previous searches and writes report storage failures', () => {
  const store = memory();
  for (let i = 0; i < 20; i++)
    saveSearch(store, 'Search ' + i, { ...filters, query: 'position' + i });
  assert.throws(() => saveSearch(store, 'overflow', filters), /20/);
  assert.equal(readPersonal(store).records.length, 20);
  const broken = {
    ...store,
    setItem: () => {
      throw Error('QuotaExceededError');
    },
  };
  assert.throws(() => putPersonal(broken, application()), /QuotaExceededError/);
});
