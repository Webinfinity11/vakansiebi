'use client';

import Image from 'next/image';
import { flushSync } from 'react-dom';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  accentPresets,
  textPresets,
  contrastRatio,
  cvFonts,
  photoShapes,
  sampleCv,
  cvProgress,
  clearCv,
  cvLanguages,
  cvTemplates,
  cvText,
  emptyCv,
  formatPeriod,
  languageLevels,
  newId,
  readCv,
  writeCv,
  type Cv,
  type LanguageLevel,
} from '../../lib/cv';
import { PhotoEditor } from './photo-editor';
import {
  Phone,
  Mail,
  MapPin,
  Link,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Check,
  Download,
} from 'lucide-react';

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
  type = 'text',
  multiline = false,
  disabled = false,
  wide = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
  wide?: boolean;
}) {
  const props = {
    value,
    placeholder,
    maxLength,
    disabled,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <label className={`cv-field${wide ? ' cv-wide' : ''}`}>
      <span>{label}</span>
      {multiline ? <textarea {...props} /> : <input {...props} type={type} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}

const monthNames = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];
const thisYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 61 }, (_, i) => String(thisYear - i));

/* The browser's month input shows an English calendar and a "--------- ----" mask. Two
   Georgian selects say the same thing plainly. The stored value stays YYYY-MM, and a half
   choice is held here until both halves exist, so the saved record is never half a date. */
function MonthField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(() => {
    const [year = '', month = ''] = value.split('-');
    return { year, month };
  });
  // A complete draft with an empty value means the record was cleared from outside.
  const [year, month] = value
    ? value.split('-')
    : draft.year && draft.month
      ? ['', '']
      : [draft.year, draft.month];
  function set(next: { year: string; month: string }) {
    setDraft(next);
    onChange(next.year && next.month ? `${next.year}-${next.month}` : '');
  }
  return (
    <fieldset className="cv-field cv-month" disabled={disabled}>
      <legend>{label}</legend>
      <div>
        <select
          aria-label={`${label}: თვე`}
          value={month}
          onChange={(event) => set({ year, month: event.target.value })}
        >
          <option value="">თვე</option>
          {monthNames.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: წელი`}
          value={year}
          onChange={(event) => set({ year: event.target.value, month })}
        >
          <option value="">წელი</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

/* A native colour input renders as a bare square that reads as a stray block. It stays the
   control — invisible, over the swatch — so the platform picker still opens. */
function CustomColor({
  label,
  value,
  active,
  onChange,
}: {
  label: string;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="cv-custom-color"
      title={label}
      data-active={active || undefined}
      style={{ '--swatch': value } as CSSProperties}
    >
      <span className="cv-custom-color-dot" aria-hidden="true">
        {active ? <Check size={16} /> : <Plus size={16} />}
      </span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Section({
  title,
  children,
  open,
  complete,
  onToggle,
  id,
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  complete: boolean;
  onToggle: () => void;
  id: string;
}) {
  return (
    <section className="cv-section">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`cv-section-${id}`}
          onClick={onToggle}
        >
          <span>{title}</span>
          {complete && <Check className="cv-complete" size={18} />}
          <ChevronDown size={18} className={open ? 'cv-chevron-open' : ''} />
        </button>
      </h2>
      <div id={`cv-section-${id}`} hidden={!open} className="cv-section-body">
        {children}
      </div>
    </section>
  );
}

function BulletLines({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((line) => line.trim().replace(/^[•*–-]\s+/, ''))
    .filter(Boolean);
  return lines.length ? (
    <ul className="cv-document-bullets">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  ) : null;
}

export function CvSheet({
  cv,
  samplePhoto = false,
}: {
  cv: Cv;
  samplePhoto?: boolean;
}) {
  const photo = cv.photo || (samplePhoto ? '/cv-sample-photo.svg' : '');
  const t = cvText[cv.language];
  const experience = cv.experience.filter(
    (item) =>
      item.role || item.company || item.description || item.from || item.to,
  );
  const education = cv.education.filter(
    (item) =>
      item.degree || item.school || item.description || item.from || item.to,
  );
  const languages = cv.languages.filter((item) => item.name.trim());
  const levels = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 5, native: 5 };
  return (
    <article
      className="cv-page"
      data-template={cv.template}
      data-font={cv.font}
      data-photo-shape={cv.photoShape}
      style={
        { '--cv-accent': cv.accent, '--cv-text': cv.textColor } as CSSProperties
      }
      lang={cv.language}
    >
      <header className="cv-document-header">
        <div className="cv-identity">
          {cv.fullName && <h1>{cv.fullName}</h1>}
          {cv.title && <p className="cv-document-title">{cv.title}</p>}
        </div>
      </header>
      {photo &&
        (cv.showPhoto || (!cv.photo && samplePhoto)) &&
        cv.template !== 'compact' && (
          <div className="cv-document-photo">
            <Image src={photo} width={112} height={112} alt="" unoptimized />
          </div>
        )}
      <div className="cv-document-contact">
        {(
          [
            { key: 'phone', Icon: Phone },
            { key: 'email', Icon: Mail },
            { key: 'city', Icon: MapPin },
            { key: 'link', Icon: Link },
          ] as const
        ).map(
          ({ key, Icon }) =>
            cv[key] && (
              <div key={key}>
                <Icon size={13} aria-hidden="true" />
                {key === 'link' && /^https?:\/\//i.test(cv.link) ? (
                  <a href={cv.link} target="_blank" rel="noreferrer">
                    {cv.link}
                  </a>
                ) : (
                  <span>{cv[key]}</span>
                )}
              </div>
            ),
        )}
      </div>
      <div className="cv-document-main">
        {cv.summary.trim() && (
          <section>
            <h2>{t.summary}</h2>
            <p className="cv-document-summary">{cv.summary}</p>
          </section>
        )}
        {experience.length > 0 && (
          <section>
            <h2>{t.experience}</h2>
            {experience.map((item) => (
              <div className="cv-document-entry" key={item.id}>
                <div className="cv-entry-heading">
                  <div>
                    <h3>{item.role}</h3>
                    <p className="cv-organization">{item.company}</p>
                  </div>
                  <span className="cv-period">
                    {formatPeriod(
                      item.from,
                      item.to,
                      item.current,
                      cv.language,
                    )}
                  </span>
                </div>
                <BulletLines text={item.description} />
              </div>
            ))}
          </section>
        )}
        {education.length > 0 && (
          <section>
            <h2>{t.education}</h2>
            {education.map((item) => (
              <div className="cv-document-entry" key={item.id}>
                <div className="cv-entry-heading">
                  <div>
                    <h3>{item.degree}</h3>
                    <p className="cv-organization">{item.school}</p>
                  </div>
                  <span className="cv-period">
                    {formatPeriod(item.from, item.to, false, cv.language)}
                  </span>
                </div>
                <BulletLines text={item.description} />
              </div>
            ))}
          </section>
        )}
      </div>
      {cv.skills.length > 0 && (
        <section className="cv-document-skills">
          <h2>{t.skills}</h2>
          <ul>
            {cv.skills.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {languages.length > 0 && (
        <section className="cv-document-languages">
          <h2>{t.languages}</h2>
          <ul>
            {languages.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{t.languageLevels[item.level]}</span>
                </div>
                <div className="cv-language-dots" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} data-filled={i < levels[item.level]} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Preview({
  cv,
  samplePhoto,
  view,
}: {
  cv: Cv;
  samplePhoto: boolean;
  view: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.65, height: 1123 });
  useEffect(() => {
    const outer = container.current,
      inner = paper.current;
    if (!outer || !inner) return;
    const measure = () => {
      const page = inner.querySelector('article');
      if (outer.clientWidth && page)
        setSize({
          scale: Math.min(1, outer.clientWidth / 794),
          height: Math.max(1123, page.scrollHeight),
        });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    if (inner.firstElementChild) observer.observe(inner.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [cv, view]);
  return (
    <aside className="cv-preview" aria-label={cvText.ka.preview}>
      <div className="cv-preview-heading">
        <span>{cvText.ka.preview}</span>
        <span>A4</span>
      </div>
      <div
        ref={container}
        className="cv-preview-viewport"
        style={
          {
            '--cv-scale': size.scale,
            height: size.height * size.scale,
          } as CSSProperties
        }
      >
        <div ref={paper} className="cv-preview-paper">
          <CvSheet cv={cv} samplePhoto={samplePhoto} />
          {size.height > 1123 && (
            <div className="cv-page-break">{cvText.ka.pageBreak}</div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function CvBuilder() {
  const [printing, setPrinting] = useState(false);
  const [cv, setCv] = useState<Cv>(() => emptyCv());
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'form' | 'preview'>('form');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [skill, setSkill] = useState('');
  const [photoSource, setPhotoSource] = useState<File | string | null>(null);
  const [openSection, setOpenSection] = useState('contact');
  const dirty = useRef(false);

  const t = cvText.ka;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setCv(readCv(window.localStorage) ?? emptyCv('ka'));
      } catch {
        setError(cvText.ka.storageError);
      }
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || !dirty.current) return;
    const timer = window.setTimeout(() => {
      try {
        writeCv(window.localStorage, cv);
        setStatus(cvText.ka.saved);
      } catch {
        setError(cvText.ka.storageError);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [cv, mounted]);

  useEffect(() => {
    const beforePrint = () => flushSync(() => setPrinting(true));
    const afterPrint = () => setPrinting(false);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  function printCv() {
    flushSync(() => setPrinting(true));
    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  function update(patch: Partial<Cv>) {
    dirty.current = true;
    setStatus('');
    setCv((value) => ({ ...value, ...patch }));
  }
  function clear() {
    if (!window.confirm(t.clearConfirm)) return;
    setPhotoSource(null);
    dirty.current = false;
    try {
      clearCv(window.localStorage);
      setError('');
    } catch {
      setError(t.storageError);
    }
    setCv(emptyCv(cv.language));
    setSkill('');
    setStatus(t.cleared);
  }
  function addSkills(value: string) {
    const additions = value
      .split(',')
      .map((item) => item.trim().slice(0, 60))
      .filter(Boolean);
    update({ skills: [...new Set([...cv.skills, ...additions])].slice(0, 40) });
    setSkill('');
  }
  function entryActions(
    key: 'experience' | 'education' | 'languages',
    index: number,
  ) {
    const items = cv[key];
    const move = (offset: number) => {
      const next = [...items];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      update({ [key]: next });
    };
    return (
      <div className="cv-entry-actions">
        <button
          type="button"
          aria-label={t.remove}
          onClick={() => update({ [key]: items.filter((_, i) => i !== index) })}
        >
          <Trash2 size={16} />
        </button>
        <button
          type="button"
          aria-label={t.moveUp}
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          aria-label={t.moveDown}
          disabled={index === items.length - 1}
          onClick={() => move(1)}
        >
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  if (!mounted) return <main className="cv-main" aria-busy="true" />;
  const contactKeys = [
    'fullName',
    'title',
    'phone',
    'email',
    'city',
    'link',
  ] as const;
  const limits = {
    fullName: 120,
    title: 120,
    phone: 32,
    email: 120,
    city: 80,
    link: 200,
  };
  const experiences = cv.experience.filter(
    (item) =>
      item.company || item.role || item.description || item.from || item.to,
  );
  const education = cv.education.filter(
    (item) =>
      item.school || item.degree || item.description || item.from || item.to,
  );
  const languages = cv.languages.filter((item) => item.name.trim());
  const skills = cv.skills.filter((item) => item.trim());
  const sample = sampleCv(cv.language);
  const displayCv: Cv = { ...cv };
  for (const key of [...contactKeys, 'summary'] as const) {
    displayCv[key] = cv[key].trim() ? cv[key] : sample[key];
  }
  displayCv.experience = cv.experience.length
    ? cv.experience
    : sample.experience;
  displayCv.education = cv.education.length ? cv.education : sample.education;
  displayCv.skills = cv.skills.length ? cv.skills : sample.skills;
  displayCv.languages = cv.languages.length ? cv.languages : sample.languages;
  const canPrint = cvProgress(cv) > 0;
  const completion = {
    contact: Boolean(cv.fullName && (cv.email || cv.phone)),
    summary: Boolean(cv.summary.trim()),
    experience: experiences.length > 0,
    education: education.length > 0,
    skills: skills.length >= 3,
    languages: languages.length > 0,
  };
  return (
    <main className="cv-main">
      <div className="cv-intro">
        <h1>{t.heading}</h1>
        <p className="cv-note">{t.intro}</p>
      </div>
      <div className="cv-toolbar">
        <div className="cv-segment" aria-label="რეზიუმეს ენა">
          <span>რეზიუმეს ენა:</span>
          {cvLanguages.map((language) => (
            <button
              key={language}
              type="button"
              aria-pressed={cv.language === language}
              onClick={() => update({ language, showPhoto: language === 'ka' })}
            >
              {language === 'ka' ? 'ქართული' : 'English'}
            </button>
          ))}
        </div>
        <div className="cv-actions">
          <button
            className="cv-primary"
            type="button"
            disabled={!canPrint}
            aria-describedby={!canPrint ? 'cv-print-hint' : undefined}
            onClick={printCv}
          >
            <Download size={17} />
            {t.print}
          </button>
          <button type="button" onClick={clear}>
            {t.clear}
          </button>
        </div>
      </div>
      {!canPrint && (
        <p id="cv-print-hint" className="cv-note">
          {t.printHint}
        </p>
      )}
      <output className="cv-message">{error || status}</output>
      <div className="cv-mobile-tabs cv-segment">
        <button
          type="button"
          aria-pressed={view === 'form'}
          onClick={() => setView('form')}
        >
          ფორმა
        </button>
        <button
          type="button"
          aria-pressed={view === 'preview'}
          onClick={() => setView('preview')}
        >
          {t.preview}
        </button>
      </div>
      <div className="cv-layout" data-view={view}>
        <div className="cv-editor-column">
          <section className="cv-gallery" aria-label={t.gallery}>
            <div className="cv-gallery-heading">
              <h2>{t.gallery}</h2>
            </div>
            <div className="cv-gallery-track">
              {cvTemplates.map((template) => (
                <div className="cv-template-option" key={template}>
                  <button
                    type="button"
                    className="cv-template"
                    title={
                      template === 'modern'
                        ? `${t.templates[template].name} — ${t.atsNote}`
                        : t.templates[template].name
                    }
                    aria-label={t.templates[template].name}
                    aria-pressed={cv.template === template}
                    onClick={() => {
                      update({ template });
                      if (window.matchMedia('(max-width: 760px)').matches) {
                        setView('preview');
                      }
                    }}
                    style={
                      { '--cv-selected-accent': cv.accent } as CSSProperties
                    }
                  >
                    <span className="cv-template-thumbnail" aria-hidden="true">
                      <span className="cv-template-paper">
                        <CvSheet cv={{ ...displayCv, template }} samplePhoto />
                      </span>
                    </span>
                    {cv.template === template && (
                      <span className="cv-template-check" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="cv-style" aria-label={t.accent}>
            <div className="cv-style-colors">
              <h2>{t.accent}</h2>
              <div className="cv-swatches">
                {accentPresets.map((accent) => (
                  <button
                    type="button"
                    key={accent}
                    aria-label={`${t.accent} ${accent}`}
                    aria-pressed={cv.accent.toLowerCase() === accent}
                    onClick={() => update({ accent })}
                    style={{ '--swatch': accent } as CSSProperties}
                  >
                    {cv.accent.toLowerCase() === accent && <Check size={16} />}
                  </button>
                ))}
                <CustomColor
                  label={t.customColor}
                  value={cv.accent}
                  active={
                    !(accentPresets as readonly string[]).includes(
                      cv.accent.toLowerCase(),
                    )
                  }
                  onChange={(accent) => update({ accent })}
                />
              </div>
            </div>
            <div className="cv-style-colors">
              <h2>{t.textColor}</h2>
              <div className="cv-swatches">
                {textPresets.map((textColor) => (
                  <button
                    type="button"
                    key={textColor}
                    aria-label={`${t.textColor} ${textColor}`}
                    aria-pressed={cv.textColor.toLowerCase() === textColor}
                    onClick={() => update({ textColor })}
                    style={{ '--swatch': textColor } as CSSProperties}
                  >
                    {cv.textColor.toLowerCase() === textColor && (
                      <Check size={16} />
                    )}
                  </button>
                ))}
                <CustomColor
                  label={`${t.textColor}: ${t.customColor}`}
                  value={cv.textColor}
                  active={
                    !(textPresets as readonly string[]).includes(
                      cv.textColor.toLowerCase(),
                    )
                  }
                  onChange={(textColor) => update({ textColor })}
                />
              </div>
              {contrastRatio(cv.textColor, '#ffffff') < 4.5 && (
                <output className="cv-text-contrast-warning">
                  {t.textContrastWarning}
                </output>
              )}
            </div>
            <div>
              <h2>{t.font}</h2>
              <div className="cv-style-options">
                {cvFonts.map((font) => (
                  <button
                    key={font}
                    type="button"
                    data-font={font}
                    aria-pressed={cv.font === font}
                    onClick={() => update({ font })}
                  >
                    {t.fonts[font]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2>{t.photoShape}</h2>
              <div className="cv-style-options">
                {photoShapes.map((photoShape) => (
                  <button
                    key={photoShape}
                    type="button"
                    aria-pressed={cv.photoShape === photoShape}
                    onClick={() => update({ photoShape })}
                  >
                    {t.photoShapes[photoShape]}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <form
            className="cv-form"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="cv-progress">
              <div>
                <span>{t.progress}</span>
                <strong>{cvProgress(cv)}%</strong>
              </div>
              <progress max={100} value={cvProgress(cv)} />
            </div>
            <p className="cv-note cv-storage-note">{t.storageNote}</p>
            <Section
              title={t.contact}
              id="contact"
              open={openSection === 'contact'}
              complete={completion.contact}
              onToggle={() =>
                setOpenSection(openSection === 'contact' ? '' : 'contact')
              }
            >
              <div className="cv-fields">
                {contactKeys.map((key) => (
                  <Field
                    key={key}
                    label={t[key]}
                    hint={t.hints[key]}
                    value={cv[key]}
                    onChange={(value) => update({ [key]: value })}
                    maxLength={limits[key]}
                    placeholder={t.placeholders[key]}
                    type={
                      key === 'phone'
                        ? 'tel'
                        : key === 'email'
                          ? 'email'
                          : 'text'
                    }
                  />
                ))}
              </div>
              <div
                className="cv-photo-controls"
                data-photo-shape={cv.photoShape}
              >
                {cv.photo && (
                  <Image
                    src={cv.photo}
                    alt=""
                    width={72}
                    height={72}
                    unoptimized
                  />
                )}
                <label className="cv-file-button">
                  {cv.photo ? t.changePhoto : t.choosePhoto}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setPhotoSource(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                {cv.photo && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPhotoSource(cv.photo)}
                    >
                      {t.editPhoto}
                    </button>
                    <button type="button" onClick={() => update({ photo: '' })}>
                      {t.removePhoto}
                    </button>
                  </>
                )}
              </div>
              <label className="cv-check">
                <input
                  type="checkbox"
                  checked={cv.showPhoto}
                  disabled={cv.template === 'compact'}
                  onChange={(event) =>
                    update({ showPhoto: event.target.checked })
                  }
                />
                {t.showPhoto}
              </label>
              {cv.template === 'compact' && (
                <p className="cv-note">{t.templates.compact.description}</p>
              )}
            </Section>
            <Section
              title={t.summary}
              id="summary"
              open={openSection === 'summary'}
              complete={completion.summary}
              onToggle={() =>
                setOpenSection(openSection === 'summary' ? '' : 'summary')
              }
            >
              <Field
                label={t.summary}
                hint={t.hints.summary}
                value={cv.summary}
                onChange={(summary) => update({ summary })}
                maxLength={1500}
                placeholder={t.placeholders.summary}
                multiline
              />
            </Section>
            <Section
              title={t.experience}
              id="experience"
              open={openSection === 'experience'}
              complete={completion.experience}
              onToggle={() =>
                setOpenSection(openSection === 'experience' ? '' : 'experience')
              }
            >
              <p className="cv-note">{t.hints.experience}</p>
              {cv.experience.map((item, index) => {
                const change = (patch: Partial<Cv['experience'][number]>) =>
                  update({
                    experience: cv.experience.map((entry, i) =>
                      i === index ? { ...entry, ...patch } : entry,
                    ),
                  });
                return (
                  <div className="cv-entry" key={item.id}>
                    <div className="cv-fields">
                      {(
                        [
                          'company',
                          'role',
                          'from',
                          'to',
                          'description',
                        ] as const
                      ).map((key) =>
                        key === 'from' || key === 'to' ? (
                          <MonthField
                            key={key}
                            label={t[key]}
                            value={item[key]}
                            onChange={(value) => change({ [key]: value })}
                            disabled={key === 'to' && item.current}
                          />
                        ) : (
                          <Field
                            key={key}
                            label={t[key]}
                            value={item[key]}
                            onChange={(value) => change({ [key]: value })}
                            placeholder={
                              key === 'description'
                                ? 'თითო მიღწევა ახალ ხაზზე'
                                : t.placeholders[key]
                            }
                            maxLength={key === 'description' ? 2000 : 120}
                            multiline={key === 'description'}
                            wide={key === 'description'}
                          />
                        ),
                      )}
                    </div>
                    <label className="cv-check">
                      <input
                        type="checkbox"
                        checked={item.current}
                        onChange={(event) =>
                          change({ current: event.target.checked })
                        }
                      />
                      {t.currentJob}
                    </label>
                    {entryActions('experience', index)}
                  </div>
                );
              })}
              <button
                type="button"
                disabled={cv.experience.length >= 20}
                onClick={() =>
                  update({
                    experience: [
                      ...cv.experience,
                      {
                        id: newId(),
                        company: '',
                        role: '',
                        from: '',
                        to: '',
                        current: false,
                        description: '',
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                {t.add}
              </button>
            </Section>
            <Section
              title={t.education}
              id="education"
              open={openSection === 'education'}
              complete={completion.education}
              onToggle={() =>
                setOpenSection(openSection === 'education' ? '' : 'education')
              }
            >
              <p className="cv-note">{t.hints.education}</p>
              {cv.education.map((item, index) => {
                const change = (patch: Partial<Cv['education'][number]>) =>
                  update({
                    education: cv.education.map((entry, i) =>
                      i === index ? { ...entry, ...patch } : entry,
                    ),
                  });
                return (
                  <div className="cv-entry" key={item.id}>
                    <div className="cv-fields">
                      {(
                        [
                          'school',
                          'degree',
                          'from',
                          'to',
                          'description',
                        ] as const
                      ).map((key) =>
                        key === 'from' || key === 'to' ? (
                          <MonthField
                            key={key}
                            label={t[key]}
                            value={item[key]}
                            onChange={(value) => change({ [key]: value })}
                          />
                        ) : (
                          <Field
                            key={key}
                            label={t[key]}
                            value={item[key]}
                            onChange={(value) => change({ [key]: value })}
                            placeholder={
                              t.placeholders[
                                key === 'description'
                                  ? 'educationDescription'
                                  : key
                              ]
                            }
                            maxLength={key === 'description' ? 1000 : 120}
                            multiline={key === 'description'}
                            wide={key === 'description'}
                          />
                        ),
                      )}
                    </div>
                    {entryActions('education', index)}
                  </div>
                );
              })}
              <button
                type="button"
                disabled={cv.education.length >= 20}
                onClick={() =>
                  update({
                    education: [
                      ...cv.education,
                      {
                        id: newId(),
                        school: '',
                        degree: '',
                        from: '',
                        to: '',
                        description: '',
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                {t.add}
              </button>
            </Section>
            <Section
              title={t.skills}
              id="skills"
              open={openSection === 'skills'}
              complete={completion.skills}
              onToggle={() =>
                setOpenSection(openSection === 'skills' ? '' : 'skills')
              }
            >
              <p className="cv-note">{t.hints.skills}</p>
              <div className="cv-chips">
                {cv.skills.map((item, index) => (
                  <button
                    className="cv-chip"
                    type="button"
                    key={`${item}-${index}`}
                    aria-label={`${t.remove}: ${item}`}
                    onClick={() =>
                      update({
                        skills: cv.skills.filter((_, i) => i !== index),
                      })
                    }
                  >
                    {item} ×
                  </button>
                ))}
              </div>
              <label className="cv-field">
                <span>{t.skills}</span>
                <input
                  value={skill}
                  maxLength={60}
                  disabled={cv.skills.length >= 40}
                  placeholder={t.placeholders.skills}
                  onChange={(event) =>
                    event.target.value.includes(',')
                      ? addSkills(event.target.value)
                      : setSkill(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      addSkills(skill);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                disabled={!skill.trim() || cv.skills.length >= 40}
                onClick={() => addSkills(skill)}
              >
                <Plus size={16} />
                {t.add}
              </button>
            </Section>
            <Section
              title={t.languages}
              id="languages"
              open={openSection === 'languages'}
              complete={completion.languages}
              onToggle={() =>
                setOpenSection(openSection === 'languages' ? '' : 'languages')
              }
            >
              <p className="cv-note">{t.hints.languages}</p>
              {cv.languages.map((item, index) => (
                <div className="cv-entry" key={item.id}>
                  <div className="cv-fields">
                    <Field
                      label={t.name}
                      value={item.name}
                      maxLength={60}
                      placeholder={t.placeholders.name}
                      onChange={(name) =>
                        update({
                          languages: cv.languages.map((entry, i) =>
                            i === index ? { ...entry, name } : entry,
                          ),
                        })
                      }
                    />
                    <label className="cv-field">
                      <span>{t.level}</span>
                      <select
                        value={item.level}
                        onChange={(event) =>
                          update({
                            languages: cv.languages.map((entry, i) =>
                              i === index
                                ? {
                                    ...entry,
                                    level: event.target.value as LanguageLevel,
                                  }
                                : entry,
                            ),
                          })
                        }
                      >
                        {languageLevels.map((level) => (
                          <option key={level} value={level}>
                            {t.languageLevels[level]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {entryActions('languages', index)}
                </div>
              ))}
              <button
                type="button"
                disabled={cv.languages.length >= 10}
                onClick={() =>
                  update({
                    languages: [
                      ...cv.languages,
                      { id: newId(), name: '', level: 'b1' },
                    ],
                  })
                }
              >
                <Plus size={16} />
                {t.add}
              </button>
            </Section>
          </form>
        </div>
        <Preview
          cv={printing ? cv : displayCv}
          samplePhoto={!printing}
          view={view}
        />
      </div>
      {photoSource && (
        <PhotoEditor
          source={photoSource}
          shape={cv.photoShape}
          text={t}
          onCancel={() => setPhotoSource(null)}
          onDone={(photo) => {
            update({ photo });
            setPhotoSource(null);
          }}
        />
      )}
    </main>
  );
}
