/** P5.7 Native HTTP + source-level browser-runner checks.
 * Not a substitute for actual Playwright Chromium execution.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const runner=fileURLToPath(new URL('../scripts/p57-browser-e2e.mjs',import.meta.url));
async function hosted(t){
  const server=createDashboardServer({packageRoot:fixture});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=await listenDashboard(server,0);
  const launch=dashboardLaunchUrl(server);
  const token=new URL(launch).hash.slice('#session='.length);
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  return {origin,token,launch};
}
test('P5.7 browser E2E runner parses using exact current Node without installing anything',()=>{
  const p=spawnSync(process.execPath,['--check',runner],{encoding:'utf8',timeout:10000});
  assert.equal(p.status,0,p.stderr);
  const source=fs.readFileSync(runner,'utf8');
  assert.match(source,/await import\('playwright'\)/);
  assert.match(source,/chromium\.launch\(\{headless:true\}\)/);
  assert.match(source,/real_browser_executed:false/);
  assert.match(source,/BROWSER_UNAVAILABLE/);
  assert.match(source,/BROWSER_PREREQUISITE_MISSING/);
  assert.match(source,/await browser\.close\(\)/);
  assert.doesNotMatch(source,/npm install|execSync|spawnSync|child_process|curl|http:\/\/(?!127\.0\.0\.1)/);
});
test('P5.7 actual HTTP routes serve local HTML and module assets with restrictive CSP',async t=>{
  const {origin,token}=await hosted(t);
  for(const target of ['/','/app.css','/app.js','/provenance.js']){
    const response=await fetch(origin+target);
    assert.equal(response.status,200,target);
    assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
    assert.equal(response.headers.get('cache-control'),'no-store');
    const text=await response.text();
    assert.ok(text.length>10,target);
    assert.ok(!text.includes(token),target);
  }
});
test('P5.7 real HTTP session fragment is never sent in the URL or returned in static HTML',async t=>{
  const {origin,launch,token}=await hosted(t);
  assert.equal(new URL(launch).origin,origin);
  assert.equal(new URL(launch).pathname,'/');
  assert.equal(new URL(launch).search,'');
  assert.ok(new URL(launch).hash.startsWith('#session='));
  const noAuth=await fetch(origin+'/api/overview');
  assert.equal(noAuth.status,401);
  const ok=await fetch(origin+'/api/overview',{headers:{Authorization:'Bearer '+token}});
  assert.equal(ok.status,200);
  const overview=await ok.json();
  assert.equal(overview.dataset.revenue_krw,'157000');
  assert.equal(overview.dataset.orders,6);
  assert.equal(overview.dataset.units,'10');
  assert.equal(overview.dataset.source_rows.length,6);
  assert.equal(overview.documents.length,2);
});
test('P5.7 local query/search routes return authenticated, grounded evidence',async t=>{
  const {origin,token}=await hosted(t);
  const options=question=>({method:'POST',headers:{Authorization:'Bearer '+token,
    'Content-Type':'application/json'},body:JSON.stringify({question})});
  const q=await fetch(origin+'/api/query',options('총 매출과 반품 기간, 배송 준비 기간은?'));
  assert.equal(q.status,200);
  const mix=await q.json();
  assert.equal(mix.status,'ANSWERED');
  assert.equal(mix.metric_evidence.revenue_krw,'157000');
  assert.ok(mix.document_evidence.length>=2);
  const s=await fetch(origin+'/api/search',options('반품 신청 기간을 알려줘'));
  assert.equal(s.status,200);
  const sr=await s.json();
  assert.equal(sr.status,'FOUND');
  assert.ok(sr.evidence.length>0);
  const unsupported=await fetch(origin+'/api/query',options('현재 재고와 고객별 매출은?'));
  assert.equal(unsupported.status,200);
  const u=await unsupported.json();
  assert.equal(u.status,'NOT_SUPPORTED');
  assert.equal(u.answer,null);
});
test('P5.7 no forged or missing session reads any overview payload',async t=>{
  const {origin}=await hosted(t);
  for(const headers of [{},{Authorization:'Bearer '+'A'.repeat(43)}]){
    const r=await fetch(origin+'/api/overview',{headers});
    assert.equal(r.status,401);
    const payload=await r.text();
    assert.ok(!payload.includes('157000'));
    assert.ok(!payload.includes('O-1001'));
  }
});
