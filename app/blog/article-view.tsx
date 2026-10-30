import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { type BlogPost, blogReadingMinutes } from '@/lib/blog';
import { breadcrumbs, jsonLd, siteUrl, shareImage } from '@/lib/seo';
import { siteName } from '@/lib/site-brand';
import { UiText } from '@/app/ui-language';
import { BlogCover } from './blog-cover';
import { LocalDate } from '@/app/local-text';

export function BlogArticleView({
  post,
  preview = false,
}: {
  post: BlogPost;
  preview?: boolean;
}) {
  return (
    <main className="blog-article-main">
      {!preview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbs([
                { name: siteName, path: '/' },
                { name: 'ბლოგი', path: '/blog' },
                { name: post.title, path: `/blog/${post.slug}` },
              ]),
            ),
          }}
        />
      )}
      {!preview && (
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
              author: { '@type': 'Organization', name: siteName, url: siteUrl },
              image: `${siteUrl}${post.cover?.src ?? shareImage.url}`,
              datePublished: post.publishedAt,
              dateModified: post.updatedAt ?? post.publishedAt,
              publisher: {
                '@type': 'Organization',
                name: siteName,
                url: siteUrl,
              },
            }),
          }}
        />
      )}
      <Link className="blog-back" href="/blog" prefetch={false}>
        <ArrowLeft size={16} aria-hidden="true" />
        <UiText>ბლოგზე დაბრუნება</UiText>
      </Link>
      <article lang="ka" className="blog-article">
        <div className="blog-article-hero">
          <div className="blog-article-cover">
            <BlogCover cover={post.cover} eager />
          </div>
          <header>
            <span className="blog-category">
              <UiText>{post.category}</UiText> ·{' '}
              <UiText values={[blogReadingMinutes(post)]}>
                {'{0} წთ წასაკითხად'}
              </UiText>
            </span>
            <h1>{post.title}</h1>
            {!preview && (
              <time className="blog-date" dateTime={post.publishedAt}>
                <LocalDate value={post.publishedAt} />
              </time>
            )}
            <p className="blog-deck">{post.description}</p>
          </header>
        </div>
        <div className="blog-article-layout">
          <nav className="blog-contents" aria-labelledby="blog-contents-title">
            <h2 id="blog-contents-title">
              <UiText>სარჩევი</UiText>
            </h2>
            <ol>
              {post.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="blog-reading-column">
            <p className="blog-takeaway">{post.takeaway}</p>
            <div className="blog-article-body">
              {post.sections.map((section) => (
                <section key={section.id} id={section.id}>
                  <h2>{section.title}</h2>
                  {section.paragraphs.map(({ text }) => (
                    <p key={text}>{text}</p>
                  ))}
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
          </div>
        </div>
      </article>
      <nav className="blog-next" aria-labelledby="blog-next-label">
        <span className="sr-only" id="blog-next-label">
          <UiText>სასარგებლო ბმულები</UiText>
        </span>
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
