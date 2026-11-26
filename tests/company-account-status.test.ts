import test from 'node:test';
import assert from 'node:assert/strict';
import { since, passwordState, jobState } from '../lib/company-account-status';

test('time since a sign-in reads as Georgian days', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  assert.equal(since(null, now), '');
  assert.equal(since('2026-11-26T08:00:00Z', now), 'დღეს');
  assert.equal(since('2026-11-25T08:00:00Z', now), 'გუშინ');
  assert.equal(since('2026-11-20T12:00:00Z', now), '6 დღის წინ');
  assert.match(since('2026-01-02T12:00:00Z', now), /2026/);
  assert.equal(since('not a date', now), '');
});

test('password state tells whether the company set its own', () => {
  assert.equal(passwordState({ must_change_password: true, passwordChangedAt: null }), 'დროებითი — ჯერ არ შეუცვლია');
  assert.match(passwordState({ must_change_password: false, passwordChangedAt: new Date().toISOString() }), /^შეცვალა დღეს$/);
  assert.equal(passwordState({ must_change_password: false, passwordChangedAt: null }), 'ადმინის მიცემული');
});

test('attached vacancy state', () => {
  const today = '2026-11-26';
  assert.deepEqual(jobState({ status: 'published', deadline: null }, today), ['აქტიური', 'ok']);
  assert.deepEqual(jobState({ status: 'published', deadline: '2026-11-26' }, today), ['აქტიური', 'ok']);
  assert.deepEqual(jobState({ status: 'published', deadline: '2026-11-25' }, today), ['ვადაგასული', 'off']);
  assert.deepEqual(jobState({ status: 'pending', deadline: null }, today), ['მოლოდინში', 'wait']);
  assert.deepEqual(jobState({ status: 'archived', deadline: null }, today), ['მოხსნილი', 'off']);
});
