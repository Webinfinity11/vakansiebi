import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import {
  blogPost,
  blogPosts,
  blogReadingMinutes,
  blogReviewDate,
} from '@/lib/blog';
import { breadcrumbs, jsonLd, siteUrl } from '@/lib/seo';
import { UiText } from '@/app/ui-language';
import { BlogCover } from '../blog-cover';

export const dynamicParams = false;
export function generateStaticParams() {
  return blogPosts.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = blogPost((await params).slug);
  if (!post) notFound();
  return {
    title: `${post.title} | JOBX`,
    description: post.description,
    alternates: { canonical: `${siteUrl}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${siteUrl}/blog/${post.slug}`,
      type: 'article',
      locale: 'ka_GE',
      images: [
        {
          url: post.cover.src,
          width: post.cover.width,
          height: post.cover.height,
          alt: post.cover.alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [{ url: post.cover.src, alt: post.cover.alt }],
    },
  };
}
export default async function BlogArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = blogPost((await params).slug);
  if (!post) notFound();
  return (
    <main className="blog-article-main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: 'JOBX', path: '/' },
              { name: 'ბლოგი', path: '/blog' },
              { name: post.title, path: `/blog/${post.slug}` },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description,
            inLanguage: 'ka',
            mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
            author: { '@type': 'Organization', name: 'JOBX', url: siteUrl },
            image: `${siteUrl}${post.cover.src}`,
            citation: post.sources.map((source) => source.url),
          }),
        }}
      />
      <Link className="blog-back" href="/blog" prefetch={false}>
        <ArrowLeft size={16} aria-hidden="true" />
        <UiText>ბლოგზე დაბრუნება</UiText>
      </Link>
      <article lang="ka" className="blog-article">
        <div className="blog-article-cover">
          <BlogCover cover={post.cover} eager />
        </div>
        <header>
          <span className="blog-category">
            {post.category} · {blogReadingMinutes(post)} წთ
          </span>
          <h1>{post.title}</h1>
          <p className="blog-deck">{post.description}</p>
          <p className="blog-byline">
            <span>JOBX</span>
            <span>
              წყაროები გადამოწმებულია:{' '}
              <time dateTime={post.reviewedAt}>{blogReviewDate(post)}</time>
            </span>
          </p>
        </header>
        <p className="blog-takeaway">{post.takeaway}</p>
        <nav className="blog-contents" aria-label="სტატიის სარჩევი">
          <h2>სარჩევი</h2>
          <ol>
            {post.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="blog-article-body">
          {post.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs.map(({ text, citation }) => {
                const source =
                  citation &&
                  post.sources.find((item) => item.id === citation.sourceId);
                return (
                  <p key={text}>
                    {text}
                    {source && citation && (
                      <>
                        {' '}
                        <a
                          className="blog-citation"
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {citation.label}
                        </a>
                      </>
                    )}
                  </p>
                );
              })}
              {section.table && (
                <div className="blog-comparison">
                  <table>
                    <caption>{section.table.caption}</caption>
                    <thead>
                      <tr>
                        {section.table.columns.map((column) => (
                          <th key={column} scope="col">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map(([label, ...values]) => (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          {values.map((value, index) => (
                            <td key={index}>{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>{section.table.note}</p>
                </div>
              )}
              {section.checklist && (
                <ol className="blog-checklist">
                  {section.checklist.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
        <section className="blog-sources" aria-labelledby="blog-sources-title">
          <h2 id="blog-sources-title">წყაროები</h2>
          <ul>
            {post.sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
                <p>{source.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </article>
      <nav className="blog-next" aria-label="სასარგებლო ბმულები">
        {post.links.map((link) => (
          <Link
            className="ds-btn ds-btn--secondary"
            key={link.href}
            href={link.href}
            prefetch={false}
          >
            <UiText>{link.label}</UiText>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </main>
  );
}
