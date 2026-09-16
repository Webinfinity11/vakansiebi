/* Builds public/brand/og.png — the picture a messenger shows when the site is
   shared. The wordmark alone was standing in for it: 2172×724, transparent, so
   every client cropped its sides and filled the gaps with its own grey. This is
   1200×630, the shape they all expect, with the mark on a white card over the
   brand gradient and wide margins, so a square crop still holds the whole logo.
   Run after changing the logo: npx tsx scripts/build-og-image.ts */
import sharp from 'sharp';

const width = 1200;
const height = 630;
const card = { x: 110, y: 115, width: 980, height: 400, radius: 36 };
const logoWidth = 760;

const background = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
     <defs>
       <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#1032a5"/>
         <stop offset="0.64" stop-color="#2457e6"/>
         <stop offset="1" stop-color="#0e8de9"/>
       </linearGradient>
     </defs>
     <rect width="${width}" height="${height}" fill="url(#brand)"/>
     <rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}"
       rx="${card.radius}" fill="#ffffff"/>
   </svg>`,
);

const logo = await sharp('public/brand/jobx.png')
  .resize({ width: logoWidth })
  .toBuffer();
const { height: logoHeight = 0 } = await sharp(logo).metadata();
await sharp(background)
  .composite([
    {
      input: logo,
      left: Math.round(card.x + (card.width - logoWidth) / 2),
      top: Math.round(card.y + (card.height - logoHeight) / 2),
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile('public/brand/og.png');
const written = await sharp('public/brand/og.png').metadata();
console.log(`public/brand/og.png ${written.width}x${written.height}`);
