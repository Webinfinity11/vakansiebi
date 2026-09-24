import test from 'node:test';
import assert from 'node:assert/strict';
import { streetAddresses } from '../lib/street-address';
import { houseKey, judge } from '../lib/server/geocode';

const queries = (raw: string, city = '') =>
  streetAddresses(raw, city).map((a) => a.query);

void test('only a street with a house number becomes a map address', () => {
  assert.deepEqual(queries('თბილისი'), []);
  assert.deepEqual(queries('გლდანი, მე-7 მიკრორაიონი'), []);
  assert.deepEqual(queries('ხუდადოვის ქუჩა', 'თბილისი'), []);
  assert.deepEqual(queries('ვაკე, მ. თამარაშვილის 11ა ნომერი'), [
    'თამარაშვილის 11ა, თბილისი',
  ]);
  assert.deepEqual(queries('69 ეგნატე ნინოშვილის ქუჩა, თბილისი'), [
    'ეგნატე ნინოშვილის ქუჩა 69, თბილისი',
  ]);
});

void test('cities are whole words, never pieces of a street name', () => {
  // "გორგასლის" is not Gori, "რუსთაველის" is not Rustavi.
  assert.deepEqual(queries('ქ. თბილისი, ვახტანგ გორგასლის N63 (ორთაჭალა)'), [
    'ვახტანგ გორგასლის 63, თბილისი',
  ]);
  assert.deepEqual(
    queries('ქ. ბათუმი, რუსთაველის ქ. №40 / ნ. დუმბაძის ქ. №2'),
    ['რუსთაველის ქუჩა 40, ბათუმი', 'დუმბაძის ქუჩა 2, ბათუმი'],
  );
  // A town named in the text wins over the vacancy's own city.
  assert.deepEqual(queries('ამბროლაური ვაჟა-ფშაველას #2', 'თბილისი'), [
    'ვაჟა-ფშაველას 2, ამბროლაური',
  ]);
});

void test('floors and offices are dropped, not mistaken for the house', () => {
  assert.deepEqual(
    queries(
      'ილია ჭავჭავაძის გამზირი 60B, სართული 16, ბინა/ოფისი 64, თბილისი 0162',
    ),
    ['ილია ჭავჭავაძის გამზირი 60b, თბილისი'],
  );
});

const place = (
  lat: number,
  lon: number,
  house: string,
  road: string,
  suburb = '',
) => ({
  lat: String(lat),
  lon: String(lon),
  display_name: '',
  address: { house_number: house, road, city: 'თბილისი', suburb },
});
const [address] = streetAddresses('კოსტავას 14, თბილისი', '');

void test('a pin needs the exact building and one place only', () => {
  assert.equal(houseKey('60B'), houseKey('60ბ'));
  assert.equal(
    judge([place(41.7, 44.78, '', 'მერაბ კოსტავას ქუჩა')], address).status,
    'none',
  );
  assert.equal(
    judge([place(41.7, 44.78, '15', 'მერაბ კოსტავას ქუჩა')], address).status,
    'none',
  );
  assert.equal(
    judge([place(41.7, 44.78, '14', 'მერაბ კოსტავას ქუჩა')], address).status,
    'exact',
  );
  // The same number on two far-apart streets of one name is refused.
  assert.equal(
    judge(
      [
        place(41.7, 44.78, '14', 'მერაბ კოსტავას ქუჩა'),
        place(41.64, 44.91, '14', 'კოსტავას ქუჩა'),
      ],
      address,
    ).status,
    'ambiguous',
  );
});
