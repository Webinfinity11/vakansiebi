import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { parseCvText } from '../lib/cv-parse';
import { candidatePhone } from '../lib/company-candidates';
import { extractCv } from '../lib/server/cv-text';
import { legacyGeorgianText } from '../lib/cv-legacy-georgian';
import truth from './fixtures/cv-samples/expected.json';
import baseline from './fixtures/cv-samples/results.json';
const stable = (value: unknown): string => Array.isArray(value)
  ? JSON.stringify(value.map(stable).sort())
  : value && typeof value === 'object'
    ? JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b))))
    : JSON.stringify(value);
const existing = ['city','roles','years','education','educationLevel','skills','languages'];

test('synthetic CV field scores, regression floor, extraction reasons and timings', async t => {
  t.mock.timers.enable({apis: ['Date'], now: new Date(truth.asOf).getTime()});
  const scores: Record<string, number> = {};
  const failures: string[] = [];
  for (const [filename, expected] of Object.entries(truth.fixtures)) {
    const start = performance.now();
    const extracted = await extractCv(await readFile('tests/fixtures/cv-samples/' + filename), filename);
    if (!filename.startsWith('georgian-acadnusx.'))
      assert.equal(legacyGeorgianText(extracted.text), extracted.text, `${filename}: false legacy detection`);
    const p = parseCvText(extracted.text);
    const ms = performance.now() - start;
    t.diagnostic(`${filename}: ${ms.toFixed(2)} ms; reason=${extracted.reason}; chars=${extracted.text.length}`);
    if (ms >= 5000) failures.push(`${filename}: exceeded 5 s`);
    if (filename === 'scanned.pdf') { assert.equal(extracted.reason, 'scanned'); continue; }
    // Compare the documented normalized API representation, not display punctuation.
    const want: Record<string, unknown> = {...expected,
      phone: candidatePhone(expected.phone),
      roles: expected.roles.map(r => r.label),
      roleDates: expected.roles.map(r => ({start:r.start,end:r.end === 'current' ? 'present' : r.end})),
      languages: expected.languages.map(l => ({...l,level:l.level === 'full professional' ? 'c1' : l.level})),
    };
    const actual: Record<string, unknown> = {...p,
      roleDates: p.positions?.map(({start,end}) => ({start,end})),
    };
    for (const [field,value] of Object.entries(want)) {
      const ok = stable(value) === stable(actual[field]);
      scores[field] = (scores[field] ?? 0) + Number(ok);
      t.diagnostic(`${filename} ${field}: ${ok ? 'OK' : 'MISS'}${ok ? '' : ' actual=' + JSON.stringify(actual[field])}`);
      if (!ok && baseline.results.find(r => r.filename === filename)?.fields.find(f => f.field === field)?.ok)
        failures.push(`${filename}/${field}: regression from baseline OK`);
    }
  }
  t.diagnostic('BEFORE (text-bearing fixtures): ' + JSON.stringify(Object.fromEntries(Object.entries(baseline.totals).map(([k,v]) => [k,v.correct]))));
  t.diagnostic('AFTER / 11: ' + JSON.stringify(scores));
  const total = existing.reduce((n,f) => n + (scores[f] ?? 0), 0);
  if (total < 65) failures.push(`existing groups ${total}/77 < 65`);
  for (const f of ['name','email','phone']) if ((scores[f] ?? 0) < 10) failures.push(`${f}: ${scores[f]}/11 < 10`);
  // Provisional floor for nine non-legacy text fixtures; owner must report observed scores.
  for (const f of ['certifications','roleDates']) if ((scores[f] ?? 0) < 9) failures.push(`${f}: ${scores[f]}/11 < 9`);
  assert.deepEqual(failures, []);
});
