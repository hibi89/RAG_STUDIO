/** P5.53: explicit local new output path; stdout never includes personal filesystem paths. */
import {createLocalReviewBundle} from './prep-review-bundle.mjs';
try{
 if(process.argv.length!==6)throw Error('ARGS');
 process.stdout.write(JSON.stringify(createLocalReviewBundle(...process.argv.slice(2)))+'\n');
}catch{
 process.stdout.write(JSON.stringify({status:'REVIEW_BUNDLE_BLOCKED',approval:'NOT_GRANTED',
   ax_package_created:false,sqlite_imported:false,remote_upload:false})+'\n');
 process.exitCode=1;
}
