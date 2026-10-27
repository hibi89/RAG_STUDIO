/** P5.18: user-selected local knowledge collection over verified package documents.
 * No generated summaries, no automatic approval, no persistent collection or file writes.
 */
import {loadPackage,fail} from './validate.mjs';
import {searchDocuments} from './document-search.mjs';

const SUPPORTED= /\.(?:txt|md)$/i;
export function selectedDocuments(pkg,ids,min=1){
 if(!Array.isArray(ids)||ids.length<min||ids.length>8||
    new Set(ids).size!==ids.length||
    ids.some(x=>typeof x!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(x)))
   fail('knowledge: document selection must contain unique verified IDs (1-8)');
 return ids.map(id=>{
   const doc=pkg.manifest.documents.find(d=>d.document_id===id);
   const file=doc&&pkg.fileMap.get(doc.file_id);
   if(file?.import_status!=='ACCEPTED'||file.kind!=='document'||!SUPPORTED.test(file.relative_path)||
     typeof pkg.textMap.get(file.file_id)!=='string')
     fail('knowledge: selected document not approved or searchable');
   return {doc,file,text:pkg.textMap.get(file.file_id)};
 });
}
export function knowledgeSearch(root,ids,question){
 const pkg=loadPackage(root);selectedDocuments(pkg,ids);
 return {...searchDocuments(root,question,{limit:8,documentIds:ids}),
   scope:{mode:'SESSION_SELECTED_DOCUMENTS',document_ids:[...ids]}};
}
function policyClaims(entry){
 const lines=entry.text.replace(/\r\n/g,'\n').split('\n');
 if(lines.length>10000)fail('knowledge: document line limit');
 const claims=[];
 for(let i=0;i<lines.length;i++){
   const quote=lines[i].trim();
   if(quote.length>4096)fail('knowledge: line length limit');
   const cases=[
     ['returns',/(?:반품|환불)/u,/(?:신청|가능)/u,/(\d{1,3})\s*일\s*이내/gu,'calendar_days'],
     ['shipping',/배송\s*준비/u,/시작/u,/(\d{1,3})\s*영업일\s*이내/gu,'business_days']
   ];
   for(const [domain,subject,verb,pattern,unit] of cases){
     if(!subject.test(quote)||!verb.test(quote))continue;
     for(const match of quote.matchAll(pattern)){
       claims.push({domain,period:Number(match[1]),unit,document_id:entry.doc.document_id,
         file_id:entry.file.file_id,source_title:entry.doc.source_title,line:i+1,quote});
       if(claims.length>32)fail('knowledge: too many policy claims');
     }
   }
 }
 return claims;
}
/** Fixed domain statement matrix, not open-ended semantic comparison. */
export function knowledgeCompare(root,ids){
 const pkg=loadPackage(root),docs=selectedDocuments(pkg,ids,2);
 const claims=docs.flatMap(policyClaims);
 if(claims.length>64)fail('knowledge: comparison budget exceeded');
 const contradictions=['returns','shipping'].filter(domain=>
   new Set(claims.filter(c=>c.domain===domain).map(c=>c.period)).size>1);
 const documented=new Set(claims.map(c=>c.document_id));
 const scope={mode:'SESSION_SELECTED_DOCUMENTS',document_ids:[...ids]};
 if(contradictions.length)return {
   status:'POSSIBLE_CONFLICT',answer:null,reason:'Conflicting source claims require human review',
   conflicts:contradictions,comparison:[],review_evidence:claims,scope
 };
 if(documented.size<2)return {
   status:'INSUFFICIENT_EVIDENCE',answer:null,reason:'At least two distinct documents with supported explicit policy claims are required',
   comparison:[],review_evidence:[],scope
 };
 return {
   status:'COMPARISON_READY',
   answer:'각 문서의 명시된 정책 문구만 대조했습니다. 달력일과 영업일은 직접 크기 비교하지 않습니다.',
   comparison:claims,review_evidence:[],conflicts:[],scope
 };
}
