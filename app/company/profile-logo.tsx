'use client';

import './branding.css';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { CompanyProfile } from './company-api';
import { maxLogoBytes, logoSizeMessage, prepareSubmissionLogo } from '@/lib/submission-logo';

export function ProfileLogo({ profile, onChange, logo, initial }: {
  profile: CompanyProfile;
  onChange: Dispatch<SetStateAction<CompanyProfile | null>>;
  logo: string;
  initial: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function change(file?: File) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('version', String(profile.version));
      if (file) {
        if (file.size > maxLogoBytes) throw new Error(logoSizeMessage);
        const prepared = await prepareSubmissionLogo(file);
        const blob = await (await fetch(prepared)).blob();
        body.set('file', blob, 'logo.' + blob.type.split('/')[1]);
      }
      const response = await fetch('/api/company/profile/logo', {
        method: file ? 'POST' : 'DELETE', body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ლოგოს შენახვა ვერ მოხერხდა.');
      // Preserve edits to the other profile fields while advancing its saved version.
      onChange((current) => current ? {
        ...current, logoUrl: result.logoUrl, version: result.version,
      } : current);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ლოგოს შენახვა ვერ მოხერხდა.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="cp-cover-pick" aria-busy={busy}>
      <div className="cp-logo-field">
        <span className="cp-avatar cp-avatar--lg">
          {logo ? <img src={logo} alt="კომპანიის ლოგო" /> : initial}
        </span>
        <strong className="cp-logo-name">{profile.name}</strong>
      </div>
      <div>
        <button type="button" className="cp-btn cp-btn--secondary" disabled={busy} onClick={() => input.current?.click()}>
          {profile.logoUrl ? 'ლოგოს შეცვლა' : 'ლოგოს ატვირთვა'}
        </button>
        {profile.logoUrl && (
          <button type="button" className="cp-btn cp-btn--ghost" disabled={busy} onClick={() => void change()}>
            წაშლა
          </button>
        )}
      </div>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="კომპანიის ლოგო" disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void change(file);
        }} />
      <small className="cp-subtle">PNG, JPG ან WebP · მაქსიმუმ 50 KB. ლოგო ყველა ვაკანსიაზე ავტომატურად გამოჩნდება.</small>
      {busy && <p role="status">ლოგო ინახება…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
