'use client';
import { useUi } from '@/app/ui-language';
import Link from 'next/link';
import { CircleHelp } from 'lucide-react';
import type { Landing } from '@/lib/seo-landing';
import { LandingSummary } from './landing-summary';
import { Brand } from './brand';
import { TopGeCounter } from './top-ge-counter';
import { SearchDirectoryGroups } from './search-directory-groups';
import { InstallAppAction } from './install-app';
import { LocalText } from './local-text';
import { siteName, siteSocialProfiles } from '@/lib/site-brand';
import './site-footer.css';

export function SiteFooter({
  landing,
  landingTotal,
  onSaved,
  showDirectory = true,
}: {
  landing?: Landing | null;
  /** The list's own count, so the summary and the heading agree. */
  landingTotal?: number;
  onSaved?: () => void;
  showDirectory?: boolean;
}) {
  const { ui } = useUi();
  return (
    <>
      {/* Reader-facing, and the only way a crawler reaches these lists by
          following links rather than by reading the sitemap. */}
      {showDirectory && (
        <nav
          className="search-directory"
          aria-label={ui('სწრაფი ბმულები და ვაკანსიების ძიება')}
        >
          {/* Below the vacancies, not above them: a list with nothing to read is
            a thin page, but the reader came for the list and the sentence that
            describes it has no business standing between them. */}
          {landing && <LandingSummary landing={landing} total={landingTotal} />}
          <SearchDirectoryGroups landing={landing} />
        </nav>
      )}
      <footer className="site-footer jx-footer">
        <div className="jx-footer-top">
          <div className="jx-footer-brand">
            <Brand />
            <p>{ui('ვაკანსიები საქართველოში')}</p>
            <ul
              className="jx-footer-social"
              aria-label={ui('სოციალური ქსელები')}
            >
              {siteSocialProfiles.map((profile) => (
                <li key={profile.name}>
                  <a
                    href={profile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${siteName} — ${profile.name}`}
                    title={profile.name}
                  >
                    <SocialIcon name={profile.name} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <nav
            className="jx-footer-columns"
            aria-label={ui('ფუტერის ნავიგაცია')}
          >
            <div>
              <p className="jx-footer-title">{ui('სამუშაოს მაძიებლებს')}</p>
              <ul>
                <li>
                  <a href={onSaved ? '#search-heading' : '/#search-heading'}>
                    {ui('ვაკანსიების ძიება')}
                  </a>
                </li>
                <li>
                  {onSaved ? (
                    <button type="button" onClick={onSaved}>
                      {ui('შენახული ვაკანსიები')}
                    </button>
                  ) : (
                    <Link href="/?saved=1" prefetch={false}>
                      {ui('შენახული ვაკანსიები')}
                    </Link>
                  )}
                </li>
                <li>
                  <Link href="/cv" prefetch={false}>
                    {ui('რეზიუმეს შექმნა')}
                  </Link>
                </li>
                <li>
                  <Link href="/salaries" prefetch={false}>
                    <LocalText ka="ხელფასები" en="Salaries" />
                  </Link>
                </li>
                <li className="jx-footer-install">
                  <InstallAppAction />
                </li>
              </ul>
            </div>
            <div>
              <p className="jx-footer-title">{ui('დამსაქმებლებს')}</p>
              <ul>
                <li>
                  <Link href="/business" prefetch={false}>
                    {ui('ვაკანსიის უფასო განთავსება')}
                  </Link>
                </li>
                <li>
                  <Link href="/company" prefetch={false}>
                    {ui('ანგარიშში შესვლა')}
                  </Link>
                </li>
                <li>
                  <Link href="/companies" prefetch={false}>
                    {ui('კომპანიები')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="jx-footer-title">{ui(siteName)}</p>
              <ul>
                {[
                  ['/about', 'ჩვენ შესახებ', 'About'],
                  ['/blog', 'ბლოგი', 'Blog'],
                  ['/help', 'დახმარება', 'Help'],
                  ['/contact', 'კონტაქტი', 'Contact'],
                ].map(([href, ka, en]) => (
                  <li key={href}>
                    <Link href={href} prefetch={false}>
                      <LocalText ka={ka} en={en} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
        <details id="how-it-works" className="jx-footer-help">
          <summary>
            <CircleHelp size={16} aria-hidden="true" />
            {ui(' როგორ მუშაობს ჯობიქსი?')}
          </summary>
          <p>
            {ui(
              'მოძებნე ვაკანსია, გაეცანი პირობებს და განაცხადის გასაგზავნად გადადი პირველწყაროზე. შენახული ვაკანსიები ამ ბრაუზერში რჩება და სხვა მოწყობილობაზე ავტომატურად არ გადადის. თემასა და შენახული ვაკანსიების სიას ამ ბრაუზერში ვინახავთ; ძიებებისა და მოქმედებების ანონიმური სტატისტიკა სერვერზე ინახება, ზოგი ლოგო კი გარე საიტიდან იტვირთება. PDF-ად შენახვისას რეზიუმეს ასლი ფოტოსთან ერთად JOBX-ზეც ინახება ბოლო შენახვიდან 12 თვემდე და CV-ის გვერდზე „გასუფთავებით“ წაიშლება. საჯარო გვერდებზე შეიძლება გამოიყენებოდეს Google Analytics, Yandex Metrika და Meta Pixel ვიზიტების, საიტთან ურთიერთქმედებისა და რეკლამის შედეგების გასაზომად. ეს სერვისები იყენებს ქუქი-ფაილებს.',
            )}{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              {ui('როგორ იყენებს Google მონაცემებს')}
            </a>
            .
          </p>
        </details>
        <div className="jx-footer-bottom">
          <span>
            © {new Date().getFullYear()}{' '}
            {ui('ჯობიქსი (JOBX) — ვაკანსიები საქართველოში')}
          </span>
          <div className="jx-footer-credit">
            <a
              href="https://infinity.ge/services/saitis-damzadeba/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {ui('საიტი დამზადებულია ')}
              <strong>infinity.ge</strong>
              {ui('-ის მიერ')}
            </a>
            <TopGeCounter />
          </div>
        </div>
      </footer>
    </>
  );
}

/* Brand marks drawn inline: the icon set has no TikTok, and four small paths
   cost less than another dependency. */
function SocialIcon({ name }: { name: string }) {
  const path =
    name === 'Facebook'
      ? 'M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5H16.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z'
      : name === 'Instagram'
        ? 'M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.8-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM12 3c-2.4 0-2.7 0-3.7.1-1 0-1.6.2-2.2.4-.6.2-1.1.6-1.6 1-.5.5-.8 1-1 1.6-.2.6-.4 1.3-.4 2.2C3 9.3 3 9.6 3 12s0 2.7.1 3.7c0 1 .2 1.6.4 2.2.2.6.6 1.1 1 1.6.5.5 1 .8 1.6 1 .6.2 1.3.4 2.2.4 1 .1 1.3.1 3.7.1s2.7 0 3.7-.1c1 0 1.6-.2 2.2-.4.6-.2 1.1-.6 1.6-1 .5-.5.8-1 1-1.6.2-.6.4-1.3.4-2.2.1-1 .1-1.3.1-3.7s0-2.7-.1-3.7c0-1-.2-1.6-.4-2.2-.2-.6-.6-1.1-1-1.6-.5-.5-1-.8-1.6-1-.6-.2-1.3-.4-2.2-.4C14.7 3 14.4 3 12 3zm0 1.6c2.4 0 2.6 0 3.6.1.9 0 1.4.2 1.7.3.4.2.7.4 1 .7.3.3.5.6.7 1 .1.3.3.8.3 1.7.1 1 .1 1.2.1 3.6s0 2.6-.1 3.6c0 .9-.2 1.4-.3 1.7-.2.4-.4.7-.7 1-.3.3-.6.5-1 .7-.3.1-.8.3-1.7.3-1 .1-1.2.1-3.6.1s-2.6 0-3.6-.1c-.9 0-1.4-.2-1.7-.3-.4-.2-.7-.4-1-.7-.3-.3-.5-.6-.7-1-.1-.3-.3-.8-.3-1.7-.1-1-.1-1.2-.1-3.6s0-2.6.1-3.6c0-.9.2-1.4.3-1.7.2-.4.4-.7.7-1 .3-.3.6-.5 1-.7.3-.1.8-.3 1.7-.3 1-.1 1.2-.1 3.6-.1z'
        : name === 'LinkedIn'
          ? 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3V9.75zM9.5 9.75h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-4.95c0-1.18-.02-2.7-1.65-2.7-1.65 0-1.9 1.29-1.9 2.62V21h-4V9.75z'
          : 'M16.6 3h-3.1v12.3a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V9.5a5.8 5.8 0 1 0 5 5.8V9a7.3 7.3 0 0 0 4.3 1.4V7.3A4.3 4.3 0 0 1 16.6 3z';
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}
