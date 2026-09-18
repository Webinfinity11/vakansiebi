import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advancedValues } from '../lib/advanced-filter-values';
import { readSearch, searchParams } from '../lib/search-state';

void test('changing employment cannot restore an old category, city, query or remote choice', () => {
  const original = readSearch(
    new URLSearchParams('q=old&city=ბათუმი&paid=true'),
  );
  const advanced = {
    ...advancedValues(original),
    employment: 'part-time' as const,
  };
  const edited = {
    ...original,
    query: 'დიზაინერი',
    category: 'ტექნოლოგიები',
    city: 'თბილისი',
    paid: false,
    remote: true,
    ...advanced,
  };
  const request = searchParams(edited);
  assert.equal(request.get('q'), 'dizaineri');
  assert.equal(request.get('category'), 'teknologiebi');
  assert.equal(request.get('city'), 'tbilisi');
  assert.equal(request.get('remote'), 'true');
  assert.equal(request.has('paid'), false);
  assert.equal(request.get('employment'), 'part-time');
});
