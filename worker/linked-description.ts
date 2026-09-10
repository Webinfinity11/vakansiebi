import { load } from 'cheerio';
import type { Vacancy } from '../lib/types';
import { cleanText, externalId, parseDetail } from './adapters';
import { publicPage, validateLinkedUrl } from './public-page';
import { sourceFetch } from './http';
import { enrichVacancy } from './enrich';

export type LinkedText = { title: string; text: string; url: string };
const normalized = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
export function sameLinkedTitle(original: string, linked: string) {
  const a = normalized(original),
    b = normalized(linked);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const words = original.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
  return (
    words.length >= 2 &&
    words.filter((w) => b.includes(normalized(w))).length >=
      Math.ceil(words.length * 0.6)
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
    body = '';
  if (provider === 'selfrecruit') {
    title = $('.vacancy_title_inner').first().text().trim();
    const content = $('.pub-vac-text').first().clone();
    content
      .find(
        '.brand-info-container,.jobs-share-buttons-container,.vacancy_title_inner,button,input,script,style',
      )
      .remove();
    body = content.html() || '';
  } else if (provider === 'smart') {
    title = $('h1.job-title').text().trim();
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
    if (posts.length !== 1) throw Error('Employer posting structure missing');
    const post = posts[0];
    if (typeof post.url === 'string') {
      const expected = new URL(url),
        actual = new URL(post.url);
      if (
        expected.hostname !== actual.hostname ||
        expected.pathname !== actual.pathname
      )
        throw Error('Employer posting URL mismatch');
    }
    title = typeof post.title === 'string' ? post.title : '';
    body = typeof post.description === 'string' ? post.description : '';
  }
  const text = cleanText(body);
  if (!title || text.length < 100) throw Error('Employer description missing');
  return { title, text, url };
}
export function parseHelio(
  data: Record<string, unknown>,
  token: string,
  url: string,
): LinkedText {
  if (data.public_url_token !== token || data.status !== 'active')
    throw Error('Employer vacancy token or status mismatch');
  const text = cleanText(
    typeof data.description === 'string' ? data.description : '',
  );
  const title = String(
    data.use_english_title
      ? data.job_title_en
      : data.job_title_local || data.job_title_en || '',
  );
  if (!title || text.length < 100) throw Error('Employer description missing');
  return { title, text, url };
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
        throw Error('Unsupported Helio target');
      page = { url: u.href, text: '' };
    }
    const token = new URL(page.url).pathname.split('/')[2];
    if (!/^[a-zA-Z0-9]+$/.test(token || '')) throw Error('Invalid Helio token');
    const response = await publicPage(
      'https://api.helio-ai.com/apply/' + token,
    );
    return parseHelio(JSON.parse(response.text), token, page.url);
  }
  return parseLinkedPage(page.text, page.url, provider);
}
export async function completeDescription(job: Vacancy): Promise<Vacancy> {
  const links = job.applicationLinks || [];
  const candidates = links
    .map((l) => ({ url: l.url, provider: linkedProvider(l.url) }))
    .filter((l) => l.provider);
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
      linked = await readLinkedText(candidate.url, candidate.provider!);
      if (!sameLinkedTitle(job.title, linked.title))
        throw Error('Linked employer vacancy title differs from original');
    }
    if (linked) break;
  }
  if (!linked) return job;
  if (job.description.includes(linked.text)) return job;
  const description =
    job.description + '\n\nსრული ინფორმაცია დამსაქმებლისგან:\n\n' + linked.text;
  if (description.length > 100000)
    throw Error('Complete description exceeds supported size');
  return enrichVacancy({ ...job, description, fullTextUrl: linked.url });
}
