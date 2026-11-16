// Local-only demo data for the company workspace (/company).
// Usage: DATABASE_URL=postgresql://localhost:5432/<db> npx tsx scripts/seed-company-portal.ts
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db } from '../lib/server/db';
import { companyKey } from '../lib/company-key';
import { hashCompanyPassword } from '../lib/server/company-auth';
import { changeCompanyJob } from '../lib/server/company-jobs';
import { mutateJob } from '../lib/server/jobs';
import { submissionDate } from '../lib/job-submission';
import type { CompanyIdentity } from '../lib/company-portal';

const host = new URL(process.env.DATABASE_URL ?? 'x://none').hostname;
if (!['localhost', '127.0.0.1'].includes(host))
  throw new Error('Refusing to seed a non-local database: ' + host);

const company = { name: 'დემო კომპანია', key: companyKey('დემო კომპანია') };
const username = 'demo';
const password = 'demo-password-2026';

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const description =
  'ვეძებთ პასუხისმგებლიან და მოტივირებულ თანამშრომელს, რომელიც შეუერთდება ჩვენს გუნდს. ' +
  'მოვალეობები: ყოველდღიური სამუშაო პროცესების მართვა, კლიენტებთან კომუნიკაცია და გუნდთან თანამშრომლობა.\n\n' +
  'მოთხოვნები: მსგავს პოზიციაზე მუშაობის გამოცდილება, ქართული ენის კარგი ცოდნა.\n\n' +
  'ჩვენ გთავაზობთ: სტაბილურ ანაზღაურებას, ჯანმრთელობის დაზღვევას და პროფესიული ზრდის შესაძლებლობას.';
const jobs = [
  {
    title: 'გაყიდვების მენეჯერი',
    city: 'თბილისი',
    category: 'გაყიდვები',
    salaryFrom: '1500',
    salaryTo: '2500',
    deadline: inDays(21),
    nextAction: 'publish',
  },
  {
    title: 'ბუღალტერი',
    city: 'თბილისი',
    category: 'ფინანსები',
    salaryFrom: '2000',
    salaryTo: '',
    deadline: inDays(3),
    nextAction: 'publish',
  },
  {
    title: 'მიმტანი',
    city: 'ბათუმი',
    category: 'კვება',
    salaryFrom: '60',
    salaryTo: '80',
    salaryPeriod: 'დღე',
    deadline: inDays(14),
    nextAction: 'pending',
  },
  {
    title: 'Frontend დეველოპერი',
    city: 'თბილისი',
    category: 'IT',
    salaryFrom: '',
    salaryTo: '',
    mode: 'ჰიბრიდული',
    deadline: inDays(30),
    nextAction: 'pending',
  },
  {
    title: 'საწყობის ოპერატორი',
    city: 'რუსთავი',
    category: 'ლოჯისტიკა',
    salaryFrom: '1200',
    salaryTo: '1400',
    deadline: inDays(10),
    nextAction: 'archive',
  },
];

const client = await db().connect();
try {
  await client.query(
    'INSERT INTO company_profiles(company_key,name,website,description) VALUES($1,$2,$3,$4) ON CONFLICT (company_key) DO NOTHING',
    [
      company.key,
      company.name,
      'https://example.com',
      'დემო კომპანია ლოკალური ტესტირებისთვის.',
    ],
  );
  const hash = await hashCompanyPassword(password);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO company_accounts(company_key,username,email,password_hash,must_change_password)
     VALUES($1,$2,$3,$4,false)
     ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash,must_change_password=false,enabled=true
     RETURNING id`,
    [company.key, username, 'demo@example.com', hash],
  );
  const identity: CompanyIdentity = {
    id: rows[0].id,
    companyKey: company.key,
    name: company.name,
    username,
    email: 'demo@example.com',
    mustChangePassword: false,
    role: 'owner',
    approvalStatus: 'approved',
    emailVerified: true,
    representativeName: 'Demo',
  };
  const existing = await client.query(
    'SELECT 1 FROM company_job_ownership WHERE company_key=$1 LIMIT 1',
    [company.key],
  );
  if (!existing.rowCount) {
    const { categories } = await import('../lib/types');
    for (const job of jobs) {
      const category =
        categories.find((c) => c.includes(job.category)) ?? categories[0];
      const created = (await changeCompanyJob(identity, {
        action: 'create',
        requestId: randomUUID(),
        form: {
          title: job.title,
          city: job.city,
          category,
          mode: job.mode ?? 'ადგილზე',
          employmentType: 'სრული განაკვეთი',
          salaryFrom: job.salaryFrom,
          salaryTo: job.salaryTo,
          salaryPeriod: job.salaryPeriod ?? 'თვე',
          salaryBasis: 'ხელზე',
          deadline: job.deadline,
          description,
          contact: 'hr@example.com',
          date: submissionDate(),
        },
      })) as { id: string };
      if (job.nextAction === 'pending') continue;
      const { rows: r } = await client.query<{ version: number }>(
        'SELECT version FROM jobs WHERE id=$1',
        [created.id],
      );
      await mutateJob({
        id: created.id,
        version: r[0].version,
        action: 'publish',
      });
      if (job.nextAction === 'archive') {
        const { rows: a } = await client.query<{ version: number }>(
          'SELECT version FROM jobs WHERE id=$1',
          [created.id],
        );
        await mutateJob({
          id: created.id,
          version: a[0].version,
          action: 'archive',
        });
      }
    }
  }
  await seedCandidates(client, company.key);
  await refreshDemoProfiles(client);
  await seedAnalytics(client, company.key);
  await seedUploadedCvs(client, company.key);
  console.log(
    `Company workspace ready: username "${username}", password "${password}"`,
  );
} finally {
  client.release();
  await db().end();
}

/* Hypothetical resumes that match each demo applicant's profession, so the CV base filters
   (experience, skills, languages) have something realistic to work on. */
// Function declarations: main() runs at the top of the module, before any const below exists.
function ex(
  id: string,
  role: string,
  company: string,
  from: string,
  to: string,
  description: string,
) {
  return { id, role, company, from, to, current: !to, description };
}
function ed(
  id: string,
  degree: string,
  school: string,
  from: string,
  to: string,
) {
  return { id, degree, school, from, to, description: '' };
}
function lang(id: string, name: string, level: string) {
  return { id, name, level };
}
function demoProfiles(): Record<string, Record<string, unknown>> {
  return {
    'nino.b@example.com': {
      city: 'თბილისი',
      summary:
        'B2B გაყიდვების მენეჯერი 6-წლიანი გამოცდილებით. ვმართავ კორპორატიულ კლიენტებთან ურთიერთობას და გაყიდვების გეგმას.',
      experience: [
        ex(
          'e1',
          'გაყიდვების მენეჯერი',
          'სავაჭრო კომპანია',
          '2021-02',
          '',
          'კორპორატიული კლიენტების პორტფელის მართვა, ახალი კლიენტების მოძიება, CRM-ში გაყიდვების აღრიცხვა.',
        ),
        ex(
          'e2',
          'გაყიდვების კონსულტანტი',
          'საცალო ქსელი',
          '2018-09',
          '2021-01',
          'მომხმარებლების კონსულტაცია, თვიური გეგმის შესრულება.',
        ),
      ],
      education: [
        ed(
          'd1',
          'ბიზნესის ადმინისტრირების ბაკალავრი',
          'თბილისის სახელმწიფო უნივერსიტეტი',
          '2014-09',
          '2018-06',
        ),
      ],
      skills: [
        'B2B გაყიდვები',
        'მოლაპარაკება',
        'CRM',
        'Excel',
        'კლიენტებთან ურთიერთობა',
      ],
      languages: [
        lang('l1', 'ქართული', 'native'),
        lang('l2', 'ინგლისური', 'b2'),
        lang('l3', 'რუსული', 'b1'),
      ],
    },
    'giorgi.k@example.com': {
      city: 'თბილისი',
      summary:
        'გაყიდვების წარმომადგენელი, ვმუშაობ სადისტრიბუციო არხებზე და სავაჭრო წერტილებთან.',
      experience: [
        ex(
          'e1',
          'გაყიდვების წარმომადგენელი',
          'დისტრიბუციის კომპანია',
          '2023-04',
          '',
          'სავაჭრო წერტილების მომსახურება, შეკვეთების მიღება, მერჩენდაიზინგი.',
        ),
      ],
      education: [
        ed(
          'd1',
          'მარკეტინგის ბაკალავრი',
          'კავკასიის უნივერსიტეტი',
          '2018-09',
          '2022-06',
        ),
      ],
      skills: ['გაყიდვები', 'მერჩენდაიზინგი', 'მართვის მოწმობა B', 'Excel'],
      languages: [
        lang('l1', 'ქართული', 'native'),
        lang('l2', 'რუსული', 'b2'),
        lang('l3', 'ინგლისური', 'a2'),
      ],
    },
    'mariam.j@example.com': {
      city: 'თბილისი',
      summary:
        'ბუღალტერი 8-წლიანი გამოცდილებით: ფინანსური ანგარიშგება IFRS-ით, საგადასახადო დეკლარაციები, 1C.',
      experience: [
        ex(
          'e1',
          'მთავარი ბუღალტერი',
          'სამშენებლო კომპანია',
          '2020-03',
          '',
          'ფინანსური ანგარიშგება IFRS-ის მიხედვით, საგადასახადო დეკლარაციები rs.ge-ზე, ხელფასების დარიცხვა.',
        ),
        ex(
          'e2',
          'ბუღალტერი',
          'აუდიტორული ფირმა',
          '2016-07',
          '2020-02',
          'პირველადი დოკუმენტაცია, ბანკის ამონაწერების შეჯერება 1C-ში.',
        ),
      ],
      education: [
        ed(
          'd1',
          'ფინანსების მაგისტრი',
          'ილიას სახელმწიფო უნივერსიტეტი',
          '2014-09',
          '2016-06',
        ),
      ],
      skills: [
        '1C',
        'IFRS',
        'საგადასახადო დეკლარაციები',
        'Excel',
        'ხელფასების დარიცხვა',
      ],
      languages: [
        lang('l1', 'ქართული', 'native'),
        lang('l2', 'ინგლისური', 'c1'),
        lang('l3', 'რუსული', 'b2'),
      ],
    },
    'levan.t@example.com': {
      city: 'ბათუმი',
      summary:
        'ფინანსური ანალიტიკოსი: ბიუჯეტირება, ფინანსური მოდელები და ანგარიშები მენეჯმენტისთვის.',
      experience: [
        ex(
          'e1',
          'ფინანსური ანალიტიკოსი',
          'სასტუმროების ქსელი',
          '2022-01',
          '',
          'ბიუჯეტირება და პროგნოზირება, ყოველთვიური ანგარიშები Power BI-ში.',
        ),
        ex(
          'e2',
          'უმცროსი ბუღალტერი',
          'სავაჭრო კომპანია',
          '2020-06',
          '2021-12',
          'ინვოისების აღრიცხვა, 1C.',
        ),
      ],
      education: [
        ed(
          'd1',
          'ეკონომიკის ბაკალავრი',
          'ბათუმის სახელმწიფო უნივერსიტეტი',
          '2016-09',
          '2020-06',
        ),
      ],
      skills: [
        'Excel',
        'Power BI',
        'ბიუჯეტირება',
        '1C',
        'ფინანსური მოდელირება',
      ],
      languages: [
        lang('l1', 'ქართული', 'native'),
        lang('l2', 'ინგლისური', 'b2'),
      ],
    },
    'ana.m@example.com': {
      city: 'ბათუმი',
      summary:
        'მიმტანი 3-წლიანი გამოცდილებით რესტორანსა და სასტუმროში, სეზონზე უცხოელ სტუმრებთან.',
      experience: [
        ex(
          'e1',
          'მიმტანი',
          'სასტუმროს რესტორანი',
          '2023-05',
          '',
          'სტუმრების მომსახურება, შეკვეთების მიღება POS სისტემით, ღვინის რეკომენდაცია.',
        ),
        ex(
          'e2',
          'ბარისტა',
          'ყავის მაღაზია',
          '2021-06',
          '2023-04',
          'ყავის მომზადება, სალარო.',
        ),
      ],
      education: [
        ed(
          'd1',
          'ტურიზმის პროფესიული კურსი',
          'ბათუმის პროფესიული კოლეჯი',
          '2020-09',
          '2021-06',
        ),
      ],
      skills: [
        'სტუმრების მომსახურება',
        'POS სისტემა',
        'ბარისტა',
        'ღვინის ცოდნა',
      ],
      languages: [
        lang('l1', 'ქართული', 'native'),
        lang('l2', 'ინგლისური', 'b1'),
        lang('l3', 'თურქული', 'a2'),
      ],
    },
    'davit.l@example.com': {
      city: 'თბილისი',
      summary:
        'Frontend დეველოპერი 5-წლიანი გამოცდილებით: React, TypeScript, Next.js.',
      experience: [
        ex(
          'e1',
          'Frontend დეველოპერი',
          'ფინტექ სტარტაპი',
          '2022-03',
          '',
          'ვებაპლიკაციის ინტერფეისი React-ითა და TypeScript-ით, Next.js, ტესტები Playwright-ით.',
        ),
        ex(
          'e2',
          'ვებ დეველოპერი',
          'ციფრული სააგენტო',
          '2020-01',
          '2022-02',
          'კორპორატიული საიტები, HTML/CSS, JavaScript.',
        ),
      ],
      education: [
        ed(
          'd1',
          'კომპიუტერული მეცნიერების ბაკალავრი',
          'საქართველოს ტექნიკური უნივერსიტეტი',
          '2015-09',
          '2019-06',
        ),
      ],
      skills: [
        'React',
        'TypeScript',
        'Next.js',
        'JavaScript',
        'HTML / CSS',
        'Git',
      ],
      languages: [
        lang('l1', 'ქართული', 'native'),
        lang('l2', 'ინგლისური', 'c1'),
      ],
    },
    'tamar.g@example.com': {
      city: 'ქუთაისი',
      summary: 'React დეველოპერი, დისტანციურად ვმუშაობ საერთაშორისო გუნდთან.',
      experience: [
        ex(
          'e1',
          'უმცროსი React დეველოპერი',
          'IT კომპანია',
          '2024-02',
          '',
          'კომპონენტების ბიბლიოთეკა, React, Redux, REST API.',
        ),
      ],
      education: [
        ed('d1', 'ფრონტენდის ბუტქემპი', 'ონლაინ სკოლა', '2023-03', '2023-12'),
      ],
      skills: ['React', 'JavaScript', 'Redux', 'Figma', 'Git'],
      languages: [
        lang('l1', 'ქართული', 'native'),
        lang('l2', 'ინგლისური', 'b2'),
        lang('l3', 'გერმანული', 'a2'),
      ],
    },
  };
}

/* Re-applies the profiles above to the demo resumes (example.com addresses only), so an
   existing local database picks them up without reseeding. */
async function refreshDemoProfiles(client: PoolClient) {
  for (const [email, profile] of Object.entries(demoProfiles()))
    await client.query(
      `UPDATE resumes SET cv = cv || $2::jsonb WHERE cv->>'email' = $1 AND $1 LIKE '%@example.com'`,
      [email, JSON.stringify(profile)],
    );
}

/* Demo applicants: CVs sent through JOBX (swipe_applications with a JOBX-built CV) and JOBX
   resumes sent to a vacancy (resume_contacts). Idempotent: skipped when any exist. */
async function seedCandidates(client: PoolClient, companyKey: string) {
  const { sampleCv } = await import('../lib/cv');
  const { createHash } = await import('node:crypto');
  const sha = (v: string) => createHash('sha256').update(v).digest('hex');
  const owned = (
    await client.query<{ id: string; title: string }>(
      `SELECT j.id, j.draft->>'title' title FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id
       WHERE o.company_key=$1 ORDER BY j.created_at`,
      [companyKey],
    )
  ).rows;
  if (!owned.length) return;
  const already = await client.query(
    `SELECT 1 FROM swipe_applications WHERE job_id = ANY($1::uuid[]) LIMIT 1`,
    [owned.map((j) => j.id)],
  );
  if (already.rowCount) return;
  const job = (part: string) =>
    owned.find((j) => j.title.includes(part))?.id ?? owned[0].id;
  const people = [
    {
      name: 'ნინო ბერიძე',
      title: 'გაყიდვების მენეჯერი',
      email: 'nino.b@example.com',
      phone: '+995 555 12 34 56',
      job: 'გაყიდვების',
      via: 'swipe',
      days: 0,
    },
    {
      name: 'გიორგი კაპანაძე',
      title: 'გაყიდვების წარმომადგენელი',
      email: 'giorgi.k@example.com',
      phone: '+995 599 22 11 00',
      job: 'გაყიდვების',
      via: 'swipe',
      days: 1,
    },
    {
      name: 'მარიამ ჯავახიშვილი',
      title: 'ბუღალტერი',
      email: 'mariam.j@example.com',
      phone: '+995 577 33 44 55',
      job: 'ბუღალტერი',
      via: 'resume',
      days: 2,
    },
    {
      name: 'ლევან წიკლაური',
      title: 'ფინანსური ანალიტიკოსი',
      email: 'levan.t@example.com',
      phone: '+995 568 90 12 34',
      job: 'ბუღალტერი',
      via: 'swipe',
      days: 3,
    },
    {
      name: 'ანა მელაძე',
      title: 'მიმტანი',
      email: 'ana.m@example.com',
      phone: '+995 551 77 88 99',
      job: 'მიმტანი',
      via: 'swipe',
      days: 0,
    },
    {
      name: 'დავით ლომიძე',
      title: 'Frontend დეველოპერი',
      email: 'davit.l@example.com',
      phone: '+995 593 45 67 89',
      job: 'Frontend',
      via: 'resume',
      days: 4,
    },
    {
      name: 'თამარ გელაშვილი',
      title: 'React დეველოპერი',
      email: 'tamar.g@example.com',
      phone: '+995 595 10 20 30',
      job: 'Frontend',
      via: 'swipe',
      days: 6,
    },
    {
      name: 'ნინო ბერიძე',
      title: 'გაყიდვების მენეჯერი',
      email: 'nino.b@example.com',
      phone: '+995 555 12 34 56',
      job: 'Frontend',
      via: 'swipe',
      days: 5,
    },
  ];
  for (const p of people) {
    const resumeId = randomUUID();
    const cv = {
      ...sampleCv('ka'),
      fullName: p.name,
      title: p.title,
      email: p.email,
      phone: p.phone,
      ...demoProfiles()[p.email],
    };
    delete (cv as { photo?: string }).photo;
    const at = new Date(
      Date.now() - p.days * 86_400_000 - Math.random() * 36e5,
    );
    await client.query(
      'INSERT INTO resumes(id,delete_token_hash,cv,created_at) VALUES($1,$2,$3,$4)',
      [resumeId, sha(randomUUID()), cv, at],
    );
    if (p.via === 'resume') {
      await client.query(
        `INSERT INTO resume_contacts(job_id,resume_id,kind,first_at,last_at) VALUES($1,$2,'cv',$3,$3)`,
        [job(p.job), resumeId, at],
      );
      continue;
    }
    await client.query(
      `INSERT INTO swipe_applications(job_id,candidate_key,candidate_name,candidate_email,candidate_phone,client_hash,resume_id,cv_kind,recipient,status,created_at,sent_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,'jobx','hr@example.com','sent',$8,$8)`,
      [
        job(p.job),
        sha(p.email + p.job),
        p.name,
        p.email,
        p.phone,
        sha(randomUUID()),
        resumeId,
        at,
      ],
    );
  }
}

/* Demo reader counts for the analytics tab: thirty days of views, saves and contact presses
   on each published vacancy, more on weekdays. Idempotent: skipped when any exist. */
async function seedAnalytics(client: PoolClient, companyKey: string) {
  const { rows: jobs } = await client.query<{ id: string }>(
    `SELECT j.id FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id
     WHERE o.company_key=$1 AND j.published_at IS NOT NULL ORDER BY j.created_at`,
    [companyKey],
  );
  if (!jobs.length) return;
  const seen = await client.query(
    "SELECT 1 FROM analytics_events WHERE kind='view' AND value=ANY($1::text[]) LIMIT 1",
    [jobs.map((j) => j.id)],
  );
  if (seen.rowCount) return;
  const scale = [1, 0.55, 0.25];
  for (const [n, job] of jobs.entries()) {
    await client.query(
      `INSERT INTO analytics_events(kind,value,created_at)
       SELECT k.kind, $1, d.day + (random() * interval '14 hours') + interval '8 hours'
       FROM generate_series(now()::date - 29, now()::date, interval '1 day') d(day)
       CROSS JOIN LATERAL (VALUES ('view',40),('save',3),('cv',2),('call',2),('email',1),('outbound',1)) k(kind,base)
       CROSS JOIN LATERAL generate_series(1, greatest(0, round(k.base * $2::float8 * (0.5 + random()) *
         CASE WHEN extract(isodow FROM d.day) > 5 THEN 0.5 ELSE 1 END
         * (0.6 + 0.4 * (29 - (now()::date - d.day::date)) / 29.0))::int)) g
       WHERE d.day + interval '8 hours' < now()`,
      [job.id, scale[n] ?? 0.2],
    );
  }
}

/* Hypothetical, local-only uploads: actual PDF and DOCX bytes, parsed by the same reader
   used by uploads. A stable per-demo key keeps PDF creation timestamps from duplicating rows. */
async function seedUploadedCvs(client: PoolClient, companyKey: string) {
  const { PDFDocument } = await import('pdf-lib');
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const { extractCvText } = await import('../lib/server/cv-text');
  const { parseCvText } = await import('../lib/cv-parse');
  const ka =
    'ჰიპოთეტური CV — ნატო მაგალითი\nთბილისი\nსამუშაო გამოცდილება\nბუღალტერი — სადემო კომპანია\nმარტი 2019 – მაისი 2024\nგანათლება\nფინანსების მაგისტრი\nუნარები\nExcel, 1C, IFRS, rs.ge, ORIS\nენები\nქართული მშობლიური\nინგლისური B2';
  const en =
    'Hypothetical CV — Alex Example\nBatumi\nWork experience\nDeveloper — Example Company\nJan 2020 – Dec 2023\nEducation\nBachelor of Computer Science\nSkills\nPython, SQL, React, Figma\nLanguages\nEnglish native\nRussian B1';
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile('lib/server/fonts/FiraGO-Regular-subset.ttf'),
    { subset: true },
  );
  const page = pdf.addPage([595, 842]);
  ka.split('\n').forEach((line, i) =>
    page.drawText(line, { x: 40, y: 795 - i * 30, font, size: 12 }),
  );
  const docx = demoDocx(en);
  for (const item of [
    {
      name: 'ნატო მაგალითი (სადემო)',
      email: 'nato.upload@example.com',
      filename: 'demo-accountant.pdf',
      bytes: Buffer.from(await pdf.save()),
    },
    {
      name: 'Alex Example (სადემო)',
      email: 'alex.upload@example.com',
      filename: 'demo-developer.docx',
      bytes: docx,
    },
  ]) {
    const hash = createHash('sha256')
      .update('company-demo-upload-v1:' + item.email)
      .digest('hex');
    const text = await extractCvText(item.bytes, item.filename);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO company_cv_uploads(company_key,name,email,title,file_name,file_hash,file_size,content)
       VALUES($1,$2,$3,'',$4,$5,$6,$7) ON CONFLICT(company_key,file_hash) DO UPDATE SET
       content=EXCLUDED.content,file_size=EXCLUDED.file_size RETURNING id`,
      [
        companyKey,
        item.name,
        item.email,
        item.filename,
        hash,
        item.bytes.length,
        item.bytes,
      ],
    );
    await client.query(
      `INSERT INTO company_cv_profiles(company_key,entry,text,parsed,method,parsed_at)
       VALUES($1,$2,$3,$4,'rules-v1',now()) ON CONFLICT(company_key,entry) DO UPDATE SET
       text=EXCLUDED.text,parsed=EXCLUDED.parsed,parsed_at=now(),updated_at=now()`,
      [
        companyKey,
        'upload:' + rows[0].id,
        text,
        JSON.stringify(parseCvText(text)),
      ],
    );
  }
}
function demoDocx(text: string) {
  // Stored ZIP with the minimal OOXML package; no extra runtime dependency.
  const entries = [
    [
      '[Content_Types].xml',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ],
    [
      '_rels/.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ],
    [
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        text
          .split('\n')
          .map(
            (l) =>
              '<w:p><w:r><w:t>' +
              l.replace(/&/g, '&amp;').replace(/</g, '&lt;') +
              '</w:t></w:r></w:p>',
          )
          .join('') +
        '</w:body></w:document>',
    ],
  ];
  const bodies: Buffer[] = [];
  const directories: Buffer[] = [];
  let offset = 0;
  for (const [filename, xml] of entries) {
    const name = Buffer.from(filename),
      data = Buffer.from(xml);
    let crc = 0xffffffff;
    for (const b of data) {
      crc ^= b;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    const body = Buffer.concat([local, name, data]);
    bodies.push(body);
    directories.push(Buffer.concat([central, name]));
    offset += body.length;
  }
  const directory = Buffer.concat(directories),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...bodies, directory, end]);
}
