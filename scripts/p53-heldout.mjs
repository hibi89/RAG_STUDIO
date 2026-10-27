/** P5.3 runs only the checked-in public synthetic held-out package. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {evaluateHeldout} from '../src/heldout-eval.mjs';
try{
  const root=fileURLToPath(new URL('../fixtures/ax_heldout_v1/',import.meta.url));
  const gold=JSON.parse(fs.readFileSync(new URL('../fixtures/p53_heldout_gold.json',import.meta.url),'utf8'));
  const report=evaluateHeldout(root,gold);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.fail>0)process.exitCode=1;
}catch{
  process.stderr.write('P53_HELDOUT_GATE_FAILED\n');
  process.exitCode=1;
}
