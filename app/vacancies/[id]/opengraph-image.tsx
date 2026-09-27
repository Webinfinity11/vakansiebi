import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getVacancyPage } from '@/lib/server/vacancy-page';
import { vacancyIdFrom } from '@/lib/vacancy-navigation';
import { compactSalary } from '@/lib/vacancy-presentation';

/* The picture a messenger shows for one vacancy: its title, employer, city and pay on the
   brand card, instead of the same site logo for every link. A missing or hidden vacancy
   falls back to the site's own card rather than an error. */
export const alt = 'ვაკანსია JOBX-ზე';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const font = (name: string) =>
  readFile(join(process.cwd(), 'assets/fonts', name));
const clip = (text: string, max: number) =>
  text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: segment } = await params;
  const id = vacancyIdFrom(decodeURIComponent(segment));
  const job = id ? await getVacancyPage(id, false).catch(() => null) : null;
  const [georgianMedium, georgianBold, latinMedium, latinBold, logo] =
    await Promise.all([
      font('NotoSansGeorgian-Medium.ttf'),
      font('NotoSansGeorgian-Bold.ttf'),
      font('NotoSans-Medium.ttf'),
      font('NotoSans-Bold.ttf'),
      readFile(join(process.cwd(), 'public/brand/jobx.png')),
    ]);
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  const pay = job ? compactSalary(job.salary, job.salaryPeriod) : '';
  const facts = job ? [job.city, pay].filter(Boolean) : [];
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: 56,
        background:
          'linear-gradient(135deg, #1032a5 0%, #2457e6 64%, #0e8de9 100%)',
        fontFamily: 'Noto Sans Georgian, Noto Sans',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          borderRadius: 36,
          background: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {job ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 34, fontWeight: 500, color: '#4a5871' }}>
                {clip(job.company, 60)}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize:
                    job.title.length > 70
                      ? 46
                      : job.title.length > 40
                        ? 56
                        : 66,
                  fontWeight: 700,
                  color: '#16213a',
                  lineHeight: 1.2,
                }}
              >
                {clip(job.title, 84)}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 60, fontWeight: 700, color: '#16213a' }}>
              ვაკანსიები საქართველოში
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            {facts.map((fact) => (
              <div
                key={fact}
                style={{
                  padding: '10px 22px',
                  borderRadius: 999,
                  background: '#eef3ff',
                  color: '#1f45c7',
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                {clip(fact, 32)}
              </div>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={210} height={70} alt="JOBX" />
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Noto Sans Georgian', data: georgianMedium, weight: 500 },
        { name: 'Noto Sans Georgian', data: georgianBold, weight: 700 },
        { name: 'Noto Sans', data: latinMedium, weight: 500 },
        { name: 'Noto Sans', data: latinBold, weight: 700 },
      ],
    },
  );
}
