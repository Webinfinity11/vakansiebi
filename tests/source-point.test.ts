import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDetail } from '../worker/adapters';
import { publishable } from '../worker/automation';
import { sourcePoint } from '../lib/source-point';
import { streetAddresses } from '../lib/street-address';
import { vacancySummary } from '../lib/vacancy-summary';
import { sourcePointLabel } from '../worker/places';

const url = 'https://jobs.ss.ge/ka/details/cvlis-ufrosi-88248128';
const ka = (value: string | null) => ({ ka: value, en: null, text: value });
/* The address block as jobs.ss.ge serves it on 2026-09-25 (ids and titles from a live page). */
function ss(
  address: Record<string, unknown>,
  lat: number | null = 41.7434568,
  lon: number | null = 44.7875261,
) {
  const details = {
    id: 88248128,
    status: 0,
    jobsDealType: 1,
    title: { ka: 'ცვლის უფროსი' },
    publisherName: 'შპს მაგალითი',
    description: { ka: 'საწარმოს ესაჭიროება ცვლის უფროსი, სრული განაკვეთით.' },
    address: {
      municipalityTitle: ka(null),
      cityTitle: ka('თბილისი'),
      districtTitle: ka(null),
      subdistrictTitle: ka(null),
      streetTitle: ka(null),
      streetNumber: null,
      ...address,
    },
    locationLatitude: lat,
    locationLongitude: lon,
  };
  return `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: details } } })}</script>`;
}
const address = (v: ReturnType<typeof parseDetail>) =>
  v.facts?.find((f) => f.label === 'მისამართი')?.value;

void test('ss.ge street, number and district become the address, with the employer pin', () => {
  const v = parseDetail(
    'ss',
    ss({
      subdistrictTitle: ka('ნაძალადევი'),
      streetTitle: ka('ნინუას ქ.'),
      streetNumber: '3',
    }),
    url,
  );
  assert.equal(address(v), 'თბილისი, ნაძალადევი, ნინუას ქ. 3');
  assert.deepEqual(v.coordinates, { lat: 41.7434568, lon: 44.7875261 });
  // The fact is what the map reads, and it parses as a precise street address.
  const text = vacancySummary(v).find((i) => i.label === 'მისამართი')?.value;
  assert.deepEqual(
    streetAddresses(text || '', v.city).map((a) => a.query),
    ['ნინუას ქუჩა 3, თბილისი'],
  );
  // The pin survives validation into the published record.
  assert.deepEqual(publishable(v, 'ss', url)?.coordinates, v.coordinates);
});

void test('ss.ge keeps no pin without a house number, and no address without a street', () => {
  const streetOnly = parseDetail(
    'ss',
    ss({ streetTitle: ka('იაკობ რაინეგსის ქ.'), streetNumber: '' }),
    url,
  );
  assert.equal(address(streetOnly), 'თბილისი, იაკობ რაინეგსის ქ.');
  assert.equal(streetOnly.coordinates, undefined);
  const cityOnly = parseDetail('ss', ss({}, null, null), url);
  assert.equal(address(cityOnly), undefined);
  assert.equal(cityOnly.coordinates, undefined);
  // A pin with no street is not read either: it may be the city's default point.
  assert.equal(parseDetail('ss', ss({}), url).coordinates, undefined);
  // A house "number" that is not one is left out of the address.
  const odd = parseDetail(
    'ss',
    ss({ streetTitle: ka('ნინუას ქ.'), streetNumber: '3 სართული 5' }),
    url,
  );
  assert.equal(address(odd), 'თბილისი, ნინუას ქ.');
  assert.equal(odd.coordinates, undefined);
});

void test('a source pin is used only inside Georgia and near the vacancy city', () => {
  const pin = { lat: 41.7434568, lon: 44.7875261 };
  assert.deepEqual(sourcePoint({ city: 'თბილისი', coordinates: pin }), {
    lat: 41.743457,
    lon: 44.787526,
  });
  assert.ok(sourcePoint({ city: 'ქ. თბილისი', coordinates: pin }));
  assert.ok(sourcePoint({ city: 'თბილისი >> ნაძალადევი', coordinates: pin }));
  // No pin, or no city to check it against.
  assert.equal(sourcePoint({ city: 'თბილისი' }), null);
  assert.equal(sourcePoint({ city: '', coordinates: pin }), null);
  assert.equal(sourcePoint({ city: 'მესტია', coordinates: pin }), null);
  assert.equal(
    sourcePoint({ city: 'თბილისი, ბათუმი', coordinates: pin }),
    null,
  );
  // A Tbilisi pin on a Batumi vacancy, a pin at 0,0, a pin in Yerevan.
  assert.equal(sourcePoint({ city: 'ბათუმი', coordinates: pin }), null);
  assert.equal(
    sourcePoint({ city: 'თბილისი', coordinates: { lat: 0, lon: 0 } }),
    null,
  );
  assert.equal(
    sourcePoint({ city: 'თბილისი', coordinates: { lat: 40.18, lon: 44.51 } }),
    null,
  );
  assert.equal(
    sourcePoint({ city: 'თბილისი', coordinates: { lat: NaN, lon: 44.8 } }),
    null,
  );
  // Rustavi is 25 km from Tbilisi's centre: near enough for a Rustavi pin, and a Tbilisi
  // outskirts pin still counts as Tbilisi.
  assert.ok(
    sourcePoint({ city: 'რუსთავი', coordinates: { lat: 41.55, lon: 45.0 } }),
  );
});

void test('a source pin is labelled by its street address when there is exactly one', () => {
  const text = 'თბილისი, ნაძალადევი, ნინუას ქ. 3';
  assert.equal(
    sourcePointLabel(streetAddresses(text, 'თბილისი'), text, 'თბილისი'),
    'ნინუას ქუჩა 3, თბილისი',
  );
  assert.equal(sourcePointLabel([], '', 'თბილისი'), 'თბილისი');
  assert.equal(
    sourcePointLabel([], 'თბილისი, ვაკე', 'თბილისი'),
    'თბილისი, ვაკე',
  );
});
