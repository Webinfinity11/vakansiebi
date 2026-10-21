import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { cvText, formatPeriod, type Cv } from '../cv';

/* A JOBX-built CV as a PDF, drawn on the server for a letter's attachment.
   The builder's own PDF is the browser's print of its HTML templates; a mail
   cannot wait for a browser, so this is one clean single-column sheet in the
   same FiraGO face, carrying every field and the chosen accent colour. */

const a4 = { width: 595.28, height: 841.89 };
const margin = 48;
// fontkit cannot read WOFF2, so the site's subsets are kept here as TTF.
const fontDir = path.join(process.cwd(), 'lib', 'server', 'fonts');
const fontFiles = {
  regular: 'FiraGO-Regular-subset.ttf',
  bold: 'FiraGO-Bold-subset.ttf',
};
let fontBytes: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;
const loadFonts = () =>
  (fontBytes ??= Promise.all([
    readFile(path.join(fontDir, fontFiles.regular)),
    readFile(path.join(fontDir, fontFiles.bold)),
  ])
    .then(([regular, bold]) => ({
      regular: new Uint8Array(regular),
      bold: new Uint8Array(bold),
    }))
    .catch((e) => {
      fontBytes = null;
      throw e;
    }));

const hexColor = (hex: string) => {
  const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '111111';
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
};
const grey = rgb(0.4, 0.44, 0.5);
const line = rgb(0.87, 0.89, 0.92);
const tidy = (value: string) => value.replace(/(?![\t\n])\p{Cc}/gu, '').trim();

/* Greedy word wrap by measured width; a single word longer than the line is
   cut by characters so nothing runs off the page. */
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of tidy(text).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    const fits = (value: string) =>
      font.widthOfTextAtSize(value, size) <= width;
    let current = '';
    for (let word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      while (!fits(word) && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && !fits(word.slice(0, cut))) cut--;
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      current = word;
    }
    if (current) lines.push(current);
  }
  return lines;
}

class Sheet {
  page: PDFPage;
  y = a4.height - margin;
  constructor(
    private doc: PDFDocument,
    private fonts: { regular: PDFFont; bold: PDFFont },
    private accent: ReturnType<typeof rgb>,
    private ink: ReturnType<typeof rgb>,
  ) {
    this.page = doc.addPage([a4.width, a4.height]);
  }
  get width() {
    return a4.width - margin * 2;
  }
  need(height: number) {
    if (this.y - height >= margin) return;
    this.page = this.doc.addPage([a4.width, a4.height]);
    this.y = a4.height - margin;
  }
  text(
    value: string,
    {
      size = 10,
      bold = false,
      color = this.ink,
      width = this.width,
      x = margin,
      gap = 2,
    } = {},
  ) {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const lineHeight = size * 1.35;
    for (const row of wrap(value, font, size, width)) {
      this.need(lineHeight);
      this.y -= lineHeight;
      if (row) this.page.drawText(row, { x, y: this.y, size, font, color });
    }
    this.y -= gap;
  }
  heading(label: string) {
    this.need(34);
    this.y -= 14;
    this.text(label, { size: 11.5, bold: true, color: this.accent, gap: 3 });
    this.page.drawLine({
      start: { x: margin, y: this.y },
      end: { x: margin + this.width, y: this.y },
      thickness: 0.8,
      color: line,
    });
    this.y -= 7;
  }
}

async function photoJpeg(photo: string) {
  const match =
    /^data:image\/(?:webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
  if (!match) return null;
  try {
    return await sharp(Buffer.from(match[1], 'base64'), {
      limitInputPixels: 16000000,
    })
      .rotate()
      .resize(240, 240, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function renderCvPdf(cv: Cv): Promise<Uint8Array> {
  const text = cvText[cv.language];
  const bytes = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {
    regular: await doc.embedFont(bytes.regular, { subset: true }),
    bold: await doc.embedFont(bytes.bold, { subset: true }),
  };
  const name = tidy(cv.fullName) || 'CV';
  doc.setTitle(`CV — ${name}`);
  doc.setAuthor(name);
  doc.setProducer('JOBX');
  doc.setCreator('jobx.ge');
  const sheet = new Sheet(
    doc,
    fonts,
    hexColor(cv.accent),
    hexColor(cv.textColor),
  );

  // Header: name, title and contact on the left, the photo on the right.
  const photo = cv.showPhoto && cv.photo ? await photoJpeg(cv.photo) : null;
  const photoSize = 72;
  const headerWidth = photo ? sheet.width - photoSize - 16 : sheet.width;
  const top = sheet.y;
  sheet.text(name, { size: 20, bold: true, width: headerWidth, gap: 4 });
  if (tidy(cv.title))
    sheet.text(cv.title, {
      size: 12.5,
      color: hexColor(cv.accent),
      width: headerWidth,
      gap: 6,
    });
  const contact = [cv.phone, cv.email, cv.city, cv.link]
    .map(tidy)
    .filter(Boolean)
    .join('  ·  ');
  if (contact)
    sheet.text(contact, { size: 9.5, color: grey, width: headerWidth, gap: 2 });
  if (photo) {
    const image = await doc.embedJpg(photo);
    sheet.page.drawImage(image, {
      x: margin + sheet.width - photoSize,
      y: top - photoSize,
      width: photoSize,
      height: photoSize,
    });
    sheet.y = Math.min(sheet.y, top - photoSize - 6);
  }

  if (tidy(cv.summary)) {
    sheet.heading(text.summary);
    sheet.text(cv.summary, { size: 10, gap: 4 });
  }
  const experience = cv.experience.filter(
    (item) => tidy(item.role) || tidy(item.company) || tidy(item.description),
  );
  if (experience.length) {
    sheet.heading(text.experience);
    for (const item of experience) {
      sheet.need(40);
      sheet.text(
        [item.role, item.company].map(tidy).filter(Boolean).join(' — '),
        {
          size: 10.5,
          bold: true,
          gap: 1,
        },
      );
      const period = formatPeriod(
        item.from,
        item.to,
        item.current,
        cv.language,
      );
      if (period) sheet.text(period, { size: 9, color: grey, gap: 2 });
      if (tidy(item.description)) sheet.text(item.description, { gap: 6 });
      else sheet.y -= 4;
    }
  }
  const education = cv.education.filter(
    (item) => tidy(item.school) || tidy(item.degree) || tidy(item.description),
  );
  if (education.length) {
    sheet.heading(text.education);
    for (const item of education) {
      sheet.need(40);
      sheet.text(
        [item.degree, item.school].map(tidy).filter(Boolean).join(' — '),
        {
          size: 10.5,
          bold: true,
          gap: 1,
        },
      );
      const period = formatPeriod(item.from, item.to, false, cv.language);
      if (period) sheet.text(period, { size: 9, color: grey, gap: 2 });
      if (tidy(item.description)) sheet.text(item.description, { gap: 6 });
      else sheet.y -= 4;
    }
  }
  const skills = cv.skills.map(tidy).filter(Boolean);
  if (skills.length) {
    sheet.heading(text.skills);
    sheet.text(skills.join(', '), { gap: 4 });
  }
  const languages = cv.languages.filter((item) => tidy(item.name));
  if (languages.length) {
    sheet.heading(text.languages);
    sheet.text(
      languages
        .map(
          (item) => `${tidy(item.name)} — ${text.languageLevels[item.level]}`,
        )
        .join('\n'),
      { gap: 4 },
    );
  }
  sheet.need(20);
  sheet.page.drawText('jobx.ge', {
    x: margin,
    y: margin - 18,
    size: 8,
    font: fonts.regular,
    color: grey,
  });
  return doc.save();
}
