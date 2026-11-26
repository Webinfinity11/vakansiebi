"use client";
import "./talent.css";
import { StatusMark } from "./status-mark";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "@/components/ui/popover";
import { personCity, positionLabel, readableSkills, parseState, parseNotice, type Person, type Filters, type Facets, emptyFilters, storageKey, stageRank, inProcess, levelLabel, yearsLabel, norm, terms, isNativeGeorgian, matchScore, snippet, passes, countFacets, filterChips, toggle, normalizeFilters, readSavedSearches, saveSearch, deleteSearch, accountStorageKeys, type SavedSearch } from "@/lib/company-talent-filters";
import { maxCvBytes } from "@/lib/cv-upload";
import { companyHref, plainClick } from "@/lib/company-portal-navigation";
import { CandidateSignals } from "./candidate-answers";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Upload,
  FileUp,
  Mail,
  Phone,
  ChevronDown,
  Star,
  X,
  SlidersHorizontal,
  FileSearch,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { SelectField } from "../select-field";
import {
  educationLabels,
  personKey,
  stageLabels,
  type Candidate,
  type CandidateProfile,
  type CandidateStage,
} from "@/lib/company-candidates";
import { timeAgo, type CompanyJob } from "./company-api";
import { Avatar } from "./avatar";

export function TalentView({
  canEdit,
  candidates,
  jobs,
  loaded,
  onOpen,
  onUploaded,
  onReveal,
}: {
  canEdit: boolean;
  candidates: Candidate[];
  jobs: CompanyJob[];
  loaded: boolean;
  onOpen: (entry: string) => void;
  onReveal: (entry: string) => Promise<void>;
  onUploaded: (entry: string, duplicate: boolean) => Promise<void>;
}) {
  const [f, setFilters] = useState<Filters>(emptyFilters);
  const [shownCount, setShownCount] = useState(50);
  // Every filter update, including restoring a saved search, starts a new list.
  const setF = (next: React.SetStateAction<Filters>) => {
    setFilters(next);
    setShownCount(50);
  };
  const [uploading, setUploading] = useState(false);
  const [panel, setPanel] = useState(false);
  const [accountKey, setAccountKey] = useState("");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [storageError, setStorageError] = useState("");
  const filterTriggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelTrigger = useRef<HTMLButtonElement | null>(null);
  // Resolve the authenticated account without changing the parent portal's API.
  useEffect(() => {
    let alive = true;
    fetch("/api/company/session", {cache:"no-store"}).then(async res => {
      if (!res.ok) throw new Error();
      const identity = await res.json();
      if (!identity?.id || !alive) return;
      const keys = accountStorageKeys(identity.id);
      try {
        const current = sessionStorage.getItem(keys.filters);
        const legacy = sessionStorage.getItem(storageKey);
        if (current || legacy) {
          const restored = normalizeFilters(JSON.parse(current || legacy!));
          setF(restored);
          sessionStorage.setItem(keys.filters, JSON.stringify(restored));
          if (!current && legacy) sessionStorage.removeItem(storageKey);
        }
        setSavedSearches(readSavedSearches(localStorage.getItem(keys.searches)));
      } catch { setStorageError("ბრაუზერში ძებნის შენახვა ვერ მოხერხდა."); }
      setAccountKey(identity.id);
    }).catch(() => {if(alive) setStorageError("შენახული ძებნების ჩატვირთვა ვერ მოხერხდა.");});
    return () => {alive = false;};
  }, []);
  useEffect(() => {
    if (!accountKey) return;
    try { sessionStorage.setItem(accountStorageKeys(accountKey).filters, JSON.stringify(f)); }
    catch { /* Filtering remains available when browser storage is disabled. */ }
  }, [f, accountKey]);
  const persistSearches = (list: SavedSearch[]) => {
    if (!accountKey) return false;
    try {
      localStorage.setItem(accountStorageKeys(accountKey).searches, JSON.stringify(list));
      setSavedSearches(list);
      setStorageError("");
      return true;
    } catch { setStorageError("ბრაუზერში ძებნის შენახვა ვერ მოხერხდა."); return false; }
  };
  const openPanel = (event: React.MouseEvent<HTMLButtonElement>) => {
    panelTrigger.current = event.currentTarget;
    setPanel(true);
  };
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const c of candidates) {
      const key = personKey(c);
      const p = map.get(key);
      if (!p)
        map.set(key, {
          key,
          latest: c,
          entries: [c],
          stage: c.stage,
          rating: c.rating,
          profile: c.profile,
          city: "",
          haystack: "",
        });
      else {
        p.entries.push(c);
        if (c.appliedAt > p.latest.appliedAt) p.latest = c;
        // The stage is the furthest the person got in the company's own process.
        if (inProcess(c) && (!p.entries.some((e) => e !== c && inProcess(e)) || stageRank(c.stage) > stageRank(p.stage))) p.stage = c.stage;
        p.rating = Math.max(p.rating ?? 0, c.rating ?? 0) || null;
        // A corrected profile wins over a JOBX one, which wins over one read from a file.
        const rank = (x: CandidateProfile | null) =>
          !x ? 0 : x.origin === "edited" ? 3 : x.origin === "jobx" ? 2 : 1;
        if (rank(c.profile) > rank(p.profile)) p.profile = c.profile;
      }
    }
    for (const p of map.values()) {
      p.city = personCity(p.profile, [p.latest, ...p.entries]);
      p.haystack = norm(
        [
          ...p.entries.flatMap((c) => [
            c.name,
            c.title,
            c.email,
            c.phone,
            c.jobTitle,
            c.city,
          ]),
          p.profile?.text ?? "",
          ...(p.profile?.skills ?? []),
          ...(p.profile?.roles ?? []),
        ].join(" \n "),
      );
    }
    return [...map.values()];
  }, [candidates]);

  const words = useMemo(() => terms(f.query), [f.query]);
  const since = f.period ? Date.now() - f.period * 86400000 : 0;

  const visible = useMemo(() => {
    const rows = people
      .filter((p) => passes(p, f, words, since))
      .map((p) => ({ p, score: words.length ? matchScore(p, words) : 0 }));
    const recent = (a: Person, b: Person) =>
      b.latest.appliedAt.localeCompare(a.latest.appliedAt);
    rows.sort((a, b) =>
      f.sort === "years"
        ? (b.p.profile?.years ?? -1) - (a.p.profile?.years ?? -1) ||
          recent(a.p, b.p)
        : f.sort === "rating"
          ? (b.p.rating ?? 0) - (a.p.rating ?? 0) || recent(a.p, b.p)
          : f.sort === "match" && words.length
            ? b.score - a.score || recent(a.p, b.p)
            : recent(a.p, b.p),
    );
    return rows.map((r) => r.p);
  }, [people, f, words, since]);

  const facets = useMemo(() => countFacets(people, f, jobs, since), [people, f, jobs, since]);
  const chips = filterChips(f, facets, set);
  const reset = () => setF({ ...emptyFilters, sort: f.sort });
  const sortLabels: Record<Filters["sort"], string> = {
    match: words.length ? "დამთხვევით" : "ახალი პირველი",
    recent: "ახალი პირველი",
    years: "გამოცდილებით",
    rating: "შეფასებით",
  };

  const filterProps = { f, set, toggle, facets };
  const advancedCount = chips.filter(c => !/^(query|position:|city:|years:|skill:|lang:)/.test(c.key)).length;
  const primaryGroups = ["positions", "cities", "years", "skills", "languages"] as const;
  const groupLabels = {positions:"პოზიცია", cities:"ქალაქი", years:"გამოცდილება", skills:"უნარები", languages:"ენები"};

  return (
    <>
      <header className="cp-head">
        <div className="cp-head-title">
          <h1>CV ბაზა</h1>
          {loaded && <span>{people.length}</span>}
        </div>
        <div className="cp-head-actions">
          {canEdit && (
            <button
              type="button"
              className="cp-btn cp-btn--primary"
              onClick={() => setUploading(true)}
            >
              <Upload size={16} />
               CV-ის ატვირთვა </button>
          )}
        </div>
      </header>
      {!loaded ? (
        <div className="cc-empty">იტვირთება…</div>
      ) : !people.length ? (
        <div className="cp-empty">
          <h2>ბაზა ჯერ ცარიელია</h2>
          <p>
             აქ გროვდება ვაკანსიებზე გამოგზავნილი CV-ები. სხვა წყაროდან მიღებული რეზიუმეებიც ატვირთეთ, რომ ყველაფერი ერთ ადგილას გქონდეთ. </p>
          {canEdit && (
            <button
              type="button"
              className="cp-btn cp-btn--primary"
              onClick={() => setUploading(true)}
            >
              <Upload size={16} />
               CV-ის ატვირთვა </button>
          )}
        </div>
      ) : (
        <div className="ct-layout ct-layout--horizontal">
          <aside className="ct-facets-desktop" aria-label="ფილტრები"><FilterPanel {...filterProps} /></aside>
          <div className="ct-main">
            <div className="ct-sticky">
            <div className="ct-searchbar">
              <label className="cp-search ct-search">
                <Search size={16} />
                <input
                  type="search"
                  aria-label="ბაზაში ძიება"
                  placeholder="ძებნა CV-ში: უნარი, პოზიცია, კომპანია, სიტყვა"
                  value={f.query}
                  onChange={(e) => set("query", e.target.value)}
                />
              </label>
              <button
                type="button"
                className="cp-btn ct-panel-btn"
                onClick={openPanel}
              >
                <SlidersHorizontal size={15} />
                 ფილტრები {!!chips.length && <b>{chips.length}</b>}
              </button>
            </div>
            <div className="ct-filterbar" aria-label="ფილტრები">
              {primaryGroups.map(group => <Popover key={group}>
                <PopoverTrigger ref={node => { filterTriggers.current[group] = node; }} className="cp-btn ct-filter-trigger">
                  {groupLabels[group]}{!!f[group].length && <b>{f[group].length}</b>}<ChevronDown size={14}/>
                </PopoverTrigger>
                <PopoverContent align="start" className="ct-popover" finalFocus={() => filterTriggers.current[group]}>
                  <PopoverTitle>{groupLabels[group]}</PopoverTitle>
                  <FilterPanel {...filterProps} group={group}/>
                </PopoverContent>
              </Popover>)}
              <button type="button" className="cp-btn ct-all-filters" onClick={openPanel}>
                <SlidersHorizontal size={16}/>ყველა ფილტრი{!!advancedCount && <b>{advancedCount}</b>}
              </button>
            </div>
            {storageError && !saving && <p className="cp-alert" role="alert">{storageError}</p>}
            {!!chips.length && (
              <div className="ct-chips" aria-label="არჩეული ფილტრები">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="ct-chip"
                    onClick={c.clear}
                    aria-label={`${c.text} — მოხსნა`}
                  >
                    {c.text}
                    <X size={13} />
                  </button>
                ))}
                <button type="button" className="ct-clear" onClick={reset}>
                   გასუფთავება </button>
              </div>
            )}
            <div className="ct-result">
              <span>
                {chips.length || words.length
                  ? `${people.length}-დან ${visible.length} კანდიდატი`
                  : `${people.length} კანდიდატი`}
              </span>
              <div className="ct-saved-actions">
                <button type="button" className="ct-clear" disabled={!accountKey} onClick={()=>{setStorageError("");setSearchName("");setSaving(true);}}>ძებნის შენახვა</button>
                <Popover>
                  <PopoverTrigger className="ct-clear">შენახული ძებნები ({savedSearches.length})<ChevronDown size={14}/></PopoverTrigger>
                  <PopoverContent align="start" className="ct-popover">
                    <PopoverTitle>შენახული ძებნები</PopoverTitle>
                    {!savedSearches.length && <p>შენახული ძებნები ჯერ არ გაქვთ.</p>}
                    {savedSearches.map(search=><div className="ct-saved-row" key={search.id}>
                      <button type="button" onClick={()=>setF(normalizeFilters(search.filters))}>{search.name}</button>
                      <button type="button" aria-label={`${search.name} — წაშლა`} onClick={()=>persistSearches(deleteSearch(savedSearches,search.id))}><X size={16}/></button>
                    </div>)}
                  </PopoverContent>
                </Popover>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="ct-sort">
                  {sortLabels[f.sort]}
                  <ChevronDown size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuRadioGroup
                    value={f.sort}
                    onValueChange={(v) => set("sort", v as Filters["sort"])}
                  >
                    <DropdownMenuRadioItem closeOnClick value="match">
                      {words.length ? "დამთხვევით" : "ახალი პირველი"}
                    </DropdownMenuRadioItem>
                    {words.length > 0 && (
                      <DropdownMenuRadioItem closeOnClick value="recent">
                         ახალი პირველი </DropdownMenuRadioItem>
                    )}
                    <DropdownMenuRadioItem closeOnClick value="years">
                       გამოცდილებით </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem closeOnClick value="rating">
                       შეფასებით </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </div>
            {!visible.length ? (
              <div className="cp-empty cp-empty--small">
                <p>ამ ფილტრებით კანდიდატი ვერ მოიძებნა.</p>
                <button type="button" className="cp-btn" onClick={reset}>
                   ფილტრების მოხსნა </button>
              </div>
            ) : (
              <>
              <ul className="ct-list" aria-label="კანდიდატები">
                {visible.slice(0, shownCount).map((p) => (
                  <PersonRow
                    key={p.key}
                    p={p}
                    words={words}
                    skillsOn={f.skills}
                    onOpen={onOpen}
                    onReveal={onReveal}
                  />
                ))}
              </ul>
              <div className="ct-pagination">
                <p role="status" aria-live="polite" aria-atomic="true">
                  ნაჩვენებია {Math.min(shownCount, visible.length)} / {visible.length}
                </p>
                {visible.length > 50 && (
                  <button
                    type="button"
                    className="cp-btn"
                    aria-disabled={shownCount >= visible.length}
                    onClick={() => {
                      if (shownCount < visible.length) setShownCount(count => count + 50);
                    }}
                  >
                    მეტის ჩვენება
                  </button>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      )}
      <Sheet open={panel} onOpenChange={setPanel}>
        <SheetContent side="right" className="ct-sheet" closeLabel="დახურვა" finalFocus={panelTrigger}>
          <SheetTitle>ფილტრები</SheetTitle>
          <SheetDescription className="sr-only">
             CV ბაზის ფილტრები </SheetDescription>
          <div className="ct-sheet-body"><FilterPanel {...filterProps} /></div>
          <div className="ct-sheet-foot">
            <button
              type="button"
              className="cp-btn cp-btn--ghost"
              onClick={reset}
            >
               გასუფთავება </button>
            <button
              type="button"
              className="cp-btn cp-btn--primary"
              onClick={() => setPanel(false)}
            >
              {visible.length}  კანდიდატის ნახვა </button>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="cp-dialog">
          <DialogTitle>ძებნის შენახვა</DialogTitle>
          <DialogDescription>ძებნა ინახება ამ ბრაუზერში, თქვენი ანგარიშისთვის. მაქსიმუმ 10 ძებნა.</DialogDescription>
          <form onSubmit={event=>{event.preventDefault();try {
            const list=saveSearch(savedSearches,searchName,f,crypto.randomUUID());
            if(persistSearches(list)) setSaving(false);
          } catch(error) {setStorageError(error instanceof Error ? error.message : "ბრაუზერში ძებნის შენახვა ვერ მოხერხდა.");}}}>
            <label className="ct-save-label">ძებნის სახელი<input className="cp-input" autoFocus maxLength={80} value={searchName} onChange={event=>setSearchName(event.target.value)} required/></label>
            {storageError && <p role="alert" className="cp-alert">{storageError}</p>}
            <div className="cp-dialog-actions">
              <button type="button" className="cp-btn" onClick={()=>setSaving(false)}>გაუქმება</button>
              <button type="submit" className="cp-btn cp-btn--primary" disabled={!searchName.trim() || !accountKey}>შენახვა</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <UploadDialog
        open={canEdit && uploading}
        jobs={jobs}
        onClose={() => setUploading(false)}
        onUploaded={async (entry, duplicate) => {
          setUploading(false);
          await onUploaded(entry, duplicate);
        }}
      />
    </>
  );
}

function Facet({
  title,
  count,
  children,
  open: initial = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="ct-facet" open={initial}>
      <summary>
        {title}
        {!!count && <b>{count}</b>}
        <ChevronDown size={14} />
      </summary>
      <div className="ct-facet-body">{children}</div>
    </details>
  );
}

function Check({
  checked,
  onChange,
  label,
  n,
  dot,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  n?: number;
  dot?: CandidateStage;
}) {
  return (
    <label
      className="ct-check"
      data-empty={!checked && n === 0 ? "" : undefined}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      {dot ? <StatusMark kind={dot} data-stage={dot}>{label}</StatusMark> : <span>{label}</span>}
      {n != null && <small>{n}</small>}
    </label>
  );
}

type PrimaryGroup = "positions" | "cities" | "years" | "skills" | "languages";
function FilterPanel({ f, set, toggle, facets, group }: {
  f: Filters;
  set: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggle: <T>(list: T[], value: T) => T[];
  facets: Facets;
  group?: PrimaryGroup;
}) {
  const [queries, setQueries] = useState<Record<string,string>>({});
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const options = (key: "positions" | "cities" | "skills") => {
    const query = norm(queries[key] ?? "");
    const matches = facets[key].filter(o=>o.key.includes(query));
    const shown = group || query || expanded[key] ? matches : matches.slice(0,6);
    return <>
    <label className="ct-facet-search"><Search size={14}/>
      <input type="search" placeholder={key === "positions" ? "პოზიციის ძებნა" : key === "cities" ? "ქალაქის ძებნა" : "უნარის ძებნა"}
        aria-label={key === "positions" ? "პოზიციის ძებნა" : key === "cities" ? "ქალაქის ძებნა" : "უნარის ძებნა"}
        value={queries[key] ?? ""} onChange={event=>setQueries({...queries,[key]:event.target.value})}/>
    </label>
    {key === "skills" && f.skills.length > 1 && <div className="ct-seg" role="group" aria-label="უნარების პირობა">
      <button type="button" aria-pressed={f.skillMode === "all"} onClick={()=>set("skillMode","all")}>ყველა არჩეული</button>
      <button type="button" aria-pressed={f.skillMode === "any"} onClick={()=>set("skillMode","any")}>ერთ-ერთი მაინც</button>
    </div>}
    {shown.map(o=><Check key={o.key} checked={f[key].includes(o.key)} onChange={()=>set(key,toggle(f[key],o.key))} label={o.label} n={o.n}/>)}
    {!matches.length && <p className="ct-facet-empty">ვარიანტი ვერ მოიძებნა</p>}
    {!group && !query && matches.length > 6 && <button type="button" className="ct-options-toggle" aria-expanded={!!expanded[key]}
      onClick={()=>setExpanded({...expanded,[key]:!expanded[key]})}>{expanded[key] ? "ნაკლები" : `ყველა (${matches.length})`}</button>}
  </>;
  };
  const groups: {key:string;title:string;count:number;body:React.ReactNode}[] = [
    {key:"positions", title:"პოზიცია", count:f.positions.length, body:options("positions")},
    {key:"cities", title:"ქალაქი", count:f.cities.length, body:options("cities")},
    {key:"years", title:"გამოცდილება", count:f.years.length, body:<>{facets.years.map(b=><Check key={b.key} checked={f.years.includes(b.key)} onChange={()=>set("years",toggle(f.years,b.key))} label={b.label} n={b.n}/>)}{!facets.years.length && <p className="ct-facet-empty">ვარიანტი ვერ მოიძებნა</p>}</>},
    {key:"skills", title:"უნარები", count:f.skills.length, body:options("skills")},
    {key:"languages", title:"ენები", count:f.languages.length, body:<>
      {facets.languages.map(l=>{ const selected=f.languages.find(x=>x.key===l.key); return <div className="ct-lang" key={l.key}>
        <Check checked={!!selected} label={l.label} n={l.n} onChange={()=>set("languages",selected?f.languages.filter(x=>x.key!==l.key):[...f.languages,{key:l.key,min:""}])}/>
        {selected && <select className="ct-level" aria-label={`${l.label}: მინიმალური დონე`} value={selected.min} onChange={event=>set("languages",f.languages.map(x=>x.key===l.key?{...x,min:event.target.value}:x))}>
          <option value="">ნებისმიერი დონე</option>{["a2","b1","b2","c1","c2","native"].map(value=><option key={value} value={value}>{levelLabel(value)}  ან მეტი</option>)}
        </select>}
      </div>;})}
      {!facets.languages.length && <p className="ct-facet-empty">ვარიანტი ვერ მოიძებნა</p>}
    </>},
    {key:"education",title:"განათლება",count:Number(!!f.education),body:<>
      <Check checked={!f.education} onChange={()=>set("education","")} label="ნებისმიერი"/>
      {facets.education.map(e=><Check key={e.key} checked={f.education===e.key} onChange={()=>set("education",f.education===e.key?"":e.key)} label={`${educationLabels[e.key]}${e.key!=="phd"?" ან მეტი":""}`} n={e.n}/>)}
    </>},
    {key:"vacancy",title:"ვაკანსია და შერჩევის ეტაპი",count:f.jobs.length+f.stages.length,body:<div className="ct-vacancy-groups">
      <div><h3>ვაკანსია</h3>{facets.jobs.map(j=><Check key={j.key} checked={f.jobs.includes(j.key)} onChange={()=>set("jobs",toggle(f.jobs,j.key))} label={j.label} n={j.n}/>)}</div>
      <div><h3>ეტაპი</h3>{facets.stages.map(stage=><Check key={stage.key} checked={f.stages.includes(stage.key)} onChange={()=>set("stages",toggle(f.stages,stage.key))} label={stageLabels[stage.key]} n={stage.n} dot={stage.key}/>)}</div>
    </div>},
    {key:"source",title:"წყარო და თარიღი",count:Number(f.source!=="all")+Number(!!f.period),body:<>
      <label className="ct-select">წყარო<select value={f.source} onChange={event=>set("source",event.target.value as Filters["source"])}>
        <option value="all">ყველა</option><option value="applied">ვაკანსიაზე გამოგზავნილი</option><option value="upload">თქვენ მიერ ატვირთული</option><option value="cv_box">CV ყუთი</option><option value="base">JOBX-ის CV ბაზა</option>{f.source==="own" && <option value="own">თქვენი კანდიდატები</option>}
      </select></label>
      <label className="ct-select">როდის დაემატა<select value={String(f.period)} onChange={event=>set("period",Number(event.target.value))}>
        <option value="0">ნებისმიერ დროს</option><option value="7">ბოლო 7 დღე</option><option value="30">ბოლო 30 დღე</option><option value="90">ბოლო 3 თვე</option>
      </select></label>
    </>},
    {key:"state",title:"დამატებით",count:Number(f.unchecked)+Number(f.rated)+Number(f.phone)+Number(f.hideRejected)+Number(f.requirementsMatch),body:<>
      {f.unchecked && <Check checked onChange={()=>set("unchecked",false)} label="შეუმოწმებელი ამოკითხვა" n={facets.unchecked}/>}
      <Check checked={f.phone} onChange={()=>set("phone",!f.phone)} label="აქვს ტელეფონი"/>
      <Check checked={f.rated} onChange={()=>set("rated",!f.rated)} label="შეფასებული"/>
      <Check checked={f.hideRejected} onChange={()=>set("hideRejected",!f.hideRejected)} label="უარყოფილების დამალვა"/>
      <Check checked={f.requirementsMatch} onChange={()=>set("requirementsMatch",!f.requirementsMatch)} label="ემთხვევა მოთხოვნებს"/>
    </>},
  ];
  if(group) return <div className="ct-popover-options">{groups.find(g=>g.key===group)?.body}</div>;
  return <div className="ct-panel">{groups.map((g,index)=><div key={g.key} className={index<5?"ct-sheet-primary":"ct-sheet-advanced"}>
    <Facet title={g.title} count={g.count} open={index<3}>{g.body}</Facet>
  </div>)}</div>;
}

function PersonRow({
  p,
  words,
  skillsOn,
  onOpen,
  onReveal,
}: {
  p: Person;
  words: string[];
  skillsOn: string[];
  onOpen: (entry: string) => void;
  onReveal: (entry: string) => Promise<void>;
}) {
  const [revealing, setRevealing] = useState(false);
  const profile = p.profile;
  // Only a CV whose text could not be read needs a word on the card; "read automatically" is noise.
  const state = parseState(profile, p.entries.some(e=>e.hasCv)) === "ტექსტი ვერ ამოიკითხა" ? "ტექსტი ვერ ამოიკითხა" : "";
  const active = p.entries.some(inProcess);
  // One CV, one card: the vacancies the person is considered for, and where the CV came from.
  const vacancies = p.entries.filter((e) => inProcess(e) && e.jobTitle);
  const sources = [...new Set(p.entries.map((e) =>
    e.source === "upload" ? "თქვენ მიერ ატვირთული" : e.source === "cv_box" ? "CV ყუთი" : e.source === "base" ? "JOBX-ის CV ბაზა" : "ვაკანსიაზე გამოგზავნილი"))];
  const notice = p.entries.some(e=>e.hasCv) ? parseNotice(profile) : "";
  const phone = p.entries.find((e) => e.phone)?.phone;
  const email = p.entries.find((e) => e.email)?.email;
  const hidden = !phone && !email ? p.entries.find((e) => e.contactHidden) : undefined;
  // Skills that match the filter or the search come first and are marked.
  const hit = (s: string) =>
    skillsOn.includes(norm(s)) || words.some((w) => norm(s).includes(w));
  const skills = [...readableSkills(p)].sort(
    (a, b) => Number(hit(b)) - Number(hit(a)),
  );
  const shown = skills.slice(0, 5);
  const quote = snippet(p, words);
  const languages = (profile?.languages ?? []).filter(
    (l) => !isNativeGeorgian(l),
  );
  const facts = [
    profile?.years != null ? yearsLabel(profile.years) + " გამოცდილება" : "",
    profile?.educationLevel ? educationLabels[profile.educationLevel] : "",
    languages
      .slice(0, 3)
      .map((l) => [l.name, levelLabel(l.level)].filter(Boolean).join(" "))
      .join(", "),
  ].filter(Boolean);
  return (
    <li className="ct-card">
      <a
        className="ct-card-open"
        href={companyHref({ tab: "talent", entry: p.latest.entry })}
        onClick={(event) => {
          if (!plainClick(event)) return;
          event.preventDefault();
          onOpen(p.latest.entry);
        }}
        aria-label={`${p.latest.name} — გახსნა`}
      />
      <Avatar
        name={p.latest.name}
        entry={(p.entries.find((e) => e.photo) ?? p.latest).entry}
        photo={p.entries.some((e) => e.photo)}
      />
      <div className="ct-card-main">
        <div className="ct-card-top">
          <strong>{p.latest.name}</strong>
          {active && <StatusMark kind={p.stage} data-stage={p.stage}>{stageLabels[p.stage]}</StatusMark>}
          {!!p.rating && (
            <span
              className="cc-mini-rating"
              aria-label={`შეფასება ${p.rating}`}
            >
              <Star size={12} />
              {p.rating}
            </span>
          )}
          <span className="ct-card-date">{timeAgo(p.latest.appliedAt)}</span>
        </div>
        <p className="ct-card-role">
          {[(profile?.roles ?? []).find((r) => positionLabel(r.split(/\s+[—–]\s+/)[0])) || positionLabel(p.latest.title), p.city]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {!!facts.length && <p className="ct-card-facts">{facts.join(" · ")}</p>}
        {!!shown.length && (
          <div className="ct-tag-list">
            {shown.map((s) => (
              <span key={s} className="ct-tag" data-hit={hit(s) || undefined}>
                {s}
              </span>
            ))}
            {skills.length > shown.length && (
              <span className="ct-more">+{skills.length - shown.length}</span>
            )}
          </div>
        )}
        {quote && <q className="ct-quote">{quote}</q>}
        {notice && <p className="ct-parse-notice">{notice}</p>}
        <div className="ct-card-foot">
          <div className="ct-entries">
            {state && <span className="ct-origin" title={notice || undefined}>
              <StatusMark kind="review">{state}</StatusMark>
            </span>}
            {vacancies.map((e) => (
              <button type="button" className="ct-job" key={e.entry} onClick={() => onOpen(e.entry)}>
                {/* The card's top already shows the stage; per vacancy only when there are several. */}
                {vacancies.length > 1 ? `${e.jobTitle} · ${stageLabels[e.stage]}` : e.jobTitle}
                <CandidateSignals candidate={e} />
              </button>
            ))}
            <span className="ct-source">{sources.join(" · ")}</span>
          </div>
          {/* One contact slot in the same place on every card: a closed CV base
              contact and an open one use the same pill. */}
          {(hidden || phone || email) && (
            <span className="ct-reach">
              {hidden ? (
                <button
                  type="button"
                  className="ct-pill ct-reveal"
                  disabled={revealing}
                  title="ნახვა აღირიცხება"
                  onClick={async () => {
                    setRevealing(true);
                    await onReveal(hidden.entry);
                    setRevealing(false);
                  }}
                >
                  <Phone size={13} />
                  {revealing ? "იხსნება…" : "კონტაქტის ნახვა"}
                </button>
              ) : (
                <>
                  {phone && (
                    <a className="ct-pill" href={`tel:${phone.replace(/\s/g, "")}`} title={phone}>
                      <Phone size={13} />
                      <span>{phone}</span>
                    </a>
                  )}
                  {email && (
                    <a className="ct-pill" href={`mailto:${email}`} title={email} aria-label={email}>
                      <Mail size={13} />
                    </a>
                  )}
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function UploadDialog({
  open,
  jobs,
  onClose,
  onUploaded,
}: {
  open: boolean;
  jobs: CompanyJob[];
  onClose: () => void;
  onUploaded: (entry: string, duplicate: boolean) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [job, setJob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function reset() {
    setFile(null);
    setName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setJob("");
    setError("");
  }
  function choose(f: File | undefined) {
    if (!f) return;
    setError("");
    if (!/\.(pdf|docx?|odt|rtf|txt)$/i.test(f.name))
      return setError("ატვირთეთ PDF, Word (DOC, DOCX), ODT, RTF ან TXT ფაილი.");
    if (f.size > maxCvBytes)
      return setError("ფაილი 4 MB-ზე დიდი არ უნდა იყოს.");
    setFile(f);
    if (!name)
      setName(
        f.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .trim(),
      );
  }
  async function submit() {
    if (!file) return setError("აირჩიეთ CV ფაილი.");
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      form.set("email", email);
      form.set("phone", phone);
      form.set("title", title);
      form.set("jobId", job);
      const res = await fetch("/api/company/candidates/upload", {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw Error(body.error || "ატვირთვა ვერ მოხერხდა");
      reset();
      await onUploaded(body.entry, body.duplicate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ატვირთვა ვერ მოხერხდა");
    } finally {
      setBusy(false);
    }
  }
  const openJobs = jobs.filter((j) => j.status !== "merged");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="cp-dialog ct-upload">
        <DialogTitle>CV-ის ატვირთვა</DialogTitle>
        <DialogDescription>
           PDF, Word, ODT, RTF ან TXT, მაქსიმუმ 4 MB. ფაილს მხოლოდ თქვენი კომპანია ხედავს. </DialogDescription>
        <button
          type="button"
          className="ct-drop"
          data-over={over || undefined}
          data-file={file ? "" : undefined}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            choose(e.dataTransfer.files[0]);
          }}
        >
          <FileUp size={22} />
          {file ? (
            <span>
              <strong>{file.name}</strong>
              <small>
                {Math.round(file.size / 1024)}  KB · შესაცვლელად დააჭირეთ </small>
            </span>
          ) : (
            <span>
              <strong>ჩააგდეთ ფაილი აქ</strong>
              <small>ან დააჭირეთ ასარჩევად</small>
            </span>
          )}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          accept=".pdf,.doc,.docx,.odt,.rtf,.txt"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="cp-fields ct-fields">
          <label>
             სახელი და გვარი <input
              className="cp-input"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
             პოზიცია ან პროფესია <input
              className="cp-input"
              value={title}
              maxLength={120}
              placeholder="მაგ.: ბუღალტერი"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="company-form-grid">
            <label>
               ელფოსტა <input
                className="cp-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
               ტელეფონი <input
                className="cp-input"
                type="tel"
                value={phone}
                maxLength={32}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <label htmlFor="ct-job">
             ვაკანსია (არასავალდებულო) <SelectField
              id="ct-job"
              label="ვაკანსია"
              placeholder="ვაკანსიის გარეშე"
              options={[
                { value: "", label: "ვაკანსიის გარეშე" },
                ...openJobs.map((j) => ({ value: j.id, label: j.title })),
              ]}
              value={job}
              onChange={setJob}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="cp-alert">
            {error}
          </p>
        )}
        <div className="cp-dialog-actions">
          <button
            type="button"
            className="cp-btn cp-btn--ghost"
            disabled={busy}
            onClick={() => {
              reset();
              onClose();
            }}
          >
             გაუქმება </button>
          <button
            type="button"
            className="cp-btn cp-btn--primary"
            disabled={busy || !file}
            onClick={() => void submit()}
          >
            {busy ? "იტვირთება…" : "ატვირთვა"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
