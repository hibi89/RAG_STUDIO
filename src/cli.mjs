import {aggregateSales} from './summary.mjs';
const directory=process.argv[2];
if(!directory){console.error('Usage: node src/cli.mjs <local-package-directory>');process.exitCode=2;}
else {
  try { console.log(JSON.stringify(aggregateSales(directory),null,2)); }
  catch(error){ console.error(error.message);process.exitCode=1; }
}
