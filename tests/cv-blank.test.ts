import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { PDFDocument, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { extractCv, isBlankCv } from '../lib/server/cv-text';
import { renderCvPdf } from '../lib/server/cv-pdf';
import { emptyCv, sampleCv } from '../lib/cv';

const now = new Date().toISOString();

void test('an empty page, or a JOBX PDF saying only "CV", is a blank CV', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  assert.equal((await extractCv(await doc.save(), 'empty.pdf')).reason, 'blank');
  const jobxEmpty = await renderCvPdf({ ...emptyCv('ka'), updatedAt: now });
  assert.equal(await isBlankCv(jobxEmpty, 'cv.pdf'), true);
  assert.equal(await isBlankCv(await renderCvPdf({ ...sampleCv('ka'), updatedAt: now }), 'cv.pdf'), false);
});

void test('a scanned CV or one drawn as outlines is not blank, only unreadable', async () => {
  const scan = await PDFDocument.create();
  const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888888' } }).png().toBuffer();
  scan.addPage([595, 842]).drawImage(await scan.embedPng(png), { x: 0, y: 0, width: 595, height: 842 });
  const scanned = await extractCv(await scan.save(), 'scan.pdf');
  assert.equal(scanned.reason, 'scanned');
  assert.equal(await isBlankCv(await scan.save(), 'scan.pdf'), false);

  const outlined = await PDFDocument.create();
  const page = outlined.addPage([595, 842]);
  for (let i = 0; i < 80; i++)
    page.drawSvgPath(`M ${(i % 20) * 25} 0 L ${(i % 20) * 25 + 10} 10 L ${(i % 20) * 25} 20 Z`, {
      x: 40, y: 800 - Math.floor(i / 20) * 30, color: rgb(0, 0, 0),
    });
  assert.equal(await isBlankCv(await outlined.save(), 'outlined.pdf'), false);
});

// A one-entry ZIP holding the given part, enough for the DOCX reader.
function zip(name: string, xml: string) {
  const file = Buffer.from(name), raw = Buffer.from(xml), packed = deflateRawSync(raw);
  let crc = 0xffffffff;
  for (const b of raw) {
    crc ^= b;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(file.length, 26);
  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(8, 10);
  dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(raw.length, 24);
  dir.writeUInt16LE(file.length, 28);
  const body = Buffer.concat([local, file, packed]), central = Buffer.concat([dir, file]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, central, end]);
}

void test('an empty Word file is blank; one with text is not', async () => {
  const empty = zip('word/document.xml', '<w:document><w:body><w:p/></w:body></w:document>');
  assert.equal(await isBlankCv(empty, 'cv.docx'), true);
  const filled = zip('word/document.xml',
    '<w:document><w:body><w:p><w:r><w:t>ნინო ბერიძე, ბუღალტერი, 1C და Excel, 5 წელი</w:t></w:r></w:p></w:body></w:document>');
  assert.equal(await isBlankCv(filled, 'cv.docx'), false);
});
