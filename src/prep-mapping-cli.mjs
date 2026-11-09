/** Local-only read-only CSV PREP plan; emits headers/metadata, never row values. */
import {inspectLocalCsv} from './local-csv-review.mjs';
import {buildRagPrepMappingPlan} from './prep-mapping-plan.mjs';
try {
  if (process.argv.length !== 3) throw Error('ARGUMENTS');
  const inspection = inspectLocalCsv(process.argv[2]);
  const plan = buildRagPrepMappingPlan(inspection);
  process.stdout.write(JSON.stringify(plan)+'\n');
} catch {
  process.stdout.write(JSON.stringify({status:'PREP_PLAN_BLOCKED',ax_package_created:false})+'\n');
  process.exitCode=1;
}
