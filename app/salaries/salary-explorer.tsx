'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Search, X } from 'lucide-react';
import { useUi } from '../ui-language';
import { translateUi } from '@/lib/ui-language';
import { textSearch } from '@/lib/search-text';
import type { SalaryRole } from '@/lib/salary-pages';
import { categories } from '@/lib/types';
import { SelectField } from '../select-field';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import './salaries.css';

export function SalaryExplorer({
  roles,
  detail = false,
}: {
  roles: SalaryRole[];
  detail?: boolean;
}) {
  const { locale } = useUi();
  const t = (ka: string, en: string) => (locale === 'en' ? en : ka);
  const [period, setPeriod] = useState<'month' | 'day'>('month');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('vacancies');
  const [group, setGroup] = useState('');
  const [offer, setOffer] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const number = (n: number) => new Intl.NumberFormat('en-GB').format(n);
  const filtered = useMemo(() => {
    const match = textSearch(query);
    return roles
      .filter(
        (role) =>
          detail ||
          role.kind === 'profession' ||
          (role.kind === 'category' &&
            !roles.some(
              (child) =>
                child.kind === 'profession' && child.group === role.group,
            )),
      )
      .filter(
        (role) =>
          (!group || role.group === group) &&
          (detail || showAll || !!group || !!role[period] || !!query.trim()),
      )
      .filter(
        (role) =>
          !query.trim() ||
          match(role.label) ||
          translateUi(role.label, 'en')
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        sort === 'salary'
          ? (b[period]?.median ?? -1) - (a[period]?.median ?? -1)
          : b.total - a.total,
      );
  }, [roles, query, sort, period, group, detail, showAll]);
  const selected = roles[0],
    sample = selected?.[period];
  const available = roles.filter(
    (role) => role.kind === 'profession' && role[period],
  ).length;
  const scale = Math.max(1, ...filtered.map((role) => role[period]?.high ?? 0));
  const categoryOptions = [
    { value: '', label: t('ყველა კატეგორია', 'All categories') },
    ...categories.map((value) => ({
      value,
      label: translateUi(value, locale),
    })),
  ];
  return (
    <section
      className="salary-explorer"
      aria-label={t('ანაზღაურების შედარება', 'Salary comparison')}
    >
      <div className="salary-tools">
        {!detail && (
          <label className="salary-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">
              {t('პროფესიის ძიება', 'Search roles')}
            </span>
            <input
              className="ds-input"
              type="search"
              placeholder={t('მოძებნე პროფესია', 'Search professions')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('გასუფთავება', 'Clear')}
              >
                <X size={16} />
              </button>
            )}
          </label>
        )}
        <fieldset
          className="salary-period"
          aria-label={t('ანაზღაურების პერიოდი', 'Pay period')}
        >
          <button
            type="button"
            aria-pressed={period === 'month'}
            onClick={() => setPeriod('month')}
          >
            {t('თვიური', 'Monthly')}
          </button>
          <button
            type="button"
            aria-pressed={period === 'day'}
            onClick={() => setPeriod('day')}
          >
            {t('დღიური', 'Daily')}
          </button>
        </fieldset>
        {!detail && (
          <div className="salary-sort">
            <SelectField
              value={sort}
              onChange={setSort}
              label={t('დალაგება', 'Sort by')}
              options={[
                {
                  value: 'vacancies',
                  label: t('მეტი ვაკანსია', 'Most vacancies'),
                },
                {
                  value: 'salary',
                  label: t('მაღალი ანაზღაურება', 'Highest median'),
                },
              ]}
            />
          </div>
        )}
      </div>
      {!detail && (
        <div className="salary-category-bar">
          <div className="salary-category-choice">
            <Combobox
              items={categoryOptions}
              value={
                categoryOptions.find((option) => option.value === group) ?? null
              }
              onValueChange={(value) => {
                setGroup(value?.value ?? '');
                setExpanded(false);
              }}
              itemToStringLabel={(value) => value.label}
              isItemEqualToValue={(a, b) => a.value === b.value}
            >
              <ComboboxInput
                aria-label={t('კატეგორიის არჩევა', 'Choose category')}
                placeholder={t('ყველა კატეგორია', 'All categories')}
                showClear
              />
              <ComboboxContent>
                <ComboboxEmpty>{t('ვერ მოიძებნა', 'No results')}</ComboboxEmpty>
                <ComboboxList>
                  {(item: { value: string; label: string }) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <span>
            {t(
              `${categories.length} კატეგორია · ${available} მიმართულებაზე საკმარისი მონაცემია`,
              `${categories.length} categories · ${available} roles with comparable data`,
            )}
          </span>
        </div>
      )}
      {detail ? (
        <>
          {sample ? (
            <div className="salary-detail">
              <div className="salary-main-value">
                <span
                  title={t(
                    'განცხადებების ნახევარში თანხა ამაზე დაბალია, ნახევარში — მაღალი.',
                    'Half the stated amounts are below this value and half above.',
                  )}
                >
                  {t('შუა მაჩვენებელი', 'Median')}
                </span>
                <strong>
                  {number(sample.median)} <small>₾</small>
                </strong>
                <p>
                  {t(
                    `${number(sample.count)} განცხადების მიხედვით`,
                    `Based on ${number(sample.count)} listings`,
                  )}
                </p>
              </div>
              <div className="salary-distribution">
                <span>
                  {t('განცხადებების შუა 50%', 'Middle 50% of listings')}
                </span>
                <strong>
                  {number(sample.low)} – {number(sample.high)} ₾
                </strong>
                <div className="salary-range-track" aria-hidden="true">
                  <i
                    style={{
                      left: `${sample.high === sample.low ? 50 : (100 * (sample.median - sample.low)) / (sample.high - sample.low)}%`,
                    }}
                  />
                </div>
                <p>
                  {t(
                    'ეს შუალედი ყველაზე დაბალ და მაღალ მეოთხედებს არ მოიცავს.',
                    'This range excludes the lowest and highest quarters.',
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="salary-empty">
              <h2>
                {t('ჯერ საკმარისი მონაცემი არ გვაქვს', 'Not enough data yet')}
              </h2>
              <p>
                {t(
                  'შედარებისთვის სულ მცირე 8 აქტიურ განცხადებაში მითითებული თანხაა საჭირო.',
                  'A comparison requires stated pay in at least eight active listings.',
                )}
              </p>
            </div>
          )}
          {sample && (
            <div className="salary-offer">
              <label htmlFor="salary-offer">
                {t('შეადარე შენი შეთავაზება', 'Compare your offer')}
                <span>
                  {t(
                    'მიუთითე თანხა იმავე პერიოდით',
                    'Enter an amount for the same pay period',
                  )}
                </span>
              </label>
              <div>
                <input
                  id="salary-offer"
                  className="ds-input"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  placeholder={String(sample.median)}
                  value={offer}
                  onChange={(event) => setOffer(event.target.value)}
                />
                <span>₾</span>
              </div>
              <output aria-live="polite">
                {Number(offer) > 0
                  ? t(
                      Number(offer) < sample.low
                        ? 'ნაჩვენები დიაპაზონის ქვემოთაა'
                        : Number(offer) > sample.high
                          ? 'ნაჩვენები დიაპაზონის ზემოთაა'
                          : 'ნაჩვენებ დიაპაზონშია',
                      Number(offer) < sample.low
                        ? 'Below the displayed range'
                        : Number(offer) > sample.high
                          ? 'Above the displayed range'
                          : 'Within the displayed range',
                    )
                  : t(
                      'შეადარე ქვემოთ მოცემულ ვაკანსიებსაც — საათები და ბონუსები შეიძლება განსხვავდებოდეს.',
                      'Compare the vacancies too: hours and bonuses may differ.',
                    )}
              </output>
            </div>
          )}
          <div className="salary-detail-action">
            <span>
              {t(
                `${number(selected.total)} აქტიური ვაკანსია`,
                `${number(selected.total)} active vacancies`,
              )}
            </span>
            <Link
              className="ds-btn ds-btn--primary"
              href={selected.href}
              prefetch={false}
            >
              {t('ვაკანსიების ნახვა', 'Browse jobs')}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="salary-results-meta">
            <p className="salary-found" aria-live="polite">
              {t(
                `${filtered.length} მიმართულება · თანხები ლარში`,
                `${filtered.length} roles · Amounts in GEL`,
              )}
            </p>
            <label>
              <input
                type="checkbox"
                checked={showAll}
                onChange={(event) => setShowAll(event.target.checked)}
              />
              {t(
                'მწირი მონაცემის მქონე პროფესიებიც',
                'Include professions with limited data',
              )}
            </label>
          </div>
          <div className="salary-table" key={period + group}>
            <div className="salary-table-head" aria-hidden="true">
              <span>{t('პროფესია', 'Profession')}</span>
              <span>{t('ანაზღაურების დიაპაზონი', 'Pay range')}</span>
              <span
                title={t(
                  'განცხადებების ნახევარში თანხა ამაზე დაბალია, ნახევარში — მაღალი.',
                  'Half the stated amounts are below this value and half above.',
                )}
              >
                {t('შუა მაჩვენებელი', 'Median')}
              </span>
              <span>{t('ხელფასი მითითებულია', 'Pay stated in')}</span>
              <span />
            </div>
            <ul>
              {(expanded ? filtered : filtered.slice(0, 12)).map((role) => {
                const s = role[period];
                return (
                  <li key={role.slug}>
                    <Link
                      href={`/salaries/${role.slug}`}
                      className="salary-row"
                      prefetch={false}
                    >
                      <div className="salary-role">
                        <strong>{translateUi(role.label, locale)}</strong>
                        {!group && role.group && (
                          <span>{translateUi(role.group, locale)}</span>
                        )}
                        <span>
                          {t(
                            `${number(role.total)} ვაკანსია`,
                            `${number(role.total)} vacancies`,
                          )}
                        </span>
                      </div>
                      <div className="salary-range">
                        <span className="salary-mobile-label">
                          {t('დიაპაზონი', 'Range')}
                        </span>
                        {s ? (
                          <>
                            <strong>
                              {number(s.low)} – {number(s.high)}{' '}
                              <small>₾</small>
                            </strong>
                            <div
                              className="salary-mini-range"
                              aria-hidden="true"
                              style={
                                {
                                  '--range-start': `${(100 * s.low) / scale}%`,
                                  '--range-width': `${Math.max(1, (100 * (s.high - s.low)) / scale)}%`,
                                  '--range-middle': `${(100 * s.median) / scale}%`,
                                } as CSSProperties
                              }
                            >
                              <span />
                              <i />
                            </div>
                          </>
                        ) : (
                          <span className="salary-insufficient">
                            {t('მონაცემი არასაკმარისია', 'Not enough data')}
                          </span>
                        )}
                      </div>
                      <div className="salary-median">
                        <span className="salary-mobile-label">
                          {t('შუა მაჩვენებელი', 'Median')}
                        </span>
                        {s ? (
                          <strong>
                            {number(s.median)} <small>₾</small>
                          </strong>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div className="salary-sample">
                        {s ? (
                          <>
                            <b>{number(s.count)}</b>
                            <span>{t('განცხადება', 'listings')}</span>
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <ArrowUpRight
                        size={18}
                        className="salary-row-arrow"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {!expanded && filtered.length > 12 && (
              <button
                type="button"
                className="salary-more"
                onClick={() => setExpanded(true)}
              >
                {t(
                  `კიდევ ${filtered.length - 12} პროფესიის ნახვა`,
                  `Show ${filtered.length - 12} more professions`,
                )}
                <ChevronDown size={16} />
              </button>
            )}
            {!filtered.length && (
              <div className="salary-empty">
                <p>
                  {t(
                    'ამ სახელით პროფესია ვერ მოიძებნა.',
                    'No profession matches that search.',
                  )}
                </p>
                <button
                  className="ds-btn ds-btn--secondary"
                  onClick={() => setQuery('')}
                >
                  {t('ყველა პროფესია', 'All professions')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <p className="salary-reading-note">
        {t(
          'ზოლი აჩვენებს განცხადებების შუა 50%-ის დიაპაზონს, წერტილი — მედიანას. ანუ თანხების ნახევარი ამ მაჩვენებელზე დაბალია, ნახევარი — მაღალი.',
          'The bar shows the middle 50% of stated amounts; the dot marks the median. Half the amounts are below that value and half above.',
        )}
      </p>
      <details className="salary-method" id="salary-method">
        <summary>
          {t(
            'საიდან მოდის მონაცემები და როგორ ითვლება',
            'Data sources and methodology',
          )}
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div>
          <p>
            {t(
              'თანხები მოდის ჯობიქსის აქტიური ვაკანსიებიდან — დასაქმების საიტებიდან მიღებული და უშუალოდ დამსაქმებლების დამატებული განცხადებებიდან. ერთსა და იმავე ვაკანსიას ერთხელ ვითვლით. პროფესიას ვაკანსიების კატალოგის იმავე კატეგორიითა და სათაურის წესით ვარჩევთ; მონაცემები ყველა ქალაქს მოიცავს.',
              'Amounts come from active JOBX vacancies collected from employment websites or posted by employers. Each vacancy is counted once. Professions are matched by title, across all cities.',
            )}
          </p>
          <p>
            {t(
              'ვიყენებთ მხოლოდ ლარში მითითებულ საწყის თანხებს. თვიური და დღიური ანაზღაურება ცალ-ცალკე ითვლება. მედიანა თანხების დალაგებული სიის შუა მნიშვნელობაა; დიაპაზონი აჩვენებს შუა 50%-ს. მინიმუმ 8 განცხადებაა საჭირო. მონაცემები საათში ერთხელ ახლდება.',
              'We use starting amounts stated in GEL, keeping monthly and daily pay separate. The median is the middle value in the ordered amounts; the range shows the middle 50%. At least eight listings are required. Figures refresh hourly.',
            )}
          </p>
          <p>
            {t(
              'ეს არ არის ოფიციალური სახელფასო სტატისტიკა ან მთელი ბაზრის საშუალო. სამუშაო საათები, ბონუსები და ხელზე მისაღები თუ დარიცხული თანხა თითოეულ განცხადებაში გადაამოწმე.',
              'These figures are not official salary statistics or a market-wide average. Check hours, bonuses and whether each amount is gross or net in the listing.',
            )}
          </p>
        </div>
      </details>
    </section>
  );
}
