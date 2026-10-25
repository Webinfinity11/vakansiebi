import { UiText } from '@/app/ui-language';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Phone,
} from 'lucide-react';
import { PublicHeader } from '../public-header';
import { ServerSiteFooter } from '../server-site-footer';
import { invoiceContact, premiumDays, premiumPriceGEL } from '@/lib/billing';
import { introductoryDays } from '@/lib/placement';
import { billingSettings } from '@/lib/server/billing';
import { breadcrumbs, jsonLd, shareImage, siteUrl } from '@/lib/seo';
import './business.css';

export const dynamic = 'force-dynamic';

const title = 'უფასო ვაკანსიის განთავსება — ბიზნესისთვის | JOBX';
const description =
  'უფასო ვაკანსიის განთავსება JOBX-ზე რეგისტრაციის გარეშე. გამოაქვეყნე განცხადება, გააცანი შენი კომპანია კანდიდატებს და შეადარე სტანდარტული, VIP და პრემიუმ პირობები.';
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
  const premiumAvailable = !!(await billingSettings().catch(() => null));
  const plans = [
    {
      tier: 'standard',
      name: 'სტანდარტული',
      price: 'უფასო',
      period: 'საწყისი განთავსება',
      description: 'როცა გინდა, რომ შენი ვაკანსია ძიების შედეგებში გამოჩნდეს.',
      features: [
        'ვაკანსიის სრული აღწერა და პირობები',
        'კომპანიის სახელი და ლოგო',
        'შენ მიერ მითითებული განაცხადის გზა',
      ],
      className: 'business-plan-standard',
    },
    {
      tier: 'vip',
      name: 'VIP',
      price: 'უფასო',
      period: 'პირველი {0} დღე',
      periodValues: [introductoryDays],
      description: 'პირველი VIP განთავსება, თითო კომპანიისთვის ერთხელ.',
      features: [
        'სტანდარტული განთავსების შესაძლებლობები',
        'სტანდარტულ შედეგებზე წინ გამოჩენა',
        '{0} დღე გააქტიურებიდან',
      ],
      className: 'business-plan-vip',
    },
    {
      tier: 'premium',
      name: 'პრემიუმი',
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
  const questions: { question: string; answer: string; values?: number[] }[] = [
    {
      question: 'შემიძლია ვაკანსია უფასოდ განვათავსო?',
      answer:
        'დიახ. აირჩიე სტანდარტული განთავსება და შეავსე ვაკანსიის ფორმა. განცხადების გამოქვეყნება უფასოა, რეგისტრაცია საჭირო არ არის. ვაკანსია ადმინისტრატორის შემოწმებისა და დამტკიცების შემდეგ გამოჩნდება.',
    },
    {
      question: 'მჭირდება რეგისტრაცია?',
      answer:
        'განცხადების დასამატებლად რეგისტრაცია საჭირო არ არის. შეავსე ვაკანსიისა და კომპანიის მონაცემები და მიუთითე, როგორ დაგიკავშირდეს კანდიდატი.',
    },
    {
      question: 'როდის გამოჩნდება ვაკანსია?',
      answer:
        'განაცხადის გაგზავნის შემდეგ განცხადებას ადმინისტრატორი ამოწმებს. საიტზე ის დამტკიცების შემდეგ გამოჩნდება. პრემიუმ განთავსებისთვის გადახდის დადასტურებაც საჭიროა.',
    },
    {
      question: 'ვის შეუძლია უფასო VIP-ის გამოყენება?',
      answer:
        'პირველი VIP განთავსება {0} დღით უფასოა, თითო კომპანიისთვის ერთხელ. შემდეგ განცხადება ავტომატურად გადადის სტანდარტულ განთავსებაზე და რჩება განაცხადების მიღების ვადის ამოწურვამდე. შეთავაზების გამოყენების შესაძლებლობა განცხადების შემოწმებისას დგინდება.',
      values: [introductoryDays],
    },
    {
      question: 'როგორ გადავიხადო პრემიუმის საფასური?',
      answer:
        'განაცხადში პრემიუმის არჩევისას მიიღებ ინვოისს საბანკო რეკვიზიტებითა და გადარიცხვის დანიშნულებით. ფასი {0} ₾-ია {1} დღისთვის. განთავსება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ გააქტიურდება. თანხა ავტომატურად არ ჩამოიჭრება.',
      values: [premiumPriceGEL, premiumDays],
    },
  ];
  return (
    <div className="board-shell business-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: 'JOBX', path: '/' },
              { name: 'ბიზნესისთვის', path: '/business' },
            ]),
          ),
        }}
      />
      <PublicHeader />
      <main className="business-main">
        <section className="business-hero" aria-labelledby="business-title">
          <div className="business-hero-art" aria-hidden="true">
            <Image
              src="/images/jobx-business-team-v2.webp"
              alt=""
              fill
              sizes="(max-width: 760px) 180vw, (max-width: 1200px) 100vw, 1200px"
              preload
            />
          </div>
          <div className="business-hero-copy">
            <span className="business-eyebrow">
              <Building2 size={15} aria-hidden="true" />
              <UiText>{' JOBX ბიზნესისთვის'}</UiText>
            </span>
            <h1 id="business-title">
              {/* The spaces keep the words apart in the heading's text, which
                  is what search results and screen readers read. */}
              <UiText>კარგ გუნდს კარგი ადამიანები ქმნიან.</UiText>
            </h1>
            <p>
              <UiText>
                {
                  'უფასო ვაკანსიის განთავსება JOBX-ზე, რეგისტრაციის გარეშე. გააცანი შენი გუნდი მომავალ თანამშრომელს.'
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
              <a href="#placements" className="ds-btn ds-btn--secondary">
                <UiText>{'განთავსების პირობები'}</UiText>{' '}
                <ChevronDown size={16} aria-hidden="true" />
              </a>
            </div>
            <span className="business-hero-note">
              <CheckCircle2 size={15} aria-hidden="true" />
              <UiText>{' დაიწყე უფასო სტანდარტული განთავსებით'}</UiText>
            </span>
          </div>
        </section>
        <ul className="business-facts" aria-label="განთავსება JOBX-ზე">
          <li>
            <Check size={16} aria-hidden="true" />
            <UiText>{' რეგისტრაციის გარეშე'}</UiText>
          </li>
          <li>
            <Check size={16} aria-hidden="true" />
            <UiText>{' უფასო სტანდარტული განთავსება'}</UiText>
          </li>
          <li>
            <Check size={16} aria-hidden="true" />
            <UiText>{' კანდიდატთან პირდაპირი კავშირი'}</UiText>
          </li>
        </ul>

        <section
          className="business-process"
          aria-labelledby="business-process-title"
        >
          <div className="business-section-heading">
            <h2 id="business-process-title">
              <UiText>{'როგორ განათავსო ვაკანსია უფასოდ'}</UiText>
            </h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <h3>
                <UiText>{'შეავსე განცხადება'}</UiText>
              </h3>
              <p>
                <UiText>
                  {
                    'მიუთითე პოზიცია, პირობები, კომპანიის მონაცემები და განაცხადის მიღების გზა.'
                  }
                </UiText>
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>
                <UiText>{'გაიარე შემოწმება'}</UiText>
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
              <span>03</span>
              <h3>
                <UiText>{'გამოჩნდი ძიებაში'}</UiText>
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
              <UiText>{'აირჩიე შენთვის შესაფერისი განთავსება'}</UiText>
            </h2>
            <p>
              <UiText>
                {'განთავსების ტიპს განცხადების შევსებისას აირჩევ.'}
              </UiText>
            </p>
          </div>
          <div className="business-plan-grid">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`business-plan ${plan.className}`}
              >
                <div className="business-plan-top">
                  <h3 className="business-plan-label">
                    <UiText>{plan.name}</UiText>
                  </h3>
                  {plan.name === 'VIP' ? (
                    <span className="business-plan-offer">
                      <UiText>{'დროებითი შეთავაზება'}</UiText>
                    </span>
                  ) : null}
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
                        values={[
                          plan.tier === 'vip' ? introductoryDays : premiumDays,
                        ]}
                      >
                        {feature}
                      </UiText>
                    </li>
                  ))}
                </ul>
                {plan.name === 'პრემიუმი' && !premiumAvailable && (
                  <small className="business-plan-unavailable">
                    <UiText>{'პრემიუმის გადახდა ამჟამად მიუწვდომელია.'}</UiText>
                  </small>
                )}
                {plan.tier !== 'premium' || premiumAvailable ? (
                  <Link
                    href={`/post-job?placement=${plan.tier}`}
                    prefetch={false}
                    className="business-plan-button"
                  >
                    {plan.tier === 'standard' ? (
                      <UiText>უფასოდ განთავსება</UiText>
                    ) : plan.tier === 'vip' ? (
                      <UiText>VIP-ის არჩევა</UiText>
                    ) : (
                      <UiText>პრემიუმის არჩევა</UiText>
                    )}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                ) : (
                  <button className="business-plan-button" disabled>
                    <UiText>{'ამჟამად მიუწვდომელია'}</UiText>
                  </button>
                )}
              </article>
            ))}
          </div>
          <p className="business-plan-terms">
            <UiText>
              {
                'VIP-ის უფასო შეთავაზება შემოწმდება დამტკიცებისას. VIP და პრემიუმ პერიოდი ითვლება გააქტიურებიდან; ვადის გასვლის შემდეგ განცხადება სტანდარტულ რეჟიმში რჩება, მის მითითებულ ბოლო ვადამდე. თანხა ავტომატურად არ ჩამოიჭრება.'
              }
            </UiText>
          </p>
        </section>

        <section className="business-faq" aria-labelledby="business-faq-title">
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
              <UiText>{'დავიწყოთ შენი ვაკანსიით.'}</UiText>
            </h2>
            <p>
              <UiText>{'თუ შევსებისას კითხვა გაგიჩნდება, დაგვირეკე.'}</UiText>
            </p>
          </div>
          <div className="business-start-actions">
            <Link
              href="/post-job"
              prefetch={false}
              className="ds-btn ds-btn--primary"
            >
              <UiText>{'ვაკანსიის დამატება '}</UiText>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a
              href={`tel:${invoiceContact.telephone}`}
              className="business-contact"
            >
              <Phone size={15} aria-hidden="true" />
              <UiText>{'განთავსებაზე კითხვა გაქვს? '}</UiText>
              {invoiceContact.phone}
            </a>
          </div>
        </section>
      </main>
      <ServerSiteFooter showDirectory={false} />
    </div>
  );
}
