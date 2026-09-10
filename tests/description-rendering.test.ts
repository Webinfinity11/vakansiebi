import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Description } from '../app/vacancy-text';
import { cleanText } from '../worker/adapters';
void test('complete descriptions retain final paragraphs, original ordered numbers and clickable supporting URLs', () => {
  const text = cleanText(
    '<h4>სრული პირობები:</h4><ol start="3"><li>პირველი ნაბიჯი</li><li>მეორე ნაბიჯი</li></ol><p>სრული წესები <a href="https://example.com/terms">ბმული</a></p><p>ბოლო მნიშვნელოვანი აბზაცი უცვლელად.</p>',
  );
  const html = renderToStaticMarkup(createElement(Description, { text }));
  assert.match(html, /<ol><li value="3">პირველი ნაბიჯი/);
  assert.match(html, /<li value="4">მეორე ნაბიჯი/);
  assert.match(html, /href="https:\/\/example.com\/terms"/);
  assert.match(html, /ბოლო მნიშვნელოვანი აბზაცი უცვლელად\./);
  assert.doesNotMatch(
    renderToStaticMarkup(
      createElement(Description, { text: 'https://user:pass@example.com/' }),
    ),
    /<a /,
  );
});
