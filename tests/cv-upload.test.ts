import test from 'node:test';
import assert from 'node:assert/strict';
import { isDocx } from '../lib/cv-upload';
function zip(names: string[]) {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const path = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(path.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(path.length, 28);
    entry.writeUInt32LE(offset, 42);
    local.push(header, path);
    central.push(entry, path);
    offset += header.length + path.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
test('DOCX requires a real ZIP directory containing document and content types', () => {
  assert.equal(isDocx(Buffer.from('PK fake Word document')), false);
  assert.equal(isDocx(zip(['hello.txt'])), false);
  assert.equal(isDocx(zip(['word/document.xml'])), false);
  assert.equal(isDocx(zip(['word/document.xml', '[Content_Types].xml'])), true);
  const corrupt = zip(['word/document.xml', '[Content_Types].xml']);
  corrupt.writeUInt32LE(0xffffff00, corrupt.length - 6);
  assert.equal(isDocx(corrupt), false);
});

test('RTF and UTF-8 sniffing reject masquerading binary files; limit is 4 MiB', async () => {
  const {isRtf,isTxt,isOdt,maxCvBytes} = await import('../lib/cv-upload');
  assert.equal(isRtf(Buffer.from('{\\rtf1\\ansi hello}')), true);
  assert.equal(isRtf(Buffer.from('not rtf')), false);
  assert.equal(isTxt(Buffer.from('ქართული ტექსტი')), true);
  assert.equal(isTxt(Buffer.from([0xff,0,1])), false);
  assert.equal(isOdt(zip(['content.xml'])), false);
  assert.equal(maxCvBytes, 4 * 1024 * 1024);
});
