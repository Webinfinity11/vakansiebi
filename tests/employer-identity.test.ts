import { test } from 'node:test';
import assert from 'node:assert/strict';
import { employerIdentity as id } from '../lib/employer-identity';

void test('spellings of one employer share an identity', () => {
  const same = (a: string, b: string) =>
    assert.equal(id(a, ['jobs']), id(b, ['hr']), `${a} = ${b}`);
  same('ლიბერთი ბანკი', 'სს ლიბერთი ბანკი');
  same('გორგია', 'შ.პ.ს. გორგია');
  same('ნავნე', '"ნავნე"');
  same('ავერსი ფარმა', 'ავერსი-ფარმა');
  same('ი.ჟორდანიას სახელობის კლინიკა', 'ი. ჟორდანიას სახელობის კლინიკა');
  same('Sky Group', 'შპს SKY GROUP');
  same('Midea', 'მიდეა');
  same('Brunch by Gastronome', 'Brunch By Gastronome');
});

void test('a legal form is removed only as a whole word', () => {
  assert.notEqual(id('იმედი', ['jobs']), id('ედი', ['jobs']));
  assert.notEqual(id('სსკ', ['jobs']), id('კ', ['jobs']));
});

void test('different names and guessed vowels stay apart', () => {
  assert.notEqual(
    id('ჯიბე ქეშ & ქერი', ['ss']),
    id('ჯიბე cash & carry', ['jobs']),
  );
});

void test('a person named on ss.ge and a placeholder have no employer identity', () => {
  for (const name of ['ნინო', 'Nino', 'giorgi', 'ნათია'])
    assert.equal(id(name, ['ss']), null);
  assert.equal(id('კომპანია', ['jobs']), null);
  assert.equal(id('შპს ნათია', ['ss']), 'ნათია');
  assert.ok(id('ჯიბე ქეშ & ქერი', ['ss']));
  assert.equal(id('SOCAR', ['ss'], true), 'სოქარ');
  assert.equal(id('ტორტინი', ['ss'], false), null);
  assert.ok(id('ნავნე', ['ss', 'jobs']));
});
