import { cache } from 'react';
import { z } from 'zod';
import { publicJobs } from './jobs';
import type { PublicJob } from '../types';
export const getVacancyPage = cache(
  async (id: string, preview = false): Promise<PublicJob | null> => {
    if (!z.uuid().safeParse(id).success) return null;
    const result = await publicJobs(new URLSearchParams({ ids: id }), preview);
    return result.jobs[0] || null;
  },
);
