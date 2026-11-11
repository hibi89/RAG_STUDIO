/** P5.49: read-only, source-cited preview of explicitly mapped local sales CSV.
 * This is never an AX import, a SMAX producer, an approval, or a customer release.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectCsvBytes,parseCsvForReview} from './local-csv-review.mjs';
import {verifyLocalOwnerMapping} from './prep-owner-verify.mjs';

const MAX_BYTES=1024*1024;
const SHA=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FIELDS=Object.freeze(['order_id','sku','quantity','unit_price_krw','amount_krw']);
const MAX_SAFE=BigInt(Number.MAX_SAFE_INTEGER);
const fail=()=>{throw Object.assign(new Error('RAG_PREP_SALES_PREVIEW_BLOCKED'),{code:'RAG_PREP_SALES_PREVIEW_BLOCKED'});};
function openPinnedCsv(name, expectedSha, expectedSize){
 if(typeof name!=='string'||!path.isAbsolute(name)||path.extname(name).toLowerCase()!=='.csv')fail();
 let fd;
 try{
  const before=fs.lstatSync(name);
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size<1||before.size>MAX_BYTES||before.size!==expectedSize)fail();
  fd=fs.openSync(name,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  const opened=fs.fstatSync(fd);
  if(!opened.isFile()||opened.nlink!==1||opened.size!==before.size||opened.ino!==before.ino||opened.dev!==before.dev||opened.mtimeMs!==before.mtimeMs)fail();
  const bytes=fs.readFileSync(fd);
  const after=fs.fstatSync(fd),now=fs.lstatSync(name);
  if(bytes.length!==opened.size||after.size!==opened.size||after.ino!==opened.ino||after.dev!==opened.dev||after.mtimeMs!==opened.mtimeMs||
     now.isSymbolicLink()||!now.isFile()||now.nlink!==1||now.size!==opened.size||now.ino!==opened.ino||now.dev!==opened.dev||now.mtimeMs!==opened.mtimeMs||SHA(bytes)!==expectedSha)fail();
  return bytes;
 }catch{fail();}
 finally{if(fd!==undefined)fs.closeSync(fd);}
}
function uint(s,nonzero=false){
 if(typeof s!=='string'||! /^(0|[1-9][0-9]*)$/u.test(s))fail();
 const n=BigInt(s);
 if(n>MAX_SAFE||(nonzero&&n===0n))fail();
 return n;
}
export function calculatePinnedSalesPreview(plan, bytes){
 if(!plan||plan.status!=='REVIEW_HOLD'||plan.approval!=='NOT_GRANTED'||
   plan.owner_draft_rechecked!==true||plan.ax_package_created!==false||plan.sqlite_imported!==false||
   !Buffer.isBuffer(bytes)||SHA(bytes)!==plan.source_sha256||bytes.length!==plan.source_size_bytes)fail();
 const review=inspectCsvBytes(bytes);
 if(review.source_sha256!==plan.source_sha256||review.row_count!==plan.source_rows||
    review.total_issues!==0||review.formula_like_cell_count!==0||review.rows_with_column_mismatch!==0)fail();
 const mappings=plan.requested_mapping;
 if(!Array.isArray(mappings)||mappings.length!==5||new Set(mappings.map(x=>x.key)).size!==5)fail();
 const byKey=new Map(mappings.map(x=>[x.key,x]));
 if(FIELDS.some(key=>!byKey.has(key)))fail();
 for(const k of FIELDS){
   const map=byKey.get(k);
   if(!map.required||map.approval!=='NOT_GRANTED'||map.type_review_required||
      map.type!==(k==='order_id'||k==='sku'?'text':'integer')||!Number.isInteger(map.column_index)||
      map.column_index<1||map.column_index>review.columns.length||
      review.columns[map.column_index-1].name!==map.source)fail();
 }
 const rows=parseCsvForReview(bytes);
 if(rows.length-1!==review.row_count||rows.length<2)fail();
 const seen=new Set(),sku=new Map();
 let unitTotal=0n,revenueTotal=0n;
 const evidence=[];
 const index=k=>byKey.get(k).column_index-1;
 for(const row of rows.slice(1)){
  if(row.cells.length!==review.columns.length)fail();
  const orderId=row.cells[index('order_id')], product=row.cells[index('sku')];
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u.test(orderId)||seen.has(orderId)||
     !/^[A-Z0-9][A-Z0-9-]{0,39}$/u.test(product))fail();
  seen.add(orderId);
  const q=uint(row.cells[index('quantity')],true),p=uint(row.cells[index('unit_price_krw')],true),amt=uint(row.cells[index('amount_krw')],true);
  if(q*p!==amt||amt>MAX_SAFE)fail();
  unitTotal+=q;revenueTotal+=amt;
  if(unitTotal>MAX_SAFE||revenueTotal>MAX_SAFE)fail();
  const stat=sku.get(product)||{orders:0,units:0n,revenue:0n};
  stat.orders++;stat.units+=q;stat.revenue+=amt;sku.set(product,stat);
  if(sku.size>100)fail();
  if(evidence.length<40)evidence.push(Object.freeze({source_line:row.source_line,sku:product,
      quantity:String(q),amount_krw:String(amt)}));
 }
 const skuTotals=[...sku.entries()].sort((a,b)=>a[0].localeCompare(b[0],'en')).map(([product,s])=>
    Object.freeze({sku:product,orders:s.orders,units:String(s.units),revenue_krw:String(s.revenue)}));
 if(skuTotals.reduce((a,x)=>a+BigInt(x.revenue_krw),0n)!==revenueTotal||
    skuTotals.reduce((a,x)=>a+x.orders,0)!==rows.length-1)fail();
 return Object.freeze({contract:'RAG_PREP_SALES_PREVIEW_V1',status:'REVIEW_HOLD',
   source_sha256:plan.source_sha256,source_size_bytes:bytes.length,source_rows:rows.length-1,
   mapped_fields:Object.freeze([...FIELDS]),metric_status:'PROVISIONAL_UNAPPROVED',
   metrics:Object.freeze({orders:rows.length-1,units:String(unitTotal),revenue_krw:String(revenueTotal)}),
   sku_totals:Object.freeze(skuTotals),source_evidence:Object.freeze(evidence),
   evidence_truncated:rows.length-1>evidence.length,
   blockers:Object.freeze([...new Set([...plan.blockers,'SALES_PREVIEW_NOT_AN_AUTHORIZED_IMPORT'])]),
   source_rights_verified:false,customer_data_approved:false,smax_native_approved:false,
   ax_package_created:false,sqlite_imported:false,document_indexed:false,remote_upload:false,
   source_modified:false});
}
export function previewLocalMappedSales(csvPath,draftPath){
 const plan=verifyLocalOwnerMapping(csvPath,draftPath);
 return calculatePinnedSalesPreview(plan,openPinnedCsv(csvPath,plan.source_sha256,plan.source_size_bytes));
}
