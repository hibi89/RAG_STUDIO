/** CLI uses ONLY checked-in synthetic fixtures; reports IDs, never original questions. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {evaluateGold} from '../src/gold-eval.mjs';
const goldPath=new URL('../fixtures/p5_gold_v0.json',import.meta.url);
const dataRoot=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
try{
  const gold=JSON.parse(fs.readFileSync(goldPath,'utf8'));
  const report=evaluateGold(dataRoot,gold);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.fail!==0)process.exitCode=1;
}catch{
  process.stderr.write('P5_GOLD_RUNNER_FAILED\n');
  process.exitCode=1;
}
