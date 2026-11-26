import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJobText, mergeJobImport } from '../lib/company-job-import';
import { newCompanyJob } from '../lib/company-job-form';

const fixtures = [
  {
    name: 'Georgian sections and boilerplate',
    text: 'პოზიცია: გაყიდვების მენეჯერი\nთბილისში\nანაზღაურება: 1500-2000 ლარი\nვალდებულებები:\n- მომხმარებელთან კომუნიკაცია\nსაკვალიფიკაციო მოთხოვნები:\n* გამოცდილება გაყიდვებში\nჩვენ გთავაზობთ:\nდაზღვევა\nელფოსტა: hr@example.com\nბოლო ვადა: 2026-12-20',
    expected: {
      title: 'გაყიდვების მენეჯერი',
      city: 'თბილისი',
      salaryFrom: '1500',
      salaryTo: '2000',
    },
  },
  {
    name: 'English vacancy',
    text: 'Job title: Product Designer\nLocation: Batumi\nSalary: GEL 2500\nResponsibilities:\n* Design accessible interfaces\nRequirements:\nExperience designing mobile applications',
    expected: { title: 'Product Designer', city: 'ბათუმი', salaryFrom: '2500' },
  },
  {
    name: 'no salary',
    text: 'ბუღალტერი\nქუთაისი\nმოთხოვნები:\nსაჭიროა საბუღალტრო პროგრამების ცოდნა',
    expected: { title: 'ბუღალტერი', city: 'ქუთაისი', salaryFrom: undefined },
  },
  {
    name: 'single amount',
    text: 'თანამდებობა: მოლარე\nხელფასი: 1200 ლარი თვეში\nმოვალეობები:\nსალაროსთან მუშაობა და მომსახურება',
    expected: { salaryFrom: '1200', salaryTo: undefined },
  },
  {
    name: 'spaces and lari symbol',
    text: 'პოზიცია: ოპერატორი\nანაზღაურება: 1 500 – 2 000 ₾\nმოვალეობები:\nზარებზე პასუხი და მომხმარებელთან საუბარი',
    expected: { salaryFrom: '1500', salaryTo: '2000' },
  },
  {
    name: 'remote',
    text: 'Position: Software Developer\nRemote\nResponsibilities:\nDevelop and maintain the company website',
    expected: { mode: 'დისტანციური' },
  },
  {
    name: 'part time',
    text: 'პოზიცია: კონსულტანტი\nნახევარი განაკვეთი\nრუსთავში\nმოთხოვნები:\nმომხმარებლების მომსახურების გამოცდილება',
    expected: { employmentType: 'ნახევარი განაკვეთი', city: 'რუსთავი' },
  },
  {
    name: 'phones years percentages',
    text: 'ვაკანსია: ადმინისტრატორი\nგამოცდილება 2020-2026 წლებში\nტელეფონი: 599 123 456\nბონუსი 20%\nმოვალეობები:\nოფისის ყოველდღიური საქმიანობის მართვა',
    expected: { salaryFrom: undefined, salaryTo: undefined },
  },
  {
    name: 'hourly excluded',
    text: 'Position: Tutor\nSalary: 50 GEL per hour\nRequirements:\nExperience teaching mathematics in English',
    expected: { salaryFrom: undefined },
  },
  {
    name: 'foreign currency excluded',
    text: 'Position: Designer\nSalary: 1500 USD / 4000 GEL\nResponsibilities:\nPrepare marketing materials and illustrations',
    expected: { salaryFrom: undefined },
  },
  {
    name: 'daily excluded',
    text: 'პოზიცია: დამხმარე\nხელფასი: 100 ლარი დღეში\nმოვალეობები:\nპროდუქციის დახარისხება და შეფუთვა',
    expected: { salaryFrom: undefined },
  },
  {
    name: 'hybrid full time',
    text: 'Position: Analyst\nHybrid, full-time\nRequirements:\nExperience analysing commercial operations',
    expected: { mode: 'ჰიბრიდული', employmentType: undefined },
  },
  {
    name: 'declined Georgian range',
    text: 'პოზიცია: მენეჯერი\nხელფასი: 1500-დან 2000-მდე ლარი\nმოთხოვნები:\nპერსონალის მართვის გამოცდილება',
    expected: { salaryFrom: '1500', salaryTo: '2000' },
  },
];
for (const fixture of fixtures)
  void test(fixture.name, () => {
    const result = parseJobText(fixture.text);
    for (const [key, value] of Object.entries(fixture.expected))
      assert.equal(result[key as keyof typeof result], value, key);
  });
void test('normalises section headings and bullets; strips only known boilerplate', () => {
  const body = parseJobText(fixtures[0].text).description!;
  assert.match(body, /მოვალეობები\n• მომხმარებელთან/);
  assert.match(body, /მოთხოვნები\n• გამოცდილება/);
  assert.match(body, /პირობები\nდაზღვევა/);
  assert.doesNotMatch(body, /hr@|ბოლო ვადა|1500|პოზიცია:/);
});
void test('empty and garbage yield no fields', () => {
  for (const text of ['', '   ', '1234567890 !!! %%%', '\0\0\0'])
    assert.deepEqual(parseJobText(text), {});
});
void test('long document is capped', () => {
  const result = parseJobText(
    'Position: Engineer\nRequirements:\n' +
      'Experience in engineering and customer communication. '.repeat(1000),
  );
  assert.equal(result.description?.length, 20000);
});
void test('company banner is not a title', () => {
  assert.equal(
    parseJobText('შპს მაგალითი\nჩვენ ვეძებთ ახალ თანამშრომელს ჩვენს გუნდში.')
      .title,
    undefined,
  );
});
void test('ambiguous city and multiple salaries omitted', () => {
  const result = parseJobText(
    'Position: Manager\nTbilisi / Batumi\nSalary: 1500 GEL\nSalary: 2000 GEL',
  );
  assert.equal(result.city, undefined);
  assert.equal(result.salaryFrom, undefined);
});
void test('merging fills defaults but protects typed and hidden fields', () => {
  const defaults = newCompanyJob();
  const form = {
    ...defaults,
    title: 'ჩემი დასახელება',
    description: 'ჩემი აღწერა',
    category: 'ტექნოლოგიები' as const,
    contact: 'hr@example.com',
    languages: [{ name: 'ინგლისური' as const, level: 'B2' as const }],
  };
  const result = mergeJobImport(form, defaults, {
    title: 'Other title',
    city: 'ბათუმი',
    description: 'File description',
    salaryFrom: '1500',
    // Unknown imported keys must be ignored at runtime.
    // @ts-expect-error Simulate additional fields in an untrusted response.
    category: 'გაყიდვები',
    contact: 'other@example.com',
  });
  assert.equal(result.form.title, form.title);
  assert.equal(result.form.description, form.description);
  assert.equal(result.form.city, 'ბათუმი');
  assert.equal(result.form.salaryFrom, '1500');
  assert.equal(result.form.category, form.category);
  assert.equal(result.form.contact, form.contact);
  assert.deepEqual(result.form.languages, form.languages);
  assert.deepEqual(result.kept, ['title', 'description']);
  assert.deepEqual(result.filled, ['city', 'salaryFrom']);
  assert.equal(form.salaryFrom, '');
});

void test('declined currency suffixes describe a range', () => {
  const result = parseJobText(
    'პოზიცია: მენეჯერი\nხელფასი: 1500 ლარიდან 2000 ლარამდე\nმოთხოვნები:\nსაჭიროა გუნდთან მუშაობის გამოცდილება',
  );
  assert.equal(result.salaryFrom, '1500');
  assert.equal(result.salaryTo, '2000');
});
void test('ambiguous upper-only salary and separate daily period are not monthly salary', () => {
  for (const pay of [
    'Salary: up to 2000 GEL',
    'Salary: 100 GEL\nper day',
    'ხელფასი: 2000 ლარამდე',
  ]) {
    assert.equal(
      parseJobText(
        'Position: Designer\n' +
          pay +
          '\nRequirements:\nExperience designing web applications',
      ).salaryFrom,
      undefined,
    );
  }
});


test('DOCX list markers are opt-in and do not change ordinary CV extraction', async () => {
  const { xmlText } = await import('../lib/server/cv-text');
  const xml = '<w:p><w:r><w:t>Responsibilities</w:t></w:r></w:p>' +
    '<w:p w:rsidR="1"><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Help customers &amp; colleagues</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr /></w:pPr><w:r><w:t>Maintain records</w:t></w:r></w:p>';
  assert.equal(xmlText(xml), 'Responsibilities\nHelp customers & colleagues\nMaintain records\n');
  assert.equal(xmlText(xml, false), xmlText(xml));
  assert.equal(xmlText(xml, true), 'Responsibilities\n• Help customers & colleagues\n• Maintain records\n');
});
