import { candidateStages, educationLabels, educationLevels, languageLevels, stageLabels, type Candidate, type CandidateProfile, type CandidateStage, type EducationLevel } from "./company-candidates";
export type Person = {
  key: string;
  latest: Candidate;
  entries: Candidate[];
  stage: Candidate["stage"];
  rating: number | null;
  profile: CandidateProfile | null;
  city: string;
  /** Lower-case text of everything known about the person, for search. */
  haystack: string;
};
// The furthest a person got with this company, for the "best stage" column.
export const stageRank = (s: Candidate["stage"]) =>
  s === "rejected" ? -1 : candidateStages.indexOf(s);

export const levelLabel = (level: string | null) =>
  !level ? "" : level === "native" ? "მშობლიური" : level.toUpperCase();
export const yearsLabel = (y: number) => (y < 1 ? "1 წელზე ნაკლები" : `${y} წელი`);
export const norm = (v: string) => v.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const terms = (q: string) =>
  norm(q)
    .split(/[\s,;]+/)
    .filter((t) => t.length > 1);
export const isNativeGeorgian = (l: { name: string; level: string | null }) =>
  norm(l.name) === "ქართული" && l.level === "native";

/* Experience in bands, the way recruiters screen ("3–5 years"), not an exact number. */
export const yearBands = [
  { key: "0", label: "1 წლამდე", min: 0, max: 1 },
  { key: "1", label: "1–3 წელი", min: 1, max: 3 },
  { key: "3", label: "3–5 წელი", min: 3, max: 5 },
  { key: "5", label: "5–10 წელი", min: 5, max: 10 },
  { key: "10", label: "10 წელი და მეტი", min: 10, max: Infinity },
] as const;

export type Filters = {
  query: string;
  positions: string[];
  skills: string[];
  skillMode: "all" | "any";
  years: string[];
  languages: { key: string; min: string }[];
  education: EducationLevel | "";
  cities: string[];
  jobs: string[]; // job ids, 'none' for uploads without a vacancy
  stages: CandidateStage[];
  rated: boolean;
  phone: boolean;
  hideRejected: boolean;
  unchecked: boolean;
  source: "all" | "applied" | "upload" | "cv_box" | "base" | "own";
  requirementsMatch: boolean;
  period: number;
  sort: "match" | "recent" | "years" | "rating";
};
export type FacetKey =
  "positions" | "skills" | "years" | "languages" | "education" | "cities" | "jobs" | "stages";
export const emptyFilters: Filters = {
  query: "",
  positions: [],
  skills: [],
  skillMode: "all",
  years: [],
  languages: [],
  education: "",
  cities: [],
  jobs: [],
  stages: [],
  rated: false,
  phone: false,
  hideRejected: false,
  unchecked: false,
  source: "all",
  requirementsMatch: false,
  period: 0,
  sort: "match",
};
export const storageKey = "company-talent-filters-v2";

/* How well a person matches the search: a hit in the title or skills counts more than a
   word somewhere in a job description. 0 means a required term is missing. */
export function matchScore(p: Person, words: string[]) {
  let score = 0;
  const title = norm(
    [p.latest.title, ...p.entries.map((e) => e.jobTitle)].join(" "),
  );
  const skills = (p.profile?.skills ?? []).map(norm);
  const roles = norm((p.profile?.roles ?? []).join(" "));
  for (const w of words) {
    if (!p.haystack.includes(w)) return 0;
    score += 1;
    if (title.includes(w)) score += 3;
    if (skills.some((s) => s.includes(w))) score += 3;
    if (roles.includes(w)) score += 2;
  }
  return score;
}
/* A short piece of the CV around the first search word that the row does not already show. */
export function snippet(p: Person, words: string[]) {
  const original = p.profile?.text;
  if (!original || !words.length) return "";
  const text = original.toLowerCase();
  const visible = norm(
    [p.latest.title, ...(p.profile?.skills ?? [])].join(" "),
  );
  const w = words.find((x) => !visible.includes(x) && text.includes(x));
  if (!w) return "";
  const at = text.indexOf(w);
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 40)));
  const end = text.indexOf(" ", Math.min(text.length, at + w.length + 50));
  return (
    (start > 0 ? "…" : "") +
    original
      .slice(start, end < 0 ? undefined : end)
      .replace(/\s+/g, " ")
      .trim() +
    (end > 0 ? "…" : "")
  );
}

/* Whether a person passes the filters; `skip` leaves one facet out, so that facet's options
   can count people with each option independently of that group’s selection. */
export function passes(
  p: Person,
  f: Filters,
  words: string[],
  since: number,
  skip?: FacetKey,
) {
  const pr = p.profile;
  if (skip !== "positions" && f.positions.length && !positionTitles(p).some(t => f.positions.includes(norm(t)))) return false;
  if (skip !== "skills" && f.skills.length) {
    const have = new Set((pr?.skills ?? []).map(norm));
    const ok =
      f.skillMode === "all"
        ? f.skills.every((s) => have.has(s))
        : f.skills.some((s) => have.has(s));
    if (!ok) return false;
  }
  if (skip !== "years" && f.years.length) {
    const y = pr?.years;
    if (
      y == null ||
      !f.years.some((k) => {
        const b = yearBands.find((x) => x.key === k)!;
        return !!b && y >= b.min && y < b.max;
      })
    )
      return false;
  }
  if (skip !== "languages" && f.languages.length) {
    for (const want of f.languages) {
      const l = pr?.languages.find((x) => norm(x.name) === want.key);
      if (!l) return false;
      if (
        want.min &&
        languageLevels.indexOf((l.level ?? "a1") as never) <
          languageLevels.indexOf(want.min as never)
      )
        return false;
    }
  }
  if (skip !== "education" && f.education) {
    const lvl = pr?.educationLevel;
    if (
      !lvl ||
      educationLevels.indexOf(lvl) < educationLevels.indexOf(f.education)
    )
      return false;
  }
  if (skip !== "cities" && f.cities.length && !f.cities.includes(norm(p.city)))
    return false;
  if (
    skip !== "jobs" &&
    f.jobs.length &&
    !p.entries.some((e) => f.jobs.includes(e.jobId ?? "none"))
  )
    return false;
  if (skip !== "stages" && f.stages.length && !f.stages.includes(p.stage))
    return false;
  if (f.hideRejected && p.stage === "rejected") return false;
  if (f.rated && !p.rating) return false;
  if (f.phone && !p.entries.some((e) => e.phone)) return false;
  if (f.unchecked && !(p.profile === null || p.profile.origin === "parsed"))
    return false;
  if (f.source === "upload" && !p.entries.some((e) => e.source === "upload"))
    return false;
  if (
    f.requirementsMatch &&
    !p.entries.some((e) => e.requirementsMatch === true)
  )
    return false;
  if (f.source === "cv_box" && !p.entries.some((e) => e.source === "cv_box"))
    return false;
  if (f.source === "base" && !p.entries.some((e) => e.source === "base"))
    return false;
  if (f.source === "own" && !p.entries.some((e) => e.source !== "base"))
    return false;
  if (
    f.source === "applied" &&
    !p.entries.some((e) => e.source === "swipe" || e.source === "resume")
  )
    return false;
  if (since && Date.parse(p.latest.appliedAt) < since) return false;
  if (words.length && !matchScore(p, words)) return false;
  return true;
}


export function positionTitles(p: Person): string[] {
  return [...(p.profile?.roles ?? []).map(role => role.split(/\s+[—–]\s+/)[0]), ...p.entries.map(e => e.title)].filter(Boolean);
}
export type FacetOption = { key: string; label: string; n: number };
export type Facets = {
  positions: FacetOption[]; skills: FacetOption[]; years: FacetOption[];
  languages: FacetOption[]; cities: FacetOption[]; jobs: FacetOption[];
  education: { key: EducationLevel; n: number }[];
  stages: { key: CandidateStage; n: number }[]; unchecked: number;
};
export const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];
/** OR facets count each option ignoring their own selection. AND facets retain the
 * current selection (including minimum language levels) and intersect the option. */
export function countFacets(people: Person[], f: Filters, jobs: {id: string; title: string}[], since = 0): Facets {
  const words = terms(f.query);
  const count = (patch: Partial<Filters>) => people.filter(p => passes(p, {...f, ...patch}, words, since)).length;
  const ordered = <T extends {key: string; n: number}>(list: T[], selected: string[], label: (o: T) => string) =>
    list.filter(o => o.n || selected.includes(o.key)).sort((a,b) =>
      Number(selected.includes(b.key)) - Number(selected.includes(a.key)) ||
      b.n - a.n || label(a).localeCompare(label(b), "ka"));
  const options = (key: "positions" | "skills" | "cities", values: (p: Person) => string[]) => {
    const labels = new Map<string, string>();
    people.forEach(p => values(p).forEach(v => { if(norm(v) && !labels.has(norm(v))) labels.set(norm(v), v.trim()); }));
    f[key].forEach(v => { if (!labels.has(v)) labels.set(v, v); });
    return ordered([...labels].map(([value, label]) => ({key:value, label,
      n:count({[key]: key === "skills" && f.skillMode === "all" ? [...new Set([...f.skills, value])] : [value]})})), f[key], o=>o.label);
  };
  const langs = new Map<string, string>();
  people.forEach(p => p.profile?.languages.filter(l => !isNativeGeorgian(l)).forEach(l => langs.set(norm(l.name), l.name)));
  f.languages.forEach(l => {if(!langs.has(l.key)) langs.set(l.key,l.key);});
  return {
    positions: options("positions", positionTitles),
    skills: options("skills", p => p.profile?.skills ?? []),
    cities: options("cities", p => [p.city]),
    years: ordered(yearBands.map(b => ({...b, n:count({years:[b.key]})})), f.years, o=>o.label),
    languages: ordered([...langs].map(([key,label]) => ({key,label,n:count({languages:f.languages.some(l=>l.key===key) ? f.languages : [...f.languages,{key,min:""}]})})), f.languages.map(l=>l.key), o=>o.label),
    education: ordered(educationLevels.slice(1).map(key => ({key,n:count({education:key})})), [f.education], o=>educationLabels[o.key]),
    jobs: ordered([...jobs.map(j => ({key:j.id,label:j.title})),{key:"none",label:"ვაკანსიის გარეშე"},...f.jobs.filter(id=>id!=="none"&&!jobs.some(j=>j.id===id)).map(key=>({key,label:key}))].map(j=>({...j,n:count({jobs:[j.key]})})), f.jobs, o=>o.label),
    stages: ordered(candidateStages.map(key=>({key,n:count({stages:[key]})})), f.stages, o=>stageLabels[o.key]),
    unchecked:count({unchecked:true}),
  };
}
export function filterChips(f: Filters, facets: Facets, set: <K extends keyof Filters>(key: K, value: Filters[K]) => void) {
  const label = (list: { key: string; label: string }[], key: string) =>
    list.find((o) => o.key === key)?.label ?? key;

  // Active filters as removable chips above the results.
  const chips: { key: string; text: string; clear: () => void }[] = [
    ...(f.query ? [{key: "query", text: f.query, clear: () => set("query", "")}] : []),
    ...f.positions.map((v) => ({key: "position:" + v, text: label(facets.positions, v), clear: () => set("positions", f.positions.filter(x => x !== v))})),
    ...f.skills.map((s) => ({
      key: "skill:" + s,
      text: label(facets.skills, s),
      clear: () =>
        set(
          "skills",
          f.skills.filter((x) => x !== s),
        ),
    })),
    ...f.years.map((y) => ({
      key: "years:" + y,
      text: yearBands.find((b) => b.key === y)?.label ?? y,
      clear: () =>
        set(
          "years",
          f.years.filter((x) => x !== y),
        ),
    })),
    ...f.languages.map((l) => ({
      key: "lang:" + l.key,
      text:
        label(facets.languages, l.key) +
        (l.min ? ` ${levelLabel(l.min)}+` : ""),
      clear: () =>
        set(
          "languages",
          f.languages.filter((x) => x.key !== l.key),
        ),
    })),
    ...(f.education
      ? [
          {
            key: "edu",
            text: `${educationLabels[f.education]} ან მეტი`,
            clear: () => set("education", ""),
          },
        ]
      : []),
    ...f.cities.map((c) => ({
      key: "city:" + c,
      text: label(facets.cities, c),
      clear: () =>
        set(
          "cities",
          f.cities.filter((x) => x !== c),
        ),
    })),
    ...f.jobs.map((j) => ({
      key: "job:" + j,
      text: label(facets.jobs, j),
      clear: () =>
        set(
          "jobs",
          f.jobs.filter((x) => x !== j),
        ),
    })),
    ...f.stages.map((s) => ({
      key: "stage:" + s,
      text: stageLabels[s],
      clear: () =>
        set(
          "stages",
          f.stages.filter((x) => x !== s),
        ),
    })),
    ...(f.requirementsMatch
      ? [
          {
            key: "requirements",
            text: "ემთხვევა მოთხოვნებს",
            clear: () => set("requirementsMatch", false),
          },
        ]
      : []),
    ...(f.rated
      ? [{ key: "rated", text: "შეფასებული", clear: () => set("rated", false) }]
      : []),
    ...(f.phone
      ? [{ key: "phone", text: "ტელეფონით", clear: () => set("phone", false) }]
      : []),
    ...(f.hideRejected
      ? [
          {
            key: "rej",
            text: "უარის გარეშე",
            clear: () => set("hideRejected", false),
          },
        ]
      : []),
    ...(f.unchecked
      ? [
          {
            key: "unchecked",
            text: "შესამოწმებელი",
            clear: () => set("unchecked", false),
          },
        ]
      : []),
    ...(f.source !== "all"
      ? [
          {
            key: "src",
            text:
              f.source === "upload"
                ? "ატვირთული"
                : f.source === "cv_box"
                  ? "CV ყუთი"
                  : f.source === "base"
                    ? "JOBX-ის CV ბაზა"
                    : f.source === "own"
                      ? "თქვენი კანდიდატები"
                      : "ვაკანსიაზე გამოგზავნილი",
            clear: () => set("source", "all"),
          },
        ]
      : []),
    ...(f.period
      ? [
          {
            key: "period",
            text: f.period === 90 ? "ბოლო 3 თვე" : `ბოლო ${f.period} დღე`,
            clear: () => set("period", 0),
          },
        ]
      : []),
  ];
  return chips;
}

/** Accept v2 session data as well as current filters; discard malformed persisted values. */
export function normalizeFilters(value: unknown): Filters {
  const f: Filters = {...emptyFilters};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return f;
  const v = value as Record<string, unknown>;
  const strings = (key: string) => Array.isArray(v[key]) ? [...new Set((v[key] as unknown[]).filter((s): s is string => typeof s === 'string').map(norm).filter(Boolean))] : [];
  for (const key of ['positions','skills','cities','jobs'] as const) f[key] = strings(key);
  f.years = strings('years').filter(y => yearBands.some(b=>b.key===y));
  f.stages = strings('stages').filter((s): s is CandidateStage => candidateStages.includes(s as CandidateStage));
  f.languages = Array.isArray(v.languages) ? v.languages.flatMap(l => {
    if (!l || typeof l !== 'object' || typeof l.key !== 'string' || !norm(l.key)) return [];
    return [{key:norm(l.key), min: languageLevels.includes(l.min) ? l.min : ''}];
  }).filter((l,i,a)=>a.findIndex(x=>x.key===l.key)===i) : [];
  if (typeof v.query === 'string') f.query = v.query;
  if (educationLevels.includes(v.education as EducationLevel)) f.education = v.education as EducationLevel;
  for (const key of ['rated','phone','hideRejected','unchecked','requirementsMatch'] as const) f[key] = v[key] === true;
  if (v.skillMode === 'any') f.skillMode = 'any';
  if (['all','applied','upload','cv_box','base','own'].includes(v.source as string)) f.source = v.source as Filters['source'];
  if ([7,30,90].includes(v.period as number)) f.period = v.period as number;
  if (['match','recent','years','rating'].includes(v.sort as string)) f.sort = v.sort as Filters['sort'];
  return f;
}
export type SavedSearch = {id: string; name: string; filters: Filters};
export function accountStorageKeys(accountId: string) {
  const id = encodeURIComponent(accountId);
  return {filters:`company-talent-filters-v3:${id}`, searches:`company-talent-searches-v1:${id}`};
}
export function readSavedSearches(raw: string | null): SavedSearch[] {
  try {
    const list: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.filter((v): v is SavedSearch => !!v && typeof v.id === 'string' && typeof v.name === 'string' && !!v.name.trim() && !!v.filters && typeof v.filters === 'object')
      .map(v=>({id:v.id, name:v.name.trim().slice(0,80), filters:normalizeFilters(v.filters)}))
      .filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).slice(0,10);
  } catch { return []; }
}
export function saveSearch(list: SavedSearch[], name: string, filters: Filters, id: string): SavedSearch[] {
  const clean = name.trim().slice(0,80);
  if (!clean) throw new Error('მიუთითეთ ძებნის სახელი.');
  if (list.length >= 10) throw new Error('შეგიძლიათ შეინახოთ მაქსიმუმ 10 ძებნა.');
  return [...list, {id, name:clean, filters:normalizeFilters(filters)}];
}
export function deleteSearch(list: SavedSearch[], id: string): SavedSearch[] {
  return list.filter(s=>s.id!==id);
}

/** Only machine-read profiles need extraction/review notices. Manual corrections win. */
export function parseNotice(profile: CandidateProfile | null | undefined): string {
  if (profile?.origin !== 'parsed') return '';
  const reasons: Record<string, string> = {
    scanned: 'ფაილი სკანირებული სურათია, ტექსტი ვერ ამოიკითხა. მონაცემები შეგიძლიათ ხელით შეავსოთ.',
    unsupported: 'ამ ფაილიდან ტექსტის ამოკითხვა ვერ მოხერხდა. მონაცემები შეგიძლიათ ხელით შეავსოთ.',
    empty: 'ფაილში ტექსტი ვერ მოიძებნა. მონაცემები შეგიძლიათ ხელით შეავსოთ.',
    timeout: 'ფაილის ამოკითხვას დრო ამოეწურა. მონაცემები შეგიძლიათ ხელით შეავსოთ.',
    too_large: 'ფაილი 4 MB-ზე დიდი არ უნდა იყოს.',
    low_confidence: 'გადასამოწმებელია',
    approximate_dates: 'სამუშაოს თარიღები მიახლოებით ამოიკითხა. გთხოვთ, გადაამოწმოთ.',
  };
  return reasons[profile.parse?.reason ?? ''] ||
    (profile.parse && profile.parse.confidence < .75 ? 'გადასამოწმებელია' : '');
}

/** A missing file is not a failed extraction; manually maintained profiles are usable. */
export function parseState(profile: CandidateProfile | null, hasCv: boolean): string {
  if (!hasCv && profile?.origin !== 'edited') return '';
  if (profile?.origin === 'edited') return 'შემოწმებული';
  if (profile?.origin === 'jobx') return '';
  const usable = profile && (profile.text.trim() || profile.roles.length || profile.skills.length ||
    profile.languages.length || profile.education.length || profile.educationLevel || profile.years != null || profile.city);
  if (!usable) return hasCv ? 'ტექსტი ვერ ამოიკითხა' : '';
  return profile?.origin === 'parsed' ? 'ავტომატურად ამოკითხული' : '';
}
