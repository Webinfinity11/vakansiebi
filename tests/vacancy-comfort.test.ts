import test from 'node:test';
import assert from 'node:assert/strict';
import { vacancySummary } from '../lib/vacancy-summary';
import { readActivity } from '../lib/vacancy-activity';
import { similarity } from '../lib/similar-vacancies';
import { parseDetail } from '../worker/adapters';
import { vacancyContacts } from '../lib/vacancy-details';
import type { PublicJob } from '../lib/types';

void test('summary preserves qualifications and negations, stops at unrelated sections, and never guesses missing terms', () => {
  const conflict = vacancySummary({
    description: 'უნდა ქონდეს გამოცდილება.',
    facts: [{ label: 'გამოცდილება', value: 'გამოცდილების გარეშე' }],
  });
  assert.equal(conflict[0].label, 'გამოცდილება — დასაზუსტებელია');
  assert.match(conflict[0].value, /უნდა ქონდეს გამოცდილება/);
  assert.deepEqual(
    vacancySummary({
      description:
        'გამოცდილება: სასურველია, სავალდებულო არ არის\nჩვენ გთავაზობთ:\nკვება არ შედის\nბონუსი შედეგების მიხედვით\nმოთხოვნები:\nგრაფიკი: 09:00–18:00',
      facts: [],
    }),
    [
      { label: 'გამოცდილება', value: 'სასურველია, სავალდებულო არ არის' },
      {
        label: 'ბენეფიტები',
        value: 'კვება არ შედის · ბონუსი შედეგების მიხედვით',
      },
    ],
  );
  assert.deepEqual(
    vacancySummary({
      description:
        'ჩვენი კომპანია ტრანსპორტის სფეროში მუშაობს. გვაქვს გამოცდილება.',
    }),
    [],
  );
  assert.deepEqual(
    vacancySummary({
      description:
        'სამუშაო ადგილი: თბილისი და შემოგარენი უმეტესად\nაუცილებელია მართვის მოწმობა B',
      facts: [{ label: 'გამოცდილება', value: '3 წლამდე' }],
    }),
    [
      { label: 'გამოცდილება', value: '3 წლამდე' },
      { label: 'მისამართი', value: 'თბილისი და შემოგარენი უმეტესად' },
      { label: 'მთავარი მოთხოვნა', value: 'მართვის მოწმობა B' },
    ],
  );
  assert.deepEqual(
    vacancySummary({ description: 'ბენეფიტები: კვება და ტრანსპორტი' }),
    [{ label: 'ბენეფიტები', value: 'კვება და ტრანსპორტი' }],
  );
});
void test('browser activity tolerates corrupted storage and bounds valid unique records', () => {
  const id = 'b672744c-ff4f-4d4a-989b-969cf2ae6736';
  assert.deepEqual(readActivity('{'), { seen: [], hidden: [] });
  assert.deepEqual(
    readActivity(
      JSON.stringify({
        seen: [id, id, 'bad', 42],
        hidden: [
          null,
          { id, title: 'Title' },
          { id, title: 'Duplicate' },
          { id: 'bad', title: 'Bad' },
        ],
      }),
    ),
    { seen: [id], hidden: [{ id, title: 'Title' }] },
  );
});
void test('similarity requires a role overlap or meaningful category and city, and explains only actual matches', () => {
  const job = {
    id: 'one',
    title: 'მოლარე',
    city: 'თბილისი',
    category: 'სხვა',
    description: 'სამუშაო გრაფიკი: 09:00–18:00',
  } as PublicJob;
  assert.equal(similarity(job, { ...job }), null);
  assert.equal(
    similarity(
      { ...job, title: 'მობილური ამწის ოპერატორი (დღიური)' },
      { ...job, id: 'two', title: 'ფოტო ოპერატორი' },
    ),
    null,
  );
  assert.equal(similarity(job, { ...job, id: 'two', title: 'მცხობელი' }), null);
  assert.ok(
    similarity(job, {
      ...job,
      id: 'two',
      title: 'მოლარე-კონსულტანტი',
    })?.reasons.includes('გრაფიკი ემთხვევა'),
  );
  assert.equal(
    similarity(job, {
      ...job,
      id: 'two',
      title: 'მოლარე-კონსულტანტი',
      description: 'სრული განაკვეთი',
    })?.reasons.includes('გრაფიკი ემთხვევა'),
    false,
  );
});
void test('SS imports only matching public vacancy contact controls, including protected displayed email and labelled experience', () => {
  const email = 'hr@example.com';
  const encoded =
    '12' +
    email
      .split('')
      .map((c) => (c.charCodeAt(0) ^ 0x12).toString(16).padStart(2, '0'))
      .join('');
  const data = {
    id: 123,
    jobsDealType: 1,
    title: 'მოლარე',
    publisherName: 'Company',
    description:
      'ვეძებთ მოლარეს ჩვენი გუნდის გასაძლიერებლად. დეტალებზე დაგვიკავშირდით.',
    phones: [
      { applicationId: 123, phoneNumber: '599272590' },
      { applicationId: 555, phoneNumber: '555123456' },
    ],
    email,
    companyInfo: { phone: '577000000' },
  };
  const state = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: data } } })}</script>`;
  const html = `${state}<button>599 27 25 ** ნომრის ჩვენება</button><button><a data-cfemail="${encoded}">[email protected]</a></button><div class="detail-grid-item"><h2>გამოცდილება</h2></div><p class="detail-grid-item-value">3 წლამდე</p>`;
  const job = parseDetail('ss', html, 'https://jobs.ss.ge/ka/details/test-123');
  assert.deepEqual(
    vacancyContacts(job).phones.map((p) => p.number),
    ['+995599272590'],
  );
  assert.deepEqual(
    vacancyContacts(job).emails.map((e) => e.email),
    [email],
  );
  assert.ok(
    job.facts?.some((f) => f.label === 'გამოცდილება' && f.value === '3 წლამდე'),
  );
  const hidden = parseDetail(
    'ss',
    state,
    'https://jobs.ss.ge/ka/details/test-123',
  );
  assert.deepEqual(vacancyContacts(hidden), { phones: [], emails: [] });
});
