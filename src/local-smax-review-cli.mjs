/** Explicit local-only review; all paths/rows and original text omitted from output. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stageLocalSmaxReview} from './local-smax-review-hold.mjs';
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
export function runLocalReview(argv=process.argv.slice(2)){
 if(argv.length!==3||argv.some(x=>typeof x!=='string'||!x.trim()))throw Error('REQUIRED_ARGS');
 return stageLocalSmaxReview({
  jsonPath:path.resolve(argv[0]),csvPath:path.resolve(argv[1]),
  documentPath:path.resolve(argv[2])});
}
if(direct){
 try{console.log(JSON.stringify(runLocalReview()));}
 catch{
  console.error('LOCAL_SMAX_REVIEW_BLOCKED: invalid file, changed bytes, mapping or source');
  console.error('Usage: npm run review:smax:local -- <smax-v1.json> <original.csv> <local.txt|local.md>');
  process.exitCode=1;
 }
}
