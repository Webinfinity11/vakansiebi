'use client';
import { useEffect, useState } from 'react';
import type { NotificationSettings as Settings } from '@/lib/server/company-notifications';
import { companyRequest } from './company-api';
import './notification-settings.css';

export function NotificationSettings({ canEdit }: { canEdit: boolean }) {
  const [value, setValue] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    let live = true;
    companyRequest('notifications').then((data: Settings) => { if (live) setValue(data); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!value) return;
    setBusy(true); setError(''); setStatus('');
    try { setValue(await companyRequest('notifications', { application_mode: value.application_mode, deadline_reminders: value.deadline_reminders })); setStatus('შეტყობინებების პარამეტრები შენახულია.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'პარამეტრები ვერ შეინახა.'); }
    finally { setBusy(false); }
  }
  return <section className="cp-notifications" aria-labelledby="notification-heading">
    <h2 id="notification-heading">შეტყობინებები</h2>
    <p className="cp-subtle">ახალი განაცხადებისა და ვადების შესახებ წერილები კომპანიის მფლობელის ელფოსტაზე გაიგზავნება.</p>
    {!canEdit && <p>პარამეტრების შეცვლა მხოლოდ მფლობელს შეუძლია.</p>}
    {error && <p role="alert" className="cp-alert">{error}</p>}
    {!value && !error && <p role="status">იტვირთება…</p>}
    {value && <form onSubmit={save} onChange={() => setStatus('')}>
      <fieldset disabled={!canEdit || busy}>
        <legend>ახალი განაცხადები</legend>
        {([['instant', 'ყოველ განაცხადზე'], ['digest', 'დღეში ერთხელ შეჯამება'], ['off', 'გამორთული']] as const).map(([mode, label]) =>
          <label className="cp-notifications-choice" key={mode}><input type="radio" name="application-mode" value={mode} checked={value.application_mode === mode} onChange={() => setValue({ ...value, application_mode: mode })} /><span>{label}</span></label>)}
        <p className="cp-subtle">დღიური შეჯამება გაიგზავნება თბილისის დროით 09:00-ის შემდეგ. წერილში მხოლოდ ვაკანსიები და განაცხადების რაოდენობა გამოჩნდება.</p>
        <label className="cp-notifications-choice"><input type="checkbox" checked={value.deadline_reminders} onChange={e => setValue({ ...value, deadline_reminders: e.target.checked })} /><span>შემახსენეთ VIP-ისა და სუპერ VIP-ის დასრულებამდე</span></label>
      </fieldset>
      {canEdit && <button className="cp-btn cp-btn--primary" disabled={busy}>{busy ? 'ინახება…' : 'პარამეტრების შენახვა'}</button>}
    </form>}
    <p role="status">{status}</p>
  </section>;
}
