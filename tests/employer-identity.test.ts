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
  same('ჯი თი გრუპი', 'ჯი-თი გრუპ');
  same('ნიუ ჰოსპიტალსი', 'შპს ნიუ ჰოსპიტალს');
  same('Panex', 'პანექსი');
  same('Bene Comfort', 'ბენე კომფორტი');
  same('Patio', 'ფატიო');
  same('Tsitsinatela', 'წიწინატელა');
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
  assert.notEqual(id('ლიბრა', ['jobs']), id('ლიბრე', ['jobs']));
  assert.equal(id('ტორტინი', ['ss'], false), null);
  assert.ok(id('ნავნე', ['ss', 'jobs']));
});

void test('near spellings are offered as candidates, never joined', async () => {
  const { candidatePairs, mergedIdentities } =
    await import('../lib/employer-identity');
  const jibeGe = id('ჯიბე ქეშ & ქერი', ['ss'])!;
  const jibeEn = id('Jibe Cash & Carry', ['jobs'])!;
  const pairs = candidatePairs([
    jibeGe,
    jibeEn,
    id('თიბისი', ['jobs'])!,
    id('თბილისი', ['jobs'])!,
    id('ლიბერთი ბანკი', ['jobs'])!,
  ]);
  assert.ok(pairs.some((p) => p.includes(jibeGe) && p.includes(jibeEn)));
  assert.ok(pairs.every((p) => !p.includes(id('ლიბერთი ბანკი', ['jobs'])!)));
  assert.notEqual(jibeGe, jibeEn);
  const root = mergedIdentities([
    ['ბ', 'გ'],
    ['ა', 'გ'],
  ]);
  assert.equal(root('ბ'), 'ა');
  assert.equal(root('გ'), 'ა');
  assert.equal(root('დ'), 'დ');
});
