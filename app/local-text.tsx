'use client';
import { useUi } from './ui-language';
export type LocalCopy = { ka: string; en: string };
export function LocalText({ ka, en }: LocalCopy) {
  return useUi().locale === 'en' ? en : ka;
}
