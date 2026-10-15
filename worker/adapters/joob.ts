import { load } from 'cheerio';
import { sourceNames, type Vacancy } from '../../lib/types';
import { telephoneNumber } from '../../lib/vacancy-details';
import { visibleFields } from '../visible-fields';
import { cleanText, tbilisiDate } from './index';
import type { ListedLink, ListingInfo, SourceModule } from './module';

// joob.ge is a WordPress (Elementor + JetEngine) board of private job advertisements; its
// REST API is closed to anonymous readers, so the public pages are read. Every card carries
// the WordPress post id (`data-post-id`), and `/?p=<id>` redirects to the post's address,
// which is what identifies a record. The home page holds the newest 82 posts; WordPress day
// archives (`/YYYY/MM/DD/`) hold every post of one day on one page, so today, yesterday and
// the day before cover the whole import window even on a busy day.
const ORIGIN = 'https://joob.ge';
// Home page, then today's archive, yesterday's and the day before's.
const PAGES = 4;
const LABELS = ['ანაზღაურება', 'საკონტაქტო', 'მისამართი', 'სამუშაოს ტიპი'];

const text = (v: string | undefined) => (v || '').replace(/\s+/g, ' ').trim();

/** The Tbilisi calendar day `back` days before today, as a day-archive path. */
function archivePath(back: number) {
  const [y, m, d] = tbilisiDate().split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d - back));
  return `/${day.getUTCFullYear()}/${String(day.getUTCMonth() + 1).padStart(2, '0')}/${String(day.getUTCDate()).padStart(2, '0')}/`;
}

type Posting = {
  '@type'?: unknown;
  datePublished?: unknown;
  articleSection?: unknown;
};

export const joob: SourceModule = {
  config: {
    origin: ORIGIN,
    list: `${ORIGIN}/`,
    sitemap: null,
    hosts: ['joob.ge'],
  },
  externalId: (u) =>
    u.hostname === 'joob.ge' &&
    u.pathname === '/' &&
    /^\d{1,9}$/.test(u.searchParams.get('p') || '') &&
    [...u.searchParams.keys()].length === 1
      ? u.searchParams.get('p')
      : null,
  publicUrl: (id) => `${ORIGIN}/?p=${id}`,
  detailRequestUrl: (url) => url,
  listingUrl: (n) => (n <= 1 ? `${ORIGIN}/` : ORIGIN + archivePath(n - 2)),
  listingInfo: (): ListingInfo => ({
    reportedTotal: null,
    pageSize: null,
    totalPages: PAGES,
  }),
  listLinks(html): ListedLink[] {
    const $ = load(html);
    const links = new Map<string, ListedLink>();
    $('.jet-listing-grid__item[data-post-id]').each((_, el) => {
      const id = $(el).attr('data-post-id') || '';
      if (/^\d{1,9}$/.test(id) && !links.has(id))
        links.set(id, { externalId: id, url: this.publicUrl(id) });
    });
    return [...links.values()];
  },
  parseDetail(html, url): Vacancy {
    const $ = load(html);
    const id = this.externalId(new URL(url));
    const bodyId = ($('body').attr('class') || '').match(
      /(?:^|\s)postid-(\d+)(?:\s|$)/,
    )?.[1];
    if (!id || bodyId !== id)
      throw Error('joob.ge vacancy identity missing or mismatched');
    let post: Posting | undefined;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const graph = (JSON.parse($(el).text()) as { '@graph'?: Posting[] })[
          '@graph'
        ];
        post ??= graph?.find((item) => item?.['@type'] === 'BlogPosting');
      } catch {
        /* Other structured data blocks are irrelevant. */
      }
    });
    // Widgets of the post itself, in page order, up to the related-vacancies block.
    const root = $('.elementor-location-single').first();
    const widgets: { type: string; html: string; text: string }[] = [];
    root.find('.elementor-widget').each((_, el) => {
      const w = $(el);
      if (w.find('.elementor-widget').length) return;
      w.find('noscript').remove();
      widgets.push({
        type: w.attr('data-widget_type') || '',
        html:
          w.find('.jet-listing-dynamic-field__content').first().html() || '',
        text: text(w.text()),
      });
    });
    const end = widgets.findIndex((w) => w.text === 'მსგავსი ვაკანსიები');
    const own = end < 0 ? widgets : widgets.slice(0, end);
    const fields = new Map<string, string>();
    own.forEach((w, i) => {
      const label = w.type.startsWith('heading') && w.text.replace(/:$/, '');
      if (label && LABELS.includes(label) && own[i + 1])
        fields.set(label, own[i + 1].text);
    });
    // The title and the description are the two dynamic fields before the first label.
    const firstLabel = own.findIndex(
      (w) =>
        w.type.startsWith('heading') &&
        LABELS.includes(w.text.replace(/:$/, '')),
    );
    const head = own
      .slice(0, firstLabel < 0 ? own.length : firstLabel)
      .filter((w) => w.type.startsWith('jet-listing-dynamic-field'));
    if (!post || firstLabel < 0 || head.length < 2)
      throw Error('Vacancy structure changed or description is missing');
    const description = cleanText(head[head.length - 1].html);
    const facts: { label: string; value: string }[] = [];
    const section = text(
      typeof post.articleSection === 'string' ? post.articleSection : '',
    );
    if (section) facts.push({ label: 'კატეგორია', value: section });
    const kind = fields.get('სამუშაოს ტიპი') || '';
    if (kind) facts.push({ label: 'სამუშაოს ტიპი', value: kind });
    const phone = telephoneNumber(fields.get('საკონტაქტო') || '');
    if (phone) facts.push({ label: 'საკონტაქტო ტელეფონი', value: phone });
    // The pay field is a bare amount with no period. A pay line in the text says more
    // ("65 ლარი დღეში"), so the shared enrichment reads it from there; only without one
    // does the bare amount stand, and then no period is assumed.
    const amount = (fields.get('ანაზღაურება') || '').match(
      /^(\d{1,6}(?:[.,]\d{1,2})?)\s*₾$/,
    )?.[1];
    const pay =
      amount && !visibleFields(description).salary
        ? {
            salary: `${amount} ₾`,
            salaryMin: Number(amount.replace(',', '.')),
            currency: 'GEL',
          }
        : { salary: '', salaryMin: null, currency: '' };
    return {
      title: text(head[0].text),
      // A private advertisement: the board names no employer, only a contact.
      company: '',
      city: fields.get('მისამართი') || '',
      category: '',
      ...pay,
      salaryPeriod: '',
      mode: kind === 'დისტანციური' ? 'დისტანციური' : '',
      employmentType: '',
      description,
      facts,
      logoUrl: '',
      applicationLinks: [],
      url,
      source: sourceNames.joob,
      datePosted:
        (typeof post.datePublished === 'string'
          ? post.datePublished
          : ''
        ).match(/^(\d{4}-\d{2}-\d{2})T/)?.[1] || '',
      deadline: '',
    };
  },
};
