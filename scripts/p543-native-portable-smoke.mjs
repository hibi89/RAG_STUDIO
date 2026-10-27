/** P5.43: test the actual BUILT and copied Windows native preview folder,
 * including SHA verifier, tamper refusal and real 2-file HTTP RAG API.
 * Never launches a Windows GUI or uses real customer files.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {pdfFixture,docxFixture} from '../tests/native-document-fixtures.mjs';
import {verifyNativePortable} from './p543-verify-native-portable.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url));
async function smoke(root){
 assert.equal(verifyNativePortable(root).status,'NATIVE_PORTABLE_INTEGRITY_PASS');
 const ui=path.join(root,'ui/app.js');
 const copy=fs.readFileSync(ui);
 try{
  fs.appendFileSync(ui,'tampered');
  assert.equal(verifyNativePortable(root).status,'NATIVE_PORTABLE_INTEGRITY_BLOCKED');
 }finally{fs.writeFileSync(ui,copy);}
 assert.equal(verifyNativePortable(root).status,'NATIVE_PORTABLE_INTEGRITY_PASS');
 const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p543-proof-'));
 try{
  const pdf=path.join(sandbox,'안전 테스트 & file.pdf'),docx=path.join(sandbox,'정책 테스트 ^ docx.docx');
  fs.writeFileSync(pdf,pdfFixture());
  fs.writeFileSync(docx,docxFixture());
  const script=path.join(root,'src/native-document-picker-cli.mjs');
  const child=spawn(process.execPath,[script],{
   cwd:root,env:{...process.env,RAG_DASHBOARD_PORT:'0',RAG_AUTO_OPEN_LOCAL_BROWSER:'0'},
   stdio:['pipe','pipe','pipe']});
  let settled=false;
  try{
   const url=await new Promise((resolve,reject)=>{
    let out='',err='';
    const timer=setTimeout(()=>{if(!settled){settled=true;child.kill('SIGKILL');
     reject(Error('PORTABLE_SMOKE_TIMEOUT'));}},25000);
    child.stdout.on('data',c=>{
     out+=c.toString();
     if(out.length>8192&&!settled){settled=true;clearTimeout(timer);reject(Error('OUTPUT_LIMIT'));return;}
     const m=out.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
     if(m&&!settled){settled=true;clearTimeout(timer);resolve(m[0]);}
    });
    child.stderr.on('data',c=>{err+=c.toString().slice(0,400);});
    child.once('exit',()=>{if(!settled){settled=true;clearTimeout(timer);
     reject(Error('EARLY_PORTABLE_EXIT'));}});
    child.stdin.end(JSON.stringify({source:'WINDOWS_NATIVE_PICKER_V1',documents:[pdf,docx]})+'\n','utf8');
   });
   const endpoint=new URL(url),auth={Authorization:'Bearer '+endpoint.hash.slice('#session='.length)};
   const body=JSON.stringify({question:'Product returns within 7 days 안전 점검 대상 부품'});
   const r=await fetch(endpoint.origin+'/api/search',{method:'POST',
    headers:{...auth,'Content-Type':'application/json'},body});
   assert.equal(r.status,200);
   const data=await r.json();
   assert.equal(data.status,'FOUND');
   assert.ok(data.evidence.some(e=>e.quote.includes('[PDF page 1]')));
   assert.ok(data.evidence.some(e=>e.quote.includes('[DOCX paragraph 2]')));
   const no=await fetch(endpoint.origin+'/api/search',{method:'POST',
    headers:{'Content-Type':'application/json'},body});
   assert.equal(no.status,401);
   const revenue=await fetch(endpoint.origin+'/api/query',{method:'POST',
    headers:{...auth,'Content-Type':'application/json'},
    body:JSON.stringify({question:'SKU N-02 매출 알려줘'})});
   assert.equal(revenue.status,200);
   assert.equal((await revenue.json()).metric_evidence.revenue_krw,'72000');
   assert.equal(verifyNativePortable(root).status,'NATIVE_PORTABLE_INTEGRITY_PASS');
   process.stdout.write('P543_NATIVE_PORTABLE_REAL_HTTP_7_CHECKS_PASS\n');
  }finally{
   if(child.exitCode===null){child.kill('SIGINT');await Promise.race([
    new Promise(resolve=>child.once('exit',resolve)),
    new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},2000))
   ]);}
  }
 }finally{fs.rmSync(sandbox,{recursive:true,force:true});}
}
if(process.argv.length!==3||!path.isAbsolute(process.argv[2])){
 process.stderr.write('P543_PORTABLE_SMOKE_ARGUMENT_REQUIRED\n');process.exitCode=2;
}else{
 try{await smoke(path.resolve(process.argv[2]));}
 catch(error){process.stderr.write('P543_PORTABLE_SMOKE_FAILED: '+(error?.code??'CHECK_FAILED')+'\n');process.exitCode=2;}
}
