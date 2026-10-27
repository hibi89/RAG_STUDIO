/**
 * RAG Studio P5.13: real SMAX_PREPROCESS_GENERIC_CSV_V1 wire format
 * + its original UTF-8 CSV -> local READ-ONLY sales *preview*.
 * Zero Private SMAX source copied, zero output files, NO AX import authorization.
 * A self-reported SMAX JSON is untrusted; recompute every cell and arithmetic.
 */
import {inspectSmaxV1} from './smax-intake.mjs';

const HEADERS=['order_id','sku','quantity','unit_price_krw','amount_krw'];
const MAX_ROWS=5000,MAX_SKUS=100,MAX_SAFE=BigInt(Number.MAX_SAFE_INTEGER);
function fail(code){throw Object.assign(new Error('SMAX sales preview refused'),{code:'SMAX_SALES_'+code});}
function decodeCsv(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>2*1024*1024)fail('SOURCE_SIZE');
 try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
 catch{fail('UTF8_INVALID');}
}
/** Independent bounded RFC4180-like record reader, including quotes and multiline cells. */
function parseRecords(bytes){
 const text=decodeCsv(bytes).replace(/^\uFEFF/u,'');
 const rows=[];let row=[],field='',mode='start',lineHasContent=false;
 function addField(){row.push(field);field='';mode='start';}
 function addRow(){
   addField();if(!lineHasContent && row.every(x=>x===''))fail('EMPTY_RECORD');
   if(row.length>256)fail('TOO_MANY_COLUMNS');
   rows.push(row);if(rows.length>MAX_ROWS+1)fail('ROW_LIMIT');
   row=[];lineHasContent=false;
 }
 for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(mode==='quoted'){
     if(ch==='"'){
       if(text[i+1]==='"'){field+='"';i++;}else mode='after';
     }else field+=ch;
     continue;
   }
   if(ch===','){addField();lineHasContent=true;continue;}
   if(ch==='\n'||ch==='\r'){
     if(ch==='\r'&&text[i+1]==='\n')i++;
     addRow();continue;
   }
   if(ch==='"'){
     if(mode!=='start')fail('MALFORMED_CSV');
     mode='quoted';lineHasContent=true;continue;
   }
   if(mode==='after')fail('MALFORMED_CSV');
   mode='plain';field+=ch;lineHasContent=true;
 }
 if(mode==='quoted')fail('MALFORMED_CSV');
 if(lineHasContent||row.length||field.length||mode==='after')addRow();
 if(rows.length<2)fail('NO_DATA_ROWS');
 return {header:rows[0],records:rows.slice(1)};
}
function normalizedInteger(s,{positive=false}={}){
 if(typeof s!=='string')fail('INTEGER_INVALID');
 const t=s.trim();
 if(!/^[+-]?\d+$/u.test(t))fail('INTEGER_INVALID');
 const sign=t[0]==='-'?-1n:1n;
 const magnitude=BigInt(t.replace(/^[+-]/u,''));
 const n=sign*magnitude;
 if(n>(MAX_SAFE)||n<0n||(positive&&n===0n))fail('INTEGER_RANGE');
 return {value:n,normalized:n.toString()};
}
function refuseApprovalOnly(preflight,pkg){
 // Do NOT interpret a producer's READY_FOR_HUMAN_REVIEW as independent approval.
 if(preflight.review_rows||pkg.review_queue.length){
   return Object.freeze({contract:'rag.smax-sales-preview.v1',status:'REVIEW_HOLD',
     schema_version:pkg.schema_version,source_sha256:pkg.source.sha256,
     source_rows:preflight.source_rows,review_rows:preflight.review_rows,
     units:null,revenue_krw:null,orders:null,sku_totals:[],
     source_digest_verified:true,customer_data_approved:false,ax_package_created:false,
     importer_enabled:false,source_rights_verified:false});
 }
 return null;
}
export function previewSmaxSales(pkg,sourceBytes){
 // Existing public SMAX V1 shape, counter, SHA, row status, duplicate verification.
 const gate=inspectSmaxV1(pkg,{sourceBytes});
 if(gate.provenance!=='SOURCE_DIGEST_VERIFIED'||gate.status!=='REVIEW_REQUIRED')fail('GATE_INVALID');
 if(pkg.rows.length<1||pkg.rows.length>MAX_ROWS)fail('ROW_LIMIT');
 const {header,records}=parseRecords(sourceBytes);
 if(records.length!==pkg.rows.length||header.length!==pkg.source.headers.length||
   JSON.stringify(header)!==JSON.stringify(pkg.source.headers))fail('PROVENANCE_MISMATCH');
 if(pkg.fields.length!==HEADERS.length||
   !HEADERS.every((name,index)=>{
     const f=pkg.fields[index];
     return f.key===name&&f.source===name&&f.required===true&&
       f.type===(index<2?'text':'integer')&&header.includes(name);
   }))fail('UNSUPPORTED_MAPPING');
 const hold=refuseApprovalOnly(gate,pkg);
 if(hold)return hold;
 const offsets=HEADERS.map(name=>header.indexOf(name));
 const orders=new Set(),totals=new Map();
 let units=0n,revenue=0n;
 for(let i=0;i<records.length;i++){
   const source=records[i],row=pkg.rows[i];
   if(JSON.stringify(row.source_cells)!==JSON.stringify(source)||
      row.source_record!==i+2||row.issues.length||
      row.status!=='READY_FOR_HUMAN_REVIEW')fail('ROW_LINEAGE');
   const [oid,sku,qty,p,a]=offsets.map(k=>source[k].trim());
   if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u.test(oid)||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u.test(sku)||
      orders.has(oid))fail('IDENTIFIER_INVALID');
   orders.add(oid);
   const quantity=normalizedInteger(qty,{positive:true});
   const price=normalizedInteger(p);
   const amount=normalizedInteger(a);
   if(row.values.order_id!==oid||row.values.sku!==sku||
      row.values.quantity!==quantity.normalized||
      row.values.unit_price_krw!==price.normalized||
      row.values.amount_krw!==amount.normalized)fail('NORMALIZED_VALUES_MISMATCH');
   if(quantity.value*price.value!==amount.value)fail('AMOUNT_MISMATCH');
   const current=totals.get(sku)||{orders:0,units:0n,revenue:0n};
   current.orders++;current.units+=quantity.value;current.revenue+=amount.value;
   totals.set(sku,current);
   if(totals.size>MAX_SKUS)fail('SKU_LIMIT');
   units+=quantity.value;revenue+=amount.value;
   if(units>MAX_SAFE||revenue>MAX_SAFE)fail('TOTAL_OVERFLOW');
 }
 return Object.freeze({
   contract:'rag.smax-sales-preview.v1',status:'CALCULATED_PREVIEW_NOT_APPROVED',
   schema_version:pkg.schema_version,source_sha256:pkg.source.sha256,
   source_rows:records.length,review_rows:0,
   orders:orders.size,units:units.toString(),revenue_krw:revenue.toString(),
   sku_totals:[...totals].sort((a,b)=>a[0].localeCompare(b[0])).map(([sku,x])=>Object.freeze({
     sku,orders:x.orders,units:x.units.toString(),revenue_krw:x.revenue.toString()
   })),
   source_digest_verified:true,customer_data_approved:false,
   ax_package_created:false,importer_enabled:false,source_rights_verified:false
 });
}
