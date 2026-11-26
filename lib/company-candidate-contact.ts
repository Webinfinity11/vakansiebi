type Contact = { email?: string | null; phone?: string | null };

export const validCandidateEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const validCandidatePhone = (value: string) =>
  value.replace(/\D/g, '').length >= 6;

/** Use only for company uploads; CV-base contacts have a separate reveal gate. */
export function effectiveContact(row: Contact, profile?: Contact | null) {
  const email = profile?.email?.trim() ?? '';
  const phone = profile?.phone?.trim() ?? '';
  return {
    email: row.email?.trim() || (validCandidateEmail(email) ? email : ''),
    phone: row.phone?.trim() || (validCandidatePhone(phone) ? phone : ''),
  };
}
