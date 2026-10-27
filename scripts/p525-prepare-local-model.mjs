/** No downloader: only checks externally-provisioned local model file bytes.
 * `--write` explicitly requests creating a manifest; never overwrite.
 */
import path from 'node:path';
import {prepareOfflineModelManifest} from '../src/local-model-provision.mjs';
const args=process.argv.slice(2);
if(args.length<1||args.length>2||!path.isAbsolute(args[0])||
 (args.length===2&&args[1]!=='--write'))
 throw Error('USAGE: node scripts/p525-prepare-local-model.mjs <ABS_XENOVA_MODEL_DIR> [--write]');
try{
 console.log(JSON.stringify(prepareOfflineModelManifest(args[0],{write:args[1]==='--write'}),null,2));
}catch{
 console.log(JSON.stringify({status:'LOCAL_MODEL_PREPARATION_BLOCKED',
   source_files_changed:false,download_performed:false,
   manifest_written:false,reason:'ASSETS_MISSING_INVALID_OR_UNSUPPORTED',
   next:'Inspect local model directory and published pinned file hashes; never bypass checks'},null,2));
 process.exitCode=1;
}
