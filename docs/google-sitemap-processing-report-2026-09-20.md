# Google Search Console report — posted September 20, 2026

**Submission:** Published to the official Google Search Central Help Community after explicit user authorization. Confirmed by the UI: "You have successfully posted in Google Help Community".

**Thread:** https://support.google.com/webmasters/thread/468733114?hl=en

**Notifications:** Email notifications for replies enabled. No replies at submission time. This is a public community support thread, not a confirmed private support case or a resolved issue. The evidence below is the source report; the published wording was adapted to the community form.

**Subject:** jobx.ge sitemap processing discrepancy: successful Google fetches, but Unknown / Couldn't fetch

**Properties:** `sc-domain:jobx.ge` and `https://jobx.ge/`

Please investigate sitemap ingestion/reporting for these URLs:

- https://jobx.ge/sitemap.xml
- https://jobx.ge/sitemap-index.xml
- https://jobx.ge/sitemap-pages.xml

All three are listed as Unknown / Couldn't fetch, with no last-read date in the Sitemaps table and zero discovered pages. The detail view provides no specific HTTP or XML parsing error. The homepage's URL Inspection report shows Discovery → Sitemaps: **Temporary processing error**.

Evidence collected September 20, 2026 (Asia/Tbilisi, UTC+4):

1. Google's Live URL Tests returned “URL is available to Google” for sitemap-pages.xml at approximately 13:06, sitemap.xml at 13:07, and sitemap-index.xml at 13:09. The expanded pages sitemap result confirms crawl allowed Yes and page fetch Successful.
2. Historical URL Inspection for sitemap-index.xml records a successful Googlebot smartphone fetch on September 19 at 18:20:49.
3. sitemap-pages.xml is a database-independent static XML urlset with only two URLs. sitemap-index.xml is also static. Thus the same reported problem affects both static and dynamically generated XML.
4. Public responses are HTTP 200 with an XML Content-Type and valid UTF-8 XML. The current main sitemap is below 50,000 URLs and 50 MB. Its 13,049 unique URLs include 10,123 public vacancy pages following the latest deployment.
5. Both HTTP and HTTPS robots.txt reports say Fetched, with no issues. robots.txt permits crawling and declares https://jobx.ge/sitemap.xml.
6. Manual actions and Security issues both say No issues detected. The homepage is indexed, was successfully crawled September 19 at 22:17:06, and Google's selected canonical matches the homepage.
7. Crawl stats (report updated September 18) show 164 requests and no host problems. Page indexing says “Processing data, please check again in a day or so.” The property was added to this account September 18; this does not establish domain age.
8. The main sitemap was submitted September 20 and the UI confirmed “Sitemap submitted successfully”, but the table continued to show Couldn't fetch. No ingestion success is being claimed.

We understand that sitemap ingestion and URL indexing are different, and that a successful Live Test does not prove ingestion. We are not requesting that XML files themselves be indexed as search-result pages.

Could you confirm whether these sitemaps are awaiting processing or failing in the sitemap ingestion system? If they are failing, please provide the fetch timestamp, HTTP status, or parsing error so we can correlate it with hosting logs. If this is a reporting/processing defect, please investigate the affected property.

No credentials or private account data were included in the message body. The community displays the existing Google profile name as author.

## Follow-up: community response, September 20

Jaskaran Singh (Gold Product Expert) replied to the posted thread. He explains
that `Couldn't fetch` can be shown while a sitemap is still waiting to be
processed, and points to the pinned community guide:
https://support.google.com/webmasters/thread/184533703/are-you-seeing-couldn-t-fetch-reported-for-your-sitemap

This is community advice, not a site-specific Google engineering diagnosis or
confirmation of successful ingestion. The guide also notes that inspection tools
use a different user agent; successful Live Tests alone cannot prove ingestion.
Google's sitemap documentation explicitly says submission does not guarantee
Google downloads or uses the sitemap.

The refreshed authenticated Search Console report still shows Unknown / Couldn't
fetch, no Last read, and zero discovered pages for the three submissions.
A fresh public fetch of the main sitemap returned HTTP 200, application/xml;
charset=utf-8, parsed XML, 13,049 entries and 1,865,158 bytes. No new concrete
formatting defect was identified. Preserve the submitted URLs and the local
crawlable-pagination improvements; do not claim resolution or change sitemap
formats solely to clear this status. Publication remains pending user instruction.
