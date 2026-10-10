'use client';
import Link from 'next/link';
import {
  Bookmark,
  Building2,
  CircleHelp,
  FileText,
  Search,
} from 'lucide-react';
import type { Landing } from '@/lib/seo-landing';
import { LandingSummary } from './landing-summary';
import { Brand } from './brand';
import { TopGeCounter } from './top-ge-counter';
import { SearchDirectoryGroups } from './search-directory-groups';

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
  return (
    <>
      {/* Reader-facing, and the only way a crawler reaches these lists by
          following links rather than by reading the sitemap. */}
      {showDirectory && (
        <nav
          className="search-directory"
          aria-label="სწრაფი ბმულები და ვაკანსიების ძიება"
        >
          {/* Below the vacancies, not above them: a list with nothing to read is
            a thin page, but the reader came for the list and the sentence that
            describes it has no business standing between them. */}
          {landing && <LandingSummary landing={landing} total={landingTotal} />}
          <SearchDirectoryGroups landing={landing} />
        </nav>
      )}
      <footer className="site-footer jobx-footer">
        <div className="footer-main">
          <Brand />
          <nav aria-label="ფუტერის ნავიგაცია">
            <a href={onSaved ? '#search-heading' : '/#search-heading'}>
              <Search size={16} aria-hidden="true" /> ძებნა
            </a>
            {onSaved ? (
              <button onClick={onSaved}>
                <Bookmark size={16} aria-hidden="true" /> შენახული ვაკანსიები
              </button>
            ) : (
              <Link href="/?saved=1" prefetch={false}>
                <Bookmark size={16} aria-hidden="true" /> შენახული ვაკანსიები
              </Link>
            )}
            <Link href="/cv" prefetch={false}>
              <FileText size={16} aria-hidden="true" /> რეზიუმეს შექმნა
            </Link>
            <Link href="/companies" prefetch={false}>
              <Building2 size={16} aria-hidden="true" /> კომპანიები
            </Link>
            <Link href="/business" prefetch={false}>
              <Building2 size={16} aria-hidden="true" /> ვაკანსიის უფასო
              განთავსება
            </Link>
          </nav>
        </div>
        <details id="how-it-works" className="footer-help">
          <summary>
            <CircleHelp size={16} aria-hidden="true" /> როგორ მუშაობს JOBX?
          </summary>
          <p>
            მოძებნე ვაკანსია, გაეცანი პირობებს და განაცხადისთვის გადადი
            პირველწყაროზე. შენახული ვაკანსიები ამ ბრაუზერში რჩება და სხვა
            მოწყობილობაზე ავტომატურად არ გადადის. თემასა და შენახული ვაკანსიების
            სიას ამ ბრაუზერში ვინახავთ; ძიებებისა და მოქმედებების ანონიმური
            სტატისტიკა სერვერზე ინახება, ზოგი ლოგო კი გარე საიტიდან იტვირთება.
            PDF-ად შენახვისას რეზიუმეს ასლი ფოტოსთან ერთად JOBX-ზეც ინახება ბოლო
            შენახვიდან 12 თვემდე და CV-ის გვერდზე „გასუფთავებით“ წაიშლება.
            საჯარო გვერდებზე შეიძლება გამოიყენებოდეს Google Analytics, Yandex
            Metrika და Meta Pixel ვიზიტების, საიტთან ურთიერთქმედებისა და
            რეკლამის შედეგების გასაზომად. ეს სერვისები იყენებს ქუქი-ფაილებს.{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              როგორ იყენებს Google მონაცემებს
            </a>
            .
          </p>
        </details>
        <div className="footer-meta">
          <span>ვაკანსიები სხვადასხვა წყაროდან</span>
          <div className="footer-copyright">
            © {new Date().getFullYear()} JOBX
            <TopGeCounter />
          </div>
        </div>
      </footer>
    </>
  );
}
