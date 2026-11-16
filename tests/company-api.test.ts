import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatTime } from '../app/company/company-api';
test('Tbilisi day rollover and 24-hour clock ignore host timezone', () => {
 assert.equal(formatTime('2026-11-16T10:17:34Z'), '14:17');
 assert.equal(formatTime('2026-11-16T21:17:34Z'), '01:17');
 assert.equal(formatDate('2026-11-16T21:17:34Z',new Date('2026-11-16T00:00:00Z')), '17 ნოემბერი');
 assert.equal(formatDate('2026-12-16',new Date('2026-11-16T00:00:00Z')), '16 დეკემბერი');
 assert.equal(formatDate('2026-12-31T21:00:00Z',new Date('2026-12-31T21:00:00Z')), '1 იანვარი');
 assert.equal(formatDate('2025-12-16',new Date('2026-11-16T00:00:00Z')), '16 დეკემბერი, 2025');
 assert.equal(formatTime('invalid'), '');
});
