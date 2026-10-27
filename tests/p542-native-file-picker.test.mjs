import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pdfFixture,docxFixture} from './native-document-fixtures.mjs';
import {parseNativePickerSelection,readPickerSelection,openLocalSessionInExplorer} from '../src/native-document-picker-cli.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const packet=documents=>({source:'WINDOWS_NATIVE_PICKER_V1',documents});
function inputs(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p542-native-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const pdf=path.join(dir,'한글 & 안전 (첫 번째).pdf');
 const docx=path.join(dir,'Word ^ 정책 & 문서.docx');
 fs.writeFileSync(pdf,pdfFixture());
 fs.writeFileSync(docx,docxFixture());
 return {dir,pdf,docx};
}
test('P5.42 bounded picker selection accepts only exact 2-4 absolute local PDF/DOCX names',t=>{
 const {pdf,docx}=inputs(t);
 const chosen=parseNativePickerSelection(packet([pdf,docx]));
 assert.deepEqual(chosen,[pdf,docx]);
 assert.ok(Object.isFrozen(chosen));
 for(const list of [[],[pdf],[pdf,docx,pdf,docx,docx]])
  assert.throws(()=>parseNativePickerSelection(packet(list)),{code:'NATIVE_PICKER_INVALID_SELECTION'});
 for(const invalid of [
  null,[],{},packet([pdf,docx,'relative.pdf']),
  packet([pdf,docx,123]),
  packet([pdf,docx+'\n']),
  packet([pdf,docx,'../secret.docx']),
  packet([pdf,docx,'/secret.csv']),
  {...packet([pdf,docx]),package_root:'user chosen'}
 ]){
  const code=invalid?.package_root||!Array.isArray(invalid?.documents)?
    'NATIVE_PICKER_INVALID_SELECTION':'NATIVE_PICKER_INVALID_FILE_PATH';
  assert.throws(()=>parseNativePickerSelection(invalid),{code});
 }
 assert.throws(()=>parseNativePickerSelection(packet([pdf,pdf])),{code:'NATIVE_PICKER_DUPLICATE_PATH'});
});
test('P5.42 UTF-8 stdin transport preserves Korean, symbols and never echoes them',async t=>{
 const {pdf,docx}=inputs(t);
 const bytes=Buffer.from(JSON.stringify(packet([pdf,docx]))+'\r\n','utf8');
 const read=await readPickerSelection(Readable.from([
  bytes.subarray(0,7),bytes.subarray(7,13),bytes.subarray(13)
 ]));
 assert.deepEqual(read,[pdf,docx]);
});
test('P5.42 parser refuses invalid UTF-8, bad JSON, empty input and large body',async()=>{
 for(const [chunks,code] of [
  [[], 'NATIVE_PICKER_EMPTY_INPUT'],
  [[Buffer.from([0xc3,0x28])],'NATIVE_PICKER_INVALID_UTF8_OR_JSON'],
  [[Buffer.from('{"broken":')],'NATIVE_PICKER_INVALID_UTF8_OR_JSON'],
  [[Buffer.alloc(16*1024+1,0x41)],'NATIVE_PICKER_INPUT_BUDGET']
 ]){
  await assert.rejects(()=>readPickerSelection(Readable.from(chunks)),{code});
 }
});
test('P5.42 Windows Explorer launch accepts only generated local private URL, never a shell',()=>{
 const url='http://127.0.0.1:8765/#session='+'A'.repeat(43);
 const called=[];
 const fake=(bin,args,options)=>{called.push({bin,args,options});return {on(){},unref(){}};};
 assert.equal(openLocalSessionInExplorer(url,{enabled:false,platform:'win32',spawnProcess:fake}),false);
 assert.equal(called.length,0);
 assert.equal(openLocalSessionInExplorer(url,{enabled:true,platform:'win32',spawnProcess:fake}),true);
 assert.equal(called.length,1);
 assert.equal(called[0].bin,'explorer.exe');
 assert.deepEqual(called[0].args,[url]);
 assert.equal(called[0].options.shell,false);
 for(const bad of [
  'https://example.com/#session='+'A'.repeat(43),
  'http://127.0.0.1:8765/#session=x',
  'http://127.0.0.1:8765/?file=%26#session='+'A'.repeat(43),
  'http://localhost:8765/#session='+'A'.repeat(43)
 ])
  assert.throws(()=>openLocalSessionInExplorer(bad,{
   enabled:true,platform:'win32',spawnProcess:fake
  }),{code:'NATIVE_PICKER_BROWSER_URL_NOT_LOCAL'});
 assert.equal(called.length,1);
});
test('P5.42 real 2-file stdin child launches authenticated local search without shell expansion',async t=>{
 const {pdf,docx}=inputs(t);
 const before=[fs.readFileSync(pdf),fs.readFileSync(docx)];
 const child=spawn(process.execPath,['src/native-document-picker-cli.mjs'],{
  cwd:ROOT,env:{...process.env,RAG_DASHBOARD_PORT:'0',RAG_AUTO_OPEN_LOCAL_BROWSER:'0'},
  stdio:['pipe','pipe','pipe']});
 const errors=[];
 child.stderr.on('data',d=>errors.push(d.toString('utf8')));
 t.after(async()=>{
  if(child.exitCode===null){
   child.kill('SIGINT');
   await Promise.race([
    new Promise(resolve=>child.once('exit',resolve)),
    new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},1800))
   ]);
  }
 });
 const link=await new Promise((resolve,reject)=>{
  let buffer='',done=false;
  const timer=setTimeout(()=>{if(!done){done=true;child.kill('SIGKILL');
   reject(new Error('NATIVE_PICKER_TEST_LAUNCH_TIMEOUT'));}},18000);
  child.stdout.on('data',part=>{
   buffer+=part.toString('utf8');
   if(buffer.length>8192&&!done){done=true;clearTimeout(timer);reject(new Error('UNSAFE_OUTPUT'));return;}
   const found=buffer.match(/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/);
   if(found&&!done){done=true;clearTimeout(timer);resolve(found[0]);}
  });
  child.once('exit',()=>{if(!done){done=true;clearTimeout(timer);
   reject(new Error('EARLY_PICKER_CLI_EXIT '+errors.join('').replaceAll(pdf,'[FILE]').replaceAll(docx,'[FILE]')));}});
  child.stdin.end(JSON.stringify(packet([pdf,docx]))+'\n','utf8');
 });
 const url=new URL(link),base=url.origin;
 const headers={'Content-Type':'application/json',
  Authorization:'Bearer '+url.hash.slice('#session='.length)};
 const question=JSON.stringify({question:'Product returns within 7 days 안전 점검 대상 부품'});
 const api=await fetch(base+'/api/search',{method:'POST',headers,body:question});
 assert.equal(api.status,200);
 const data=await api.json();
 assert.equal(data.status,'FOUND');
 assert.ok(data.evidence.some(x=>x.quote.includes('[PDF page 1]')));
 assert.ok(data.evidence.some(x=>x.quote.includes('[DOCX paragraph 2]')));
 const denied=await fetch(base+'/api/search',{method:'POST',
  headers:{'Content-Type':'application/json'},body:question});
 assert.equal(denied.status,401);
 const metrics=await fetch(base+'/api/query',{method:'POST',headers,
  body:JSON.stringify({question:'SKU N-02 매출 알려줘'})});
 assert.equal(metrics.status,200);
 assert.equal((await metrics.json()).metric_evidence.revenue_krw,'72000');
 assert.deepEqual(fs.readFileSync(pdf),before[0]);
 assert.deepEqual(fs.readFileSync(docx),before[1]);
 assert.doesNotMatch(JSON.stringify(data),/p542-native-|한글 & 안전|Word \^ 정책/);
});
test('P5.42 malformed stdin exits fail-closed without URL, paths or guessed approval',()=>{
 const invalid=spawnSync(process.execPath,['src/native-document-picker-cli.mjs'],{
  cwd:ROOT,encoding:'utf8',input:'{"source":"WRONG","documents":[]}',
  env:{...process.env,RAG_DASHBOARD_PORT:'0'},timeout:15000});
 assert.equal(invalid.status,2);
 assert.match(invalid.stderr,/LOCAL_NATIVE_PICKER_BLOCKED: NATIVE_PICKER_INVALID_SELECTION/);
 assert.doesNotMatch(invalid.stdout,/session=|http:/);
 assert.doesNotMatch(invalid.stderr,/session=|http:/);
});
test('P5.42 Windows CLI/PowerShell only use fixed command and selection via stdin',()=>{
 const cmd=fs.readFileSync(path.join(ROOT,'RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd'),'utf8');
 const ps=fs.readFileSync(path.join(ROOT,'scripts/p542-native-file-picker.ps1'),'utf8');
 assert.match(cmd,/DisableDelayedExpansion/);
 assert.match(cmd,/powershell\.exe -NoProfile -STA/);
 assert.match(ps,/System\.Windows\.Forms\.OpenFileDialog/);
 assert.match(ps,/\$dialog\.Multiselect = \$true/);
 assert.match(ps,/\$json \| & node 'src\\native-document-picker-cli\.mjs'/);
 assert.doesNotMatch(ps,/Invoke-Expression|iex\s|Start-Process|Invoke-WebRequest/i);
 assert.doesNotMatch(cmd,/%~[23456789]|node\s+.*%[a-zA-Z]+%/);
 assert.match(cmd,/npm ci/);
});
test('P5.42 Windows actual PowerShell parser accepts native picker without launching GUI',t=>{
 if(process.platform!=='win32'){t.skip('PowerShell grammar is verified in windows-2025 CI');return;}
 const command="$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile("+
   "'scripts/p542-native-file-picker.ps1',[ref]$t,[ref]$e)|Out-Null;"+
   "if($e.Count -gt 0){exit 2}";
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],
   {cwd:ROOT,encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr.replaceAll(ROOT,'[ROOT]'));
});
test('P5.42 Windows CMD rejects unexpected arguments before opening any dialogs',t=>{
 if(process.platform!=='win32'){t.skip('Requires CMD on Windows');return;}
 const result=spawnSync('cmd.exe',['/d','/c','RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd','badargument'],
  {cwd:ROOT,encoding:'utf8',timeout:10000});
 assert.equal(result.status,2);
 assert.match(result.stdout,/does not accept command line/);
});
