/** Read-only SMAX->RAG boundary preflight. Never returns raw business/source data. */
import {inspectSmaxFiles} from './smax-intake.mjs';
const argv=process.argv.slice(2);
if(argv.length!==1&&argv.length!==3){
  process.stderr.write('Usage: node src/smax-intake-cli.mjs package.json [--source source.csv]\n');
  process.exitCode=2;
}else if(argv.length===3&&argv[1]!=='--source'){
  process.stderr.write('Usage: node src/smax-intake-cli.mjs package.json [--source source.csv]\n');
  process.exitCode=2;
}else{
  const report=inspectSmaxFiles(argv[0],argv.length===3?argv[2]:null);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status==='REJECTED')process.exitCode=1;
  // REVIEW_REQUIRED is expected at this gate; never promote data automatically.
}
