"use client";
import { NotificationSettings } from "./notification-settings";
import { MessageTemplatesSettings } from "./message-templates";
import { ProfileBranding } from "./profile-branding";
import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import Link from "next/link";
import {
  CreditCard,
  LogOut,
  Building2,
  Briefcase,
  Settings,
  ArrowUpRight,
  BarChart3,
  Users,
  UsersRound,
  Database,
  Check,
  X,
} from "lucide-react";
import { Brand } from "../brand";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { CompanyIdentity } from "@/lib/company-portal";
import { initialCompanyTab } from "@/lib/company-portal-navigation";
import {
  companyRequest as request,
  type CompanyJob,
  type CompanyProfile,
} from "./company-api";
import type { Candidate, CandidateStage } from "@/lib/company-candidates";
import { BillingView } from "./billing-view";
import { JobsView } from "./jobs-view";
import { SetupGuide } from "./setup-guide";
import { CandidatesView } from "./candidates-view";
import { TalentView } from "./talent-view";
import { AnalyticsView } from "./analytics-view";
import type { CompanyJobStats } from "@/lib/company-analytics";
import "./portal.css";
import { TeamView } from "./team-view";

type Tab =
  | "jobs"
  | "candidates"
  | "talent"
  | "analytics"
  | "profile"
  | "billing"
  | "security"
  | "team";
const nav: { id: Tab; label: string; Icon: typeof Briefcase }[] = [
  { id: "jobs", label: "ვაკანსიები", Icon: Briefcase },
  { id: "candidates", label: "კანდიდატები", Icon: Users },
  { id: "talent", label: "CV ბაზა", Icon: Database },
  { id: "analytics", label: "ანალიტიკა", Icon: BarChart3 },
  { id: "profile", label: "კომპანიის გვერდი", Icon: Building2 },
  { id: "billing", label: "გადახდები", Icon: CreditCard },
  { id: "team", label: "გუნდი", Icon: Users },
  { id: "security", label: "ანგარიში", Icon: Settings },
];

const googleErrors: Record<string, string> = {
  failed: "Google-ით შესვლა ვერ მოხერხდა. სცადეთ თავიდან.",
  conflict: "ეს ელფოსტა სხვა Google ანგარიშთანაა დაკავშირებული.",
  disabled: "ეს ანგარიში შეჩერებულია. დაგვიკავშირდით.",
  unavailable: "Google-ით შესვლა ჯერ არ არის ჩართული.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1c.9-2.8 3.5-4.9 6.6-4.9z"
      />
    </svg>
  );
}

/* The length rule appears only once the password is actually too short. */
function NewPasswordInput() {
  const [short, setShort] = useState(false);
  const check = (input: HTMLInputElement) =>
    setShort(input.value.length > 0 && input.value.length < 12);
  return (
    <>
      <input
        className="cp-input"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        aria-invalid={short || undefined}
        aria-describedby={short ? "cp-password-short" : undefined}
        onBlur={(e) => check(e.currentTarget)}
        onInvalid={(e) => check(e.currentTarget)}
        onChange={(e) => {
          if (short) check(e.currentTarget);
        }}
      />
      {short && (
        <small id="cp-password-short" className="cp-field-error">
           სულ მცირე 12 სიმბოლო </small>
      )}
    </>
  );
}

export function CompanyPortal({
  identity,
  googleEnabled = false,
}: {
  identity: CompanyIdentity | null;
  googleEnabled?: boolean;
}) {
  const [registering, setRegistering] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [google, setGoogle] = useState<{ email: string; name: string } | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("jobs");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTab(initialCompanyTab(params.get("tab"), identity?.role));
    setInviteToken(params.get("invite") || "");
    if (params.get("register") === "1") setRegistering(true);
    const googleState = params.get("google");
    if (googleState && googleErrors[googleState])
      setError(googleErrors[googleState]);
    if (googleState === "1")
      void fetch("/api/company/google", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((value) => {
          if (value?.email) setGoogle(value);
        })
        .catch(() => {});
  }, []);
  const [notice, setNotice] = useState("");
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [candidateFilter, setCandidateFilter] = useState<
    { jobId?: string; stage?: CandidateStage } | undefined
  >();
  const [closing, setClosing] = useState<CompanyJob | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  // The JOBX CV base, loaded the first time the CV base tab opens.
  const [cvBase, setCvBase] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [stats, setStats] = useState<CompanyJobStats[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const patchCandidates = useCallback(
    (entries: string[], patch: Partial<Candidate>) =>
      setCandidates((list) =>
        list.map((c) => (entries.includes(c.entry) ? { ...c, ...patch } : c)),
      ),
    [],
  );
  const approved =
    identity?.approvalStatus === "approved" && identity.emailVerified;
  const ready = identity && !identity.mustChangePassword;
  async function load() {
    const [a, b] = await Promise.all([request("jobs"), request("profile")]);
    setJobs(a);
    setProfile(b);
    setLoaded(true);
  }
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void Promise.all(
      ["jobs", "profile", "candidates", "analytics"].map((path) =>
        !approved && ["candidates", "analytics"].includes(path)
          ? Promise.resolve([])
          : fetch("/api/company/" + path, {
              signal: controller.signal,
              cache: "no-store",
            }).then(async (res) => {
              const body = await res.json();
              if (!res.ok) throw Error(body.error);
              return body;
            }),
      ),
    )
      .then(([a, b, c, d]) => {
        setJobs(a);
        setProfile(b);
        setCandidates(c);
        setStats(d);
        setLoaded(true);
        setCandidatesLoaded(true);
        setStatsLoaded(true);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoaded(true);
          setCandidatesLoaded(true);
          setStatsLoaded(true);
        }
      });
    return () => controller.abort();
  }, [ready, approved]);
  useEffect(() => {
    if (tab !== "talent" || !approved || cvBase) return;
    let alive = true;
    request("candidates?base=1")
      .then((list: Candidate[]) => alive && setCvBase(list))
      .catch((e: Error) => {
        if (!alive) return;
        setCvBase([]);
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [tab, approved, cvBase]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "მოქმედება ვერ შესრულდა");
    } finally {
      setBusy(false);
    }
  }
  async function login(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action(async () => {
      await request("session", {
        username: data.get("username"),
        password: data.get("password"),
      });
      window.location.reload();
    });
  }
  async function register(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      await request(
        inviteToken ? "team/accept" : "register",
        inviteToken
          ? {
              token: inviteToken,
              name: data.representativeName,
              password: data.password,
            }
          : data,
      );
      window.location.href = "/company";
    });
  }
  async function password(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action(async () => {
      if (data.get("password") !== data.get("repeat"))
        throw Error("პაროლები ერთმანეთს არ ემთხვევა.");
      await request("password", {
        currentPassword: data.get("currentPassword"),
        password: data.get("password"),
      });
      window.location.reload();
    });
  }
  const passwordForm = (
    <form className="cp-settings cp-password-settings" onSubmit={password}>
      <div className="cp-settings-row">
        <div className="cp-settings-label">
          <h2>პაროლი</h2>
          <p>
            {identity?.mustChangePassword
              ? "პირველი შესვლისას შეცვალეთ დროებითი პაროლი."
              : "შეცვლის შემდეგ ყველა მოწყობილობაზე სესია დასრულდება და ხელახლა შეხვალთ."}
          </p>
        </div>
        <div className="cp-fields">
          <label>
             მიმდინარე პაროლი <input
              className="cp-input"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
             ახალი პაროლი <NewPasswordInput />
          </label>
          <label>
             გაიმეორეთ ახალი პაროლი <input
              className="cp-input"
              name="repeat"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
        </div>
      </div>
      <div className="cp-settings-foot">
        <button className={identity?.mustChangePassword ? "cp-btn cp-btn--primary" : "cp-btn cp-btn--secondary"} disabled={busy}>
           პაროლის შენახვა </button>
      </div>
    </form>
  );
  const alert = error && !closing && (
    <p role="alert" className="cp-alert">
      {error}
    </p>
  );
  const toast = notice && (
    <output className="cp-toast" aria-live="polite">
      <Check size={16} />
      {notice}
      <button
        type="button"
        aria-label="შეტყობინების დახურვა"
        title="შეტყობინების დახურვა"
        onClick={() => setNotice("")}
      >
        <X size={14} />
      </button>
    </output>
  );
  if (!identity || identity.mustChangePassword || inviteToken) {
    const choosing = !identity && !inviteToken;
    return (
      <div className="cp cp--auth">
        <div className="cp-auth-shell">
          <aside className="cp-auth-aside">
            <span className="cp-auth-kicker">კომპანიის სივრცე</span>
            <h2>შერჩევის მთელი პროცესი ერთ სივრცეში</h2>
            <ul>
              <li>
                <Briefcase size={18} />
                ვაკანსიები და განაცხადები ერთ ადგილას
              </li>
              <li>
                <UsersRound size={18} />
                კანდიდატები ეტაპების მიხედვით: ახალი, გასაუბრება, შეთავაზება
              </li>
              <li>
                <Database size={18} />
                CV ბაზა, ანალიტიკა და გუნდთან ერთად მუშაობა
              </li>
            </ul>
            <p>კომპანიის სივრცე სატესტო რეჟიმში მუშაობს.</p>
          </aside>
          <div className="cp-auth-panel">
            <div className="cp-auth-top">
              <Brand />
              <Link href="/business" className="cp-auth-back">
                 ბიზნესისთვის </Link>
            </div>
            <div className="cp-auth">
              {choosing && (
                <div
                  className="cp-auth-tabs"
                  role="group"
                  aria-label="ანგარიში"
                >
                  <button
                    type="button"
                    aria-pressed={!registering}
                    onClick={() => {
                      setRegistering(false);
                      setError("");
                    }}
                  >
                     შესვლა </button>
                  <button
                    type="button"
                    aria-pressed={registering}
                    onClick={() => {
                      setRegistering(true);
                      setError("");
                    }}
                  >
                     რეგისტრაცია </button>
                </div>
              )}
              {alert}
              {choosing && googleEnabled && !google && (
                <div className="cp-auth-google">
                  <a
                    className="cp-btn cp-btn--google"
                    href="/api/company/google/start"
                  >
                    <GoogleMark />
                    {registering ? "Google-ით რეგისტრაცია" : "Google-ით შესვლა"}
                  </a>
                  <span className="cp-auth-or">ან</span>
                </div>
              )}
              {registering || inviteToken ? (
                <form className="cp-auth-form" onSubmit={register}>
                  <h1>
                    {inviteToken
                      ? "გუნდში გაწევრიანება"
                      : "კომპანიის რეგისტრაცია"}
                  </h1>
                  {!inviteToken && (
                    <p>ანგარიში ადმინისტრატორის შემოწმების შემდეგ ჩაირთვება.</p>
                  )}
                  {google && !inviteToken && (
                    <div className="cp-auth-linked">
                      <GoogleMark />
                      <span>
                         Google ანგარიში: <strong>{google.email}</strong>
                        <small>შეავსეთ დარჩენილი ველები.</small>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void fetch("/api/company/google", {
                            method: "DELETE",
                          }).finally(() => setGoogle(null))
                        }
                      >
                         გაუქმება </button>
                    </div>
                  )}
                  {!inviteToken && (
                    <div className="cp-auth-grid">
                      <label>
                         კომპანიის დასახელება <input
                          className="cp-input"
                          name="name"
                          required
                          minLength={2}
                          maxLength={160}
                        />
                      </label>
                      <label>
                         საიდენტიფიკაციო კოდი <input
                          className="cp-input"
                          name="code"
                          inputMode="numeric"
                          pattern="[0-9]{9}"
                          minLength={9}
                          maxLength={9}
                          required
                        />
                      </label>
                    </div>
                  )}
                  {inviteToken ? (
                    <label>
                       საკონტაქტო პირი (სახელი, გვარი) <input
                        className="cp-input"
                        name="representativeName"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={120}
                      />
                    </label>
                  ) : (
                    <>
                      <div className="cp-auth-grid">
                        <label>
                           საკონტაქტო პირი (სახელი, გვარი) <input
                            key={google?.name ?? ""}
                            className="cp-input"
                            name="representativeName"
                            autoComplete="name"
                            defaultValue={google?.name}
                            required
                            minLength={2}
                            maxLength={120}
                          />
                        </label>
                        <label>
                           თანამდებობა <input
                            className="cp-input"
                            name="position"
                            required
                            minLength={2}
                            maxLength={120}
                          />
                        </label>
                      </div>
                      <div className="cp-auth-grid">
                        <label>
                           ელფოსტა {google ? (
                            <input
                              key="google-email"
                              className="cp-input"
                              type="email"
                              value={google.email}
                              readOnly
                            />
                          ) : (
                            <input
                              key="email"
                              className="cp-input"
                              name="email"
                              type="email"
                              autoComplete="email"
                              required
                              maxLength={254}
                            />
                          )}
                        </label>
                        <label>
                           ტელეფონი <input
                            className="cp-input"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            required
                            maxLength={25}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  {!(google && !inviteToken) && (
                    <label>
                       პაროლი <NewPasswordInput />
                    </label>
                  )}
                  {!inviteToken && (
                    <p className="cp-auth-note">
                       რეგისტრაციის შემდეგ ვაკანსიის მომზადებას შეძლებთ. კანდიდატებზე წვდომასა და გამოქვეყნებას კომპანიის დადასტურება სჭირდება. </p>
                  )}
                  <button
                    className="cp-btn cp-btn--primary cp-btn--block"
                    disabled={busy}
                  >
                    {busy
                      ? "მიმდინარეობს…"
                      : inviteToken
                        ? "გუნდში გაწევრიანება"
                        : "რეგისტრაცია"}
                  </button>
                </form>
              ) : !identity ? (
                <form className="cp-auth-form" onSubmit={login}>
                  <h1>კომპანიის ანგარიშში შესვლა</h1>
                  <p>შედით ელფოსტით ან მომხმარებლის სახელით.</p>
                  <label>
                     ელფოსტა ან მომხმარებლის სახელი <input
                      className="cp-input"
                      name="username"
                      autoComplete="username"
                      required
                      maxLength={254}
                    />
                  </label>
                  <label>
                     პაროლი <input
                      className="cp-input"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={128}
                    />
                  </label>
                  <button
                    className="cp-btn cp-btn--primary cp-btn--block"
                    disabled={busy}
                  >
                    {busy ? "მიმდინარეობს…" : "შესვლა"}
                  </button>
                  <p className="cp-auth-switch">
                     ანგარიში არ გაქვთ?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setRegistering(true);
                        setError("");
                      }}
                    >
                       დაარეგისტრირეთ კომპანია </button>
                  </p>
                  <Link href="/contact">ვერ შედიხართ? დაგვიკავშირდით</Link>
                </form>
              ) : (
                passwordForm
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  const canEdit = identity.role !== "viewer";
  const canEditProfile = identity.role === "owner";
  const initial = identity.name.trim().charAt(0).toUpperCase();
  const logo = profile?.logoUrl;
  const avatar = (
    <span className="cp-avatar">
      {logo ? <img src={logo} alt="" /> : initial}
    </span>
  );
  const openJobs = jobs.filter((j) => j.status === "published").length;
  const unseen = candidates.filter((c) => !c.seen).length;
  return (
    <div className="cp">
      <aside className="cp-side">
        <div className="cp-workspace">
          {avatar}
          <div>
            <strong>{identity.name}</strong>
            <span>კომპანიის სივრცე</span>
          </div>
        </div>
        <nav className="cp-nav" aria-label="კომპანიის მართვა">
          {nav
            .filter(
              (item) =>
                (item.id !== "billing" && item.id !== "team") ||
                identity.role === "owner",
            )
            .map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                data-nav={id}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => {
                  setTab(id);
                  if (id === "candidates") setCandidateFilter(undefined);
                  setError("");
                }}
              >
                <Icon size={16} />
                {label}
                {id === "jobs" && loaded && <span>{openJobs}</span>}
                {id === "candidates" && unseen > 0 && (
                  <span className="cp-nav-badge">{unseen}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="cp-side-foot">
          <Link href="/" className="cp-side-link">
            <ArrowUpRight size={15} />
            jobx.ge
          </Link>
          <button
            type="button"
            className="cp-side-link"
            onClick={() =>
              void action(async () => {
                await fetch("/api/company/session", { method: "DELETE" });
                window.location.reload();
              })
            }
          >
            <LogOut size={15} />
             გასვლა </button>
        </div>
      </aside>
      <main className="cp-main" data-wide={tab === "candidates" || undefined}>
        {alert}
        {!approved && (
          <div className="cp-alert" role="status">
            <strong>
              {identity.approvalStatus === "rejected"
                ? "კომპანიის რეგისტრაცია უარყოფილია. დეტალებისთვის დაგვიკავშირდით."
                : identity.approvalStatus === "pending"
                  ? "კომპანია შემოწმების მოლოდინშია."
                  : "ელფოსტა დასადასტურებელია."}
            </strong>
            <p>
               ვაკანსიის მომზადება შეგიძლიათ. გამოქვეყნება და კანდიდატებზე წვდომა შესაძლებელი გახდება ელფოსტისა და კომპანიის დადასტურების შემდეგ. </p>
            {!identity.emailVerified && (
              <>
                <p>ელფოსტის დასადასტურებლად გახსენით გამოგზავნილი ბმული.</p>
                <button
                  className="cp-btn"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await request("register", {}, "PATCH");
                      setNotice("დადასტურების ბმული ხელახლა გაიგზავნა.");
                    })
                  }
                >
                   ბმულის ხელახლა გაგზავნა </button>
              </>
            )}
          </div>
        )}
        {tab === "team" && identity.role === "owner" && <TeamView />}
        {tab === "jobs" && (
          <JobsView
            canEdit={canEdit}
            canManageBilling={identity.role === "owner"}
            onRefresh={load}
            candidates={candidates}
            onCandidates={(id, stage) => { setCandidateFilter({ jobId: id, stage }); setSelected(null); setTab("candidates"); }}
            onNotice={setNotice}
            onError={setError}
            intro={
              loaded && (
                <SetupGuide
                  canEdit={canEdit}
                  steps={[
                    {
                      id: "job",
                      title: "დაამატეთ პირველი ვაკანსია",
                      hint: "შევსებას რამდენიმე წუთი სჭირდება. მსგავს ვაკანსიას მერე ასლით შექმნით.",
                      done: jobs.length > 0,
                      action: {
                        label: "ვაკანსიის დამატება",
                        href: "/company/jobs/new",
                        run: () =>
                          window.location.assign("/company/jobs/new"),
                      },
                    },
                    {
                      id: "profile",
                      title: "შეავსეთ კომპანიის გვერდი",
                      hint: "ლოგო და მოკლე აღწერა ყველა ვაკანსიაზე ჩანს და კანდიდატს ნდობას მატებს.",
                      done: !!(profile?.description.trim() && profile.logoUrl),
                      action: canEditProfile
                        ? {
                            label: "გვერდის შევსება",
                            run: () => setTab("profile"),
                          }
                        : undefined,
                    },
                    {
                      id: "live",
                      title: "ვაკანსია გამოქვეყნდება შემოწმების შემდეგ",
                      hint: "JOBX-ის გუნდი ვაკანსიას ამოწმებს და აქვეყნებს. სტატუსს ამ სიაში ნახავთ.",
                      done: jobs.some((j) => j.publishedAt),
                    },
                    {
                      id: "candidate",
                      title: "მიიღეთ პირველი კანდიდატი",
                      hint: "საიტიდან გამოგზავნილი CV აქ ჩნდება. სხვა წყაროდან მიღებული CV-ები CV ბაზაში ატვირთეთ.",
                      done: candidates.length > 0,
                      action: {
                        label: "CV-ის ატვირთვა",
                        run: () => setTab("talent"),
                      },
                    },
                  ]}
                />
              )
            }
            jobs={jobs}
            loaded={loaded}
            onCreate={() =>
              window.location.assign("/company/jobs/new")
            }
            onEdit={(job) =>
              window.location.assign(`/company/jobs/${job.id}/edit`)
            }
            onCopy={(job) =>
              window.location.assign(`/company/jobs/new?copy=${job.id}`)
            }
            onClose={(job) => {
              setError("");
              setClosing(job);
            }}
          />
        )}
        {tab === "candidates" && approved && (
          <CandidatesView
            canEdit={canEdit}
            companyName={identity.name}
            candidates={candidates}
            initialFilter={candidateFilter}
            jobs={jobs}
            loaded={candidatesLoaded}
            selected={selected}
            onSelect={setSelected}
            onRemoved={(entry) => {
              setCandidates((list) => list.filter((c) => c.entry !== entry));
              setSelected((value) => (value === entry ? null : value));
            }}
            onPatch={patchCandidates}
            onError={setError}
          />
        )}
        {tab === "talent" && approved && (
          <TalentView
            canEdit={canEdit}
            candidates={
              cvBase
                ? [...candidates, ...cvBase.filter((b) => !candidates.some((c) => c.entry === b.entry))]
                : candidates
            }
            jobs={jobs}
            loaded={candidatesLoaded && !!cvBase}
            onOpen={(entry) => {
              const fromBase = cvBase?.find((b) => b.entry === entry);
              if (fromBase && !candidates.some((c) => c.entry === entry))
                setCandidates((list) => [fromBase, ...list]);
              setCandidateFilter(undefined);
              setSelected(entry);
              setTab("candidates");
            }}
            onUploaded={async (entry, duplicate) => {
              setCandidates(await request("candidates"));
              setNotice(
                duplicate
                  ? "ეს CV ბაზაში უკვე იყო."
                  : "CV აიტვირთა და ბაზაში დაემატა.",
              );
              setSelected(entry);
            }}
          />
        )}
        {tab === "analytics" && (
          <AnalyticsView
            stats={stats}
            loaded={statsLoaded}
            jobs={jobs}
            candidates={candidates}
            canEdit={canEdit}
            onOpenJob={(job) =>
              window.location.assign(`/company/jobs/${job.id}/edit`)
            }
          />
        )}
        {tab === "profile" && (
          <>
            <header className="cp-head">
              <div className="cp-head-title">
                <h1>კომპანიის გვერდი</h1>
              </div>
            </header>
            {profile ? (
              <form
                className="cp-settings"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!canEditProfile) return;
                  void action(async () => {
                    setProfile(await request("profile", profile));
                    setNotice("კომპანიის მონაცემები შენახულია.");
                  });
                }}
              >
                {!canEditProfile && (
                  <p>კომპანიის გვერდს მხოლოდ ანგარიშის მფლობელი ცვლის.</p>
                )}
                <fieldset
                  className="cp-profile-fields"
                  disabled={!canEditProfile}
                >
                  <div className="cp-settings-row">
                    <div className="cp-settings-label">
                      <h2>იდენტობა</h2>
                      <p>სახელი და ლოგო ჩანს ყველა ვაკანსიაზე.</p>
                    </div>
                    <div className="cp-fields">
                      <div className="cp-logo-field">
                        <span className="cp-avatar cp-avatar--lg">
                          {logo ? <img src={logo} alt="" /> : initial}
                        </span>
                        <label>
                           კომპანიის სახელი <input
                            className="cp-input"
                            value={profile.name}
                            disabled
                          />
                          <small>სახელის შესაცვლელად დაგვიკავშირდით.</small>
                        </label>
                      </div>
                      <label>
                         ლოგოს ბმული <input
                          className="cp-input"
                          type="url"
                          placeholder="https://"
                          maxLength={2000}
                          value={
                            profile.logoUrl.startsWith("/")
                              ? ""
                              : profile.logoUrl
                          }
                          onChange={(e) =>
                            setProfile({ ...profile, logoUrl: e.target.value })
                          }
                        />
                        <small>
                           ცარიელი ველის შემთხვევაში არსებული ლოგო დარჩება. </small>
                      </label>
                    </div>
                  </div>
                  <div className="cp-settings-row">
                    <div className="cp-settings-label">
                      <h2>კომპანიის შესახებ</h2>
                      <p>
                         მოკლედ აღწერეთ, რას აკეთებთ და რატომ ღირს თქვენთან მუშაობა. </p>
                    </div>
                    <div className="cp-fields">
                      <label>
                         ვებგვერდი <input
                          className="cp-input"
                          type="url"
                          placeholder="https://"
                          maxLength={2000}
                          value={profile.website}
                          onChange={(e) =>
                            setProfile({ ...profile, website: e.target.value })
                          }
                        />
                      </label>
                      <label>
                         აღწერა <textarea
                          className="cp-input"
                          rows={7}
                          maxLength={3000}
                          value={profile.description}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              description: e.target.value,
                            })
                          }
                        />
                        <small>{profile.description.length} / 3000</small>
                      </label>
                    </div>
                  </div>
                  <ProfileBranding profile={profile} onChange={setProfile} />
                </fieldset>
                {canEditProfile && (
                  <div className="cp-settings-foot">
                    <button className="cp-btn cp-btn--primary" disabled={busy}>
                       ცვლილებების შენახვა </button>
                  </div>
                )}
              </form>
            ) : (
              <span className="ds-skeleton ds-skeleton--title" />
            )}
          </>
        )}
        {tab === "billing" && identity.role === "owner" && <BillingView />}
        {tab === "security" && (
          <>
            <header className="cp-head">
              <div className="cp-head-title">
                <h1>ანგარიში</h1>
              </div>
            </header>
            <dl className="cp-facts">
              <div>
                <dt>მომხმარებლის სახელი</dt>
                <dd>{identity.username}</dd>
              </div>
              <div>
                <dt>შეტყობინებების ელფოსტა</dt>
                <dd>{identity.email}</dd>
              </div>
            </dl>
            {passwordForm}
            <NotificationSettings canEdit={identity.role === "owner"} />
            <MessageTemplatesSettings canEdit={identity.role !== "viewer"} companyName={identity.name} />
          </>
        )}
      </main>
      {toast}
      <Dialog
        open={!!closing}
        onOpenChange={(open) => {
          if (!open && !busy) setClosing(null);
        }}
      >
        <DialogContent className="cp-dialog">
          <DialogTitle>დავხუროთ ვაკანსია?</DialogTitle>
          <DialogDescription>
            „{closing?.title}“ მაშინვე მოიხსნება საიტიდან. მოგვიანებით შეგიძლიათ ხელახლა გაგზავნოთ. </DialogDescription>
          {error && closing && (
            <p role="alert" className="cp-alert">
              {error}
            </p>
          )}
          <div className="cp-dialog-actions">
            <button
              className="cp-btn cp-btn--ghost"
              disabled={busy}
              onClick={() => setClosing(null)}
            >
               გაუქმება </button>
            <button
              className="cp-btn cp-btn--danger"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  if (!closing) return;
                  await request("jobs", {
                    action: "archive",
                    id: closing.id,
                    version: closing.version,
                  });
                  setClosing(null);
                  await load();
                  setNotice("ვაკანსია დახურულია.");
                })
              }
            >
               დახურვა </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
