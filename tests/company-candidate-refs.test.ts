import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

test('add reference: both base sources, ownership, roles, idempotence and private contacts; upload names', {skip:process.env.RUN_COMPANY_DB_TESTS!=='1'}, async()=>{
  const url=new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname,'localhost'); assert.equal(url.pathname,'/jobx_company_local');
  const {db}=await import('../lib/server/db');
  const {changeCandidate,companyCandidates,companyCvBase,companyCvBaseList,uploadCandidate}=await import('../lib/server/company-candidates');
  const key='refsqa'+randomUUID().replaceAll('-','');
  const company={id:randomUUID(),companyKey:key,name:'Refs QA',username:key,email:key+'@example.com',mustChangePassword:false,role:'owner' as const,approvalStatus:'approved' as const,emailVerified:true,representativeName:'QA'};
  const job=randomUUID(),foreign=randomUUID(),resume=randomUUID(),swipe=randomUUID();
  try {
    await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$2)',[key,'Refs QA']);
    for(const id of [job,foreign]) await db().query("INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",[id,JSON.stringify({title:'QA vacancy'})]);
    await db().query('INSERT INTO company_job_ownership(company_key,job_id) VALUES($1,$2)',[key,job]);
    await db().query('INSERT INTO resumes(id,delete_token_hash,cv) VALUES($1,$2,$3)',[resume,'a'.repeat(64),JSON.stringify({fullName:'ნინო ტესტიძე',email:key+'@example.com'})]);
    await db().query(`INSERT INTO swipe_applications(id,job_id,candidate_name,candidate_email,candidate_phone,cv_kind,cv_file,status,client_hash,candidate_key,recipient)
      VALUES($1,$2,'გიორგი ტესტიძე',$3,'555123456','upload','qa-reference.pdf','sent',$4,$4,'qa@example.com')`,[swipe,foreign,key+'s@example.com','a'.repeat(64)]);
    for(const entry of ['base:r:'+resume,'base:s:'+swipe]) {
      await assert.rejects(changeCandidate({...company,role:'viewer'}, {action:'save',entry,saved:true}),/უფლება/);
      await Promise.all([1,2,3].map(()=>changeCandidate(company,{action:'save',entry,saved:true})));
      assert.equal((await db().query('SELECT count(*)::int n FROM company_saved_candidates WHERE company_key=$1 AND entry=$2',[key,entry])).rows[0].n,1);
      assert.equal((await db().query('SELECT count(*)::int n FROM company_candidate_states WHERE company_key=$1 AND entry=$2',[key,entry])).rows[0].n,0);
      assert.equal((await companyCandidates(company)).some(c=>c.entry===entry),false);
      const savedBase=(await companyCvBaseList(company,'',{schedule:()=>{}})).find(c=>c.entry===entry)!;
      assert.equal(savedBase.saved,true);assert.equal(savedBase.contactHidden,true);assert.equal(savedBase.email,'');assert.equal(savedBase.phone,'');
      await Promise.all([1,2].map(()=>changeCandidate(company,{action:'save',entry,saved:false})));
      assert.equal((await db().query('SELECT count(*)::int n FROM company_saved_candidates WHERE company_key=$1 AND entry=$2',[key,entry])).rows[0].n,0);
      await assert.rejects(changeCandidate({...company,role:'viewer'}, {action:'add',entry,jobId:job}),/უფლება/);
      await assert.rejects(changeCandidate(company,{action:'add',entry,jobId:foreign}),/ვაკანსია/);
      await assert.rejects(changeCandidate({...company,role:'viewer'}, {action:'add',entry}),/უფლება/);
      await Promise.all([undefined,null,undefined].map(jobId=>changeCandidate(company,{action:'add',entry,jobId})));
      let unattached=(await companyCandidates(company)).find(c=>c.entry===entry)!;
      assert.equal(unattached.stage,'new');assert.equal(unattached.jobId,null);
      assert.equal(unattached.contactHidden,true);assert.equal(unattached.email,'');assert.equal(unattached.phone,'');
      const refs=(await db().query('SELECT job_id FROM company_candidate_refs WHERE company_key=$1 AND entry=$2',[key,entry])).rows;
      assert.deepEqual(refs,[{job_id:null}]);
      await changeCandidate(company,{action:'stage',entries:[entry],stage:'rejected'});
      assert.equal((await companyCandidates(company)).find(c=>c.entry===entry)?.stage,'rejected');
      await changeCandidate(company,{action:'stage',entries:[entry],stage:'new'});
      await changeCandidate(company,{action:'stage',entries:[entry],stage:'interview'});
      await changeCandidate(company,{action:'add',entry});
      unattached=(await companyCandidates(company)).find(c=>c.entry===entry)!;
      assert.equal(unattached.stage,'interview');
      await Promise.all([1,2,3].map(()=>changeCandidate(company,{action:'add',entry,jobId:job})));
      const found=(await companyCandidates(company)).find(c=>c.entry===entry)!;
      assert.equal(found.stage,'interview');assert.equal(found.jobId,job);assert.equal(found.contactHidden,true);assert.equal(found.email,'');
      assert.equal(found.added?.jobTitle,'QA vacancy');
      assert.equal((await db().query('SELECT count(*)::int n FROM company_candidate_refs WHERE company_key=$1 AND entry=$2',[key,entry])).rows[0].n,1);
      assert.equal((await companyCvBase(company,{schedule:()=>{}})).find(c=>c.entry===entry)?.added?.jobId,job);
    }
    for(const [filename,text,name,missing] of [
      ['wrong_filename.txt','ნინო მაისურაძე\nnino@example.com\nSkills\nExcel, SQL','ნინო მაისურაძე',false],
      [' unknown_person-name.txt','Skills\nExcel, SQL, Python\n'+key,'unknown person name',true],
    ] as const) {
      const form=new FormData();form.set('file',new File([text],filename));
      const result=await uploadCandidate(company,form);
      let c=(await companyCandidates(company)).find(c=>c.entry===result.entry)!;
      assert.equal(c.jobId,null);assert.equal(c.stage,'new');
      await changeCandidate(company,{action:'stage',entries:[c.entry],stage:'rejected'});
      assert.equal((await companyCandidates(company)).find(row=>row.entry===c.entry)?.stage,'rejected');
      await changeCandidate(company,{action:'stage',entries:[c.entry],stage:'new'});
      assert.equal((await companyCandidates(company)).find(row=>row.entry===c.entry)?.stage,'new');
      assert.equal(c.name,name);assert.equal(!!c.profile?.parse?.nameMissing,missing);
      await assert.rejects(changeCandidate({...company,role:'viewer'},{action:'add',entry:c.entry,jobId:job}),/უფლება/);
      await assert.rejects(changeCandidate(company,{action:'add',entry:c.entry,jobId:foreign}),/ვაკანსია/);
      await assert.rejects(changeCandidate(company,{action:'profile',entry:c.entry,edit:{name:' '}}));
      await changeCandidate(company,{action:'profile',entry:c.entry,edit:{name:'ნინო ტესტიძე',title:'ბუღალტერი'}});
      c=(await companyCandidates(company)).find(row=>row.entry===c.entry)!;
      assert.equal(c.name,'ნინო ტესტიძე');assert.equal(c.title,'ბუღალტერი');assert.equal(!!c.profile?.parse?.nameMissing,false);
      await changeCandidate(company,{action:'stage',entries:[c.entry],stage:'interview'});
      await Promise.all([1,2,3].map(()=>changeCandidate(company,{action:'add',entry:c.entry,jobId:job})));
      c=(await companyCandidates(company)).find(c=>c.entry===result.entry)!;
      // Attaching a vacancy keeps the stage a candidate already reached.
      assert.equal(c.jobId,job);assert.equal(c.stage,'interview');
      await changeCandidate(company,{action:'save',entry:c.entry,saved:true});
      assert.equal((await companyCandidates(company)).find(row=>row.entry===c.entry)?.saved,true);
      await changeCandidate(company,{action:'save',entry:c.entry,saved:false});
    }
  } finally {
    await db().query('DELETE FROM company_job_ownership WHERE company_key=$1',[key]);
    await db().query('DELETE FROM company_profiles WHERE company_key=ANY($1::text[])',[[key]]);
    await db().query('DELETE FROM swipe_applications WHERE id=$1',[swipe]);
    await db().query('DELETE FROM resumes WHERE id=$1',[resume]);
    await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])',[[job,foreign]]);
    await db().end();
  }
});
