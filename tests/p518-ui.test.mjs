import test from 'node:test';
import assert from 'node:assert/strict';
class Node {
 constructor(tag='div') {
  this.tagName=tag;this.children=[];this.dataset={};this.textContent='';
  this.className='';this.value='';this.checked=false;this.disabled=false;this.events=new Map();this.classSet=new Set();
  this.classList={add:x=>this.classSet.add(x),remove:x=>this.classSet.delete(x),
   toggle:(x,on)=>on?this.classSet.add(x):this.classSet.delete(x)};
 }
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 addEventListener(type,fn){this.events.set(type,fn);}
 setAttribute(){}querySelectorAll(){return [];}focus(){}scrollIntoView(){}
}
const ids=['document-returns','document-shipping'],keys=['a'.repeat(32),'b'.repeat(32)];
const fields=['health','projectId','revenue','orders','units','approvedDocs',
 'documentCards','sourceRows','skuChart','askForm','question','askButton','searchButton','followupButton','conversationHint',
 'answerPane','citationDetail','smaxForm','smaxJson','smaxCsv','smaxButton','smaxResult',
 'projectSelect','projectSwitch','projectStatus','documentViewer',
 'knowledgeForm','knowledgeQuestion','knowledgeSearch','knowledgeCompare','knowledgeCount','knowledgeResult'];
const overview=(name,revenue)=>({
 project_id:name,schema_version:'AX_DATA_PACKAGE_V0',
 dataset:{orders:6,units:'10',revenue_krw:revenue,source_rows:[],sku_totals:[]},
 documents:ids.map((id,i)=>({document_id:id,file_id:'file-'+i,source_title:id,
  page_info:'lines:1-4',import_status:'ACCEPTED'})),review:{items:[],summary:{}}
});
const flush=()=>new Promise(done=>setImmediate(done));
function setup({deferred=false}={}){
 const e=Object.fromEntries(fields.map(x=>[x,new Node()]));
 let selected=keys[0],release=null;
 const requests=[];
 globalThis.document={getElementById:id=>e[id],createElement:tag=>new Node(tag),querySelectorAll:()=>[]};
 globalThis.location={hash:'#session='+'A'.repeat(43),pathname:'/',search:''};
 globalThis.history={replaceState:()=>{}};
 globalThis.window={matchMedia:()=>({matches:true})};
 globalThis.fetch=async(url,options={})=>{
  requests.push({url,options});
  let body;
  if(url==='/api/overview')body=overview('one','157000');
  else if(url==='/api/projects')body={selected,projects:[
    {project_key:keys[0],project_id:'one',documents:2},
    {project_key:keys[1],project_id:'two',documents:2}]};
  else if(url==='/api/projects/select'){
    selected=keys[1];body={status:'PROJECT_SELECTED',selected,overview:overview('two','158000')};
  }else if(url==='/api/knowledge'){
    if(deferred)await new Promise(done=>{release=done;});
    body={status:'FOUND',answer:'검색된 문서 구절',evidence:[{
      document_id:ids[0],source_title:'반품',line:2,quote:'반품 신청 7일 이내'}]};
  }else body={status:'NOT_SUPPORTED'};
  return {ok:true,status:200,json:async()=>body};
 };
 return {e,requests,get release(){return release;}};
}
const pick=(e,index)=>{
 const card=e.documentCards.children[index];
 const label=card.children.find(x=>x.className==='doc-select');
 assert.ok(label,'select label exists');
 const input=label.children[0];input.checked=true;input.events.get('change')();
 return input;
};
test('P5.18 UI selects verified document and issues scoped source-only request',async()=>{
 const x=setup();const e=x.e;
 await import('../ui/app.js?p518_ui_1');
 pick(e,0);
 e.knowledgeQuestion.value='반품 신청 기간';
 e.knowledgeForm.events.get('submit')({preventDefault(){}});
 await flush();await flush();
 const req=x.requests.find(r=>r.url==='/api/knowledge');
 assert.ok(req);assert.deepEqual(JSON.parse(req.options.body),{
  action:'search',project_key:keys[0],document_ids:[ids[0]],question:'반품 신청 기간'
 });
 assert.match(e.knowledgeResult.children[0].textContent,/FOUND/);
});
test('P5.18 changing selection while request is pending discards response and restores controls',async()=>{
 const x=setup({deferred:true});const e=x.e;
 await import('../ui/app.js?p518_ui_2');
 pick(e,0);e.knowledgeQuestion.value='반품 신청 기간';
 e.knowledgeForm.events.get('submit')({preventDefault(){}});
 await flush();
 assert.equal(e.knowledgeSearch.disabled,true);
 pick(e,1);
 assert.equal(e.knowledgeSearch.disabled,false);
 assert.match(e.knowledgeResult.textContent,/변경/);
 x.release();await flush();await flush();
 assert.match(e.knowledgeResult.textContent,/변경/);
 assert.equal(e.knowledgeSearch.disabled,false);
});
test('P5.18 switching projects discards pending knowledge result and clears selected collection',async()=>{
 const x=setup({deferred:true});const e=x.e;
 await import('../ui/app.js?p518_ui_3');
 pick(e,0);e.knowledgeQuestion.value='반품 신청 기간';
 e.knowledgeForm.events.get('submit')({preventDefault(){}});
 await flush();
 e.projectSelect.value=keys[1];
 await e.projectSwitch.events.get('click')();
 assert.equal(e.revenue.textContent,'158,000원');
 assert.equal(e.knowledgeSearch.disabled,false);
 assert.equal(e.knowledgeCount.textContent,'선택된 문서 0개');
 x.release();await flush();await flush();
 assert.match(e.knowledgeResult.textContent,/다시 선택/);
});
