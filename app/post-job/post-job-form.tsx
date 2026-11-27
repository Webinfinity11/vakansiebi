'use client';
import { companyJobIssueFields, companyJobIssueMessage } from '@/lib/company-job-steps';
import { JobSteps } from '../company/jobs/job-steps';
import { JobImport, useJobImport } from '../company/jobs/job-import';
import { newCompanyJob, visibleJobDeadline, type CompanyJobForm } from '@/lib/company-job-form';
import { useUi } from '@/app/ui-language';
import Link from 'next/link';
import Image from 'next/image';
import {
  invoiceContact,
  premiumDays,
  premiumPriceGEL,
  paidPlacementPrices,
  vipPriceGEL,
} from '@/lib/billing';
import {
  placementTiers,
  placementLabels,
  type PlacementTier,
} from '@/lib/placement';
import { track } from '@/lib/analytics-client';
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  FileText,
  ImagePlus,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  maxSubmissionBytes,
  prepareSubmissionLogo,
  submissionLogoSchema,
} from '@/lib/submission-logo';
import {
  submissionDate,
  submissionSchema,
  type JobSubmission,
} from '@/lib/job-submission';

const draftKey = 'jobx-post-job-draft-v3';
const importNoteKey = draftKey + ':import';
const importDefaults = newCompanyJob();
const initial = {
  placement: 'standard',
  title: '',
  company: '',
  notificationEmail: '',
  billingEmail: '',
  logo: '',
  category: '',
  city: 'თბილისი',
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
/* The ladder the posting form is climbed by, in order. */
const stages = ['opened', 'started', 'details', 'plans', 'done'] as const;
type PostStage = (typeof stages)[number];
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
  'გაგზავნა შეწყდა. განცხადება ჩაკეტილია. დააჭირე „ხელახლა გაგზავნას“.';
const retryMessage =
  'კავშირი შეწყდა. მონაცემები შენარჩუნებულია და განცხადება ჩაკეტილია. დააჭირე „ხელახლა გაგზავნას“.';
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
  const { ui } = useUi();
  return (
    <div className={`post-field${wide ? ' post-field-wide' : ''}`}>
      <label htmlFor={`post-${name}`}>{ui(label)}</label>
      {children}
      {(error || hint) && (
        <small
          id={`post-${name}-hint`}
          className={error ? 'post-field-error' : ''}
        >
          {ui(error || hint || '')}
        </small>
      )}
    </div>
  );
}
export function PostJobForm({
  initialPlacement,
}: {
  initialPlacement?: PlacementTier;
}) {
  const { ui, locale } = useUi();
  const [values, setValues] = useState<Values>(() => ({
    ...initial,
    placement: initialPlacement ?? initial.placement,
  }));
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoWorking = useRef(false);
  const [sent, setSent] = useState<JobSubmission | null>(null);
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
          // An explicit plan choice updates an editable draft, never a sent payload.
          if (initialPlacement && !payload)
            restored.placement = initialPlacement;
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
            track('post', 'draft_restored');
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
  }, [initialPlacement]);
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

  /* How far this form gets, in step names and nothing else. The counts say
     which step loses people and when they left it; no session, id or text of
     theirs is sent, so a single person is never followed from one step to the
     next — only the steps are counted. */
  const stage = useRef<PostStage>('opened');
  // The form is one page filled in any order, so each step is counted once when it is
  // first reached, even after a later one; only the drop-off point is the furthest step.
  const counted = useRef(new Set<string>());
  const reached = useCallback((step: PostStage) => {
    if (stages.indexOf(step) > stages.indexOf(stage.current))
      stage.current = step;
    if (counted.current.has(step)) return;
    counted.current.add(step);
    track('post', step);
  }, []);
  useEffect(() => {
    track('post', 'opened');
    // Leaving with the form started and unsent is the drop-off worth knowing.
    const leave = () => {
      if (stage.current === 'opened' || stage.current === 'done') return;
      track('post', `left_${stage.current}`);
      stage.current = 'done';
    };
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, []);

  function change(name: FieldName, value: string) {
    if (busy || sent) return;
    if (name in importDefaults) importer.edit(name as keyof CompanyJobForm);
    reached(detailFields.includes(name) ? 'details' : 'started');
    setValues((v) => ({
      ...v,
      [name]: value,

    }));
    setErrors((e) => {
      const next = { ...e, [name]: '' };
      if (name === 'city') {
        next.mode = '';
      }
      return next;
    });
    setMessage('');
  }
  const locked = busy || !!sent;
  const contactUndo = useRef<{ company: string; notificationEmail: string } | null>(null);
  const jobForm: CompanyJobForm = { ...importDefaults, ...values,
    placement: values.placement as CompanyJobForm['placement'],
    category: '', mode: values.mode as CompanyJobForm['mode'],
    employmentType: values.employmentType as CompanyJobForm['employmentType'],
    salaryPeriod: 'თვე', salaryBasis: values.salaryBasis as CompanyJobForm['salaryBasis'],
    contact: values.notificationEmail,
  };
  const importer = useJobImport({ form: jobForm, defaults: importDefaults, noteKey: importNoteKey, disabled: locked,
    onApply: next => {
      if (locked) return;
      reached('details');
      setValues(previous => ({ ...previous, title: next.title, city: next.city, mode: next.mode,
        employmentType: next.employmentType, salaryFrom: next.salaryFrom, salaryTo: next.salaryTo,
        salaryBasis: next.salaryBasis, description: next.description }));
      setErrors({}); setMessage('');
    },
    contacts: {
      // Only empty fields; whatever the person typed stays.
      fill: (found) => {
        const filled: string[] = [];
        const patch: Partial<typeof values> = {};
        if (found.company && !values.company.trim()) { patch.company = found.company.slice(0, 160); filled.push('კომპანიის დასახელება'); }
        if (found.email && !values.notificationEmail.trim()) { patch.notificationEmail = found.email.slice(0, 254); filled.push('ელფოსტა'); }
        if (filled.length) {
          contactUndo.current = { company: values.company, notificationEmail: values.notificationEmail };
          setValues(previous => ({ ...previous, ...patch }));
        }
        return filled;
      },
      undo: () => {
        const previous = contactUndo.current;
        if (previous) setValues(current => ({ ...current, ...previous }));
        contactUndo.current = null;
      },
    },
  });
  const previewLogo = sent?.logo ?? values.logo;
  async function selectLogo(file: File | undefined) {
    if (!file || locked || logoWorking.current) return;
    logoWorking.current = true;
    setLogoBusy(true);
    try {
      change('logo', await prepareSubmissionLogo(file));
      track('post', 'logo_added');
    } catch (error) {
      track('post', 'logo_failed');
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
    contact: 'ელფოსტა, ტელეფონი ან განაცხადის ბმული (გამოქვეყნდება საჯაროდ)',
    description: `${values.description.trim().length.toLocaleString()} / 20 000 · ${ui('მინიმუმ 30 სიმბოლო')}`,
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
  function showErrors(fields: Record<string, string>, serverFields = false) {
    // The API sends field messages without Zod codes. Recover only the shared
    // validation fields; upload, consent and request errors keep their detail.
    const sharedFields = ['title', 'description', 'city', 'mode', 'employmentType', 'salaryFrom', 'salaryTo', 'salaryBasis', 'salaryPeriod', 'deadline', 'category'];
    function message(name: string, error: string) {
      if (name === 'company') return 'მიუთითეთ კომპანიის დასახელება';
      if (name === 'notificationEmail' || name === 'contact') return 'მიუთითეთ სწორი ელფოსტა';
      if (!serverFields || !sharedFields.includes(name)) return error;
      return companyJobIssueMessage(error.includes('მაქსიმუმ')
        ? { code: 'too_big', origin: 'string', maximum: 0, path: [name], message: error }
        : { code: 'custom', path: [name], message: error });
    }
    const mapped = Object.fromEntries(
      Object.entries(fields).map(([name, error]) => [
        name === 'contact' ? 'notificationEmail' : name,
        message(name, error),
      ]),
    );
    const firstInvalid = Array.from(formRef.current?.elements || []).find(
      (element) =>
        element.id.startsWith('post-') && mapped[element.id.slice(5)],
    );
    errorFocus.current =
      firstInvalid?.id.slice(5) || Object.keys(mapped)[0] || '';
    // The field that stopped it, so a form people cannot finish can be found.
    if (errorFocus.current) track('post', `invalid_${errorFocus.current}`);
    setErrors(mapped);
  }
  function validate() {
    const result = submissionSchema.safeParse({
      ...values,
      contact: values.notificationEmail,
      category: '', salaryPeriod: 'თვე',
      deadline: submissionDate(new Date(Date.now() + 30 * 86400000)),
      consent,
      requestId: requestId.current,
    });
    if (!result.success) {
      const shared = result.error.issues.filter(i => String(i.path[0]) in importDefaults);
      const fields = {
        ...Object.fromEntries(result.error.issues.map(i => [String(i.path[0]), i.message])),
        ...companyJobIssueFields(shared),
      };
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
  const choosePlan = () => reached('plans');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || logoWorking.current) return;
    // Once per form, like the steps: a press refused for an empty field is counted
    // by that field, not as another submission.
    if (!counted.current.has('submitted')) {
      counted.current.add('submitted');
      track('post', 'submitted');
    }
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
          track('post', 'refused');
          showErrors(result.fields || { description: result.error }, !!result.fields);
          setMessage(result.error || 'შეამოწმე მონიშნული ველები.');
          return;
        }
        throw new Error(retryMessage);
      }
      const received = result as SubmissionReceipt;
      reached('done');
      setReceipt(received.id);
      setAlreadyReceived(received.alreadyReceived === true);
      setInvoiceUrl(
        typeof received.invoiceUrl === 'string' ? received.invoiceUrl : '',
      );
      importer.clear();
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    } catch {
      // The server or the connection failed after a valid form: the form is not to blame.
      track('post', 'failed');
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
          <p className="post-eyebrow">{ui('განცხადება მიღებულია')}</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {ui('განცხადება გაგზავნილია')}
          </h1>
          <p>
            „{values.title}
            {ui(
              '“ განსახილველად გაიგზავნა. საიტზე ადმინისტრატორის დამტკიცების შემდეგ გამოჩნდება.',
            )}
          </p>
          <p>
            {ui(
              'გამოქვეყნების შემდეგ მითითებულ ელფოსტაზე მოგივა მოკლე წერილი ვაკანსიის ბმულით.',
            )}
          </p>
          {alreadyReceived && (
            <p>
              {ui(
                'ეს განცხადება უკვე მიღებული იყო პირველი გაგზავნისას; მას შემდეგ შეტანილი ცვლილებები არ შენახულა.',
              )}
            </p>
          )}
          {invoiceUrl && (
            <div className="post-invoice-callout">
              <strong>{ui('განთავსების ინვოისი')}</strong>
              <p>
                {ui(
                  'საბანკო რეკვიზიტები და გადარიცხვის დანიშნულება იხილე ინვოისში. განთავსება გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ.',
                )}
              </p>
              <Link className="post-primary" href={invoiceUrl}>
                <FileText aria-hidden="true" />
                {ui('ინვოისის ნახვა')}
              </Link>
              <p>
                {ui(
                  'ინვოისის ასლი ავტომატურად იგზავნება განაცხადში მითითებულ ელფოსტაზე. დახმარებისთვის დარეკე:',
                )}{' '}
                <a href={`tel:${invoiceContact.telephone}`}>
                  {invoiceContact.phone}
                </a>
                .
              </p>
            </div>
          )}
          <small>
            {ui('განაცხადის ნომერი: ')}
            <code>{receipt}</code>
          </small>
          <div className="post-actions">
            <Link href="/" className="post-primary">
              {ui('ვაკანსიებზე დაბრუნება')}
            </Link>
            <button
              type="button"
              className="post-secondary"
              onClick={() => {
                requestId.current = crypto.randomUUID();
                // A second vacancy from the same page is a new pass through the form.
                stage.current = 'opened';
                counted.current.clear();
                track('post', 'opened');
                setValues({
                  ...initial,
                  deadline: submissionDate(
                    new Date(Date.now() + 30 * 86400000),
                  ),
                });
                importer.clear();
                setConsent(false);
                setReceipt('');
                setSent(null);
                setAlreadyReceived(false);
                setInvoiceUrl('');
                setMessage('');
                setDraftNote('');
              }}
            >
              <Plus aria-hidden="true" />
              {ui('ახალი განცხადების დამატება')}
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="post-job-main">
      <Link className="post-back" href="/">
        <ChevronLeft aria-hidden="true" />
        {ui('ვაკანსიებზე დაბრუნება')}
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
          {ui('განცხადების დამატება')}
        </h1>
        <p>{ui('განცხადება გამოქვეყნდება შემოწმების შემდეგ.')}</p>
      </div>
      <div className="post-layout">
        <form
          ref={formRef}
          onSubmit={submit}
          noValidate
          aria-label={ui('განცხადების დამატება')}
          aria-busy={busy}
        >
          <fieldset className="post-section post-vacancy-fields" disabled={locked}>
            <JobImport controller={importer} endpoint="/api/job-import" disabled={locked} skin="public" t={ui} />
            <JobSteps form={jobForm} errors={errors} skin="public" t={ui} disabled={locked}
              filled={importer.filled} onDescriptionPaste={importer.paste} onDescriptionBlur={importer.blurDescription}
              set={(key, value) => { if (key in initial) change(key as FieldName, String(value)); }} blur={() => {}} />
            <p className="post-import-subtle">{ui('ვაკანსია საიტზე იქნება {0}', [locale === 'en' && values.deadline ? new Date(values.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tbilisi' }) : visibleJobDeadline(values.deadline)])}</p>
          </fieldset>
          <section className="post-section">
            <div className="post-grid">
              <Field name="company" label={ui('კომპანიის დასახელება *')} error={errors.company}>
                <input {...props('company')} required maxLength={160} autoComplete="organization" />
              </Field>
              <Field name="notificationEmail" label={ui('ელფოსტა *')} error={errors.notificationEmail}>
                <input {...props('notificationEmail')} required type="email" autoComplete="email" maxLength={254} />
              </Field>
              <Field
                name="logo"
                label={ui('კომპანიის ლოგო')}
                error={errors.logo}
                hint="PNG, JPG ან WebP"
                wide
              >
                <div className="post-logo-row" aria-busy={logoBusy}>
                  <span className="post-logo-preview">
                    {previewLogo &&
                    submissionLogoSchema.safeParse(previewLogo).success ? (
                      <Image
                        src={previewLogo}
                        alt={ui('კომპანიის ლოგოს წინასწარი ნახვა')}
                        width={64}
                        height={64}
                        unoptimized
                      />
                    ) : (
                      <ImagePlus aria-hidden="true" />
                    )}
                  </span>
                  <div className="post-logo-actions">
                    <label
                      className="post-secondary post-logo-choose"
                      htmlFor="post-logo"
                    >
                      {logoBusy ? (
                        <span className="ds-spinner" aria-hidden="true" />
                      ) : (
                        <ImagePlus aria-hidden="true" />
                      )}
                      {logoBusy
                        ? ui('მუშავდება…')
                        : values.logo
                          ? ui('სხვა ლოგოს არჩევა')
                          : ui('ლოგოს არჩევა')}
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
                        <X aria-hidden="true" />
                        {ui('ლოგოს მოცილება')}
                      </button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          </section>
          <fieldset className="post-section post-plans">
            <legend>{ui('განთავსება')}</legend>
            <div className="post-plan-pills">
              {placementTiers.map((t) => (
                <label
                  key={t}
                  className={`ds-chip${values.placement === t ? ' is-selected' : ''}`}
                  data-active={values.placement === t}
                >
                  <input
                    type="radio"
                    name="placement"
                    value={t}
                    checked={values.placement === t}
                    onChange={() => {
                      choosePlan();
                      change('placement', t);
                    }}
                    disabled={locked || (t !== 'standard' && !premiumAvailable)}
                  />
                  <span>
                    {ui(placementLabels[t])} ·{' '}
                    {t === 'standard'
                      ? ui('უფასო')
                      : `${paidPlacementPrices[t]} ₾`}
                    {t !== 'standard' && !premiumAvailable ? ui(' · მალე') : ''}
                  </span>
                </label>
              ))}
            </div>
            {values.placement !== 'standard' && (
              <Field
                name="billingEmail"
                label={ui('ინვოისისთვის სხვა ელფოსტა (არასავალდებულო)')}
                error={errors.billingEmail}
                hint="ინვოისი შეტყობინებისთვის მითითებულ ელფოსტაზე მოგივა. სხვა მისამართზე მისაღებად შეავსე ეს ველი."
                wide
              >
                <input
                  {...props('billingEmail')}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                />
              </Field>
            )}
            <details className="post-plan-note">
              <summary>{ui('შეთავაზების პირობები')}</summary>
              <p>
                {ui(
                  'VIP — {0} ₾, პრემიუმი — {1} ₾. ორივე პაკეტი მოქმედებს {2} დღე გააქტიურებიდან. განთავსება იწყება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ. თანხა ავტომატურად არ ჩამოიჭრება.',
                  [vipPriceGEL, premiumPriceGEL, premiumDays],
                )}
              </p>
              <p>
                {ui(
                  'ნებისმიერი ფილტრისა და დალაგებისას შესაბამისი პრემიუმ განცხადებები ჩანს პირველ, VIP — მათ შემდეგ, თითოეული გამოქვეყნების თარიღის მიხედვით, უახლესი — ზემოთ.',
                )}
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
            <label className="post-consent" htmlFor="post-consent">
              <Checkbox
                id="post-consent"
                checked={consent}
                disabled={locked}
                aria-invalid={!!errors.consent}
                aria-describedby={
                  errors.consent ? 'post-consent-error' : undefined
                }
                onCheckedChange={(checked) => {
                  choosePlan();
                  setConsent(checked);
                  setErrors((v) => ({ ...v, consent: '' }));
                }}
              />
              <span>
                {ui(
                  'ვადასტურებ, რომ უფლებამოსილი ვარ და ვეთანხმები საკონტაქტო მონაცემების საჯარო გამოქვეყნებას.',
                )}
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
                {busy ? (
                  <span className="ds-spinner" aria-hidden="true" />
                ) : (
                  <Send aria-hidden="true" />
                )}
                {busy
                  ? ui('იგზავნება…')
                  : sent
                    ? ui('ხელახლა გაგზავნა')
                    : ui('განცხადების გაგზავნა')}
              </button>
            </div>
            <output className="post-draft-note">
              {busy
                ? ui('განცხადება იგზავნება. დაელოდე მიღების დასტურს.')
                : draftNote}
            </output>
          </div>
        </form>
      </div>
    </main>
  );
}
