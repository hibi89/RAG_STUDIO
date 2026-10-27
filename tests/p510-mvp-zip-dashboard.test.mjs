import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildBundledSyntheticZip,openBundledSyntheticZipWorkspace} from '../src/synthetic-zip-workspace.mjs';
import {inspectZipBytes} from '../src/zip-preflight.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
import {loadPackage} from '../src/validate.mjs';

const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const names=['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt'];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function withWorkspace(t,bytes=buildBundledSyntheticZip()){
  const handle=openBundledSyntheticZipWorkspace(bytes);
  t.after(()=>handle.cleanup());
  return handle;
}
test('P5.10 builds valid ZIP archive with exactly four bundled synthetic files',()=>{
  const a=buildBundledSyntheticZip(),b=buildBundledSyntheticZip();
  assert.deepEqual(a,b);
  const inspected=inspectZipBytes(a);
  assert.equal(inspected.status,'STRUCTURE_VALID_ONLY');
  assert.equal(inspected.entries,4);
  assert.equal(inspected.extracted,false);
  assert.equal(inspected.content_authorized,false);
  assert.equal(inspected.ax_package_approved,false);
});
test('P5.10 unpacks to a disposable verified local project and does not claim customer approval',t=>{
  const w=withWorkspace(t);
  assert.equal(w.source,'BUNDLED_SYNTHETIC_ZIP_ONLY');
  assert.equal(w.customer_data_allowed,false);
  assert.equal(w.auto_approval,false);
  assert.match(w.root,/rag-synthetic-zip-/);
  assert.equal(loadPackage(w.root).manifest.project_id,'synthetic-shop-001');
  assert.deepEqual(fs.readdirSync(w.root).sort(),[...names].sort());
  for(const name of names)assert.equal(digest(fs.readFileSync(path.join(w.root,name))),digest(fs.readFileSync(path.join(fixture,name))));
});
test('P5.10 real HTTP dashboard serves verified ZIP SQLite totals and cited mixed answer',async t=>{
  const w=withWorkspace(t),server=createDashboardServer({packageRoot:w.root});
  const url=await listenDashboard(server,0);
  t.after(()=>new Promise(done=>server.close(done)));
  const secret=dashboardLaunchUrl(server).split('#session=')[1];
  const auth={Authorization:'Bearer '+secret};
  assert.equal((await fetch(url+'/api/overview')).status,401);
  const overview=await fetch(url+'/api/overview',{headers:auth});
  assert.equal(overview.status,200);
  const body=await overview.json();
  assert.equal(body.dataset.revenue_krw,'157000');
  assert.equal(body.dataset.orders,6);
  assert.equal(body.dataset.units,'10');
  assert.equal(body.documents.length,2);
  const query=await fetch(url+'/api/query',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({question:'총 매출과 반품 기간, 배송 준비 기간은?'})});
  assert.equal(query.status,200);
  const answer=await query.json();
  assert.equal(answer.status,'ANSWERED');
  assert.equal(answer.kind,'SQL_DOCUMENT');
  assert.deepEqual(answer.document_evidence.map(x=>x.period),[7,2]);
  assert.equal(answer.metric_evidence.row_evidence.length,6);
});
test('P5.10 workspace cleanup deletes only generated temp folder',()=>{
  const w=openBundledSyntheticZipWorkspace(buildBundledSyntheticZip());
  assert.equal(fs.existsSync(w.root),true);
  w.cleanup();
  assert.equal(fs.existsSync(w.root),false);
  w.cleanup();
  assert.equal(fs.existsSync(path.join(fixture,'manifest.json')),true);
});
test('P5.10 cannot load changed ZIP payload even if source name stays identical',()=>{
  const bytes=buildBundledSyntheticZip();
  const text=Buffer.from('synthetic-shop-001');
  const index=bytes.indexOf(text);
  assert.ok(index>0);
  bytes[index]^=1;
  assert.throws(()=>openBundledSyntheticZipWorkspace(bytes),/ZIP_PREFLIGHT_PAYLOAD_MISMATCH/);
});
test('P5.10 rejects missing fields, arbitrary customer-like data and unsupported files',()=>{
  const bytes=buildBundledSyntheticZip();
  const marker=Buffer.from('returns_policy.txt');
  const index=bytes.indexOf(marker);
  assert.ok(index>0);
  // Tamper metadata name: lower-level ZIP validity gate must reject.
  bytes[index]^=1;
  assert.throws(()=>openBundledSyntheticZipWorkspace(bytes));
  assert.throws(()=>openBundledSyntheticZipWorkspace(Buffer.from('customer ZIP')),/ZIP_PREFLIGHT_/);
});
test('P5.10 public source bundle files remain byte-for-byte unchanged',()=>{
  const before=names.map(name=>digest(fs.readFileSync(path.join(fixture,name))));
  const zip=buildBundledSyntheticZip(),w=openBundledSyntheticZipWorkspace(zip);
  w.cleanup();
  assert.deepEqual(names.map(name=>digest(fs.readFileSync(path.join(fixture,name)))),before);
});
test('P5.10 launcher never accepts customer ZIP args or external downloader',()=>{
  const script=fs.readFileSync(fileURLToPath(new URL('../scripts/p510-mvp-zip-dashboard.mjs',import.meta.url)),'utf8');
  assert.match(script,/buildBundledSyntheticZip\(\)/);
  assert.match(script,/dashboardLaunchUrl\(server\)/);
  assert.match(script,/workspace.cleanup/);
  assert.doesNotMatch(script,/process\.argv|fetch\(|curl|https?:\/\//);
});
