export function safeEmail(value: string): string | null {
  const email = value.trim();
  return email.length <= 254 &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(
      email,
    )
    ? email
    : null;
}
export function mailtoAddress(href: string): string | null {
  if (!/^mailto:/i.test(href)) return null;
  try {
    return safeEmail(decodeURIComponent(href.slice(7).split('?')[0]));
  } catch {
    return null;
  }
}
export function applicationContacts(description: string) {
  const matches = [
    ...description.matchAll(
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi,
    ),
  ];
  const seen = new Set<string>();
  return matches
    .flatMap((match) => {
      const email = safeEmail(match[0].replace(/[.,;]+$/, ''));
      if (!email || seen.has(email.toLowerCase())) return [];
      seen.add(email.toLowerCase());
      const start = Math.max(0, (match.index || 0) - 220),
        end = Math.min(
          description.length,
          (match.index || 0) + email.length + 160,
        );
      const context = description.slice(start, end).trim();
      const administrative =
        /^(privacy|dpo|noreply|no-reply|abuse|unsubscribe)@/i.test(email);
      const application =
        !administrative &&
        /რეზიუმ|გამოგზავნ|გამოაგზავნ|გაგზავნ|კანდიდატ|გამოხმაურ|\b(?:cv|résumé|resume|apply|application|recruitment)\b/i.test(
          context,
        );
      return [{ email, application, context }];
    })
    .slice(0, 8);
}
export function emailDraft(email: string, title: string, body: string) {
  const recipient = safeEmail(email);
  if (!recipient) throw Error('Invalid recipient');
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(title.replace(/[\r\n]/g, ' ').slice(0, 300))}&body=${encodeURIComponent(body.slice(0, 4000))}`;
}
export function hasEnglishDescription(description: string) {
  const english = (description.match(/[A-Za-z]/g) || []).length;
  const georgian = (description.match(/[\u10A0-\u10FF\u1C90-\u1CBF]/g) || [])
    .length;
  return english > 120 && english > georgian;
}
