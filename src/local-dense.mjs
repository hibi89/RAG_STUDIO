/** P5.22 opt-in, source-verifying local dense retrieval.
 * Retrieval math is runnable with an injected embedding interface. Actual multilingual
 * semantics require operator-provisioned audited local ONNX weights and inference runtime.
 * This module never downloads weights, executes SQL, writes source files, or loads a model.
 */
import {loadPackage,fail} from './validate.mjs';
import {segmentsFromApprovedText,searchDocuments} from './document-search.mjs';

export const DIMENSION=384;
export const MAX_DENSE_LINES=768;

function vector(raw,description){
  const value=ArrayBuffer.isView(raw)?Array.from(raw):raw;
  if(!Array.isArray(value)||value.length!==DIMENSION||value.some(v=>typeof v!=='number'||!Number.isFinite(v)))
    fail('dense: invalid '+description+' vector');
  const magnitude=Math.hypot(...value);
  if(!Number.isFinite(magnitude)||magnitude<1e-12)fail('dense: empty '+description+' vector');
  return Float32Array.from(value,v=>v/magnitude);
}
const cosine=(x,y)=>x.reduce((sum,item,i)=>sum+item*y[i],0);
function verifySelection(pkg,ids){
  if(ids===null)return null;
  if(!Array.isArray(ids)||ids.length<1||ids.length>8||
    new Set(ids).size!==ids.length||
    ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)))
    fail('dense: invalid document selection');
  const allowed=new Set(ids);
  for(const id of allowed){
    const doc=pkg.manifest.documents.find(d=>d.document_id===id);
    const item=doc&&pkg.fileMap.get(doc.file_id);
    if(!item||item.kind!=='document'||item.import_status!=='ACCEPTED'||
       !/\.(?:txt|md)$/i.test(item.relative_path)||
       typeof pkg.textMap.get(doc.file_id)!=='string')
       fail('dense: source missing or not approved');
  }
  return allowed;
}
export async function searchLocalDense(root,question,{
  embedder,limit=5,documentIds=null,mode='dense'
}={}){
 if(typeof question!=='string'||!question.trim()||question.length>500)
   fail('dense: question must be 1..500 characters');
 if(!Number.isInteger(limit)||limit<1||limit>10)fail('dense: limit 1..10');
 if(!['dense','dense_rrf'].includes(mode))fail('dense: unsupported mode');
 if(typeof embedder!=='function')fail('dense: local embedding function required');
 const pkg=loadPackage(root); // All accepted files verified against package hashes every time.
 const allowed=verifySelection(pkg,documentIds);
 const sources=segmentsFromApprovedText(pkg,allowed);
 if(sources.length>MAX_DENSE_LINES)fail('dense: source line budget exceeded');
 if(!sources.length)return {status:'NO_EVIDENCE',answer:null,evidence:[],search_mode:mode};
 // No cache or persistence: dynamically created embeddings are kept in memory only.
 const query=vector(await embedder('query: '+question),'query');
 const ranked=[];
 for(const c of sources){
   const embedding=vector(await embedder('passage: '+c.quote),'passage');
   const similarity=cosine(query,embedding);
   ranked.push({...c,similarity});
 }
 ranked.sort((a,b)=>b.similarity-a.similarity||
   a.document_id.localeCompare(b.document_id)||a.line-b.line);
 let evidence;
 if(mode==='dense'){
   evidence=ranked.slice(0,limit).map(({similarity,...c})=>({...c,
      score:Number(similarity.toFixed(7)),retrieval_source:'local_dense'}));
 }else{
   const baseline=searchDocuments(root,question,{limit:10,documentIds});
   if(baseline.status==='POSSIBLE_CONFLICT')return {...baseline,search_mode:'local_dense_rrf_experimental'};
   const all=new Map(),id=c=>c.document_id+'\0'+c.line;
   for(const [channel,items] of [['dense',ranked.slice(0,10)],['bm25',baseline.evidence??[]]]){
     for(const [i,c] of items.entries()){
       const k=id(c),entry=all.get(k)??{document_id:c.document_id,
         file_id:c.file_id,source_title:c.source_title,line:c.line,quote:c.quote,
         score:0,channels:new Set()};
       entry.score+=1/(60+i+1);entry.channels.add(channel);
       all.set(k,entry);
     }
   }
   evidence=[...all.values()].sort((a,b)=>b.score-a.score||
       a.document_id.localeCompare(b.document_id)||a.line-b.line)
     .slice(0,limit).map(c=>({document_id:c.document_id,file_id:c.file_id,
       source_title:c.source_title,line:c.line,quote:c.quote,
       score:Number(c.score.toFixed(8)),retrieval_source:[...c.channels].sort().join('+')}));
 }
 // An uncalibrated embedding similarity is never a justified factual answer.
 return {status:'CANDIDATES_ONLY',answer:null,evidence,
   reason:'Local model similarity is uncalibrated: inspect citations, never treat as a verified answer',
   search_mode:mode==='dense'?'local_dense_experimental':'local_dense_rrf_experimental'};
}
export function fallbackToBM25(root,question,{documentIds=null,limit=5,reason='LOCAL_MODEL_UNAVAILABLE'}={}){
 // Explicitly advertise fallback, never pretend an unavailable model performed Dense search.
 if(!['LOCAL_MODEL_UNAVAILABLE','MODEL_INTEGRITY_FAILED','RUNTIME_UNAVAILABLE',
       'INFERENCE_FAILED','PREFLIGHT_FAILED'].includes(reason))
    fail('dense: invalid fallback reason');
 const search=searchDocuments(root,question,{documentIds,limit});
 return {...search,fallback:{requested:'local_dense_experimental',actual:'bm25_line_ngrams',reason}};
}
