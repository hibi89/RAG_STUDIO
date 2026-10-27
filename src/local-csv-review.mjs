/** P5.28 Local-only unapproved CSV inspection. No SQL import, writes or network. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const MAX_BYTES=1024*1024,MAX_ROWS=2000,MAX_COLS=64,MAX_CELL=512,MAX_LINES=12000;
function refuse(code){throw Object.assign(new Error('CSV review refused'),{code:'CSV_REVIEW_'+code});}
function sourceBytes(p){
 if(typeof p!=='string'||!path.isAbsolute(p)||path.extname(p).toLowerCase()!=='.csv')
  refuse('ABSOLUTE_CSV_REQUIRED');
 const st=fs.lstatSync(p);
 if(st.isSymbolicLink()||!st.isFile()||st.size<1||st.size>MAX_BYTES)refuse('FILE_INVALID');
 const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const before=fs.fstatSync(fd);
  if(!before.isFile()||before.size!==st.size||before.ino!==st.ino||before.dev!==st.dev)
   refuse('SOURCE_CHANGED');
  const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),current=fs.lstatSync(p);
  if(bytes.length!==st.size||after.size!==st.size||after.mtimeMs!==before.mtimeMs||
     after.ino!==before.ino||after.dev!==before.dev||
     current.isSymbolicLink()||current.ino!==before.ino||current.dev!==before.dev||
     current.size!==st.size||current.mtimeMs!==before.mtimeMs)refuse('SOURCE_CHANGED');
  return bytes;
 }finally{fs.closeSync(fd);}
}
export function parseCsvForReview(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_BYTES)refuse('SIZE');
 let str;
 try{str=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes).replace(/^\uFEFF/u,'');}
 catch{refuse('UTF8');}
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(str))refuse('CONTROL');
 const rows=[];let fields=[],cell='',state='start',line=1,start=1;
 function append(c){cell+=c;if(cell.length>MAX_CELL)refuse('CELL_LIMIT');}
 function addCell(){fields.push(cell);cell='';state='start';if(fields.length>MAX_COLS)refuse('COLUMN_LIMIT');}
 function addRow(){addCell();rows.push({cells:fields,source_line:start});if(rows.length>MAX_ROWS+1)refuse('ROW_LIMIT');fields=[];start=line+1;}
 for(let i=0;i<str.length;i++){
  const c=str[i];
  if(state==='quoted'){
   if(c==='"'){
    if(str[i+1]==='"'){append('"');i++;}else state='after';
   }else if(c==='\r'||c==='\n'){
    if(c==='\r'&&str[i+1]==='\n')i++;
    append('\n');line++;if(line>MAX_LINES)refuse('LINE_LIMIT');
   }else append(c);
   continue;
  }
  if(c==='"'){if(state!=='start')refuse('QUOTE');state='quoted';continue;}
  if(c===','){addCell();continue;}
  if(c==='\r'||c==='\n'){
   if(c==='\r'&&str[i+1]==='\n')i++;
   addRow();line++;if(line>MAX_LINES)refuse('LINE_LIMIT');
   continue;
  }
  if(state==='after')refuse('QUOTE');
  state='plain';append(c);
 }
 if(state==='quoted')refuse('QUOTE_UNCLOSED');
 if(cell.length||fields.length||state!=='start')addRow();
 if(!rows.length)refuse('EMPTY');
 return rows;
}
function kind(s){
 const v=s.trim();
 if(!v)return 'EMPTY';
 if(/^(true|false)$/iu.test(v))return 'BOOLEAN';
 if(/^-?(0|[1-9]\d*)$/u.test(v)){
  const n=BigInt(v);
  return n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=-BigInt(Number.MAX_SAFE_INTEGER)?'INTEGER':'TEXT';
 }
 if(/^-?(0|[1-9]\d*)\.\d+$/u.test(v))return Number.isFinite(Number(v))?'DECIMAL':'TEXT';
 if(/^\d{4}-\d{2}-\d{2}$/u.test(v)){
  const y=Number(v.slice(0,4)),m=Number(v.slice(5,7)),d=Number(v.slice(8));
  if(y>=1000&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate())return 'DATE';
 }
 return 'TEXT';
}
export function inspectCsvBytes(bytes){
 const rows=parseCsvForReview(bytes);
 const header=rows[0].cells.map(x=>x.trim()),examples=[],seen=new Set();
 let issues=0,shapeErrors=0,validRows=0,formula=0;
 const issue=(code,row_number,source_line,column_index=null)=>{
  issues++;
  if(examples.length<40)examples.push({code,row_number,source_line,
   ...(column_index===null?{}:{column_index})});
 };
 for(let i=0;i<header.length;i++){
  const key=header[i].normalize('NFKC').toLowerCase();
  if(!key)issue('EMPTY_HEADER',1,1,i+1);
  else if(seen.has(key))issue('DUPLICATE_HEADER',1,1,i+1);
  else seen.add(key);
  if(/^[=+@]/u.test(header[i]))issue('FORMULA_LIKE_HEADER',1,1,i+1);
 }
 const columns=header.map((name,i)=>({column_index:i+1,name,
  inferred_type:'EMPTY',nonempty:0,missing:0,
  kinds:{INTEGER:0,DECIMAL:0,BOOLEAN:0,DATE:0,TEXT:0},review_status:'NEEDS_REVIEW'}));
 for(let i=1;i<rows.length;i++){
  const rec=rows[i],rowNo=i+1;
  if(rec.cells.length!==header.length){
   shapeErrors++;issue('COLUMN_COUNT_MISMATCH',rowNo,rec.source_line);continue;
  }
  validRows++;
  rec.cells.forEach((val,j)=>{
   if(/^\s*[=+@]/u.test(val)&&val.trim()){
    formula++;issue('FORMULA_LIKE_CELL',rowNo,rec.source_line,j+1);
   }
   const t=kind(val);
   if(t==='EMPTY')columns[j].missing++;
   else{columns[j].nonempty++;columns[j].kinds[t]++;}
  });
 }
 for(const c of columns){
  const observed=Object.entries(c.kinds).filter(([,n])=>n>0).map(([t])=>t);
  if(observed.length===1)c.inferred_type=observed[0];
  else if(observed.length===2&&observed.includes('INTEGER')&&observed.includes('DECIMAL'))c.inferred_type='DECIMAL';
  else if(observed.length>1){c.inferred_type='MIXED';issue('MIXED_TYPE_COLUMN',null,null,c.column_index);}
 }
 if(rows.length===1)issue('NO_DATA_ROWS',null,null);
 return {schema:'RAG_LOCAL_CSV_REVIEW_V1',status:'NEEDS_REVIEW',
  source_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  source_size_bytes:bytes.length,row_count:rows.length-1,analyzed_rows:validRows,
  rows_with_column_mismatch:shapeErrors,formula_like_cell_count:formula,
  total_issues:issues,issue_examples:examples,issue_examples_truncated:issues>examples.length,
  columns,customer_data_approved:false,smax_native_approved:false,
  ax_package_created:false,imported_to_sqlite:false,original_modified:false,local_only:true,
  note:'Candidate types only: verify units, meanings, rights and mappings before any import'};
}
export const inspectLocalCsv=p=>inspectCsvBytes(sourceBytes(p));
