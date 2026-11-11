/** P5.48 local-only, explicit output path, no network or import. */
import {inspectLocalCsv} from './local-csv-review.mjs';
import {writeRagPrepMappingForm} from './prep-mapping-form.mjs';
try{
 if(process.argv.length!==4)throw Error('ARGUMENTS');
 const review=inspectLocalCsv(process.argv[2]);
 const result=writeRagPrepMappingForm(review,process.argv[3]);
 process.stdout.write(JSON.stringify(result)+'\n');
}catch{
 process.stdout.write(JSON.stringify({status:'PREP_FORM_BLOCKED',file_created:false,ax_package_created:false})+'\n');
 process.exitCode=1;
}
