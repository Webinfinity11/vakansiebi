import 'dotenv/config';
import { purgeEnded } from '../worker/purge';
/* Counts by default. `--apply` deletes, in one transaction. */
const result = await purgeEnded({ apply: process.argv.includes('--apply') });
console.log(JSON.stringify(result));
process.exit(0);
