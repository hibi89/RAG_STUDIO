import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyReviewBundle} from '../src/review-bundle-verify.mjs';
import {exportVerifiedReviewZip} from '../src/review-bundle-zip.mjs';
import {spawnSync} from 'node:child_process';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const here=fileURLToPath(new URL('../',import.meta.url));
const HEX='a'.repeat(64);
const EXPECTED=['ui/prep-owner.html','ui/prep-owner.js','ui/prep-owner.css',
 'src/prep-owner-local-server.mjs','src/prep-owner-serve-cli.mjs','src/review-bundle-verify.mjs',
 'sales-review.json','mixed-review.json','RUN_LOCAL_REVIEW_WINDOWS.cmd','RUN_LOCAL_REVIEW_UNIX.sh'];
function build(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p556-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const folder of ['ui','src'])fs.mkdirSync(path.join(root,folder));
 const metrics={orders:2,units:'3',revenue_krw:'350'};
 const evidence=[{source_line:2,sku:'N-01',quantity:'2',amount_krw:'200'},
  {source_line:3,sku:'N-02',quantity:'1',amount_krw:'150'}];
 const flags={ax_package_created:false,sqlite_imported:false,remote_upload:false,
  source_modified:false,customer_data_approved:false,source_rights_verified:false,smax_native_approved:false};
 const sales={contract:'RAG_PREP_SALES_PREVIEW_V1',status:'REVIEW_HOLD',source_sha256:HEX,
  source_size_bytes:93,source_rows:2,metrics,
  sku_totals:[{sku:'N-01',orders:1,units:'2',revenue_krw:'200'},
   {sku:'N-02',orders:1,units:'1',revenue_krw:'150'}],source_evidence:evidence,
  evidence_truncated:false,...flags};
 const mixed={contract:'RAG_PREP_MIXED_PREVIEW_V1',status:'PREVIEW_WITH_CITATIONS',
  approval:'NOT_GRANTED',answer:null,source_sha256:HEX,source_rows:2,
  metric_evidence:{metrics:structuredClone(metrics),source_lines:structuredClone(evidence),source_evidence_truncated:false},
  document_evidence:{sha256:HEX,size_bytes:50,
   source_lines:[{source_line:1,quote:'반품 7일 이내 신청 가능',kind:'UNAPPROVED_SOURCE_EXCERPT'}],
   source_evidence_truncated:false},document_indexed:false,...flags};
 const content=new Map();
 for(const name of EXPECTED){
  if(name==='sales-review.json')content.set(name,Buffer.from(JSON.stringify(sales)));
  else if(name==='mixed-review.json')content.set(name,Buffer.from(JSON.stringify(mixed)));
  else if(name==='src/review-bundle-verify.mjs')content.set(name,fs.readFileSync(path.join(here,name)));
  else content.set(name,Buffer.from('SYNTHETIC REVIEW ASSET'));
 }
 const manifest={contract:'RAG_PREP_REVIEW_BUNDLE_V1',status:'REVIEW_HOLD',approval:'NOT_GRANTED',
  source_sha256:HEX,ax_package_created:false,sqlite_imported:false,remote_upload:false,files:[]};
 function save(){
  manifest.files=[];
  for(const [name,b] of content){
   fs.writeFileSync(path.join(root,name),b);
   manifest.files.push({relative_path:name,size_bytes:b.length,sha256:sha(b)});
  }
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));
 }
 save();
 return {root,content,save};
}
test('P5.56 complete physical synthetic bundle validates using exact real verifier',t=>{
 const b=build(t);assert.equal(verifyReviewBundle(b.root).status,'RAG_REVIEW_BUNDLE_INTEGRITY_PASS');
});
test('P5.56 even rehashed mismatching metrics fail physical verification',t=>{
 const b=build(t),s=JSON.parse(b.content.get('sales-review.json').toString());
 s.metrics.revenue_krw='999';b.content.set('sales-review.json',Buffer.from(JSON.stringify(s)));
 b.save();assert.throws(()=>verifyReviewBundle(b.root),/RAG_REVIEW_BUNDLE_INVALID/);
});
test('P5.56 even rehashed consistent cross-report metrics cannot fake SKU totals',t=>{
 const b=build(t),s=JSON.parse(b.content.get('sales-review.json').toString()),
  m=JSON.parse(b.content.get('mixed-review.json').toString());
 s.metrics.revenue_krw='999';m.metric_evidence.metrics.revenue_krw='999';
 b.content.set('sales-review.json',Buffer.from(JSON.stringify(s)));
 b.content.set('mixed-review.json',Buffer.from(JSON.stringify(m)));
 b.save();assert.throws(()=>verifyReviewBundle(b.root),/RAG_REVIEW_BUNDLE_INVALID/);
});
test('P5.56 rehashed approval fraud cannot pass physical verifier',t=>{
 const b=build(t),m=JSON.parse(b.content.get('mixed-review.json').toString());
 m.customer_data_approved=true;b.content.set('mixed-review.json',Buffer.from(JSON.stringify(m)));
 b.save();assert.throws(()=>verifyReviewBundle(b.root),/RAG_REVIEW_BUNDLE_INVALID/);
});
test('P5.56 unrelated injected file is rejected, existing files preserved',t=>{
 const b=build(t);fs.writeFileSync(path.join(b.root,'secret.txt'),'PRIVATE TEST MARKER');
 assert.throws(()=>verifyReviewBundle(b.root),/RAG_REVIEW_BUNDLE_INVALID/);
 assert.equal(fs.readFileSync(path.join(b.root,'secret.txt'),'utf8'),'PRIVATE TEST MARKER');
});

test('P5.57 create-only deterministic ZIP of real verified synthetic folder (11 paths)',t=>{
 const b=build(t),z1=b.root+'.first.zip',z2=b.root+'.second.zip';
 t.after(()=>{for(const f of [z1,z2])if(fs.existsSync(f))fs.unlinkSync(f);});
 const a=exportVerifiedReviewZip(b.root,z1),c=exportVerifiedReviewZip(b.root,z2);
 assert.equal(a.status,'RAG_REVIEW_ZIP_CREATED_NOT_APPROVED');
 assert.equal(a.files,11);assert.equal(a.sha256,c.sha256);
 assert.deepEqual(fs.readFileSync(z1),fs.readFileSync(z2));
 const data=fs.readFileSync(z1);
 assert.equal(data.readUInt32LE(0),0x04034b50);
 assert.equal(data.readUInt32LE(data.length-22),0x06054b50);
 assert.equal(data.readUInt16LE(data.length-22+10),11);
 if(process.platform!=='win32'){
  const probe=spawnSync('unzip',['-t',z1],{encoding:'utf8'});
  if(!probe.error)assert.equal(probe.status,0,probe.stdout+probe.stderr);
 }
});
test('P5.57 existing ZIP is never overwritten or removed',t=>{
 const b=build(t),dest=b.root+'.zip';
 fs.writeFileSync(dest,'KEEP ORIGINAL OWNER FILE');t.after(()=>fs.unlinkSync(dest));
 assert.throws(()=>exportVerifiedReviewZip(b.root,dest),/RAG_REVIEW_ZIP_BLOCKED/);
 assert.equal(fs.readFileSync(dest,'utf8'),'KEEP ORIGINAL OWNER FILE');
});
test('P5.57 modified review report fails closed before ZIP creation',t=>{
 const b=build(t),dest=b.root+'.zip';
 fs.appendFileSync(path.join(b.root,'sales-review.json'),'tamper');
 assert.throws(()=>exportVerifiedReviewZip(b.root,dest),/RAG_REVIEW_ZIP_BLOCKED/);
 assert.equal(fs.existsSync(dest),false);
});
test('P5.57 relative output, source-inside output and symlink parent blocked',t=>{
 const b=build(t);
 assert.throws(()=>exportVerifiedReviewZip(b.root,'relative.zip'));
 assert.throws(()=>exportVerifiedReviewZip(b.root,path.join(b.root,'review.zip')));
 if(process.platform!=='win32'){
  const parent=b.root+'-linked';
  fs.symlinkSync(path.dirname(b.root),parent,'dir');
  t.after(()=>fs.unlinkSync(parent));
  assert.throws(()=>exportVerifiedReviewZip(b.root,path.join(parent,'review.zip')));
 }
});
