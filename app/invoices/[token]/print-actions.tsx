'use client';
import { Printer, RefreshCw } from 'lucide-react';
export function InvoiceActions() {
  return (
    <div className="invoice-actions">
      <button type="button" onClick={() => window.location.reload()}>
        <RefreshCw size={16} />
        სტატუსის განახლება
      </button>
      <button type="button" onClick={() => window.print()}>
        <Printer size={16} />
        ბეჭდვა / PDF
      </button>
    </div>
  );
}
