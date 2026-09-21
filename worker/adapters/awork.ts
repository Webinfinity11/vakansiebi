import { load } from 'cheerio';
import { sourceNames } from '../../lib/types';
import { safeExternalUrl } from '../../lib/vacancy-media';
import { cleanText, georgianDate, tbilisiDate } from './index';
import type { ListedLink, SourceModule } from './module';

const sitemap = 'https://awork.ge/sitemap-vacancy.xml';
const text = (value: string) => value.replace(/\s+/g, ' ').trim();

export const awork: SourceModule = {
  config: {
    origin: 'https://awork.ge',
    list: sitemap,
    sitemap: null, // This single vacancy sitemap is already the complete listing.
    hosts: ['awork.ge', 'www.awork.ge'],
  },
  externalId: (u) =>
    ['awork.ge', 'www.awork.ge'].includes(u.hostname)
      ? (u.pathname.match(/^\/user\/vacancy\/([a-f0-9]{24})(?:-|\/?$)/)?.[1] ??
        null)
      : null,
  publicUrl: (id) => `https://awork.ge/user/vacancy/${id}`,
  detailRequestUrl: (url) => url,
  listingUrl: () => sitemap,
  listingInfo: () => ({ reportedTotal: null, pageSize: null, totalPages: 1 }),
  listLinks(xml) {
    const $ = load(xml, { xml: true });
    const links = new Map<string, ListedLink>();
    $('url > loc').each((_, el) => {
      try {
        const u = new URL($(el).text().trim());
        const id = this.externalId(u);
        if (u.protocol === 'https:' && id)
          links.set(id, { externalId: id, url: this.publicUrl(id) });
      } catch {
        /* Ignore malformed sitemap entries. */
      }
    });
    // The source lists oldest first. ObjectId order puts newer records first;
    // publication dates still come exclusively from the detail page.
    return [...links.values()].sort((a, b) =>
      b.externalId.localeCompare(a.externalId),
    );
  },
  parseDetail(html, url) {
    const $ = load(html);
    const id = this.externalId(new URL(url));
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!id || !canonical || this.externalId(new URL(canonical, url)) !== id)
      throw Error('Awork vacancy identity missing or mismatched');
    const root = $('vacancy-details');
    const fields = new Map<string, string>();
    root.find('.overview-item').each((_, el) => {
      const label = text($(el).find('.overview-item-title').text());
      const value = text($(el).find('.overview-item-info').text());
      if (label && value && value !== 'არ არის მითითებული')
        fields.set(label, value);
    });
    const dates = text(
      root.find('.vacancy-start-end-date').first().text(),
    ).split(/\s+[-–]\s+/);
    const today = tbilisiDate();
    const year = Number(today.slice(0, 4));
    let datePosted = georgianDate(dates[0] || '', year);
    if (datePosted && datePosted > today)
      datePosted = georgianDate(dates[0], year - 1);
    if (!datePosted) throw Error('Awork publication date missing');
    const postedYear = Number(datePosted.slice(0, 4));
    let deadline = georgianDate(dates[1] || '', postedYear);
    if (deadline && deadline < datePosted)
      deadline = georgianDate(dates[1], postedYear + 1);
    const salary = fields.get('ხელფასი') || '';
    // Keep the explicit source label; a pay period is never assumed.
    const amount = salary.match(/^(\d[\d ,]*)\s*₾(?:\s*\+\s*ბონუსი)?$/);
    const applicationLinks: { label: string; url: string }[] = [];
    root.find('.job-detail-description a[href]').each((_, el) => {
      const href = safeExternalUrl($(el).attr('href') || '', url);
      if (href)
        applicationLinks.push({
          label: text($(el).text()).slice(0, 150) || new URL(href).hostname,
          url: href,
        });
    });
    return {
      title: text(
        root.find('.vacancy-info .vacancy-content h4').first().text(),
      ),
      company: text(root.find('business-card .company-info h4').first().text()),
      city: fields.get('მისამართი') || '',
      category: '',
      salary,
      salaryMin: amount ? Number(amount[1].replace(/[ ,]/g, '')) : null,
      currency: salary.includes('₾') ? 'GEL' : '',
      salaryPeriod: '',
      mode: fields.get('სამუშაოს ტიპი') || '',
      employmentType: fields.get('დასაქმების ტიპი') || '',
      description: cleanText(root.find('.job-detail-description').html() || ''),
      facts: [...fields].map(([label, value]) => ({ label, value })),
      applicationLinks,
      url,
      source: sourceNames.awork,
      datePosted,
      deadline,
    };
  },
};
