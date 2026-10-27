import test from 'node:test';
import assert from 'node:assert/strict';

class Node {
 constructor(tag='div'){
  this.tagName=tag;this.children=[];this.dataset={};this.textContent='';
  this.className='';this.value='';this.disabled=false;this.events=new Map();this.classSet=new Set();
  this.classList={add:x=>this.classSet.add(x),remove:x=>this.classSet.delete(x),
    toggle:(x,on)=>on?this.classSet.add(x):this.classSet.delete(x)};
 }
 append(...xs){this.children.push(...xs);}
 replaceChildren(...xs){this.children=xs;}
 addEventListener(type,fn){this.events.set(type,fn);}
 setAttribute(){}
 querySelectorAll(q){
   if(q==='tr')return this.children.filter(n=>n.tagName==='tr');
   if(q==='.doc')return this.children.filter(n=>n.className==='doc');
   return [];
 }
 focus(){}scrollIntoView(){}
}
const fields=['health','projectId','revenue','orders','units','approvedDocs',
'documentCards','sourceRows','skuChart','askForm','question','askButton','searchButton',
'answerPane','citationDetail','smaxForm','smaxJson','smaxCsv','smaxButton','smaxResult',
'projectSelect','projectSwitch','projectStatus'];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const overview=(id,revenue)=>({
 project_id:id,schema_version:'AX_DATA_PACKAGE_V0',
 dataset:{orders:6,units:'10',revenue_krw:revenue,source_rows:[],sku_totals:[]},
 documents:[],review:{items:[],summary:{}}
});
const ids={first:'a'.repeat(32),second:'b'.repeat(32)};
function configure({failProjects=false,failSwitch=false}={}){
 const e=Object.fromEntries(fields.map(k=>[k,new Node()]));
 e.projectSelect.disabled=true;e.projectSwitch.disabled=true;
 let selected=ids.first;
 const requests=[];
 globalThis.document={getElementById:k=>e[k],createElement:tag=>new Node(tag),querySelectorAll:()=>[]};
 globalThis.location={hash:'#session='+'A'.repeat(43),pathname:'/',search:''};
 globalThis.history={replaceState:()=>{}};
 globalThis.window={matchMedia:()=>({matches:true})};
 globalThis.fetch=async(url,opts={})=>{
  requests.push({url,opts});
  let body,status=200;
  if(url==='/api/overview')body=overview('one','157000');
  else if(url==='/api/projects'){
    if(failProjects){status=422;body={error:'INVALID_REQUEST'};}
    else body={status:'EXPLICIT_LOCAL_PROJECTS_ONLY',selected,
      projects:[{project_key:ids.first,project_id:'one',documents:2},
        {project_key:ids.second,project_id:'two',documents:2}]};
  }
  else if(url==='/api/projects/select'){
    if(failSwitch){status=422;body={error:'PROJECT_UNVERIFIED'};}
    else {selected=JSON.parse(opts.body).project_key;
      body={status:'PROJECT_SELECTED',selected,overview:overview('two','158000')};}
  }else body={status:'NOT_SUPPORTED'};
  return {ok:status===200,status,json:async()=>body};
 };
 return {e,requests};
}
test('P5.15 UI lists opaque project keys, switches and replaces KPIs without leaking disk paths',async()=>{
 const {e,requests}=configure();
 await import('../ui/app.js?p515_selector_ok=1');
 assert.equal(e.revenue.textContent,'157,000원');
 assert.equal(e.projectSelect.children.length,2);
 assert.equal(e.projectSelect.value,ids.first);
 assert.equal(e.projectSwitch.disabled,false);
 e.projectSelect.value=ids.second;
 await e.projectSwitch.events.get('click')();
 await flush();
 assert.deepEqual(requests.map(x=>x.url),['/api/overview','/api/projects','/api/projects/select']);
 const params=JSON.parse(requests[2].opts.body);
 assert.deepEqual(params,{project_key:ids.second});
 assert.equal(e.revenue.textContent,'158,000원');
 assert.equal(e.projectId.textContent,'two · AX_DATA_PACKAGE_V0');
 assert.match(e.answerPane.children[0].textContent,/프로젝트가 변경/);
 assert.match(e.citationDetail.textContent,/선택한 프로젝트/);
 assert.match(e.projectStatus.textContent,/변경 완료/);
 assert.equal(e.question.value,'');
});
test('P5.15 failed project switch does not overwrite current verified overview',async()=>{
 const {e}=configure({failSwitch:true});
 await import('../ui/app.js?p515_selector_failure=2');
 e.projectSelect.value=ids.second;
 await e.projectSwitch.events.get('click')();
 await flush();
 assert.equal(e.revenue.textContent,'157,000원');
 assert.match(e.projectStatus.textContent,/유지합니다/);
 assert.equal(e.projectSelect.value,ids.first);
});
test('P5.15 selector load failure does not override successful dashboard health',async()=>{
 const {e}=configure({failProjects:true});
 await import('../ui/app.js?p515_selector_discovery=3');
 assert.equal(e.revenue.textContent,'157,000원');
 assert.equal(e.health.textContent,'검증된 로컬 데이터');
 assert.match(e.projectStatus.textContent,/현재 데이터는 유지/);
});
