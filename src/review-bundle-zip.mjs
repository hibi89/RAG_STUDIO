/** P5.57: deterministic, uncompressed, offline ZIP of a verified review-only folder. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {verifyReviewBundle} from './review-bundle-verify.mjs';

const fail=()=>{throw Object.assign(new Error('RAG_REVIEW_ZIP_BLOCKED'),{code:'RAG_REVIEW_ZIP_BLOCKED'});};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const FIXED_DOS_DATE=33; // 1980-01-01, 00:00:00.
const MAX_MEMBER=300000;
const MAX_ARCHIVE=4*1024*1024;
function checkParent(name){
 if(typeof name!=='string'||!path.isAbsolute(name)||path.resolve(name)!==name||
    path.extname(name).toLowerCase()!=='.zip')fail();
 let cursor=path.parse(name).root;
 for(const part of path.relative(cursor,path.dirname(name)).split(path.sep)){
  if(!part||part==='.')continue;
  if(part==='..')fail();
  cursor=path.join(cursor,part);
  const stat=fs.lstatSync(cursor);
  if(!stat.isDirectory()||stat.isSymbolicLink())fail();
 }
 return fs.lstatSync(path.dirname(name));
}
function readPinned(name,expected){
 let fd;
 try{
  const before=fs.lstatSync(name);
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||
     before.size<1||before.size>MAX_MEMBER||
     (expected&&(before.size!==expected.size_bytes)))fail();
  fd=fs.openSync(name,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));
  const opened=fs.fstatSync(fd);
  if(!opened.isFile()||opened.nlink!==1||opened.ino!==before.ino||
     opened.dev!==before.dev||opened.size!==before.size||opened.mtimeMs!==before.mtimeMs)fail();
  const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),now=fs.lstatSync(name);
  if(bytes.length!==opened.size||after.ino!==opened.ino||after.dev!==opened.dev||
     after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||now.isSymbolicLink()||
     !now.isFile()||now.nlink!==1||now.ino!==opened.ino||now.dev!==opened.dev||
     now.size!==opened.size||now.mtimeMs!==opened.mtimeMs||
     (expected&&sha(bytes)!==expected.sha256))fail();
  return bytes;
 }catch{fail();}finally{if(fd!==undefined)fs.closeSync(fd);}
}
function crc32(bytes){
 let crc=0xffffffff;
 for(const octet of bytes){
  crc^=octet;
  for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
function deterministicStoreZip(items){
 const local=[],central=[];
 let offset=0,centralSize=0;
 for(const [name,bytes] of items){
  if(!/^(?:manifest\.json|(?:ui|src)\/[A-Za-z0-9.-]+|[A-Za-z0-9_.-]+)$/u.test(name)||
     bytes.length<1||bytes.length>MAX_MEMBER)fail();
  const filename=Buffer.from(name,'utf8'),n=filename.length,crc=crc32(bytes);
  if(n>255||offset>MAX_ARCHIVE)fail();
  const h=Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x0800,6);
  h.writeUInt16LE(0,8);h.writeUInt16LE(0,10);h.writeUInt16LE(FIXED_DOS_DATE,12);
  h.writeUInt32LE(crc,14);h.writeUInt32LE(bytes.length,18);h.writeUInt32LE(bytes.length,22);
  h.writeUInt16LE(n,26);h.writeUInt16LE(0,28);
  local.push(h,filename,bytes);
  const c=Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
  c.writeUInt16LE(0x0800,8);c.writeUInt16LE(0,10);c.writeUInt16LE(0,12);
  c.writeUInt16LE(FIXED_DOS_DATE,14);c.writeUInt32LE(crc,16);
  c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(bytes.length,24);
  c.writeUInt16LE(n,28);c.writeUInt16LE(0,30);c.writeUInt16LE(0,32);
  c.writeUInt16LE(0,34);c.writeUInt16LE(0,36);c.writeUInt32LE(0,38);
  c.writeUInt32LE(offset,42);
  central.push(c,filename);
  offset+=h.length+n+bytes.length;centralSize+=c.length+n;
 }
 if(items.length!==11||offset+centralSize+22>MAX_ARCHIVE)fail();
 const e=Buffer.alloc(22);
 e.writeUInt32LE(0x06054b50,0);
 e.writeUInt16LE(items.length,8);e.writeUInt16LE(items.length,10);
 e.writeUInt32LE(centralSize,12);e.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,e]);
}
export function exportVerifiedReviewZip(root,outputZip){
 try{
  if(typeof root!=='string'||!path.isAbsolute(root)||path.resolve(root)!==root)fail();
  if(typeof outputZip!=='string'||!path.isAbsolute(outputZip)||path.resolve(outputZip)!==outputZip)fail();
  const relative=path.relative(root,outputZip);
  if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))fail();
  if(fs.existsSync(outputZip))fail();
  const parentBefore=checkParent(outputZip);
  const check=verifyReviewBundle(root);
  if(check.status!=='RAG_REVIEW_BUNDLE_INTEGRITY_PASS')fail();
  const manifestBuffer=readPinned(path.join(root,'manifest.json'));
  const manifest=JSON.parse(manifestBuffer.toString('utf8'));
  const items=[['manifest.json',manifestBuffer]];
  for(const file of manifest.files)items.push([file.relative_path,readPinned(path.join(root,file.relative_path),file)]);
  if(verifyReviewBundle(root).status!=='RAG_REVIEW_BUNDLE_INTEGRITY_PASS')fail();
  const zip=deterministicStoreZip(items);
  // A create-only ZIP is safer than any rollback/delete after write errors:
  // the path could be replaced by another process. Partial output stays HOLD.
  let fd;
  try{
   fd=fs.openSync(outputZip,'wx',0o600);
   let pos=0;
   while(pos<zip.length){
    const count=fs.writeSync(fd,zip,pos,zip.length-pos,pos);
    if(count<=0)fail();
    pos+=count;
   }
   fs.fsyncSync(fd);
   const written=fs.fstatSync(fd);
   const actual=fs.lstatSync(outputZip),parentNow=fs.lstatSync(path.dirname(outputZip));
   if(written.size!==zip.length||actual.isSymbolicLink()||!actual.isFile()||
      written.dev!==actual.dev||written.ino!==actual.ino||
      parentNow.isSymbolicLink()||!parentNow.isDirectory()||
      parentNow.dev!==parentBefore.dev||parentNow.ino!==parentBefore.ino)fail();
  }finally{if(fd!==undefined)fs.closeSync(fd);}
  return Object.freeze({status:'RAG_REVIEW_ZIP_CREATED_NOT_APPROVED',
   sha256:sha(zip),size_bytes:zip.length,files:items.length,
   approval:'NOT_GRANTED',customer_data_approved:false,source_modified:false,remote_upload:false});
 }catch{fail();}
}
