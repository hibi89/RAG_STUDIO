/** Local-only P5.36 HOLD review questions: no approval/ingest command. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runLocalReview} from './local-smax-review-cli.mjs';
import {buildLocalSmaxApprovalPlan} from './local-smax-approval-plan.mjs';
export function runLocalApprovalPlan(argv=process.argv.slice(2)){
  return buildLocalSmaxApprovalPlan(runLocalReview(argv));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(runLocalApprovalPlan()));}
  catch {
    console.error('LOCAL_SMAX_APPROVAL_PLAN_BLOCKED: invalid or unverified local source');
    console.error('Usage: npm run plan:smax:local -- <smax-v1.json> <original.csv> <local.txt|local.md>');
    process.exitCode=1;
  }
}
