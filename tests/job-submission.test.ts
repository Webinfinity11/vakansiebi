import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  submissionSchema,
  submissionVacancy,
  submissionDate,
  contactDestination,
  contactRequiredMessage,
} from '../lib/job-submission';
import {
  vacancyContacts,
  applicationDestination,
} from '../lib/vacancy-details';
import { POST } from '../app/api/submissions/route';

export function validSubmission() {
  return {
    requestId: randomUUID(),
    placement: 'premium',
    title: 'გაყიდვების კონსულტანტი',
    company: 'საცდელი კომპანია',
    category: 'გაყიდვები',
    city: 'თბილისი',
    mode: 'ადგილზე',
    employmentType: 'სრული განაკვეთი',
    salaryFrom: '1000',
    salaryTo: '1500',
    salaryPeriod: 'თვე',
    salaryBasis: 'ხელზე',
    deadline: submissionDate(new Date(Date.now() + 30 * 86400000)),
    description:
      'მოვალეობები: მომხმარებელთან ურთიერთობა და პროდუქციის წარდგენა. სამუშაო გრაფიკი: ორშაბათიდან პარასკევის ჩათვლით, 10:00–18:00. გამოცდილება სასურველია.',
    contact: 'hr@example.com',
    consent: true,
    fax: '',
  };
}

void test('submission validates ranges, contacts, dates and removes client publication flags', () => {
  const data = validSubmission();
  for (const invalid of [
    { salaryTo: '900' },
    { salaryFrom: '' },
    { salaryFrom: '-100' },
    { contact: '' },
    { contact: 'not-email' },
    { contact: '123456' },
    { contact: 'javascript:alert(1)' },
    { contact: 'https://a:b@example.com' },
    { city: '', mode: 'ადგილზე' },
    { city: '  ', mode: 'ჰიბრიდული' },
    { category: 'invalid' },
    { deadline: '2026-02-30' },
    { deadline: '2000-01-01' },
    { deadline: '2099-12-31' },
    { consent: false },
    { description: 'მოკლე' },
    { description: 'ა'.repeat(29) },
    { title: 'bad\u0000title' },
    { salaryBasis: 'ბრუტო' },
    { placement: 'admin' },
  ])
    assert.equal(
      submissionSchema.safeParse({ ...data, ...invalid }).success,
      false,
      JSON.stringify(invalid),
    );
  for (const valid of [
    { fax: 'spam' },
    { city: '', mode: 'დისტანციური' },
    { category: '' },
    { description: 'ა'.repeat(30) },
  ])
    assert.equal(
      submissionSchema.safeParse({ ...data, ...valid }).success,
      true,
      JSON.stringify(valid),
    );
  assert.equal(
    submissionSchema.parse({ ...data, category: undefined }).category,
    '',
  );
  assert.equal(
    submissionSchema.parse({ ...data, salaryBasis: undefined }).salaryBasis,
    'ხელზე',
  );
  const parsed = submissionSchema.parse({
    ...data,
    status: 'published',
    placement_expires_at: '2099-01-01',
    source: 'hr.ge',
  });
  assert.equal('status' in parsed, false);
  assert.equal('placement_expires_at' in parsed, false);
  const job = submissionVacancy(parsed, randomUUID());
  assert.equal(job.source, 'JOBX');
  assert.equal(job.salaryMin, 1000);
  assert.match(job.salary, /ხელზე/);
  const gross = submissionVacancy(
    submissionSchema.parse({ ...data, salaryBasis: 'დარიცხული' }),
    randomUUID(),
  );
  assert.equal(gross.salary, '1000–1500 ₾ / თვე · დარიცხული');
  assert.equal(vacancyContacts(job).emails[0].application, true);
  const phoneOnly = submissionVacancy(
    submissionSchema.parse({ ...data, contact: '+995 555 12 34 56' }),
    randomUUID(),
  );
  assert.equal(vacancyContacts(phoneOnly).phones[0].number, '+995555123456');
  assert.deepEqual(phoneOnly.facts, [
    { label: 'ტელეფონი', value: '+995 555 12 34 56' },
  ]);
  const linkOnly = submissionVacancy(
    submissionSchema.parse({
      ...data,
      contact: 'https://example.com/apply',
    }),
    randomUUID(),
  );
  assert.equal(
    applicationDestination(linkOnly)?.url,
    'https://example.com/apply',
  );
  const automaticCategory = submissionVacancy(
    submissionSchema.parse({ ...data, category: '' }),
    randomUUID(),
  );
  assert.equal(automaticCategory.category, '');
});

void test('contact destination accepts recruitment email, Georgian phone or HTTPS application link', () => {
  assert.deepEqual(contactDestination('hr@example.com'), {
    email: 'hr@example.com',
    phone: '',
    applicationUrl: '',
  });
  assert.deepEqual(contactDestination('+995 555 12 34 56'), {
    email: '',
    phone: '+995 555 12 34 56',
    applicationUrl: '',
  });
  assert.deepEqual(contactDestination('https://example.com/apply'), {
    email: '',
    phone: '',
    applicationUrl: 'https://example.com/apply',
  });
  for (const value of [
    'hr@example.com',
    '+995 555 12 34 56',
    'https://example.com/apply',
  ])
    assert.deepEqual(
      contactDestination(`  ${value}  `),
      contactDestination(value),
    );
  assert.deepEqual(
    contactDestination('HTTPS://example.com/apply?to=hr@example.com'),
    {
      email: '',
      phone: '',
      applicationUrl: 'HTTPS://example.com/apply?to=hr@example.com',
    },
  );
  for (const value of [
    'http://example.com',
    'https://a:b@example.com',
    'https://user@example.com',
    'https://localhost/apply',
    'https://',
    'javascript:alert(1)',
    'privacy@example.com',
    'dpo@example.com',
    'noreply@example.com',
    'NO-REPLY@example.com',
    'abuse@example.com',
    'unsubscribe@example.com',
    'hr@example.com\r\nBcc:evil@example.com',
    'abc',
  ])
    assert.equal(contactDestination(value), null, value);
});

void test('missing or invalid contact marks the contact field with the shared message', () => {
  for (const contact of ['', 'not-email']) {
    const parsed = submissionSchema.safeParse({
      ...validSubmission(),
      contact,
    });
    assert.ok(!parsed.success);
    for (const issue of parsed.error.issues)
      assert.deepEqual(issue.path, ['contact']);
    assert.ok(
      parsed.error.issues.some(
        (issue) => issue.message === contactRequiredMessage,
      ),
    );
  }
});

void test('non-remote submissions require a city after trimming', () => {
  const parsed = submissionSchema.safeParse({
    ...validSubmission(),
    city: '  ',
  });
  assert.ok(!parsed.success);
  assert.deepEqual(
    parsed.error.issues.map(({ path, message }) => ({ path, message })),
    [{ path: ['city'], message: 'აირჩიე ქალაქი' }],
  );
});

void test('public submission endpoint rejects cross-site, oversized, malformed and invalid requests before storage', async () => {
  const make = (
    body: string,
    origin = 'https://jobx.ge',
    url = 'https://jobx.ge/api/submissions',
  ) =>
    new Request(url, {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body,
    });
  const oldAppUrl = process.env.APP_URL;
  try {
    delete process.env.APP_URL;
    assert.equal((await POST(make('{}', 'https://example.com'))).status, 403);
    assert.equal((await POST(make('x'.repeat(100001)))).status, 413);
    assert.equal((await POST(make('{'))).status, 400);
    const invalid = await POST(
      make(JSON.stringify({ ...validSubmission(), salaryTo: '500' })),
    );
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.json()).fields.salaryTo);
    process.env.APP_URL = 'https://jobx.ge';
    assert.equal(
      (
        await POST(
          make(
            '{}',
            'https://jobx.ge',
            'http://127.0.0.1:3000/api/submissions',
          ),
        )
      ).status,
      400,
    );
    assert.equal((await POST(make('{}', 'https://example.com'))).status, 403);
  } finally {
    if (oldAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = oldAppUrl;
  }
});

void test('filled honeypot receives unique acknowledgements without a session secret or database', async () => {
  const saved = {
    APP_URL: process.env.APP_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
  };
  try {
    process.env.APP_URL = 'https://jobx.ge';
    delete process.env.SESSION_SECRET;
    delete process.env.DATABASE_URL;
    const data = { ...validSubmission(), fax: 'http://spam' };
    const ids = new Set<string>();
    for (let n = 0; n < 2; n++) {
      const response = await POST(
        new Request('https://jobx.ge/api/submissions', {
          method: 'POST',
          headers: {
            origin: 'https://jobx.ge',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }),
      );
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const body = await response.json();
      assert.equal(body.received, true);
      assert.match(
        body.id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      assert.equal('alreadyReceived' in body, false);
      ids.add(body.id);
    }
    assert.equal(ids.size, 2);
  } finally {
    for (const name of ['APP_URL', 'SESSION_SECRET', 'DATABASE_URL'] as const) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
