/** P5.49 CLI: exact approved local files required for unapproved statistics only. */
import {previewLocalMappedSales} from './prep-mapped-sales.mjs';
try {
 if(process.argv.length!==4)throw Error('ARGS');
 process.stdout.write(JSON.stringify(previewLocalMappedSales(process.argv[2],process.argv[3]))+'\n');
}catch{
 process.stdout.write(JSON.stringify({status:'SALES_PREVIEW_BLOCKED',approval:'NOT_GRANTED',
   ax_package_created:false,sqlite_imported:false,remote_upload:false})+'\n');
 process.exitCode=1;
}
