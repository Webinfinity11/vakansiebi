import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTemplates, render, validTemplate } from '../lib/company-message-templates';
test('renders first names, repeated variables and literal replacement values; unknown variables remain', () => {
  assert.deepEqual(render({ subject: '{სახელი} {ვაკანსია}', body: '{კომპანია} {სახელი} {უცნობი} {თარიღი}' }, { name: '  ნინო  მაისურაძე ', jobTitle: '$& developer', companyName: 'კომპანია' }), { subject: 'ნინო $& developer', body: 'კომპანია ნინო {უცნობი} {თარიღი}' });
  assert.equal(render(defaultTemplates.interview, { date: 'ხვალ' }).body.includes('ხვალ'), true);
});
test('missing and invalid values do not throw', () => {
  assert.deepEqual(render(null), { subject: '', body: '' });
  assert.deepEqual(render({ subject: undefined, body: '{სახელი}' }), { subject: '', body: '' });
  assert.doesNotThrow(() => render({ subject: 23 as unknown as string }, null as never));
});
test('limits, blank content and subject line breaks are validated', () => {
  for (const value of Object.values(defaultTemplates)) assert.equal(validTemplate(value), true);
  assert.equal(validTemplate({ subject: 'x'.repeat(200), body: 'x'.repeat(5000) }), true);
  for (const v of [null, {}, { subject: 'x'.repeat(201), body: 'x' }, { subject: 'x', body: 'x'.repeat(5001) }, { subject: ' ', body: 'x' }, { subject: 'x\ny', body: 'x' }, { subject: 'x', body: ' ' }]) assert.equal(validTemplate(v), false);
});
test('every default message renders without unresolved variables', () => {
  for (const template of Object.values(defaultTemplates)) {
    const message = render(template, { name: 'ნინო მაისურაძე', jobTitle: 'დეველოპერი', companyName: 'კომპანია', date: 'ხვალ, 12:00-ზე' });
    assert.doesNotMatch(message.subject + '\n' + message.body, /\{/);
  }
});
