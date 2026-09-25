'use client';
import { Printer, RefreshCw } from 'lucide-react';
export function InvoiceActions() {
  return (
    <div className="invoice-actions">
      <button
        type="button"
        className="ds-btn ds-btn--secondary"
        onClick={() => window.location.reload()}
      >
        <RefreshCw aria-hidden="true" />
        სტატუსის განახლება
      </button>
      <button
        type="button"
        className="ds-btn ds-btn--primary"
        onClick={() => window.print()}
      >
        <Printer aria-hidden="true" />
        ბეჭდვა / PDF
      </button>
    </div>
  );
}
