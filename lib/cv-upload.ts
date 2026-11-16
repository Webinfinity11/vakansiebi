/** Check the bounded ZIP directory rather than trusting a .docx suffix or a ZIP magic byte. */
function zipHas(bytes: Buffer, required: string[]): boolean {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) return false;
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      bytes.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + bytes.readUInt16LE(i + 20) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) return false;
  let pos = bytes.readUInt32LE(end + 16);
  const count = bytes.readUInt16LE(end + 10);
  const found = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || bytes.readUInt32LE(pos) !== 0x02014b50) return false;
    const nameLength = bytes.readUInt16LE(pos + 28);
    const next =
      pos +
      46 +
      nameLength +
      bytes.readUInt16LE(pos + 30) +
      bytes.readUInt16LE(pos + 32);
    if (next > end) return false;
    const name = bytes.toString('utf8', pos + 46, pos + 46 + nameLength);
    if (required.includes(name)) {
      const offset = bytes.readUInt32LE(pos + 42);
      if (
        offset + 30 > pos ||
        bytes.readUInt32LE(offset) !== 0x04034b50 ||
        bytes.readUInt16LE(pos + 8) & 1
      )
        return false;
      found.add(name);
    }
    pos = next;
  }
  return required.every(name => found.has(name));
}

export const maxCvBytes = 4 * 1024 * 1024;
export function isDocx(bytes: Buffer): boolean {
  return zipHas(bytes, ['word/document.xml', '[Content_Types].xml']);
}
export function isOdt(bytes: Buffer): boolean {
  return zipHas(bytes, ['content.xml', 'mimetype', 'META-INF/manifest.xml']) &&
    bytes.subarray(0, 256).includes(Buffer.from('application/vnd.oasis.opendocument.text'));
}
export function isRtf(bytes: Buffer): boolean {
  return /^\{\\rtf[1-9]/.test(bytes.subarray(0, 16).toString('ascii'));
}
export function isTxt(bytes: Buffer): boolean {
  try { return !new TextDecoder('utf-8', { fatal: true }).decode(bytes).includes('\0'); }
  catch { return false; }
}
