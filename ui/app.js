/* Static local UI. Treat all package-origin strings as untrusted: textContent only. */
import {resolveCitation,citationKey} from './provenance.js';
const $=(id)=>document.getElementById(id);
let currentOverview=null;
let highlighted=null;
// The secret is generated anew on server start. A URL fragment never reaches the server.
const tokenMatch=/^#session=([A-Za-z0-9_-]{43})$/.exec(location.hash);
const sessionToken=tokenMatch?.[1]??null;
if(sessionToken)history.replaceState(null,'',location.pathname+location.search);

const comma=(n)=>Number(n).toLocaleString('ko-KR');
const element=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=String(content);return e;};
function replace(parent,...children){parent.replaceChildren(...children);}
function setHealth(text,bad=false){$('health').textContent=text;$('health').classList.toggle('error',bad);}
function renderOverview(data){
  currentOverview=data;
  $('projectId').textContent=`${data.project_id} · ${data.schema_version}`;
  $('revenue').textContent=`${comma(data.dataset.revenue_krw)}원`;
  $('orders').textContent=`${comma(data.dataset.orders)}건`;
  $('units').textContent=`${comma(data.dataset.units)}개`;
  $('approvedDocs').textContent=`${data.documents.filter(d=>d.import_status==='ACCEPTED').length}건`;
  const docs=data.documents.map(d=>{
    const c=element('article','doc');
    c.dataset.provenanceKey=citationKey({kind:'document',document_id:d.document_id,file_id:d.file_id});
    c.tabIndex=-1;
    c.append(element('strong','',d.source_title),element('p','',`출처: ${d.document_id} · ${d.file_id}`),element('p','',d.page_info),element('span','approved',d.import_status==='ACCEPTED'?'검증됨':'검토 필요'));
    return c;
  });
  replace($('documentCards'),...docs);
  const rows=data.dataset.source_rows.map(r=>{
    const tr=element('tr');
    tr.dataset.provenanceKey=citationKey({kind:'dataset',file_id:r.file_id,csv_line:r.csv_line,order_id:r.order_id});
    tr.tabIndex=-1;
    for(const value of [r.csv_line,r.order_id,`${comma(r.amount_krw)}원`,r.file_id])tr.append(element('td','',value));
    return tr;
  });
  replace($('sourceRows'),...rows);
  const skuRows=data.dataset.sku_totals??[];
  const maxRevenue=Math.max(1,...skuRows.map(r=>Number(r.revenue_krw)));
  const bars=skuRows.map(r=>{
    const item=element('div','sku-row');
    const head=element('div','sku-label');
    head.append(element('strong','',r.sku),element('span','',`${comma(r.revenue_krw)}원 · ${r.orders}건`));
    const bar=element('progress','sku-bar');
    bar.max=maxRevenue;
    bar.value=Number(r.revenue_krw);
    bar.setAttribute('aria-label',`${r.sku} 매출 ${comma(r.revenue_krw)}원`);
    item.append(head,bar);
    return item;
  });
  replace($('skuChart'),...bars);

}
function showCitation(item){
  if(highlighted){highlighted.classList.remove('source-active');highlighted=null;}
  const ref=resolveCitation(currentOverview,item);
  const detail=$('citationDetail');
  if(!ref){detail.textContent='검증된 출처와 일치하지 않습니다. 답변 근거를 다시 확인하세요.';return;}
  const targets=ref.kind==='dataset'?$('sourceRows').querySelectorAll('tr'):$('documentCards').querySelectorAll('.doc');
  const target=[...targets].find(node=>node.dataset.provenanceKey===citationKey(ref));
  if(!target){detail.textContent='대상 출처가 화면에 없습니다. 데이터를 다시 검증하세요.';return;}
  highlighted=target;
  target.classList.add('source-active');
  detail.textContent=ref.kind==='dataset'
    ? `CSV ${ref.file_id}, ${ref.csv_line}행 · 주문 ${ref.order_id} · ${comma(ref.amount_krw)}원 (검증된 요약 행)`
    : `문서 ${ref.source_title} · ${ref.document_id} · ${ref.line}행: ${ref.quote}`;
  target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  target.focus({preventScroll:true});
}
function addEvidence(parent,title,items){
  parent.append(element('p','evidence-title',title));
  const list=element('ul','evidence-list');
  for(const item of items){
    const li=element('li');
    const heading=item.quote??`${item.amount_krw}원 / 주문 ${item.order_id}`;
    li.append(element('strong','',heading),element('span','',`출처: ${item.document_id??item.file_id} · ${item.file_id} · ${item.line??item.csv_line}행`));
    const jump=element('button','citation-link',item.csv_line!==undefined?'CSV 원본 행 찾기':'문서 출처 찾기');
    jump.type='button';
    jump.addEventListener('click',()=>showCitation(item));
    li.append(jump);
    list.append(li);
  }
  parent.append(list);
}
function renderResult(data,mode){
  const parent=$('answerPane');replace(parent);
  $('citationDetail').textContent='출처 링크를 선택하면 검증된 위치와 인용 내용을 표시합니다.';
  const isOk=['ANSWERED','FOUND'].includes(data.status);
  parent.append(element('span',`answer-status${isOk?'':' warn'}`,`${data.status} · ${mode==='search'?'문서 검색':'통합 질의'}`));
  const body=data.answer||(data.reason?`근거 확인 필요: ${data.reason}`:'지원되지 않는 질문입니다.');
  parent.append(element('p','answer-text',body));
  if(data.metric_evidence){
    parent.append(element('p','evidence-title',`SQLite 고정 집계 · 매출 ${comma(data.metric_evidence.revenue_krw)}원 / ${data.metric_evidence.orders}건 / ${data.metric_evidence.units}개`));
    addEvidence(parent,'원본 CSV 행 근거',data.metric_evidence.row_evidence);
  }
  if(Array.isArray(data.document_evidence)&&data.document_evidence.length)addEvidence(parent,'문서 인용',data.document_evidence);
  if(Array.isArray(data.evidence)&&data.evidence.length)addEvidence(parent,'검색된 문서 구절 · 확정 답변 아님',data.evidence);
  if(Array.isArray(data.review_evidence)&&data.review_evidence.length)addEvidence(parent,'상충 문장: 확인 전 답변 보류',data.review_evidence);
}
async function api(url,options={}){
  if(!sessionToken)throw new Error('실행 창에 표시된 세션 전용 주소로 접속하세요.');
  const response=await fetch(url,{cache:'no-store',...options,headers:{...options.headers,Authorization:`Bearer ${sessionToken}`}});
  let body;try{body=await response.json();}catch{throw new Error('잘못된 서버 응답');}
  if(!response.ok){
    const message={
      SESSION_REQUIRED:'세션이 만료되었거나 올바르지 않습니다. 실행 창에서 새 전용 주소를 여세요.',
      PACKAGE_UNVERIFIED:'데이터 파일이 변경되었거나 무결성 검사에 실패했습니다. 원본 패키지를 다시 확인하세요.',
      PACKAGE_OR_QUERY_UNVERIFIED:'데이터 또는 질의를 확인할 수 없습니다. 검토 항목과 입력을 확인하세요.',
      INVALID_REQUEST:'질문 형식 또는 길이가 올바르지 않습니다.',
      FORBIDDEN_ORIGIN:'다른 웹사이트에서는 이 요청을 실행할 수 없습니다.'
    }[body.error]??`요청을 처리하지 못했습니다 (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return body;
}
async function ask(mode){
  const question=$('question').value;
  const controls=[$('askButton'),$('searchButton')];controls.forEach(b=>b.disabled=true);
  replace($('answerPane'),element('p','placeholder','근거를 검증하고 있습니다…'));
  $('citationDetail').textContent='질의 결과를 확인 중입니다.';
  try{renderResult(await api(mode==='search'?'/api/search':'/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})}),mode);}
  catch(e){replace($('answerPane'),element('p','answer-text',`결과를 표시할 수 없습니다: ${e.message}`));}
  finally{controls.forEach(b=>b.disabled=false);}
}
$('askForm').addEventListener('submit',(event)=>{event.preventDefault();void ask('query');});
$('searchButton').addEventListener('click',()=>void ask('search'));
for(const button of document.querySelectorAll('[data-question]'))button.addEventListener('click',()=>{$('question').value=button.dataset.question;$('question').focus();});
try{const data=await api('/api/overview');renderOverview(data);setHealth('검증된 로컬 데이터');}
catch(e){setHealth(sessionToken?'데이터 검증 실패':'세션 연결 필요',true);replace($('documentCards'),element('p','', '데이터 출처를 확인할 수 없습니다.'));}
