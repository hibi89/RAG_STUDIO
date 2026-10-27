/** P5.37 local-first interactive selection of three user-supplied paths.
 * No CMD expansion of input, no remote calls, no rights approval or AX import.
 * The original P5.35 verifier is re-run by P5.36's plan CLI.
 */
import path from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {runLocalApprovalPlan} from './local-smax-approval-plan-cli.mjs';

const PROMPTS=Object.freeze([
  'SMAX V1 JSON full path: ',
  'Original CSV full path: ',
  'TXT/MD document full path: '
]);
const fail=()=>{throw Object.assign(Error('LOCAL_SMAX_WIZARD_BLOCKED'),{code:'LOCAL_SMAX_WIZARD_BLOCKED'});};
export function normalizeLocalSelection(line) {
  if(typeof line!=='string')fail();
  let value=line.trim();
  if(value.startsWith('"')&&value.endsWith('"')&&value.length>2)
    value=value.slice(1,-1);
  if(!value || value.length>4096 || /[\u0000-\u001f\u007f"']/u.test(value) ||
     !path.isAbsolute(value))fail();
  return value;
}
/** Prompts contain only fixed labels. No source path/row/text is ever printed. */
export async function runLocalSmaxApprovalWizard({input=process.stdin,prompts=process.stderr}={}){
  const reader=createInterface({input,crlfDelay:Infinity,terminal:false});
  try{
    const lines=reader[Symbol.asyncIterator](),choices=[];
    for(const prompt of PROMPTS){
      prompts.write(prompt);
      const next=await lines.next();
      if(next.done)fail();
      choices.push(normalizeLocalSelection(next.value));
    }
    return runLocalApprovalPlan(choices);
  }finally{reader.close();}
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  if(process.argv.length!==2){
    console.error('LOCAL_SMAX_WIZARD_BLOCKED: interactive only, no command arguments');
    process.exitCode=2;
  }else{
    runLocalSmaxApprovalWizard()
      .then(report=>process.stdout.write(JSON.stringify(report)+'\n'))
      .catch(()=>{
        console.error('LOCAL_SMAX_WIZARD_BLOCKED: source or review integrity invalid');
        process.exitCode=1;
      });
  }
}
