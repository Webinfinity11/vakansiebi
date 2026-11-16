/** Run: npx tsx tests/fixtures/cv-samples/evaluate.ts — no DB, network or app. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { mock } from 'node:test';
import { performance } from 'node:perf_hooks';
import { parseCvText } from '../../../lib/cv-parse';
import { extractCvText } from '../../../lib/server/cv-text';
import groundTruth from './expected.json';
const dir = 'tests/fixtures/cv-samples/';
const absent = '(not exposed by parser schema)';
const stable = (v: unknown): string => Array.isArray(v) ? JSON.stringify(v.map(stable).sort()) : v && typeof v === 'object' ? JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)))) : JSON.stringify(v);
const cell = (v: unknown) => JSON.stringify(v).replace(/\|/g,'\\|').replace(/\n/g,' ');
async function main() {
 mock.timers.enable({apis:['Date'],now:new Date(groundTruth.asOf).getTime()});
 const totals:Record<string,{correct:number;expected:number}>={};
 const results=[];
 console.log(`As of ${groundTruth.asOf}. Exact field-group equality; arrays compared unordered; extras fail.\n`);
 console.log('| fixture | extracted chars | field | expected | actual | OK/MISS |');
 console.log('|---|---:|---|---|---|---|');
 try {
 for(const [filename,truth] of Object.entries(groundTruth.fixtures)) {
  const bytes=await readFile(dir+filename);assert.ok(bytes.length>0);
  const start=performance.now();const text=await extractCvText(bytes,filename);const extractedAt=performance.now();const p=parseCvText(text);const finished=performance.now();
  const want:Record<string,unknown>={...truth,roles:truth.roles.map(r=>r.label),roleDates:truth.roles.map(r=>({start:r.start,end:r.end}))};
  const actual:Record<string,unknown>={...p,name:absent,email:absent,phone:absent,roleDates:absent,certifications:absent};
  const fields=Object.entries(want).map(([field,expected])=>{const got=actual[field];const ok=stable(expected)===stable(got);totals[field]??={correct:0,expected:0};totals[field].expected++;totals[field].correct+=Number(ok);console.log(`| ${filename} | ${text.length} | ${field} | ${cell(expected)} | ${cell(got)} | ${ok?'OK':'MISS'} |`);return {field,expected,actual:got,ok};});
  results.push({filename,chars:text.length,extractMs:+(extractedAt-start).toFixed(2),parseMs:+(finished-extractedAt).toFixed(2),totalMs:+(finished-start).toFixed(2),text,profile:p,fields,
    contactTextPresence:{name:text.includes(truth.name),email:text.includes(truth.email),phone:text.includes(truth.phone)},
    // Diagnostic only: TXT is unsupported by extractCvText; this does not override its score.
    directTextDiagnostic: filename.endsWith('.txt') ? parseCvText(bytes.toString('utf8')) : undefined});
 }
 } finally {mock.timers.reset();}
 assert.equal(results.length,12);
 assert.equal(results.find(r=>r.filename==='scanned.pdf')?.chars,0,'Image-only PDF should have no text layer');
 console.log('\n| field | correct | expected |\n|---|---:|---:|');for(const [field,t]of Object.entries(totals))console.log(`| ${field} | ${t.correct} | ${t.expected} |`);
 const correct=Object.values(totals).reduce((s,t)=>s+t.correct,0),expected=Object.values(totals).reduce((s,t)=>s+t.expected,0);console.log(`| TOTAL | ${correct} | ${expected} |`);
 console.log('\n| fixture | extract ms | parse ms | total ms |\n|---|---:|---:|---:|');for(const r of results)console.log(`| ${r.filename} | ${r.extractMs} | ${r.parseMs} | ${r.totalMs} |`);
 await writeFile(dir+'results.json',JSON.stringify({asOf:groundTruth.asOf,totals,correct,expected,results},null,2)+'\n');
}
void main();
