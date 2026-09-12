import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTheme, storeTheme, themeKey, themeScript } from '../lib/theme';
import { darkTheme } from '../scripts/build-dark-theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    read: () => Object.fromEntries(map),
  };
}

void test('an unreadable or unknown stored theme means the device decides', () => {
  assert.equal(readTheme(fakeStorage()), 'system');
  assert.equal(readTheme(fakeStorage({ [themeKey]: 'sepia' })), 'system');
  assert.equal(readTheme(fakeStorage({ [themeKey]: 'dark' })), 'dark');
  assert.equal(
    readTheme({
      getItem() {
        throw Error('storage disabled');
      },
    }),
    'system',
  );
});
void test('choosing the device theme clears the stored choice instead of recording one', () => {
  const storage = fakeStorage();
  assert.equal(storeTheme(storage, 'dark'), true);
  assert.deepEqual(storage.read(), { [themeKey]: 'dark' });
  assert.equal(storeTheme(storage, 'system'), true);
  assert.deepEqual(storage.read(), {});
  assert.equal(
    storeTheme(
      {
        setItem() {
          throw Error('storage disabled');
        },
        removeItem() {
          throw Error('storage disabled');
        },
      },
      'dark',
    ),
    false,
  );
});
void test('the inline script names the same key the toggle writes and cannot throw', () => {
  assert.ok(themeScript.includes(JSON.stringify(themeKey)));
  assert.ok(themeScript.includes('catch'));
  assert.ok(
    themeScript.includes('data-theme') || themeScript.includes('dataset.theme'),
  );
  /* The dark page is opt in: a device set to dark must not switch the site by itself, so the
     script has no business asking the device what it prefers. */
  assert.ok(!themeScript.includes('prefers-color-scheme'));
});
/* The dark stylesheet is generated from the light ones. Regenerating here means a colour
   changed in a light rule without the dark rule following it fails the suite rather than
   reaching a reader as an unreadable panel. */
void test('the checked-in dark stylesheet matches its source stylesheets', () => {
  assert.equal(
    readFileSync('app/theme-dark.css', 'utf8'),
    darkTheme(),
    'app/theme-dark.css is stale — run: npx tsx scripts/build-dark-theme.ts',
  );
});
