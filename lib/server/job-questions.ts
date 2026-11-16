import type { PoolClient } from 'pg';
import { db } from './db';
import { jobQuestionsSchema, type JobQuestion } from '../job-questions';
export async function loadJobQuestions(jobId: string): Promise<JobQuestion[]> {
  const { rows } = await db().query(
    'SELECT questions FROM company_job_questions WHERE job_id=$1',
    [jobId],
  );
  return jobQuestionsSchema.parse(rows[0]?.questions ?? []);
}
export async function saveJobQuestions(
  client: PoolClient,
  jobId: string,
  questions: JobQuestion[],
) {
  await client.query(
    `INSERT INTO company_job_questions(job_id,questions) VALUES($1,$2)
    ON CONFLICT(job_id) DO UPDATE SET questions=EXCLUDED.questions,updated_at=now()`,
    [jobId, JSON.stringify(jobQuestionsSchema.parse(questions))],
  );
}
