import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCsvBytes} from '../src/local-csv-review.mjs';
import {createLocalReviewBundle} from '../src/prep-review-bundle.mjs';
import {verifyReviewBundle} from '../src/review-bundle-verify.mjs';
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
