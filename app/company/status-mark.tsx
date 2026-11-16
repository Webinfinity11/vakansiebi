import type { ComponentProps, ReactNode } from 'react';
import {
  Bookmark, ShieldCheck, Users, Eye, FilePenLine, GitMerge,
} from 'lucide-react';

/* Shared vacancy/status/stage mark. The visible label is supplied by the caller;
   the icon is redundant and decorative. No colour-only meaning or local palettes.
   Keep count markup (e.g. <b>) in children so existing interaction hooks survive. */
const marks: Record<string, ReactNode> = {
  published: <><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="5" stroke="white" /></>,
  pending: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" /></>,
  expiring: <><path d="M12 3a9 9 0 1 1-8.5 6" strokeWidth="3" /><path d="M12 7v5l3 2" /></>,
  archived: <><circle cx="12" cy="12" r="8" /><path d="M4 20 20 4" /></>,
  new: <path d="M12 4v16M4 12h16" />,
  interview: <><path d="M4 4h16v12H9l-5 4Z" /><path d="M8 8h8M8 12h5" /></>,
  offer: <path d="M3 7h18v14H3ZM8 7V3h8v4M3 12h18" />,
  hired: <path d="m5 12 5 5 9-11" />,
  rejected: <path d="m6 6 12 12M18 6 6 18" />,
  all: <path d="M5 5h14M5 12h14M5 19h14" />,
  update: <path d="M19 8a8 8 0 1 0 1 7M19 3v5h-5" />,
};
marks.review = marks.pending;
marks.cancelled = marks.rejected;
marks.paid = marks.hired;
const otherMarks = { owner: ShieldCheck, recruiter: Users, viewer: Eye, merged: GitMerge, draft: FilePenLine, shortlist: Bookmark };

export function StatusMark({ kind, className = '', children, ...props }: ComponentProps<'span'> & { kind: string }) {
  const Icon = otherMarks[kind as keyof typeof otherMarks];
  return (
    <span {...props} className={`cp-status-mark ${className}`} data-kind={kind}>
      {Icon ? <Icon aria-hidden="true" focusable="false" size={16} strokeWidth={1.7} /> : <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{marks[kind] ?? marks.all}</svg>}
      <span>{children}</span>
    </span>
  );
}
