"use client";
import { NotificationSettings } from "./notification-settings";
import { MessageTemplatesSettings } from "./message-templates";
import { ProfileBranding } from "./profile-branding";
import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react";
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
  UserPlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  Check,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { Brand } from "../brand";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { CompanyIdentity } from "@/lib/company-portal";
import { companyHref, mobileNav, plainClick, readCompanyLocation } from "@/lib/company-portal-navigation";
import {
  companyRequest as request,
  inGroup,
  type CompanyJob,
  type CompanyProfile,
} from "./company-api";
import type { Candidate, CandidateStage } from "@/lib/company-candidates";
import { BillingView } from "./billing-view";
import { CompanyDetailsForm } from "./company-details";
import { missingCompanyDetails, type CompanyDetails } from "@/lib/company-registration";
import { JobsView } from "./jobs-view";
import { SetupGuide } from "./setup-guide";
import { CandidatesView } from "./candidates-view";
import { UploadDialog } from "./talent-view";
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
  { id: "team", label: "გუნდი", Icon: UserPlus },
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

/* One field with a show button instead of typing the password twice; the length
   rule appears only once the password is actually too short. */
function NewPasswordInput() {
  const [short, setShort] = useState(false);
  const [shown, setShown] = useState(false);
  const check = (input: HTMLInputElement) =>
    setShort(input.value.length > 0 && input.value.length < 8);
  return (
    <>
      <span className="cp-password-field">
        <input
          className="cp-input"
          name="password"
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          spellCheck={false}
          aria-invalid={short || undefined}
          aria-describedby={short ? "cp-password-short" : undefined}
          onBlur={(e) => check(e.currentTarget)}
          onInvalid={(e) => check(e.currentTarget)}
          onChange={(e) => {
            if (short) check(e.currentTarget);
          }}
        />
        <button
          type="button"
          className="cp-password-toggle"
          aria-label={shown ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
      {short && (
        <small id="cp-password-short" className="cp-field-error">
          სულ მცირე 8 სიმბოლო</small>
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
  const [tab, setTabState] = useState<Tab>("jobs");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // The desktop sidebar can fold to icons; the choice is remembered on this device.
  const [navFolded, setNavFolded] = useState(false);
  useEffect(() => {
    setNavFolded(localStorage.getItem("jobx-company-nav") === "folded");
  }, []);
  function toggleNav() {
    setNavFolded((folded) => {
      localStorage.setItem("jobx-company-nav", folded ? "open" : "folded");
      return !folded;
    });
  }
  const [loginNotice, setLoginNotice] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const confirmLeaving = useCallback(() => {
    if (detailsDirty && !window.confirm("შეუნახავი ცვლილებები დაიკარგება. გადავიდეთ?")) return false;
    setDetailsDirty(false);
    return true;
  }, [detailsDirty]);
  const setTab = useCallback((next: Tab) => {
    if (next !== tab && !confirmLeaving()) return false;
    setTabState(next);
    return true;
  }, [tab, confirmLeaving]);
  useEffect(() => {
    if (!detailsDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [detailsDirty]);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("jobx.company.sessionExpired") === "1") {
        setLoginNotice("სესიის ვადა ამოიწურა. გთხოვთ, ხელახლა შეხვიდეთ.");
      }
      sessionStorage.removeItem("jobx.company.sessionExpired");
    } catch { /* Storage may be unavailable in a restricted browser. */ }
  }, []);
  const [adding, setAdding] = useState(false);
  // The address is read once on arrival; until then it must not be overwritten.
  const [urlReady, setUrlReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const place = readCompanyLocation(window.location.search, identity?.role);
    setTab(place.tab);
    setSelected(place.entry);
    if (place.job || place.stage)
      setCandidateFilter({ jobId: place.job, stage: place.stage as CandidateStage | undefined });
    setUrlReady(true);
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
  const [details, setDetails] = useState<CompanyDetails>(
    identity?.details ?? { code: "", representativeName: "", position: "", phone: "" },
  );
  const missing = missingCompanyDetails(details);
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
  /* A CV base person handled from the side sheet joins the company's candidates as
     soon as the company acts on them, as it does on the server. */
  const patchCandidates = useCallback(
    (entries: string[], patch: Partial<Candidate>) => {
      setCvBase((base) => {
        const next = base?.map((c) => (entries.includes(c.entry) ? { ...c, ...patch } : c)) ?? base;
        const acted = "stage" in patch || "rating" in patch || "interviewAt" in patch;
        setCandidates((list) => {
          const patched = list.map((c) => (entries.includes(c.entry) ? { ...c, ...patch } : c));
          const joining = acted
            ? (next ?? []).filter((b) => entries.includes(b.entry) && !patched.some((c) => c.entry === b.entry))
            : [];
          return [...joining, ...patched];
        });
        return next;
      });
    },
    [],
  );
  /* Keep the tab and the open candidate in the address: links, new tabs and the
     browser's back button then work. Opening a person over the CV base (or on a
     phone, where the detail is its own screen) is a step back can undo. */
  const shown = useRef<{ tab: Tab; entry: string | null } | null>(null);
  const pushedEntry = useRef<string | null>(null);
  useEffect(() => {
    if (!urlReady || !identity) return;
    const entry = tab === "candidates" || tab === "talent" ? selected : null;
    const href = companyHref({
      tab,
      entry,
      job: tab === "candidates" ? candidateFilter?.jobId : undefined,
      stage: tab === "candidates" ? candidateFilter?.stage : undefined,
    });
    const prev = shown.current;
    shown.current = { tab, entry };
    if (href === window.location.pathname + window.location.search) return;
    const overlay =
      tab === "talent" || !window.matchMedia("(min-width: 901px)").matches;
    if (prev?.tab === tab && overlay && prev.entry && !entry && pushedEntry.current === prev.entry) {
      pushedEntry.current = null;
      window.history.back();
      return;
    }
    const push = !prev || prev.tab !== tab || (overlay && !!entry && entry !== prev.entry);
    pushedEntry.current = push && overlay && entry ? entry : null;
    window.history[push ? "pushState" : "replaceState"](null, "", href);
  }, [urlReady, identity, tab, selected, candidateFilter]);
  useEffect(() => {
    const onPop = () => {
      const place = readCompanyLocation(window.location.search, identity?.role);
      if (!setTab(place.tab)) {
        window.history.pushState(null, "", companyHref({ tab, entry: selected }));
        return;
      }
      shown.current = { tab: place.tab, entry: place.entry };
      pushedEntry.current = null;
      setSelected(place.entry);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [identity?.role, setTab, tab, selected]);
  /* A JOBX CV base person's phone and email, opened on request; the server logs it. */
  const revealContact = useCallback(async (entry: string) => {
    try {
      const shown: Candidate = await request("candidates", { action: "reveal", entry });
      setCandidates((list) => list.map((c) => (c.entry === entry ? shown : c)));
      setCvBase((list) => list?.map((c) => (c.entry === entry ? shown : c)) ?? list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "კონტაქტი ვერ გაიხსნა.");
    }
  }, []);
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
    const form = event.currentTarget;
    const data = new FormData(form);
    await action(async () => {
      await request("password", {
        currentPassword: data.get("currentPassword") ?? "",
        password: data.get("password"),
      });
      // The server keeps this device signed in with the new password.
      if (identity?.mustChangePassword) window.location.reload();
      else {
        form.reset();
        setNotice("პაროლი შეიცვალა.");
      }
    });
  }
  // Leave without finishing: the temporary password still works next time.
  const signOut = () => {
    if (!confirmLeaving()) return;
    void action(async () => {
      await fetch("/api/company/session", { method: "DELETE" });
      window.location.reload();
    });
  };
  const passwordForm = (
    <form className="cp-settings cp-password-settings" onSubmit={password}>
      <div className="cp-settings-row">
        <div className="cp-settings-label">
          <h2>პაროლი</h2>
          <p>
            {identity?.mustChangePassword
              ? "მოიფიქრეთ საკუთარი პაროლი, სულ მცირე 8 სიმბოლო."
              : "სხვა მოწყობილობებზე ხელახლა შესვლა დაგჭირდებათ."}
          </p>
        </div>
        <div className="cp-fields">
          {!identity?.mustChangePassword && (
            <label>
              მიმდინარე პაროლი
              <input
                className="cp-input"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
          )}
          <label>
            ახალი პაროლი <NewPasswordInput />
          </label>
        </div>
      </div>
      <div className="cp-settings-foot">
        <button className={identity?.mustChangePassword ? "cp-btn cp-btn--primary" : "cp-btn cp-btn--secondary"} disabled={busy}>
           პაროლის შენახვა </button>
        {identity?.mustChangePassword && (
          <button type="button" className="cp-btn cp-btn--ghost" disabled={busy} onClick={signOut}>
            <LogOut size={15} /> გასვლა
          </button>
        )}
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
                        <small>მიუთითეთ კომპანიის დასახელება.</small>
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
                      <label>
                         კომპანიის დასახელება <input
                          className="cp-input"
                          name="name"
                          autoComplete="organization"
                          required
                          minLength={2}
                          maxLength={160}
                        />
                      </label>
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
                      {google?.name && (
                        <input type="hidden" name="representativeName" value={google.name} />
                      )}
                    </>
                  )}
                  {!(google && !inviteToken) && (
                    <label>
                       პაროლი <NewPasswordInput />
                    </label>
                  )}
                  {!inviteToken && (
                    <p className="cp-auth-note">
                       რეგისტრაციის შემდეგ ვაკანსიის მომზადებას მაშინვე შეძლებთ. </p>
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
                  {loginNotice && <p role="status">{loginNotice}</p>}
                  <label>
                     ელფოსტა ან მომხმარებლის სახელი <input
                      className="cp-input"
                      name="username"
                      autoComplete="username"
                      value={loginUsername}
                      onChange={(event) => setLoginUsername(event.target.value)}
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
  const openJobs = jobs.filter((j) => inGroup(j, "active")).length;
  const unseen = candidates.filter((c) => !c.seen).length;
  const visibleNav = nav.filter((item) =>
    (item.id !== "billing" && item.id !== "team") || identity.role === "owner",
  );
  const { more } = mobileNav(visibleNav);
  return (
    <div className="cp" data-nav-folded={navFolded || undefined}>
      <aside className="cp-side">
        <div className="cp-workspace">
          {avatar}
          <div>
            <strong>{identity.name}</strong>
            <span>კომპანიის სივრცე</span>
          </div>
        </div>
        <nav className="cp-nav" aria-label="კომპანიის მართვა">
          {visibleNav
            .map(({ id, label, Icon }) => (
              <a
                key={id}
                href={companyHref({ tab: id, entry: null })}
                data-nav={id}
                data-mobile-more={more.some((item) => item.id === id) || undefined}
                title={navFolded ? label : undefined}
                aria-current={tab === id ? "page" : undefined}
                onClick={(event) => {
                  if (!plainClick(event)) return;
                  event.preventDefault();
                  if (!setTab(id)) return;
                  setSelected(null);
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
              </a>
            ))}
          <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogTrigger
              className="cp-mobile-more"
              data-nav="more"
              aria-expanded={moreOpen}
              aria-current={more.some((item) => item.id === tab) ? "page" : undefined}
            >
              <MoreHorizontal size={16} />მეტი
            </DialogTrigger>
            <DialogContent className="cp-dialog cp-mobile-menu">
              <DialogTitle>მეტი</DialogTitle>
              <DialogDescription>კომპანიის მართვა</DialogDescription>
              <nav aria-label="კომპანიის დამატებითი მენიუ">
                {more.map(({ id, label, Icon }) => (
                  <a key={id} href={companyHref({ tab: id, entry: null })}
                    aria-current={tab === id ? "page" : undefined}
                    onClick={(event) => {
                      if (!plainClick(event)) return;
                      event.preventDefault();
                      if (!setTab(id)) return;
                      setMoreOpen(false);
                      setSelected(null);
                      setError("");
                    }}>
                    <Icon size={18} />{label}
                  </a>
                ))}
                <button type="button" onClick={signOut}><LogOut size={18} />გასვლა</button>
              </nav>
            </DialogContent>
          </Dialog>
        </nav>
        <div className="cp-side-foot">
          <button
            type="button"
            className="cp-side-link cp-side-fold"
            aria-expanded={!navFolded}
            title={navFolded ? "მენიუს გაშლა" : undefined}
            onClick={toggleNav}
          >
            {navFolded ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            {navFolded ? "მენიუს გაშლა" : "მენიუს დაკეცვა"}
          </button>
          <Link href="/" className="cp-side-link" title={navFolded ? "jobx.ge" : undefined}>
            <ArrowUpRight size={15} />
            jobx.ge
          </Link>
          <button
            type="button"
            className="cp-side-link"
            title={navFolded ? "გასვლა" : undefined}
            onClick={signOut}
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
            {identity.approvalStatus === "pending" && missing.length > 0 && (
              <>
                <p>
                  შემოწმების დასაწყებად შეავსეთ: {missing.join(", ")}.
                </p>
                {identity.role === "owner" && tab !== "security" && (
                  <a
                    className="cp-btn"
                    href={companyHref({ tab: "security", entry: null }) + "#company-details"}
                    onClick={(event) => {
                      if (!plainClick(event)) return;
                      event.preventDefault();
                      setTab("security");
                      requestAnimationFrame(() =>
                        document.getElementById("company-details")?.scrollIntoView({ block: "start" }),
                      );
                    }}
                  >
                    მონაცემების შევსება
                  </a>
                )}
              </>
            )}
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
                      hint: "საიტიდან გამოგზავნილი CV აქ ჩნდება. სხვა წყაროდან მიღებული CV-ებიც კანდიდატების გვერდზე დაამატეთ.",
                      done: candidates.length > 0,
                      action: {
                        label: "CV-ის ატვირთვა",
                        run: () => setTab("candidates"),
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
            onReveal={revealContact}
            onError={setError}
            onAdd={() => setAdding(true)}
            onGo={(place) =>
              place === "job"
                ? jobs.length
                  ? setTab("jobs")
                  : window.location.assign("/company/jobs/new")
                : setTab("talent")
            }
          />
        )}
        {tab === "candidates" && approved && canEdit && (
          <UploadDialog
            open={adding}
            jobs={jobs}
            onClose={() => setAdding(false)}
            onUploaded={async (entry, duplicate) => {
              setAdding(false);
              setCandidates(await request("candidates"));
              setNotice(duplicate ? "ეს CV უკვე დამატებული იყო." : "კანდიდატი დაემატა.");
              setSelected(entry);
            }}
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
            onReveal={revealContact}
            onOpen={(entry) => setSelected(entry)}
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
        {tab === "talent" && approved && (
          <CandidatesView
            sheetOnly
            canEdit={canEdit}
            companyName={identity.name}
            candidates={
              cvBase
                ? [...candidates, ...cvBase.filter((b) => !candidates.some((c) => c.entry === b.entry))]
                : candidates
            }
            jobs={jobs}
            loaded={candidatesLoaded}
            selected={selected}
            onSelect={setSelected}
            onRemoved={(entry) => {
              setCandidates((list) => list.filter((c) => c.entry !== entry));
              setSelected((value) => (value === entry ? null : value));
            }}
            onPatch={patchCandidates}
            onReveal={revealContact}
            onError={setError}
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
                {profile && (typeof profile.publicPath === "string" ? (
                  <a className="cp-btn cp-btn--secondary" href={profile.publicPath} target="_blank" rel="noopener noreferrer">
                    საჯარო გვერდის ნახვა
                  </a>
                ) : profile.publicPath === null ? (
                  <p>საჯარო გვერდი გამოჩნდება ვაკანსიის გამოქვეყნების შემდეგ, თუ გვერდი დამალული არ არის.</p>
                ) : null)}
              </div>
            </header>
            {profile ? (
              <form
                className="cp-settings"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!canEditProfile) return;
                  void action(async () => {
                    setProfile({ ...profile, ...await request("profile", profile) });
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
                <dd>{/^u[0-9a-f]{32}$/.test(identity.username) ? identity.email : identity.username}</dd>
              </div>
              <div>
                <dt>შეტყობინებების ელფოსტა</dt>
                <dd>{identity.email}</dd>
              </div>
            </dl>
            <CompanyDetailsForm
              details={details}
              onDirtyChange={setDetailsDirty}
              canEdit={identity.role === "owner"}
              codeLocked={identity.approvalStatus === "approved" && !!details.code}
              onSaved={(next) => {
                setDetails(next);
                setNotice("კომპანიის მონაცემები შენახულია.");
              }}
            />
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
               ვაკანსიის დახურვა </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
