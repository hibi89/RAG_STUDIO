import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {createLocalReviewBundle} from '../src/prep-review-bundle.mjs';
import {verifyReviewBundle} from '../src/review-bundle-verify.mjs';
import {exportVerifiedReviewZip} from '../src/review-bundle-zip.mjs';
import {verifyOfflineReviewZip} from '../src/review-zip-verify.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const raw='주문번호,상품코드,수량,단가,매출\nA-001,N-01,2,100,200\nA-002,N-02,1,150,150\n';
const fields=[['order_id','주문번호','text'],['sku','상품코드','text'],['quantity','수량','integer'],['unit_price_krw','단가','integer'],['amount_krw','매출','integer']].map(([key,source,type])=>({key,source,type,required:true}));
function fixture(t){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p553-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const csv=path.join(tmp,'source.csv'),draft=path.join(tmp,'owner.json'),doc=path.join(tmp,'policy.txt'),dest=path.join(tmp,'review-out');
 fs.writeFileSync(csv,raw);fs.writeFileSync(doc,'반품은 7일 이내 신청 가능합니다.\n');const b=fs.readFileSync(csv),r=inspectCsvBytes(b);
 fs.writeFileSync(draft,JSON.stringify({contract:'RAG_PREP_OWNER_MAPPING_V1',source_sha256:r.source_sha256,source_size_bytes:b.length,fields}));
 return {tmp,csv,draft,doc,dest};}
function build(t){const f=fixture(t),o=createLocalReviewBundle(f.csv,f.draft,f.doc,f.dest);return {...f,o};}
test('P5.53 opt-in bundle creates 10 exact whitelist files with source-pinned manifest',t=>{const x=build(t);assert.equal(x.o.status,'REVIEW_BUNDLE_CREATED_NOT_APPROVED');
 const v=verifyReviewBundle(x.dest);assert.equal(v.status,'RAG_REVIEW_BUNDLE_INTEGRITY_PASS');assert.equal(v.files,10);
 const m=JSON.parse(fs.readFileSync(path.join(x.dest,'manifest.json'),'utf8'));
 assert.equal(m.files.length,10);assert.equal(m.approval,'NOT_GRANTED');
 assert.equal(JSON.parse(fs.readFileSync(path.join(x.dest,'sales-review.json'),'utf8')).metrics.revenue_krw,'350');
 assert.equal(JSON.parse(fs.readFileSync(path.join(x.dest,'mixed-review.json'),'utf8')).document_evidence.source_lines[0].source_line,1);
});
test('P5.53 copies no raw customer CSV or TXT or approval claims',t=>{const x=build(t);const all=fs.readdirSync(x.dest).sort();assert.deepEqual(all,['RUN_LOCAL_REVIEW_UNIX.sh','RUN_LOCAL_REVIEW_WINDOWS.cmd','manifest.json','mixed-review.json','sales-review.json','src','ui']);
 for(const a of ['source.csv','policy.txt','owner.json'])assert.equal(fs.existsSync(path.join(x.dest,a)),false);
 assert.equal(x.o.customer_data_approved,false);assert.equal(x.o.ax_package_created,false);
});
test('P5.53 checked bundle runs independent built-in Node verifier from relocated folder',t=>{const x=build(t);
 const proc=spawnSync(process.execPath,['src/review-bundle-verify.mjs'],{cwd:x.dest,encoding:'utf8'});
 assert.equal(proc.status,0,proc.stderr);assert.equal(JSON.parse(proc.stdout).status,'RAG_REVIEW_BUNDLE_INTEGRITY_PASS');
});
test('P5.53 mutated bundled report, UI and unexpected injected file are rejected',t=>{const x=build(t);
 const report=path.join(x.dest,'sales-review.json');fs.appendFileSync(report,' ');assert.throws(()=>verifyReviewBundle(x.dest));
 fs.truncateSync(report,fs.statSync(report).size-1);assert.equal(verifyReviewBundle(x.dest).files,10);
 fs.appendFileSync(path.join(x.dest,'ui/prep-owner.js'),'//unexpected');assert.throws(()=>verifyReviewBundle(x.dest));
});
test('P5.53 new output directory must not exist; original source remains unchanged',t=>{const x=fixture(t);fs.mkdirSync(x.dest);const before=fs.readFileSync(x.csv);
 assert.throws(()=>createLocalReviewBundle(x.csv,x.draft,x.doc,x.dest));assert.deepEqual(fs.readFileSync(x.csv),before);
 assert.deepEqual(fs.readdirSync(x.dest),[]);
});
test('P5.53 symlink output parent and invalid absolute path blocked',t=>{const x=fixture(t);
 assert.throws(()=>createLocalReviewBundle(x.csv,x.draft,x.doc,'relative-output'));
 if(process.platform!=='win32'){
  const link=path.join(x.tmp,'linked');fs.symlinkSync(x.tmp,link);
  assert.throws(()=>createLocalReviewBundle(x.csv,x.draft,x.doc,path.join(link,'review')));
 }
});
test('P5.53 mutated source before export blocks without partial output',t=>{const x=fixture(t);fs.appendFileSync(x.csv,'A-003,N-03,1,1,1\n');
 assert.throws(()=>createLocalReviewBundle(x.csv,x.draft,x.doc,x.dest));assert.equal(fs.existsSync(x.dest),false);
});
test('P5.53 chosen invalid semantic inputs never create destination',t=>{const x=fixture(t);fs.writeFileSync(x.doc,'계약 문구가 없습니다.');
 const b=createLocalReviewBundle(x.csv,x.draft,x.doc,x.dest);assert.equal(b.status,'REVIEW_BUNDLE_CREATED_NOT_APPROVED');
 assert.equal(JSON.parse(fs.readFileSync(path.join(x.dest,'mixed-review.json'),'utf8')).status,'INSUFFICIENT_DOCUMENT_EVIDENCE');
});
test('P5.53 CLI returns no filesystem paths and client files are unchanged',t=>{const x=fixture(t),orig=fs.readFileSync(x.csv);
 const p=spawnSync(process.execPath,['src/prep-review-bundle-cli.mjs',x.csv,x.draft,x.doc,x.dest],{cwd:root,encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).status,'REVIEW_BUNDLE_CREATED_NOT_APPROVED');
 assert.doesNotMatch(p.stdout+p.stderr,/rag-p553-|A-001|source\.csv|policy\.txt/);assert.deepEqual(fs.readFileSync(x.csv),orig);
});
function request(port,url){return new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path:url},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);});}
test('P5.53 launched standalone relocated Node server serves only UI, never JSON reports',async t=>{
 const x=build(t);const child=spawn(process.execPath,['src/prep-owner-serve-cli.mjs'],{cwd:x.dest,stdio:['ignore','pipe','pipe']});
 t.after(()=>{child.kill();});
 const url=await Promise.race([new Promise((resolve,reject)=>{
    let buf='';child.stdout.on('data',b=>{buf+=b.toString();const m=/http:\/\/127\.0\.0\.1:(\d+)\//u.exec(buf);if(m)resolve(Number(m[1]));});child.on('exit',()=>reject(Error('server exited')));
   }),new Promise((_,reject)=>setTimeout(()=>reject(Error('server timeout')),4000))]);
 const good=await request(url,'/');assert.equal(good.status,200);assert.match(good.body,/RAG Studio/);
 const hidden=await request(url,'/sales-review.json');assert.equal(hidden.status,404);
 assert.match(good.headers['content-security-policy'],/connect-src 'none'/);
});

test('P5.54 output path replacement on manifest failure never deletes unrelated owner files',t=>{
 const x=fixture(t);
 const unrelated=path.join(x.tmp,'unrelated-owner-folder');
 const movedPartial=path.join(x.tmp,'partial-review-created-by-this-run');
 fs.mkdirSync(unrelated);
 const marker=path.join(unrelated,'keep-this.txt');
 fs.writeFileSync(marker,'DO NOT DELETE');
 const original=fs.writeFileSync;
 let injected=false;
 const sourceBefore=fs.readFileSync(x.csv);
 try {
  fs.writeFileSync=function(filename,...args){
   if(filename===path.join(x.dest,'manifest.json')){
    // Controlled temporary-directory race. No customer data is involved.
    fs.renameSync(x.dest,movedPartial);
    fs.renameSync(unrelated,x.dest);
    injected=true;
    throw new Error('SIMULATED_MANIFEST_IO_FAILURE');
   }
   return original.call(this,filename,...args);
  };
  assert.throws(()=>createLocalReviewBundle(x.csv,x.draft,x.doc,x.dest),/RAG_PREP_BUNDLE_BLOCKED/u);
 }finally{fs.writeFileSync=original;}
 assert.equal(injected,true);
 assert.equal(fs.readFileSync(path.join(x.dest,'keep-this.txt'),'utf8'),'DO NOT DELETE');
 assert.equal(fs.existsSync(movedPartial),true);
 assert.deepEqual(fs.readFileSync(x.csv),sourceBefore);
});

test('P5.54 ordinary bundle write failure preserves partial output for explicit review',t=>{
 const x=fixture(t),original=fs.writeFileSync;
 let injected=false;
 try{
  fs.writeFileSync=function(filename,...args){
   if(filename===path.join(x.dest,'sales-review.json')){
    injected=true;
    throw new Error('SIMULATED_DISK_FAILURE');
   }
   return original.call(this,filename,...args);
  };
  assert.throws(()=>createLocalReviewBundle(x.csv,x.draft,x.doc,x.dest),/RAG_PREP_BUNDLE_BLOCKED/u);
 }finally{fs.writeFileSync=original;}
 assert.equal(injected,true);
 assert.equal(fs.existsSync(x.dest),true);
 assert.equal(fs.existsSync(path.join(x.dest,'ui/prep-owner.html')),true);
 assert.equal(fs.existsSync(path.join(x.dest,'manifest.json')),false);
 assert.throws(()=>verifyReviewBundle(x.dest),/RAG_REVIEW_BUNDLE_INVALID/u);
});

test('P5.56 original producer output is accepted, but rehashed paired forged KPI is rejected',t=>{
 const x=build(t);
 assert.equal(verifyReviewBundle(x.dest).status,'RAG_REVIEW_BUNDLE_INTEGRITY_PASS');
 const salesFile=path.join(x.dest,'sales-review.json'),mixedFile=path.join(x.dest,'mixed-review.json');
 const manifestFile=path.join(x.dest,'manifest.json');
 const sales=JSON.parse(fs.readFileSync(salesFile,'utf8'));
 const mixed=JSON.parse(fs.readFileSync(mixedFile,'utf8'));
 sales.metrics.revenue_krw='999';
 mixed.metric_evidence.metrics.revenue_krw='999';
 fs.writeFileSync(salesFile,JSON.stringify(sales));
 fs.writeFileSync(mixedFile,JSON.stringify(mixed));
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 for(const filename of ['sales-review.json','mixed-review.json']){
  const bytes=fs.readFileSync(path.join(x.dest,filename));
  const item=manifest.files.find(f=>f.relative_path===filename);
  item.size_bytes=bytes.length;
  item.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 }
 fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 assert.throws(()=>verifyReviewBundle(x.dest),/RAG_REVIEW_BUNDLE_INVALID/u);
});


test('P5.58 full original producer to ZIP to pre-extraction verifier stays source-bound',t=>{
 const x=build(t),zip=path.join(x.tmp,'review.zip');
 const before=fs.readFileSync(x.csv),policyBefore=fs.readFileSync(x.doc);
 const zipped=exportVerifiedReviewZip(x.dest,zip);
 assert.equal(zipped.status,'RAG_REVIEW_ZIP_CREATED_NOT_APPROVED');
 assert.equal(zipped.files,11);
 const verified=verifyOfflineReviewZip(zip);
 assert.equal(verified.status,'RAG_REVIEW_ZIP_INTEGRITY_PASS_NOT_APPROVED');
 assert.equal(verified.sha256,zipped.sha256);
 assert.equal(verified.customer_data_approved,false);
 assert.deepEqual(fs.readFileSync(x.csv),before);
 assert.deepEqual(fs.readFileSync(x.doc),policyBefore);
 fs.appendFileSync(zip,Buffer.from('CORRUPT'));
 assert.throws(()=>verifyOfflineReviewZip(zip),/RAG_REVIEW_ZIP_INVALID/u);
});
