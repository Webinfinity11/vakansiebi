import { load } from 'cheerio';
import type { Vacancy } from '../lib/types';
import {
  cleanText,
  externalId,
  parseDetail,
  UnavailableVacancy,
} from './adapters';
import {
  EmployerHttpError,
  publicPage,
  UnusableEmployerLink,
  validateLinkedUrl,
} from './public-page';
import { sourceFetch } from './http';
import { enrichVacancy } from './enrich';
import { safeLogoUrl } from '../lib/vacancy-media';

export class ClosedEmployerVacancy extends Error {
  constructor(public title: string) {
    super('Employer vacancy is closed');
  }
}
export { UnusableEmployerLink };
/**
 * A reachable employer link that cannot supply this vacancy's text. Timeouts, rate limits and
 * server errors stay retryable; every other definite response means retrying reproduces it.
 */
export function unusableEmployerLink(error: unknown) {
  return (
    error instanceof UnusableEmployerLink ||
    (error instanceof EmployerHttpError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 429].includes(error.status))
  );
}
/** Retries that must elapse before a snapshot stops waiting for its verified employer link. */
export const verifiedLinkRetryLimit = 5;
export type LinkedText = {
  title: string;
  text: string;
  url: string;
  logoUrl?: string;
};
const normalized = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
export function sameLinkedTitle(original: string, linked: string) {
  // Equivalent words seen in bilingual public vacancy titles; no text is translated for display.
  const aliases: Record<string, string> = {
    მარკეტინგისა: 'marketing',
    მარკეტინგის: 'marketing',
    კომუნიკაციების: 'communications',
    სპეციალისტი: 'specialist',
    სტუდიური: 'studio',
    მხარდაჭერის: 'support',
    ტექნიკოსი: 'technician',
    ტალანტების: 'talent',
    მოზიდვის: 'acquisition',
    უმცროსი: 'junior',
    ინჟინერი: 'engineer',
    იურისტი: 'lawyer',
    ბუღალტერი: 'accountant',
    ტრენინგ: 'ტრეინინგ',
    გრანულატორის: 'გრანულატორი',
  };
  const terms = (value: string) =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s*[-–—]\s*(?:თბილისი|ბათუმი|ქუთაისი|რუსთავი)\s*$/, '')
      .replace(/[\p{L}]+/gu, (word) => aliases[word] || word);
  const left = terms(original),
    right = terms(linked);
  for (const qualifier of [
    /(?:^|[^\p{L}])(assistant|ასისტენტი)(?:$|[^\p{L}])/u,
    /(?:^|[^\p{L}])(senior|უფროსი)(?:$|[^\p{L}])/u,
    /(?:^|[^\p{L}])junior(?:$|[^\p{L}])/u,
  ])
    if (qualifier.test(left) !== qualifier.test(right)) return false;
  const a = normalized(left),
    b = normalized(right);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const words =
    left
      .match(/[\p{L}\p{N}]{2,}/gu)
      ?.filter((w) => !['და', 'and'].includes(w)) || [];
  return (
    words.length >= 2 &&
    words.filter((w) => b.includes(normalized(w))).length >=
      Math.ceil(words.length * 0.75)
  );
}

export function linkedProvider(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === 'jobs.ge' && u.pathname.startsWith('/en/'))
      return 'jobs-language';
    validateLinkedUrl(url);
    if (
      ['hel-ai.com', 'app.helio-ai.com', 'www.app.helio-ai.com'].includes(
        u.hostname,
      ) &&
      /^\/apply\/[a-zA-Z0-9]+\/?$/.test(u.pathname)
    )
      return 'helio';
    if (u.hostname === 'smrtr.io' || u.hostname === 'jobs.smartrecruiters.com')
      return 'smart';
    if (u.hostname === 'wrk.ge' || u.hostname === 'flow.awork.ge')
      return 'awork';
    if (u.hostname.endsWith('.selfrecruit.ge')) return 'selfrecruit';
    if (
      u.hostname.endsWith('.hirehive.com') ||
      u.hostname === 'tp-georgia.softgarden.io'
    )
      return 'jsonld';
    if (
      u.hostname.endsWith('libertybank.ge') &&
      u.pathname.includes('/mimdinare-vakansiebi/')
    )
      return 'liberty';
  } catch {}
  return null;
}
export function parseLinkedPage(
  html: string,
  url: string,
  provider: string,
): LinkedText {
  const $ = load(html);
  let title = '',
    body = '',
    logoUrl = '';
  if (provider === 'selfrecruit') {
    logoUrl = safeLogoUrl(
      $('.pub-vac-text .brand-logo img').first().attr('src'),
      url,
    );
    title = $('.vacancy_title_inner').first().text().trim();
    const content = $('.pub-vac-text').first().clone();
    content
      .find(
        '.brand-info-container,.jobs-share-buttons-container,.vacancy_title_inner,button,input,script,style',
      )
      .remove();
    body = content.html() || '';
  } else if (provider === 'smart') {
    logoUrl = safeLogoUrl(
      $('.jobad-header .logo img').first().attr('src'),
      url,
    );
    title = $('h1.job-title').text().trim();
    if (
      title &&
      /ამ ვაკანსიას ვადა გაუვიდა|This job has expired|no longer available/i.test(
        $('.jobad--empty-state').text(),
      )
    )
      throw new ClosedEmployerVacancy(title);
    body = $('.job-details,.job-section')
      .map((_, e) => $.html(e))
      .get()
      .join('\n');
  } else if (provider === 'awork') {
    const info = $('.business-job-details .main-section').first();
    title = info.find('.job-name').first().text().trim();
    if (!title) {
      const labels = info
        .find('*')
        .filter(
          (_, e) =>
            $(e).children().length === 0 &&
            $(e).text().trim() === 'სამუშაოს დასახელება',
        );
      title = labels
        .first()
        .parent()
        .text()
        .replace('სამუშაოს დასახელება', '')
        .trim();
    }
    body = info
      .find('.job-details-item,.job-desc')
      .map((_, e) => $.html(e))
      .get()
      .join('\n');
  } else if (provider === 'liberty') {
    title = $('.vacancy-content > h2,.vacancy-content h2.caps')
      .first()
      .text()
      .trim();
    body = $('.vacancy-content .pagetext').first().html() || '';
  } else if (provider === 'jsonld') {
    const posts: Record<string, unknown>[] = [];
    $('script[type="application/ld+json"]').each((_, e) => {
      try {
        const data = JSON.parse($(e).text());
        for (const v of Array.isArray(data) ? data : data['@graph'] || [data])
          if (v['@type'] === 'JobPosting') posts.push(v);
      } catch {}
    });
    if (posts.length !== 1)
      throw new UnusableEmployerLink('Employer posting structure missing');
    const post = posts[0];
    if (typeof post.url === 'string') {
      const expected = new URL(url),
        actual = new URL(post.url);
      if (
        expected.hostname !== actual.hostname ||
        expected.pathname !== actual.pathname
      )
        throw new UnusableEmployerLink('Employer posting URL mismatch');
    }
    title = typeof post.title === 'string' ? post.title : '';
    body = typeof post.description === 'string' ? post.description : '';
  }
  const text = cleanText(body);
  if (!title || text.length < 100)
    throw new UnusableEmployerLink('Employer description missing');
  return { title, text, url, ...(logoUrl ? { logoUrl } : {}) };
}
export function parseHelio(
  data: Record<string, unknown>,
  token: string,
  url: string,
): LinkedText {
  if (data.public_url_token !== token)
    throw new UnusableEmployerLink('Employer vacancy token or status mismatch');
  const text = cleanText(
    typeof data.description === 'string' ? data.description : '',
  );
  const title = String(
    data.use_english_title
      ? data.job_title_en
      : data.job_title_local || data.job_title_en || '',
  );
  // Observed public terminal states; an unknown status must remain retryable.
  if (title && ['completed', 'canceled'].includes(String(data.status)))
    throw new ClosedEmployerVacancy(title);
  if (data.status !== 'active')
    throw new UnusableEmployerLink('Employer vacancy token or status mismatch');
  if (!title || text.length < 100)
    throw new UnusableEmployerLink('Employer description missing');
  const logoUrl = safeLogoUrl(data.company_logo);
  return { title, text, url, ...(logoUrl ? { logoUrl } : {}) };
}
export async function readLinkedText(
  url: string,
  provider: string,
): Promise<LinkedText> {
  let page = await publicPage(url);
  if (provider === 'helio') {
    if (new URL(page.url).hostname === 'hel-ai.com') {
      const $ = load(page.text);
      const target = $('link[rel="canonical"]').attr('href') || '';
      const u = validateLinkedUrl(target);
      if (
        !['app.helio-ai.com', 'www.app.helio-ai.com'].includes(u.hostname) ||
        !/^\/apply\/[a-zA-Z0-9]+\/?$/.test(u.pathname)
      )
        throw new UnusableEmployerLink('Unsupported Helio target');
      page = { url: u.href, text: '' };
    }
    const token = new URL(page.url).pathname.split('/')[2];
    if (!/^[a-zA-Z0-9]+$/.test(token || ''))
      throw new UnusableEmployerLink('Invalid Helio token');
    const response = await publicPage(
      'https://api.helio-ai.com/apply/' + token,
    );
    return parseHelio(JSON.parse(response.text), token, page.url);
  }
  return parseLinkedPage(page.text, page.url, provider);
}
/**
 * Appends the employer's own vacancy text when the linked page is verifiably the same vacancy.
 * A link that is reachable but is not this vacancy never blocks the source text itself: the
 * vacancy is kept with its primary description instead of failing the whole import. A snapshot
 * that already carries verified employer text keeps that text and is retried, but only until
 * `verifiedLinkRetryLimit`, so a permanently broken link cannot freeze its other source fields.
 */
export async function completeDescription(
  job: Vacancy,
  previous?: Vacancy | null,
  failures = 0,
): Promise<Vacancy> {
  const links = job.applicationLinks || [];
  const candidates = links
    .map((l) => ({ url: l.url, provider: linkedProvider(l.url) }))
    .filter((l) => l.provider);
  const keepVerified =
    Boolean(previous?.fullTextUrl) && failures < verifiedLinkRetryLimit;
  const dropped = (url: string, reason: string) =>
    console.log(
      JSON.stringify({ employerLinkSkipped: url, reason, vacancy: job.url }),
    );
  // Follow only vacancy-specific links supplied by the source, never arbitrary site navigation.
  let linked: LinkedText | null = null;
  for (const candidate of candidates.slice(0, 3)) {
    if (candidate.provider === 'jobs-language') {
      if (externalId('jobs', candidate.url) !== externalId('jobs', job.url))
        continue;
      const translated = parseDetail(
        'jobs',
        await sourceFetch('jobs', candidate.url),
        candidate.url,
      );
      linked = {
        title: translated.title,
        text: translated.description,
        url: candidate.url,
      };
    } else {
      try {
        linked = await readLinkedText(candidate.url, candidate.provider!);
        if (!sameLinkedTitle(job.title, linked.title))
          throw new UnusableEmployerLink(
            'Linked employer vacancy title differs from original',
          );
      } catch (error) {
        // A closed posting under this vacancy's own title retires the vacancy; a closed posting
        // under a different title only proves the link points at something else.
        const closed = error instanceof ClosedEmployerVacancy;
        if (
          closed &&
          sameLinkedTitle(job.title, (error as ClosedEmployerVacancy).title)
        )
          throw new UnavailableVacancy();
        if (keepVerified || !(closed || unusableEmployerLink(error)))
          throw error;
        dropped(candidate.url, (error as Error).message);
        linked = null;
        continue;
      }
    }
    if (linked) break;
  }
  if (!linked) return job;
  const logoUrl = job.logoUrl || linked.logoUrl || '';
  if (job.description.includes(linked.text)) return { ...job, logoUrl };
  const description =
    job.description + '\n\nსრული ინფორმაცია დამსაქმებლისგან:\n\n' + linked.text;
  // Deterministic in both texts, so retrying reproduces it; keep the vacancy rather than loop.
  if (description.length > 100000) {
    dropped(linked.url, 'Complete description exceeds supported size');
    return { ...job, logoUrl };
  }
  return enrichVacancy({
    ...job,
    description,
    logoUrl,
    fullTextUrl: linked.url,
  });
}
