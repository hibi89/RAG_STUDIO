/** Noninteractive CI demo. The challenge is simulated, NOT a real human approval. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {beginSyntheticExport,syntheticReviewPlan,confirmSyntheticExport,
  writeSyntheticAxBundle} from '../src/smax-synthetic-export.mjs';
const fixture=new URL('../fixtures/',import.meta.url);
const v1=JSON.parse(fs.readFileSync(new URL('smax_p42/synthetic_v1.json',fixture),'utf8'));
const csv=fs.readFileSync(new URL('ax_multi_doc_v0/sales.csv',fixture));
const policy=fs.readFileSync(new URL('ax_multi_doc_v0/returns_policy.txt',fixture));
const review=beginSyntheticExport(v1,csv,policy);
const bundle=confirmSyntheticExport(review,review.review_challenge,syntheticReviewPlan(review));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-synthetic-p42-'));
try{
  const summary=writeSyntheticAxBundle(bundle,path.join(root,'new-ax-package'));
  process.stdout.write(JSON.stringify({scenario:'SYNTHETIC_PROGRAMMATIC_CONFIRMATION_ONLY',
    authenticated_reviewer:false,real_data_allowed:false,...summary},null,2)+'\n');
}finally{fs.rmSync(root,{recursive:true,force:true});}
