import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationDestination,
  vacancyContacts,
  workSchedule,
  telephoneHref,
} from '../lib/vacancy-details';
import { cleanText, parseDetail } from '../worker/adapters';
void test('phone contacts need source context, normalize and deduplicate without treating numbers as pay or IDs', () => {
  const job = {
    description:
      'დაგვიკავშირდით ნომერზე +995 595762323 /579458787 WhatsApp. ტელეფონი: 595 76 23 23\nანაზღაურება 200000000 ლარი. ID 555111222',
    facts: [],
  };
  assert.deepEqual(
    vacancyContacts(job).phones.map((p) => p.number),
    ['+995595762323', '+995579458787'],
  );
  assert.equal(
    vacancyContacts({ description: 'ID 555111222', facts: [] }).phones.length,
    0,
  );
  assert.equal(telephoneHref('tel:+995555123456?x=other'), null);
  assert.equal(telephoneHref('https://example.com/555123456'), null);
  assert.equal(telephoneHref('tel:%2B995555123456'), '+995555123456');
  assert.equal(
    vacancyContacts({
      description: cleanText('<p><a href="tel:+995555123456">დარეკვა</a></p>'),
      facts: [],
    }).phones[0].number,
    '+995555123456',
  );
});
void test('schedules preserve explicit days and hours including multiline shifts, never infer from employment', () => {
  assert.deepEqual(
    workSchedule({
      description:
        '** სამუშაო საათები: 10:00-18:00, ორშაბათი-შაბათი (კვირაში 6 დღე)',
      facts: [],
    }),
    ['10:00-18:00, ორშაბათი-შაბათი (კვირაში 6 დღე)'],
  );
  assert.deepEqual(
    workSchedule({
      description:
        'სამუშაო გრაფიკი:\nორშაბათი-პარასკევი 09:00–18:00\nანაზღაურება: 1500 ლარი',
      facts: [],
    }),
    ['ორშაბათი-პარასკევი 09:00–18:00'],
  );
  assert.deepEqual(
    workSchedule({ description: '11:00-20:00\n20:00-04:00', facts: [] }),
    ['11:00-20:00', '20:00-04:00'],
  );
  assert.deepEqual(
    workSchedule({
      description: 'სრული განაკვეთი. განაცხადი მიიღება 10:00 საათამდე.',
      facts: [],
    }),
    [],
  );
  assert.deepEqual(
    workSchedule({
      description: 'სამუშაო გრაფიკი: შეთანხმებით',
      facts: [{ label: 'სამუშაო გრაფიკი', value: 'შეთანხმებით' }],
    }),
    ['შეთანხმებით'],
  );
});
void test('SS retains publicly displayed conditions containing working hours, without profile contacts', () => {
  const d = {
    id: 123,
    jobsDealType: 1,
    title: 'მცხობელი',
    publisherName: 'კაფე',
    description: 'ვეძებთ გამოცდილ მცხობელს ჩვენი გუნდის გასაძლიერებლად.',
    conditions: '• სამუშაო საათები: 9:00-21:00 მდე',
    phones: ['555000000'],
    email: 'private@example.com',
  };
  const j = parseDetail(
    'ss',
    `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: d } } })}</script>`,
    'https://jobs.ss.ge/ka/details/mcxobeli-123',
  );
  assert.deepEqual(workSchedule(j), ['9:00-21:00 მდე']);
  assert.equal(vacancyContacts(j).emails.length, 0);
  assert.equal(vacancyContacts(j).phones.length, 0);
});

void test('only an unambiguous application link becomes the main action', () => {
  assert.equal(
    applicationDestination({
      applicationLinks: [
        {
          label: 'განაცხადის გაგზავნა',
          url: 'https://careers.example.com/apply',
        },
      ],
    })?.url,
    'https://careers.example.com/apply',
  );
  assert.equal(
    applicationDestination({
      applicationLinks: [
        {
          label: 'Application privacy policy',
          url: 'https://example.com/privacy',
        },
      ],
    }),
    null,
  );
  assert.equal(
    applicationDestination({
      applicationLinks: [{ label: 'Apply', url: 'javascript:alert(1)' }],
    }),
    null,
  );
  assert.equal(
    applicationDestination({
      applicationLinks: [
        { label: 'Apply', url: 'https://example.com/a' },
        { label: 'Apply', url: 'https://example.com/b' },
      ],
    }),
    null,
  );
});

void test('a form or hiring-system link labelled with its bare URL opens directly', () => {
  const direct = (...urls: string[]) =>
    applicationDestination({
      applicationLinks: urls.map((url) => ({ label: url, url })),
    })?.url ?? null;
  for (const url of [
    'https://jsc-bank-of-georgia.hirehive.com/molare-ambrolauri-mLCqVO',
    'https://forms.gle/abc123',
    'https://docs.google.com/forms/d/e/1FAIpQ/viewform',
    'https://careertourinvestgroup.bitrix24.site/crm_form_wsk4c/',
    'https://bdo.peopleforce.io/careers/v/245624-intern',
    'https://crocosquad.com/careers/106?career=Manager',
  ])
    assert.equal(direct(url), url);
  // Social profiles, front pages, shared documents and the source board itself are not forms.
  assert.equal(direct('https://career.ardi.ge/'), null);
  assert.equal(direct('https://www.facebook.com/silknet'), null);
  assert.equal(direct('https://docs.google.com/document/d/1Wj/edit'), null);
  assert.equal(direct('https://jobs.ge/en/ads/?view=jobs&id=756007'), null);
  assert.equal(direct('https://www.hr.ge/announcement/494770/x'), null);
  // The employer's front page does not compete with its vacancy page.
  assert.equal(
    direct(
      'https://jobs.silknet.com/',
      'https://jobs.silknet.com/jobs-war/welcome.do?page=vacancyDetail&id=16726',
      'https://www.facebook.com/silknet',
    ),
    'https://jobs.silknet.com/jobs-war/welcome.do?page=vacancyDetail&id=16726',
  );
  // Tracked and untracked copies of one form are one destination.
  assert.equal(
    direct(
      'https://acme.hirehive.com/cashier-x1',
      'https://acme.hirehive.com/cashier-x1?source=jobs.ge',
    ),
    'https://acme.hirehive.com/cashier-x1',
  );
  // A vacancy page and its WhatsApp shortcut lead to the vacancy page.
  assert.equal(
    direct(
      'https://careers.wegroup.ge/k5kn/jg/wa',
      'https://careers.wegroup.ge/k5kn/jg',
    ),
    'https://careers.wegroup.ge/k5kn/jg',
  );
  // Two different vacancies remain a choice for the candidate.
  assert.equal(
    direct(
      'https://careers.wolt.com/en/jobs/4/7925981',
      'https://careers.wolt.com/en/jobs/4/7984874',
    ),
    null,
  );
});

void test('privacy and no-reply addresses are not presented as vacancy contacts', () => {
  const contacts = vacancyContacts({
    description: 'Application privacy: dpo@example.com. CV: jobs@example.com',
    facts: [],
  });
  assert.deepEqual(
    contacts.emails.map((c) => c.email),
    ['jobs@example.com'],
  );
});

void test('public employer application URLs remain usable when source labels say only link', () => {
  assert.equal(
    applicationDestination({
      applicationLinks: [{ label: 'ბმული', url: 'https://smrtr.io/BHW3v' }],
    })?.url,
    'https://smrtr.io/BHW3v',
  );
  assert.equal(
    applicationDestination({
      applicationLinks: [
        { label: 'კომპანიის საიტი', url: 'https://example.com/' },
      ],
    }),
    null,
  );
});
