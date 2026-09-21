import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CV_STORAGE_KEY,
  contrastRatio,
  cvSchema,
  cvProgress,
  sampleCv,
  cvText,
  emptyCv,
  newId,
  readCv,
  writeCv,
  clearCv,
  formatPeriod,
  type CvStorage,
} from '../lib/cv';
import { centerCrop, photoKind } from '../lib/cv-photo';

function memory(): CvStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

void test('emptyCv provides valid language-specific defaults', () => {
  for (const language of ['ka', 'en'] as const) {
    const cv = emptyCv(language);
    assert.equal(cv.language, language);
    assert.equal(cv.version, 1);
    assert.equal(cv.template, 'classic');
    assert.equal(cv.showPhoto, language === 'ka');
    for (const key of [
      'photo',
      'fullName',
      'title',
      'phone',
      'email',
      'city',
      'link',
      'summary',
    ] as const)
      assert.equal(cv[key], '');
    for (const key of [
      'experience',
      'education',
      'skills',
      'languages',
    ] as const)
      assert.deepEqual(cv[key], []);
    assert.deepEqual(cvSchema.parse(cv), cv);
  }
  assert.equal(emptyCv().language, 'ka');
});

void test('writeCv refreshes updatedAt and readCv returns the saved model', () => {
  const store = memory();
  const cv = {
    ...emptyCv(),
    fullName: 'ნინო ბერიძე',
    updatedAt: '2020-01-01T00:00:00.000Z',
  };
  const saved = writeCv(store, cv);
  assert.notEqual(saved.updatedAt, cv.updatedAt);
  assert.equal(saved.fullName, cv.fullName);
  assert.deepEqual(readCv(store), saved);
  assert.equal(cv.updatedAt, '2020-01-01T00:00:00.000Z');
});

void test('readCv returns null for missing, malformed and invalid data and storage errors', () => {
  const store = memory();
  assert.equal(readCv(store), null);
  for (const raw of [
    '{broken',
    'null',
    '{}',
    JSON.stringify({ ...emptyCv(), version: 2 }),
  ]) {
    store.setItem(CV_STORAGE_KEY, raw);
    assert.equal(readCv(store), null);
  }
  assert.equal(
    readCv({
      ...store,
      getItem: () => {
        throw Error('denied');
      },
    }),
    null,
  );
});

void test('invalid writes and storage failures are reported without discarding the saved CV', () => {
  const store = memory();
  const saved = writeCv(store, emptyCv());
  assert.throws(() => writeCv(store, { ...saved, fullName: 'a'.repeat(121) }));
  assert.deepEqual(readCv(store), saved);
  assert.throws(
    () =>
      writeCv(
        {
          ...store,
          setItem: () => {
            throw Error('quota');
          },
        },
        saved,
      ),
    /quota/,
  );
});

void test('clearCv removes only the CV storage key', () => {
  const store = memory();
  store.setItem('unrelated', 'keep');
  writeCv(store, emptyCv());
  clearCv(store);
  assert.equal(readCv(store), null);
  assert.equal(store.getItem('unrelated'), 'keep');
});

for (const language of ['ka', 'en'] as const) {
  void test(`formatPeriod handles complete, current, one-sided and empty periods in ${language}`, () => {
    assert.equal(
      formatPeriod('2021-03', '2023-08', false, language),
      '2021-03 — 2023-08',
    );
    assert.equal(
      formatPeriod('2021-03', '2023-08', true, language),
      '2021-03 — ' + (language === 'ka' ? 'დღემდე' : 'present'),
    );
    assert.equal(formatPeriod('2021-03', '', false, language), '2021-03');
    assert.equal(formatPeriod('', '2023-08', false, language), '2023-08');
    assert.equal(formatPeriod('', '', false, language), '');
  });
}

void test('cvSchema enforces experience limits and safe photo prefixes', () => {
  const entry = {
    id: '1',
    company: '',
    role: '',
    from: '',
    to: '',
    current: false,
    description: '',
  };
  assert.ok(
    cvSchema.safeParse({ ...emptyCv(), experience: Array(20).fill(entry) })
      .success,
  );
  assert.equal(
    cvSchema.safeParse({ ...emptyCv(), experience: Array(21).fill(entry) })
      .success,
    false,
  );
  for (const photo of [
    'https://example.com/photo.png',
    'data:image/svg+xml;base64,AAAA',
    'data:image/gif;base64,AAAA',
    'data:image/webp;base64,AAAA\n',
  ])
    assert.equal(cvSchema.safeParse({ ...emptyCv(), photo }).success, false);
});

void test('cvSchema enforces field, list, identifier and month limits', () => {
  const cv = emptyCv();
  for (const [key, limit] of Object.entries({
    fullName: 120,
    title: 120,
    phone: 32,
    email: 120,
    city: 80,
    link: 200,
    summary: 1500,
  })) {
    assert.ok(cvSchema.safeParse({ ...cv, [key]: 'x'.repeat(limit) }).success);
    assert.equal(
      cvSchema.safeParse({ ...cv, [key]: 'x'.repeat(limit + 1) }).success,
      false,
    );
  }
  assert.equal(
    cvSchema.safeParse({ ...cv, skills: Array(41).fill('x') }).success,
    false,
  );
  assert.equal(
    cvSchema.safeParse({ ...cv, skills: ['x'.repeat(61)] }).success,
    false,
  );
  const education = {
    id: '1',
    school: '',
    degree: '',
    from: '',
    to: '',
    description: '',
  };
  assert.equal(
    cvSchema.safeParse({ ...cv, education: Array(21).fill(education) }).success,
    false,
  );
  const language = { id: '1', name: '', level: 'native' };
  assert.equal(
    cvSchema.safeParse({ ...cv, languages: Array(11).fill(language) }).success,
    false,
  );
  for (const from of ['2021-13', '2021-00', '2021-1', '2021-03-01'])
    assert.equal(
      cvSchema.safeParse({ ...cv, education: [{ ...education, from }] })
        .success,
      false,
    );
  for (const id of ['', 'x'.repeat(41)])
    assert.equal(
      cvSchema.safeParse({ ...cv, education: [{ ...education, id }] }).success,
      false,
    );
  assert.equal(
    cvSchema.safeParse({
      ...cv,
      photo: 'data:image/webp;base64,' + 'A'.repeat(170000),
    }).success,
    false,
  );
});

void test('both translations have identical deep keys and nonempty strings', () => {
  function keys(value: object, prefix = ''): string[] {
    return Object.entries(value)
      .flatMap(([key, entry]) => {
        const path = prefix + key;
        if (typeof entry === 'object' && entry !== null)
          return [path, ...keys(entry, path + '.')];
        assert.equal(typeof entry, 'string');
        assert.ok(entry.trim());
        return [path];
      })
      .sort();
  }
  assert.deepEqual(keys(cvText.ka), keys(cvText.en));
});

void test('newId returns a nonempty identifier within the schema limit', () => {
  const first = newId();
  assert.ok(first.length > 0 && first.length <= 40);
  assert.notEqual(first, newId());
});

void test('photoKind recognizes PNG, JPEG, WebP and GIF magic bytes', () => {
  assert.equal(photoKind(Uint8Array.of(0x89, 0x50, 0x4e, 0x47)), 'png');
  assert.equal(photoKind(Uint8Array.of(0xff, 0xd8, 0xff)), 'jpeg');
  assert.equal(photoKind(new TextEncoder().encode('RIFF1234WEBP')), 'webp');
  assert.equal(photoKind(new TextEncoder().encode('GIF89a')), 'gif');
  assert.equal(photoKind(new TextEncoder().encode('GIF87a')), 'gif');
});

void test('photoKind rejects unknown, truncated and mismatched signatures', () => {
  for (const bytes of [
    new Uint8Array(),
    Uint8Array.of(0xff, 0xd8),
    Uint8Array.of(0x89, 0x50, 0x4e),
    ...['<svg>', 'GIF', 'RIFF1234WEB', 'RIFF1234WAVE', 'xxxx1234WEBP'].map(
      (text) => new TextEncoder().encode(text),
    ),
  ])
    assert.equal(photoKind(bytes), null);
});

void test('readCv adds appearance defaults to a first-version stored record', () => {
  const store = memory();
  store.setItem(
    CV_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      language: 'ka',
      template: 'classic',
      showPhoto: true,
      photo: '',
      fullName: 'ნინო ბერიძე',
      title: '',
      phone: '',
      email: '',
      city: '',
      link: '',
      summary: '',
      experience: [],
      education: [],
      skills: [],
      languages: [],
      updatedAt: '2026-09-21T00:00:00.000Z',
    }),
  );
  const cv = readCv(store);
  assert.ok(cv);
  assert.equal(cv.accent, '#1f5fbf');
  assert.equal(cv.textColor, '#111111');
  assert.equal(cv.font, 'fira');
  assert.equal(cv.photoShape, 'circle');
  assert.equal(cv.fullName, 'ნინო ბერიძე');
  assert.equal(cv.version, 1);
});

void test('cvSchema accepts six-digit colors and rejects malformed colors', () => {
  for (const accent of ['#12', 'red'])
    assert.equal(cvSchema.safeParse({ ...emptyCv(), accent }).success, false);
  assert.ok(cvSchema.safeParse({ ...emptyCv(), accent: '#Aa12fF' }).success);
});

for (const language of ['ka', 'en'] as const) {
  void test(`sampleCv is valid and complete in ${language}`, () => {
    const cv = sampleCv(language);
    assert.deepEqual(cvSchema.parse(cv), cv);
    assert.equal(cv.language, language);
    assert.equal(cv.photo, '');
    assert.equal(cv.experience.length, 2);
    assert.equal(cv.education.length, 1);
    assert.equal(cv.skills.length, 6);
    assert.equal(cv.languages.length, 2);
    assert.equal(cvProgress(cv), 100);
    assert.equal(cvProgress(emptyCv(language)), 0);
  });
}

void test('cvProgress counts contact alternatives once and requires three skills', () => {
  const cv = emptyCv();
  assert.equal(cvProgress({ ...cv, phone: '123', email: 'a@example.com' }), 13);
  assert.equal(
    cvProgress({ ...cv, fullName: '   ', skills: ['React', 'Git'] }),
    0,
  );
  assert.equal(
    cvProgress({ ...cv, title: 'Developer', skills: ['React', 'Git', 'CSS'] }),
    25,
  );
});

void test('centerCrop centers landscape, portrait and square images', () => {
  assert.deepEqual(centerCrop(1200, 800), { x: 200, y: 0, size: 800 });
  assert.deepEqual(centerCrop(800, 1200), { x: 0, y: 200, size: 800 });
  assert.deepEqual(centerCrop(801, 800), { x: 0.5, y: 0, size: 800 });
  assert.deepEqual(centerCrop(400, 400), { x: 0, y: 0, size: 400 });
});

void test('text colors default to black and require six-digit hex values', () => {
  assert.equal(emptyCv().textColor, '#111111');
  assert.equal(sampleCv('ka').textColor, '#111111');
  assert.equal(
    cvSchema.safeParse({ ...emptyCv(), textColor: 'black' }).success,
    false,
  );
  assert.ok(cvSchema.safeParse({ ...emptyCv(), textColor: '#Aa12fF' }).success);
});

void test('contrastRatio calculates WCAG relative luminance contrast', () => {
  assert.ok(contrastRatio('#111111', '#ffffff') > 15);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(
    contrastRatio('#ffffff', '#111111'),
    contrastRatio('#111111', '#ffffff'),
  );
});
