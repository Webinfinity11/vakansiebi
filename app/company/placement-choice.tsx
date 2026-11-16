'use client';
import './billing.css';
import { useId } from 'react';
import { paidPlacementPrices, vipDays, premiumDays } from '@/lib/billing';
import type { PlacementTier } from '@/lib/placement';
export function PlacementChoice({ value, onChange, disabled = false, includeStandard = true }: { value: PlacementTier; onChange: (value: PlacementTier) => void; disabled?: boolean; includeStandard?: boolean }) {
  const name = useId();
  const choices: { id: PlacementTier; title: string; price: string; detail: string }[] = [
    ...(includeStandard ? [{ id: 'standard' as const, title: 'სტანდარტული', price: 'უფასო', detail: 'განცხადება გამოჩნდება ვაკანსიების საერთო სიაში.' }] : []),
    { id: 'vip', title: 'VIP', price: `${paidPlacementPrices.vip} ₾ / ${vipDays} დღე`, detail: 'საერთო სიაში სტანდარტულ განცხადებებზე წინ გამოჩნდება.' },
    { id: 'premium', title: 'პრემიუმი', price: `${paidPlacementPrices.premium} ₾ / ${premiumDays} დღე`, detail: 'საერთო სიაში VIP და სტანდარტულ განცხადებებზე წინ გამოჩნდება.' },
  ];
  return <fieldset className="cp-placement" disabled={disabled}>
    <legend>განთავსება</legend>
    <div className="cp-placement-options">{choices.map(choice => <label key={choice.id} data-selected={value === choice.id}>
      <input type="radio" name={name} value={choice.id} checked={value === choice.id} onChange={() => onChange(choice.id)} />
      <span><strong>{choice.title}</strong><b>{choice.price}</b><small>{choice.detail}</small></span>
    </label>)}</div>
    <p className="cp-subtle">ფასიანი განთავსება გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ. ვადა გააქტიურებიდან აითვლება.</p>
  </fieldset>;
}
