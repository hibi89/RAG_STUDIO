/** Local-only CSV + explicit mapping JSON; metadata review, no import or approval. */
import {inspectLocalCsv} from './local-csv-review.mjs';
import {readLocalRagPrepDraft,buildRagPrepReviewFromDraft} from './prep-mapping-draft.mjs';
try {
  if (process.argv.length !== 4) throw Error('ARGUMENTS');
  const draft = readLocalRagPrepDraft(process.argv[3]);
  const review = inspectLocalCsv(process.argv[2]);
  const plan = buildRagPrepReviewFromDraft(review,draft);
  process.stdout.write(JSON.stringify(plan)+'\n');
} catch {
  process.stdout.write(JSON.stringify({status:'PREP_REVIEW_BLOCKED',ax_package_created:false,
    sqlite_imported:false,remote_upload:false})+'\n');
  process.exitCode=1;
}
