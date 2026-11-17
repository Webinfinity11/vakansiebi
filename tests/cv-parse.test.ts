import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { parseCvText, normalizeProfile } from '../lib/cv-parse';
import { extractCvText } from '../lib/server/cv-text';

// All applicants and employers below are hypothetical.
const cases = [
  {
    name: 'ქართული ერთსვეტიანი',
    text: `ნანა სადემო\nთბილისი\nსამუშაო გამოცდილება\nბუღალტერი — მაგალითი\n03/2019 – 05/2021\nგანათლება\n2010–2014 ბაკალავრი\nუნარები\nMS Excel, 1С, ფასს, rs.ge\nენები\nინგლისური B2\nქართული მშობლიური`,
    years: 2,
    city: 'თბილისი',
    skill: 'Excel',
    language: 'ინგლისური',
    degree: 'bachelor',
  },
  {
    name: 'English overlapping roles',
    text: `Sample Candidate\nBatumi\nWork history\nDeveloper — Example\nJan 2020 – Dec 2022\nConsultant — Demo\n03/2021 - 05/2023\nEducation\nMaster of Science\nSkills\nPython, SQL, React\nLanguages\nEnglish fluent; German A2`,
    years: 3,
    city: 'ბათუმი',
    skill: 'Python',
    language: 'გერმანული',
    degree: 'master',
  },
  {
    name: 'რუსული',
    text: `Тестовый кандидат\nКутаиси\nОпыт работы\nМенеджер — Пример\nмарт 2019 – март 2022\nОбразование\nМагистр экономики\nНавыки\n1С, Excel, CRM\nЯзыки\nРусский родной\nАнглийский средний`,
    years: 3,
    city: 'ქუთაისი',
    skill: '1C',
    language: 'რუსული',
    degree: 'master',
  },
  {
    name: 'შერეული',
    text: `Rustavi\nგამოცდილება\nDesigner — Example\n2019.03 – 2021.05\nგანათლება\nMBA\nუნარები\nFigma, Photoshop\nLanguages\nინგლისური advanced\nРусский B1`,
    years: 2,
    city: 'რუსთავი',
    skill: 'Figma',
    language: 'რუსული',
    degree: 'master',
  },
  {
    name: 'ორსვეტიანის არეული რიგი',
    text: `ზუგდიდი\nSkills\nAutoCAD\nExperience\nEngineer — Example\n2019–2022\nEducation\nBachelor\nLanguages\nEnglish C1`,
    years: 4,
    city: 'ზუგდიდი',
    skill: 'AutoCAD',
    language: 'ინგლისური',
    degree: 'bachelor',
  },
  {
    name: 'სექციების გარეშე სტაჟს არ გამოიცნობს',
    text: `გორი\nTest Person\nSchool 2010–2014\nExample company 2019–2022\nSQL\nEnglish B2`,
    years: null,
    city: 'გორი',
    skill: 'SQL',
    language: 'ინგლისური',
    degree: null,
  },
  {
    name: 'მხოლოდ წლები სამუშაო სექციაში',
    text: `ფოთი\nგამოცდილება\nმძღოლი — მაგალითი\n2019–2022\nგანათლება\nსაშუალო სკოლა 2005–2017\nუნარები\nმართვის მოწმობა B, C, CE\nენები\nრუსული ბაზისური`,
    years: 4,
    city: 'ფოთი',
    skill: 'მართვის მოწმობა CE',
    language: 'რუსული',
    degree: 'secondary',
  },
  {
    name: 'დღემდე და თვეები',
    text: `თელავი\nსამუშაო გამოცდილება\nმენეჯერი — მაგალითი\nმარტი 2019 – დღემდე\nგანათლება\nპროფესიული კოლეჯი\nუნარები\nCRM, მოლაპარაკება\nენები\nინგლისური საშუალო`,
    years: Math.floor(
      (new Date().getUTCFullYear() * 12 +
        new Date().getUTCMonth() -
        (2019 * 12 + 2) +
        1) /
        12,
    ),
    city: 'თელავი',
    skill: 'CRM',
    language: 'ინგლისური',
    degree: 'vocational',
  },
];
for (const c of cases)
  void test(c.name, () => {
    const p = parseCvText(c.text);
    assert.equal(p.years, c.years);
    assert.equal(p.city, c.city);
    assert.ok(p.skills.includes(c.skill));
    assert.ok(p.languages.some((l) => l.name === c.language));
    assert.equal(p.educationLevel, c.degree);
  });
void test('language levels stay paired on one line; aliases normalize JOBX profiles', () => {
  const p = normalizeProfile({
    ...parseCvText(''),
    skills: ['MS Excel', 'ექსელი', '1С'],
    languages: [
      { name: 'English', level: 'b2' },
      { name: 'Русский', level: 'native' },
    ],
    education: ['ბიზნესის მაგისტრი'],
    city: 'Tbilisi',
  });
  assert.deepEqual(p.skills, ['Excel', '1C']);
  assert.equal(p.educationLevel, 'master');
  assert.equal(p.city, 'თბილისი');
  assert.deepEqual(
    parseCvText('Languages\nEnglish B2, Russian native, German A1').languages,
    [
      { name: 'ინგლისური', level: 'b2' },
      { name: 'რუსული', level: 'native' },
      { name: 'გერმანული', level: 'a1' },
    ],
  );
});
void test('education spans never count; malformed dates and unknown levels stay empty', () => {
  const p = parseCvText(
    'Education\n2010–2019 Bachelor\nLanguages\nEnglish conversational',
  );
  assert.equal(p.years, null);
  assert.equal(p.languages[0].level, null);
  assert.equal(
    parseCvText('Experience\n2029–2012\n13/2019–14/2020').years,
    null,
  );
});
// Small real ZIP archive, deflated document.xml (central directory, local header and EOCD).
function zipXml(xml: string) {
  const name = Buffer.from('word/document.xml'),
    raw = Buffer.from(xml),
    compressed = deflateRawSync(raw);
  let crc = 0xffffffff;
  for (const b of raw) {
    crc ^= b;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt32LE(crc, 16);
  directory.writeUInt32LE(compressed.length, 20);
  directory.writeUInt32LE(raw.length, 24);
  directory.writeUInt16LE(name.length, 28);
  const body = Buffer.concat([local, name, compressed]),
    central = Buffer.concat([directory, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, central, end]);
}
void test('DOCX extraction preserves paragraphs, Unicode and entities', async () => {
  const bytes = zipXml(
    '<w:document><w:body><w:p><w:r><w:t>უნარები</w:t></w:r></w:p><w:p><w:r><w:t>Excel &amp; SQL</w:t></w:r></w:p></w:body></w:document>',
  );
  const text = await extractCvText(bytes, 'sample.docx');
  assert.equal(text, 'უნარები\nExcel & SQL\n');
  assert.ok(parseCvText(text).skills.includes('SQL'));
});
void test('PDF extracts Georgian text and reads two columns in order', async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile('lib/server/fonts/FiraGO-Regular-subset.ttf'),
    { subset: true },
  );
  const page = doc.addPage([600, 800]);
  const left = [
    'სადემო კანდიდატი',
    'თბილისი',
    'უნარები',
    'Excel',
    'SQL',
    'ენები',
    'ინგლისური B2',
  ];
  const right = [
    'სამუშაო გამოცდილება',
    'ბუღალტერი — მაგალითი',
    '2019–2022',
    'განათლება',
    'ბაკალავრი',
  ];
  for (const [x, lines] of [
    [35, left],
    [325, right],
  ] as const)
    lines.forEach((line, i) =>
      page.drawText(line, { x, y: 750 - i * 25, font, size: 12 }),
    );
  const text = await extractCvText(await doc.save(), 'sample.pdf');
  const p = parseCvText(text);
  assert.equal(p.city, 'თბილისი');
  assert.equal(p.years, 4);
  assert.ok(p.skills.includes('Excel'));
  assert.equal(p.educationLevel, 'bachelor');
});
void test('PDF gutter does not cut long lines out of the wider main column', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([600, 800]);
  const left = ['Taylor Sample', 'E X P E R I E N C E', 'Designer — Example Studio', '2019 — 2022',
    'E D U C A T I O N', 'Bachelor of Arts — Example Academy', 'C E R T I F I C A T I O N S', 'Design Certificate'];
  const right = ['Contact', 'taylor@example.com', '+995 555 00 00 13', 'Batumi',
    'S K I L L S', 'Figma', 'Photoshop', 'Typography', 'L A N G U A G E S', 'English C1'];
  for (const [x, lines] of [[30, left], [400, right]] as const)
    lines.forEach((line, i) => page.drawText(line, { x, y: 755 - i * 23, font, size: 10 }));
  const text = await extractCvText(await doc.save(), 'columns.pdf');
  assert.ok(text.indexOf('Bachelor of Arts') < text.indexOf('Contact'), text);
  const profile = parseCvText(text);
  assert.deepEqual(profile.education, ['Bachelor of Arts — Example Academy']);
  assert.equal(profile.educationLevel, 'bachelor');
  assert.ok(profile.skills.includes('Typography'), text);
});

void test('scanned/empty PDF and invalid or oversized files are empty', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  assert.equal(await extractCvText(await doc.save(), 'scan.pdf'), '');
  assert.equal(await extractCvText(Buffer.from('broken'), 'broken.pdf'), '');
  assert.equal(
    await extractCvText(Buffer.alloc(5 * 1024 * 1024 + 1), 'big.docx'),
    '',
  );
  assert.equal(
    await extractCvText(zipXml('x'.repeat(9 * 1024 * 1024)), 'bomb.docx'),
    '',
  );
});
void test('PDF uses coordinates rather than content stream order', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  page.drawText('2019-2022', { x: 30, y: 680, font });
  page.drawText('Experience', { x: 30, y: 730, font });
  page.drawText('Developer - Example', { x: 30, y: 705, font });
  const text = await extractCvText(await doc.save(), 'order.pdf');
  assert.ok(text.indexOf('Experience') < text.indexOf('2019'));
  assert.equal(parseCvText(text).years, 4);
});
void test('DOC best effort extracts UTF-16 Georgian fragments', async () => {
  const text = await extractCvText(
    Buffer.from('უნარები\nExcel და Python\nთბილისი', 'utf16le'),
    'old.doc',
  );
  assert.ok(text.includes('თბილისი'));
});

void test('roles sort most recent first and separate role/company lines pair', () => {
  const p = parseCvText(
    'Experience\nJunior analyst\nExample A\n2019–2020\nSenior analyst — Example B\n2022–2024\nEducation\nBachelor',
  );
  assert.deepEqual(p.roles, [
    'Senior analyst — Example B',
    'Junior analyst — Example A',
  ]);
});
void test('Russian ongoing and all supported present markers', () => {
  for (const end of [
    'Present',
    'Current',
    'დღემდე',
    'ამჟამად',
    'მიმდინარე',
    'по настоящее время',
  ]) {
    const p = parseCvText(
      'Опыт работы\nИнженер — Пример\nянварь 2020 – ' + end,
    );
    assert.ok(p.years !== null && p.years >= 6);
  }
});

void test('extended dates, contact normalization and optional fields', () => {
  const p = parseCvText('Alex Example\nalex@example.com\n555 12 34 56\nBoston, USA\nWORK EXPERIENCE\n01/03/2019 – 30/06/2022\tAnalyst — Example\nCERTIFICATIONS\nExample Certificate');
  assert.equal(p.name, 'Alex Example');
  assert.equal(p.phone, '+995555123456');
  assert.equal(p.city, 'Boston, USA');
  assert.deepEqual(p.positions, [{title:'Analyst',company:'Example',start:'2019-03',end:'2022-06'}]);
  assert.deepEqual(p.certifications, ['Example Certificate']);
  assert.ok(!p.skills.includes('Example Certificate'));
});
void test('CEFR grid uses weakest component and LinkedIn levels map explicitly', () => {
  assert.equal(parseCvText('Languages\nEnglish Listening C1 Reading B2\nSpoken production B1 Writing B2').languages[0].level, 'b1');
  assert.equal(parseCvText('Languages\nEnglish (Full Professional)').languages[0].level, 'c1');
  assert.equal(parseCvText('Languages\nMother tongue(s): Georgian').languages[0].level, 'native');
});
void test('RTF decodes scoped unicode and Cyrillic codepage without metadata', async () => {
  const text = await extractCvText(Buffer.from("{\\rtf1\\ansi\\ansicpg1251{\\fonttbl Hidden}\\uc1\\u4304?\\par \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2}"), 'sample.rtf');
  assert.equal(text, 'ა\nПривет');
});

void test('font-based legacy Georgian conversion ignores filename and ordinary text', async () => {
  const { legacyGeorgian } = await import('../lib/cv-legacy-georgian');
  assert.equal(legacyGeorgian('Tbilisi', 'AcadNusx'), 'თბილისი');
  assert.equal(legacyGeorgian('Tbilisi', 'ABCDEF+AcadNusx-Synthetic-FiraGO'), 'თბილისი');
  assert.equal(legacyGeorgian('English text', 'Arial'), 'English text');
  assert.equal(await extractCvText(Buffer.from('Tbilisi'), 'AcadNusx.txt'), 'Tbilisi');
});

void test('font-less legacy text needs two distinct keywords and preserves contacts and Latin codes', async () => {
  const { legacyGeorgianText } = await import('../lib/cv-legacy-georgian');
  const text = 'nino magaliTi\nsamuSao gamocdileba\nganaTleba\nExcel, SQL, 1C, B2\nname@example.com https://example.com/ganaTleba www.example.com rs.ge\n+995 555 00 00 12';
  const expected = 'ნინო მაგალითი\nსამუშაო გამოცდილება\nგანათლება\nExcel, SQL, 1C, B2\nname@example.com https://example.com/ganaTleba www.example.com rs.ge\n+995 555 00 00 12';
  assert.equal(legacyGeorgianText(text), expected);
  assert.equal(await extractCvText(Buffer.from(text), 'resume.txt'), expected);
  for (const plain of [
    'Jane Sample\nTbilisi\nEducation\nEnglish native\nSQL, Excel',
    'Анна Пример\nОбразование\nОпыт работы\nМосква',
    'gamarjoba, rogor xar? Tbilisi kargia',
    'ganaTleba ganaTleba ganaTleba',
    'myganaTleba gamocdilebaSuffix',
    'English CV https://example.com/ganaTleba/gamocdileba',
    'ganaTleba@example.com gamocdileba@example.com',
    'ქართული samuSao gamocdileba',
  ]) assert.equal(legacyGeorgianText(plain), plain);
});

void test('PDF resolves the original legacy font name before converting mixed-font runs', async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await readFile('lib/server/fonts/FiraGO-Regular-subset.ttf');
  const legacy = await doc.embedFont(bytes, { subset: true, customName: 'ABCDEF+AcadNusx' });
  const normal = await doc.embedFont(bytes, { subset: true });
  const page = doc.addPage([600, 800]);
  page.drawText('nino magaliTi', { x: 35, y: 750, font: legacy, size: 12 });
  page.drawText('person@example.com', { x: 35, y: 725, font: normal, size: 12 });
  const text = await extractCvText(await doc.save(), 'mixed.pdf');
  assert.ok(text.includes('ნინო მაგალითი'), text);
  assert.ok(text.includes('person@example.com'), text);
});

void test('extraction reports scan, unsupported, empty and oversize distinctly', async () => {
  const {extractCv, maxCvBytes} = await import('../lib/server/cv-text');
  const pdf = await PDFDocument.create();
  pdf.addPage();
  assert.equal((await extractCv(await pdf.save(), 'scan.pdf')).reason, 'blank');
  assert.equal((await extractCv(Buffer.from('x'), 'file.exe')).reason, 'unsupported');
  assert.equal((await extractCv(Buffer.alloc(0), 'empty.txt')).reason, 'empty');
  assert.equal((await extractCv(Buffer.alloc(maxCvBytes + 1), 'large.txt')).reason, 'too_large');
});
void test('DOCX alternate textbox appears once and legacy font applies only to its run', async () => {
  const xml = '<w:document><mc:AlternateContent><mc:Choice><w:txbxContent><w:p><w:r><w:rPr><w:rFonts w:ascii="AcadNusx"/></w:rPr><w:t>ena</w:t></w:r><w:r><w:t> English</w:t></w:r></w:p></w:txbxContent></mc:Choice><mc:Fallback><w:p><w:r><w:t>duplicate</w:t></w:r></w:p></mc:Fallback></mc:AlternateContent></w:document>';
  assert.equal(await extractCvText(zipXml(xml), 'textbox.docx'), 'ენა English\n');
});
