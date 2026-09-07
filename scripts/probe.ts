import 'dotenv/config';
import fs from 'node:fs/promises';
import {
  configs,
  getSourceConfig,
  listLinks,
  parseDetail,
} from '../worker/adapters';
import { sourceFetch } from '../worker/http';
import type { SourceId } from '../lib/types';
const requested = process.argv
  .find((a) => a.startsWith('--source='))
  ?.split('=')[1];
if (requested && !(requested in configs)) throw Error('Unknown source');
for (const source of (requested
  ? [requested]
  : Object.keys(configs)) as SourceId[]) {
  try {
    const html = await sourceFetch(source, getSourceConfig(source).list);
    const links = listLinks(source, html);
    if (!links[0]) throw Error('No vacancy links');
    const detail = await sourceFetch(source, links[0].url);
    if (process.argv.includes('--save')) {
      await fs.mkdir('.local/probes', { recursive: true });
      await fs.writeFile('.local/probes/' + source + '-list.html', html);
      await fs.writeFile('.local/probes/' + source + '-detail.html', detail);
      await fs.writeFile('.local/probes/' + source + '-url.txt', links[0].url);
    }
    const job = parseDetail(source, detail, links[0].url);
    console.log(
      JSON.stringify({
        source,
        links: links.length,
        title: job.title,
        company: job.company,
        descriptionLength: job.description.length,
        datePosted: job.datePosted,
        deadline: job.deadline,
        salary: job.salary,
        logo: Boolean(job.logoUrl),
        applicationLinks: job.applicationLinks?.length || 0,
        warnings: job.warnings,
      }),
    );
  } catch (e) {
    console.log(JSON.stringify({ source, error: (e as Error).message }));
    process.exitCode = 1;
  }
}
