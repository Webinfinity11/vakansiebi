'use client';
import Link from 'next/link';
import Image from 'next/image';
import { invoiceContact, premiumDays, premiumPriceGEL } from '@/lib/billing';
import {
  placementTiers,
  placementLabels,
  introductoryDays,
} from '@/lib/placement';
import {
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { cities, otherCity } from '@/lib/cities';
import { categories } from '@/lib/types';
import {
  maxSubmissionBytes,
  prepareSubmissionLogo,
  submissionLogoSchema,
} from '@/lib/submission-logo';
import {
  employmentOptions,
  workModes,
  submissionDate,
  submissionSchema,
  type JobSubmission,
} from '@/lib/job-submission';

const draftKey = 'jobx-post-job-draft-v2';
const initial = {
  placement: 'vip',
  title: '',
  company: '',
  billingEmail: '',
  logo: '',
  category: '',
  city: 'თბილისი',
  cityOther: '',
  mode: 'ადგილზე',
  employmentType: 'სრული განაკვეთი',
  salaryFrom: '',
  salaryTo: '',
  salaryPeriod: 'თვე',
  salaryBasis: 'ხელზე',
  deadline: '',
  description: '',
  contact: '',
  fax: '',
};
type Values = typeof initial;
type FieldName = keyof Values;
const detailFields: FieldName[] = [
  'logo',
  'salaryFrom',
  'salaryTo',
  'salaryPeriod',
  'salaryBasis',
  'mode',
  'employmentType',
  'deadline',
  'category',
];
const interruptedMessage =
  'გაგზავნა შეწყდა. განცხადება ჩაკეტილია — დააჭირე „ხელახლა გაგზავნას“.';
const retryMessage =
  'კავშირი შეწყდა. მონაცემები შენარჩუნებულია და განცხადება ჩაკეტილია — დააჭირე „ხელახლა გაგზავნას“.';
type SubmissionReceipt = {
  id: string;
  received: true;
  alreadyReceived?: true;
  invoiceUrl?: string;
};
function Field({
  name,
  label,
  error,
  hint,
  children,
  wide = false,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`post-field${wide ? ' post-field-wide' : ''}`}>
      <label htmlFor={`post-${name}`}>{label}</label>
      {children}
      {(error || hint) && (
        <small
          id={`post-${name}-hint`}
          className={error ? 'post-field-error' : ''}
        >
          {error || hint}
        </small>
      )}
    </div>
  );
}
export function PostJobForm() {
  const [values, setValues] = useState<Values>(initial);
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [dateBounds, setDateBounds] = useState({ min: '', max: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoWorking = useRef(false);
  const [sent, setSent] = useState<JobSubmission | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [alreadyReceived, setAlreadyReceived] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [premiumAvailable, setPremiumAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/posting-options', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setPremiumAvailable(d.premiumAvailable === true))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const requestId = useRef('');
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorFocus = useRef('');
  useEffect(() => {
    const timer = setTimeout(() => {
      requestId.current = crypto.randomUUID();
      setDateBounds({
        min: submissionDate(),
        max: submissionDate(new Date(Date.now() + 90 * 86400000)),
      });
      try {
        const stored = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
        // Restore the exact sent payload without time-dependent validation.
        const payload =
          stored?.payload &&
          typeof stored.payload === 'object' &&
          stored.payload.consent === true &&
          typeof stored.payload.requestId === 'string'
            ? (stored.payload as JobSubmission)
            : null;
        if (
          stored &&
          (payload || Date.now() - stored.at < 86400000) &&
          stored.at <= Date.now() &&
          stored.values &&
          typeof stored.values === 'object' &&
          (payload ||
            Object.keys(initial).some(
              (k) =>
                stored.values[k] &&
                stored.values[k] !== initial[k as FieldName],
            ))
        ) {
          const restored = Object.fromEntries(
            Object.keys(initial).map((k) => [
              k,
              typeof stored.values[k] === 'string'
                ? stored.values[k]
                : initial[k as FieldName],
            ]),
          ) as Values;
          if (!submissionLogoSchema.safeParse(restored.logo).success)
            restored.logo = '';
          if (
            restored.city &&
            restored.city !== otherCity &&
            restored.city !== 'დისტანციური' &&
            !cities.some((city) => city === restored.city)
          ) {
            restored.cityOther = restored.city;
            restored.city = otherCity;
          }
          if (restored.city === 'დისტანციური') restored.mode = 'დისტანციური';
          setValues(restored);
          if (
            typeof stored.requestId === 'string' &&
            /^[a-f0-9-]{36}$/.test(stored.requestId)
          )
            requestId.current = stored.requestId;
          if (payload) {
            requestId.current = payload.requestId;
            setSent(payload);
            setConsent(true);
            setMessage(interruptedMessage);
          } else {
            setDraftNote('შენახული მონახაზი აღდგენილია.');
          }
        }
      } catch {
        /* Storage is optional; submission still works. */
      }
      setValues((v) =>
        v.deadline
          ? v
          : {
              ...v,
              deadline: submissionDate(new Date(Date.now() + 30 * 86400000)),
            },
      );
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready || receipt || sent) return;
    if (
      !Object.keys(initial).some(
        (k) => values[k as FieldName] !== initial[k as FieldName],
      )
    ) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
      return;
    }
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            at: Date.now(),
            values,
            requestId: requestId.current,
          }),
        );
        if (values.title || values.description)
          setDraftNote('მონახაზი შენახულია ამ ჩანართში.');
      } catch {
        setDraftNote('მონახაზის შენახვა ბრაუზერში ვერ მოხერხდა.');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [values, ready, receipt, sent]);
  useEffect(() => {
    if (!receipt) return;
    headingRef.current?.focus();
  }, [receipt]);
  useEffect(() => {
    if (busy || sent || !errorFocus.current) return;
    document.getElementById(`post-${errorFocus.current}`)?.focus();
    errorFocus.current = '';
  }, [errors, busy, sent]);

  function change(name: FieldName, value: string) {
    if (busy || sent) return;
    setValues((v) => ({
      ...v,
      [name]: value,
      ...(name === 'city'
        ? {
            mode:
              value === 'დისტანციური'
                ? 'დისტანციური'
                : v.city === 'დისტანციური'
                  ? 'ადგილზე'
                  : v.mode,
          }
        : {}),
    }));
    setErrors((e) => {
      const next = { ...e, [name]: '' };
      if (name === 'city') {
        next.cityOther = '';
        next.mode = '';
      }
      return next;
    });
    setMessage('');
  }
  const locked = busy || !!sent;
  const previewLogo = sent?.logo ?? values.logo;
  async function selectLogo(file: File | undefined) {
    if (!file || locked || logoWorking.current) return;
    logoWorking.current = true;
    setLogoBusy(true);
    try {
      change('logo', await prepareSubmissionLogo(file));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        logo:
          error instanceof Error
            ? error.message
            : 'ლოგოს დამუშავება ვერ მოხერხდა.',
      }));
    } finally {
      logoWorking.current = false;
      setLogoBusy(false);
    }
  }
  const hints: Partial<Record<FieldName, string>> = {
    salaryFrom: 'არასავალდებულო.',
    salaryTo: 'არასავალდებულო.',
    contact: 'ელფოსტა, ტელეფონი ან განაცხადის ბმული — გამოქვეყნდება საჯაროდ',
    description: `${values.description.trim().length.toLocaleString()} / 20 000 · მინიმუმ 30 სიმბოლო`,
  };
  const props = (name: FieldName) => ({
    id: `post-${name}`,
    name,
    value: values[name],
    disabled: locked,
    'aria-invalid': !!errors[name],
    'aria-describedby':
      errors[name] || hints[name] ? `post-${name}-hint` : undefined,
    onInput: (
      e: React.InputEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      if (e.currentTarget.tagName !== 'SELECT')
        change(name, e.currentTarget.value);
    },
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      if (e.currentTarget.tagName === 'SELECT')
        change(name, e.currentTarget.value);
    },
  });
  function showErrors(fields: Record<string, string>) {
    const mapped = Object.fromEntries(
      Object.entries(fields).map(([name, error]) => [
        name === 'city' && values.city === otherCity ? 'cityOther' : name,
        error,
      ]),
    );
    if (detailFields.some((name) => mapped[name])) setDetailsOpen(true);
    const firstInvalid = Array.from(formRef.current?.elements || []).find(
      (element) =>
        element.id.startsWith('post-') && mapped[element.id.slice(5)],
    );
    errorFocus.current =
      firstInvalid?.id.slice(5) || Object.keys(mapped)[0] || '';
    setErrors(mapped);
  }
  function validate() {
    const result = submissionSchema.safeParse({
      ...values,
      city:
        values.city === 'დისტანციური'
          ? ''
          : values.city === otherCity
            ? values.cityOther
            : values.city,
      consent,
      requestId: requestId.current,
    });
    if (!result.success) {
      const fields = Object.fromEntries(
        result.error.issues.map((i) => [String(i.path[0]), i.message]),
      );
      showErrors(fields);
      setMessage('შეამოწმე მონიშნული ველები.');
      return null;
    }
    if (
      new TextEncoder().encode(JSON.stringify(result.data)).length >
      maxSubmissionBytes
    ) {
      showErrors({
        description:
          'განცხადება და ლოგო ერთად მეტისმეტად დიდია. შეამცირე ტექსტი ან მოაცილე ლოგო.',
      });
      setMessage('შეამოწმე მონიშნული ველები.');
      return null;
    }
    setErrors({});
    setMessage('');
    return result.data;
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || logoWorking.current) return;
    const data = sent || validate();
    if (!data) return;
    inFlight.current = true;
    setSent(data);
    setBusy(true);
    setMessage('');
    setDraftNote('');
    try {
      // Save immediately too: a reload after a lost response retries the same request id.
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            at: Date.now(),
            values,
            requestId: requestId.current,
            payload: data,
          }),
        );
      } catch {}
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (
          (response.status === 400 && result.fields) ||
          response.status === 413
        ) {
          setSent(null);
          try {
            sessionStorage.setItem(
              draftKey,
              JSON.stringify({
                at: Date.now(),
                values,
                requestId: requestId.current,
              }),
            );
          } catch {}
          showErrors(result.fields || { description: result.error });
          setMessage(result.error || 'შეამოწმე მონიშნული ველები.');
          return;
        }
        throw new Error(retryMessage);
      }
      const received = result as SubmissionReceipt;
      setReceipt(received.id);
      setAlreadyReceived(received.alreadyReceived === true);
      setInvoiceUrl(
        typeof received.invoiceUrl === 'string' ? received.invoiceUrl : '',
      );
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    } catch {
      setMessage(retryMessage);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <main className="post-job-main">
        <section className="post-success">
          <CheckCircle2 size={48} aria-hidden="true" />
          <p className="post-eyebrow">განცხადება მიღებულია</p>
          <h1 ref={headingRef} tabIndex={-1}>
            განცხადება გაგზავნილია
          </h1>
          <p>
            „{values.title}“ განსახილველად გაიგზავნა. საიტზე ადმინისტრატორის
            დამტკიცების შემდეგ გამოჩნდება.
          </p>
          {alreadyReceived && (
            <p>
              ეს განცხადება უკვე მიღებული იყო პირველი გაგზავნისას; მას შემდეგ
              შეტანილი ცვლილებები არ შენახულა.
            </p>
          )}
          {values.placement === 'vip' && (
            <p>
              მოთხოვნილია VIP განთავსება. თუ ეს კომპანიის პირველი VIP-ია,{' '}
              {introductoryDays} დღე უფასო იქნება — ამას ადმინისტრატორი
              დამტკიცებისას ამოწმებს.
            </p>
          )}
          {invoiceUrl && (
            <div className="post-invoice-callout">
              <strong>
                პრემიუმი · {premiumPriceGEL} ₾ / {premiumDays} დღე
              </strong>
              <p>
                საბანკო რეკვიზიტები და გადარიცხვის დანიშნულება იხილე ინვოისში.
                განთავსება გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების
                შემდეგ.
              </p>
              <Link className="post-primary" href={invoiceUrl}>
                ინვოისის ნახვა
              </Link>
              <p>
                ინვოისის ასლი ავტომატურად იგზავნება განაცხადში მითითებულ
                ელფოსტაზე. დახმარებისთვის დარეკე:{' '}
                <a href={`tel:${invoiceContact.telephone}`}>
                  {invoiceContact.phone}
                </a>
                .
              </p>
            </div>
          )}
          <small>განაცხადის ნომერი: {receipt}</small>
          <div className="post-actions">
            <Link href="/" className="post-primary">
              ვაკანსიებზე დაბრუნება <ArrowRight size={18} />
            </Link>
            <button
              type="button"
              className="post-secondary"
              onClick={() => {
                requestId.current = crypto.randomUUID();
                setValues({
                  ...initial,
                  deadline: submissionDate(
                    new Date(Date.now() + 30 * 86400000),
                  ),
                });
                setDetailsOpen(false);
                setConsent(false);
                setReceipt('');
                setSent(null);
                setAlreadyReceived(false);
                setInvoiceUrl('');
                setMessage('');
                setDraftNote('');
              }}
            >
              ახალი განცხადების დამატება
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="post-job-main">
      <Link className="post-back" href="/">
        <ArrowLeft size={16} /> ვაკანსიებზე დაბრუნება
      </Link>
      <div className="post-intro">
        <Image
          className="post-brand-mark"
          src="/brand/jobx-mark.png"
          alt=""
          width={56}
          height={56}
        />
        <h1 ref={headingRef} tabIndex={-1}>
          განცხადების დამატება
        </h1>
        <p>განცხადება გამოქვეყნდება შემოწმების შემდეგ.</p>
      </div>
      <div className="post-layout">
        <form
          ref={formRef}
          onSubmit={submit}
          noValidate
          aria-label="განცხადების დამატება"
          aria-busy={busy}
        >
          <section className="post-section">
            <p className="post-section-note">
              სავალდებულო ველები აღნიშნულია *-ით.
            </p>
            <div className="post-grid">
              <Field
                name="title"
                label="პოზიციის დასახელება *"
                error={errors.title}
                wide
              >
                <input
                  {...props('title')}
                  required
                  maxLength={120}
                  placeholder="მაგ. გაყიდვების კონსულტანტი"
                  autoComplete="off"
                />
              </Field>
              <Field
                name="company"
                label="კომპანიის დასახელება *"
                error={errors.company}
              >
                <input
                  {...props('company')}
                  required
                  maxLength={160}
                  autoComplete="organization"
                />
              </Field>
              <Field name="city" label="ქალაქი *" error={errors.city}>
                <select {...props('city')} required>
                  {cities.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                  <option>დისტანციური</option>
                  <option>{otherCity}</option>
                </select>
              </Field>
              {values.city === otherCity && (
                <Field
                  name="cityOther"
                  label="დასახლების სახელი *"
                  error={errors.cityOther}
                >
                  <input
                    {...props('cityOther')}
                    required
                    maxLength={100}
                    autoComplete="address-level2"
                  />
                </Field>
              )}
              <Field
                name="description"
                label="ვაკანსიის აღწერა *"
                error={errors.description}
                hint={hints.description}
                wide
              >
                <textarea
                  {...props('description')}
                  required
                  minLength={30}
                  maxLength={20000}
                  rows={7}
                  placeholder={
                    'რას გააკეთებს გუნდის ახალი წევრი?\n\nმოვალეობები\n• ...\n\nმოთხოვნები\n• ...\n\nგრაფიკი და დამატებითი პირობები\n• ...'
                  }
                />
              </Field>
              <Field
                name="contact"
                label="როგორ მოგმართონ კანდიდატები *"
                error={errors.contact}
                hint={hints.contact}
                wide
              >
                <input
                  {...props('contact')}
                  required
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  maxLength={2000}
                  placeholder="hr@company.ge · +995 5XX XX XX XX · https://…"
                />
              </Field>
            </div>
          </section>
          <details
            className="post-section post-details"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            <summary>დამატებითი დეტალები (არასავალდებულო)</summary>
            <div className="post-grid">
              <Field
                name="logo"
                label="კომპანიის ლოგო"
                error={errors.logo}
                hint="PNG, JPEG ან WebP · მაქსიმუმ 10 MB. ლოგო ავტომატურად შემცირდება."
                wide
              >
                <div className="post-logo-row" aria-busy={logoBusy}>
                  <span className="post-logo-preview">
                    {previewLogo &&
                    submissionLogoSchema.safeParse(previewLogo).success ? (
                      <Image
                        src={previewLogo}
                        alt="კომპანიის ლოგოს წინასწარი ნახვა"
                        width={64}
                        height={64}
                        unoptimized
                      />
                    ) : (
                      <span aria-hidden="true">+</span>
                    )}
                  </span>
                  <div className="post-logo-actions">
                    <label
                      className="post-secondary post-logo-choose"
                      htmlFor="post-logo"
                    >
                      {logoBusy
                        ? 'მუშავდება…'
                        : values.logo
                          ? 'სხვა ლოგოს არჩევა'
                          : 'ლოგოს არჩევა'}
                      <input
                        id="post-logo"
                        name="logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={locked || logoBusy}
                        aria-invalid={!!errors.logo}
                        aria-describedby="post-logo-hint"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          void selectLogo(file);
                        }}
                      />
                    </label>
                    {previewLogo && (
                      <button
                        className="post-secondary"
                        type="button"
                        disabled={locked || logoBusy}
                        onClick={() => change('logo', '')}
                      >
                        ლოგოს მოცილება
                      </button>
                    )}
                  </div>
                </div>
              </Field>
              <Field
                name="salaryFrom"
                label="ხელფასი (₾) — მინიმუმი"
                error={errors.salaryFrom}
                hint={hints.salaryFrom}
              >
                <input
                  {...props('salaryFrom')}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  placeholder="მაგ. 1000"
                />
              </Field>
              <Field
                name="salaryTo"
                label="ხელფასი (₾) — მაქსიმუმი"
                error={errors.salaryTo}
                hint={hints.salaryTo}
              >
                <input
                  {...props('salaryTo')}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  placeholder="მაგ. 1500"
                />
              </Field>
              <Field
                name="salaryPeriod"
                label="ანაზღაურების სიხშირე"
                error={errors.salaryPeriod}
              >
                <select {...props('salaryPeriod')}>
                  <option value="თვე">თვეში</option>
                  <option value="დღე">დღეში</option>
                </select>
              </Field>
              <Field
                name="salaryBasis"
                label="ანაზღაურების ტიპი"
                error={errors.salaryBasis}
              >
                <select {...props('salaryBasis')}>
                  <option value="ხელზე">ხელზე</option>
                  <option value="დარიცხული">დარიცხული</option>
                </select>
              </Field>
              <Field name="mode" label="მუშაობის ფორმატი" error={errors.mode}>
                <select
                  {...props('mode')}
                  disabled={locked || values.city === 'დისტანციური'}
                >
                  {workModes.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field
                name="employmentType"
                label="დასაქმების ტიპი"
                error={errors.employmentType}
              >
                <select {...props('employmentType')}>
                  {employmentOptions.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field
                name="deadline"
                label="განაცხადების ბოლო ვადა"
                error={errors.deadline}
              >
                <input
                  {...props('deadline')}
                  type="date"
                  min={dateBounds.min || undefined}
                  max={dateBounds.max || undefined}
                />
              </Field>
              <Field name="category" label="კატეგორია" error={errors.category}>
                <select {...props('category')}>
                  <option value="">ავტომატურად (სათაურის მიხედვით)</option>
                  {categories.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
          </details>
          <fieldset className="post-section post-plans">
            <legend>განთავსება</legend>
            <div className="post-plan-pills">
              {placementTiers.map((t) => (
                <label
                  key={t}
                  className={values.placement === t ? 'is-selected' : undefined}
                >
                  <input
                    type="radio"
                    name="placement"
                    value={t}
                    checked={values.placement === t}
                    onChange={() => change('placement', t)}
                    disabled={locked || (t === 'premium' && !premiumAvailable)}
                  />
                  <span>
                    {placementLabels[t]} ·{' '}
                    {t === 'premium' ? `${premiumPriceGEL} ₾` : 'უფასო'}
                    {t === 'premium' && !premiumAvailable ? ' · მალე' : ''}
                  </span>
                </label>
              ))}
            </div>
            {values.placement === 'vip' && (
              <p className="post-vip-note">
                პირველი VIP {introductoryDays} დღით უფასოა — ერთხელ თითო
                კომპანიაზე; ელიგიბელობა შემოწმებისას დადგინდება.
              </p>
            )}
            {values.placement === 'premium' && (
              <Field
                name="billingEmail"
                label="ელფოსტა ინვოისისთვის *"
                error={errors.billingEmail}
                hint="ინვოისს ამ მისამართზე გამოგიგზავნით. ელფოსტა ვაკანსიაში საჯაროდ არ გამოჩნდება."
                wide
              >
                <input
                  {...props('billingEmail')}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </Field>
            )}
            <details className="post-plan-note">
              <summary>შეთავაზების პირობები</summary>
              <p>
                პირველი VIP განთავსება {introductoryDays} დღით უფასოა — ერთხელ
                თითო კომპანიაზე; შემოწმდება დამტკიცებისას. პრემიუმი ღირს{' '}
                {premiumPriceGEL} ₾ და აქტიურდება ჩარიცხვის დადასტურების შემდეგ.
                VIP-ის {introductoryDays} დღე და პრემიუმის {premiumDays} დღე
                ითვლება განთავსების გააქტიურებიდან. ვადის ამოწურვის შემდეგ
                განცხადება სტანდარტულ რეჟიმში რჩება. თანხა ავტომატურად არ
                ჩამოიჭრება.
              </p>
              <p>
                ნებისმიერი ფილტრისა და დალაგებისას შესაბამისი პრემიუმ
                განცხადებები ჩანს პირველ, VIP — მათ შემდეგ, თითოეული
                გამოქვეყნების თარიღის მიხედვით, უახლესი — ზემოთ.
              </p>
            </details>
          </fieldset>
          <div className="post-honeypot" aria-hidden="true">
            <label>
              Fax
              <input
                name="fax"
                value={values.fax}
                onChange={(e) => change('fax', e.target.value)}
                disabled={locked}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>
          <div className="post-submit-area">
            <label className="post-consent">
              <input
                id="post-consent"
                type="checkbox"
                checked={consent}
                disabled={locked}
                aria-invalid={!!errors.consent}
                aria-describedby={
                  errors.consent ? 'post-consent-error' : undefined
                }
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setErrors((v) => ({ ...v, consent: '' }));
                }}
              />
              <span>
                ვადასტურებ, რომ უფლებამოსილი ვარ და ვეთანხმები საკონტაქტო
                მონაცემების საჯარო გამოქვეყნებას.
              </span>
            </label>
            {errors.consent && (
              <p id="post-consent-error" className="post-field-error">
                {errors.consent}
              </p>
            )}
            {message && (
              <p className="post-message" role="alert">
                {message}
              </p>
            )}
            <div className="post-actions">
              <button
                className="post-primary"
                type="submit"
                disabled={busy || logoBusy || !ready}
              >
                <Send size={17} />
                {busy
                  ? 'იგზავნება…'
                  : sent
                    ? 'ხელახლა გაგზავნა'
                    : 'განცხადების გაგზავნა'}
              </button>
            </div>
            <output className="post-draft-note">
              {busy
                ? 'განცხადება იგზავნება. დაელოდე მიღების დასტურს.'
                : draftNote}
            </output>
          </div>
        </form>
      </div>
    </main>
  );
}
