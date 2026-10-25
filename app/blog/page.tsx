import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { blogPosts, blogReadingMinutes } from '@/lib/blog';
import { siteUrl, shareImage } from '@/lib/seo';
import { UiText } from '../ui-language';
import { BlogCover } from './blog-cover';

const title = 'ბლოგი — სამსახურის ძიება და სამუშაო პირობები | JOBX';
const description =
  'სტატიები სამსახურის ძიების, დღიური ანაზღაურებისა და ნახევარ განაკვეთზე მუშაობის შესახებ. სამუშაო პირობების განმარტებები და პრაქტიკული რჩევები.';
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteUrl}/blog` },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/blog`,
    type: 'website',
    images: [shareImage],
    locale: 'ka_GE',
  },
};

export default function BlogPage() {
  return (
    <main className="blog-main">
      <header className="blog-intro">
        <h1>
          <UiText>ბლოგი</UiText>
        </h1>
        <p>
          <UiText>
            სტატიები სამსახურის ძიების, ანაზღაურებისა და სამუშაო გრაფიკის
            შესახებ.
          </UiText>
        </p>
      </header>
      <div className="blog-grid">
        {blogPosts.map((post, index) => {
          return (
            <article className="blog-card" key={post.slug}>
              <div className="blog-card-cover">
                <BlogCover cover={post.cover} decorative eager={index === 0} />
              </div>
              <div className="blog-card-content">
                <div className="blog-card-top">
                  <span className="blog-category" lang="ka">
                    {post.category}
                  </span>
                  <span>
                    <UiText values={[blogReadingMinutes(post)]}>
                      {'{0} წთ წასაკითხად'}
                    </UiText>
                  </span>
                </div>
                <div className="blog-card-copy" lang="ka">
                  <h2>
                    <Link href={`/blog/${post.slug}`} prefetch={false}>
                      {post.title}
                    </Link>
                  </h2>
                  <p>{post.description}</p>
                </div>
                <span className="blog-read" aria-hidden="true">
                  <UiText>წაკითხვა</UiText>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </div>
      <section className="blog-search">
        <div>
          <h2>
            <UiText>ვაკანსიები საქართველოში</UiText>
          </h2>
          <p>
            <UiText>აირჩიე ქალაქი, პროფესია და სამუშაო გრაფიკი.</UiText>
          </p>
        </div>
        <Link className="ds-btn ds-btn--primary" href="/" prefetch={false}>
          <UiText>ვაკანსიების ნახვა</UiText>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
