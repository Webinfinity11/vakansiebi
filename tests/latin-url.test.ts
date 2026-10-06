import test from 'node:test';
import assert from 'node:assert/strict';
import { latinUrl, legacyLatinUrl } from '../lib/latin-url';
import { explicitWorkCity } from '../lib/work-location';

void test('Georgian URL spellings use y for ყ and preserve readable digraphs', () => {
  for (const [georgian, latin] of [
    ['გაყიდვების აგენტი', 'gayidvebis agenti'],
    ['მყიდველი', 'myidveli'],
    ['საწყობი', 'satsyobi'],
    ['ყვარელი', 'yvareli'],
    ['წყალტუბო', 'tsyaltubo'],
    ['შეფმზარეული', 'shefmzareuli'],
    ['ღამის', 'ghamis'],
    ['ჭავჭავაძე', 'chavchavadze'],
  ])
    assert.equal(latinUrl(georgian), latin, georgian);
  assert.equal(
    latinUrl('აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ'),
    'abgdevztiklmnopzhrstufkghyshchtsdztschkhjh',
  );
});

void test('older Georgian spellings remain reproducible without changing Latin brands', () => {
  assert.equal(legacyLatinUrl('გაყიდვების'), 'gaqidvebis');
  for (const name of ['Qazbegi', 'Yazbegi', 'Quality', 'Café Brød'])
    assert.equal(latinUrl(name), legacyLatinUrl(name), name);
});

void test('workplace city detection accepts both old and new Latin spellings', () => {
  for (const city of ['ყვარელი', 'დედოფლისწყარო', 'წყალტუბო', 'ტყიბული'])
    for (const spelling of [latinUrl(city), legacyLatinUrl(city)])
      assert.equal(
        explicitWorkCity({
          description: `სამუშაო ადგილი: ${spelling}`,
          facts: [],
        }),
        city,
        spelling,
      );
});
