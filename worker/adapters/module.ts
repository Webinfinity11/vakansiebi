import type { Vacancy } from '../../lib/types';

/** The source says this vacancy no longer exists (removed, closed, cancelled or not a vacancy). */
export class UnavailableVacancy extends Error {
  constructor() {
    super('Source vacancy unavailable');
  }
}

/** What a listing page already says about a vacancy before its detail is fetched. */
export type ListingHints = {
  city?: string;
  /** Catalogue category the source's own classification maps to. */
  category?: string;
  /** The source's own label, kept as a visible fact. */
  categoryLabel?: string;
  salaried?: boolean;
};
export type ListedLink = {
  externalId: string;
  url: string;
  hints?: ListingHints;
};
export type ListingInfo = {
  /** Exact source-reported listing total. Null means the source did not expose one. */
  reportedTotal: number | null;
  pageSize: number | null;
  totalPages: number | null;
};
export type SourceConfig = {
  origin: string;
  list: string;
  sitemap: string | null;
  hosts: string[];
};
/**
 * A self-contained source. Public vacancy URLs identify records and are what the catalogue
 * links to; `detailRequestUrl` maps one to the document that is actually fetched, which for a
 * JSON-backed board is its public API rather than a client-rendered page.
 */
export type SourceModule = {
  config: SourceConfig;
  /** Vacancy id from a public vacancy URL on an allowed host, or null. */
  externalId(url: URL): string | null;
  publicUrl(id: string): string;
  detailRequestUrl(url: string): string;
  listingUrl(page: number): string;
  listingInfo(text: string): ListingInfo;
  listLinks(text: string): ListedLink[];
  /** Source-specific parse; the shared tail in `parseDetail` normalises and validates. */
  parseDetail(text: string, url: string, hints?: ListingHints): Vacancy;
  /** Larger JSON pages (embedded logos) need more room than an HTML page. */
  maxResponseBytes?: number;
};
