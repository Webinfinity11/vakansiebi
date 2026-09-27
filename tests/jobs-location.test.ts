import test from 'node:test';
import assert from 'node:assert/strict';
import { jobsLocation } from '../worker/adapters/jobs-location';

void test('a location field gives its town and keeps the rest as the address', () => {
  assert.deepEqual(jobsLocation('ქ. თბილისი, ქსნის ქუჩა 36'), {
    city: 'თბილისი',
    address: 'ქ. თბილისი, ქსნის ქუჩა 36',
  });
  assert.equal(jobsLocation('ვაკე, ჭავჭავაძის 74გ').city, 'თბილისი');
  assert.equal(jobsLocation('ქ.მარნეული, 26 მაისის ქუჩა').city, 'მარნეული');
  // Only jobs.ge, a Tbilisi board, reads a bare street as Tbilisi.
  assert.equal(
    jobsLocation('უნივერსიტეტის ქუჩა 5', false).city,
    'უნივერსიტეტის ქუჩა 5',
  );
  // Wider than one town: kept as written so every city filter can show it.
  assert.equal(jobsLocation('თბილისი, რეგიონები').city, 'თბილისი, რეგიონები');
  assert.equal(
    jobsLocation('საქართველოს მაშტაბით').city,
    'საქართველოს მაშტაბით',
  );
});
