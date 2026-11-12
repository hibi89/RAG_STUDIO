/** Offline owner-initiated ZIP: never upload or imply source approval. */
import {exportVerifiedReviewZip} from './review-bundle-zip.mjs';
if(process.argv.length!==4){
 process.stderr.write('Usage: node src/review-bundle-zip-cli.mjs ABSOLUTE_VERIFIED_BUNDLE_DIR ABSOLUTE_NEW_ZIP\n');
 process.exitCode=2;
}else{
 try{
  const result=exportVerifiedReviewZip(process.argv[2],process.argv[3]);
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch{
  process.stderr.write('RAG_REVIEW_ZIP_BLOCKED: inspect any partial output manually; do not treat it as verified.\n');
  process.exitCode=2;
 }
}
