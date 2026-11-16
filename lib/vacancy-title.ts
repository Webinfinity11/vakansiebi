import { siteName } from "./site-brand";

/** Search results show roughly 60–70 characters of a title. */
const titleLimit = 70;

function clip(text: string, limit: number) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return (space > limit / 2 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

/* One employer often posts the same position in several cities, so the city
   is what tells those pages apart. Shortening drops the brand first, then the
   employer, and only then cuts the position's own words. */
export function vacancyTitle(job: {
  title: string;
  company?: string | null;
  city?: string | null;
}) {
  const title = job.title.replace(/\s+/g, " ").trim();
  const city = job.city?.trim();
  const company = job.company?.replace(/\s+/g, " ").trim();
  // Georgian inflects the name ("ბათუმი" → "ბათუმში"), so compare its stem.
  const stem = city?.replace(/ი$/, "");
  const where =
    city && stem && !title.includes(stem) ? `${title}, ${city}` : title;
  const options = [
    company ? `${where} — ${company} | ${siteName}` : `${where} | ${siteName}`,
    company ? `${where} — ${company}` : where,
    where,
  ];
  return (
    options.find((option) => option.length <= titleLimit) ??
    clip(where, titleLimit)
  );
}
