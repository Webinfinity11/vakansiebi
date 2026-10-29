import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { siteName } from '@/lib/site-brand';
import { siteUrl, shareImage } from '@/lib/seo';
import { publicBlogPost } from '@/lib/server/blog';
import { BlogArticleView } from '../article-view';

// Database publication must become visible without a website build.
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = await publicBlogPost((await params).slug);
  if (!post) notFound();
  const image = post.cover
    ? {
        url: post.cover.src,
        width: post.cover.width,
        height: post.cover.height,
        alt: post.cover.alt,
      }
    : shareImage;
  return {
    title: `${post.title} | ${siteName}`,
    description: post.description,
    alternates: { canonical: `${siteUrl}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${siteUrl}/blog/${post.slug}`,
      type: 'article',
      locale: 'ka_GE',
      siteName,
      images: [image],
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [image],
    },
  };
}
export default async function BlogArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = await publicBlogPost((await params).slug);
  if (!post) notFound();
  return <BlogArticleView post={post} />;
}
