import { load } from 'cheerio';

const origin = 'https://jobs.ss.ge';
const buildPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const bootstrapUrls = [origin + '/ka', origin + '/ka/l/vacancies'];

export function ssNextBuildId(html: string): string | null {
  const $ = load(html);
  try {
    const build = JSON.parse($('#__NEXT_DATA__').text()).buildId;
    if (typeof build === 'string' && buildPattern.test(build)) return build;
  } catch {
    /* A public page may expose only its asset/data URLs. */
  }
  for (const element of $('script[src],a[href]').toArray()) {
    const value = $(element).attr('src') || $(element).attr('href') || '';
    try {
      const url = new URL(value, origin);
      if (url.origin !== origin) continue;
      const build = url.pathname.match(
        /^\/_next\/(?:data|static)\/([a-zA-Z0-9_-]+)\/(?:.*\.json|_buildManifest\.js|_ssgManifest\.js)$/,
      )?.[1];
      if (build && buildPattern.test(build)) return build;
    } catch {
      /* Ignore unrelated links. */
    }
  }
  return null;
}

export function ssNextDataUrl(page: string, build: string): string {
  const url = new URL(page);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !buildPattern.test(build) ||
    !/^\/ka\/(?:l\/vacancies|details\/[^/]+-\d+)\/?$/.test(url.pathname)
  )
    throw Error('Unsupported SS JSON page');
  url.pathname = `/_next/data/${build}${url.pathname.replace(/\/$/, '')}.json`;
  url.hash = '';
  return url.href;
}

/** Feed the same state to the existing parsers. Never synthesize visible contact controls. */
export function ssNextHtml(json: string, page: string): string {
  const data = JSON.parse(json);
  const props = data?.pageProps;
  if (
    !props ||
    typeof props !== 'object' ||
    Array.isArray(props) ||
    data.notFound ||
    props.__N_REDIRECT ||
    data.__N_REDIRECT
  )
    throw Error('SS JSON page data missing');
  const url = new URL(page);
  ssNextDataUrl(page, 'validate');
  const $ = load(
    '<script id="__NEXT_DATA__" type="application/json"></script>',
  );
  if (url.pathname.replace(/\/$/, '') === '/ka/l/vacancies') {
    const result = props.searchInitData?.result;
    if (
      !Array.isArray(result?.items) ||
      !Number.isSafeInteger(result.totalCount) ||
      result.totalCount < 0
    )
      throw Error('SS JSON listing structure missing');
    for (const item of result.items) {
      if (
        !Number.isSafeInteger(item?.id) ||
        item.id <= 0 ||
        typeof item.seoTitle !== 'string' ||
        !item.seoTitle ||
        item.jobsDealType !== 1
      )
        throw Error('SS JSON listing identity missing');
      $('body').append(
        $('<a></a>').attr(
          'href',
          `/ka/details/${encodeURIComponent(item.seoTitle)}-${item.id}`,
        ),
      );
    }
  } else {
    const id = url.pathname.match(/-(\d+)\/?$/)?.[1];
    if (
      String(props.detailsInitData?.id) !== id ||
      props.detailsInitData?.jobsDealType !== 1
    )
      throw Error('SS JSON vacancy identity missing or mismatched');
  }
  // Escaping '<' prevents source text from terminating the script element.
  $('#__NEXT_DATA__').text(
    JSON.stringify({ props: { pageProps: props } }).replaceAll('<', '\\u003c'),
  );
  return $.html();
}

/** One bounded bootstrap per process/hour; concurrent detail requests share it. */
export class SsNextFallback {
  private build: string | null = null;
  private attemptedAt = 0;
  private loading?: Promise<string | null>;

  observe(html: string) {
    const build = ssNextBuildId(html);
    if (build) this.build = build;
  }

  private async discover(read: (url: string) => Promise<string>) {
    if (this.loading) return this.loading;
    if (Date.now() - this.attemptedAt < 3600_000) return this.build;
    this.attemptedAt = Date.now();
    this.loading = (async () => {
      for (const url of bootstrapUrls) {
        try {
          this.observe(await read(url));
        } catch {
          /* Keep the original HTML failure. */
        }
        if (this.build) break;
      }
      return this.build;
    })();
    try {
      return await this.loading;
    } finally {
      this.loading = undefined;
    }
  }

  async fetch(page: string, read: (url: string) => Promise<string>) {
    // Validate before bootstrapping; no arbitrary routes, APIs or hosts.
    ssNextDataUrl(page, 'validate');
    const build = this.build || (await this.discover(read));
    if (!build) throw Error('SS JSON build ID unavailable');
    try {
      return ssNextHtml(await read(ssNextDataUrl(page, build)), page);
    } catch (error) {
      // A stale Next build route is not a removed vacancy. Refresh at most once,
      // and only when the transport returned 404 (not a malformed/blocked page).
      if ((error as { status?: number }).status !== 404) throw error;
      if (this.build === build) this.build = null;
      const fresh = await this.discover(read);
      if (!fresh || fresh === build) throw error;
      return ssNextHtml(await read(ssNextDataUrl(page, fresh)), page);
    }
  }
}
