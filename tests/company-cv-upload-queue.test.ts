import test from 'node:test';
import assert from 'node:assert/strict';
import {runCvUploadQueue, uploadSummary, type UploadRow} from '../lib/company-talent-filters';

test('CV batch bounds concurrency at three and isolates failed files', async () => {
  let active=0, peak=0;
  const updates: UploadRow<number>[]=[];
  const rows=await runCvUploadQueue(Array.from({length:30},(_,i)=>i), async file => {
    active++; peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,1));
    active--;
    if(file===4) throw new Error('არასწორი ფაილი');
    return {entry:`upload:${file}`,duplicate:false};
  },(i,row)=>{updates[i]=row;});
  assert.equal(peak,3);
  assert.equal(rows.length,30);
  assert.equal(rows[4].error,'არასწორი ფაილი');
  assert.deepEqual(updates,rows);
  assert.deepEqual(uploadSummary(rows),{uploaded:29,failed:1});
  const retry=await runCvUploadQueue([rows[4].file],async file=>({entry:`upload:${file}`,duplicate:false}),()=>{});
  assert.deepEqual(uploadSummary(retry),{uploaded:1,failed:0});
});
test('over thirty files rejects the whole batch before any upload', async()=>{
  let called=false;
  await assert.rejects(runCvUploadQueue(Array(31).fill(0),async()=>{called=true; return {entry:'x',duplicate:false};},()=>{}),/ერთ ჯერზე მაქსიმუმ 30 ფაილი/);
  assert.equal(called,false);
  assert.deepEqual(await runCvUploadQueue([],async()=>({entry:'x',duplicate:false}),()=>{}),[]);
});
