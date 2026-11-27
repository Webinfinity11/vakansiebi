import { UiText } from '@/app/ui-language';
import type { Metadata } from 'next';
import { siteName } from '@/lib/site-brand';
import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  FileText,
  KanbanSquare,
  Phone,
  Send,
  Users,
} from 'lucide-react';
import { PublicHeader } from '../public-header';
import { ServerSiteFooter } from '../server-site-footer';
import {
  invoiceContact,
  premiumDays,
  premiumPriceGEL,
  vipPriceGEL,
  vipDays,
} from '@/lib/billing';
import { billingSettings } from '@/lib/server/billing';
import { publicJobs } from '@/lib/server/jobs';
import { employerPagesIfReady } from '@/lib/server/employers';
import { breadcrumbs, jsonLd, shareImage, siteUrl } from '@/lib/seo';
import { WorkspacePreview } from './workspace-preview';
import { FeatureArt } from './feature-art';
import './business.css';

export const dynamic = 'force-dynamic';

const title = `ვაკანსიის უფასო განთავსება — დამსაქმებლებისთვის | ${siteName}`;
const description =
  'ვაკანსიის უფასო განთავსება ჯობიქსზე რეგისტრაციის გარეშე. კომპანიის ანგარიშით მართე კანდიდატები, CV ბაზა და გუნდი, შეადარე სტანდარტული, VIP და სუპერ VIP პირობები.';

/* Live figures only. A small number reads worse than none, so each one appears
   only once it is large enough to say something about the site. */
const minimumJobs = 100;
const minimumCompanies = 20;

const workspaceFeatures = [
  {
    Icon: KanbanSquare,
    art: 'board' as const,
    title: 'ყველა განაცხადი ერთ ადგილას',
    text: 'ყოველი კანდიდატი ჩანს, რომელ ეტაპზეა: ახალი, გასაუბრება თუ შეთავაზება. აღარავინ დაიკარგება.',
  },
  {
    Icon: FileText,
    art: 'cv' as const,
    title: 'სწრაფი ძიება რეზიუმეებში',
    text: 'ჩაწერეთ პოზიცია ან უნარი და მაშინვე ნახავთ შესაბამის კანდიდატებს.',
  },
  {
    Icon: BarChart3,
    art: 'analytics' as const,
    title: 'რამდენმა ნახა და გამოგზავნა',
    text: 'თითოეულ ვაკანსიაზე ხედავთ ნახვებისა და განაცხადების რაოდენობას.',
  },
  {
    Icon: Users,
    art: 'team' as const,
    title: 'კოლეგებთან ერთად',
    text: 'მოიწვიეთ კოლეგები და თავად განსაზღვრეთ, ვინ რას ხედავს და რისი შეცვლა შეუძლია.',
  },
  {
    Icon: Building2,
    art: 'company' as const,
    title: 'თქვენი კომპანიის გვერდი',
    text: 'ლოგო, აღწერა და ბენეფიტები ერთხელ შეავსეთ და ყველა ვაკანსიაზე გამოჩნდება.',
  },
  {
    Icon: Send,
    art: 'messages' as const,
    title: 'პასუხი კანდიდატს ერთ წუთში',
    text: 'მზა შაბლონით მოიწვიეთ გასაუბრებაზე ან თავაზიანად უპასუხეთ უარით.',
  },
];
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteUrl}/business` },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/business`,
    locale: 'ka_GE',
    siteName,
    type: 'website',
    images: [shareImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [shareImage.url],
  },
};

export default async function BusinessPage() {
  const [premiumAvailable, jobsTotal, employerPages] = await Promise.all([
    billingSettings()
      .then((settings) => !!settings)
      .catch(() => false),
    publicJobs(new URLSearchParams())
      .then((result) => result.total)
      .catch(() => 0),
    employerPagesIfReady().catch(() => null),
  ]);
  const companiesTotal = employerPages?.bySlug.size ?? 0;
  const stats = [
    jobsTotal >= minimumJobs && {
      value: jobsTotal.toLocaleString('ka-GE'),
      label: 'აქტიური ვაკანსია',
    },
    companiesTotal >= minimumCompanies && {
      value: companiesTotal.toLocaleString('ka-GE'),
      label: 'დამსაქმებელი',
    },
  ].filter((item): item is { value: string; label: string } => !!item);
  const plans = [
    {
      tier: 'standard',
      name: 'სტანდარტული',
      price: 'უფასო',
      period: 'საბაზისო განთავსება',
      description: 'ვაკანსიის სტანდარტული გამოქვეყნება ძიების შედეგებში.',
      features: [
        'ვაკანსიის სრული აღწერა და პირობები',
        'კომპანიის სახელი და ლოგო',
        'განაცხადის მიღების თქვენთვის სასურველი გზა',
      ],
      className: 'business-plan-standard',
    },
    {
      tier: 'vip',
      name: 'VIP',
      price: `${vipPriceGEL} ₾`,
      period: '{0} დღით',
      periodValues: [vipDays],
      description: 'ვაკანსია სტანდარტულ განცხადებებზე წინ გამოჩნდება.',
      features: [
        'სტანდარტული განთავსების შესაძლებლობები',
        'სტანდარტულ შედეგებზე წინ გამოჩენა',
        '{0} დღე გააქტიურებიდან',
      ],
      className: 'business-plan-vip',
    },
    {
      tier: 'premium',
      name: 'სუპერ VIP',
      price: `${premiumPriceGEL} ₾`,
      period: '{0} დღით',
      periodValues: [premiumDays],
      description: 'მეტი ხილვადობა შესაბამისი ძიების შედეგების თავში.',
      features: [
        'სტანდარტული განთავსების შესაძლებლობები',
        'VIP და სტანდარტულ შედეგებზე წინ გამოჩენა',
        '{0} დღე გააქტიურებიდან',
      ],
      className: 'business-plan-premium',
    },
  ];
  // All three packages are always listed; without payment details a paid package
  // is requested through the contact page instead of the posting form.
  const shownPlans = plans;
  const allQuestions: {
    question: string;
    answer: string;
    values?: number[];
    paid?: boolean;
  }[] = [
    {
      question: 'შემიძლია ვაკანსია უფასოდ განვათავსო?',
      answer:
        'დიახ. აირჩიეთ სტანდარტული განთავსება და შეავსეთ ვაკანსიის ფორმა. განცხადების გამოქვეყნება უფასოა, რეგისტრაცია საჭირო არ არის. ვაკანსია ადმინისტრატორის შემოწმებისა და დამტკიცების შემდეგ გამოჩნდება.',
    },
    {
      question: 'მჭირდება რეგისტრაცია?',
      answer:
        'განცხადების დასამატებლად რეგისტრაცია საჭირო არ არის. შეავსეთ ვაკანსიისა და კომპანიის მონაცემები და მიუთითეთ საკონტაქტო ინფორმაცია ან განაცხადის მიღების გზა. თუ კანდიდატების ერთ სივრცეში მართვა გსურთ, დაარეგისტრირეთ კომპანიის ანგარიში. ანგარიში ადმინისტრატორის დამტკიცების შემდეგ ჩაირთვება.',
    },
    {
      question: 'როდის გამოჩნდება ვაკანსია?',
      answer:
        'ვაკანსიის გაგზავნის შემდეგ განცხადებას ადმინისტრატორი ამოწმებს. საიტზე ის დამტკიცების შემდეგ გამოჩნდება. VIP და სუპერ VIP განთავსებისთვის გადახდის დადასტურებაც საჭიროა.',
    },
    {
      question: 'რა ღირს VIP განთავსება?',
      answer:
        'VIP განთავსება ღირს {0} ₾ და მოქმედებს {1} დღე გააქტიურებიდან. ვადის ამოწურვის შემდეგ განცხადება სტანდარტულად დარჩება, თუ განაცხადების მიღების ვადა ჯერ არ გასულა.',
      values: [vipPriceGEL, vipDays],
      paid: true,
    },
    {
      question: 'როგორ გადავიხადო განთავსების საფასური?',
      answer:
        'განაცხადში VIP-ის ან სუპერ VIP-ის არჩევისას მიიღებთ ინვოისს საბანკო რეკვიზიტებითა და გადარიცხვის დანიშნულებით. სუპერ VIP-ის ფასი {0} ₾-ია {1} დღისთვის. განთავსება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ გააქტიურდება. თანხა ავტომატურად არ ჩამოიჭრება.',
      values: [premiumPriceGEL, premiumDays],
      paid: true,
    },
  ];
  const questions = allQuestions.filter((q) => premiumAvailable || !q.paid);
  return (
    <div className="board-shell business-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: siteName, path: '/' },
              { name: 'ბიზნესისთვის', path: '/business' },
            ]),
          ),
        }}
      />
      <div className="business-beta-bar" role="note">
        <UiText>
          {
            'კომპანიის სივრცე სატესტო რეჟიმში მუშაობს.'
          }
        </UiText>
      </div>
      <PublicHeader />
      <main className="business-main">
        <section className="business-hero" aria-labelledby="business-title">
          <div className="business-hero-copy">
            <div className="business-badges">
              <span className="business-eyebrow">
                <Building2 size={15} aria-hidden="true" />
                <UiText>{' JOBX ბიზნესისთვის'}</UiText>
              </span>
            </div>
            <h1 id="business-title">
              <UiText>ვაკანსიის განთავსება</UiText>
            </h1>
            <p>
              <UiText>
                {
                  'განათავსეთ ვაკანსია უფასოდ და რეგისტრაციის გარეშე. კომპანიის ანგარიშით კი კანდიდატებს, CV-ებსა და გუნდის მუშაობას ერთ სივრცეში მართავთ.'
                }
              </UiText>
            </p>
            <div className="business-actions">
              <Link
                href="/post-job"
                prefetch={false}
                className="ds-btn ds-btn--primary"
              >
                <UiText>{'ვაკანსიის დამატება '}</UiText>
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/company?register=1"
                prefetch={false}
                className="ds-btn business-btn-light"
              >
                <UiText>კომპანიის რეგისტრაცია</UiText>
              </Link>
            </div>
            <ul className="business-hero-points">
              <li>
                <Check size={16} aria-hidden="true" />
                <UiText>უფასო სტანდარტული განთავსება</UiText>
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                <UiText>რეგისტრაციის გარეშე</UiText>
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                <UiText>კანდიდატთან პირდაპირი კავშირი</UiText>
              </li>
            </ul>
          </div>
          <WorkspacePreview />
        </section>

        {stats.length > 0 && (
          <ul className="business-stats">
            {stats.map((stat) => (
              <li key={stat.label}>
                <strong>{stat.value}</strong>
                <UiText>{stat.label}</UiText>
              </li>
            ))}
          </ul>
        )}

        <section
          className="business-features"
          id="features"
          aria-labelledby="business-features-title"
        >
          <div className="business-section-heading">
            <span className="business-kicker">
              <UiText>კომპანიის ანგარიში</UiText>
            </span>
            <h2 id="business-features-title">
              <UiText>{'შერჩევის მთელი პროცესი ერთ სივრცეში'}</UiText>
            </h2>
            <p>
              <UiText>
                {
                  'განაცხადები აღარ იკარგება ფოსტასა და ჩატებში. ყველა კანდიდატი, CV და კოლეგის შეფასება ერთ ადგილას გაქვთ.'
                }
              </UiText>
            </p>
          </div>
          <ul className="business-feature-grid">
            {workspaceFeatures.map(({ art, title, text }) => (
              <li key={title}>
                <FeatureArt kind={art} />
                <h3>
                  {/* The link covers the whole card; registration opens the workspace it shows. */}
                  <Link
                    href="/company?register=1"
                    prefetch={false}
                    className="business-feature-link"
                  >
                    <UiText>{title}</UiText>
                  </Link>
                </h3>
                <p>
                  <UiText>{text}</UiText>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="business-paths"
          aria-labelledby="business-paths-title"
        >
          <div className="business-section-heading">
            <h2 id="business-paths-title">
              <UiText>{'განთავსების ორი გზა'}</UiText>
            </h2>
            <p>
              <UiText>
                {
                  'ერთჯერადი ვაკანსიისთვის ფორმა საკმარისია. თუ ხშირად ეძებთ თანამშრომლებს, კომპანიის ანგარიში დროს დაგიზოგავთ.'
                }
              </UiText>
            </p>
          </div>
          <div className="business-path-grid">
            <article className="business-path">
              <span className="business-path-tag">
                <UiText>რეგისტრაციის გარეშე</UiText>
              </span>
              <h3>
                <UiText>სწრაფი განთავსება</UiText>
              </h3>
              <p>
                <UiText>
                  {
                    'შეავსეთ ფორმა და გამოგზავნეთ. ვაკანსია შემოწმების შემდეგ გამოქვეყნდება, კანდიდატები კი თქვენ მიერ მითითებული გზით დაგიკავშირდებიან.'
                  }
                </UiText>
              </p>
              <ul>
                <li>
                  <Check size={15} aria-hidden="true" />
                  <UiText>{'მარტივი ფორმა, რამდენიმე წუთში'}</UiText>
                </li>
                <li>
                  <Check size={15} aria-hidden="true" />
                  <UiText>{'განაცხადებს მიიღებთ ელფოსტით ან ტელეფონით'}</UiText>
                </li>
                {premiumAvailable && (
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <UiText>{'საჭიროების შემთხვევაში VIP ან სუპერ VIP'}</UiText>
                  </li>
                )}
              </ul>
              <Link
                href="/post-job"
                prefetch={false}
                className="ds-btn ds-btn--secondary"
              >
                <UiText>{'ვაკანსიის დამატება '}</UiText>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </article>
            <article className="business-path business-path--workspace">
              <span className="business-path-tag">
                <UiText>რეკომენდებული</UiText>
              </span>
              <h3>
                <UiText>კომპანიის ანგარიში</UiText>
              </h3>
              <p>
                <UiText>
                  {
                    'ყველა ვაკანსია და განაცხადი ერთ სივრცეშია. ანგარიში ადმინისტრატორის დამტკიცების შემდეგ ჩაირთვება.'
                  }
                </UiText>
              </p>
              <ul>
                <li>
                  <Check size={15} aria-hidden="true" />
                  <UiText>{'კანდიდატების დაფა და CV ბაზა'}</UiText>
                </li>
                <li>
                  <Check size={15} aria-hidden="true" />
                  <UiText>{'გუნდის მოწვევა და როლები'}</UiText>
                </li>
                <li>
                  <Check size={15} aria-hidden="true" />
                  <UiText>{'კომპანიის გვერდი და ანალიტიკა'}</UiText>
                </li>
              </ul>
              <Link
                href="/company?register=1"
                prefetch={false}
                className="ds-btn ds-btn--primary"
              >
                <UiText>{'კომპანიის რეგისტრაცია '}</UiText>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

        <section
          className="business-process"
          id="how"
          aria-labelledby="business-process-title"
        >
          <div className="business-section-heading">
            <h2 id="business-process-title">
              <UiText>{'როგორ განათავსო ვაკანსია უფასოდ'}</UiText>
            </h2>
          </div>
          <ol>
            <li>
              <span>1</span>
              <h3>
                <UiText>{'შეავსეთ განცხადება'}</UiText>
              </h3>
              <p>
                <UiText>
                  {
                    'მიუთითეთ პოზიცია, პირობები, კომპანიის მონაცემები და განაცხადის მიღების გზა.'
                  }
                </UiText>
              </p>
            </li>
            <li>
              <span>2</span>
              <h3>
                <UiText>{'ადმინისტრატორის შემოწმება'}</UiText>
              </h3>
              <p>
                <UiText>
                  {
                    'გაგზავნილ განცხადებას ადმინისტრატორი განიხილავს და გამოქვეყნებამდე ამოწმებს.'
                  }
                </UiText>
              </p>
            </li>
            <li>
              <span>3</span>
              <h3>
                <UiText>{'ვაკანსიის გამოქვეყნება'}</UiText>
              </h3>
              <p>
                <UiText>
                  {
                    'დამტკიცებული ვაკანსია ხელმისაწვდომი გახდება; კანდიდატები მითითებული გზით დაგიკავშირდებიან.'
                  }
                </UiText>
              </p>
            </li>
          </ol>
        </section>

        <section
          className="business-placements"
          id="placements"
          aria-labelledby="business-placements-title"
        >
          <div className="business-section-heading">
            <h2 id="business-placements-title">
              <UiText>{'განთავსების პირობები'}</UiText>
            </h2>
            <p>
              <UiText>
                {premiumAvailable
                  ? 'განთავსების ტიპს განცხადების შევსებისას აირჩევთ.'
                  : 'სტანდარტული განთავსება უფასოა. ფასიან განთავსებაზე კითხვით დაგვიკავშირდით.'}
              </UiText>
            </p>
          </div>
          <div
            className={`business-plan-grid${shownPlans.length === 1 ? ' business-plan-grid--single' : ''}`}
          >
            {shownPlans.map((plan) => (
              <article
                key={plan.name}
                className={`business-plan ${plan.className}`}
              >
                <div className="business-plan-top">
                  <h3 className="business-plan-label">
                    <UiText>{plan.name}</UiText>
                  </h3>
                </div>
                <p className="business-plan-price">
                  <UiText>{plan.price}</UiText>
                  <span>
                    <UiText values={plan.periodValues}>{plan.period}</UiText>
                  </span>
                </p>
                <p className="business-plan-description">
                  <UiText>{plan.description}</UiText>
                </p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} aria-hidden="true" />
                      <UiText
                        values={[plan.tier === 'vip' ? vipDays : premiumDays]}
                      >
                        {feature}
                      </UiText>
                    </li>
                  ))}
                </ul>
                <Link
                  href={
                    plan.tier === 'standard' || premiumAvailable
                      ? `/post-job?placement=${plan.tier}`
                      : '/contact'
                  }
                  prefetch={false}
                  className="business-plan-button"
                >
                  {plan.tier !== 'standard' && !premiumAvailable ? (
                    <UiText>დაგვიკავშირდით</UiText>
                  ) : plan.tier === 'standard' ? (
                    <UiText>უფასოდ განთავსება</UiText>
                  ) : plan.tier === 'vip' ? (
                    <UiText>VIP-ის არჩევა</UiText>
                  ) : (
                    <UiText>სუპერ VIP-ის არჩევა</UiText>
                  )}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
          {premiumAvailable && (
            <p className="business-plan-terms">
              <UiText>
                {
                  'VIP-ისა და სუპერ VIP-ის 30-დღიანი პერიოდი იწყება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ. შემდეგ ვაკანსია სტანდარტულად რჩება მის ბოლო ვადამდე. თანხა ავტომატურად არ ჩამოიჭრება.'
                }
              </UiText>
            </p>
          )}
        </section>

        <section
          className="business-faq"
          id="faq"
          aria-labelledby="business-faq-title"
        >
          <div className="business-section-heading">
            <h2 id="business-faq-title">
              <UiText>{'კითხვები და პასუხები'}</UiText>
            </h2>
          </div>
          <div>
            {questions.map(({ question, answer, values }) => (
              <details key={question}>
                <summary>
                  <UiText>{question}</UiText>
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>
                  <UiText values={values}>{answer}</UiText>
                </p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="business-start"
          aria-labelledby="business-start-title"
        >
          <div>
            <h2 id="business-start-title">
              <UiText>{'განათავსეთ პირველი ვაკანსია'}</UiText>
            </h2>
            <p>
              <UiText>{'შეკითხვების შემთხვევაში დაგვიკავშირდით.'}</UiText>
            </p>
          </div>
          <div className="business-start-actions">
            <div className="business-start-buttons">
              <Link
                href="/post-job"
                prefetch={false}
                className="ds-btn ds-btn--primary"
              >
                <UiText>{'ვაკანსიის დამატება '}</UiText>
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/company?register=1"
                prefetch={false}
                className="ds-btn business-btn-light"
              >
                <UiText>კომპანიის რეგისტრაცია</UiText>
              </Link>
            </div>
            <a
              href={`tel:${invoiceContact.telephone}`}
              className="business-contact"
            >
              <Phone size={15} aria-hidden="true" />
              <UiText>{'განთავსებაზე კითხვა გაქვთ? '}</UiText>
              {invoiceContact.phone}
            </a>
          </div>
        </section>
      </main>
      <ServerSiteFooter showDirectory={false} />
    </div>
  );
}
