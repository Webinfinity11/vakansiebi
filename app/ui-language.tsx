'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { translateUi, type UiLanguage } from '@/lib/ui-language';
import { englishLandingLink } from '@/lib/ui-landings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const storageKey = 'jobx-ui-language';
const LanguageContext = createContext({
  locale: 'ka' as UiLanguage,
  setLocale: (_locale: UiLanguage) => {},
});

/** A UI preference only: vacancy data, search URLs and CV document language stay intact. */
export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLanguage] = useState<UiLanguage>('ka');
  useEffect(() => {
    const read = () => {
      try {
        setLanguage(localStorage.getItem(storageKey) === 'en' ? 'en' : 'ka');
      } catch {
        /* Storage is optional. */
      }
    };
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) read();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale(next: UiLanguage) {
        setLanguage(next);
        try {
          localStorage.setItem(storageKey, next);
        } catch {
          /* Still works for this visit. */
        }
      },
    }),
    [locale],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useUi() {
  const value = useContext(LanguageContext);
  return useMemo(
    () => ({
      ...value,
      ui: (text: string, values?: readonly (string | number)[]) =>
        translateUi(text, value.locale, values),
    }),
    [value],
  );
}

/** Lets server-rendered pages opt individual interface labels into the preference. */
export function UiText({
  children,
  values,
}: {
  children: string;
  values?: readonly (string | number)[];
}) {
  const { ui } = useUi();
  return ui(children, values);
}

export function UiLandingLinkLabel({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  const { locale } = useUi();
  return locale === 'en' ? englishLandingLink(path, label) : label;
}

export function LanguageToggle() {
  const { locale, setLocale } = useUi();
  return (
    <Select
      value={locale}
      onValueChange={(next) => {
        if (next === 'ka' || next === 'en') setLocale(next);
      }}
    >
      <SelectTrigger
        className="ds-btn ds-btn--secondary site-language"
        aria-label={locale === 'ka' ? 'ენის არჩევა' : 'Choose language'}
      >
        <SelectValue>
          <span className="language-flag" aria-hidden="true">
            {locale === 'ka' ? '🇬🇪' : '🇬🇧'}
          </span>{' '}
          {locale === 'ka' ? 'GE' : 'EN'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="ds-select-menu p-1"
        align="end"
        alignItemWithTrigger={false}
        sideOffset={6}
      >
        <SelectItem
          value="ka"
          className="min-h-11"
          lang="ka"
          aria-label="ქართული"
        >
          <span aria-hidden="true">🇬🇪</span> GE
        </SelectItem>
        <SelectItem
          value="en"
          className="min-h-11"
          lang="en"
          aria-label="English"
        >
          <span aria-hidden="true">🇬🇧</span> EN
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
