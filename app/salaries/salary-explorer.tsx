'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Search, X } from 'lucide-react';
import { useUi } from '../ui-language';
import { translateUi } from '@/lib/ui-language';
import { textSearch } from '@/lib/search-text';
import { salaryVacanciesHref, type SalaryRole } from '@/lib/salary-pages';
import { categories } from '@/lib/types';
import { SelectField } from '../select-field';
import { CategoryIcon } from '@/components/category-icon';
import { InputGroupAddon } from '@/components/ui/input-group';
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
  initialPeriod = 'month',
}: {
  roles: SalaryRole[];
  detail?: boolean;
  initialPeriod?: 'month' | 'day';
}) {
  const { locale } = useUi();
  const t = (ka: string, en: string) => (locale === 'en' ? en : ka);
  const [period, setPeriod] = useState<'month' | 'day'>(initialPeriod);
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
      .filter((role) => detail || role.kind !== 'legacy')
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
    (role) => role.kind !== 'legacy' && role[period],
  ).length;
  const payCount = (role: SalaryRole) =>
    period === 'day' ? role.dayCount : role.monthCount;
  // Category totals count each vacancy once; professions overlap their parent category.
  const categoryRoles = roles.filter((role) => role.kind === 'category');
  const categoryCounts = new Map(
    categoryRoles.map((role) => [role.group, payCount(role)]),
  );
  const statedCount = group
    ? (categoryCounts.get(group) ?? 0)
    : categoryRoles.reduce((sum, role) => sum + payCount(role), 0);
  const vacanciesHref = salaryVacanciesHref(
    (detail ? selected : categoryRoles.find((role) => role.group === group))
      ?.href ?? '/',
    period,
  );
  const scale = Math.max(1, ...filtered.map((role) => role[period]?.high ?? 0));
  const categoryOptions = [
    {
      value: '',
      label: t('ყველა კატეგორია', 'All categories'),
      count: categoryRoles.reduce((sum, role) => sum + payCount(role), 0),
    },
    ...categories.map((value) => ({
      value,
      label: translateUi(value, locale),
      count: categoryCounts.get(value) ?? 0,
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
                showClear={Boolean(group)}
                clearLabel={t('კატეგორიის გასუფთავება', 'Clear category')}
              >
                <InputGroupAddon align="inline-start">
                  <CategoryIcon category={group} size={18} />
                </InputGroupAddon>
              </ComboboxInput>
              <ComboboxContent className="salary-category-menu">
                <p className="salary-category-menu-heading">
                  {period === 'day'
                    ? t('დღიური თანხა მითითებულია', 'Listings with daily pay')
                    : t(
                        'თვიური თანხა მითითებულია',
                        'Listings with monthly pay',
                      )}
                </p>
                <ComboboxEmpty>{t('ვერ მოიძებნა', 'No results')}</ComboboxEmpty>
                <ComboboxList>
                  {(item: { value: string; label: string; count: number }) => (
                    <ComboboxItem key={item.value} value={item}>
                      <CategoryIcon category={item.value} size={18} />
                      <span className="salary-category-name">{item.label}</span>
                      <span className="salary-category-count">
                        {number(item.count)}
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <span className="salary-category-summary" aria-live="polite">
            {t(
              `${number(statedCount)} განცხადებაში მითითებულია ${period === 'day' ? 'დღიური' : 'თვიური'} თანხა`,
              `${number(statedCount)} ${statedCount === 1 ? 'listing with' : 'listings with'} ${period === 'day' ? 'daily' : 'monthly'} pay`,
            )}
            <small>
              {t(
                `${categories.length} კატეგორია · ${available} მიმართულებაზე საკმარისი მონაცემია`,
                `${categories.length} categories · ${available} salary comparisons available`,
              )}
            </small>
          </span>
          {period === 'day' && (
            <Link
              className="ds-btn ds-btn--primary salary-daily-link"
              href={vacanciesHref}
              prefetch={false}
            >
              {t('დღიური ვაკანსიების ნახვა', 'Browse daily-pay jobs')}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
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
                    `Based on ${number(sample.count)} ${sample.count === 1 ? 'listing' : 'listings'}`,
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
                `${number(period === 'day' ? selected.dayCount : selected.total)} აქტიური ვაკანსია`,
                `${number(period === 'day' ? selected.dayCount : selected.total)} active ${(period === 'day' ? selected.dayCount : selected.total) === 1 ? 'job' : 'jobs'}`,
              )}
            </span>
            <Link
              className="ds-btn ds-btn--primary"
              href={vacanciesHref}
              prefetch={false}
            >
              {period === 'day'
                ? t('დღიური ვაკანსიების ნახვა', 'Browse daily-pay jobs')
                : t('ვაკანსიების ნახვა', 'Browse jobs')}
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
                `${filtered.length} results · Amounts in GEL`,
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
            {filtered.length > 0 && (
              <div className="salary-table-head" aria-hidden="true">
                <span>{t('მიმართულება', 'Category / profession')}</span>
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
            )}
            <ul>
              {(expanded ? filtered : filtered.slice(0, 12)).map((role) => {
                const s = role[period];
                return (
                  <li key={role.slug}>
                    <Link
                      href={`/salaries/${role.slug}${period === 'day' ? '?period=day' : ''}`}
                      className="salary-row"
                      prefetch={false}
                    >
                      <div className="salary-role">
                        <span className="salary-role-icon" aria-hidden="true">
                          <CategoryIcon category={role.group} size={18} />
                        </span>
                        <div className="salary-role-copy">
                          <strong>{translateUi(role.label, locale)}</strong>
                          {role.kind === 'category' ? (
                            <span>{t('კატეგორია', 'Category')}</span>
                          ) : (
                            !group &&
                            role.group && (
                              <span>{translateUi(role.group, locale)}</span>
                            )
                          )}
                          <span>
                            {t(
                              `${number(role.total)} ვაკანსია`,
                              `${number(role.total)} ${role.total === 1 ? 'job' : 'jobs'}`,
                            )}
                          </span>
                        </div>
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
                        {(period === 'month'
                          ? role.monthCount
                          : role.dayCount) > 0 ? (
                          <>
                            <b>
                              {number(
                                period === 'month'
                                  ? role.monthCount
                                  : role.dayCount,
                              )}
                            </b>
                            <span>
                              {t(
                                'განცხადება',
                                (period === 'month'
                                  ? role.monthCount
                                  : role.dayCount) === 1
                                  ? 'listing'
                                  : 'listings',
                              )}
                            </span>
                          </>
                        ) : (
                          <span>{t('არ არის მითითებული', 'Not stated')}</span>
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
                  `Show ${filtered.length - 12} more ${filtered.length - 12 === 1 ? 'result' : 'results'}`,
                )}
                <ChevronDown size={16} />
              </button>
            )}
            {!filtered.length && (
              <div className="salary-empty">
                <span className="salary-empty-icon">
                  <CategoryIcon category={group} size={24} />
                </span>
                <h2>
                  {t(
                    query.trim()
                      ? 'ამ სახელით პროფესია ვერ მოიძებნა'
                      : period === 'day'
                        ? 'დღიური მონაცემები ჯერ არასაკმარისია'
                        : 'თვიური მონაცემები ჯერ არასაკმარისია',
                    query.trim()
                      ? 'No matching categories or professions'
                      : period === 'day'
                        ? 'Not enough daily pay data yet'
                        : 'Not enough monthly pay data yet',
                  )}
                </h2>
                <p>
                  {query.trim()
                    ? t(
                        'სცადე სხვა დასახელება ან გაასუფთავე ძიება.',
                        'Try another name or clear the search.',
                      )
                    : t(
                        'სტატისტიკისთვის კატეგორიაში ან პროფესიაში სულ მცირე 8 განცხადების ანაზღაურება უნდა იყოს მითითებული.',
                        'Statistics require stated pay in at least eight active listings for a category or profession.',
                      )}
                </p>
                <div className="salary-empty-actions">
                  <button
                    className="ds-btn ds-btn--secondary"
                    onClick={() => {
                      setQuery('');
                      setShowAll(true);
                    }}
                  >
                    {query.trim()
                      ? t('ძიების გასუფთავება', 'Clear search')
                      : t('პროფესიების ნახვა', 'Browse professions')}
                  </button>
                  {!query.trim() && period === 'day' && (
                    <button
                      type="button"
                      className="ds-btn ds-btn--ghost"
                      onClick={() => setPeriod('month')}
                    >
                      {t('თვიურის ნახვა', 'View monthly pay')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {(detail ? !!sample : filtered.some((role) => !!role[period])) && (
        <p className="salary-reading-note">
          {t(
            'ზოლი აჩვენებს განცხადებების შუა 50%-ის დიაპაზონს, წერტილი — მედიანას. ანუ თანხების ნახევარი ამ მაჩვენებელზე დაბალია, ნახევარი — მაღალი.',
            'The bar shows the middle 50% of stated amounts; the dot marks the median. Half the amounts are below that value and half above.',
          )}
        </p>
      )}
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
              'Amounts come from active JOBX vacancies collected from employment websites or posted by employers. Each vacancy is counted once within a category or profession. We use the same categories and title matching as the job catalogue, across all cities.',
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
