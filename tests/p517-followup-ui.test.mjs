import test from 'node:test';
import assert from 'node:assert/strict';
class Node{
 constructor(tag='div'){
  this.tagName=tag;this.children=[];this.dataset={};this.textContent='';this.className='';
  this.value='';this.disabled=false;this.events=new Map();this.classSet=new Set();
  this.classList={add:x=>this.classSet.add(x),remove:x=>this.classSet.delete(x),
   toggle:(x,on)=>on?this.classSet.add(x):this.classSet.delete(x)};
 }
 append(...v){this.children.push(...v);}
 replaceChildren(...v){this.children=v;}
 addEventListener(name,fn){this.events.set(name,fn);}
 setAttribute(){}querySelectorAll(){return [];}focus(){}scrollIntoView(){}
}
const fields=['health','projectId','revenue','orders','units','approvedDocs','documentCards',
 'sourceRows','skuChart','askForm','question','askButton','searchButton','followupButton','conversationHint',
 'answerPane','citationDetail','smaxForm','smaxJson','smaxCsv','smaxButton','smaxResult',
 'projectSelect','projectSwitch','projectStatus','documentViewer'];
const ids={one:'a'.repeat(32),two:'b'.repeat(32)};
const overview=(project,revenue)=>({status:'VERIFIED_SYNTHETIC_PACKAGE',project_id:project,
 schema_version:'AX_DATA_PACKAGE_V0',dataset:{orders:6,units:'10',revenue_krw:revenue,source_rows:[],sku_totals:[]},
 documents:[],review:{items:[],summary:{}}});
const answer={status:'ANSWERED',answer:'반품 신청 기간: 7일 이내',requested:{sales:false,returns:true,shipping:false},
 metric_evidence:null,document_evidence:[]};
const flush=()=>new Promise(done=>setImmediate(done));
function setup({deferredQuery=false}={}){
 const elements=Object.fromEntries(fields.map(k=>[k,new Node()]));
 let selected=ids.one, resolveQuery=null;
 const requests=[];
 globalThis.document={getElementById:id=>elements[id],createElement:tag=>new Node(tag),querySelectorAll:()=>[]};
 globalThis.location={hash:'#session='+'A'.repeat(43),pathname:'/',search:''};
 globalThis.history={replaceState:()=>{}};
 globalThis.window={matchMedia:()=>({matches:true})};
 globalThis.fetch=async(url,opts={})=>{
  requests.push({url,opts});let data;
  if(url==='/api/overview')data=overview('one','157000');
  else if(url==='/api/projects')data={selected,projects:[
    {project_key:ids.one,project_id:'one',documents:2},
    {project_key:ids.two,project_id:'two',documents:2}]};
  else if(url==='/api/query'){
    if(deferredQuery)await new Promise(done=>{resolveQuery=done;});
    data=answer;
  }
  else if(url==='/api/conversation')data={...answer,conversation:{mode:'SOURCE_RECHECKED_FOLLOWUP',resolved_question:'반품 신청 기간은?'}};
  else if(url==='/api/projects/select'){
    selected=ids.two;data={status:'PROJECT_SELECTED',selected,overview:overview('two','158000')};
  } else data={status:'NOT_SUPPORTED'};
  return {ok:true,status:200,json:async()=>data};
 };
 return {elements,requests,get resolveQuery(){return resolveQuery;}};
}
test('P5.17 UI first cited answer enables explicit follow-up with current project key',async()=>{
 const ctx=setup();const e=ctx.elements;
 await import('../ui/app.js?p517_ui_1');
 assert.equal(e.followupButton.disabled,true);
 e.question.value='반품 기간은?';
 e.askForm.events.get('submit')({preventDefault(){}});
 await flush();await flush();
 assert.equal(e.followupButton.disabled,false);
 e.question.value='그건 며칠이야?';
 e.followupButton.events.get('click')();
 await flush();await flush();
 const request=ctx.requests.find(x=>x.url==='/api/conversation');
 assert.ok(request);
 assert.deepEqual(JSON.parse(request.opts.body),{
  question:'그건 며칠이야?',previous_question:'반품 기간은?',project_key:ids.one
 });
 assert.match(e.answerPane.children[0].textContent,/ANSWERED/);
});
test('P5.17 UI selecting another project clears context but keeps question controls enabled',async()=>{
 const ctx=setup();const e=ctx.elements;
 await import('../ui/app.js?p517_ui_2');
 e.question.value='반품 기간은?';e.askForm.events.get('submit')({preventDefault(){}});
 await flush();await flush();assert.equal(e.followupButton.disabled,false);
 e.projectSelect.value=ids.two;
 await e.projectSwitch.events.get('click')();
 assert.equal(e.followupButton.disabled,true);
 assert.equal(e.askButton.disabled,false);
 assert.equal(e.searchButton.disabled,false);
 assert.equal(e.revenue.textContent,'158,000원');
});
test('P5.17 late old-project response cannot overwrite switched overview or disable controls',async()=>{
 const ctx=setup({deferredQuery:true});const e=ctx.elements;
 await import('../ui/app.js?p517_ui_3');
 e.question.value='반품 기간은?';e.askForm.events.get('submit')({preventDefault(){}});
 await flush();assert.equal(e.askButton.disabled,true);
 e.projectSelect.value=ids.two;
 await e.projectSwitch.events.get('click')();
 assert.equal(e.revenue.textContent,'158,000원');
 assert.equal(e.askButton.disabled,false);
 ctx.resolveQuery();
 await flush();await flush();
 assert.match(e.answerPane.children[0].textContent,/프로젝트가 변경/);
 assert.equal(e.followupButton.disabled,true);
 assert.equal(e.askButton.disabled,false);
});
