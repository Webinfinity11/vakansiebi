"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Briefcase, ChevronDown, Plus } from "lucide-react";
import type { Candidate } from "@/lib/company-candidates";
import { companyHref } from "@/lib/company-portal-navigation";
import type { CompanyJob } from "./company-api";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import "./add-to-candidates.css";

export type CandidateControl = Pick<Candidate, "entry" | "source" | "added" | "saved" | "jobId" | "jobTitle">;

export function AddToCandidates({candidate, canEdit, onAdded}: {
  candidate: CandidateControl; canEdit: boolean; onAdded?: (candidate: Candidate) => void;
}) {
  const [saved, setSaved] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const current = saved ?? candidate;
  if (current.added || current.source === "upload") return <span className="ct-add-result" role="status">
    <span>✓ კანდიდატებშია ·</span><a href={companyHref({tab:"candidates",entry:current.entry})}>ნახვა</a>
  </span>;
  if (!canEdit || current.source !== "base") return null;
  return <div className="ct-add">
    <button type="button" className="cp-btn cp-btn--ghost cp-btn--sm" disabled={busy} onClick={async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true); setError("");
      try {
        const res = await fetch("/api/company/candidates", {method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"add",entry:candidate.entry})});
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "დამატება ვერ მოხერხდა.");
        setSaved(body); onAdded?.(body);
      } catch (e) { setError(e instanceof Error ? e.message : "დამატება ვერ მოხერხდა."); }
      finally { lock.current = false; setBusy(false); }
    }}><Plus size={14}/>კანდიდატებში დამატება</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function AddToVacancy({candidate, jobs, canEdit, onAdded}: {
  candidate: CandidateControl; jobs: CompanyJob[]; canEdit: boolean;
  onAdded?: (candidate: Candidate) => void;
}) {
  const [saved, setSaved] = useState<Candidate | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const current = saved ?? candidate;
  const added = current.added;
  const openJobs = jobs.filter(j => j.status === "published" && (!j.form.deadline || j.form.deadline >= new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Tbilisi"})));
  async function add(jobId: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const res = await fetch("/api/company/candidates", {method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"add",entry:candidate.entry,jobId})});
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "დამატება ვერ მოხერხდა.");
      setSaved(body); setOpen(false); onAdded?.(body);
    } catch (e) { setError(e instanceof Error ? e.message : "დამატება ვერ მოხერხდა."); }
    finally {lock.current=false;setBusy(false);}
  }
  if (added?.jobId || current.jobId) return <span className="ct-add-result">{added?.jobTitle || current.jobTitle}</span>;
  if (!canEdit || !openJobs.length || !["base","upload"].includes(current.source)) return null;
  return <div className="ct-add">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="cp-btn cp-btn--secondary cp-btn--sm"><Briefcase size={15}/>ვაკანსიის არჩევა<ChevronDown size={14}/></PopoverTrigger>
      <PopoverContent className="ct-add-menu" align="end" aria-label="აირჩიეთ ვაკანსია">
        {openJobs.map(j=><button type="button" key={j.id} disabled={busy} onClick={()=>void add(j.id)}>{j.title}</button>)}
        {error && <p role="alert">{error}</p>}
      </PopoverContent>
    </Popover>
  </div>;
}

export function SaveCandidate({candidate, canEdit, onChange}: {
  candidate: Pick<Candidate, 'entry' | 'source' | 'saved'>; canEdit: boolean;
  onChange?: (candidate: Candidate) => void;
}) {
  const [saved, setSaved] = useState(!!candidate.saved);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {setSaved(!!candidate.saved);}, [candidate.entry,candidate.saved]);
  if (!['base','upload','cv_box'].includes(candidate.source)) return null;
  return <span className="ct-save">
    <button type="button" className="cp-icon-btn" disabled={!canEdit || busy}
      title={saved ? 'შენახულია' : 'შენახვა'} aria-label={saved ? 'შენახულია — მოხსნა' : 'შენახვა'} aria-pressed={saved}
      onClick={async () => {
        if(lock.current) return;
        lock.current=true;setBusy(true);setError('');const next=!saved;setSaved(next);
        try {
          const response=await fetch('/api/company/candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',entry:candidate.entry,saved:next})});
          const body=await response.json();if(!response.ok) throw new Error(body.error || 'ვერ შეინახა');
          onChange?.(body);
        } catch(error) {setSaved(!next);setError(error instanceof Error ? error.message : 'ვერ შეინახა');}
        finally {lock.current=false;setBusy(false);}
      }}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'}/></button>
    {error && <span role="alert">{error}</span>}
  </span>;
}
