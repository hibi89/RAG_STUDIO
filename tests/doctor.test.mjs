import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeMeetsMinimum,checkRuntime,summarizeVerifiedPackage,checkPackage,runDoctor} from '../src/doctor.mjs';

const valid={manifest:{schema_version:'AX_DATA_PACKAGE_V0',files:[
 {import_status:'ACCEPTED'},{import_status:'ACCEPTED'},{import_status:'NEEDS_REVIEW'},{import_status:'REJECTED'}
 ],datasets:[{}],documents:[{}],review_items:[{status:'OPEN'},{status:'RESOLVED'}]}};
const runtime={nodeVersion:'22.16.0',platform:'win32',arch:'x64',totalMemoryBytes:8*1073741824};
test('P3.2 runtime version lower than Node 22.16.0 is not supported',()=>{
 for(const value of ['21.99.99','22.15.9','22.16','garbage','','0.0.0'])assert.equal(nodeMeetsMinimum(value),false);
});
test('P3.2 runtime supports exact minimum and newer versions',()=>{
 for(const value of ['22.16.0','22.16.1','22.17.0','23.0.0','24.0.0'])assert.equal(nodeMeetsMinimum(value),true);
});
test('P3.2 runtime information avoids customer paths and secrets',()=>{
 const x=checkRuntime(runtime);assert.equal(x.status,'SUPPORTED_NODE');assert.equal(x.memory_gib,8);
 assert.equal(x.platform,'win32');assert.equal(x.minimum_node,'22.16.0');
 assert.doesNotMatch(JSON.stringify(x),/\\Users\\|\/home\/|secret|token/i);
});
test('P3.2 invalid memory cannot become fabricated RAM requirement',()=>{
 const x=checkRuntime({...runtime,totalMemoryBytes:-1});assert.equal(x.memory_gib,null);
 assert.match(x.notices.join(' '),/not evaluated/);
});
test('P3.2 validated package summary exposes only safe counts',()=>{
 const x=summarizeVerifiedPackage(valid);
 assert.deepEqual([x.files,x.accepted_files,x.needs_review_files,x.rejected_files,x.datasets,x.documents,x.unresolved_review_items],[4,2,1,1,1,1,1]);
 assert.equal(x.status,'CONTRACT_VALIDATED');
});
test('P3.2 package path is required',async()=>{
 assert.deepEqual(await checkPackage(''),{status:'PACKAGE_INVALID',code:'PATH_REQUIRED'});
});
test('P3.2 verifier error never leaks raw path, secrets or exception',async()=>{
 const x=await checkPackage('any',()=>{throw new Error('/Users/person/secret-token in file');});
 assert.deepEqual(x,{status:'PACKAGE_INVALID',code:'CONTRACT_OR_FILE_CHECK_FAILED'});
});
test('P3.2 injected verifier can return valid synthetic package',async()=>{
 const x=await checkPackage('synthetic',()=>valid);assert.equal(x.status,'CONTRACT_VALIDATED');
});
test('P3.2 old runtime fails closed before reading package',async()=>{
 let called=false;
 const x=await runDoctor('synthetic',{runtime:{...runtime,nodeVersion:'22.15.9'},verifier:()=>{called=true;return valid;}});
 assert.equal(x.status,'BLOCKED');assert.equal(x.package.status,'NOT_CHECKED');assert.equal(called,false);
});
test('P3.2 package validation failure blocks preflight',async()=>{
 const x=await runDoctor('synthetic',{runtime,verifier:()=>{throw new Error('PII');}});
 assert.equal(x.status,'BLOCKED');assert.equal(x.package.status,'PACKAGE_INVALID');
});
test('P3.2 valid synthetic package passes only scoped preflight',async()=>{
 const x=await runDoctor('synthetic',{runtime,verifier:()=>valid});assert.equal(x.status,'PREFLIGHT_OK');
 assert.match(x.package.notice,/not a dashboard/);
});
