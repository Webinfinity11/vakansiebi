import type { Metadata } from 'next';
import { siteName } from './site-brand';
import { siteUrl, shareImage } from './seo';

export function contentMetadata(
  path: string,
  heading: string,
  description: string,
): Metadata {
  const title = `${heading} | ${siteName}`;
  return {
    title,
    description,
    alternates: { canonical: siteUrl + path },
    openGraph: {
      title,
      description,
      url: siteUrl + path,
      siteName,
      type: 'website',
      locale: 'ka_GE',
      images: [shareImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [shareImage.url],
    },
  };
}
