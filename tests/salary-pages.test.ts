import test from 'node:test';
import assert from 'node:assert/strict';
import {
  salaryRoles,
  salarySample,
  summarizeSalaries,
} from '../lib/salary-pages';
void test('salary pages require eight valid comparable amounts and interpolate quartiles', () => {
  assert.equal(
    salarySample([100, 200, 300, 400, 500, 600, 700, null, 0, -1, 'bad']),
    null,
  );
  assert.deepEqual(salarySample([100, 200, 300, 400, 500, 600, 700, 800]), {
    count: 8,
    low: 275,
    median: 450,
    high: 625,
  });
  assert.ok(salaryRoles.length >= 8);
});
void test('salary aggregation separates monthly/daily amounts and matches profession titles', () => {
  const rows = Array.from({ length: 8 }, () => ({
    title: 'მოლარე - თბილისი',
    month: '1200',
    day: null,
  }));
  const roles = summarizeSalaries([
    ...rows,
    { title: 'მოლარე', month: null, day: '70' },
    { title: 'ბუღალტერი', month: '5000', day: null },
  ]);
  const cashier = roles.find((r) => r.label === 'მოლარე')!;
  assert.equal(cashier.total, 9);
  assert.equal(cashier.month?.median, 1200);
  assert.equal(cashier.month?.count, 8);
  assert.equal(cashier.day, null);
});

void test('salary explorer includes every catalogue category and uses disjoint category role rules', async () => {
  const { categories } = await import('../lib/types');
  const { subcategories } = await import('../lib/subcategories');
  assert.deepEqual(
    salaryRoles
      .filter((role) => role.kind === 'category')
      .map((role) => role.label),
    [...categories],
  );
  assert.deepEqual(
    salaryRoles
      .filter((role) => role.kind === 'profession')
      .map((role) => role.slug),
    subcategories.map((role) => role.id),
  );
  const roles = summarizeSalaries(
    Array.from({ length: 8 }, () => ({
      title: 'კიბერუსაფრთხოების სპეციალისტი',
      category: 'ტექნოლოგიები',
      month: 3000,
      day: null,
    })).concat(
      Array.from({ length: 8 }, () => ({
        title: 'დაცვის თანამშრომელი',
        category: 'დაცვა',
        month: 1000,
        day: null,
      })),
    ),
  );
  assert.equal(
    roles.find((role) => role.slug === 'tech-security')?.month?.median,
    3000,
  );
  assert.equal(
    roles.find((role) => role.kind === 'category' && role.label === 'დაცვა')
      ?.month?.median,
    1000,
  );
});
