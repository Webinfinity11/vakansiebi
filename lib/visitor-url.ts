/* A source's address as a visitor's browser has to open it. The stored
   address stays as the scraper keys it; only what the page links to changes.
   worknet's app knows the languages "ka-GE" and "en-US" and opened its home
   page for the "/ka/vacancies/…" addresses its API hands out. */
export function visitorUrl(url: string) {
  return url.replace(
    /^https:\/\/worknet\.moh\.gov\.ge\/ka\/vacancies\//,
    'https://worknet.moh.gov.ge/ka-GE/vacancies/',
  );
}
