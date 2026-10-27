/** PUBLIC synthetic P5.2 regression. No network or customer-data entrypoint. */
import {fileURLToPath} from 'node:url';
import {evaluateNegativeEvidence} from '../src/negative-evidence-eval.mjs';
try{
  const root=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
  const report=evaluateNegativeEvidence(root);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.fail!==0)process.exitCode=1;
}catch{
  process.stderr.write('P52_NEGATIVE_GATE_FAILED\n');
  process.exitCode=1;
}
