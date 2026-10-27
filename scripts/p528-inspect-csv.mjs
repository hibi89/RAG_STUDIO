import path from 'node:path';
import {inspectLocalCsv} from '../src/local-csv-review.mjs';
import {withReadOnlySales} from '../src/mixed-question.mjs';
const args=process.argv.slice(2);
if(args.length<1||args.length>2||args.some(p=>!path.isAbsolute(p)))
 throw Error('USAGE: node scripts/p528-inspect-csv.mjs <ABS_CSV> [ABS_VERIFIED_AX_PACKAGE]');
try{
 const result=inspectLocalCsv(args[0]);
 const verified_baseline=args[1]?withReadOnlySales(args[1],({totals,pkg})=>({
  verified_project_id:pkg.manifest.project_id,orders:totals.orders,
  units:String(totals.units),revenue_krw:String(totals.revenue_krw),
  source_sha_verified:true,changed_by_inspection:false})):null;
 console.log(JSON.stringify({...result,verified_baseline},null,2));
}catch{
 console.log(JSON.stringify({status:'CSV_INSPECTION_BLOCKED',
  imported_to_sqlite:false,customer_data_approved:false,source_modified:false,
  reason:'INVALID_OR_UNSUPPORTED_LOCAL_CSV_OR_BASELINE'},null,2));
 process.exitCode=1;
}
