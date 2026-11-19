"use client";
import { useState, type SubmitEvent } from "react";
import { companyRequest as request } from "./company-api";
import type { CompanyDetails } from "@/lib/company-registration";

/* The identification code, contact person and phone JOBX checks before approving a
   company. Registration no longer asks for them; the owner fills them in here. */
export function CompanyDetailsForm({
  details,
  canEdit,
  codeLocked,
  onSaved,
}: {
  details: CompanyDetails;
  canEdit: boolean;
  codeLocked: boolean;
  onSaved: (details: CompanyDetails) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      onSaved(await request("details", data));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form id="company-details" className="cp-settings cp-details-settings" onSubmit={save}>
      <div className="cp-settings-row">
        <div className="cp-settings-label">
          <h2>კომპანიის მონაცემები</h2>
          <p>
            კომპანიის დასადასტურებლად გვჭირდება. ტელეფონზე დაგიკავშირდებით, თუ რამის
            დაზუსტება იქნება საჭირო.
          </p>
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
              defaultValue={details.code}
              readOnly={codeLocked}
              title="9 ციფრი"
            />
            {codeLocked && <small>დადასტურებული კომპანიის კოდის შესაცვლელად დაგვიკავშირდით.</small>}
          </label>
          <label>
            საკონტაქტო პირი (სახელი, გვარი)
            <input
              className="cp-input"
              name="representativeName"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              defaultValue={details.representativeName}
            />
          </label>
          <label>
            თანამდებობა
            <input
              className="cp-input"
              name="position"
              autoComplete="organization-title"
              minLength={2}
              maxLength={120}
              defaultValue={details.position}
            />
          </label>
          <label>
            ტელეფონი
            <input
              className="cp-input"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={25}
              defaultValue={details.phone}
            />
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
          {saved && <span role="status">შენახულია.</span>}
          <button className="cp-btn cp-btn--primary" disabled={busy}>
            {busy ? "ინახება…" : "მონაცემების შენახვა"}
          </button>
        </div>
      )}
    </form>
  );
}
