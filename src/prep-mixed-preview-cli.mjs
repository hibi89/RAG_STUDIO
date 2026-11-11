/** P5.51: absolute local CSV/draft/TXT and explicitly supported question only. */
import {previewLocalSalesAndPolicy} from './prep-mixed-preview.mjs';
try{
 if(process.argv.length!==6)throw Error('ARGS');
 process.stdout.write(JSON.stringify(previewLocalSalesAndPolicy(...process.argv.slice(2)))+'\n');
}catch{
 process.stdout.write(JSON.stringify({status:'MIXED_PREVIEW_BLOCKED',approval:'NOT_GRANTED',
   ax_package_created:false,sqlite_imported:false,document_indexed:false,remote_upload:false})+'\n');
 process.exitCode=1;
}
