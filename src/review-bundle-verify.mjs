/** P5.53 review-only portable package integrity check (not a signature or approval). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const EXPECTED=Object.freeze(['ui/prep-owner.html','ui/prep-owner.js','ui/prep-owner.css',
 'src/prep-owner-local-server.mjs','src/prep-owner-serve-cli.mjs','src/review-bundle-verify.mjs',
 'sales-review.json','mixed-review.json','RUN_LOCAL_REVIEW_WINDOWS.cmd','RUN_LOCAL_REVIEW_UNIX.sh']);
const fail=()=>{throw Object.assign(new Error('RAG_REVIEW_BUNDLE_INVALID'),{code:'RAG_REVIEW_BUNDLE_INVALID'});};
function checkedRoot(root){
 if(typeof root!=='string'||!path.isAbsolute(root))fail();
 const st=fs.lstatSync(root);if(st.isSymbolicLink()||!st.isDirectory())fail();
 return root;
}
// P5.56: SHA manifests are not signatures. This only rejects contradictory
// claims inside a local, unapproved review bundle; it cannot authenticate the
// owner, source producer or rights to underlying customer data.
const numeric=(value,{zero=false}={})=>{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/u.test(value))fail();
 const v=BigInt(value);
 if(v>BigInt(Number.MAX_SAFE_INTEGER)||(!zero&&v===0n))fail();
 return v;
};
const safeCount=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function validateReviewConsistency(manifest,sales,mixed){
 if(!manifest||!sales||!mixed||sales.contract!=='RAG_PREP_SALES_PREVIEW_V1'||
    sales.status!=='REVIEW_HOLD'||mixed.contract!=='RAG_PREP_MIXED_PREVIEW_V1'||
    mixed.approval!=='NOT_GRANTED'||mixed.answer!==null||
    !['PREVIEW_WITH_CITATIONS','POSSIBLE_CONFLICT','INSUFFICIENT_DOCUMENT_EVIDENCE'].includes(mixed.status)||
    !hex64(manifest.source_sha256)||sales.source_sha256!==manifest.source_sha256||
    mixed.source_sha256!==manifest.source_sha256||
    !safeCount(sales.source_rows,100000)||sales.source_rows===0||
    mixed.source_rows!==sales.source_rows||
    !safeCount(sales.source_size_bytes,1048576)||sales.source_size_bytes===0||
    !sales.metrics||!mixed.metric_evidence||!mixed.metric_evidence.metrics||
    !safeCount(sales.metrics.orders,100000)||sales.metrics.orders!==sales.source_rows||
    JSON.stringify(sales.metrics)!==JSON.stringify(mixed.metric_evidence.metrics))fail();
 const units=numeric(sales.metrics.units),revenue=numeric(sales.metrics.revenue_krw);
 if(!Array.isArray(sales.sku_totals)||sales.sku_totals.length===0||sales.sku_totals.length>100||
    !Array.isArray(sales.source_evidence)||sales.source_evidence.length===0||sales.source_evidence.length>40||
    !Array.isArray(mixed.metric_evidence.source_lines)||
    JSON.stringify(sales.source_evidence)!==JSON.stringify(mixed.metric_evidence.source_lines)||
    sales.evidence_truncated!==(sales.source_rows>40)||
    mixed.metric_evidence.source_evidence_truncated!==sales.evidence_truncated||
    sales.source_evidence.length!==Math.min(sales.source_rows,40))fail();
 let orders=0,skuUnits=0n,skuRevenue=0n;
 const seenSkus=new Set();
 for(const sku of sales.sku_totals){
  if(!sku||typeof sku.sku!=='string'||!/^[A-Z0-9][A-Z0-9-]{0,39}$/u.test(sku.sku)||
     seenSkus.has(sku.sku)||!safeCount(sku.orders,100000)||sku.orders===0)fail();
  seenSkus.add(sku.sku);
  orders+=sku.orders;skuUnits+=numeric(sku.units);skuRevenue+=numeric(sku.revenue_krw);
 }
 if(orders!==sales.source_rows||skuUnits!==units||skuRevenue!==revenue)fail();
 let previous=0;
 for(const row of sales.source_evidence){
  if(!row||!safeCount(row.source_line,100001)||row.source_line<=previous||
    !seenSkus.has(row.sku)||numeric(row.quantity)<=0n||numeric(row.amount_krw)<=0n)fail();
  previous=row.source_line;
 }
 if(!mixed.document_evidence||!hex64(mixed.document_evidence.sha256)||
    !safeCount(mixed.document_evidence.size_bytes,256*1024)||
    mixed.document_evidence.size_bytes===0||
    !Array.isArray(mixed.document_evidence.source_lines)||
    mixed.document_evidence.source_lines.length>10||
    mixed.document_evidence.source_evidence_truncated!==(mixed.document_evidence.source_lines.length===10))fail();
 let docPrevious=0;
 for(const source of mixed.document_evidence.source_lines){
  if(!source||!safeCount(source.source_line,500)||source.source_line<=docPrevious||
     typeof source.quote!=='string'||!source.quote.trim()||source.quote.length>1024||
     source.kind!=='UNAPPROVED_SOURCE_EXCERPT')fail();
  docPrevious=source.source_line;
 }
 if(mixed.status==='INSUFFICIENT_DOCUMENT_EVIDENCE'&&mixed.document_evidence.source_lines.length!==0)fail();
 if(mixed.status!=='INSUFFICIENT_DOCUMENT_EVIDENCE'&&mixed.document_evidence.source_lines.length===0)fail();
 for(const record of [sales,mixed]){
  if(record.ax_package_created!==false||record.sqlite_imported!==false||
     record.remote_upload!==false||record.source_modified!==false||
     record.customer_data_approved!==false||record.source_rights_verified!==false||
     record.smax_native_approved!==false)fail();
 }
 if(mixed.document_indexed!==false)fail();
 return true;
}

export function verifyReviewBundle(root){
 try{
  checkedRoot(root);
  const folders=['src','ui'];
  for(const folder of folders){const st=fs.lstatSync(path.join(root,folder));if(!st.isDirectory()||st.isSymbolicLink())fail();}
  const manifestPath=path.join(root,'manifest.json');const st=fs.lstatSync(manifestPath);
  if(!st.isFile()||st.isSymbolicLink()||st.size>32768||st.size<2)fail();
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(!manifest||manifest.contract!=='RAG_PREP_REVIEW_BUNDLE_V1'||manifest.status!=='REVIEW_HOLD'||
     manifest.approval!=='NOT_GRANTED'||manifest.ax_package_created!==false||manifest.sqlite_imported!==false||
     manifest.remote_upload!==false||!/^[a-f0-9]{64}$/u.test(manifest.source_sha256)||
     !Array.isArray(manifest.files)||manifest.files.length!==EXPECTED.length)fail();
  if(JSON.stringify(manifest.files.map(x=>x.relative_path).sort())!==JSON.stringify([...EXPECTED].sort()))fail();
  for(const f of manifest.files){
   if(!f||typeof f.relative_path!=='string'||!/^[a-f0-9]{64}$/u.test(f.sha256)||
      !Number.isSafeInteger(f.size_bytes)||f.size_bytes<1||f.size_bytes>300000)fail();
   const pathName=path.join(root,f.relative_path),leaf=fs.lstatSync(pathName);
   if(!leaf.isFile()||leaf.isSymbolicLink()||leaf.nlink!==1||leaf.size!==f.size_bytes)fail();
   const bytes=fs.readFileSync(pathName);
   if(bytes.length!==f.size_bytes||SHA(bytes)!==f.sha256)fail();
  }
  const sales=JSON.parse(fs.readFileSync(path.join(root,'sales-review.json'),'utf8'));
  const mixed=JSON.parse(fs.readFileSync(path.join(root,'mixed-review.json'),'utf8'));
  if(sales.contract!=='RAG_PREP_SALES_PREVIEW_V1'||sales.status!=='REVIEW_HOLD'||
     mixed.contract!=='RAG_PREP_MIXED_PREVIEW_V1'||mixed.approval!=='NOT_GRANTED'||
     mixed.answer!==null||sales.source_sha256!==manifest.source_sha256||
     mixed.source_sha256!==manifest.source_sha256||sales.ax_package_created!==false||
     mixed.ax_package_created!==false||sales.sqlite_imported!==false||mixed.sqlite_imported!==false)fail();
  validateReviewConsistency(manifest,sales,mixed);
  // Whitelist every bundled path, including exact directories. Unexpected files are rejected.
  const children=fs.readdirSync(root).sort();
  if(JSON.stringify(children)!==JSON.stringify(['RUN_LOCAL_REVIEW_UNIX.sh','RUN_LOCAL_REVIEW_WINDOWS.cmd','manifest.json','mixed-review.json','sales-review.json','src','ui'].sort()))fail();
  if(JSON.stringify(fs.readdirSync(path.join(root,'src')).sort())!==JSON.stringify(['prep-owner-local-server.mjs','prep-owner-serve-cli.mjs','review-bundle-verify.mjs'].sort()))fail();
  if(JSON.stringify(fs.readdirSync(path.join(root,'ui')).sort())!==JSON.stringify(['prep-owner.html','prep-owner.js','prep-owner.css'].sort()))fail();
  return Object.freeze({status:'RAG_REVIEW_BUNDLE_INTEGRITY_PASS',contract:manifest.contract,
   source_sha256:manifest.source_sha256,files:manifest.files.length,
   approval:'NOT_GRANTED',customer_data_approved:false,ax_package_created:false});
 }catch{fail();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==2)fail();const root=fileURLToPath(new URL('../',import.meta.url));
   process.stdout.write(JSON.stringify(verifyReviewBundle(root))+'\n');}
 catch{process.stderr.write('RAG_REVIEW_BUNDLE_INVALID\n');process.exitCode=1;}
}
