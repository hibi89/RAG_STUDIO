/**
 * P5.7 OPTIONAL real Chromium E2E against the checked-in PUBLIC synthetic package.
 * Never uses customer data, external URLs, cloud APIs, a preexisting browser profile,
 * or private SMAX sources. No screenshots, session URL or raw evidence in the report.
 *
 * Prerequisite: locally installed Playwright + its Chromium binary and OS libraries.
 * The product itself does not install, bundle, download or require Playwright.
 */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

const source=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const report={contract:'rag.p57.browser-e2e.v1',real_browser_executed:false,
  synthetic_only:true,customer_data_tested:false,windows_verified:false,
  status:'NOT_RUN',checks:[],passed:0,failed:0};
let browser,server;
const check=async(id,callback)=>{
  try {await callback();report.checks.push({id,status:'PASS'});report.passed++;}
  catch {report.checks.push({id,status:'FAIL'});report.failed++;throw new Error(id);}
};
try {
  let chromium;
  try {({chromium}=await import('playwright'));}
  catch {report.status='BROWSER_PREREQUISITE_MISSING';process.exitCode=2;}
  if(chromium){
    try {browser=await chromium.launch({headless:true});}
    catch {report.status='BROWSER_UNAVAILABLE';process.exitCode=2;}
  }
  if(browser){
    report.real_browser_executed=true;
    server=createDashboardServer({packageRoot:source});
    const origin=await listenDashboard(server,0);
    const url=dashboardLaunchUrl(server);
    const consoleErrors=[],externalRequests=[];
    const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
    context.on('page',p=>p.on('pageerror',()=>consoleErrors.push('PAGE_ERROR')));
    await context.route('**/*',async route=>{
      let requested;
      try{requested=new URL(route.request().url());}catch{externalRequests.push('NON_HTTP_URL');await route.abort();return;}
      if(requested.origin!==origin){externalRequests.push('EXTERNAL');await route.abort();return;}
      await route.continue();
    });
    const blank=await context.newPage();
    await check('anonymous-page-has-no-data',async()=>{
      await blank.goto(origin+'/',{waitUntil:'domcontentloaded'});
      await assert.rejects(async()=>{await blank.locator('#revenue').getByText('157,000원').waitFor({timeout:1200});});
      await blank.locator('#health').getByText('세션 연결 필요').waitFor();
      assert.equal((await blank.locator('#sourceRows tr').count()),1);
    });
    const main=await context.newPage();
    await check('real-session-renders-correct-kpis',async()=>{
      await main.goto(url,{waitUntil:'domcontentloaded'});
      await main.locator('#health').getByText('검증된 로컬 데이터').waitFor();
      assert.equal(new URL(main.url()).hash,'');
      assert.match(await main.locator('#revenue').innerText(),/157,000/);
      assert.match(await main.locator('#orders').innerText(),/6/);
      assert.match(await main.locator('#units').innerText(),/10/);
      assert.match(await main.locator('#approvedDocs').innerText(),/2/);
      assert.equal(await main.locator('#documentCards .doc').count(),2);
      assert.equal(await main.locator('#sourceRows tr').count(),6);
      assert.ok((await main.locator('#skuChart progress.sku-bar').count())>0);
    });
    await check('question-and-grounded-citation-navigation',async()=>{
      await main.locator('#askButton').click();
      await main.locator('#answerPane .answer-status').getByText(/ANSWERED/).waitFor();
      assert.match(await main.locator('#answerPane').innerText(),/157,000/);
      const csv=main.locator('#answerPane button.citation-link').filter({hasText:'CSV 원본 행 찾기'}).first();
      await csv.click();
      assert.equal(await main.locator('#sourceRows tr.source-active').count(),1);
      assert.match(await main.locator('#citationDetail').innerText(),/CSV/);
      const doc=main.locator('#answerPane button.citation-link').filter({hasText:'문서 출처 찾기'}).first();
      await doc.click();
      assert.equal(await main.locator('#documentCards .doc.source-active').count(),1);
      assert.match(await main.locator('#citationDetail').innerText(),/문서/);
    });
    await check('unsupported-question-displays-abstention',async()=>{
      await main.locator('#question').fill('현재 재고와 고객별 매출은?');
      await main.locator('#askButton').click();
      await main.locator('#answerPane .answer-status').getByText(/NOT_SUPPORTED/).waitFor();
      assert.equal(await main.locator('#answerPane button.citation-link').count(),0);
    });
    await check('document-only-search-cites-a-source',async()=>{
      await main.locator('#question').fill('반품 신청 기간을 알려줘');
      await main.locator('#searchButton').click();
      await main.locator('#answerPane .answer-status').getByText(/FOUND/).waitFor();
      assert.ok(await main.locator('#answerPane button.citation-link').count()>0);
    });
    await check('invalid-capability-never-loads-overview',async()=>{
      const bad=await context.newPage();
      await bad.goto(origin+'/#session='+'A'.repeat(43),{waitUntil:'domcontentloaded'});
      await bad.locator('#health').getByText('데이터 검증 실패').waitFor();
      assert.equal(await bad.locator('#sourceRows tr').count(),1);
      await bad.close();
    });
    await check('mobile-layout-and-no-external-assets',async()=>{
      await main.setViewportSize({width:390,height:844});
      await main.locator('#health').getByText('검증된 로컬 데이터').waitFor();
      const dims=await main.evaluate(()=>({
        root:document.documentElement.scrollWidth,
        viewport:window.innerWidth,
        mainVisible:!!document.querySelector('main')?.getBoundingClientRect().width
      }));
      assert.equal(dims.mainVisible,true);
      assert.ok(dims.root<=dims.viewport+2);
      assert.equal(externalRequests.length,0);
      assert.equal(consoleErrors.length,0);
    });
    await context.close();
    report.status=report.failed===0?'PASS':'FAIL';
    if(report.failed)process.exitCode=1;
  }
} catch {
  if(report.status==='NOT_RUN')report.status='FAIL';
  if(report.failed===0){report.failed=1;report.checks.push({id:'UNEXPECTED_BROWSER_FAILURE',status:'FAIL'});}
  process.exitCode=1;
} finally {
  if(browser)await browser.close().catch(()=>{});
  if(server?.listening)await new Promise(resolve=>server.close(resolve));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
