'use client';
import './branding.css';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { CompanyProfile } from './company-api';
export function ProfileBranding({
  profile,
  onChange,
}: {
  profile: CompanyProfile;
  onChange: Dispatch<SetStateAction<CompanyProfile | null>>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.size > 4 * 1024 * 1024)
        throw Error('სურათი მაქსიმუმ 4 მბ უნდა იყოს.');
      const data = new FormData();
      data.set('file', file);
      const response = await fetch('/api/company/profile/cover', {
        method: 'POST',
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'ატვირთვა ვერ მოხერხდა.');
      onChange((current) =>
        current ? { ...current, coverUrl: result.coverUrl } : current,
      );
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ატვირთვა ვერ მოხერხდა.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cp-settings-row">
      <div className="cp-settings-label">
        <h2>კომპანიის საჯარო გვერდი</h2>
        <p>ქავერი, სამუშაო გარემო და რეზიუმეების მიღება.</p>
      </div>
      <div className="cp-fields">
        {(preview || profile.coverUrl) && (
          <img
            className="company-cover-preview"
            src={preview || profile.coverUrl}
            alt="კომპანიის ქავერი"
          />
        )}
        <label>
          ქავერის სურათი — JPG, PNG ან WebP, მაქსიმუმ 4 მბ
          <input
            className="cp-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        {busy && (
          <p role="status">
            სურათი იტვირთება… ატვირთვის შემდეგ შეინახეთ ცვლილებები.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {profile.coverUrl && (
          <button
            type="button"
            className="cp-btn cp-btn--ghost"
            onClick={() => {
              onChange({ ...profile, coverUrl: '' });
              setPreview('');
            }}
          >
            ქავერის მოცილება
          </button>
        )}
        <label>
          რატომ ჩვენთან
          <textarea
            className="cp-input"
            rows={4}
            maxLength={1500}
            value={profile.whyUs ?? ''}
            onChange={(e) => onChange({ ...profile, whyUs: e.target.value })}
          />
        </label>
        <label>
          ბენეფიტები — თითო ხაზზე ერთი
          <textarea
            className="cp-input"
            rows={5}
            maxLength={1451}
            value={(profile.benefits ?? []).join('\n')}
            onChange={(e) =>
              onChange({ ...profile, benefits: e.target.value.split('\n') })
            }
          />
          <small>მაქსიმუმ 12 ბენეფიტი, თითოეული 120 სიმბოლომდე.</small>
        </label>
        <label className="company-cv-box-toggle">
          <input
            type="checkbox"
            checked={profile.cvBoxEnabled ?? false}
            onChange={(e) =>
              onChange({ ...profile, cvBoxEnabled: e.target.checked })
            }
          />
          CV ყუთი — კანდიდატებმა რეზიუმე ვაკანსიის გარეშეც გამოგიგზავნონ
        </label>
      </div>
    </div>
  );
}
