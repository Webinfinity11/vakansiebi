/** A verified classified advertisement can be a short original sentence.
 * Keep this exception on the vacancy category and never accept an empty body. */
export function hasShortClassifiedDescription(v: {
  source: string;
  url: string;
  description: string;
}) {
  if (
    v.source !== 'gancxadebebi.ge' ||
    v.description.trim().length < 10 ||
    !/\p{L}/u.test(v.description)
  )
    return false;
  try {
    const url = new URL(v.url);
    const path = decodeURIComponent(url.pathname);
    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      ['gancxadebebi.ge', 'www.gancxadebebi.ge'].includes(url.hostname) &&
      path.includes('/დასაქმება-სამუშაო-3/ვაკანსია-25/') &&
      /-GEO\d+\/?$/.test(path)
    );
  } catch {
    return false;
  }
}
