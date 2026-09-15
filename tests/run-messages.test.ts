import test from 'node:test';
import assert from 'node:assert/strict';
import { runMessage } from '../lib/run-messages';

void test('import run messages read in Georgian, part by part', () => {
  assert.equal(
    runMessage(
      'Stopped after 3 consecutive detail failures; remaining items retained for retry; 5 detail pages failed',
    ),
    'შეჩერდა ზედიზედ 3 შეცდომის შემდეგ; დანარჩენი ვაკანსიები შემდეგ ჯერ მოწმდება; 5 ვაკანსიის გვერდი ვერ ჩაიტვირთა',
  );
  assert.equal(
    runMessage(
      '4 detail snapshots held for quality review; 1 detail pages failed',
    ),
    '4 ვაკანსიის ცვლილება დამატებით მოწმდება; 1 ვაკანსიის გვერდი ვერ ჩაიტვირთა',
  );
  assert.equal(
    runMessage(
      'Listing page: Source request failed: ECONNRESET; 2 detail snapshots held for quality review',
    ),
    'სიის გვერდი: წყარო კავშირზე არ გამოვიდა; 2 ვაკანსიის ცვლილება დამატებით მოწმდება',
  );
  assert.equal(
    runMessage('Pagination returned empty page; cursor retained for retry'),
    'სიის გვერდი ცარიელი დაბრუნდა; შემდეგ ჯერ იქიდანვე გაგრძელდება',
  );
  assert.equal(
    runMessage('Source returned HTTP 503'),
    'წყარომ დააბრუნა HTTP 503',
  );
});

void test('a message part that is not known is kept as written', () => {
  assert.equal(
    runMessage('Something new happened; 2 detail pages failed'),
    'Something new happened; 2 ვაკანსიის გვერდი ვერ ჩაიტვირთა',
  );
});
