/** P5.19 experimental offline LEXICAL retrieval: BM25 + char-bigram cosine + RRF.
 * NOT neural dense embeddings / FAISS / a semantic-model ranking claim.
 */
import {loadPackage,fail} from './validate.mjs';
import {searchDocuments,segmentsFromApprovedText} from './document-search.mjs';
const MAX_RESULTS=10, K=60;
const key=x=>x.document_id+'\u0000'+x.file_id+'\u0000'+x.line;
const order=(a,b)=>a.document_id.localeCompare(b.document_id)||a.line-b.line;
function grams(s){
 const text=s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const out=new Set();
 for(let i=0;i+1<text.length;i++)out.add(text.slice(i,i+2));
 return out;
}
function cosine(q,s){
 const a=grams(q),b=grams(s);
 if(a.size<2||b.size<2)return 0;
 let shared=0;for(const x of a)if(b.has(x))shared++;
 return shared>=2?shared/Math.sqrt(a.size*b.size):0;
}
export function searchLexicalHybrid(root,question,{limit=8,documentIds=null}={}){
 if(typeof question!=='string'||!question.trim()||question.length>500)
   fail('hybrid: question must be 1..500 characters');
 if(!Number.isInteger(limit)||limit<1||limit>MAX_RESULTS)
   fail('hybrid: limit 1..10');
 const pkg=loadPackage(root);
 let allowed=null;
 if(documentIds!==null){
   if(!Array.isArray(documentIds)||documentIds.length<1||documentIds.length>8||
      new Set(documentIds).size!==documentIds.length||
      documentIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)))
      fail('hybrid: invalid document selector');
   allowed=new Set(documentIds);
   for(const id of allowed){
     const doc=pkg.manifest.documents.find(d=>d.document_id===id);
     const file=doc&&pkg.fileMap.get(doc.file_id);
     if(file?.kind!=='document'||file.import_status!=='ACCEPTED'||!/\.(?:txt|md)$/i.test(file.relative_path))
       fail('hybrid: selected document not verified');
   }
 }
 const chunks=segmentsFromApprovedText(pkg,allowed);
 const baseline=searchDocuments(root,question,{limit:MAX_RESULTS,documentIds});
 const ranked=chunks.map(c=>({...c,char_score:cosine(question,c.quote)}))
   .filter(c=>c.char_score>=0.13)
   .sort((a,b)=>b.char_score-a.char_score||order(a,b)).slice(0,MAX_RESULTS);
 const fused=new Map();
 function collect(entries,channel){
   for(let i=0;i<entries.length;i++){
     const e=entries[i],id=key(e);
     const result=fused.get(id)??{document_id:e.document_id,file_id:e.file_id,
       source_title:e.source_title,line:e.line,quote:e.quote,score:0,channels:new Set()};
     result.score+=1/(K+i+1);result.channels.add(channel);fused.set(id,result);
   }
 }
 collect(baseline.evidence??[],'bm25');
 collect(ranked,'chargram');
 const evidence=[...fused.values()].sort((a,b)=>b.score-a.score||order(a,b))
   .slice(0,limit).map(x=>({document_id:x.document_id,file_id:x.file_id,
     source_title:x.source_title,line:x.line,quote:x.quote,
     score:Number(x.score.toFixed(8)),retrieval_source:[...x.channels].sort().join('+')}));
 const search_mode='lexical_rrf_bm25_chargram_experimental';
 if(baseline.status==='POSSIBLE_CONFLICT')
   return {...baseline,search_mode}; // never turn a conflict into a confident hit
 if(/반품|환불/u.test(question)){
   const matches=[];
   for(const c of chunks){
     if(!/(?:반품|환불)/u.test(c.quote)||!/(?:신청|가능)/u.test(c.quote))continue;
     for(const m of c.quote.matchAll(/(\d{1,3})\s*일\s*이내/gu))
       matches.push({...c,period:Number(m[1])});
   }
   const values=[...new Set(matches.map(m=>m.period))];
   if(values.length>1){
     const distinct=values.map(v=>matches.find(m=>m.period===v));
     return {status:'POSSIBLE_CONFLICT',answer:null,evidence:distinct.slice(0,limit),
       search_mode,reason:'Conflicting selected verified return periods require human review'};
   }
 }
 if(!evidence.length)return {status:'NO_EVIDENCE',answer:null,evidence:[],search_mode,
    reason:'No verified lexical overlap from either ranking'};
 return {status:'FOUND',answer:'검증된 문서 어휘 유사도 검색 결과 (확정 답변 아님):\n'+
   evidence.map(e=>`[${e.document_id}:${e.line}] ${e.quote}`).join('\n'),
   evidence,search_mode,reason:null};
}
