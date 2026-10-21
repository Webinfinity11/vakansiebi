'use client';
import { Fragment, useState } from 'react';
import {
  SlidersHorizontal,
  ClipboardList,
  Laptop,
  ShieldCheck,
  Calculator,
  GraduationCap,
  LayoutGrid,
  Handshake,
  Megaphone,
  Truck,
  HandPlatter,
  Stethoscope,
  HardHat,
  Factory,
  Scale,
  Scissors,
  Ellipsis,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { SearchFilters } from '@/lib/personal-space';
import type { SearchMeta } from '@/lib/server/search-plan';
import { categories } from '@/lib/types';
import { cityOptions } from '@/lib/cities';
import { subcategories, subcategoryChoices } from '@/lib/subcategories';
import { Choice } from './choice';
import { SelectField } from './select-field';
import { SalaryFilter } from './salary-filter';
import { employmentLabels, type AdvancedFilters } from './advanced-filters';
const cities = [...cityOptions];
const allSubcategories = '__all__';
const categoryIcons = {
  ყველა: LayoutGrid,
  ტექნოლოგიები: Laptop,
  გაყიდვები: Handshake,
  მარკეტინგი: Megaphone,
  ადმინისტრაცია: ClipboardList,
  ფინანსები: Calculator,
  ლოჯისტიკა: Truck,
  მომსახურება: HandPlatter,
  სამედიცინო: Stethoscope,
  განათლება: GraduationCap,
  მშენებლობა: HardHat,
  დაცვა: ShieldCheck,
  წარმოება: Factory,
  იურიდიული: Scale,
  სილამაზე: Scissors,
  სხვა: Ellipsis,
};

/* The rate as one tap per option; "all" needs no word for the rate twice. */
const employmentChoices = (
  Object.entries(employmentLabels) as [AdvancedFilters['employment'], string][]
).map(
  ([key, label]) =>
    [
      key,
      key === 'all' ? 'ყველა' : key === 'daily' ? 'დღიური სამუშაო' : label,
    ] as const,
);

export function SearchFilterFields({
  value: draft,
  onChange,
  facets = null,
  orderingFacets = facets,
  prefix,
  mobile = prefix === 'mobile',
  showSubcategories = true,
  onReset,
  activeCount = 0,
}: {
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
  facets?: SearchMeta | null;
  orderingFacets?: SearchMeta | null;
  prefix: string;
  mobile?: boolean;
  showSubcategories?: boolean;
  onReset?: () => void;
  activeCount?: number;
}) {
  const [allCategoriesVisible, setAllCategoriesVisible] = useState(false);
  /* Directions in the order the current search fills them, so what was asked
       for leads and a 1,968-vacancy direction is not filed below a 77-vacancy
       one. Read from the last answer, which stays while the next one loads, so
       the list does not jump back to the fixed order and forward again. "სხვა"
       stays last; ties keep the fixed order. */
  const categoryCount = (name: string) =>
    orderingFacets?.categories.find((item) => item.name === name)?.count ?? 0;
  const orderedCategories = [...categories].sort(
    (a, b) =>
      Number(a === 'სხვა') - Number(b === 'სხვა') ||
      categoryCount(b) - categoryCount(a),
  );
  const subcategoryCount = (id: string) =>
    orderingFacets?.subcategories?.find((item) => item.id === id)?.count ?? 0;
  const orderedSubcategories = (category: string) =>
    subcategoryChoices(category).sort(
      (a, b) => subcategoryCount(b.id) - subcategoryCount(a.id),
    );
  const changeCategory = (category: string) =>
    onChange({ ...draft, category, subcategory: undefined });
  const changeCity = (city: string) => onChange({ ...draft, city });
  const changePaid = (paid: boolean) => onChange({ ...draft, paid });
  const changeAdvanced = (next: Partial<AdvancedFilters>) =>
    onChange({ ...draft, ...next });
  const changeRemote = (remote: boolean) => onChange({ ...draft, remote });
  const setSubcategory = (subcategory: string) =>
    onChange({ ...draft, subcategory: subcategory || undefined });
  return (
    <>
      {!mobile && (
        <div className="filter-head">
          <h2>
            <SlidersHorizontal size={16} /> ფილტრები
          </h2>
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--sm"
            onClick={onReset}
            disabled={!activeCount}
          >
            გასუფთავება
          </button>
        </div>
      )}
      <div className="filter-primary-city">
        <h3>ქალაქი</h3>
        <Choice
          label="ყველა ქალაქი"
          mobile={mobile}
          value={draft.city}
          onChange={changeCity}
          options={cities}
        />
      </div>
      {/* Ordered by use (filter events): the city, then pay, which with
            "pay stated" is used more than the field. */}
      <SalaryFilter
        prefix={prefix}
        value={draft}
        onChange={(next) => onChange({ ...draft, ...next })}
      />
      {mobile ? (
        <div className="filter-primary-category">
          <h3>მიმართულება</h3>
          <Choice
            label="ყველა მიმართულება"
            mobile={mobile}
            value={draft.category}
            onChange={changeCategory}
            options={orderedCategories}
          />
        </div>
      ) : (
        <>
          <h3>მიმართულება</h3>
          <div className="category-options">
            {(['ყველა', ...orderedCategories] as const)
              .filter(
                (c, index) =>
                  allCategoriesVisible || index < 8 || c === draft.category,
              )
              .map((c) => {
                const CategoryIcon = categoryIcons[c];
                return (
                  <Fragment key={c}>
                    <label
                      className={`check-row${draft.category === c && draft.subcategory ? ' category-parent-context' : ''}`}
                      htmlFor={`${prefix}-${c}`}
                    >
                      <input
                        type="radio"
                        name={`${prefix}-category`}
                        value={c}
                        id={`${prefix}-${c}`}
                        checked={draft.category === c}
                        onChange={() => changeCategory(c)}
                        onClick={() => {
                          if (draft.category === c && draft.subcategory)
                            setSubcategory('');
                        }}
                      />
                      <CategoryIcon
                        className="category-icon"
                        size={16}
                        aria-hidden="true"
                      />
                      <span>{c === 'ყველა' ? 'ყველა მიმართულება' : c}</span>
                      {facets && (
                        <small className="facet-count">
                          {c === 'ყველა'
                            ? facets.categoryTotal
                            : facets.categories.find((item) => item.name === c)
                                ?.count || 0}
                        </small>
                      )}
                    </label>
                    {/* Opened once its counts have arrived, in their order,
                          rather than in the fixed order and then reshuffled. */}
                    {c === draft.category &&
                      showSubcategories &&
                      subcategories.some((item) => item.category === c) && (
                        <fieldset
                          className="subcategory-options"
                          aria-label={`${c} — ქვემიმართულება`}
                        >
                          {[
                            { id: '', label: 'ყველა პოზიცია' },
                            ...orderedSubcategories(c),
                          ].map((item) => (
                            <label
                              className="check-row"
                              key={item.id}
                              htmlFor={`${prefix}-subcategory-${item.id || 'all'}`}
                              title={
                                item.id
                                  ? undefined
                                  : 'ამ მიმართულების ყველა ვაკანსია, დაუზუსტებელი პოზიციების ჩათვლით'
                              }
                            >
                              <input
                                type="radio"
                                name={`${prefix}-subcategory`}
                                id={`${prefix}-subcategory-${item.id || 'all'}`}
                                value={item.id}
                                checked={(draft.subcategory || '') === item.id}
                                onChange={() => setSubcategory(item.id)}
                              />
                              <span>{item.label}</span>
                              {facets && (
                                <small className="facet-count">
                                  {item.id
                                    ? (facets.subcategories?.find(
                                        (child) => child.id === item.id,
                                      )?.count ?? 0)
                                    : (facets.categories.find(
                                        (parent) => parent.name === c,
                                      )?.count ?? 0)}
                                </small>
                              )}
                            </label>
                          ))}
                        </fieldset>
                      )}
                  </Fragment>
                );
              })}
          </div>
          <button
            className="ds-btn ds-btn--ghost category-expand"
            type="button"
            aria-expanded={allCategoriesVisible}
            onClick={() => setAllCategoriesVisible((value) => !value)}
          >
            {allCategoriesVisible ? 'ნაკლების ჩვენება' : 'ყველა მიმართულება'}
            <span aria-hidden="true">{allCategoriesVisible ? '−' : '+'}</span>
          </button>
        </>
      )}
      {mobile &&
        subcategories.some((item) => item.category === draft.category) && (
          <div className="filter-subcategory">
            <label htmlFor={`${prefix}-subcategory`}>ქვემიმართულება</label>
            <SelectField
              id={`${prefix}-subcategory`}
              value={draft.subcategory || allSubcategories}
              onChange={(next) => {
                const subcategory =
                  next === allSubcategories ? undefined : next;
                onChange({ ...draft, subcategory });
              }}
              options={[
                {
                  value: allSubcategories,
                  label: `ყველა — ${draft.category}`,
                },
                ...orderedSubcategories(draft.category).map((item) => ({
                  value: item.id,
                  label: item.label,
                })),
              ]}
            />
            <p
              className="filter-subcategory-help"
              id={`${prefix}-subcategory-help`}
            >
              დაუზუსტებელი ვაკანსიებიც ჩანს „ყველა“-ში.
            </p>
          </div>
        )}
      <div className="filter-divider" />
      <h3>სამუშაო პირობები</h3>
      <label className="check-row" htmlFor={`${prefix}-remote`}>
        <Checkbox
          id={`${prefix}-remote`}
          checked={draft.remote}
          onCheckedChange={changeRemote}
        />
        დისტანციური
      </label>
      <label className="check-row" htmlFor={`${prefix}-paid`}>
        <Checkbox
          id={`${prefix}-paid`}
          checked={draft.paid}
          onCheckedChange={changePaid}
        />
        ხელფასი მითითებულია
      </label>
      <label className="check-row" htmlFor={`${prefix}-entry-level`}>
        <Checkbox
          id={`${prefix}-entry-level`}
          checked={draft.entryLevel}
          onCheckedChange={(entryLevel) => changeAdvanced({ entryLevel })}
        />
        გამოცდილების გარეშე
      </label>
      {/* Every option in sight, one tap each, as the salary amounts are. */}
      <fieldset className="filter-chips">
        <legend>განაკვეთი</legend>
        {employmentChoices.map(([employment, label]) => (
          <button
            key={employment}
            type="button"
            className="ds-chip"
            aria-pressed={draft.employment === employment}
            onClick={() => changeAdvanced({ employment })}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <p className="filter-help">
        პირობები იფილტრება განცხადებაში მითითებული ინფორმაციით.
      </p>
      <div className="source-note">
        <ShieldCheck size={20} />
        <p>იპოვე აქ. დეტალები გადაამოწმე პირველწყაროზე.</p>
      </div>
    </>
  );
}
