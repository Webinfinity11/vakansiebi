import test from 'node:test';
import assert from 'node:assert/strict';
import { importDateReason, pendingNewItemsSql } from '../worker/new-only';
import { randomUUID } from 'node:crypto';
import { listLinks, tbilisiDate } from '../worker/adapters';

void test('rolling three calendar days includes today and crosses month/year boundaries', () => {
  for (const day of ['2026-09-20', '2026-09-19', '2026-09-18'])
    assert.equal(importDateReason(day, '2026-09-20'), null);
  assert.equal(importDateReason('2026-09-17', '2026-09-20'), 'outside_window');
  assert.equal(importDateReason('2026-09-21', '2026-09-20'), 'outside_window');
  assert.equal(importDateReason('2026-12-31', '2027-01-02'), null);
  assert.equal(importDateReason('2026-09-30', '2026-10-02'), null);
});
void test('jobs listing publication date is retained separately from its deadline', () => {
  const today = tbilisiDate();
  const [year, month, day] = today.split('-');
  const english = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const html = `<table><tr><td><a href="/ge/?view=jobs&id=555">Developer</a></td><td>Studio</td><td>${day} ${english[Number(month) - 1]} ${year}</td><td>31 December ${year}</td></tr></table>`;
  const [link] = listLinks('jobs', html, 'https://jobs.ge/');
  assert.equal(link.hints?.datePosted, today);
});
void test('unknown and impossible publication dates never become new discoveries', () => {
  for (const date of ['', undefined, '2026-02-30', 'today', '2026-9-2'])
    assert.equal(importDateReason(date, '2026-09-20'), 'undated');
});

void test(
  'known newest publication dates take priority over discovery order',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const { db } = await import('../lib/server/db');
    const c = await db().connect();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const today = tbilisiDate();
    const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000)
      .toISOString()
      .slice(0, 10);
    try {
      await c.query('BEGIN');
      for (const [index, id] of ids.entries())
        await c.query(
          `INSERT INTO source_items(id,source_id,external_id,url,listing_hints,discovered_at) VALUES($1::uuid,'hr',$1::text,'https://example.test/'||$1::text,$2,now()+($3::int*interval '1 second'))`,
          [
            id,
            index === 2 ? {} : { datePosted: index === 0 ? today : yesterday },
            index,
          ],
        );
      const rows = (
        await c.query(pendingNewItemsSql('id'), ['hr', 1000])
      ).rows.filter((row) => ids.includes(row.id));
      assert.deepEqual(
        rows.map((row) => row.id),
        ids,
      );
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db().end();
    }
  },
);
