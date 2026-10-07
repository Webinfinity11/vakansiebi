import { withoutLegalForm } from './employer-identity';

/** Presentation only: source names and employer identities keep their original data. */
export function companyDisplayName(name: string): string {
  return withoutLegalForm(name)
    .replace(/^[\s:"'«»„“”.,]+|[\s:"'«»„“”.,]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
