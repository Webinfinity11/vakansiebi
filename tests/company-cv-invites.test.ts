import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {cvInviteHash} from '../lib/server/cv-base-invites';
import {cvBaseConsentVersion} from '../lib/cv-base-consent';

test('invite token rejects garbage and wrong lengths',()=>{
  for(const token of ['', 'a'.repeat(42),'a'.repeat(44),'!'.repeat(43),'../../secret']) assert.equal(cvInviteHash(token),null);
  assert.match(cvInviteHash('a'.repeat(43))!,/^[a-f0-9]{64}$/);
});
test('CV invites: consent gates every shared path and withdrawal removes references', {skip:process.env.RUN_COMPANY_DB_TESTS!=='1'},async t=>{
  const url=new URL(process.env.DATABASE_URL!);assert.equal(url.hostname,'localhost');assert.equal(url.pathname,'/jobx_company_local');
  const {db}=await import('../lib/server/db');
  const {inviteCvToBase,cvInvite,changeCvConsent}=await import('../lib/server/cv-base-invites');
  const {companyCvBase,companyCandidateDetail,changeCandidate,candidateCv,revealCandidate}=await import('../lib/server/company-candidates');
  const key='inviteqa'+randomUUID().replaceAll('-','');
  const owner={id:randomUUID(),companyKey:key,name:'QA Company',username:key,email:key+'@example.com',mustChangePassword:false,role:'owner' as const,approvalStatus:'approved' as const,emailVerified:true,representativeName:'QA'};
  const other={...owner,id:randomUUID(),companyKey:key+'other'};
  const job=randomUUID();
  const upload=randomUUID(),entry='upload:'+upload,base='base:u:'+upload;
  const list=()=>companyCvBase(other,{schedule:()=>{}});
  let token='';
  try {
    for(const c of [owner,other]) await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$2)',[c.companyKey,c.name]);
    // A real account lets the existing reveal audit retain its account foreign key.
    await db().query(`INSERT INTO company_accounts(id,company_key,username,email,password_hash,role) VALUES($1,$2,$3,$3||'@example.com','test','owner')`,[other.id,other.companyKey,other.companyKey]);
    await db().query("INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",[job,JSON.stringify({title:'Invite QA vacancy'})]);
    await db().query('INSERT INTO company_job_ownership(company_key,job_id) VALUES($1,$2)',[other.companyKey,job]);
    await db().query(`INSERT INTO company_cv_uploads(id,company_key,name,email,phone,title,file_name,file_hash,file_size,content)
      VALUES($1,$2,'ნინო ტესტიძე',$3,'555123456','ბუღალტერი','cv.txt',$4,7,$5)`,[upload,key,key+'@example.com','a'.repeat(64),Buffer.from('test cv')]);
    await t.test('private uploads cannot be listed, opened, revealed, saved or added by a foreign company',async()=>{
      assert.equal((await list()).some(c=>c.entry===base),false);
      for(const action of [()=>companyCandidateDetail(other,base),()=>candidateCv(other,base),()=>revealCandidate(other,base),()=>changeCandidate(other,{action:'save',entry:base,saved:true}),()=>changeCandidate(other,{action:'add',entry:base,jobId:job})]) await assert.rejects(action,/ვერ მოიძებნა/);
    });
    await t.test('foreign company and viewer cannot invite; hash only is stored',async()=>{
      await assert.rejects(inviteCvToBase(other,entry),/ვერ მოიძებნა/);
      await assert.rejects(changeCandidate({...owner,role:'viewer'},{action:'invite',entry}),/უფლება/);
      const result=await inviteCvToBase(owner,entry);token=result.link.split('/').pop()!;
      const row=(await db().query('SELECT * FROM company_cv_invites WHERE upload_id=$1',[upload])).rows[0];
      assert.equal(row.token_hash,cvInviteHash(token));assert.equal(JSON.stringify(row).includes(token),false);
      assert.equal(Math.round((row.expires_at-row.created_at)/86400000),30);
      assert.equal((await list()).some(c=>c.entry===base),false);
    });
    await t.test('creating again rotates token; GET does not consent; expired and garbage rejected',async()=>{
      const old=token;token=(await inviteCvToBase(owner,entry)).link.split('/').pop()!;
      assert.equal(await cvInvite(old),null);await assert.rejects(changeCvConsent(old,'consent'));
      assert.equal((await cvInvite(token)).consented_at,null);assert.equal((await cvInvite(token)).consented_at,null);
      await db().query("UPDATE company_cv_invites SET expires_at=now()-interval '1 second' WHERE upload_id=$1",[upload]);
      assert.equal(await cvInvite(token),null);await assert.rejects(changeCvConsent(token,'consent'));
      for(const garbage of ['bad','a'.repeat(43),'a'.repeat(200)]) { assert.equal(await cvInvite(garbage),null);await assert.rejects(changeCvConsent(garbage,'consent')); }
      token=(await inviteCvToBase(owner,entry)).link.split('/').pop()!;
    });
    await t.test('double consent is idempotent, contacts hidden, own upload not duplicated',async()=>{
      await Promise.all([changeCvConsent(token,'consent'),changeCvConsent(token,'consent')]);
      const first=(await db().query('SELECT consented_at,consent_version FROM company_cv_invites WHERE upload_id=$1',[upload])).rows[0];
      await changeCvConsent(token,'consent');
      const second=(await db().query('SELECT consented_at,consent_version FROM company_cv_invites WHERE upload_id=$1',[upload])).rows[0];
      assert.deepEqual(second,first);assert.equal(first.consent_version,cvBaseConsentVersion);
      const c=(await list()).find(c=>c.entry===base)!;assert.ok(c);assert.equal(c.email,'');assert.equal(c.phone,'');assert.equal(c.contactHidden,true);
      assert.equal((await companyCvBase(owner,{schedule:()=>{}})).some(c=>c.entry===base),false);
      assert.equal((await companyCandidateDetail(owner,entry)).invite?.consentedAt,first.consented_at.toISOString());
      await assert.rejects(inviteCvToBase(owner,entry),/უკვე/);
      assert.equal((await revealCandidate(other,base)).email,key+'@example.com');
      const cv=await candidateCv(other,base);assert.equal(cv?.name,'cv.txt');assert.equal(Buffer.from(cv!.body as Uint8Array).toString(),'test cv');
    });
    await t.test('withdrawal works after expiry and deletes other companies tracking but retains private upload',async()=>{
      await changeCandidate(other,{action:'save',entry:base,saved:true});
      await changeCandidate(other,{action:'rate',entry:base,rating:4});
      await changeCandidate(other,{action:'add',entry:base,jobId:job});
      assert.equal((await companyCandidateDetail(other,base)).jobId,job);
      await db().query("UPDATE company_cv_invites SET expires_at=now()-interval '40 days' WHERE upload_id=$1",[upload]);
      assert.ok(await cvInvite(token));
      await Promise.all([changeCvConsent(token,'withdraw'),changeCvConsent(token,'withdraw')]);
      await changeCvConsent(token,'consent'); // replay cannot restore a withdrawn consent
      assert.ok((await cvInvite(token)).withdrawn_at);assert.equal((await list()).some(c=>c.entry===base),false);
      for(const table of ['company_candidate_refs','company_candidate_states','company_saved_candidates','company_cv_base_views']) assert.equal((await db().query(`SELECT 1 FROM ${table} WHERE entry=$1`,[base])).rowCount,0);
      await assert.rejects(candidateCv(other,base),/ვერ მოიძებნა/);await assert.rejects(revealCandidate(other,base),/ვერ მოიძებნა/);
      assert.ok(await candidateCv(owner,entry));
    });
    await t.test('deleting the original upload cascades the invite and cleans base references',async()=>{
      await db().query('INSERT INTO company_saved_candidates(company_key,entry) VALUES($1,$2)',[other.companyKey,base]);
      await db().query('DELETE FROM company_cv_uploads WHERE id=$1',[upload]);
      assert.equal(await cvInvite(token),null);
      assert.equal((await db().query('SELECT 1 FROM company_cv_invites WHERE upload_id=$1',[upload])).rowCount,0);
      assert.equal((await db().query('SELECT 1 FROM company_saved_candidates WHERE entry=$1',[base])).rowCount,0);
    });
  }finally{
    await db().query('DELETE FROM company_job_ownership WHERE job_id=$1',[job]);
    await db().query('DELETE FROM jobs WHERE id=$1',[job]);
    await db().query('DELETE FROM company_accounts WHERE id=$1',[other.id]);
    await db().query('DELETE FROM company_profiles WHERE company_key=ANY($1::text[])',[[key,other.companyKey]]);
    await db().end();
  }
});
