'use client';
import Link from 'next/link';
import { Bookmark, CircleHelp, FileText, Search } from 'lucide-react';
import { landingCopy, type Landing } from '@/lib/seo-landing';
import { Brand } from './brand';
import { TopGeCounter } from './top-ge-counter';
import { SearchDirectoryRelated } from './search-directory-context';
import { SearchDirectoryGroups } from './search-directory-groups';

export function SiteFooter({
  landing,
  onSaved,
}: {
  landing?: Landing | null;
  onSaved?: () => void;
}) {
  return (
    <>
      {/* Reader-facing, and the only way a crawler reaches these lists by
          following links rather than by reading the sitemap. */}
      <nav className="search-directory" aria-label="მსგავსი ძიებები">
        {/* Below the vacancies, not above them: a list with nothing to read is
            a thin page, but the reader came for the list and the sentence that
            describes it has no business standing between them. */}
        {landing && <p className="landing-copy">{landingCopy(landing)}</p>}
        {landing && <SearchDirectoryRelated landing={landing} />}
        <SearchDirectoryGroups />
      </nav>
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
            საჯარო გვერდების ვიზიტებს Google Analytics-ითაც ვზომავთ; ის
            ანალიტიკურ ქუქი-ფაილებს იყენებს. ფორმებში შეყვანილ პირად მონაცემებს
            Google Analytics-ს არ ვუგზავნით.{' '}
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
          <span className="footer-copyright">
            © {new Date().getFullYear()} JOBX
            <TopGeCounter siteId={118973} />
          </span>
        </div>
      </footer>
    </>
  );
}
