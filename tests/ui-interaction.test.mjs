import test from 'node:test';
import assert from 'node:assert/strict';

class MiniElement {
  constructor(tag='div') {
    this.tagName=tag;
    this.dataset={};
    this.children=[];
    this.textContent='';
    this.value='';
    this.className='';
    this.events=new Map();
    this.classes=new Set();
    this.classList={
      add:(v)=>this.classes.add(v),
      remove:(v)=>this.classes.delete(v),
      toggle:(v,b)=>b?this.classes.add(v):this.classes.delete(v),
      contains:(v)=>this.classes.has(v)
    };
  }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(key,value){(this.attributes??={})[key]=value;}
  addEventListener(type,cb){this.events.set(type,cb);}
  querySelectorAll(selector){
    if(selector==='tr') return this.children.filter(x=>x.tagName==='tr');
    if(selector==='.doc') return this.children.filter(x=>x.className==='doc');
    return [];
  }
  scrollIntoView(){this.scrolled=true;}
  focus(){this.focused=true;}
  click(){this.events.get('click')?.();}
}
const fields=['health','projectId','revenue','orders','units','approvedDocs','documentCards','sourceRows','skuChart','askForm','question','askButton','searchButton','answerPane','citationDetail','documentViewer','smaxForm','smaxJson','smaxCsv','smaxButton','smaxResult'];
function configure({apiFailure=null,session='A'.repeat(43)}={}) {
  const elements=Object.fromEntries(fields.map(x=>[x,new MiniElement()]));
  elements.question.value='총 매출과 반품 기간';
  globalThis.document={getElementById:id=>elements[id],createElement:tag=>new MiniElement(tag),querySelectorAll:()=>[]};
  globalThis.location={hash:session?'#session='+session:'',pathname:'/',search:''};
  const replacements=[];
  globalThis.history={replaceState:(...args)=>replacements.push(args)};
  globalThis.window={matchMedia:()=>({matches:true})};
  const requests=[];
  const overview={project_id:'test-synth',schema_version:'AX_DATA_PACKAGE_V0',dataset:{orders:1,units:'1',revenue_krw:'12000',source_rows:[{file_id:'file-sales',csv_line:3,order_id:'O-001',amount_krw:'12000'}],sku_totals:[{sku:'N-01',orders:1,units:'1',revenue_krw:'12000'}]},documents:[{document_id:'doc-policy',file_id:'file-policy',source_title:'합성 환불 정책',import_status:'ACCEPTED',page_info:'TXT lines'}]};
  const answer={status:'ANSWERED',answer:'매출과 반품 기간',metric_evidence:{revenue_krw:'12000',orders:1,units:'1',row_evidence:[{file_id:'file-sales',csv_line:3,order_id:'O-001',amount_krw:'12000'}]},document_evidence:[{document_id:'doc-policy',file_id:'file-policy',line:2,quote:'반품 7일 이내'}]};
  globalThis.fetch=async(endpoint,opts={})=>{
    requests.push({endpoint,opts});
    if(apiFailure && endpoint===apiFailure.endpoint) return {ok:false,status:apiFailure.status,json:async()=>({error:apiFailure.code})};
    if(endpoint.startsWith('/api/documents?'))return {ok:true,status:200,json:async()=>({
      status:'VERIFIED_SOURCE_LINES',document_id:'doc-policy',file_id:'file-policy',
      source_title:'합성 환불 정책',start:1,total_lines:2,
      lines:[{line:1,text:'합성 안내'},{line:2,text:'반품 7일 이내'}],next_start:null
    })};
    return {ok:true,status:200,json:async()=>(endpoint==='/api/overview'?overview:answer)};
  };
  return {elements,requests,replacements};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const descendants=(root)=>[root,...root.children.flatMap(descendants)];
const buttons=(root)=>descendants(root).filter(e=>e.tagName==='button');

test('P3.2 mocked UI renders protected overview and navigates both types of evidence',async()=>{
  const {elements,requests,replacements}=configure();
  await import('../ui/app.js?ui_success=1');
  assert.equal(elements.revenue.textContent,'12,000원');
  assert.equal(elements.approvedDocs.textContent,'1건');
  assert.equal(replacements.length,1);
  assert.deepEqual(requests.map(r=>r.endpoint),['/api/overview']);
  assert.equal(requests[0].opts.headers.Authorization,'Bearer '+'A'.repeat(43));
  elements.askForm.events.get('submit')({preventDefault(){}});
  await flush();
  assert.equal(requests[1].endpoint,'/api/query');
  assert.equal(requests[1].opts.headers.Authorization,'Bearer '+'A'.repeat(43));
  const resultButtons=buttons(elements.answerPane);
  assert.equal(resultButtons.length,2);
  resultButtons[0].click();
  assert.equal(elements.sourceRows.children[0].classList.contains('source-active'),true);
  assert.match(elements.citationDetail.textContent,/O-001/);
  assert.equal(elements.sourceRows.children[0].focused,true);
  resultButtons[1].click();
  assert.equal(elements.documentCards.children[0].classList.contains('source-active'),true);
  assert.equal(elements.sourceRows.children[0].classList.contains('source-active'),false);
  assert.match(elements.citationDetail.textContent,/검증 중/);
  await flush(); // Source SHA/quote check now completes before showing an actual citation.
  assert.equal(requests[2].endpoint,'/api/documents?document_id=doc-policy&start=1');
  assert.match(elements.citationDetail.textContent,/7일/);
  const sourceRows=elements.documentViewer.children[2];
  const sourceLine=sourceRows.children.find(row=>row.value===2);
  assert.equal(sourceLine.classList.contains('source-active'),true);
  assert.equal(sourceLine.focused,true);
  elements.askForm.events.get('submit')({preventDefault(){}});
  assert.equal(elements.documentCards.children[0].classList.contains('source-active'),false);
});

test('P3.2 mocked UI explains session expiry without showing an authenticated overview',async()=>{
  const {elements,requests}=configure({apiFailure:{endpoint:'/api/overview',status:401,code:'SESSION_REQUIRED'}});
  await import('../ui/app.js?ui_denied=2');
  assert.equal(requests.length,1);
  assert.equal(elements.health.textContent,'데이터 검증 실패');
  assert.match(elements.documentCards.children[0].textContent,/출처를 확인/);
});

test('P3.2 mocked UI without session does not make protected requests',async()=>{
  const {elements,requests}=configure({session:''});
  await import('../ui/app.js?ui_nosession=3');
  assert.equal(requests.length,0);
  assert.equal(elements.health.textContent,'세션 연결 필요');
});
