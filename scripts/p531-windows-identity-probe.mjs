/** P5.31 observational synthetic-only file identity probe. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const fixture=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/sales.csv',import.meta.url));
const results=[];
function probe(id,filename){
  const st=fs.lstatSync(filename,{bigint:true});
  if(!st.isFile()||st.isSymbolicLink())throw Error('NOT_REGULAR');
  const fd=fs.openSync(filename,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
    const handle=fs.fstatSync(fd,{bigint:true}),again=fs.lstatSync(filename,{bigint:true});
    results.push({id,
      dev_path_handle_equal:st.dev===handle.dev,
      ino_path_handle_equal:st.ino===handle.ino,
      dev_path_repeat_equal:st.dev===again.dev,
      ino_path_repeat_equal:st.ino===again.ino,
      size_path_handle_equal:st.size===handle.size,
      mtime_path_handle_equal:st.mtimeNs===handle.mtimeNs,
      size_path_repeat_equal:st.size===again.size,
      mtime_path_repeat_equal:st.mtimeNs===again.mtimeNs,
      dev_path_is_zero:st.dev===0n,dev_handle_is_zero:handle.dev===0n,
      ino_path_is_zero:st.ino===0n,ino_handle_is_zero:handle.ino===0n});
  }finally{fs.closeSync(fd);}
}
let tmp;
try{
  probe('checked_in_synthetic_fixture',fixture);
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p531-'));
  const p=path.join(tmp,'synthetic.csv');
  fs.writeFileSync(p,Buffer.from('a,b\nS,1\n'),{flag:'wx',mode:0o600});
  probe('new_synthetic_temp_file',p);
  console.log(JSON.stringify({schema:'RAG_P531_IDENTITY_PROBE_V1',
    platform:process.platform,node:process.versions.node,metadata_only:true,
    no_path_source_values_or_real_ids_reported:true,checks:results},null,2));
}catch{console.log(JSON.stringify({schema:'RAG_P531_IDENTITY_PROBE_V1',
    platform:process.platform,node:process.versions.node,status:'PROBE_UNAVAILABLE'}));
  process.exitCode=2;
}finally{if(tmp)fs.rmSync(tmp,{recursive:true,force:true});}
