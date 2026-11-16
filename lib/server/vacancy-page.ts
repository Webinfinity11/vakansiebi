import { cache } from 'react';
import { z } from 'zod';
import { publicJobs } from './jobs';
import type { PublicJob } from '../types';
import { db } from './db';
export type VacancyPageJob = PublicJob & {
  companyOwned?: boolean;
  companyApplyEnabled?: boolean;
};
export const getVacancyPage = cache(
  async (id: string, preview = false): Promise<VacancyPageJob | null> => {
    if (!z.uuid().safeParse(id).success) return null;
    const result = await publicJobs(new URLSearchParams({ ids: id }), preview, {
      skipSavedAvailability: true,
    });
    const job = result.jobs[0];
    if (!job) return null;
    const ownership = await db().query(
      'SELECT 1 FROM company_job_ownership WHERE job_id=$1 LIMIT 1',
      [job.id],
    );
    const companyOwned = !!ownership.rowCount;
    return {
      ...job,
      companyOwned,
      companyApplyEnabled:
        companyOwned && process.env.COMPANY_PORTAL_ENABLED === 'true',
    };
  },
);
