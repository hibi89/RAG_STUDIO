/** P5.49 local, read-only metadata/aggregate review of owner draft + public SMAX V1. */
import fs from 'node:fs';
import path from 'node:path';
import {inspectCsvBytes} from './local-csv-review.mjs';
import {parseRagPrepDraft} from './prep-mapping-draft.mjs';
import {verifyRagPrepSmaxBoundary} from './prep-smax-boundary.mjs';
function safeRead(filename,extension,max){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||path.extname(filename).toLowerCase()!==extension)throw Error('BLOCKED');
 const resolved=path.resolve(filename),parts=path.relative(path.parse(resolved).root,resolved).split(path.sep);
 let current=path.parse(resolved).root;
 for(const part of parts){if(!part||part==='.'||part==='..')throw Error('BLOCKED');
  current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('BLOCKED');}
 const start=fs.lstatSync(resolved);
 if(!start.isFile()||start.size<1||start.size>max)throw Error('BLOCKED');
 const fd=fs.openSync(resolved,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{const before=fs.fstatSync(fd);
  if(!before.isFile()||before.dev!==start.dev||before.ino!==start.ino||before.size!==start.size||before.mtimeMs!==start.mtimeMs)throw Error('BLOCKED');
  const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),live=fs.lstatSync(resolved);
  if(bytes.length!==before.size||after.dev!==before.dev||after.ino!==before.ino||after.size!==before.size||after.mtimeMs!==before.mtimeMs||
     live.isSymbolicLink()||live.dev!==before.dev||live.ino!==before.ino||live.size!==before.size||live.mtimeMs!==before.mtimeMs)throw Error('BLOCKED');
  return bytes;
 }finally{fs.closeSync(fd);}
}
try{
 if(process.argv.length!==5)throw Error('ARGUMENTS');
 const source=safeRead(process.argv[2],'.csv',1024*1024);
 const draft=parseRagPrepDraft(safeRead(process.argv[3],'.json',16*1024));
 const pkg=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(safeRead(process.argv[4],'.json',4*1024*1024)));
 const report=verifyRagPrepSmaxBoundary(inspectCsvBytes(source),draft,pkg,source);
 const second=safeRead(process.argv[2],'.csv',1024*1024);
 if(!source.equals(second))throw Error('SOURCE_CHANGED');
 process.stdout.write(JSON.stringify(report)+'\n');
}catch{
 process.stdout.write(JSON.stringify({status:'PREP_SMAX_BOUNDARY_BLOCKED',ax_package_created:false})+'\n');
 process.exitCode=1;
}
