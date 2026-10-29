import { load } from 'cheerio';
import { sourceNames, type Vacancy } from '../../lib/types';
import { cleanText } from './index';
import { UnavailableVacancy, type SourceModule } from './module';
import {
  mushebiCareersUrl,
  mushebiOrigin,
  mushebiVacancyId,
  mushebiVacancyUrl,
} from '../mushebi-url';

const plain = (v: string) => v.replace(/\s+/g, ' ').trim();

function vacancies(html: string): Vacancy[] {
  const $ = load(html);
  if (
    $('link[rel="canonical"]').attr('href') !== mushebiCareersUrl ||
    !$('main h1').text().includes('მუშის ვაკანსია თბილისში') ||
    !$('main').text().includes('mushebi.ge-ის გუნდის')
  )
    throw Error('Mushebi employer careers page identity missing');
  const shared = ['მოთხოვნები', 'ჩვენი პირობები']
    .map((label) => {
      const heading = $('main h3').filter(
        (_, el) => plain($(el).text()) === label,
      );
      const list = heading.next('ul');
      if (heading.length !== 1 || !list.find('li').length)
        throw Error('Mushebi shared job conditions missing');
      return label + '\n' + cleanText($.html(list));
    })
    .join('\n\n');
  const contact = $('main a[href^="https://wa.me/"]').first().attr('href');
  if (!contact || !/^https:\/\/wa\.me\/995\d{9}(?:\?|$)/.test(contact))
    throw Error('Mushebi application contact missing');
  const result: Vacancy[] = [];
  $('main h2').each((_, heading) => {
    const h = $(heading);
    const pay = plain(h.next('div').text());
    // The final contact heading is not a vacancy card.
    if (!h.next('div').length) return;
    const title = plain(h.text());
    const body = plain(h.parent().children('p').text());
    const match = pay.match(/^(\d+)\s*[-–]\s*(\d+)\s*₾\s*\/\s*დღე$/u);
    if (!match || !body || !mushebiVacancyId(mushebiVacancyUrl(title)))
      throw Error('Mushebi vacancy title, description or daily salary changed');
    const min = Number(match[1]),
      max = Number(match[2]);
    if (min <= 0 || max < min || max > 10000)
      throw Error('Mushebi daily salary is invalid');
    result.push({
      title,
      company: 'Mushebi.ge',
      city: 'თბილისი',
      category: '',
      salary: `${min}–${max} ₾ / დღე`,
      salaryMin: min,
      salaryPeriod: 'დღე',
      currency: 'GEL',
      mode: '',
      description: `${body}\n\nანაზღაურება: ${pay}\n\n${shared}\n\nგამოხმაურება: WhatsApp`,
      facts: shared.includes('ყოველდღიური ანაზღაურება')
        ? [{ label: 'ანაზღაურების გაცემა', value: 'ყოველდღიურად' }]
        : [],
      applicationLinks: [{ label: 'WhatsApp', url: contact }],
      source: sourceNames.mushebi,
      url: mushebiVacancyUrl(title),
      datePosted: '',
      deadline: '',
    });
  });
  if (
    !result.length ||
    result.length > 30 ||
    new Set(result.map((v) => v.title)).size !== result.length
  )
    throw Error('Mushebi vacancy cards missing or duplicated');
  return result;
}

export const mushebi: SourceModule = {
  config: {
    origin: mushebiOrigin,
    list: mushebiCareersUrl,
    sitemap: null,
    hosts: ['mushebi.ge'],
  },
  listingSnapshot: true,
  externalId: mushebiVacancyId,
  publicUrl: mushebiVacancyUrl,
  detailRequestUrl(url) {
    if (!mushebiVacancyId(url)) throw Error('Invalid Mushebi vacancy URL');
    return mushebiCareersUrl;
  },
  listingUrl: () => mushebiCareersUrl,
  listingInfo(html) {
    const count = vacancies(html).length;
    return { reportedTotal: count, pageSize: count, totalPages: 1 };
  },
  listLinks: (html) =>
    vacancies(html).map((v) => ({ externalId: v.title, url: v.url })),
  parseDetail(html, url) {
    const title = mushebiVacancyId(url);
    if (!title) throw Error('Invalid Mushebi vacancy URL');
    const vacancy = vacancies(html).find((v) => v.title === title);
    if (!vacancy) throw new UnavailableVacancy();
    return vacancy;
  },
};
