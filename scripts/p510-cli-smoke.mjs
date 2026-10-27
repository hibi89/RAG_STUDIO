/** Native subprocess smoke for the actual one-command ZIP MVP launcher.
 * Session URL is never printed in test logs.
 */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,['scripts/p510-mvp-zip-dashboard.mjs'],{
  cwd:root,env:{...process.env,RAG_DASHBOARD_PORT:'0'},stdio:['ignore','pipe','pipe']
});
let buffer='',stderr='',exited=false;
const timeout=setTimeout(()=>child.kill('SIGKILL'),12_000);
child.on('exit',()=>{exited=true;});
function launchUrl(){
  return new Promise((resolve,reject)=>{
    const received=data=>{
      buffer+=data.toString('utf8');
      if(buffer.length>8192){reject(new Error('LAUNCH_OUTPUT_TOO_LARGE'));return;}
      const match=/http:\/\/127\.0\.0\.1:\d+\/#session=[A-Za-z0-9_-]{43}/.exec(buffer);
      if(match){cleanup();resolve(match[0]);}
    };
    const error=data=>{stderr+=data.toString('utf8');if(stderr.length>4096)stderr=stderr.slice(-4096);};
    const exit=()=>{cleanup();reject(new Error('LAUNCH_EXITED_BEFORE_READY'));};
    const cleanup=()=>{child.stdout.off('data',received);child.off('exit',exit);child.stderr.off('data',error);};
    child.stdout.on('data',received);child.stderr.on('data',error);child.on('exit',exit);
  });
}
try{
  const full=await launchUrl();
  const url=new URL(full);
  const token=url.hash.slice('#session='.length);
  const base=url.origin;
  const denied=await fetch(base+'/api/overview');
  if(denied.status!==401)throw new Error('ANONYMOUS_DATA_WAS_NOT_DENIED');
  const overview=await fetch(base+'/api/overview',{headers:{Authorization:'Bearer '+token}});
  if(overview.status!==200)throw new Error('AUTHORIZED_OVERVIEW_FAILED');
  const data=await overview.json();
  if(data.dataset?.revenue_krw!=='157000'||data.dataset?.orders!==6||data.documents?.length!==2)
    throw new Error('INCORRECT_SYNTHETIC_OVERVIEW');
  const response=await fetch(base+'/api/query',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({question:'총 매출과 반품 기간, 배송 준비 기간은?'})
  });
  const answer=await response.json();
  if(response.status!==200||answer.status!=='ANSWERED'||answer.document_evidence?.length!==2)
    throw new Error('ZIP_TO_CITED_ANSWER_FAILED');
  console.log('P5.10 SUBPROCESS ZIP MVP: startup, 401 guard, KPI 157000, 2 citations PASS');
}catch(error){
  console.error('P5.10 SUBPROCESS ZIP MVP FAILED: '+error.message);
  process.exitCode=1;
}finally{
  clearTimeout(timeout);
  if(!exited){
    child.kill('SIGINT');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},2000))]);
  }
}
