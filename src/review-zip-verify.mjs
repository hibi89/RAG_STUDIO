/** P5.58 offline pre-extraction verification for the fixed local review-only ZIP.
 * Checks structure and internal consistency; neither this nor SHA authenticates rights.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateReviewConsistency} from './review-bundle-verify.mjs';

const FILES=Object.freeze(['ui/prep-owner.html','ui/prep-owner.js','ui/prep-owner.css',
 'src/prep-owner-local-server.mjs','src/prep-owner-serve-cli.mjs','src/review-bundle-verify.mjs',
 'sales-review.json','mixed-review.json','RUN_LOCAL_REVIEW_WINDOWS.cmd','RUN_LOCAL_REVIEW_UNIX.sh']);
const MAX_ZIP=4*1024*1024, MAX_FILE=300000;
const blocked=()=>{throw Object.assign(new Error('RAG_REVIEW_ZIP_INVALID'),{code:'RAG_REVIEW_ZIP_INVALID'});};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function crc32(buf){let v=0xffffffff;for(const b of buf){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return (v^0xffffffff)>>>0;}
function pinnedBytes(name){
 let fd;
 try{
  if(typeof name!=='string'||!path.isAbsolute(name)||path.resolve(name)!==name||
     path.extname(name).toLowerCase()!=='.zip')blocked();
  const before=fs.lstatSync(name);
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size<100||before.size>MAX_ZIP)blocked();
  fd=fs.openSync(name,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));
  const opened=fs.fstatSync(fd);
  if(!opened.isFile()||opened.nlink!==1||opened.dev!==before.dev||opened.ino!==before.ino||
     opened.size!==before.size||opened.mtimeMs!==before.mtimeMs)blocked();
  const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),now=fs.lstatSync(name);
  if(bytes.length!==opened.size||!now.isFile()||now.isSymbolicLink()||now.nlink!==1||
     now.dev!==opened.dev||now.ino!==opened.ino||now.size!==opened.size||
     now.mtimeMs!==opened.mtimeMs||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs)blocked();
  return bytes;
 }catch{blocked();}finally{if(fd!==undefined)fs.closeSync(fd);}
}
function verifyZipBytes(buf){
 const end=buf.length-22;
 if(buf.readUInt32LE(end)!==0x06054b50||buf.readUInt16LE(end+4)!==0||
    buf.readUInt16LE(end+6)!==0||buf.readUInt16LE(end+8)!==11||
    buf.readUInt16LE(end+10)!==11||buf.readUInt16LE(end+20)!==0)blocked();
 const centralSize=buf.readUInt32LE(end+12),centralOffset=buf.readUInt32LE(end+16);
 if(centralOffset+centralSize!==end||centralOffset>MAX_ZIP)blocked();
 let nextLocal=0,nextCentral=centralOffset;
 const contents=new Map();
 for(let i=0;i<11;i++){
  if(nextCentral+46> end||buf.readUInt32LE(nextCentral)!==0x02014b50)blocked();
  const c=nextCentral;
  if(buf.readUInt16LE(c+4)!==20||buf.readUInt16LE(c+6)!==20||
     buf.readUInt16LE(c+8)!==0x800||buf.readUInt16LE(c+10)!==0||
     buf.readUInt16LE(c+12)!==0||buf.readUInt16LE(c+14)!==33)blocked();
  const crc=buf.readUInt32LE(c+16),sz=buf.readUInt32LE(c+20);
  const nameBytes=buf.readUInt16LE(c+28);
  if(sz!==buf.readUInt32LE(c+24)||sz===0||sz>MAX_FILE||nameBytes<1||nameBytes>255||
     buf.readUInt16LE(c+30)!==0||buf.readUInt16LE(c+32)!==0||
     buf.readUInt16LE(c+34)!==0||buf.readUInt16LE(c+36)!==0||
     buf.readUInt32LE(c+38)!==0||buf.readUInt32LE(c+42)!==nextLocal||
     c+46+nameBytes>end)blocked();
  const name=buf.subarray(c+46,c+46+nameBytes).toString('utf8');
  if(name!=='manifest.json'&&!FILES.includes(name)||contents.has(name)||
     Buffer.byteLength(name,'utf8')!==nameBytes||! /^[A-Za-z0-9_.\/-]+$/u.test(name))blocked();
  if(nextLocal+30+nameBytes+sz>centralOffset||buf.readUInt32LE(nextLocal)!==0x04034b50)blocked();
  const l=nextLocal;
  if(buf.readUInt16LE(l+4)!==20||buf.readUInt16LE(l+6)!==0x800||
     buf.readUInt16LE(l+8)!==0||buf.readUInt16LE(l+10)!==0||
     buf.readUInt16LE(l+12)!==33||buf.readUInt32LE(l+14)!==crc||
     buf.readUInt32LE(l+18)!==sz||buf.readUInt32LE(l+22)!==sz||
     buf.readUInt16LE(l+26)!==nameBytes||buf.readUInt16LE(l+28)!==0||
     !buf.subarray(l+30,l+30+nameBytes).equals(buf.subarray(c+46,c+46+nameBytes)))blocked();
  const data=buf.subarray(l+30+nameBytes,l+30+nameBytes+sz);
  if(crc32(data)!==crc)blocked();
  contents.set(name,data);
  nextLocal+=30+nameBytes+sz;
  nextCentral+=46+nameBytes;
 }
 if(nextLocal!==centralOffset||nextCentral!==end||contents.size!==11||
    !contents.has('manifest.json')||FILES.some(x=>!contents.has(x)))blocked();
 const manifest=JSON.parse(contents.get('manifest.json').toString('utf8'));
 if(!manifest||manifest.contract!=='RAG_PREP_REVIEW_BUNDLE_V1'||
    manifest.status!=='REVIEW_HOLD'||manifest.approval!=='NOT_GRANTED'||
    manifest.ax_package_created!==false||manifest.sqlite_imported!==false||
    manifest.remote_upload!==false||typeof manifest.source_sha256!=='string'||
    !/^[a-f0-9]{64}$/u.test(manifest.source_sha256)||
    !Array.isArray(manifest.files)||manifest.files.length!==10)blocked();
 const seen=new Set();
 for(const f of manifest.files){
  if(!f||!FILES.includes(f.relative_path)||seen.has(f.relative_path)||
     !Number.isSafeInteger(f.size_bytes)||f.size_bytes<1||f.size_bytes>MAX_FILE||
     typeof f.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(f.sha256))blocked();
  seen.add(f.relative_path);
  const buf=contents.get(f.relative_path);
  if(buf.length!==f.size_bytes||digest(buf)!==f.sha256)blocked();
 }
 const sales=JSON.parse(contents.get('sales-review.json').toString('utf8'));
 const mixed=JSON.parse(contents.get('mixed-review.json').toString('utf8'));
 validateReviewConsistency(manifest,sales,mixed);
 return Object.freeze({status:'RAG_REVIEW_ZIP_INTEGRITY_PASS_NOT_APPROVED',
  sha256:digest(buf),size_bytes:buf.length,files:11,approval:'NOT_GRANTED',
  customer_data_approved:false,remote_upload:false});
}
export function verifyOfflineReviewZip(name){try{return verifyZipBytes(pinnedBytes(name));}catch{blocked();}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==3)blocked();process.stdout.write(JSON.stringify(verifyOfflineReviewZip(process.argv[2]))+'\n');}
 catch{process.stderr.write('RAG_REVIEW_ZIP_INVALID\n');process.exitCode=2;}
}
