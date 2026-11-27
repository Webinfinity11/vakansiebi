import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readCompanyLogo } from '../lib/server/company-logo-upload';
import { maxLogoBytes } from '../lib/submission-logo';

for (const format of ['png', 'jpeg', 'webp'] as const) {
  test(`accepts real ${format} pixels and returns a sanitized logo`, async () => {
    const bytes = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#125caa' } })
      .toFormat(format).toBuffer();
    const logo = await readCompanyLogo(new File([new Uint8Array(bytes)], 'logo.' + format, { type: `image/${format}` }));
    assert.equal(logo.contentType, `image/${format}`);
    assert.match(logo.hash, /^[a-f0-9]{64}$/);
    assert.equal((await sharp(logo.bytes).metadata()).width, 24);
  });
}

test('rejects SVG even when named PNG', async () => {
  await assert.rejects(readCompanyLogo(new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'logo.png', { type: 'image/png' })), /PNG/);
});

test('rejects an executable renamed to JPEG', async () => {
  await assert.rejects(readCompanyLogo(new File(['MZ executable'], 'logo.jpg', { type: 'image/jpeg' })), /PNG/);
});

test('rejects forged PNG magic without valid pixels', async () => {
  const fake = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('invalid pixels')]);
  await assert.rejects(readCompanyLogo(new File([new Uint8Array(fake)], 'logo.png')), /ლოგოს წაკითხვა/);
});

test('rejects files exceeding the existing storage limit', async () => {
  await assert.rejects(readCompanyLogo(new File([new Uint8Array(maxLogoBytes + 1)], 'logo.png')), /50 KB/);
});

test('rejects oversized dimensions, missing and empty files', async () => {
  const bytes = await sharp({ create: { width: 257, height: 1, channels: 3, background: '#125caa' } }).png().toBuffer();
  await assert.rejects(readCompanyLogo(new File([new Uint8Array(bytes)], 'logo.png')), /50 KB/);
  await assert.rejects(readCompanyLogo(null), /PNG/);
  await assert.rejects(readCompanyLogo(new File([], 'logo.png')), /PNG/);
});
