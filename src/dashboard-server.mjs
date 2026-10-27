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
import {answerFollowUp} from './conversation.mjs';
import {searchDocuments} from './document-search.mjs';
import {knowledgeSearch,knowledgeCompare} from './knowledge-base.mjs';
import {previewSmaxSales} from './smax-sales-preview.mjs';
import {inspectCsvBytes} from './local-csv-review.mjs';
import {planBrowserSmaxReview} from './smax-browser-review-plan.mjs';
import {exportHeldReviewSummary} from './review-hold-export.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ASSETS={
  '/':{path:path.join(HERE,'../ui/index.html'),type:'text/html; charset=utf-8'},
  '/app.css':{path:path.join(HERE,'../ui/app.css'),type:'text/css; charset=utf-8'},
  '/app.js':{path:path.join(HERE,'../ui/app.js'),type:'text/javascript; charset=utf-8'},
  '/provenance.js':{path:path.join(HERE,'../ui/provenance.js'),type:'text/javascript; charset=utf-8'}
};
const MAX_BODY=2048;
const MAX_SMAX_JSON=4*1024*1024;
const MAX_SMAX_CSV=2*1024*1024;
const MAX_SMAX_BODY=8*1024*1024+256*1024;
const MAX_BROWSER_DOC_REVIEW=256*1024;
const MAX_BROWSER_REVIEW_BODY=MAX_SMAX_BODY+4*Math.ceil(MAX_BROWSER_DOC_REVIEW/3)+512;
const MAX_CSV_REVIEW=1024*1024;
const MAX_CSV_REVIEW_BODY=4*Math.ceil(MAX_CSV_REVIEW/3)+256;
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
/** P5.16: only already-verified, accepted TXT/Markdown documents. One bounded page. */
function documentPage(root,docId,start){
  const pkg=loadPackage(root); // Verify all source hashes on every read.
  const d=pkg.manifest.documents.find(x=>x.document_id===docId);
  if(!d)return {error:'DOCUMENT_NOT_FOUND',statusCode:404};
  const file=pkg.fileMap.get(d.file_id);
  if(file?.import_status!=='ACCEPTED'||!(/\.(txt|md)$/i).test(file.relative_path))
    return {error:'DOCUMENT_NOT_SUPPORTED',statusCode:422};
  const source=pkg.textMap.get(d.file_id);
  if(typeof source!=='string')return {error:'DOCUMENT_NOT_SUPPORTED',statusCode:422};
  const lines=source.replace(/\r\n/g,'\n').split('\n');
  if(lines.length>10000||lines.some(x=>x.length>4096))
    return {error:'DOCUMENT_TOO_LARGE',statusCode:422};
  if(start>lines.length)return {error:'PAGE_OUT_OF_RANGE',statusCode:400};
  return {status:'VERIFIED_SOURCE_LINES',document_id:d.document_id,
    file_id:d.file_id,source_title:d.source_title,page_info:d.page_info,
    start,total_lines:lines.length,
    lines:lines.slice(start-1,start+39).map((text,i)=>({line:start+i,text})),
    next_start:start+40<=lines.length?start+40:null};
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
/** P5.18: bounded untrusted client collection; never accepts a path or manifest overrides. */
async function readKnowledgeRequest(req){
 if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type']??''))
   throw Object.assign(new Error('INVALID_MEDIA_TYPE'),{statusCode:415});
 let bytes=0;const chunks=[];
 for await(const chunk of req){
   bytes+=chunk.length;
   if(bytes>4096)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{statusCode:413});
   chunks.push(chunk);
 }
 let obj;
 try{obj=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 catch{throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||!['search','compare'].includes(obj.action)||
   typeof obj.project_key!=='string'||!/^[a-f0-9]{32}$/.test(obj.project_key)||
   (Object.hasOwn(obj,'mode')&&(obj.action!=='search'||!['bm25','lexical_hybrid'].includes(obj.mode)))||
   !Array.isArray(obj.document_ids)||obj.document_ids.length<1||obj.document_ids.length>8||
   obj.document_ids.some(x=>typeof x!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(x))||
   new Set(obj.document_ids).size!==obj.document_ids.length||
   (obj.action==='compare'&&obj.document_ids.length<2)||
   (obj.action==='search'&&(typeof obj.question!=='string'||!obj.question.trim()||obj.question.length>500))||
   Object.keys(obj).length!==(obj.action==='search'?(Object.hasOwn(obj,'mode')?5:4):3)||
   Object.keys(obj).some(x=>!(obj.action==='search'?['action','project_key','document_ids','question','mode']:['action','project_key','document_ids']).includes(x)))
   throw Object.assign(new Error('INVALID_KNOWLEDGE_REQUEST'),{statusCode:400});
 return obj;
}
/** P5.17: exact small JSON contract. Never accept a session-controlled filesystem path. */
async function readFollowUp(req){
 if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type']??''))
   throw Object.assign(new Error('INVALID_MEDIA_TYPE'),{statusCode:415});
 const chunks=[];let size=0;
 for await(const chunk of req){
   size+=chunk.length;
   if(size>2048)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{statusCode:413});
   chunks.push(chunk);
 }
 let value;
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 catch{throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}
 if(!value||Array.isArray(value)||typeof value!=='object'||
    Object.keys(value).length!==3||
    !Object.hasOwn(value,'question')||!Object.hasOwn(value,'previous_question')||
    !Object.hasOwn(value,'project_key')||
    typeof value.question!=='string'||!value.question.trim()||value.question.length>500||
    typeof value.previous_question!=='string'||!value.previous_question.trim()||
    value.previous_question.length>500||
    typeof value.project_key!=='string'||!/^[0-9a-f]{32}$/.test(value.project_key))
   throw Object.assign(new Error('INVALID_FOLLOWUP_REQUEST'),{statusCode:400});
 return value;
}
/** Separate strictly bounded browser handoff; no persistence, files or source echoes.
 * The JSON package remains NOT_GRANTED. The source bytes are SHA-bound by P5.13.
 */
async function readSmaxPreview(req){
  const ct=req.headers['content-type']??'';
  if(!/^application\/json(?:\s*;|\s*$)/i.test(ct))
    throw Object.assign(new Error('INVALID_MEDIA_TYPE'),{statusCode:415});
  let length=0;
  const chunks=[];
  for await(const chunk of req){
    length+=chunk.length;
    if(length>MAX_SMAX_BODY)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{statusCode:413});
    chunks.push(chunk);
  }
  let payload;
  try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).length!==2||!Object.hasOwn(payload,'v1')||
     !Object.hasOwn(payload,'source_csv_base64')||
     !payload.v1||typeof payload.v1!=='object'||Array.isArray(payload.v1)||
     typeof payload.source_csv_base64!=='string'||
     payload.source_csv_base64.length<4||
     payload.source_csv_base64.length>4*Math.ceil(MAX_SMAX_CSV/3)||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.source_csv_base64)||
     Buffer.byteLength(JSON.stringify(payload.v1),'utf8')>MAX_SMAX_JSON)
    throw Object.assign(new Error('INVALID_SOURCE_FORM'),{statusCode:400});
  const bytes=Buffer.from(payload.source_csv_base64,'base64');
  if(!bytes.length||bytes.length>MAX_SMAX_CSV||bytes.toString('base64')!==payload.source_csv_base64)
    throw Object.assign(new Error('INVALID_SOURCE_FORM'),{statusCode:400});
  try{return previewSmaxSales(payload.v1,bytes);}
  finally{bytes.fill(0);}
}
/** Browser explicit CSV choice: no path, no import, no source cell echo. */
/** Explicit local browser JSON + CSV + TXT/MD HOLD plan. No AX promotion. */
async function readSmaxBrowserReviewPlan(req){
 if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type']??''))
  throw Object.assign(Error('INVALID_MEDIA_TYPE'),{statusCode:415});
 let size=0;const chunks=[];
 for await(const chunk of req){
  size+=chunk.length;
  if(size>MAX_BROWSER_REVIEW_BODY)
   throw Object.assign(Error('PAYLOAD_TOO_LARGE'),{statusCode:413});
  chunks.push(chunk);
 }
 let value;
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 catch{throw Object.assign(Error('INVALID_JSON'),{statusCode:400});}
 const valid64=(v,max)=>typeof v==='string'&&v.length>=4&&
  v.length<=4*Math.ceil(max/3)&&
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(v);
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.keys(value).length!==4||!Object.hasOwn(value,'v1')||
  !Object.hasOwn(value,'source_csv_base64')||
  !Object.hasOwn(value,'document_base64')||
  !Object.hasOwn(value,'document_kind')||
  !value.v1||typeof value.v1!=='object'||Array.isArray(value.v1)||
  !['.txt','.md'].includes(value.document_kind)||
  !valid64(value.source_csv_base64,MAX_SMAX_CSV)||
  !valid64(value.document_base64,MAX_BROWSER_DOC_REVIEW)||
  Buffer.byteLength(JSON.stringify(value.v1),'utf8')>MAX_SMAX_JSON)
  throw Object.assign(Error('INVALID_REVIEW_FORM'),{statusCode:400});
 const csv=Buffer.from(value.source_csv_base64,'base64');
 const document=Buffer.from(value.document_base64,'base64');
 try{
  if(!csv.length||csv.length>MAX_SMAX_CSV||
     !document.length||document.length>MAX_BROWSER_DOC_REVIEW||
     csv.toString('base64')!==value.source_csv_base64||
     document.toString('base64')!==value.document_base64)
   throw Object.assign(Error('INVALID_REVIEW_FORM'),{statusCode:400});
  return planBrowserSmaxReview(value.v1,csv,document,value.document_kind);
 }finally{csv.fill(0);document.fill(0);}
}

async function readCsvBrowserReview(req){
  if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type']??''))
    throw Object.assign(new Error('INVALID_MEDIA_TYPE'),{statusCode:415});
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_CSV_REVIEW_BODY)
      throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{statusCode:413});
    chunks.push(chunk);
  }
  let payload;
  try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
  catch{throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).length!==1||typeof payload.source_csv_base64!=='string'||
     payload.source_csv_base64.length<4||
     payload.source_csv_base64.length>4*Math.ceil(MAX_CSV_REVIEW/3)||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.source_csv_base64))
    throw Object.assign(new Error('INVALID_CSV_REVIEW_FORM'),{statusCode:400});
  const bytes=Buffer.from(payload.source_csv_base64,'base64');
  try{
    if(!bytes.length||bytes.length>MAX_CSV_REVIEW||
       bytes.toString('base64')!==payload.source_csv_base64)
      throw Object.assign(new Error('INVALID_CSV_REVIEW_FORM'),{statusCode:400});
    return inspectCsvBytes(bytes);
  }finally{bytes.fill(0);}
}
/** Strict small JSON contract for switching among explicit launch-time roots. */
async function readProjectChoice(req){
  if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type']??''))
    throw Object.assign(new Error('INVALID_MEDIA_TYPE'),{statusCode:415});
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>256)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{statusCode:413});
    chunks.push(chunk);
  }
  let value;
  try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
  catch{throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}
  if(!value||Array.isArray(value)||typeof value!=='object'||
     Object.keys(value).length!==1||typeof value.project_key!=='string'||
     !/^[a-f0-9]{32}$/.test(value.project_key))
    throw Object.assign(new Error('INVALID_PROJECT_CHOICE'),{statusCode:400});
  return value.project_key;
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
export function createDashboardServer({packageRoot,projectRoots=null}){
  if(typeof packageRoot!=='string'||!packageRoot.trim())throw new Error('packageRoot required');
  const roots=projectRoots===null?[packageRoot]:projectRoots;
  if(!Array.isArray(roots)||roots.length<1||roots.length>8||
     roots.some(p=>typeof p!=='string'||!p.trim()))throw new Error('Invalid explicit project roots');
  const candidates=roots.map(p=>fs.realpathSync(p));
  const root=fs.realpathSync(packageRoot);
  if(candidates[0]!==root||new Set(candidates).size!==candidates.length)
    throw new Error('Project roots must be distinct and first must be packageRoot');
  // Validate *every* chosen root before exposing any selector item. No scanning.
  const projects=candidates.map(projectRoot=>{
    const pkg=loadPackage(projectRoot);
    if(pkg.manifest.files.some(f=>f.import_status!=='ACCEPTED')||
       pkg.manifest.datasets.some(d=>d.columns.some(c=>c.review_status!=='APPROVED'))||
       pkg.manifest.documents.length<1)throw new Error('Selected package is not ready');
    overview(projectRoot); // Actual readonly dataset validation before listing.
    return Object.freeze({
      key:crypto.randomBytes(16).toString('hex'),
      root:projectRoot,
      project_id:pkg.manifest.project_id,
      schema_version:pkg.manifest.schema_version,
      documents:pkg.manifest.documents.length
    });
  });
  let selected=projects[0];
  const secret=crypto.randomBytes(32).toString('base64url');
  const server=http.createServer(async(req,res)=>{
    const port=server.address()?.port;
    if(!checkHost(req,port))return respond(res,403,{error:'FORBIDDEN_HOST'});
    let route;
    try{route=new URL(req.url,'http://127.0.0.1').pathname;}
    catch{return respond(res,400,{error:'BAD_REQUEST'});}
    if(req.method==='GET'&&route==='/api/health')return respond(res,200,{status:'READY',scope:'loopback_only'});
    if(route.startsWith('/api/') && !authorized(req,secret))return respond(res,401,{error:'SESSION_REQUIRED'});
    if(req.method==='GET'&&route==='/api/projects'){
      return respond(res,200,{
        status:'EXPLICIT_LOCAL_PROJECTS_ONLY',
        selected:selected.key,
        projects:projects.map(p=>({project_key:p.key,project_id:p.project_id,
          schema_version:p.schema_version,documents:p.documents}))
      });
    }
    if(req.method==='POST'&&route==='/api/projects/select'){
      const origin=req.headers.origin;
      if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`)
        return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{
        const key=await readProjectChoice(req);
        const next=projects.find(p=>p.key===key);
        if(!next)return respond(res,404,{error:'PROJECT_NOT_ALLOWLISTED'});
        // Atomic: verify the next project before changing the active root.
        const nextOverview=overview(next.root);
        selected=next;
        return respond(res,200,{status:'PROJECT_SELECTED',selected:key,overview:nextOverview});
      }catch(e){
        if(e.statusCode)return respond(res,e.statusCode,{error:e.message});
        return respond(res,422,{error:'PROJECT_UNVERIFIED'});
      }
    }
    if(req.method==='GET'&&route==='/api/overview'){
      try{return respond(res,200,overview(selected.root));}
      catch{return respond(res,422,{error:'PACKAGE_UNVERIFIED',reason:'Data source failed validation or supported dataset checks'});}
    }
    if(req.method==='GET'&&route==='/api/documents'){
      // Only exact document identifiers; no file paths, search roots or arbitrary reads.
      const input=new URL(req.url,'http://127.0.0.1').searchParams;
      const keys=[...input.keys()];
      if(keys.length<1||keys.length>2||new Set(keys).size!==keys.length||
         keys.some(k=>!['document_id','start'].includes(k))||
         !input.has('document_id')||
         !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(input.get('document_id'))||
         (input.has('start')&&!/^[1-9][0-9]{0,4}$/.test(input.get('start'))))
        return respond(res,400,{error:'INVALID_DOCUMENT_CHOICE'});
      const start=Number(input.get('start')??'1');
      if(start>10000)return respond(res,400,{error:'INVALID_DOCUMENT_CHOICE'});
      try{
        const result=documentPage(selected.root,input.get('document_id'),start);
        if(result.error)return respond(res,result.statusCode,{error:result.error});
        return respond(res,200,result);
      }catch{return respond(res,422,{error:'PACKAGE_UNVERIFIED'});}
    }
    if(req.method==='POST'&&route==='/api/knowledge'){
      const origin=req.headers.origin;
      if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`)
        return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{
        const input=await readKnowledgeRequest(req);
        if(input.project_key!==selected.key)return respond(res,409,{error:'WORKSPACE_CHANGED'});
        const output=input.action==='search'
          ?knowledgeSearch(selected.root,input.document_ids,input.question,{mode:input.mode??'bm25'})
          :knowledgeCompare(selected.root,input.document_ids);
        return respond(res,200,output);
      }catch(e){
        if(e.statusCode)return respond(res,e.statusCode,{error:e.message});
        return respond(res,422,{error:'KNOWLEDGE_UNVERIFIED'});
      }
    }
    if(req.method==='POST'&&route==='/api/conversation'){
      const origin=req.headers.origin;
      if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`)
        return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{
        const payload=await readFollowUp(req);
        // Reject stale context from another selected project (including an in-flight switch).
        if(payload.project_key!==selected.key)return respond(res,409,{error:'WORKSPACE_CHANGED'});
        return respond(res,200,answerFollowUp(selected.root,payload.question,payload.previous_question));
      }catch(e){
        if(e.statusCode)return respond(res,e.statusCode,{error:e.message});
        return respond(res,422,{error:'PACKAGE_OR_QUERY_UNVERIFIED'});
      }
    }
    if(req.method==='POST'&&route==='/api/csv-review'){
      // Bearer and Host gate occurred before this branch: no body read on 401/403.
      const origin=req.headers.origin;
      if(origin&&origin!==('http://127.0.0.1:'+port)&&origin!==('http://localhost:'+port))
        return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{return respond(res,200,await readCsvBrowserReview(req));}
      catch(e){
        if(e.statusCode)return respond(res,e.statusCode,{error:e.message});
        return respond(res,422,{error:'CSV_REVIEW_UNVERIFIED'});
      }
    }
    if(req.method==='POST'&&route==='/api/smax-review-plan'){
      // Same bearer, localhost Host, and strict Origin boundary as SMAX preview.
      const origin=req.headers.origin;
      if(origin&&origin!==('http://127.0.0.1:'+port)&&origin!==('http://localhost:'+port))
        return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{
        const plan=await readSmaxBrowserReviewPlan(req);
        const reviewExport=exportHeldReviewSummary(plan);
        return respond(res,200,{...plan,review_export_json:reviewExport.json,
          review_export_sha256:reviewExport.sha256});
      }
      catch(e){
        if(e.statusCode)return respond(res,e.statusCode,{error:e.message});
        return respond(res,422,{error:'SMAX_REVIEW_UNVERIFIED'});
      }
    }
    if(req.method==='POST'&&route==='/api/smax-preview'){
      // Deliberately distinct from /api/query: larger limited payload, same bearer,
      // Host and Origin protections, no disk writes and no raw file echo.
      const origin=req.headers.origin;
      if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`)
        return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{return respond(res,200,await readSmaxPreview(req));}
      catch(e){
        if(e.statusCode)return respond(res,e.statusCode,{error:e.message});
        return respond(res,422,{error:'SMAX_PREVIEW_UNVERIFIED'});
      }
    }
    if(req.method==='POST'&&(route==='/api/query'||route==='/api/search')){
      const origin=req.headers.origin;
      if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`)return respond(res,403,{error:'FORBIDDEN_ORIGIN'});
      try{
        const question=await readJson(req);
        const answer=route==='/api/query'?routeQuestion(selected.root,question):searchDocuments(selected.root,question,{limit:8});
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
