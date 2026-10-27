/* Static local UI. Treat all package-origin strings as untrusted: textContent only. */
import {resolveCitation,citationKey} from './provenance.js';
const $=(id)=>document.getElementById(id);
let currentOverview=null;
let highlighted=null;
let docRequestSequence=0;
// The secret is generated anew on server start. A URL fragment never reaches the server.
const tokenMatch=/^#session=([A-Za-z0-9_-]{43})$/.exec(location.hash);
const sessionToken=tokenMatch?.[1]??null;
if(sessionToken)history.replaceState(null,'',location.pathname+location.search);

const comma=(n)=>Number(n).toLocaleString('ko-KR');
const element=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=String(content);return e;};
function replace(parent,...children){parent.replaceChildren(...children);}
function setHealth(text,bad=false){$('health').textContent=text;$('health').classList.toggle('error',bad);}
function renderOverview(data){
  docRequestSequence++;
  if($('documentViewer'))$('documentViewer').textContent='문서를 선택하면 검증된 원문 행을 표시합니다.';
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
    if(d.import_status==='ACCEPTED'){
      const open=element('button','outline','검증된 원문 보기');
      open.type='button';
      open.addEventListener('click',()=>void openDocument(d.document_id,1));
      c.append(open);
    }
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
/** Render only manifest-selected, SHA-verified source lines. Responses never become HTML. */
async function openDocument(id,start){
  const viewer=$('documentViewer');
  if(!viewer)return;
  const request=++docRequestSequence;
  replace(viewer,element('p','placeholder','문서 원본을 다시 검증 중입니다…'));
  try{
    const data=await api('/api/documents?document_id='+encodeURIComponent(id)+'&start='+start);
    if(request!==docRequestSequence)return; // A project switch or later click superseded this response.
    if(data.status!=='VERIFIED_SOURCE_LINES'||data.document_id!==id||!Array.isArray(data.lines))
      throw new Error('INVALID_DOCUMENT_RESPONSE');
    const title=element('h3','',data.source_title);
    const note=element('p','project-hint','검증된 TXT/Markdown 원문 행 · '+data.file_id+' · 전체 '+data.total_lines+'행');
    const rows=element('ol','document-lines');
    rows.start=data.start;
    for(const line of data.lines){
      const li=element('li','',line.text||' ');
      li.value=line.line;
      rows.append(li);
    }
    const controls=element('div','document-nav');
    if(start>1){
      const previous=element('button','outline','이전 40행');
      previous.type='button';previous.addEventListener('click',()=>void openDocument(id,Math.max(1,start-40)));
      controls.append(previous);
    }
    if(data.next_start){
      const next=element('button','outline','다음 40행');
      next.type='button';next.addEventListener('click',()=>void openDocument(id,data.next_start));
      controls.append(next);
    }
    replace(viewer,title,note,rows,controls);
  }catch{
    if(request===docRequestSequence)replace(viewer,element('p','smax-warning','이 문서를 검증하거나 표시할 수 없습니다. 원본 무결성 및 세션을 확인하세요.'));
  }
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
  if(highlighted){highlighted.classList.remove('source-active');highlighted=null;}
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
// P5.15: only allowlist entries from this session's server; no path entry.
async function loadProjects(){
  const select=$('projectSelect'),button=$('projectSwitch'),status=$('projectStatus');
  if(!select||!button||!status)return;
  const list=await api('/api/projects');
  if(!Array.isArray(list.projects)||list.projects.length<1||list.projects.length>8)
    throw new Error('프로젝트 목록 형식이 올바르지 않습니다.');
  const choices=list.projects.map(item=>{
    const option=element('option','',item.project_id+' · 문서 '+item.documents+'건');
    option.value=item.project_key;
    return option;
  });
  replace(select,...choices);
  select.value=list.selected;
  select.disabled=list.projects.length<2;
  button.disabled=list.projects.length<2;
  status.textContent=list.projects.length===1
    ?'현재 실행에 등록된 로컬 프로젝트가 1개입니다.'
    :'실행 시 지정한 로컬 프로젝트 '+list.projects.length+'개 중 선택할 수 있습니다.';
  button.addEventListener('click',async()=>{
    button.disabled=true;
    status.textContent='선택한 프로젝트의 원본 파일과 계산 근거를 검증 중입니다.';
    try{
      const result=await api('/api/projects/select',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({project_key:select.value})
      });
      if(result.status!=='PROJECT_SELECTED'||!result.overview)throw new Error('PROJECT_NOT_VERIFIED');
      renderOverview(result.overview);
      if(highlighted){highlighted.classList.remove('source-active');highlighted=null;}
      replace($('answerPane'),element('p','placeholder','프로젝트가 변경되었습니다. 새로 질문해 주세요.'));
      $('citationDetail').textContent='선택한 프로젝트의 원본 근거만 사용합니다.';
      $('question').value='';
      status.textContent='프로젝트 변경 완료: '+result.overview.project_id;
    }catch{
      // Keep prior verified UI: no partial overwrite on error.
      status.textContent='프로젝트를 전환하지 못했습니다. 현재 프로젝트를 유지합니다.';
      try{const fresh=await api('/api/projects');select.value=fresh.selected;}catch{}
    }finally{button.disabled=false;}
  });
}

try{const data=await api('/api/overview');renderOverview(data);setHealth('검증된 로컬 데이터');try{await loadProjects();}catch{if($('projectStatus'))$('projectStatus').textContent='프로젝트 목록을 확인할 수 없습니다. 현재 데이터는 유지됩니다.';}}
catch(e){setHealth(sessionToken?'데이터 검증 실패':'세션 연결 필요',true);replace($('documentCards'),element('p','', '데이터 출처를 확인할 수 없습니다.'));}


/* P5.14: this preview uses only an authorized same-origin localhost request.
 * The original dashboard's approved KPI/project stay completely separate.
 */
function previewMessage(message,warning=false){
  replace($('smaxResult'),element('p',warning?'smax-warning':'placeholder',message));
}
function encodedSource(bytes){
  const parts=[];
  for(let i=0;i<bytes.length;i+=16384)
    parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
  return btoa(parts.join(''));
}
function displaySmax(result){
  const area=$('smaxResult');replace(area);
  if(result.status==='REVIEW_HOLD'){
    area.append(element('span','answer-status warn','REVIEW_HOLD · 검토 전 집계 보류'));
    area.append(element('p','','검토 대상 '+result.review_rows+'행이 있으므로 금액과 상품별 결과를 표시하지 않습니다.'));
    return;
  }
  if(result.status!=='CALCULATED_PREVIEW_NOT_APPROVED'){
    previewMessage('검증되지 않은 상태입니다. 수치를 표시하지 않습니다.',true);return;
  }
  area.append(element('span','answer-status warn','CALCULATED_PREVIEW_NOT_APPROVED · 미승인 계산 결과'));
  const grid=element('div','smax-preview-kpis');
  for(const [label,value] of [
    ['매출 합계',comma(result.revenue_krw)+'원'],
    ['주문 건수',comma(result.orders)+'건'],
    ['판매 수량',comma(result.units)+'개']
  ]){
    const metric=element('div','metric');
    metric.append(element('span','',label),element('strong','',value));
    grid.append(metric);
  }
  area.append(grid);
  area.append(element('p','','원본 CSV SHA-256 대조 완료 · 미승인 미리보기이며 기존 대시보드 수치에는 반영되지 않습니다.'));
  const wrap=element('div','table-container smax-preview-sku');
  const table=element('table');
  const caption=element('caption','','원본 대조된 상품별 임시 집계');
  const thead=element('thead'),tr=element('tr');
  for(const label of ['SKU','주문','수량','매출']){
    const th=element('th','',label);th.scope='col';tr.append(th);
  }
  thead.append(tr);
  const tbody=element('tbody');
  for(const item of result.sku_totals??[]){
    const row=element('tr');
    for(const value of [item.sku,item.orders+'건',item.units+'개',comma(item.revenue_krw)+'원'])
      row.append(element('td','',value));
    tbody.append(row);
  }
  table.append(caption,thead,tbody);wrap.append(table);area.append(wrap);
}
async function submitSmaxPreview(){
  const json=$('smaxJson').files?.[0],csv=$('smaxCsv').files?.[0];
  if(!json||!csv){previewMessage('SMAX JSON과 원본 CSV 파일 두 개가 모두 필요합니다.',true);return;}
  if(!/\.json$/i.test(json.name)||!/\.csv$/i.test(csv.name)||
    json.size<2||json.size>4*1024*1024||csv.size<1||csv.size>2*1024*1024){
    previewMessage('JSON 4MiB, CSV 2MiB 이하의 지정된 확장자만 지원합니다.',true);return;
  }
  const button=$('smaxButton');button.disabled=true;
  previewMessage('원본 해시와 매출 계산식을 검증 중입니다.');
  try{
    const [jsonBytes,csvBytes]=await Promise.all([json.arrayBuffer(),csv.arrayBuffer()]);
    if(jsonBytes.byteLength>4*1024*1024||csvBytes.byteLength>2*1024*1024)
      throw new Error('SOURCE_SIZE_LIMIT');
    const v1=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(jsonBytes));
    const result=await api('/api/smax-preview',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({v1,source_csv_base64:encodedSource(new Uint8Array(csvBytes))})
    });
    displaySmax(result);
  }catch{
    // Never echo private source cells, file names/paths or server exceptions.
    previewMessage('원본 불일치, 검토 필요, 지원하지 않는 매핑 또는 세션 오류로 검증하지 못했습니다.',true);
  }finally{button.disabled=false;}
}
$('smaxForm').addEventListener('submit',event=>{event.preventDefault();void submitSmaxPreview();});
for(const id of ['smaxJson','smaxCsv'])
  $(id).addEventListener('change',()=>previewMessage('선택한 파일이 변경됐습니다. 다시 원본을 대조하세요.'));
