/** Human-typed local confirmation UX for *pinned synthetic fixture* only.
 * Not login/authentication, and never accepts customer input files. */
import fs from 'node:fs';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout,stderr} from 'node:process';
import {beginSyntheticExport,syntheticReviewPlan,confirmSyntheticExport,
  writeSyntheticAxBundle} from '../src/smax-synthetic-export.mjs';

if(process.argv.length!==3||!stdin.isTTY||!stdout.isTTY){
  stderr.write('Usage: interactive terminal only: node scripts/p42-export-interactive.mjs NEW_OUTPUT_DIRECTORY\n');
  process.exitCode=2;
}else{
  const root=new URL('../fixtures/',import.meta.url);
  const v1=JSON.parse(fs.readFileSync(new URL('smax_p42/synthetic_v1.json',root),'utf8'));
  const csv=fs.readFileSync(new URL('ax_multi_doc_v0/sales.csv',root));
  const policy=fs.readFileSync(new URL('ax_multi_doc_v0/returns_policy.txt',root));
  const request=beginSyntheticExport(v1,csv,policy);
  stdout.write('SYNTHETIC ONLY / NOT CUSTOMER APPROVAL\n');
  stdout.write('Review 6 synthetic rows: KRW integer, qty × unit price, tax NOT APPLICABLE.\n');
  stdout.write('No human identity verification; no real SMAX producer or customer data.\n');
  stdout.write('Type exactly: '+request.review_challenge+'\n');
  const io=createInterface({input:stdin,output:stdout});
  try{
    const typed=await io.question('Confirmation: ');
    const bundle=confirmSyntheticExport(request,typed,syntheticReviewPlan(request));
    const result=writeSyntheticAxBundle(bundle,process.argv[2]);
    stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch{
    stderr.write('SYNTHETIC_EXPORT_DECLINED_OR_FAILED; no existing output overwritten.\n');
    process.exitCode=1;
  }finally{io.close();}
}
