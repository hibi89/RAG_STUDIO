import test from 'node:test';
import assert from 'node:assert/strict';

class MiniElement {
  constructor(tag='div'){
    this.tagName=tag;this.children=[];this.dataset={};this.textContent='';this.className='';
    this.value='';this.files=[];this.events=new Map();this.classes=new Set();
    this.classList={
      add:(v)=>this.classes.add(v),remove:(v)=>this.classes.delete(v),
      toggle:(v,b)=>b?this.classes.add(v):this.classes.delete(v),
      contains:(v)=>this.classes.has(v)
    };
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  addEventListener(name,callback){this.events.set(name,callback);}
  setAttribute(key,value){(this.attributes??={})[key]=value;}
  querySelectorAll(selector){
    if(selector==='tr')return this.children.filter(c=>c.tagName==='tr');
    if(selector==='.doc')return this.children.filter(c=>c.className==='doc');
    return [];
  }
  focus(){}
  scrollIntoView(){}
}
const ids=['health','projectId','revenue','orders','units','approvedDocs','documentCards','sourceRows',
  'skuChart','askForm','question','askButton','searchButton','answerPane','citationDetail',
  'smaxForm','smaxJson','smaxCsv','smaxButton','smaxResult'];
const tree=el=>[el,...el.children.flatMap(tree)];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const overview={
  project_id:'unchanged-synth',schema_version:'AX_DATA_PACKAGE_V0',
  dataset:{orders:1,units:'1',revenue_krw:'12000',source_rows:[],sku_totals:[]},
  documents:[],review:{items:[],summary:{}}
};
function setup(preview){
  const elements=Object.fromEntries(ids.map(id=>[id,new MiniElement()]));
  const requests=[];
  globalThis.document={
    getElementById:id=>elements[id],
    createElement:tag=>new MiniElement(tag),
    querySelectorAll:()=>[]
  };
  globalThis.location={hash:'#session='+'B'.repeat(43),pathname:'/',search:''};
  globalThis.history={replaceState:()=>{}};
  globalThis.window={matchMedia:()=>({matches:true})};
  globalThis.fetch=async(url,options={})=>{
    requests.push({url,options});
    return {ok:!(preview instanceof Error),status:preview instanceof Error?422:200,
      json:async()=>(url==='/api/overview'?overview:preview instanceof Error?{error:'SMAX_PREVIEW_UNVERIFIED'}:preview)};
  };
  return {elements,requests};
}
function selected(name,bytes){
  return {name,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}
function fill(elements){
  const raw=Buffer.from('order_id,sku,quantity,unit_price_krw,amount_krw\nS-001,A-1,1,20000,20000\n');
  elements.smaxJson.files=[selected('producer.json',Buffer.from('{"schema_version":"SMAX_PREPROCESS_GENERIC_CSV_V1"}'))];
  elements.smaxCsv.files=[selected('original.csv',raw)];
  return raw;
}
test('P5.14 real UI module sends selected local bytes with bearer and does not replace existing KPIs',async()=>{
  const {elements,requests}=setup({
    status:'CALCULATED_PREVIEW_NOT_APPROVED',revenue_krw:'20000',orders:1,units:'1',
    sku_totals:[{sku:'A-1',orders:1,units:'1',revenue_krw:'20000'}]
  });
  const source=fill(elements);
  await import('../ui/app.js?p514_ui_ok=1');
  assert.equal(elements.revenue.textContent,'12,000원');
  elements.smaxForm.events.get('submit')({preventDefault(){}});
  await tick();await tick();
  assert.deepEqual(requests.map(r=>r.url),['/api/overview','/api/smax-preview']);
  const req=requests[1];
  assert.equal(req.options.headers.Authorization,'Bearer '+'B'.repeat(43));
  const body=JSON.parse(req.options.body);
  assert.deepEqual(Buffer.from(body.source_csv_base64,'base64'),source);
  assert.equal(body.v1.schema_version,'SMAX_PREPROCESS_GENERIC_CSV_V1');
  assert.equal(elements.revenue.textContent,'12,000원');
  const words=tree(elements.smaxResult).map(e=>e.textContent).join(' | ');
  assert.match(words,/20,000원/);
  assert.match(words,/A-1/);
  assert.match(words,/미승인/);
});
test('P5.14 REVIEW_HOLD never renders preview amount or SKU table',async()=>{
  const {elements,requests}=setup({
    status:'REVIEW_HOLD',review_rows:2,revenue_krw:null,orders:null,sku_totals:[],
    ax_package_created:false
  });
  fill(elements);
  await import('../ui/app.js?p514_ui_hold=2');
  elements.smaxForm.events.get('submit')({preventDefault(){}});
  await tick();await tick();
  assert.equal(requests.length,2);
  const text=tree(elements.smaxResult).map(x=>x.textContent).join(' | ');
  assert.match(text,/REVIEW_HOLD/);
  assert.match(text,/검토 대상 2행/);
  assert.doesNotMatch(text,/원|SKU|매출 합계/);
  assert.equal(elements.revenue.textContent,'12,000원');
});
test('P5.14 invalid file extensions and excessive size are rejected before API call',async()=>{
  const {elements,requests}=setup({});
  fill(elements);
  elements.smaxJson.files=[selected('private.exe',Buffer.from('{}'))];
  await import('../ui/app.js?p514_ui_bad=3');
  elements.smaxForm.events.get('submit')({preventDefault(){}});
  await tick();
  assert.deepEqual(requests.map(r=>r.url),['/api/overview']);
  assert.match(tree(elements.smaxResult).map(x=>x.textContent).join(''),/지정된 확장자/);
});
test('P5.14 server failure is generic and never repeats raw sensitive data',async()=>{
  const {elements,requests}=setup(new Error('private O-009 /secret/client.csv'));
  fill(elements);
  await import('../ui/app.js?p514_ui_fail=4');
  elements.smaxForm.events.get('submit')({preventDefault(){}});
  await tick();await tick();
  assert.equal(requests.length,2);
  const text=tree(elements.smaxResult).map(x=>x.textContent).join(' ');
  assert.match(text,/검증하지 못했습니다/);
  assert.doesNotMatch(text,/private|secret|O-009/);
});
