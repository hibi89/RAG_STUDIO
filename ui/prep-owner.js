/* P5.47 local-only human-editable RAG mapping draft. Classic script works on file://. */
(function (scope) {
  'use strict';
  const TYPES=['text','integer','decimal','date','boolean'];
  const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(o,k));
  function reject(){throw Error('MAPPING_DRAFT_BLOCKED');}
  function checkPlan(plan){
    if(!plain(plan)||plan.contract!=='RAG_PREP_MAPPING_PLAN_V1'||plan.status!=='REVIEW_HOLD'||
       plan.approval!=='NOT_GRANTED'||plan.ax_package_created!==false||
       plan.sqlite_imported!==false||plan.remote_upload!==false||
       typeof plan.source_sha256!=='string'||!/^[a-f0-9]{64}$/.test(plan.source_sha256)||
       !Number.isSafeInteger(plan.source_size_bytes)||plan.source_size_bytes<1||
       plan.source_size_bytes>1048576||!Array.isArray(plan.proposed_columns)||
       plan.proposed_columns.length<1||plan.proposed_columns.length>64)reject();
    const seen=new Set();
    for(let i=0;i<plan.proposed_columns.length;i++){
      const c=plan.proposed_columns[i];
      if(!exact(c,['source','column_index','inferred_type','proposed_key','approval'])||
         typeof c.source!=='string'||!c.source||c.source!==c.source.trim()||
         /[\u0000-\u001f\u007f-\u009f\u200b-\u200f]/u.test(c.source)||
         c.column_index!==i+1||c.proposed_key!==null||c.approval!=='NOT_GRANTED'||
         (c.inferred_type!==null&&!TYPES.includes(c.inferred_type)))reject();
      const canonical=c.source.normalize('NFKC').toLowerCase();
      if(seen.has(canonical))reject();
      seen.add(canonical);
    }
    return plan;
  }
  function createOwnerDraft(plan,choices){
    checkPlan(plan);
    if(!Array.isArray(choices)||choices.length!==plan.proposed_columns.length)reject();
    const keys=new Set(),fields=[];
    for(let i=0;i<choices.length;i++){
      const c=choices[i],source=plan.proposed_columns[i].source;
      if(!exact(c,['key','type','required'])||typeof c.key!=='string'||
         typeof c.type!=='string'||typeof c.required!=='boolean')reject();
      if(c.key===''&&c.type==='')continue;
      if(!/^[a-z][a-z0-9_]{0,63}$/.test(c.key)||!TYPES.includes(c.type)||keys.has(c.key))reject();
      keys.add(c.key);fields.push({key:c.key,source,type:c.type,required:c.required});
    }
    return {contract:'RAG_PREP_OWNER_MAPPING_V1',source_sha256:plan.source_sha256,
      source_size_bytes:plan.source_size_bytes,fields};
  }
  scope.RagPrepOwnerUI=Object.freeze({checkPlan,createOwnerDraft});
  if(typeof document==='undefined')return;
  const file=document.getElementById('plan'),summary=document.getElementById('summary'),
    editor=document.getElementById('editor'),rows=document.getElementById('rows'),
    save=document.getElementById('save'),message=document.getElementById('message');
  let plan=null,controls=[];
  function label(text,child){const l=document.createElement('label');l.textContent=text;l.appendChild(child);return l;}
  function render(p){
    rows.replaceChildren();controls=[];
    p.proposed_columns.forEach(c=>{
      const row=document.createElement('div');row.className='mapping';
      const src=document.createElement('div');src.className='source';src.textContent=c.source;
      const hint=document.createElement('div');hint.className='hint';
      hint.textContent='추정 형식: '+(c.inferred_type||'미확정');src.appendChild(hint);
      const key=document.createElement('input');key.type='text';key.maxLength=64;key.autocomplete='off';key.placeholder='예: order_id';
      const type=document.createElement('select');
      for(const value of ['',...TYPES]){const option=document.createElement('option');option.value=value;option.textContent=value||'직접 선택';type.appendChild(option);}
      const required=document.createElement('input');required.type='checkbox';
      row.append(src,label('대상 열 키',key),label('자료형',type),label('필수',required));rows.appendChild(row);
      controls.push({key,type,required});
    });
    summary.textContent='열 '+p.proposed_columns.length+'개, 원본 '+p.source_size_bytes+'바이트. 원본 SHA256: '+p.source_sha256;
    editor.hidden=false;message.textContent='';
  }
  file.addEventListener('change',async()=>{
    plan=null;editor.hidden=true;rows.replaceChildren();message.textContent='';
    const selected=file.files&&file.files[0];if(!selected)return;
    try{
      if(selected.size<2||selected.size>65536)reject();
      const p=checkPlan(JSON.parse(await selected.text()));
      plan=p;render(p);
    }catch{summary.textContent='제안 JSON을 검증하지 못했습니다.';message.textContent='검증되지 않은 파일은 사용하지 않습니다.';}
  });
  save.addEventListener('click',()=>{
    try{
      if(!plan)reject();
      const choices=controls.map(c=>({key:c.key.value.trim(),type:c.type.value,required:c.required.checked}));
      const draft=createOwnerDraft(plan,choices);
      const blob=new Blob([JSON.stringify(draft,null,2)+'\n'],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='rag-prep-owner-draft.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      message.textContent='REVIEW HOLD: 초안만 저장했습니다. 반드시 원본 CSV와 함께 Node CLI로 다시 검증하십시오.';
    }catch{message.textContent='키/자료형이 누락되거나 중복되었습니다. 변경 내용을 확인하십시오.';}
  });
})(globalThis);
