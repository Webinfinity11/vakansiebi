import { inflateRawSync } from 'node:zlib';

import { maxCvBytes } from '../cv-upload';
import { legacyGeorgian, legacyGeorgianText } from '../cv-legacy-georgian';
export { maxCvBytes } from '../cv-upload';
const maxText = 60000;
const maxXml = 8 * 1024 * 1024;
const xmlText = (xml: string) =>
  xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const code = n[0] === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

// Read only selected text XML parts with a combined inflation cap. Embedded files,
// macros and external relationships are ignored.
function docx(bytes: Buffer, odt = false) {
  const parts: {name: string; text: string}[] = [];
  let total = 0;
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return '';
  let pos = bytes.readUInt32LE(eocd + 16);
  const count = bytes.readUInt16LE(eocd + 10);
  for (let i = 0; i < count && pos + 46 <= bytes.length; i++) {
    if (bytes.readUInt32LE(pos) !== 0x02014b50) break;
    const method = bytes.readUInt16LE(pos + 10),
      size = bytes.readUInt32LE(pos + 20),
      expanded = bytes.readUInt32LE(pos + 24);
    const nameLen = bytes.readUInt16LE(pos + 28),
      extra = bytes.readUInt16LE(pos + 30),
      comment = bytes.readUInt16LE(pos + 32);
    const name = bytes.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
    if (odt ? name === 'content.xml' : /^word\/(?:document|header\d*|footer\d*)\.xml$/.test(name)) {
      if (expanded > maxXml || size > maxCvBytes) return '';
      const local = bytes.readUInt32LE(pos + 42);
      if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50)
        return '';
      const start =
        local +
        30 +
        bytes.readUInt16LE(local + 26) +
        bytes.readUInt16LE(local + 28);
      if (start + size > bytes.length) return '';
      const data = bytes.subarray(start, start + size);
      const xml =
        method === 8
          ? inflateRawSync(data, { maxOutputLength: maxXml })
          : method === 0
            ? data
            : Buffer.alloc(0);
      total += xml.length;
      if (total > maxXml) return '';
      let source = xml.toString('utf8');
      // Choice and Fallback represent the same textbox. Keep Choice once.
      source = source.replace(/<mc:Fallback\b[^>]*>[\s\S]*?<\/mc:Fallback>/g, '');
      source = source.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, run => {
        const font = /<w:rFonts\b[^>]*>/.exec(run)?.[0] ?? '';
        return run.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
          (_, a, text: string, b) => a + text.split(/(&[^;]+;)/).map(part => part.startsWith('&') ? part : legacyGeorgian(part, font)).join('') + b);
      });
      source = source.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, row =>
        [...row.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)]
          .map(cell => xmlText(cell[1]).trim().replace(/\n/g, ' ')).join('\t') + '\n');
      source = source.replace(/<\/text:[ph]>/g, '\n').replace(/<text:tab\b[^>]*\/>/g, '\t');
      parts.push({name, text: xmlText(source)});
    }
    pos += 46 + nameLen + extra + comment;
  }
  return parts.sort((a,b) => (a.name.includes('header') ? 0 : a.name.includes('footer') ? 2 : 1) - (b.name.includes('header') ? 0 : b.name.includes('footer') ? 2 : 1)).map(p => p.text).join('\n').slice(0, maxText);
}

async function readCvText(
  input: Uint8Array,
  filename: string,
  state: { reason: CvExtractionReason },
): Promise<string> {
  if (input.byteLength > maxCvBytes) return '';
  const bytes = Buffer.from(input);
  const ext = filename.split('.').pop()?.toLowerCase();
  try {
    if (ext === 'docx' || ext === 'odt') return docx(bytes, ext === 'odt');
    if (ext === 'txt') return legacyGeorgianText(new TextDecoder().decode(bytes).slice(0, maxText));
    if (ext === 'rtf') return rtf(bytes).slice(0, maxText);
    if (ext === 'doc') {
      // Legacy binary Word is best effort: the piece table may mix encodings and order.
      const chunks = [
        bytes.toString('utf16le'),
        bytes.toString('latin1'),
      ].flatMap((s) => s.match(/[\p{L}\p{N}][\p{L}\p{N}\p{P}\t ]{3,}/gu) ?? []);
      return chunks.join('\n').slice(0, maxText);
    }
    if (ext !== 'pdf') return '';
    const { getDocument, PDFWorker } =
      await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Explicitly load the in-process worker handler so server bundlers do not resolve
    // pdf.js's relative dynamic worker import against a generated Next chunk.
    // @ts-expect-error pdf.js ships no declarations for its in-process worker entry.
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker =
      worker;
    // Pin the in-process handler, including after a failed relative import cached by hot reload.
    Object.defineProperty(PDFWorker, '_setupFakeWorkerGlobal', {
      value: Promise.resolve(worker.WorkerMessageHandler),
      configurable: true,
    });
    const task = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      fontExtraProperties: true,
      useWorkerFetch: false,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const pdf = await task.promise;
      let result = '';
      const footers = new Map<string, Set<number>>();
      try {
        for (
          let p = 1;
          p <= Math.min(pdf.numPages, 50) && result.length < maxText;
          p++
        ) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          // Text extraction alone does not populate commonObjs with FontFaceObject.
          // Load the operator list (without rendering) to expose original font names.
          // Already-Unicode Georgian needs no legacy-font recovery.
          if (!content.items.some(i => 'str' in i && /\p{Script=Georgian}/u.test(i.str)))
            await page.getOperatorList();
          const items = content.items.filter(
            (
              i,
            ): i is Extract<typeof i, { str: string }> => 'str' in i,
          );
          const viewport = page.getViewport({ scale: 1 });
          const width = viewport.width;
          for (const item of items.filter(i => i.transform[5] < viewport.height * .08)) {
            const key = item.str.trim();
            if (key) { const pages = footers.get(key) ?? new Set<number>(); pages.add(p); footers.set(key, pages); }
          }
          // Search all plausible gutters. Sparse full-width headings may cross a
          // gutter; a long single-column paragraph must not create a second column.
          let gutter = 0, best = -Infinity;
          for (let x = width * .2; x < width * .8; x += 3) {
            const left = items.filter(i => i.str.trim() && i.transform[4] + i.width < x - 5);
            const right = items.filter(i => i.str.trim() && i.transform[4] > x + 5);
            const crossing = items.filter(i => i.str.trim() && i.transform[4] <= x + 5 && i.transform[4] + i.width >= x - 5);
            if (left.length < 3 || right.length < 3 || crossing.length > 2) continue;
            const gap = Math.min(...right.map(i => i.transform[4])) - Math.max(...left.map(i => i.transform[4] + i.width));
            // Prefer a clear gutter over one cutting through column text. A
            // small fixed penalty lets a false gutter win by excluding a long
            // education line from the left edge calculation, inflating its gap.
            const score = gap - crossing.length * width;
            if (gap >= 15 && score > best) { gutter = x; best = score; }
          }
          const groups: (typeof items)[] = [];
          if (!gutter) groups.push(items);
          else {
            const crossing = items.filter(i => i.transform[4] < gutter && i.transform[4] + i.width >= gutter)
              .sort((a,b) => b.transform[5] - a.transform[5]);
            let top = Infinity;
            for (const boundary of [...crossing, null]) {
              const bottom = boundary?.transform[5] ?? -Infinity;
              const band = items.filter(i => !crossing.includes(i) && i.transform[5] <= top && i.transform[5] > bottom);
              groups.push(band.filter(i => i.transform[4] < gutter), band.filter(i => i.transform[4] >= gutter));
              if (boundary) groups.push([boundary]);
              top = bottom;
            }
          }
          for (const item of items) {
            let font = content.styles[item.fontName]?.fontFamily ?? '';
            if (page.commonObjs.has(item.fontName)) {
              const loaded = page.commonObjs.get(item.fontName) as {name?: string; loadedName?: string};
              font += ' ' + (loaded.name ?? '') + ' ' + (loaded.loadedName ?? '');
            }
            item.str = legacyGeorgian(item.str, font);
            if (/^(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(item.str.trim())) item.str = '';
          }
          for (const group of groups) {
            const lines: { y: number; items: typeof items }[] = [];
            for (const item of [...group].sort(
              (a, b) =>
                b.transform[5] - a.transform[5] ||
                a.transform[4] - b.transform[4],
            )) {
              let line = lines.find(
                (l) => Math.abs(l.y - item.transform[5]) < 3,
              );
              if (!line) {
                line = { y: item.transform[5], items: [] };
                lines.push(line);
              }
              line.items.push(item);
            }
            result +=
              lines
                .map((l) =>
                  l.items
                    .sort((a, b) => a.transform[4] - b.transform[4])
                    .map((i) => i.str)
                    .join(' '),
                )
                .join('\n') + '\n\f\n';
          }
          page.cleanup();
        }
        if (pdf.numPages > 0 && result.replace(/\s/g, '').length < 10) { state.reason = 'scanned'; return ''; }
        const repeated = new Set([...footers].filter(([,pages]) => pages.size > 1).map(([text]) => text));
        return result.split('\n').filter(line => !repeated.has(line.trim())).join('\n').slice(0, maxText).trim();
      } finally {
        await task.destroy();
      }
    };
    return await Promise.race([
      read(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => {
          state.reason = 'timeout';
          void task.destroy();
          resolve('');
        }, 5000);
      }),
    ]).finally(() => clearTimeout(timer));
  } catch {
    return '';
  }
}

export type CvExtractionReason = null | 'scanned' | 'unsupported' | 'empty' | 'too_large' | 'timeout';
export type CvExtraction = { text: string; reason: CvExtractionReason };
export async function extractCv(input: Uint8Array, filename: string): Promise<CvExtraction> {
  if (input.byteLength > maxCvBytes) return { text: '', reason: 'too_large' };
  if (!/\.(pdf|docx|doc|odt|rtf|txt)$/i.test(filename)) return { text: '', reason: 'unsupported' };
  const state: { reason: CvExtractionReason } = { reason: null };
  const text = await readCvText(input, filename, state);
  return { text, reason: state.reason ?? (text.trim() ? null : 'empty') };
}
export async function extractCvText(input: Uint8Array, filename: string): Promise<string> {
  return (await extractCv(input, filename)).text;
}

/** RTF groups carry scoped Unicode fallback counts and ignored destinations. */
function rtf(bytes: Buffer): string {
  const source = bytes.toString('latin1');
  const cp = /\\ansicpg(\d+)/.exec(source)?.[1] ?? '1252';
  const decoder = new TextDecoder(cp === '1251' ? 'windows-1251' : 'windows-1252');
  let state = { skip: false, uc: 1 }, fallback = 0, output = '';
  const stack: typeof state[] = [];
  const tokens = source.match(/\\'[0-9a-f]{2}|\\[a-z]+-?\d* ?|\\[^a-z]|[{}]|[^\\{}]/gi) ?? [];
  for (const token of tokens) {
    if (token === '{') { stack.push({...state}); continue; }
    if (token === '}') { state = stack.pop() ?? state; continue; }
    if (/^\\(?:fonttbl|colortbl|stylesheet|info|pict|object|header|footer)\b|^\\\*/.test(token)) { state.skip = true; continue; }
    if (state.skip) continue;
    const u = /^\\u(-?\d+) ?$/.exec(token);
    const uc = /^\\uc(\d+)/.exec(token);
    if (uc) { state.uc = Number(uc[1]); continue; }
    if (u) { output += String.fromCharCode(Number(u[1]) & 65535); fallback = state.uc; continue; }
    if (/^\\(?:par|line)\b/.test(token)) { output += '\n'; continue; }
    if (/^\\tab\b/.test(token)) { output += '\t'; continue; }
    if (/^\\[a-z]/i.test(token)) continue;
    if (fallback) { fallback--; continue; }
    if (/^\\'/.test(token)) output += decoder.decode(Uint8Array.of(parseInt(token.slice(2),16)));
    else if (/^\\[{}\\]/.test(token)) output += token.slice(1);
    else if (token !== '\n' && token !== '\r') output += token;
  }
  return output;
}
