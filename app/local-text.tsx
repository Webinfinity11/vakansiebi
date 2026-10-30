'use client';
import { useUi } from './ui-language';
export type LocalCopy = { ka: string; en: string };
export function LocalText({ ka, en }: LocalCopy) {
  return useUi().locale === 'en' ? en : ka;
}

export function LocalDate({ value }: { value: string }) {
  const { locale } = useUi();
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ka-GE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tbilisi',
  }).format(new Date(value));
}
