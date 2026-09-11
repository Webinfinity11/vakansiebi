import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClosedEmployerVacancy,
  completeDescription,
  parseHelio,
  parseLinkedPage,
  sameLinkedTitle,
  linkedProvider,
  unusableEmployerLink,
} from '../worker/linked-description';
import type { Vacancy } from '../lib/types';
import { validateLinkedUrl } from '../worker/public-page';
import { cleanText, parseDetail } from '../worker/adapters';
void test('linked employer description keeps all paragraphs, bullets, contacts and final requirements', () => {
  const text =
    '<p>პირველი აბზაცი კომპანიისა და სამუშაო ადგილის შესახებ.</p><h4>მოვალეობები:</h4><ul><li>პირველი მოვალეობა</li><li>მეორე მოვალეობა</li></ul><p>ხელფასი: 1700 ლარი თვეში</p><p>ბოლო მოთხოვნა: ინგლისური B2.</p>';
  const v = parseHelio(
    {
      public_url_token: 'abc',
      status: 'active',
      job_title_local: 'მოლარე თბილისში',
      description: text,
    },
    'abc',
    'https://app.helio-ai.com/apply/abc',
  );
  assert.match(v.text, /პირველი აბზაცი/);
  assert.match(v.text, /• მეორე მოვალეობა/);
  assert.ok(v.text.endsWith('ბოლო მოთხოვნა: ინგლისური B2.'));
  assert.throws(() =>
    parseHelio(
      { public_url_token: 'wrong', status: 'active', description: text },
      'abc',
      v.url,
    ),
  );
  assert.equal(sameLinkedTitle('მოლარე', 'მოლარე თბილისში'), true);
  assert.equal(sameLinkedTitle('მოლარე', 'გაყიდვების მენეჯერი'), false);
});
void test('only vacancy content is read from employer HTML; application inputs and navigation stay out', () => {
  const text =
    'ძირითადი სამუშაო პირობები და მოთხოვნები. '.repeat(5) + 'საბოლოო პირობა.';
  const v = parseLinkedPage(
    `<nav>Other jobs</nav><div class="pub-vac-text"><div class="vacancy_title_inner">მოლარე</div><div class="pub_vac_text_detail">${text}</div></div><form>Candidate email<input value="private"></form>`,
    'https://dailygroup.selfrecruit.ge/abc',
    'selfrecruit',
  );
  assert.equal(v.title, 'მოლარე');
  assert.equal(v.text, text);
  assert.doesNotMatch(v.text, /Candidate|Other jobs|private/);
  const smart = parseLinkedPage(
    `<h1 class="job-title">მოლარე</h1><section class="job-section">${text}</section><section class="job-section">დამატებითი საბოლოო პირობა.</section><form>CV</form>`,
    'https://jobs.smartrecruiters.com/company/123',
    'smart',
  );
  assert.ok(smart.text.endsWith('დამატებითი საბოლოო პირობა.'));
});
void test('employer URL allowlist rejects local addresses, credentials and lookalike hosts', () => {
  for (const url of [
    'https://127.0.0.1/',
    'https://hel-ai.com.evil.test/apply/abc',
    'https://x:y@hel-ai.com/apply/abc',
    'https://a.selfrecruit.ge.evil.test/',
  ])
    assert.throws(() => validateLinkedUrl(url));
  assert.equal(linkedProvider('https://hel-ai.com/apply/abc'), 'helio');
  assert.equal(linkedProvider('https://hel-ai.com/'), null);
});
void test('original public links and table values survive text extraction', () => {
  const result = cleanText(
    '<h4>გრაფიკი</h4><table><tr><td>ორშაბათი</td><td>10:00–18:00</td></tr></table><p>დეტალები <a href="https://example.org/terms">წესები</a></p>',
  );
  assert.match(result, /ორშაბათი \| 10:00–18:00/);
  assert.match(result, /წესები https:\/\/example.org\/terms/);
});
void test('government keeps previously unknown labelled sections and final full text', () => {
  const html =
    '<input id="ID" value="42"><dl id="regForm"><dt>პოზიციის დასახელება</dt><dd>სპეციალისტი</dd><dt>ორგანიზაცია</dt><dd>საჯარო სამსახური</dd><dt>დამატებით მოთხოვნილი დოკუმენტები</dt><dd>სერტიფიკატი და გამოცდილების დამადასტურებელი სრული დოკუმენტაცია</dd></dl>';
  const v = parseDetail(
    'hrgov',
    html,
    'https://vacancy.hr.gov.ge/JobProvider/UserOrgVaks/Details/42',
  );
  assert.match(v.description, /დამატებით მოთხოვნილი დოკუმენტები/);
  assert.ok(
    v.description.endsWith(
      'სერტიფიკატი და გამოცდილების დამადასტურებელი სრული დოკუმენტაცია',
    ),
  );
});

void test('equivalent bilingual role titles match while different roles and branch labels remain distinct', () => {
  assert.equal(
    sameLinkedTitle(
      'სტუდიური მხარდაჭერის ტექნიკოსი',
      'Studio Support Technician',
    ),
    true,
  );
  assert.equal(
    sameLinkedTitle(
      'ტალანტების მოზიდვის უმცროსი სპეციალისტი',
      'Junior Talent Acquisition Specialist',
    ),
    true,
  );
  assert.equal(
    sameLinkedTitle('Manual QA ინჟინერი', 'Manual QA Engineer - QA ტესტერი'),
    true,
  );
  assert.equal(
    sameLinkedTitle(
      'ელექტრიკოსი-ბათუმი',
      'ტექნიკური დეპარტამენტის ელექტრიკოსი',
    ),
    true,
  );
  assert.equal(
    sameLinkedTitle(
      'RB ბანკირის ასისტენტი',
      'სივრცის კონსულტანტი - ვაჟა-ფშაველას გამზირის ს/ც 6',
    ),
    false,
  );
  assert.equal(
    sameLinkedTitle(
      'მოლარე-კონსულტანტი (300 არაგველის ქუჩა)',
      'მოლარე-კონსულტანტი (სოკარის სათავო ოფისი)',
    ),
    false,
  );
});

void test('explicit employer expiry is distinguished from a missing selector', () => {
  assert.throws(
    () =>
      parseLinkedPage(
        '<h1 class="job-title">მოლარე</h1><div class="jobad--empty-state">ამ ვაკანსიას ვადა გაუვიდა</div>',
        'https://jobs.smartrecruiters.com/company/123',
        'smart',
      ),
    ClosedEmployerVacancy,
  );
});

void test('linked employer logos come from the matched posting header, excluding platform images', () => {
  const body = 'პოზიციის სრულყოფილი აღწერა და ძირითადი მოთხოვნები. '.repeat(5);
  const self = parseLinkedPage(
    `<div class="pub-vac-text"><div class="brand-logo"><img src="buffer/tmp/brand/logo.png"></div><h1 class="vacancy_title_inner">მოლარე</h1><p>${body}</p></div><footer><img src="/platform.png"></footer>`,
    'https://dailygroup.selfrecruit.ge/abc',
    'selfrecruit',
  );
  assert.equal(
    self.logoUrl,
    'https://dailygroup.selfrecruit.ge/buffer/tmp/brand/logo.png',
  );
  const smart = parseLinkedPage(
    `<header class="jobad-header"><span class="logo"><img src="https://c.smartrecruiters.com/sr-company-logo/company/huge"></span></header><h1 class="job-title">მოლარე</h1><section class="job-section">${body}</section>`,
    'https://jobs.smartrecruiters.com/company/123',
    'smart',
  );
  assert.equal(
    smart.logoUrl,
    'https://c.smartrecruiters.com/sr-company-logo/company/huge',
  );
  const helio = parseHelio(
    {
      public_url_token: 'abc',
      status: 'active',
      job_title_local: 'მოლარე',
      description: body,
      company_logo:
        'https://helio-ai-assets-prod.s3.amazonaws.com/company/logo/test.png',
    },
    'abc',
    'https://app.helio-ai.com/apply/abc',
  );
  assert.equal(
    helio.logoUrl,
    'https://helio-ai-assets-prod.s3.amazonaws.com/company/logo/test.png',
  );
  assert.equal(
    parseHelio(
      {
        public_url_token: 'abc',
        status: 'active',
        job_title_local: 'მოლარე',
        description: body,
        company_logo:
          'https://helio-ai-assets-prod.s3.amazonaws.com.evil.test/logo.png',
      },
      'abc',
      'https://app.helio-ai.com/apply/abc',
    ).logoUrl,
    undefined,
  );
});

void test('verified bilingual titles and spelling variants match without conflating distinct roles', () => {
  assert.equal(sameLinkedTitle('იურისტი', 'Lawyer'), true);
  assert.equal(sameLinkedTitle('უმცროსი ბუღალტერი', 'Junior Accountant'), true);
  assert.equal(sameLinkedTitle('ტრენინგ მენეჯერი', 'ტრეინინგ მენეჯერი'), true);
  assert.equal(
    sameLinkedTitle(
      'გრანულატორის ოპერატორი',
      'საწარმოო დანადგარის ოპერატორი (გრანულატორი)',
    ),
    true,
  );
  assert.equal(sameLinkedTitle('იურისტი', 'Lawyer Assistant'), false);
  assert.equal(
    sameLinkedTitle('უმცროსი ბუღალტერი', 'Senior Accountant'),
    false,
  );
});

void test('Helio terminal states close only the identified posting; unknown or mismatched status stays retryable', () => {
  for (const status of ['completed', 'canceled'])
    assert.throws(
      () =>
        parseHelio(
          { public_url_token: 'abc', status, job_title_local: 'მოლარე' },
          'abc',
          'https://app.helio-ai.com/apply/abc',
        ),
      ClosedEmployerVacancy,
    );
  for (const data of [
    { public_url_token: 'abc', status: 'draft', job_title_local: 'მოლარე' },
    {
      public_url_token: 'wrong',
      status: 'completed',
      job_title_local: 'მოლარე',
    },
  ])
    assert.throws(
      () => parseHelio(data, 'abc', 'https://app.helio-ai.com/apply/abc'),
      (error) =>
        error instanceof Error && !(error instanceof ClosedEmployerVacancy),
    );
});

const vacancy = (over: Partial<Vacancy> = {}): Vacancy => ({
  title: 'მოლარე',
  company: 'კომპანია',
  city: 'თბილისი',
  category: 'გაყიდვები',
  salary: '',
  salaryMin: null,
  currency: '',
  salaryPeriod: '',
  mode: '',
  description: 'ვაკანსიის ძირითადი აღწერა წყაროდან. '.repeat(10),
  url: 'https://jobs.ge/ge/?view=jobs&id=751437',
  source: 'jobs',
  deadline: '',
  datePosted: '2026-09-09',
  applicationLinks: [
    { label: 'განაცხადი', url: 'https://demo.selfrecruit.ge/abc' },
  ],
  ...over,
});
const employerPage = (title: string) =>
  `<div class="pub-vac-text"><div class="vacancy_title_inner">${title}</div><div class="pub_vac_text_detail">${'დამსაქმებლის სრული პირობები და მოთხოვნები. '.repeat(5)}</div></div>`;
function employerResponses(t: TestContext, page: () => Response) {
  return t.mock.method(globalThis, 'fetch', async (input: URL | string) => {
    const url = new URL(String(input));
    if (url.pathname === '/robots.txt')
      return new Response('', { status: 404 });
    return page();
  });
}

void test('an employer link that is a different vacancy keeps the source text instead of losing the vacancy', async (t) => {
  const mock = employerResponses(
    t,
    () => new Response(employerPage('გაყიდვების მენეჯერი'), { status: 200 }),
  );
  try {
    const job = vacancy();
    const result = await completeDescription(job);
    assert.equal(result.description, job.description);
    assert.equal(result.fullTextUrl, undefined);
  } finally {
    mock.mock.restore();
  }
});

void test('a removed employer page keeps the source text, while a temporary employer failure stays retryable', async (t) => {
  const missing = employerResponses(t, () => new Response('', { status: 404 }));
  try {
    const job = vacancy({
      applicationLinks: [
        { label: 'განაცხადი', url: 'https://gone.selfrecruit.ge/abc' },
      ],
    });
    assert.equal((await completeDescription(job)).description, job.description);
  } finally {
    missing.mock.restore();
  }
  const broken = employerResponses(t, () => new Response('', { status: 503 }));
  try {
    await assert.rejects(
      () =>
        completeDescription(
          vacancy({
            applicationLinks: [
              { label: 'განაცხადი', url: 'https://down.selfrecruit.ge/abc' },
            ],
          }),
        ),
      (error: unknown) => !unusableEmployerLink(error),
    );
  } finally {
    broken.mock.restore();
  }
});

void test('a snapshot that already carries verified employer text retains it and stays queued', async (t) => {
  const mock = employerResponses(
    t,
    () => new Response(employerPage('გაყიდვების მენეჯერი'), { status: 200 }),
  );
  try {
    await assert.rejects(
      () =>
        completeDescription(
          vacancy({
            applicationLinks: [
              { label: 'განაცხადი', url: 'https://kept.selfrecruit.ge/abc' },
            ],
          }),
          vacancy({ fullTextUrl: 'https://kept.selfrecruit.ge/abc' }),
        ),
      (error: unknown) => unusableEmployerLink(error),
    );
  } finally {
    mock.mock.restore();
  }
});
