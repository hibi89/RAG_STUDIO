/** Synthetic local review simulation only; not evidence of an authenticated human. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assessSmaxReview} from '../src/smax-review.mjs';
const fixture=fileURLToPath(new URL('../fixtures/smax_v1_boundary/',import.meta.url));
const pkg=JSON.parse(fs.readFileSync(fixture+'/unapproved.json','utf8'));
const raw=fs.readFileSync(fixture+'/source.csv');
const plan={
 schema_version:'RAG_SMAX_REVIEW_V0',
 source_sha256:pkg.source.sha256,
 semantic_roles:{order_id:'order_id',quantity:'quantity',line_amount_krw:'amount_krw'},
 currency:'KRW',amount_unit:'KRW_INTEGER',amount_meaning:'LINE_TOTAL',
 tax_basis:'TAX_NOT_APPLICABLE',source_records:[2,3],
 decision:'CONFIRM_FOR_NEXT_GATE',
 acknowledgement:'I_CHECKED_SOURCE_FIELDS_TAX_AND_ALL_ROWS'
};
const pending=assessSmaxReview(pkg,raw);
const intent=assessSmaxReview(pkg,raw,plan);
if(pending.status!=='PENDING_SEMANTIC_REVIEW'||
 intent.status!=='REVIEW_RECORD_READY'||
 intent.ax_package_created!==false||
 intent.reviewer_identity_verified!==false)process.exitCode=1;
process.stdout.write(JSON.stringify({stage:'SYNTHETIC_REVIEW_ONLY',pending,intent},null,2)+'\n');
