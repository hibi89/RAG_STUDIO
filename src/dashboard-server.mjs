/** P3.1 local read-only dashboard. All data APIs require a per-run capability token.
 * The launcher puts the secret in a URL fragment (never sent in an HTTP request).
 * Static assets disclose no package data. Real/customer-data security not yet certified.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPackage} from './validate.mjs';
import {withReadOnlySales} from './mixed-question.mjs';
import {routeQuestion} from './evidence-router.mjs';
import {searchDocuments} from './document-search.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ASSETS={
  '/':{path:path.join(HERE,'../ui/index.html'),type:'text/html; charset=utf-8'},
  '/app.css':{path:path.join(HERE,'../ui/app.css'),type:'text/css; charset=utf-8'},
  '/app.js':{path:path.join(HERE,'../ui/app.js'),type:'text/javascript; charset=utf-8'}
};
const MAX_BODY=2048;
const sessions=new WeakMap();
const CSP="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const COMMON={
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':CSP,
  'Cross-Origin-Resource-Policy':'same-origin'
};
const respond=(res,status,payload,extra={})=>{
  const body=typeof payload==='string'?payload:JSON.stringify(payload);
  res.writeHead(status,{...COMMON,'Content-Type':typeof payload==='string'?'text/plain; charset=utf-8':'application/json; charset=utf-8',...extra});
  res.end(body);
};

function overview(root){
  return withReadOnlySales(root,({db,totals,expected,pkg})=>{
    // Fixed, bounded read-only query; exact integer verification against total.
    const skuTotals=db.prepare('SELECT sku, COUNT(*) AS orders, SUM(quantity) AS units, SUM(amount_krw) AS revenue_krw FROM sales GROUP BY sku ORDER BY revenue_krw DESC, sku ASC').all();
    if(skuTotals.length>100 || !skuTotals.length)throw new Error('unsupported SKU series length');
    for(const sku of skuTotals)for(const key of ['orders','units','revenue_krw']){
      if(!Number.isSafeInteger(sku[key]) || sku[key]<0)throw new Error('unsafe SKU aggregate');
    }
    if(skuTotals.reduce((a,r)=>a+BigInt(r.revenue_krw),0n)!==BigInt(totals.revenue_krw) ||
       skuTotals.reduce((a,r)=>a+BigInt(r.units),0n)!==BigInt(totals.units))throw new Error('SKU sum inconsistent');
    return {
      status:'VERIFIED_SYNTHETIC_PACKAGE',
      project_id:pkg.manifest.project_id,
      schema_version:pkg.manifest.schema_version,
      dataset:{file_id:expected.dataset_file_id,orders:totals.orders,units:String(totals.units),revenue_krw:String(totals.revenue_krw),source_rows:expected.row_evidence,
        sku_totals:skuTotals.map(x=>({sku:x.sku,orders:x.orders,units:String(x.units),revenue_krw:String(x.revenue_krw)}))},
      documents:pkg.manifest.documents.map(d=>({document_id:d.document_id,file_id:d.file_id,source_title:d.source_title,page_info:d.page_info,import_status:pkg.fileMap.get(d.file_id)?.import_status??'UNKNOWN'})),
      review:{items:pkg.manifest.review_items,summary:pkg.manifest.processing_summary},
      limitations:['합성 데이터 전용 데모','정형 매출 집계 + TXT 근거 검색만 지원','LLM / PDF / 실제 SMAX 연결 / 설치기는 미구현']
    };
  });
}
async function readJson(req){
  const ct=req.headers['content-type']??'';
  if(!/^application\/json(?:\s*;|\s*$)/i.test(ct)) throw Object.assign(new Error('Content-Type must be application/json'),{statusCode:415});
  let size=0; const chunks=[];
  for await (const chunk of req){
    size+=chunk.length;
    if(size>MAX_BODY) throw Object.assign(new Error('Request size exceeded'),{statusCode:413});
    chunks.push(chunk);
  }
  let obj;
  try{obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Object.assign(new Error('Invalid JSON'),{statusCode:400});}
  if(!obj||Array.isArray(obj)||typeof obj!=='object'||Object.keys(obj).length!==1||typeof obj.question!=='string'||!obj.question.trim()||obj.question.length>500)
    throw Object.assign(new Error('Provide question text (1–500 characters)'),{statusCode:400});
  return obj.question;
}
function checkHost(req,port){
  const host=req.headers.host;
  return host===`127.0.0.1:${port}`||host===`localhost:${port}`;
}
function authorized(req,secret){
  const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(header))return false;
  // Equal-length constant-time comparison after strict ASCII-format verification.
  return crypto.timingSafeEqual(Buffer.from(header.slice(7),'ascii'),Buffer.from(secret,'ascii'));
}
export function createDashboardServer({packageRoot}){
  if(typeof packageRoot!=='string'||!packageRoot.trim())throw new Error('packageRoot required');
  const root=fs.realpathSync(packageRoot);
  loadPackage(root);
  const secret=crypto.randomBytes(32).toString('base64url');
  const server=http.createServer(async(req,res)=>{
    const port=server.address()?.port;
    if(!checkHost(req,port))return respond(res,403,{error:'FORBIDDEN_HOST'});
    let route;
    try{route=new URL(req.url,'http://127.0.0.1').pathname;}
    catch{return respond(res,400,{error:'BAD_REQUEST'});}
    if(req.method==='GET'&&route==='/api/health')return respond(res,200,{status:'READY',scope:'loopback_only'});
    if(route.startsWith('/api/') && !authorized(req,secret))return respond(res,401,{error:'SESSION_REQUIRED'});
    if(req.method==='GET'&&route==='/api/overview'){
      try{return respond(res,200,overview(root));}
      catch{return respond(res,422,{error:'PACKAGE_UNVERIFIED',reason:'Data source failed validation or supported dataset checks'});}
    }
    if(req.method==='POST'&&(route==='/api/query'||route==='/api/search')){
      const origin=req.headers.origin;
      if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`)return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{
        const question=await readJson(req);
        const answer=route==='/api/query'?routeQuestion(root,question):searchDocuments(root,question,{limit:8});
        return respond(res,200,answer);
      }catch(e){
        if(e.statusCode)return respond(res,e.statusCode,{error:'INVALID_REQUEST',reason:e.message});
        return respond(res,422,{error:'PACKAGE_OR_QUERY_UNVERIFIED',reason:'Unable to evaluate verified input'});
      }
    }
    if(req.method==='GET'&&Object.hasOwn(ASSETS,route)){
      const asset=ASSETS[route];
      try{return respond(res,200,fs.readFileSync(asset.path,'utf8'),{'Content-Type':asset.type});}
      catch{return respond(res,500,{error:'STATIC_ASSET_UNAVAILABLE'});}
    }
    if(['GET','POST'].includes(req.method))return respond(res,404,{error:'NOT_FOUND'});
    return respond(res,405,{error:'METHOD_NOT_ALLOWED'},{'Allow':'GET, POST'});
  });
  sessions.set(server,secret);
  server.requestTimeout=5_000;
  server.headersTimeout=10_000;
  return server;
}
export function listenDashboard(server,port=8765){
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('port must be 0..65535');
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{
      server.off('error',reject);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}
/** Browser uses fragment locally, then sends token only in Authorization header. */
export function dashboardLaunchUrl(server){
  const token=sessions.get(server);
  const address=server.address();
  if(!token || !address || typeof address!=='object')throw new Error('dashboard not listening');
  return `http://127.0.0.1:${address.port}/#session=${token}`;
}
