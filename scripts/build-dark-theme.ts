/* Generates app/theme-dark.css from the stylesheets that describe the light theme.

   The public styles carry 765 colour literals across five files and no token layer. Hand
   writing a dark theme against that would mean 765 judgement calls and a second set of rules
   to keep in step with the first. Instead this walks the light stylesheets, keeps only the
   declarations that carry a colour, maps each literal through one documented transform, and
   re-emits the rule under `:root[data-theme='dark']`, which outranks the original selector.

   The output is checked in so the browser loads one plain stylesheet, and
   tests/dark-theme.test.ts regenerates it to fail when a light rule has moved on without it.
   Run `npx tsx scripts/build-dark-theme.ts` after changing colours in the files below. */
import { readFileSync, writeFileSync } from 'node:fs';

const sources = [
  'app/globals.css',
  'app/board.css',
  'app/phone.css',
  'app/board-features.css',
  'app/search-features.css',
];
const output = 'app/theme-dark.css';

/* Properties whose value can carry a colour we want to restate. `mask-image` and the other
   gradients used for fades are deliberately absent: their #000 is a mask, not a colour. */
const colourProperties =
  /^(color|background|background-color|background-image|border|border-color|border-top|border-right|border-bottom|border-left|border-top-color|border-bottom-color|border-left-color|border-right-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule-color|--background|--foreground|--card|--card-foreground|--popover|--popover-foreground|--primary|--primary-foreground|--secondary|--secondary-foreground|--muted|--muted-foreground|--accent|--accent-foreground|--destructive|--border|--input|--ring|--status-text|--status-bg|--status-border)$|^--/;

/* Surfaces that already read correctly on a dark page, or that exist to host foreign artwork.
   The masthead is a dark blue gradient in both themes; a company logo needs a light chip
   behind it, because most employer marks are dark ink on transparency. */
const keepAsIs = [
  '.dark', // shadcn ships its own dark palette; inverting it would undo the theme
  '.company-avatar', // a light chip: most employer marks are dark ink on transparency
  '.hero-art',
  '.brand-icon',
  '.swipe-reveal',
];
/* The masthead is a dark blue gradient in both themes, so its own background layers and the
   text sitting on them stay exactly as the light stylesheet wrote them. Everything else
   inside it — the search panel, the city select — is an ordinary white card and does change. */
const mastheadOwn = [
  '.discovery-hero',
  '.discovery-hero::before',
  '.discovery-hero::after',
  '.discovery-hero .eyebrow',
  '.discovery-hero h1',
  '.discovery-hero .hero-copy',
  '.hero-assurance',
  '.preview-banner',
];

/* Literals whose mapping is a decision rather than a calculation. */
const fixed: Record<string, string> = {
  '#fff': '#131b2c',
  '#ffffff': '#131b2c',
  '#2457e6': '#6f93ff', // the brand blue, lightened until it carries text on a dark ground
  '#245be8': '#6f93ff',
  '#214dc7': '#8aa7ff',
  '#f6f7fa': '#0e1523', // the page behind the cards
  '#f9f9f9': '#0e1523',
  '#f7f9fc': '#0e1523',
};

type Rgb = { r: number; g: number; b: number; a: number | null };
function parse(hex: string): Rgb {
  let body = hex.slice(1);
  // Hex digits are ASCII; doubling each one expands #abc to #aabbcc.
  if (body.length === 3 || body.length === 4)
    body = body.replace(/(.)/g, '$1$1');
  const a = body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : null;
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
    a,
  };
}
function toHsl({ r, g, b }: Rgb) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb),
    min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 220, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rr
      ? (gg - bb) / d + (gg < bb ? 6 : 0)
      : max === gg
        ? (bb - rr) / d + 2
        : (rr - gg) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}
function toHex(h: number, s: number, l: number, a: number | null) {
  const [hh, ss, ll] = [(((h % 360) + 360) % 360) / 360, s / 100, l / 100];
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const channel = (t: number) => {
    let v = t;
    if (v < 0) v += 1;
    if (v > 1) v -= 1;
    if (v < 1 / 6) return p + (q - p) * 6 * v;
    if (v < 1 / 2) return q;
    if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6;
    return p;
  };
  const pair = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  const base =
    '#' +
    pair(ss === 0 ? ll : channel(hh + 1 / 3)) +
    pair(ss === 0 ? ll : channel(hh)) +
    pair(ss === 0 ? ll : channel(hh - 1 / 3));
  return a === null
    ? base
    : base +
        Math.round(a * 255)
          .toString(16)
          .padStart(2, '0');
}
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/* One transform, applied by role.

   Neutrals and the blue-grey text scale flip around the middle and land inside 10–92 so the
   page never reaches pure black or pure white; they also pick up the masthead's hue, because
   a flat grey reads as dead next to the brand blue. A saturated accent keeps its hue: a pale
   tint (a selected row, a salary chip) becomes a dark tint of the same colour, a dark accent
   (a heading, a link on white) becomes a light one, and anything in between is lifted until
   it carries text. Alpha survives untouched, and a shadow only deepens: on a dark page a
   shadow is absence of light, not a wash of ink. */
type Role = 'text' | 'surface' | 'border' | 'shadow';
/* What a colour is for decides where it may land. Flipping lightness alone leaves a mid grey
   a mid grey, which is legible on white and not on near-black, so text is pulled up into
   62–94 and a plain surface pushed down into 10–30. Saturated accents keep their hue and are
   only lifted enough to carry text; a pale accent tint becomes a dark tint of the same
   colour, which is what a selected row or a salary chip needs. */
function darken(raw: string, role: Role): string {
  const hex = asHex(raw);
  const fixedValue = fixed[hex.toLowerCase()];
  if (fixedValue) return fixedValue;
  const rgb = parse(hex);
  const { h, s, l } = toHsl(rgb);
  if (role === 'shadow') {
    const alpha = rgb.a === null ? null : clamp(rgb.a * 1.6, 0, 0.75);
    return toHex(220, 30, clamp(l * 0.18, 2, 10), alpha);
  }
  const band = (value: number) =>
    role === 'text'
      ? clamp(value, 62, 94)
      : role === 'surface'
        ? clamp(value, 10, 30)
        : clamp(value, 16, 40);
  if (s < 40) {
    const flipped = band(12 + (100 - l) * 0.9);
    const tint =
      s < 14
        ? flipped < 30
          ? 16
          : flipped < 60
            ? 12
            : 8
        : clamp(s * 0.8, 8, 30);
    return toHex(s < 14 ? 220 : h, tint, flipped, rgb.a);
  }
  // A pale tint is a surface whatever the property says; nothing reads on it as text.
  if (l >= 88)
    return toHex(h, clamp(s * 0.45, 12, 42), role === 'text' ? 74 : 19, rgb.a);
  if (l <= 38) return toHex(h, clamp(s * 0.75, 30, 70), 76, rgb.a);
  return toHex(
    h,
    clamp(s * 0.95, 30, 90),
    role === 'surface' ? clamp(l + 10, 40, 66) : clamp(l + 20, 70, 82),
    rgb.a,
  );
}

/* `white` and `black` appear 33 times; a value that names a colour counts as one. */
const keywords: Record<string, string> = { white: '#ffffff', black: '#000000' };
const hexPattern = /#[0-9a-fA-F]{3,8}\b|\b(?:white|black)\b/g;
const asHex = (value: string) => keywords[value.toLowerCase()] ?? value;

type Block = { at: string[]; selector: string; declarations: string[] };
/* A small reader for the plain CSS in this project: rules, @media/@supports blocks, comments
   and strings. It does not need to understand anything the files do not contain. */
function readBlocks(css: string): Block[] {
  const blocks: Block[] = [];
  const at: string[] = [];
  let buffer = '';
  let index = 0;
  while (index < css.length) {
    const char = css[index];
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      index = end < 0 ? css.length : end + 2;
      continue;
    }
    if (char === '{') {
      const head = buffer.trim();
      buffer = '';
      index += 1;
      if (head.startsWith('@')) {
        at.push(head);
        continue;
      }
      let depth = 1;
      let body = '';
      while (index < css.length && depth > 0) {
        const c = css[index];
        if (c === '{') depth += 1;
        else if (c === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        body += c;
        index += 1;
      }
      index += 1;
      blocks.push({
        at: [...at],
        selector: head,
        declarations: body
          .split(';')
          .map((d) => d.trim())
          .filter(Boolean),
      });
      continue;
    }
    if (char === '}') {
      at.pop();
      buffer = '';
      index += 1;
      continue;
    }
    buffer += char;
    index += 1;
  }
  return blocks;
}

function prefix(selector: string) {
  const scope = ":root[data-theme='dark']";
  return selector
    .split(',')
    .map((part) => {
      const one = part.trim();
      if (one === ':root' || one === 'html' || one === ':root, html')
        return scope;
      if (one === 'body') return `${scope} body`;
      if (one.startsWith(':root')) return scope + one.slice(':root'.length);
      return `${scope} ${one}`;
    })
    .join(',\n');
}

function build() {
  const out: string[] = [
    '/* Generated by scripts/build-dark-theme.ts — do not edit by hand.',
    '   Every rule restates one light declaration with its colours mapped for a dark page;',
    '   the light stylesheets remain the single source of truth. */',
    '',
    ":root[data-theme='dark'] {",
    '  color-scheme: dark;',
    '}',
    '',
  ];
  let restated = 0;
  for (const file of sources) {
    const css = readFileSync(file, 'utf8');
    const blocks = readBlocks(css);
    const chunks: string[] = [];
    for (const block of blocks) {
      if (keepAsIs.some((skip) => block.selector.includes(skip))) continue;
      const masthead = mastheadOwn.some((own) => block.selector.includes(own));
      const kept: string[] = [];
      for (const declaration of block.declarations) {
        const colon = declaration.indexOf(':');
        if (colon < 0) continue;
        const property = declaration.slice(0, colon).trim().toLowerCase();
        const value = declaration.slice(colon + 1);
        if (!colourProperties.test(property)) continue;
        // Inside the masthead only a surface that is white in the light theme has to move.
        if (masthead && !/^(background|background-color)$/.test(property))
          continue;
        if (masthead && !/#fff\b|#ffffff\b|\bwhite\b/i.test(value)) continue;
        if (!hexPattern.test(value)) {
          hexPattern.lastIndex = 0;
          continue;
        }
        hexPattern.lastIndex = 0;
        const role: Role = property.includes('shadow')
          ? 'shadow'
          : property === 'color' ||
              property === 'fill' ||
              property === 'stroke' ||
              /foreground|--status-text|--ink|--muted-ink/.test(property)
            ? 'text'
            : property.startsWith('background') ||
                /--background|--card$|--popover$|--muted$|--accent$|--secondary$|--primary$|--surface|--status-bg/.test(
                  property,
                )
              ? 'surface'
              : 'border';
        kept.push(
          `  ${property}:${value.replace(hexPattern, (hex) => darken(hex, role))};`,
        );
      }
      if (!kept.length) continue;
      restated += kept.length;
      const body = [prefix(block.selector) + ' {', ...kept, '}'];
      chunks.push(
        block.at.length
          ? [
              ...block.at.map(
                (rule, depth) => '  '.repeat(depth) + rule + ' {',
              ),
              ...body.map((line) => '  '.repeat(block.at.length) + line),
              ...block.at.map(
                (_, depth) => '  '.repeat(block.at.length - 1 - depth) + '}',
              ),
            ].join('\n')
          : body.join('\n'),
      );
    }
    if (chunks.length)
      out.push(`/* ── from ${file} ── */`, chunks.join('\n'), '');
  }
  return { css: out.join('\n') + '\n', restated };
}

export function darkTheme() {
  return build().css;
}

if (process.argv[1]?.endsWith('build-dark-theme.ts')) {
  const { css, restated } = build();
  writeFileSync(output, css);
  console.log(
    `${output}: ${restated} declarations restated from ${sources.length} stylesheets`,
  );
}
