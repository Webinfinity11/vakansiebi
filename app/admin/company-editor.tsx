'use client';
import { useEffect, useState } from 'react';
import { CompanyLogo } from '../company-logo';
type Profile = {
  name: string;
  logoUrl: string;
  website: string;
  description: string;
  version: number;
};
export function CompanyEditor({
  name,
  sourceLogo,
}: {
  name: string;
  sourceLogo?: string;
}) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch('/api/admin/company?name=' + encodeURIComponent(name), {
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error('კომპანიის მონაცემები ვერ ჩაიტვირთა');
        return r.json();
      })
      .then((d) => {
        if (!abort.signal.aborted) setProfile(d);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [name]);
  async function save() {
    if (!profile) return;
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const r = await fetch('/api/admin/company', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || 'შენახვა ვერ მოხერხდა');
      setProfile(d);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="raw-details company-profile-editor">
      <summary>კომპანიის საერთო პროფილი და ლოგო</summary>
      <p className="admin-helper">
        აქ შენახული ლოგო და ინფორმაცია ამავე კომპანიის ყველა ვაკანსიაზე
        გამოჩნდება, მათ შორის უკვე გამოქვეყნებულზე.
      </p>
      {profile && (
        <>
          <div className="editor-logo-row">
            <CompanyLogo company={name} url={profile.logoUrl || sourceLogo} />
            <strong>{name}</strong>
          </div>
          <div className="edit-form">
            <label className="full-width">
              ლოგოს ბმული
              <input
                value={profile.logoUrl}
                onChange={(e) => {
                  setSaved(false);
                  setProfile({ ...profile, logoUrl: e.target.value });
                }}
                placeholder="https://კომპანიის-საიტი/logo.png"
              />
            </label>
            {sourceLogo && (
              <button
                className="secondary-button full-width"
                onClick={() => setProfile({ ...profile, logoUrl: sourceLogo })}
              >
                ამ ვაკანსიის ლოგოს გამოყენება
              </button>
            )}
            <label className="full-width">
              ოფიციალური ვებსაიტი
              <input
                value={profile.website}
                onChange={(e) => {
                  setSaved(false);
                  setProfile({ ...profile, website: e.target.value });
                }}
                placeholder="https://…"
              />
            </label>
            <label className="full-width">
              კომპანიის შესახებ
              <textarea
                rows={3}
                value={profile.description}
                onChange={(e) => {
                  setSaved(false);
                  setProfile({ ...profile, description: e.target.value });
                }}
              />
            </label>
          </div>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'ინახება…' : 'კომპანიის პროფილის შენახვა'}
          </button>
        </>
      )}
      {!profile && !error && <p className="admin-helper">იტვირთება…</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {saved && <p className="success-note">კომპანიის პროფილი შენახულია.</p>}
    </details>
  );
}
