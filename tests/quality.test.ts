import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessVacancy,
  assessReportedTotal,
  noObservation,
} from '../worker/quality';
import type { Vacancy } from '../lib/types';
const v: Vacancy = {
  title: 'Developer',
  company: 'Acme',
  city: 'თბილისი',
  category: 'სხვა',
  salary: '1000 GEL',
  salaryMin: 1000,
  currency: 'GEL',
  salaryPeriod: 'თვე',
  mode: 'ადგილზე',
  description:
    'A useful description with detailed duties and clear requirements. '.repeat(
      20,
    ),
  url: 'https://www.hr.ge/announcement/123/test',
  source: 'hr.ge',
  deadline: '2099-01-01',
  datePosted: '2026-01-01',
  logoUrl: 'https://www.hr.ge/logo.png',
  facts: [],
  applicationLinks: [],
};
const time = new Date('2026-09-10T10:00:00Z');
const later = (minutes: number) => new Date(time.getTime() + minutes * 60000);
void test('quality guard allows honest initial optional omissions and ordinary source edits', () => {
  assert.equal(
    assessVacancy(
      null,
      { ...v, logoUrl: '', salary: '', salaryMin: null },
      noObservation,
      time,
    ).hold,
    false,
  );
  assert.equal(
    assessVacancy(
      v,
      {
        ...v,
        title: 'Senior Developer',
        description: v.description + 'New details',
      },
      noObservation,
      time,
    ).hold,
    false,
  );
});
void test('missing identity never replaces good data; description collapse waits for independent repeated verification', () => {
  assert.equal(
    assessVacancy(v, { ...v, company: '' }, noObservation, time).hold,
    true,
  );
  const next = {
    ...v,
    description:
      'A brief but valid new vacancy description with working conditions.',
  };
  const first = assessVacancy(v, next, noObservation, time);
  assert.equal(first.hold, true);
  const rapid = assessVacancy(v, next, first, later(1));
  assert.equal(rapid.observations, 1);
  const second = assessVacancy(v, next, first, later(30));
  assert.equal(second.hold, true);
  const third = assessVacancy(v, next, second, later(1440));
  assert.equal(third.hold, false);
});
void test('a single optional disappearance is held once, then accepted without fabricating old values', () => {
  const next = { ...v, logoUrl: '' };
  const first = assessVacancy(v, next, noObservation, time);
  assert.equal(first.hold, true);
  assert.match(first.warning!, /logoUrl/);
  const confirmed = assessVacancy(v, next, first, later(30));
  assert.equal(confirmed.hold, false);
  assert.equal(next.logoUrl, '');
  const recovered = assessVacancy(v, v, first, later(5));
  assert.equal(recovered.hold, false);
});
void test('broad field loss and removed closing date get longer confirmation, while unrelated changes reset it', () => {
  const next = {
    ...v,
    logoUrl: '',
    city: '',
    salary: '',
    salaryMin: null,
    deadline: '',
  };
  const first = assessVacancy(v, next, noObservation, time),
    second = assessVacancy(v, next, first, later(30));
  assert.equal(second.hold, true);
  assert.equal(
    assessVacancy(
      v,
      { ...next, title: 'Something different' },
      second,
      later(1440),
    ).observations,
    1,
  );
});
void test('source total sharp drop retains baseline until independent confirmation, tolerating small live count movement', () => {
  const first = assessReportedTotal(3400, 1000, undefined, time);
  assert.equal(first.hold, true);
  const previous = {
    value: first.candidate,
    firstSeen: first.firstSeen,
    lastSeen: first.lastSeen,
    observations: first.observations,
  };
  assert.equal(assessReportedTotal(3400, 1005, previous, later(1)).hold, true);
  assert.equal(
    assessReportedTotal(3400, 1005, previous, later(30)).hold,
    false,
  );
  assert.equal(assessReportedTotal(3400, 3000, previous, later(5)).hold, false);
  assert.equal(
    assessReportedTotal(3400, null, previous, later(1440)).hold,
    true,
  );
  assert.equal(assessReportedTotal(null, 1000, undefined, time).hold, false);
});
