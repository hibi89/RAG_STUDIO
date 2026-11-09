import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {buildRagPrepMappingPlan} from '../src/prep-mapping-plan.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function local(t,content){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rag-prep-546-'));
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const file=path.join(folder,'confidential-source.csv');
 fs.writeFileSync(file,content);
 return file;
}
test('P5.46 actual public RAG CSV inspector feeds the PREP planner',()=>{
 const bytes=Buffer.from('주문번호,quantity,amount_krw\nA-001,2,12.50\n','utf8');
 const r=buildRagPrepMappingPlan(inspectCsvBytes(bytes));
 assert.deepEqual(r.proposed_columns.map(c=>c.inferred_type),['text','integer','decimal']);
 assert.equal(r.source_sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
 assert.equal(r.approval,'NOT_GRANTED');
});
test('P5.46 local CLI uses real byte-verified reader; does not touch original',t=>{
 const p=local(t,'id,amount_krw\nA-1,12.50\n');
 const before=fs.readFileSync(p);
 const x=spawnSync(process.execPath,['src/prep-mapping-cli.mjs',p],
   {cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(x.status,0,x.stderr);
 const result=JSON.parse(x.stdout);
 assert.equal(result.status,'REVIEW_HOLD');
 assert.equal(result.proposed_columns.length,2);
 assert.equal(result.ax_package_created,false);
 assert.equal(result.sqlite_imported,false);
 assert.equal(result.remote_upload,false);
 assert.doesNotMatch(x.stdout+x.stderr,/A-1|12\.50|confidential-source|rag-prep-546-/);
 assert.deepEqual(fs.readFileSync(p),before);
});
test('P5.46 unsafe user file is rejected without raw paths or values',t=>{
 const p=local(t,'id,description\nA-1,"bad quote\n');
 const x=spawnSync(process.execPath,['src/prep-mapping-cli.mjs',p],
   {cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(x.status,1);
 assert.deepEqual(JSON.parse(x.stdout),{status:'PREP_PLAN_BLOCKED',ax_package_created:false});
 assert.doesNotMatch(x.stdout+x.stderr,/confidential-source|rag-prep-546-|bad quote/);
});
