import type { Vacancy } from './types';
import { safeExternalUrl } from './vacancy-media';
import { applicationDestination } from './vacancy-details';
export function vacancyLinks(job: Pick<Vacancy, 'applicationLinks'>) {
  const application = applicationDestination(job);
  return [
    ...new Map(
      (job.applicationLinks || [])
        .filter((link) => safeExternalUrl(link.url))
        .map((link) => [link.url, link]),
    ).values(),
  ].map((link) => ({
    ...link,
    application: link.url === application?.url,
    label:
      link.url === application?.url
        ? 'განაცხადის შევსება'
        : /^https?:\/\/|^[\w.-]+\.[a-z]{2,}$/i.test(link.label)
          ? 'დამსაქმებლის გვერდის ნახვა'
          : link.label,
    host: new URL(link.url).hostname,
  }));
}
export function descriptionWithoutRepeatedLinks(
  text: string,
  links: { url: string }[],
) {
  const urls = new Set(links.map((link) => link.url));
  return text
    .replace(/https:\/\/[^\s<>"']+/g, (value) =>
      urls.has(value.replace(/[.,;]+$/, '')) ? '' : value,
    )
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
