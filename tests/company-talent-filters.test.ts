import assert from 'node:assert/strict';
import test from 'node:test';
import type { Candidate, CandidateProfile } from '../lib/company-candidates';
import { parseState, parseNotice, emptyFilters, passes, terms, matchScore, countFacets, normalizeFilters, accountStorageKeys, readSavedSearches, saveSearch, deleteSearch, filterChips, type Filters, type Person } from '../lib/company-talent-filters';

const profile: CandidateProfile = {
  origin: 'parsed', years: 5, roles: ['Engineer — Example'], skills: ['React', 'SQL'],
  languages: [{name:'English',level:'b2'}], education:['University'], educationLevel:'master', city:'თბილისი', text:'Engineer React SQL research',
};
const entry: Candidate = {
  entry:'entry-1', source:'upload', jobId:'job-1', jobTitle:'Engineer', name:'Example', email:'example@example.test',
  phone:'+995555000000', title:'Engineer', city:'თბილისი', appliedAt:'2026-11-15T12:00:00Z', interviewAt:null,
  interviewNote:'', stage:'shortlist', rating:4, seen:true, notes:0, hasCv:true, photo:false, profile, requirementsMatch:true,
};
function person(patch: Partial<Person> = {}): Person {
  return {key:'one',latest:entry, entries:[entry],stage:'shortlist',rating:4,profile,city:'თბილისი',haystack:'engineer react sql research',...patch};
}
function accepts(patch: Partial<Filters>, p=person(), since=0) {
  const f={...emptyFilters,...patch};
  return passes(p,f,terms(f.query),since);
}

test('each filter accepts matching data and rejects a mismatch',()=>{
  const cases: [Partial<Filters>, Partial<Filters>][] = [
    [{positions:['engineer']},{positions:['designer']}],
    [{skills:['react','sql']},{skills:['react','python']}],
    [{skills:['python','sql'],skillMode:'any'},{skills:['python','go'],skillMode:'any'}],
    [{years:['5']},{years:['3']}],
    [{languages:[{key:'english',min:'b2'}]},{languages:[{key:'english',min:'c1'}]}],
    [{languages:[{key:'english',min:''}]},{languages:[{key:'german',min:''}]}],
    [{education:'bachelor'},{education:'phd'}],
    [{cities:['თბილისი']},{cities:['ბათუმი']}],
    [{jobs:['job-1']},{jobs:['job-2']}],
    [{stages:['shortlist']},{stages:['new']}],
    [{source:'upload'},{source:'applied'}],
    [{query:'react research'},{query:'react missing'}],
  ];
  for(const [positive,negative] of cases) {
    assert.equal(accepts(positive),true,JSON.stringify(positive));
    assert.equal(accepts(negative),false,JSON.stringify(negative));
  }
  assert.equal(accepts({rated:true}),true);
  assert.equal(accepts({rated:true},person({rating:null})),false);
  assert.equal(accepts({phone:true}),true);
  assert.equal(accepts({phone:true},person({entries:[{...entry,phone:''}]})),false);
  assert.equal(accepts({requirementsMatch:true}),true);
  assert.equal(accepts({requirementsMatch:true},person({entries:[{...entry,requirementsMatch:null}]})),false);
  assert.equal(accepts({hideRejected:true}),true);
  assert.equal(accepts({hideRejected:true},person({stage:'rejected'})),false);
  assert.equal(accepts({unchecked:true}),true);
  assert.equal(accepts({unchecked:true},person({profile:null})),true);
  assert.equal(accepts({unchecked:true},person({profile:{...profile,origin:'edited'}})),false);
  assert.equal(accepts({unchecked:true},person({profile:{...profile,origin:'jobx'}})),false);
});

test('all sources, no-vacancy uploads and conditions on any entry',()=>{
  for(const source of ['swipe','resume','cv_box','upload'] as const) {
    const p=person({entries:[{...entry,source,jobId:null}]});
    assert.equal(accepts({source:source==='swipe'||source==='resume'?'applied':source},p),true);
    assert.equal(accepts({jobs:['none']},p),true);
  }
  const p=person({entries:[{...entry,phone:'',jobId:null,requirementsMatch:false},{...entry,source:'cv_box'}]});
  assert.equal(accepts({jobs:['job-1'],phone:true,requirementsMatch:true,source:'cv_box'},p),true);
});

test('experience boundaries, unknown values, language AND and unknown level',()=>{
  for(const [years,band] of [[0,'0'],[1,'1'],[3,'3'],[5,'5'],[10,'10']] as const)
    assert.equal(accepts({years:[band]},person({profile:{...profile,years}})),true);
  assert.equal(accepts({years:['5']},person({profile:null})),false);
  assert.equal(accepts({years:['invalid']}),false);
  assert.equal(accepts({education:'bachelor'},person({profile:null})),false);
  assert.equal(accepts({skills:['react']},person({profile:null})),false);
  assert.equal(accepts({languages:[{key:'english',min:''},{key:'german',min:''}]}),false);
  assert.equal(accepts({languages:[{key:'english',min:'a2'}]},person({profile:{...profile,languages:[{name:'English',level:null}]}})),false);
});

test('period keeps its inclusive boundary and search ranking requires every term',()=>{
  const now=Date.parse('2026-11-16T12:00:00Z');
  for(const period of [7,30,90]) {
    const since=now-period*86400000;
    const at=(time:number)=>person({latest:{...entry,appliedAt:new Date(time).toISOString()}});
    assert.equal(accepts({period},at(since),since),true);
    assert.equal(accepts({period},at(since-1),since),false);
  }
  assert.ok(matchScore(person(),['react'])>matchScore(person(),['research']));
  assert.equal(matchScore(person(),['react','missing']),0);
});

test('position options normalize titles, strip company names and count each person once',()=>{
  const p=person({profile:{...profile,roles:[' Engineer — Company','ENGINEER — Other']},entries:[{...entry,title:'  Engineer  '},entry]});
  const facets=countFacets([p],emptyFilters,[]);
  assert.deepEqual(facets.positions,[{key:'engineer',label:'Engineer',n:1}]);
  assert.equal(accepts({positions:['engineer']},p),true);
  assert.equal(accepts({positions:['company']},p),false);
});

test('AND skills and languages count the intersection; OR skills ignore their own selection',()=>{
  const second=person({key:'two',profile:{...profile,skills:['React'],languages:[{name:'English',level:'a2'}]}});
  const rows=[person(),second];
  for(const skillMode of ['all','any'] as const) {
    const f={...emptyFilters,skills:['react'],skillMode};
    const option=countFacets(rows,f,[]).skills.find(o=>o.key==='sql')!;
    assert.equal(option.n,rows.filter(p=>accepts({...f,skills:skillMode === 'all' ? ['react','sql'] : ['sql']},p)).length);
  }
  const f={...emptyFilters,languages:[{key:'english',min:'b2'}]};
  assert.equal(countFacets(rows,f,[]).languages.find(l=>l.key==='english')?.n,1);
  assert.equal(countFacets(rows,f,[]).skills.find(s=>s.key==='react')?.n,1);
});

test('zero options disappear but selected zero options remain removable',()=>{
  const f={...emptyFilters,cities:['ბათუმი'],positions:['designer'],skills:['python'],languages:[{key:'german',min:'b2'}],years:['0'],education:'phd' as const,stages:['new' as const],jobs:['missing']};
  const facets=countFacets([person()],f,[]);
  assert.deepEqual(facets.cities,[{key:'ბათუმი',label:'ბათუმი',n:0}]);
  assert.deepEqual(facets.positions,[{key:'designer',label:'designer',n:0}]);
  assert.equal(facets.skills[0].n,0);
  assert.equal(facets.languages[0].n,0);
  assert.equal(facets.years[0].key,'0');
  assert.equal(facets.education[0].key,'phd');
  assert.equal(facets.stages[0].key,'new');
  assert.equal(facets.jobs[0].key,'missing');
  let changed: unknown;
  const chips=filterChips(f,facets,(key,value)=>{changed={key,value};});
  chips.find(c=>c.key==='position:designer')!.clear();
  assert.deepEqual(changed,{key:'positions',value:[]});
});

test('migrates v2 filters and discards malformed persisted values',()=>{
  assert.deepEqual(normalizeFilters({query:'React',skills:['React'],skillMode:'any'}),{...emptyFilters,query:'React',skills:['react'],skillMode:'any'});
  assert.deepEqual(normalizeFilters(null),emptyFilters);
  const clean=normalizeFilters({years:['invalid'],languages:[null,{}, {key:'English',min:'invalid'}],stages:['bad'],source:'bad',sort:'bad',period:-5,phone:'false',positions:[' Engineer ','ENGINEER']});
  assert.deepEqual(clean.positions,['engineer']);
  assert.deepEqual(clean.languages,[{key:'english',min:''}]);
  assert.deepEqual(clean.years,[]);
  assert.equal(clean.period,0);
  assert.equal(clean.phone,false);
});

test('saved searches round-trip, isolate accounts, delete and enforce max ten',()=>{
  assert.notEqual(accountStorageKeys('one').searches,accountStorageKeys('two').searches);
  assert.notEqual(accountStorageKeys('one').filters,accountStorageKeys('two').filters);
  const f={...emptyFilters,query:'react',cities:['თბილისი'],languages:[{key:'english',min:'b2'}]};
  const saved=saveSearch([],' Engineers ',f,'id-1');
  assert.equal(saved[0].name,'Engineers');
  assert.deepEqual(readSavedSearches(JSON.stringify(saved))[0].filters,f);
  assert.deepEqual(deleteSearch(saved,'id-1'),[]);
  assert.deepEqual(readSavedSearches('{broken'),[]);
  assert.deepEqual(readSavedSearches('[null,{},7]'),[]);
  assert.throws(()=>saveSearch([],'  ',f,'id'));
  let list=saved;
  for(let i=2;i<=10;i++) list=saveSearch(list,`Search ${i}`,f,`id-${i}`);
  assert.throws(()=>saveSearch(list,'Eleventh',f,'id-11'));
  assert.equal(saveSearch(deleteSearch(list,'id-1'),'Replacement',f,'id-11').length,10);
  f.cities.push('ბათუმი');
  assert.deepEqual(saved[0].filters.cities,['თბილისი']);
});

test('city, vacancy, stage, education, experience and position facet counts follow active filters',()=>{
  const other=person({key:'two',city:'ბათუმი',stage:'new',entries:[{...entry,jobId:null}],profile:{...profile,years:2,educationLevel:'bachelor',roles:['Designer — Other']}});
  const rows=[person(),other];
  const f={...emptyFilters,query:'react'};
  const facets=countFacets(rows,f,[{id:'job-1',title:'Engineer'}]);
  for(const key of ['positions','cities','years','jobs','stages'] as const) {
    for(const option of facets[key]) {
      const patch = {[key]:[option.key]} as Partial<Filters>;
      assert.equal(option.n,rows.filter(p=>accepts({...f,...patch},p)).length,`${key}:${option.key}`);
    }
  }
  for(const option of facets.education)
    assert.equal(option.n,rows.filter(p=>accepts({...f,education:option.key},p)).length);
  assert.equal(facets.unchecked,2);
  assert.equal(countFacets([person({profile:{...profile,skills:['React','REACT']}})],emptyFilters,[]).skills[0].n,1);
});

test('parse notices preserve extraction reasons and respect manual review', () => {
  for (const reason of ['scanned', 'unsupported', 'empty', 'timeout', 'too_large', 'low_confidence', 'approximate_dates']) {
    const parsed: CandidateProfile = {...profile, parse: {confidence: 0, reason}};
    assert.ok(parseNotice(parsed), reason);
    assert.equal(parseNotice({...parsed, origin: 'edited'}), '');
    assert.equal(parseNotice({...parsed, origin: 'jobx'}), '');
  }
  assert.equal(parseNotice({...profile, parse: {confidence: .5, reason: null}}), 'გადასამოწმებელია');
  assert.equal(parseNotice({...profile, parse: {confidence: 1, reason: null}}), '');
  assert.equal(parseNotice(null), '');
  assert.equal(parseNotice(profile), '');
});

test('OR groups ignore their selection but retain every other group filter', () => {
  const other = person({key:'two', city:'ბათუმი', stage:'new', entries:[{...entry,title:'Designer',jobId:null}],
    profile:{...profile,roles:['Designer'],years:2,skills:['SQL']}});
  const rows = [person(), other, person({key:'three',city:'ქუთაისი'})];
  const jobs = [{id:'job-1',title:'Engineer'}];
  for (const [key, selected] of [['positions','engineer'],['cities','თბილისი'],['years','5'],['jobs','job-1'],['stages','shortlist'],['skills','react']] as const) {
    const base = {...emptyFilters, skillMode:'any' as const, query:'research'};
    const before = countFacets(rows,base,jobs)[key];
    const after = countFacets(rows,{...base,[key]:[selected]},jobs)[key];
    for (const option of before) assert.equal(after.find(o=>o.key===option.key)?.n, option.n, `${key}:${option.key}`);
    assert.equal(after[0].key,selected,`${key}: selected first`);
    const narrowed = {...base,[key]:[selected],phone:true};
    for (const option of countFacets(rows,narrowed,jobs)[key]) {
      assert.equal(option.n, rows.filter(p=>accepts({...narrowed,[key]:[option.key]},p)).length);
    }
  }
});

test('every facet sorts selected first, then count descending, then Georgian label', () => {
  const rows = [person(), person({key:'two'}), person({key:'three',city:'ბათუმი',stage:'new',entries:[{...entry,title:'Designer',jobId:null}],profile:{...profile,roles:['Designer'],skills:['Go'],years:2,languages:[{name:'German',level:'b2'}],educationLevel:'bachelor'}})];
  const scenarios: Partial<Filters>[] = [{positions:['designer']},{cities:['ბათუმი']},{years:['1']},{jobs:['none']},{stages:['new']},{skills:['go'],skillMode:'any'},{languages:[{key:'german',min:'b2'}]},{education:'master'}];
  for (const patch of scenarios) {
    const f = {...emptyFilters,...patch};
    const facets = countFacets(rows,f,[{id:'job-1',title:'Engineer'}]);
    const key = Object.keys(patch)[0] as Exclude<keyof typeof facets,'unchecked'>;
    const selected = key==='languages' ? 'german' : key==='education' ? 'master' : (patch[key] as string[])[0];
    assert.equal(facets[key][0].key,selected,key);
  }
  const tied = countFacets([person({city:'თბილისი'}),person({city:'ბათუმი'})],emptyFilters,[]).cities;
  assert.deepEqual(tied.map(o=>o.label), ['თბილისი','ბათუმი'].sort((a,b)=>a.localeCompare(b,'ka')));
});

test('parse-state requires a CV for failed extraction and uses usable profiles', () => {
  const empty: CandidateProfile = {...profile,text:'',roles:[],skills:[],languages:[],education:[],educationLevel:null,years:null,city:'',parse:{confidence:0,reason:'scanned'}};
  assert.equal(parseState(null,false),'');
  assert.equal(parseState(empty,false),'');
  assert.equal(parseState(null,true),'ტექსტი ვერ ამოიკითხა');
  assert.equal(parseState(empty,true),'ტექსტი ვერ ამოიკითხა');
  assert.match(parseNotice(empty), /სკანირებული/);
  assert.equal(parseState(profile,true),'ავტომატურად ამოკითხული');
  assert.equal(parseState(profile,false),'');
  assert.equal(parseState({...empty,origin:'edited'},true),'შემოწმებული');
  assert.equal(parseState({...empty,origin:'jobx'},false),'');
});

test('AND language additions retain the current minimum level', () => {
  const rows = [person({profile:{...profile,languages:[{name:'English',level:'b2'},{name:'German',level:'b1'}]}}),person({key:'two',profile:{...profile,languages:[{name:'English',level:'a2'},{name:'German',level:'c1'}]}})];
  const f = {...emptyFilters,languages:[{key:'english',min:'b2'}]};
  assert.equal(countFacets(rows,f,[]).languages.find(l=>l.key==='german')?.n,1);
});
