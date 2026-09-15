import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  readSubmissionLogo,
  SubmissionLogoError,
} from '../lib/server/submission-logos';
import { maxLogoBytes, submissionLogoSchema } from '../lib/submission-logo';
import {
  isLocalLogoUrl,
  safeExternalUrl,
  safeLogoUrl,
} from '../lib/vacancy-media';
import { vacancySchema } from '../lib/vacancy-schema';
import {
  submissionSchema,
  submissionVacancy,
  submissionDate,
} from '../lib/job-submission';
import { POST } from '../app/api/submissions/route';

const dataUrl = (format: string, bytes: Buffer) =>
  `data:image/${format};base64,${bytes.toString('base64')}`;
const base = () => ({
  requestId: crypto.randomUUID(),
  title: 'გაყიდვების კონსულტანტი',
  company: 'ლოგოს ტესტი',
  city: 'თბილისი',
  mode: 'ადგილზე',
  employmentType: 'სრული განაკვეთი',
  salaryFrom: '',
  salaryTo: '',
  salaryPeriod: 'თვე',
  deadline: submissionDate(new Date(Date.now() + 86400000)),
  description:
    'მომხმარებლის მომსახურება და კონსულტაცია სამუშაო დღეებში. გამოცდილება სასურველია.',
  contact: 'hr@example.com',
  consent: true,
});

void test('local logos accept exactly one lowercase SHA-256 path without widening external URL rules', () => {
  const url = `/api/logos/${'ab'.repeat(32)}`;
  assert.equal(safeLogoUrl(url), url);
  assert.equal(isLocalLogoUrl(url), true);
  assert.equal(safeExternalUrl(url), '');
  assert.ok(
    vacancySchema.safeParse(
      submissionVacancy(
        submissionSchema.parse(base()),
        crypto.randomUUID(),
        url,
      ),
    ).success,
  );
  for (const value of [
    `/api/logos/${'a'.repeat(63)}`,
    `/api/logos/${'a'.repeat(65)}`,
    `/api/logos/${'A'.repeat(64)}`,
    `/api/logos/../${'a'.repeat(64)}`,
    `${url}?x=1`,
    `${url}#x`,
    `${url}/more`,
    `//host${url}`,
    `https://jobx.ge${url}`,
    ` ${url}`,
    `${url}\n`,
  ]) {
    assert.equal(isLocalLogoUrl(value), false, value);
    assert.equal(safeLogoUrl(value), '', value);
  }
  assert.equal(
    safeLogoUrl('https://www.hr.ge/logo.png'),
    'https://www.hr.ge/logo.png',
  );
  assert.equal(safeLogoUrl('https://attacker.test/logo.png'), '');
  assert.equal(
    safeExternalUrl('https://company.test/about'),
    'https://company.test/about',
  );
});

void test('upload schema is optional and rejects SVG, data URL parameters and overlong input', () => {
  assert.equal(submissionLogoSchema.parse(undefined), '');
  for (const value of [
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:text/html;base64,YQ==',
    'data:image/png;charset=utf-8;base64,YQ==',
    'https://example.com/image.png',
    'x'.repeat(67000),
  ])
    assert.equal(submissionLogoSchema.safeParse(value).success, false);
});

void test('server validates all three raster formats, strips extra bytes and hashes normalized content', async () => {
  assert.equal(await readSubmissionLogo(undefined), null);
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const bytes = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#2457e6' },
    })
      .toFormat(format)
      .toBuffer();
    const first = await readSubmissionLogo(dataUrl(format, bytes));
    const retry = await readSubmissionLogo(dataUrl(format, bytes));
    assert.ok(first && retry);
    assert.match(first.hash, /^[a-f0-9]{64}$/);
    assert.equal(first.hash, retry.hash);
    assert.equal(first.contentType, `image/${format}`);
    const metadata = await sharp(first.bytes).metadata();
    assert.equal(metadata.format, format);
    assert.equal(metadata.width, 32);
    assert.equal(metadata.height, 24);
    if (format === 'png') {
      const padded = Buffer.concat([
        bytes,
        Buffer.alloc(maxLogoBytes - bytes.length),
      ]);
      const edge = await readSubmissionLogo(dataUrl(format, padded));
      assert.equal(
        edge?.hash,
        first.hash,
        'exact byte limit is allowed and trailing bytes are discarded',
      );
      await assert.rejects(
        readSubmissionLogo(
          dataUrl(format, Buffer.concat([padded, Buffer.from('x')])),
        ),
        SubmissionLogoError,
      );
    }
  }
});

void test('server rejects spoofed MIME, SVG, corrupt pixels, noncanonical base64 and excessive dimensions', async () => {
  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: 'red' },
  })
    .png()
    .toBuffer();
  for (const value of [
    dataUrl(
      'png',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
      ),
    ),
    dataUrl('jpeg', png),
    dataUrl('png', png.subarray(0, 24)),
    dataUrl('jpeg', Buffer.from('ffd8ff0000000000', 'hex')),
    dataUrl('webp', Buffer.from('RIFF0000WEBPfake')),
    'data:image/png;base64,A',
    'data:image/png;base64,YR==',
  ])
    await assert.rejects(readSubmissionLogo(value), SubmissionLogoError);
  for (const [width, height] of [
    [257, 1],
    [1, 257],
    [1024, 1024],
  ]) {
    const large = await sharp({
      create: { width, height, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      readSubmissionLogo(dataUrl('png', large)),
      SubmissionLogoError,
    );
  }
});

void test('invalid logo produces an editable field error before database access', async () => {
  const origin = new URL(process.env.APP_URL || 'https://jobx.ge').origin;
  const response = await POST(
    new Request(`${origin}/api/submissions`, {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...base(),
        logo: dataUrl('png', Buffer.from('<svg/>')),
      }),
    }),
  );
  assert.equal(response.status, 400);
  assert.ok((await response.json()).fields.logo);
});
