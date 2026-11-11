/** Public, pinned, synthetic-only PREP owner-draft to RAG evidence smoke. */
import {runSyntheticMappedRagJourney} from '../src/prep-synthetic-journey.mjs';
try{
 if(process.argv.length!==2)throw Error('ARGUMENTS');
 const report=runSyntheticMappedRagJourney();
 process.stdout.write(JSON.stringify(report)+'\n');
}catch{
 process.stdout.write(JSON.stringify({status:'SYNTHETIC_JOURNEY_BLOCKED',real_customer_indexed:false})+'\n');
 process.exitCode=1;
}
