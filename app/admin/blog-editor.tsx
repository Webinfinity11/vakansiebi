'use client';
import { useEffect, useState } from 'react';
import type { EditorialArticle } from '@/lib/server/blog-editorial';
import { type ArticleDraft, draftPost } from '@/lib/blog-editorial';
import { BlogArticleView } from '../blog/article-view';
import '../blog/blog.css';
import '../content-page.css';
import './blog-editor.css';
import { SelectField } from '../select-field';
import {
  Plus,
  Pencil,
  Search,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

export function BlogEditor() {
  const [articles, setArticles] = useState<EditorialArticle[]>([]);
  const [current, setCurrent] = useState<EditorialArticle | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const dirty = !!current && JSON.stringify(current.content) !== savedContent;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function load() {
    try {
      const res = await fetch('/api/admin/blog', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setError('');
      setArticles(data.articles);
      setStorageEnabled(data.storageEnabled);
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
          setArticles(data.articles);
          setStorageEnabled(data.storageEnabled);
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
    if (
      dirty &&
      !window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?')
    )
      return;
    setCurrent(structuredClone(article));
    setSavedContent(JSON.stringify(article.content));
    setReviewed(false);
    setNotice('');
    setError('');
  }
  function create() {
    const now = new Date().toISOString();
    choose({
      id: 'new',
      slug: '',
      title: 'ახალი სტატია',
      status: 'draft',
      revision: 0,
      created_at: now,
      updated_at: now,
      published_at: null,
      content: {
        slug: `statia-${Date.now().toString(36)}`,
        title: '',
        category: '',
        description: '',
        takeaway: '',
        coverKey: 'none',
        sections: [
          {
            id: 'section-1',
            title: '',
            paragraphs: [{ text: '' }],
            checklist: [],
          },
        ],
      },
      evidence: {
        model: 'manual',
        researchedAt: now,
        notes: '',
        sources: [],
        review: { approved: false, issues: [] },
        usage: [],
      },
    });
  }
  function close() {
    if (
      dirty &&
      !window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?')
    )
      return;
    setCurrent(null);
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
        body: JSON.stringify(
          current.id === 'new'
            ? { action: 'create', content: current.content }
            : {
                id: current.id,
                revision: current.revision,
                action,
                content: current.content,
                reviewed,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrent(data);
      setSavedContent(JSON.stringify(data.content));
      setArticles((all) => [
        data,
        ...all.filter((a) => a.id !== current.id && a.id !== data.id),
      ]);
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
      <div className="blog-editor-toolbar">
        {current ? (
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            onClick={close}
            disabled={busy}
          >
            <ArrowLeft size={16} />
            სტატიების სია
          </button>
        ) : (
          <label className="blog-editor-search">
            <Search size={16} aria-hidden="true" />
            <input
              className="ds-input"
              aria-label="სტატიის მოძებნა"
              placeholder="მოძებნე სტატია"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          onClick={create}
          disabled={busy || !storageEnabled}
        >
          <Plus size={16} />
          ახალი სტატია
        </button>
        {!current && (
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            onClick={() => void load()}
            disabled={busy}
            aria-label="სიის განახლება"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>
      {loaded && !storageEnabled && (
        <output className="blog-editor-storage">
          არსებული სტატიები ქვემოთ ჩანს. დამატებისა და ცვლილებების შენახვისთვის
          ბლოგის მართვა გასააქტიურებელია.
        </output>
      )}
      {error && (
        <p role="alert" className="blog-editor-error">
          {error}
        </p>
      )}
      {notice && <output>{notice}</output>}
      {!loaded ? (
        <p>იტვირთება…</p>
      ) : !articles.length && !error ? (
        <p>სტატიები ჯერ არ არის. შექმენი პირველი სტატია.</p>
      ) : null}
      {!current && (
        <ul className="blog-editor-list">
          {articles
            .filter((a) =>
              `${a.title} ${a.content.category}`
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase()),
            )
            .map((a) => (
              <li key={a.id}>
                <button disabled={busy} onClick={() => choose(a)}>
                  <span>
                    <strong>{a.title}</strong>
                    <small>
                      {a.content.category} · {status[a.status]}
                    </small>
                  </span>
                  <span className="blog-editor-edit">
                    <Pencil size={16} aria-hidden="true" />
                    რედაქტირება
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
      {current && (
        <fieldset disabled={busy} className="blog-editor-fields">
          <legend>
            {current.id === 'new' ? 'ახალი სტატია' : current.title}
          </legend>
          <p className="blog-editor-state">
            {status[current.status]}
            {dirty ? ' · შეუნახავი ცვლილებები' : ''}
          </p>
          <div className="content-links blog-editor-actions">
            <label className="blog-editor-confirm">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              გადავამოწმე ტექსტი, ფაქტები და წყაროები; სტატია მზადაა
              გამოსაქვეყნებლად.
            </label>
            <button
              className="ds-btn ds-btn--secondary"
              disabled={!storageEnabled || current.status === 'published'}
              onClick={() => void save('save')}
            >
              {busy ? 'ინახება…' : 'მონახაზის შენახვა'}
            </button>
            <button
              className="ds-btn ds-btn--primary"
              disabled={!storageEnabled || !reviewed || current.id === 'new'}
              onClick={() => void save('publish')}
            >
              {current.status === 'published'
                ? 'ცვლილებების გამოქვეყნება'
                : 'გამოქვეყნება'}
            </button>
            {current.status === 'published' && storageEnabled && (
              <button
                className="ds-btn ds-btn--secondary"
                onClick={() => void save('unpublish')}
              >
                მონახაზად დაბრუნება
              </button>
            )}
            {current.id !== 'new' &&
              current.status !== 'published' &&
              storageEnabled && (
                <button
                  className="ds-btn ds-btn--secondary"
                  onClick={() => void save('reject')}
                >
                  უარყოფა
                </button>
              )}
          </div>
          <div className="blog-editor-meta">
            <label className="blog-editor-wide">
              სტატიის მისამართი
              <input
                value={current.content.slug}
                readOnly={current.id !== 'new'}
                onChange={(event) => {
                  setCurrent({
                    ...current,
                    content: { ...current.content, slug: event.target.value },
                  });
                  setReviewed(false);
                }}
              />
              <small>/blog/{current.content.slug}</small>
            </label>
            {(['title', 'category', 'description', 'takeaway'] as const).map(
              (key) => (
                <label
                  key={key}
                  className={
                    key === 'category'
                      ? 'blog-editor-category'
                      : 'blog-editor-wide'
                  }
                >
                  {
                    {
                      title: 'სათაური',
                      category: 'თემა',
                      description: 'მოკლე აღწერა',
                      takeaway: 'მთავარი რჩევა',
                    }[key]
                  }
                  <textarea
                    aria-label={
                      {
                        title: 'სათაური',
                        category: 'თემა',
                        description: 'მოკლე აღწერა',
                        takeaway: 'მთავარი რჩევა',
                      }[key]
                    }
                    rows={key === 'category' ? 1 : 2}
                    value={current.content[key]}
                    onChange={(e) => field(key, e.target.value)}
                  />
                </label>
              ),
            )}
            <label htmlFor="blog-cover">
              ბანერი
              <SelectField
                id="blog-cover"
                value={current.content.coverKey}
                onChange={(value) => {
                  setCurrent({
                    ...current,
                    content: {
                      ...current.content,
                      coverKey: value as ArticleDraft['coverKey'],
                    },
                  });
                  setReviewed(false);
                }}
                options={[
                  { value: 'none', label: 'აირჩიე ბანერი' },
                  { value: 'cv', label: 'რეზიუმე' },
                  { value: 'interview', label: 'გასაუბრება' },
                  { value: 'daily-pay', label: 'ანაზღაურება' },
                  { value: 'part-time', label: 'სწავლა და სამუშაო გრაფიკი' },
                ]}
              />
            </label>
          </div>
          {current.content.sections.map((section, index) => (
            <details
              className="blog-editor-section"
              key={section.id}
              open={index === 0 || !section.title}
            >
              <summary>
                <ChevronDown size={16} aria-hidden="true" />
                <span>
                  ქვეთავი {index + 1}
                  {section.title ? ` · ${section.title}` : ''}
                </span>
              </summary>
              <div className="blog-editor-section-head">
                <span />
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost ds-btn--sm"
                  disabled={current.content.sections.length === 1}
                  onClick={() => {
                    setCurrent({
                      ...current,
                      content: {
                        ...current.content,
                        sections: current.content.sections.filter(
                          (_, i) => i !== index,
                        ),
                      },
                    });
                    setReviewed(false);
                  }}
                >
                  ქვეთავის წაშლა
                </button>
              </div>
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
                  rows={6}
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
                  rows={3}
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
              {section.table && (
                <details>
                  <summary>ცხრილის რედაქტირება</summary>
                  <label>
                    ცხრილის სათაური
                    <input
                      value={section.table.caption}
                      onChange={(event) => {
                        const sections = structuredClone(
                          current.content.sections,
                        );
                        sections[index].table!.caption = event.target.value;
                        setCurrent({
                          ...current,
                          content: { ...current.content, sections },
                        });
                        setReviewed(false);
                      }}
                    />
                  </label>
                  <div className="blog-editor-table">
                    <table>
                      <thead>
                        <tr>
                          {section.table.columns.map((column, col) => (
                            <th key={col}>
                              <input
                                aria-label={`სვეტი ${col + 1}`}
                                value={column}
                                onChange={(event) => {
                                  const sections = structuredClone(
                                    current.content.sections,
                                  );
                                  sections[index].table!.columns[col] =
                                    event.target.value;
                                  setCurrent({
                                    ...current,
                                    content: { ...current.content, sections },
                                  });
                                  setReviewed(false);
                                }}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, r) => (
                          <tr key={r}>
                            {row.map((cell, col) => (
                              <td key={col}>
                                <input
                                  aria-label={`უჯრა ${r + 1}, ${col + 1}`}
                                  value={cell}
                                  onChange={(event) => {
                                    const sections = structuredClone(
                                      current.content.sections,
                                    );
                                    sections[index].table!.rows[r][col] =
                                      event.target.value;
                                    setCurrent({
                                      ...current,
                                      content: { ...current.content, sections },
                                    });
                                    setReviewed(false);
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label>
                    ცხრილის შენიშვნა
                    <textarea
                      value={section.table.note}
                      onChange={(event) => {
                        const sections = structuredClone(
                          current.content.sections,
                        );
                        sections[index].table!.note = event.target.value;
                        setCurrent({
                          ...current,
                          content: { ...current.content, sections },
                        });
                        setReviewed(false);
                      }}
                    />
                  </label>
                </details>
              )}
            </details>
          ))}
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            disabled={current.content.sections.length >= 20}
            onClick={() => {
              setCurrent({
                ...current,
                content: {
                  ...current.content,
                  sections: [
                    ...current.content.sections,
                    {
                      id: `section-${crypto.randomUUID()}`,
                      title: '',
                      paragraphs: [{ text: '' }],
                      checklist: [],
                    },
                  ],
                },
              });
              setReviewed(false);
            }}
          >
            <Plus size={16} />
            ქვეთავის დამატება
          </button>
          {!!current.evidence.sources.length && (
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
          )}
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
        </fieldset>
      )}
    </div>
  );
}
