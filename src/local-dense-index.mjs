/** P5.26 opt-in reusable local Dense index (synthetic benchmark & developer CLI).
 * Precomputes bounded passage embeddings ONCE in RAM while re-verifying every
 * accepted source's SHA before/after each query. Never writes, downloads,
 * executes source text, serves customer data, or promotes candidates to answers.
 */
import crypto from 'node:crypto';
import {loadPackage,fail} from './validate.mjs';
import {segmentsFromApprovedText} from './document-search.mjs';
import {DIMENSION,MAX_DENSE_LINES} from './local-dense.mjs';

function normalise(value,label){
 const values=ArrayBuffer.isView(value)?Array.from(value):value;
 if(!Array.isArray(values)||values.length!==DIMENSION||
    values.some(x=>typeof x!=='number'||!Number.isFinite(x)))
   fail('dense index: invalid '+label+' vector');
 const mag=Math.hypot(...values);
 if(!Number.isFinite(mag)||mag<1e-12)fail('dense index: zero '+label+' vector');
 return Float32Array.from(values,x=>x/mag);
}
function selectedDocs(pkg,ids){
 if(ids===null)return null;
 if(!Array.isArray(ids)||ids.length<1||ids.length>8||
    new Set(ids).size!==ids.length||
    ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)))
   fail('dense index: document selection invalid');
 const selection=new Set(ids);
 for(const id of ids){
   const doc=pkg.manifest.documents.find(d=>d.document_id===id);
   const file=doc&&pkg.fileMap.get(doc.file_id);
   if(!file||file.kind!=='document'||file.import_status!=='ACCEPTED'||
      !/\.(?:txt|md)$/i.test(file.relative_path)||
      typeof pkg.textMap.get(doc.file_id)!=='string')
     fail('dense index: source not approved');
 }
 return selection;
}
const fingerprint=(manifest,segments)=>crypto.createHash('sha256')
 .update(JSON.stringify(manifest)).update('\n').update(JSON.stringify(segments)).digest('hex');
function loadAndExtract(root,ids){
 const pkg=loadPackage(root); // SHA validates EVERY ACCEPTED source every time.
 const allowed=selectedDocs(pkg,ids);
 const segments=segmentsFromApprovedText(pkg,allowed);
 if(segments.length>MAX_DENSE_LINES)fail('dense index: too many source lines');
 return {segments,digest:fingerprint(pkg.manifest,segments)};
}
function cosine(a,b){
 let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];
 return sum;
}
export async function createVerifiedDenseIndex(root,{embedder,documentIds=null}={}){
 if(typeof embedder!=='function')fail('dense index: embedding function required');
 const {segments,digest}=loadAndExtract(root,documentIds);
 const vectors=[];
 for(const c of segments)
   vectors.push(normalise(await embedder('passage: '+c.quote),'passage'));
 // Detect changes during potentially slow initial model inference as well.
 if(loadAndExtract(root,documentIds).digest!==digest)
   fail('dense index: verified source changed during construction');
 const validate=()=>{
   if(loadAndExtract(root,documentIds).digest!==digest)
     fail('dense index: source changed since construction');
 };
 return Object.freeze({
   document_count:new Set(segments.map(x=>x.document_id)).size,
   passage_embeddings:vectors.length,
   dimension:DIMENSION,
   async search(question,{limit=3}={}){
     if(typeof question!=='string'||!question.trim()||question.length>500)
       fail('dense index: invalid question');
     if(!Number.isInteger(limit)||limit<1||limit>10)
       fail('dense index: invalid limit');
     // Both checks are mandatory: source mutation can occur during query inference.
     validate();
     if(!segments.length)return {status:'NO_EVIDENCE',answer:null,evidence:[],
        search_mode:'local_dense_index_experimental'};
     const query=normalise(await embedder('query: '+question),'query');
     validate();
     const ranked=segments.map((c,i)=>({...c,
       score:Number(cosine(query,vectors[i]).toFixed(7)),
       retrieval_source:'local_dense_index'}))
       .sort((a,b)=>b.score-a.score||
         a.document_id.localeCompare(b.document_id)||a.line-b.line);
     return {status:'CANDIDATES_ONLY',answer:null,evidence:ranked.slice(0,limit),
       search_mode:'local_dense_index_experimental',
       reason:'Uncalibrated candidates: cite verified source; no automatic factual answer'};
   }
 });
}
