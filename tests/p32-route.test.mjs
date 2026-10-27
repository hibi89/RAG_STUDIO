import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createDashboardServer, listenDashboard, dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/', import.meta.url));

test('P3.2 actual loopback dashboard serves citation module without leaking session capability', async t => {
  const server=createDashboardServer({packageRoot:root});
  const origin=await listenDashboard(server,0);
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const secret=dashboardLaunchUrl(server).split('#session=')[1];
  const [html,app,provenance,anonymous,authorized]=await Promise.all([
    fetch(origin+'/'),
    fetch(origin+'/app.js'),
    fetch(origin+'/provenance.js'),
    fetch(origin+'/api/overview'),
    fetch(origin+'/api/overview',{headers:{Authorization:'Bearer '+secret}})
  ]);
  assert.equal(html.status,200);
  assert.equal(app.status,200);
  assert.equal(provenance.status,200);
  assert.equal(anonymous.status,401);
  assert.equal(authorized.status,200);
  assert.match(provenance.headers.get('content-type'),/javascript/);
  assert.match(app.headers.get('content-security-policy'),/script-src 'self'/);
  assert.equal(provenance.headers.get('cache-control'),'no-store');
  const [markup,script,moduleText]=await Promise.all([html.text(),app.text(),provenance.text()]);
  assert.match(markup,/id="citationDetail"/);
  assert.match(script,/from '\.\/provenance\.js'/);
  assert.match(moduleText,/resolveCitation/);
  assert.ok(!markup.includes(secret)&&!script.includes(secret)&&!moduleText.includes(secret));
  assert.equal((await authorized.json()).dataset.revenue_krw,'157000');
});
test('P3.2 unknown source paths remain inaccessible on the live local listener', async t => {
  const server=createDashboardServer({packageRoot:root});
  const origin=await listenDashboard(server,0);
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const secret=dashboardLaunchUrl(server).split('#session=')[1];
  for(const forbidden of ['/src/validate.mjs','/fixtures/ax_multi_doc_v0/manifest.json','/package.json']){
    const res=await fetch(origin+forbidden,{headers:{Authorization:'Bearer '+secret}});
    assert.equal(res.status,404,forbidden);
  }
});
