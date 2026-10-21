'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { SearchFilters } from '@/lib/personal-space';
import { readSearch, searchParams } from '@/lib/search-state';

export function FiltersSheet({
  open,
  onOpenChange,
  value,
  onChange,
  onApply,
  children,
  withEmail = false,
  className = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onApply: () => void;
  children: ReactNode;
  withEmail?: boolean;
  className?: string;
}) {
  const key = searchParams(value).toString();
  const requestKey = key + (withEmail ? '&withEmail=1' : '');
  const [count, setCount] = useState<{ key: string; total: number } | null>(
    null,
  );
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/jobs?${requestKey}&summary=1&page=1`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (
            !controller.signal.aborted &&
            body &&
            typeof body.total === 'number'
          )
            setCount({ key: requestKey, total: body.total });
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, requestKey]);
  const total = count?.key === requestKey ? count.total : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`mobile-filters-sheet ${className}`}
      >
        <SheetHeader>
          <SheetTitle>ფილტრები</SheetTitle>
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--sm mobile-filters-clear"
            disabled={!key}
            onClick={() => onChange(readSearch(new URLSearchParams()))}
          >
            გასუფთავება
          </button>
          <SheetDescription>
            მონიშნე პირობები. სია განახლდება „შედეგების ჩვენებაზე“ დაჭერისას.
          </SheetDescription>
        </SheetHeader>
        <div className="filters">{children}</div>
        <div className="mobile-filters-footer">
          <button
            type="button"
            className="primary filters-apply"
            disabled={
              value.salaryFrom !== null &&
              value.salaryTo !== null &&
              value.salaryFrom > value.salaryTo
            }
            onClick={onApply}
          >
            {total === null
              ? 'შედეგების ჩვენება'
              : total === 0
                ? 'ვაკანსია ვერ მოიძებნა'
                : `ნახე ${new Intl.NumberFormat('ka-GE').format(total)} ვაკანსია`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
