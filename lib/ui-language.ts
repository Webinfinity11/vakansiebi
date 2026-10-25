import { englishUi } from './ui-english';

export type UiLanguage = 'ka' | 'en';

/** Only explicit interface strings are translated. Never pass source vacancy prose here. */
export function translateUi(
  text: string,
  locale: UiLanguage,
  values: readonly (string | number)[] = [],
) {
  const translated =
    locale === 'en' && englishUi[text.trim()] !== undefined
      ? text.replace(text.trim(), () => englishUi[text.trim()])
      : text;
  return translated.replace(/\{(\d+)\}/g, (match, index: string) =>
    values[Number(index)] === undefined ? match : String(values[Number(index)]),
  );
}
