'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { companyRequest as request, formatDate } from './company-api';
import { SelectField } from '../select-field';
import './team.css';
import { StatusMark } from './status-mark';
const labels: Record<string, string> = {
  owner: 'მფლობელი',
  recruiter: 'რეკრუტერი',
  viewer: 'მნახველი',
};
type Member = {
  id: string;
  email: string;
  name: string;
  role: string;
  enabled: boolean;
};
type Invitation = { id: string; email: string; role: string; sent_at: string };
const roleOptions = ['recruiter', 'viewer'].map((value) => ({ value, label: labels[value] }));
export function TeamView() {
  const [inviteRole, setInviteRole] = useState('recruiter');
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<{
    members: Member[];
    invitations: Invitation[];
  }>({ members: [], invitations: [] });
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () => {
    setData(await request('team'));
    setLoaded(true);
  };
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'მოქმედება ვერ შესრულდა.');
    } finally {
      setBusy(false);
    }
  }
  async function invite(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    await act(async () => {
      await request('team', { email: d.get('email'), role: d.get('role') });
      form.reset();
      setInviteRole('recruiter');
      setNotice('მოწვევა გაგზავნილია. ბმული მოქმედებს 72 საათის განმავლობაში.');
    });
  }
  async function change(id: string, action: string) {
    await act(async () => {
      await request('team', { id, action }, 'PATCH');
    });
  }
  return (
    <>
      <header className="cp-head">
        <div className="cp-head-title">
          <h1>გუნდი</h1>
          <p>მოიწვიეთ თანამშრომლები და მართეთ მათი წვდომა.</p>
        </div>
      </header>
      {error && (
        <p className="cp-alert" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}

      {!loaded && !error && <p role="status">იტვირთება…</p>}
      {loaded && <>
        <section className="cp-team-section" aria-labelledby="team-members-title">
          <h2 id="team-members-title">გუნდის წევრები</h2>
          {data.members.length === 0 ? <div className="cp-team-empty"><p>გუნდში წევრები ჯერ არ არიან.</p><a className="cp-btn cp-btn--ghost" href="#team-invite-role">წევრის მოწვევა</a></div> : (
            <ul className="cp-team-list">
              {data.members.map((m) => (
                <li key={m.id} className="cp-team-row" data-member-id={m.id}>
                  <div className="cp-team-person">
                    <strong>{m.name || m.email}</strong>
                    {m.name && <p>{m.email}</p>}
                  </div>
                  <div className="cp-team-status">
                    <StatusMark kind={m.role} className="cp-team-badge">{labels[m.role]}</StatusMark>
                    {!m.enabled && <span className="cp-team-muted">წვდომა გაუქმებულია</span>}
                  </div>
                  <div className="cp-team-actions">
                    {m.role !== 'owner' && m.enabled && <>
                      <div className="cp-team-role-field">
                        <label htmlFor={`team-role-${m.id}`}>როლი</label>
                        <SelectField id={`team-role-${m.id}`} value={m.role} disabled={busy}
                          onChange={(value) => void change(m.id, value)}
                          options={roleOptions} placeholder="აირჩიეთ" />
                      </div>
                      <button className="cp-btn cp-btn--quiet-danger" disabled={busy}
                        onClick={() => void change(m.id, 'remove')}>წვდომის გაუქმება</button>
                    </>}
                    {m.role !== 'owner' && !m.enabled && (
                      <button className="cp-btn" disabled={busy}
                        onClick={() => void change(m.id, 'enable')}>წვდომის აღდგენა</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>}
      <form className="cp-settings cp-team-invite" onSubmit={invite}>
        <div className="cp-settings-row">
          <div className="cp-settings-label">
            <h2>წევრის მოწვევა</h2>
            <p>მოწვევის ბმული მოქმედებს 72 საათის განმავლობაში.</p>
          </div>
          <div className="cp-fields">
            <label>
               ელფოსტა <input
                className="cp-input"
                name="email"
                type="email"
                required
                maxLength={254}
              />
            </label>
            <div className="cp-team-role-field">
              <label htmlFor="team-invite-role">როლი</label>
              <SelectField id="team-invite-role" name="role" value={inviteRole}
                onChange={setInviteRole} options={roleOptions} placeholder="აირჩიეთ" disabled={busy} />
            </div>
            <p>
               რეკრუტერი მართავს ვაკანსიებსა და კანდიდატებს. მნახველს მხოლოდ მათი ნახვა შეუძლია. </p>
            <button className="cp-btn cp-btn--primary" disabled={busy}>
               მოწვევის გაგზავნა </button>
          </div>
        </div>
      </form>
      {loaded && <>
        <section className="cp-team-section" aria-labelledby="team-invitations-title">
          <h2 id="team-invitations-title">მოლოდინში მყოფი მოწვევები</h2>
          {data.invitations.length === 0 ? <div className="cp-team-empty"><p>მოლოდინში მყოფი მოწვევები არ გაქვთ.</p><a className="cp-btn cp-btn--ghost" href="#team-invite-role">წევრის მოწვევა</a></div> : (
            <ul className="cp-team-list">
              {data.invitations.map((i) => (
                <li className="cp-team-row" key={i.id} data-invitation-id={i.id}>
                  <div className="cp-team-person">
                    <strong>{i.email}</strong>
                    <p>გაგზავნილია: <time dateTime={i.sent_at}>{formatDate(i.sent_at)}</time></p>
                  </div>
                  <div><StatusMark kind={i.role} className="cp-team-badge">{labels[i.role]}</StatusMark></div>
                  <div className="cp-team-actions">
                    <button className="cp-btn" disabled={busy}
                      onClick={() => void change(i.id, 'cancel')}>მოწვევის გაუქმება</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>}
    </>
  );
}
