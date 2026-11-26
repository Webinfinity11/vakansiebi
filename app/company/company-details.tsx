"use client";
import { useState, type SubmitEvent } from "react";
import { companyRequest as request } from "./company-api";
import { companyDetailsSchema, type CompanyDetails } from "@/lib/company-registration";

/* The identification code, contact person and phone JOBX checks before approving a
   company. Registration no longer asks for them; the owner fills them in here. */
export function CompanyDetailsForm({
  details,
  canEdit,
  codeLocked,
  onSaved,
  onDirtyChange,
}: {
  details: CompanyDetails;
  canEdit: boolean;
  codeLocked: boolean;
  onSaved: (details: CompanyDetails) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(details);
  const [phoneError, setPhoneError] = useState("");
  const dirty = (Object.keys(details) as (keyof CompanyDetails)[]).some(key => draft[key] !== details[key]);
  function change(key: keyof CompanyDetails, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setSaved(false);
    setError("");
    if (key === "phone") setPhoneError("");
    onDirtyChange((Object.keys(details) as (keyof CompanyDetails)[]).some(field => next[field] !== details[field]));
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const phone = companyDetailsSchema.shape.phone.safeParse(data.phone);
    if (!phone.success) {
      setPhoneError(phone.error.issues[0].message);
      event.currentTarget.querySelector<HTMLInputElement>('[name="phone"]')?.focus();
      return;
    }
    setPhoneError("");
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await request("details", data);
      setDraft(next);
      onSaved(next);
      onDirtyChange(false);
      setSaved(true);
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes("ტელეფონ")) setPhoneError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form id="company-details" className="cp-settings cp-details-settings" onSubmit={save}>
      <div className="cp-settings-row">
        <div className="cp-settings-label">
          <h2>კომპანიის მონაცემები</h2>
          <p>კომპანიის დასადასტურებლად.</p>
        </div>
        <fieldset className="cp-fields" disabled={!canEdit || busy}>
          <label>
            საიდენტიფიკაციო კოდი (არასავალდებულო)
            <input
              className="cp-input"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{9}"
              maxLength={9}
              value={draft.code}
              onChange={(event) => change("code", event.target.value)}
              readOnly={codeLocked}
              title="9 ციფრი"
            />
            {codeLocked && <small>დადასტურებული კომპანიის კოდის შესაცვლელად დაგვიკავშირდით.</small>}
          </label>
          <label>
            საკონტაქტო პირი
            <input
              placeholder="სახელი, გვარი"
              className="cp-input"
              name="representativeName"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              value={draft.representativeName}
              onChange={(event) => change("representativeName", event.target.value)}
            />
          </label>
          <input type="hidden" name="position" value={draft.position} />
          <label>
            ტელეფონი
            <input
              className="cp-input"
              name="phone"
              aria-invalid={!!phoneError || undefined}
              aria-describedby="cp-details-phone-error"
              placeholder="+995 555 12 34 56"
              type="tel"
              autoComplete="tel"
              maxLength={25}
              value={draft.phone}
              onChange={(event) => change("phone", event.target.value)}
            />
            <small id="cp-details-phone-error" className="cp-field-error" role={phoneError ? "alert" : undefined}>{phoneError}</small>
          </label>
          {!canEdit && <small>მონაცემებს ანგარიშის მფლობელი ცვლის.</small>}
        </fieldset>
      </div>
      {error && (
        <p role="alert" className="cp-alert cp-details-error">
          {error}
        </p>
      )}
      {canEdit && (
        <div className="cp-settings-foot">
          {dirty && <span role="status">შეუნახავი ცვლილებები</span>}
          {saved && <span role="status">შენახულია.</span>}
          <button className="cp-btn cp-btn--primary" disabled={busy}>
            {busy ? "ინახება…" : "შენახვა"}
          </button>
        </div>
      )}
    </form>
  );
}
