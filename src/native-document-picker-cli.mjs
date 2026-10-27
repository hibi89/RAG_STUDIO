/**
 * P5.42: Windows native file dialog -> bounded UTF-8 JSON through stdin.
 * No user selected path enters cmd.exe, powershell.exe -Command, URL or shell.
 * Fixed PUBLIC SYNTHETIC AX fixture is the only base package for this launcher.
 * Local documents remain an unapproved read-only preview, not customer import.
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {openNativeDocumentCollectionPreview} from './native-document-collection.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from './dashboard-server.mjs';

const FIXTURE=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const MAX_SELECTION_BYTES=16*1024;
function reject(code){throw Object.assign(new Error('Local document picker declined input'),{code:'NATIVE_PICKER_'+code});}

/** Strict decoded JSON object; strings are NEVER substituted into command lines. */
export function parseNativePickerSelection(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
   Object.keys(value).length!==2||value.source!=='WINDOWS_NATIVE_PICKER_V1'||
   !Object.hasOwn(value,'documents')||!Array.isArray(value.documents)||
   value.documents.length<2||value.documents.length>4)reject('INVALID_SELECTION');
 const documents=value.documents.map(name=>{
  if(typeof name!=='string'||name.length<1||name.length>2048||
    !path.isAbsolute(name)||/[\u0000-\u001f\u007f]/u.test(name)||
    !/\.(pdf|docx)$/iu.test(name))reject('INVALID_FILE_PATH');
  return name;
 });
 const names=documents.map(name=>process.platform==='win32'?name.toLowerCase():name);
 if(new Set(names).size!==documents.length)reject('DUPLICATE_PATH');
 return Object.freeze([...documents]);
}

/** Fatal UTF-8 decode: avoids silently mangling non-ASCII Windows filenames. */
export async function readPickerSelection(input=process.stdin){
 if(input.isTTY)reject('STDIN_REQUIRED');
 const parts=[];let total=0;
 for await(const chunk of input){
  const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  total+=bytes.length;
  if(total>MAX_SELECTION_BYTES)reject('INPUT_BUDGET');
  parts.push(bytes);
 }
 if(total===0)reject('EMPTY_INPUT');
 let payload;
 try{
  const decoder=new TextDecoder('utf-8',{fatal:true});
  payload=JSON.parse(decoder.decode(Buffer.concat(parts)));
 }catch{reject('INVALID_UTF8_OR_JSON');}
 return parseNativePickerSelection(payload);
}

/** Only own freshly generated loopback + bearer fragment may go to Explorer.
 * No shell invocation or arbitrary argument concatenation.
 */
export function openLocalSessionInExplorer(url,{enabled=false,platform=process.platform,spawnProcess=spawn}={}){
 if(!enabled)return false;
 if(platform!=='win32'||typeof url!=='string'||
   !/^http:\/\/127\.0\.0\.1:(?:[1-9][0-9]{0,4})\/#session=[A-Za-z0-9_-]{43}$/u.test(url))
   reject('BROWSER_URL_NOT_LOCAL');
 const child=spawnProcess('explorer.exe',[url],{
   shell:false,stdio:'ignore',windowsHide:true,detached:true
 });
 child.on?.('error',()=>{process.stderr.write('LOCAL_BROWSER_AUTO_OPEN_UNAVAILABLE\n');});
 child.unref?.();
 return true;
}

/** Fixed synthetic package; P5.40 reconfirms every selected original by SHA. */
export async function launchNativePickerPreview(selection,{port=8765,autoBrowser=false}={}){
 const docs=parseNativePickerSelection(selection);
 const workspace=await openNativeDocumentCollectionPreview(FIXTURE,docs);
 let server;
 try{
  server=createDashboardServer({packageRoot:workspace.root});
  await listenDashboard(server,port);
  const url=dashboardLaunchUrl(server);
  const cleanup=()=>{
   if(server.listening)server.close(()=>workspace.cleanup());
   else workspace.cleanup();
  };
  return {url,server,workspace,cleanup,openBrowser:()=>{
    try{return openLocalSessionInExplorer(url,{enabled:autoBrowser});}
    catch{return false;}
  }};
 }catch(e){
  try{server?.close();}catch{}
  workspace.cleanup();
  throw e;
 }
}

async function main(){
 let runtime;
 try{
  if(process.argv.length!==2)reject('NO_COMMAND_ARGUMENTS');
  const docs=await readPickerSelection();
  const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
  if(!Number.isInteger(port)||port<0||port>65535)reject('PORT_INVALID');
  runtime=await launchNativePickerPreview({source:'WINDOWS_NATIVE_PICKER_V1',documents:docs},{
    port,autoBrowser:process.env.RAG_AUTO_OPEN_LOCAL_BROWSER==='1'
  });
  process.stdout.write('RAG_STUDIO_NATIVE_DOCUMENT_PREVIEW_READY\n');
  process.stdout.write('SYNTHETIC_AX_BASE_ONLY - documents are untrusted local text previews; no upload.\n');
  process.stdout.write('Private local session URL (do not share):\n'+runtime.url+'\n');
  runtime.openBrowser();
  let closing=false;
  const close=()=>{
   if(closing)return;
   closing=true;
   runtime.server.close(()=>{
     runtime.workspace.cleanup();
     process.exitCode=0;
   });
  };
  process.once('SIGINT',close);
  process.once('SIGTERM',close);
  process.on('exit',()=>runtime.workspace.cleanup());
 }catch(error){
  if(runtime)runtime.cleanup();
  const code=typeof error?.code==='string'&&
   /^(?:NATIVE_PICKER|NATIVE_DOC|NATIVE_COLLECTION)_[A-Z0-9_]+$/u.test(error.code)
     ?error.code
     :error?.code==='EADDRINUSE'?'PORT_BUSY':'INVALID_INPUT_OR_RUNTIME';
  process.stderr.write('LOCAL_NATIVE_PICKER_BLOCKED: '+code+'\n');
  process.exitCode=2;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await main();
}
