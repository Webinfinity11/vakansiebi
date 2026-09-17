import { z } from 'zod';

export const scraperLimitFields = {
  batchLimit: z.number().int().min(1).max(200).optional(),
  budgetMinutes: z.number().int().min(1).max(8).optional(),
  discoveryPageLimit: z.number().int().min(0).max(3).optional(),
  repairLimit: z.number().int().min(0).max(20).optional(),
};

export type StoredScraperLimits = {
  batch_limit?: number;
  budget_minutes?: number;
  discovery_page_limit?: number;
  repair_limit?: number;
};

/** Admin settings can reduce the runner's ceilings, never silently raise them. */
export function effectiveScraperLimits(
  config: StoredScraperLimits,
  runner: {
    batch: number;
    minutes: number;
    pages: number;
  },
) {
  return {
    batch: Math.min(runner.batch, config.batch_limit ?? runner.batch),
    minutes: Math.min(runner.minutes, config.budget_minutes ?? runner.minutes),
    pages: Math.min(runner.pages, config.discovery_page_limit ?? runner.pages),
  };
}
