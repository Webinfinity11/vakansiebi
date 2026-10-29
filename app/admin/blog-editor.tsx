'use client';
import { useEffect, useState } from 'react';
import type { EditorialArticle } from '@/lib/server/blog-editorial';
import { type ArticleDraft, draftPost } from '@/lib/blog-editorial';
import { BlogArticleView } from '../blog/article-view';
import '../blog/blog.css';
import '../content-page.css';
import './blog-editor.css';

export function BlogEditor() {
  const [articles, setArticles] = useState<EditorialArticle[]>([]);
  const [current, setCurrent] = useState<EditorialArticle | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  async function load() {
    try {
      const res = await fetch('/api/admin/blog', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setError('');
      setArticles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ვერ ჩაიტვირთა');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    let active = true;
    void fetch('/api/admin/blog', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (active) {
          setArticles(data);
          setLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setError(error instanceof Error ? error.message : 'ვერ ჩაიტვირთა');
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  function choose(article: EditorialArticle) {
    setCurrent(structuredClone(article));
    setReviewed(false);
    setNotice('');
    setError('');
  }
  function field(
    name: 'title' | 'description' | 'category' | 'takeaway',
    value: string,
  ) {
    if (current) {
      setCurrent({
        ...current,
        content: { ...current.content, [name]: value },
      });
      setReviewed(false);
    }
  }
  async function save(action: 'save' | 'publish' | 'unpublish' | 'reject') {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: current.id,
          revision: current.revision,
          action,
          content: current.content,
          reviewed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrent(data);
      setArticles((all) => all.map((a) => (a.id === data.id ? data : a)));
      setReviewed(false);
      setNotice(
        action === 'publish' ? 'სტატია გამოქვეყნდა.' : 'ცვლილება შენახულია.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'შენახვა ვერ მოხერხდა');
    } finally {
      setBusy(false);
    }
  }
  const status = {
    draft: 'მონახაზი',
    published: 'გამოქვეყნებული',
    rejected: 'უარყოფილი',
  };
  return (
    <div className="blog-editor">
      <p>
        კვირაში 3–4 მონახაზი. ტექსტი და წყაროები გამოქვეყნებამდე გადაამოწმე.
        წყაროები მხოლოდ აქ ჩანს.
      </p>
      {error && (
        <p role="alert" className="blog-editor-error">
          {error}
        </p>
      )}
      {notice && <output>{notice}</output>}
      <button
        className="ds-btn ds-btn--secondary"
        disabled={busy}
        onClick={() => void load()}
      >
        სიის განახლება
      </button>
      {!loaded ? (
        <p>იტვირთება…</p>
      ) : !articles.length && !error ? (
        <p>მონახაზები ჯერ არ არის.</p>
      ) : null}
      <ul className="blog-editor-list">
        {articles.map((a) => (
          <li key={a.id}>
            <button
              disabled={busy}
              onClick={() => choose(a)}
              aria-current={current?.id === a.id ? 'true' : undefined}
            >
              {a.title} <small>{status[a.status]}</small>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <fieldset disabled={busy} className="blog-editor-fields">
          <legend>{status[current.status]}</legend>
          {(['title', 'category', 'description', 'takeaway'] as const).map(
            (key) => (
              <label key={key}>
                {
                  {
                    title: 'სათაური',
                    category: 'თემა',
                    description: 'მოკლე აღწერა',
                    takeaway: 'მთავარი რჩევა',
                  }[key]
                }
                <textarea
                  rows={key === 'takeaway' ? 3 : 2}
                  value={current.content[key]}
                  onChange={(e) => field(key, e.target.value)}
                />
              </label>
            ),
          )}
          <label>
            ბანერი
            <select
              value={current.content.coverKey}
              onChange={(e) => {
                setCurrent({
                  ...current,
                  content: {
                    ...current.content,
                    coverKey: e.target.value as ArticleDraft['coverKey'],
                  },
                });
                setReviewed(false);
              }}
            >
              <option value="none">შეარჩიე თემის შესაბამისი ბანერი</option>
              <option value="cv">რეზიუმე</option>
              <option value="interview">გასაუბრება</option>
              <option value="daily-pay">ანაზღაურება</option>
              <option value="part-time">სწავლა და სამუშაო გრაფიკი</option>
            </select>
          </label>
          {current.content.sections.map((section, index) => (
            <div className="blog-editor-section" key={section.id}>
              <label>
                ქვეთავის სათაური
                <input
                  value={section.title}
                  onChange={(e) => {
                    const sections = structuredClone(current.content.sections);
                    sections[index].title = e.target.value;
                    setCurrent({
                      ...current,
                      content: { ...current.content, sections },
                    });
                    setReviewed(false);
                  }}
                />
              </label>
              <label>
                ტექსტი — აბზაცები გამოყავი ცარიელი ხაზით
                <textarea
                  rows={8}
                  value={section.paragraphs.map((p) => p.text).join('\n\n')}
                  onChange={(e) => {
                    const sections = structuredClone(current.content.sections);
                    sections[index].paragraphs = e.target.value
                      .split('\n\n')
                      .map((text) => ({ text }));
                    setCurrent({
                      ...current,
                      content: { ...current.content, sections },
                    });
                    setReviewed(false);
                  }}
                />
              </label>
              <label>
                სია — თითო პუნქტი ახალ ხაზზე
                <textarea
                  rows={4}
                  value={section.checklist.join('\n')}
                  onChange={(e) => {
                    const sections = structuredClone(current.content.sections);
                    sections[index].checklist = e.target.value
                      ? e.target.value.split('\n')
                      : [];
                    setCurrent({
                      ...current,
                      content: { ...current.content, sections },
                    });
                    setReviewed(false);
                  }}
                />
              </label>
            </div>
          ))}
          <details>
            <summary>კვლევა და ავტომატური შემოწმება</summary>
            <p>
              {current.evidence.review.approved
                ? 'ავტომატური შემოწმება გაიარა; საბოლოოდ ტექსტი თავად გადაამოწმე.'
                : 'ავტომატურმა შემოწმებამ შენიშვნები დატოვა.'}
            </p>
            <ul>
              {current.evidence.review.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            <ul>
              {current.evidence.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
            <pre className="blog-editor-notes">{current.evidence.notes}</pre>
          </details>
          <details>
            <summary>სტატიის წინასწარი ნახვა</summary>
            <BlogArticleView
              post={draftPost(
                current.content,
                current.published_at || current.created_at,
              )}
              preview
            />
          </details>
          <label className="blog-editor-confirm">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            გადავამოწმე ტექსტი, ფაქტები და წყაროები; სტატია მზადაა
            გამოსაქვეყნებლად.
          </label>
          <div className="content-links">
            <button
              className="ds-btn ds-btn--secondary"
              disabled={current.status === 'published'}
              onClick={() => void save('save')}
            >
              შენახვა
            </button>
            <button
              className="ds-btn ds-btn--primary"
              disabled={!reviewed}
              onClick={() => void save('publish')}
            >
              გამოქვეყნება
            </button>
            {current.status === 'published' && (
              <button
                className="ds-btn ds-btn--secondary"
                onClick={() => void save('unpublish')}
              >
                მონახაზად დაბრუნება
              </button>
            )}
            <button
              className="ds-btn ds-btn--secondary"
              onClick={() => void save('reject')}
            >
              უარყოფა
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
