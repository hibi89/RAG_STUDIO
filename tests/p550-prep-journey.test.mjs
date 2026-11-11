import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runSyntheticMappedRagJourney} from '../src/prep-synthetic-journey.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=()=>({
 v1:JSON.parse(fs.readFileSync(new URL('../fixtures/smax_p42/synthetic_v1.json',import.meta.url),'utf8')),
 csv:fs.readFileSync(new URL('../fixtures/ax_multi_doc_v0/sales.csv',import.meta.url)),
 policy:fs.readFileSync(new URL('../fixtures/ax_multi_doc_v0/returns_policy.txt',import.meta.url))
});

test('P5.50 exact pinned synthetic owner-draft -> V1 preview -> verified SQL+TXT citations',()=>{
 const r=runSyntheticMappedRagJourney();
 assert.equal(r.status,'SYNTHETIC_MAPPED_RAG_CITED_QUERY_PASS');
 assert.equal(r.contract,'RAG_PREP_MAPPED_SYNTHETIC_JOURNEY_V1');
 assert.deepEqual([r.orders,r.units,r.revenue_krw],[6,'10','157000']);
 assert.ok(r.document_citations>=1);
 assert.deepEqual([r.mapping_verified,r.source_digest_verified,r.row_lineage_verified,r.fixed_sql_and_txt_citations_verified],[true,true,true,true]);
 assert.deepEqual([r.synthetic_only,r.approval,r.customer_data_approved,r.smax_native_approved,r.real_customer_indexed,r.remote_upload],
  [true,'NOT_GRANTED',false,false,false,false]);
});
test('P5.50 synthetic path is stable and does not mutate pinned fixture files',()=>{
 const input=read(),before=structuredClone(input.v1),csv=Buffer.from(input.csv),policy=Buffer.from(input.policy);
 const one=runSyntheticMappedRagJourney(input),two=runSyntheticMappedRagJourney(input);
 assert.deepEqual(one,two);
 assert.deepEqual(input.v1,before);assert.deepEqual(input.csv,csv);assert.deepEqual(input.policy,policy);
 assert.equal(one.source_modified,false);assert.equal(one.ax_customer_package_created,false);
});
test('P5.50 refuses modified unpinned source CSV instead of generating customer AX',()=>{
 const input=read();input.csv=Buffer.from(input.csv);input.csv[55]^=1;
 assert.throws(()=>runSyntheticMappedRagJourney(input));
});
test('P5.50 refuses forged producer field, approval and changed policy bytes',()=>{
 for(const change of [x=>x.v1.fields[0].key='fake',x=>x.v1.approval='GRANTED',
  x=>x.policy=Buffer.from('Forged customer policy')]){
  const input=read();change(input);assert.throws(()=>runSyntheticMappedRagJourney(input));
 }
});
test('P5.50 exact user-independent CLI runs synthetic-only, prints evidence counts not row values',()=>{
 const out=spawnSync(process.execPath,['scripts/p550-prep-journey-cli.mjs'],
  {cwd:root,encoding:'utf8',timeout:20000});
 assert.equal(out.status,0,out.stderr);
 const r=JSON.parse(out.stdout);
 assert.equal(r.status,'SYNTHETIC_MAPPED_RAG_CITED_QUERY_PASS');
 assert.equal(r.revenue_krw,'157000');
 assert.doesNotMatch(out.stdout+out.stderr,/O-1001|N-01|source.csv|returns_policy.txt|PRIVATE_SMAX/);
});
test('P5.50 CLI rejects real-user arguments and does not accept customer paths',()=>{
 const out=spawnSync(process.execPath,['scripts/p550-prep-journey-cli.mjs','/private/customer.csv'],
  {cwd:root,encoding:'utf8',timeout:20000});
 assert.equal(out.status,1);
 assert.deepEqual(JSON.parse(out.stdout),{status:'SYNTHETIC_JOURNEY_BLOCKED',real_customer_indexed:false});
 assert.doesNotMatch(out.stdout+out.stderr,/private\/customer|O-1001/);
});
