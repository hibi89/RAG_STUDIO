/** P2/P5.11: deterministic, zero-dependency BM25 over approved UTF-8 TXT/Markdown lines.
 * Indexed text is untrusted evidence, never instructions or executable SQL.
 */
import {loadPackage, fail} from './validate.mjs';

const STOP = new Set(['알려줘', '알려주세요', '설명해줘', '뭐야', '무엇', '어떻게', '언제', '어디', '이', '그', '좀', '에', '대해', '관련', '정책은', '규정은', 'and', 'the', 'what', 'please', 'about']);
const MAX_CHUNKS = 10000;
const MAX_LINE_CHARS = 4096;
const SUPPORTED_TEXT = /\.(?:txt|md)$/i;

/** NFKC, token per word plus Korean 2/3-grams for inflection-tolerant lexical recall. */
export function tokenize(text) {
  if (typeof text !== 'string') fail('search: text must be a string');
  const words = text.normalize('NFKC').toLowerCase().match(/[\p{Script=Hangul}]+|[a-z0-9]+/gu) ?? [];
  const terms = [];
  for (const word of words) {
    if (STOP.has(word)) continue;
    if (/^[\p{Script=Hangul}]+$/u.test(word)) {
      if (word.length < 2) continue;
      terms.push(word);
      for (const n of [2,3]) for (let i=0;i+n<=word.length;i++) terms.push(word.slice(i,i+n));
    } else if (word.length>1) terms.push(word);
  }
  return terms;
}

function segmentsFromApprovedText(pkg,allowed=null) {
  const result=[];
  for (const d of pkg.manifest.documents) {
    if(allowed!==null&&!allowed.has(d.document_id))continue;
    const file=pkg.fileMap.get(d.file_id);
    if (file?.import_status!=='ACCEPTED' || !SUPPORTED_TEXT.test(file.relative_path)) continue;
    const value=pkg.textMap.get(d.file_id);
    if(typeof value!=='string') continue;
    const lines=value.replace(/\r\n/g,'\n').split('\n');
    for(let i=0;i<lines.length;i++) {
      const line=lines[i].trim();
      if (!line) continue;
      if (line.length>MAX_LINE_CHARS) fail('search: document line too long');
      if (result.length>=MAX_CHUNKS) fail('search: too many document lines');
      result.push({document_id:d.document_id,file_id:d.file_id,source_title:d.source_title,line:i+1,quote:line});
    }
  }
  return result;
}

function semanticPeriodConflict(question,evidence) {
  if (!/반품|환불/.test(question)) return false;
  const periods=new Map();
  for(const e of evidence) {
    if(!/반품|환불/.test(e.quote)) continue;
    const match=e.quote.match(/(\d{1,3})\s*일\s*이내/);
    if(match) periods.set(e.document_id,Number(match[1]));
  }
  return new Set(periods.values()).size>1;
}

/** Every citation points to an approved, SHA-verified package file and one-based line. */
export function searchDocuments(root,question,{limit=5,documentIds=null}={}) {
  if(typeof question!=='string' || !question.trim() || question.length>500) fail('search: question must be 1..500 characters');
  if(!Number.isInteger(limit)||limit<1||limit>10) fail('search: limit must be 1..10');
  const pkg=loadPackage(root);
  let allowed=null;
  if(documentIds!==null){
    if(!Array.isArray(documentIds)||documentIds.length<1||documentIds.length>8||
      new Set(documentIds).size!==documentIds.length||
      documentIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)))
      fail('search: invalid document selection');
    allowed=new Set(documentIds);
    for(const id of allowed){
      const item=pkg.manifest.documents.find(d=>d.document_id===id);
      const file=item&&pkg.fileMap.get(item.file_id);
      if(file?.import_status!=='ACCEPTED'||!(/\.(txt|md)$/i).test(file.relative_path))
        fail('search: unverified document selection');
    }
  }
  const chunks=segmentsFromApprovedText(pkg,allowed);
  const queryTerms=[...new Set(tokenize(question))].slice(0,120);
  if(!queryTerms.length||!chunks.length) return {status:'NO_EVIDENCE',answer:null,evidence:[],reason:'No searchable approved TXT/Markdown terms'};
  const tf=chunks.map(c=>{
    const map=new Map();const ts=tokenize(c.quote);
    for(const t of ts) map.set(t,(map.get(t)||0)+1);
    return {map,length:ts.length};
  });
  const avg=tf.reduce((a,b)=>a+b.length,0)/chunks.length || 1;
  const n=chunks.length;
  const df=new Map();
  for(const {map} of tf) for(const term of map.keys()) df.set(term,(df.get(term)||0)+1);
  const scores=tf.map(({map,length})=>{
    let score=0;
    for(const term of queryTerms) {
      const freq=map.get(term)||0;
      if(!freq) continue;
      const inverse=Math.log(1+(n-(df.get(term)||0)+0.5)/((df.get(term)||0)+0.5));
      score+=inverse * (freq*2.2)/(freq+1.2*(0.25+0.75*length/avg));
    }
    return score;
  });
  const evidence=chunks.map((c,i)=>({...c,score:scores[i],_index:i})).filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score || a.document_id.localeCompare(b.document_id) || a.line-b.line)
    .slice(0,limit).map(({_index,score,...c})=>({...c,score:Number(score.toFixed(6))}));
  if(!evidence.length) return {status:'NO_EVIDENCE',answer:null,evidence:[],reason:'No keyword overlap in approved documents'};
  if(semanticPeriodConflict(question,evidence)) return {status:'POSSIBLE_CONFLICT',answer:null,evidence,reason:'Different return periods found; requires human review'};
  return {status:'FOUND',answer:'검색된 문서 발췌(자동 작성된 확정 답변이 아님):\n'+evidence.map(e=>`[${e.document_id}:${e.line}] ${e.quote}`).join('\n'),evidence,search_mode:'bm25_line_ngrams',reason:null};
}
