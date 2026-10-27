/**
 * P5.10 MVP vertical slice: a bundled, known synthetic ZIP -> verified
 * temporary AX_DATA_PACKAGE_V0 -> existing SQLite/TXT dashboard.
 * Intentionally NOT an arbitrary customer ZIP importer or SMAX substitute.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {inspectZipBytes} from './zip-preflight.mjs';
import {loadPackage} from './validate.mjs';

const fixtureRoot=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const FILENAMES=Object.freeze(['manifest.json','sales.csv','returns_policy.txt','shipping_policy.txt']);
const PINNED=Object.freeze({
  'sales.csv':'8213907ae23423c34db415c0e31f8113eccceed9fdbc2bb4557e1b6ea31e03b9',
  'returns_policy.txt':'906d20338fc26e3e755abd24ed04cc62b9fd8d51c079805b073e4609d360a950',
  'shipping_policy.txt':'e263fc52d0b6ab7d3a2d06abc767b49ad0b7519869baea60599c75ba91773fed'
});
const table=Uint32Array.from({length:256},(_,index)=>{
  let v=index;for(let j=0;j<8;j++)v=(v&1)?(0xedb88320^(v>>>1)):(v>>>1);
  return v>>>0;
});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function refuse(code){throw Object.assign(new Error('Synthetic ZIP demo is unavailable'),{code:'RAG_DEMO_ZIP_'+code});}
function trustedFixtureBytes(){
  const files=new Map();
  for(const name of FILENAMES){
    const absolute=path.join(fixtureRoot,name);
    const stat=fs.lstatSync(absolute);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)refuse('FIXTURE_INVALID');
    const bytes=fs.readFileSync(absolute);
    if(PINNED[name]&&sha(bytes)!==PINNED[name])refuse('FIXTURE_CHANGED');
    files.set(name,bytes);
  }
  const original=loadPackage(fixtureRoot);
  if(original.manifest.project_id!=='synthetic-shop-001'||original.manifest.files.length!==3||
     original.manifest.files.some(x=>x.import_status!=='ACCEPTED'))refuse('FIXTURE_CHANGED');
  return files;
}
/** Deterministic in-memory ZIP generator; no disk writes, no external packages. */
export function buildBundledSyntheticZip(){
  const files=trustedFixtureBytes(),locals=[],centrals=[];let offset=0;
  for(const [name,body] of files){
    const filename=Buffer.from(name,'utf8');
    const local=Buffer.alloc(30),central=Buffer.alloc(46),crc=crc32(body);
    local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(0x0800,6);
    local.writeUInt32LE(crc,14);
    local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);
    local.writeUInt16LE(filename.length,26);
    central.writeUInt32LE(0x02014b50,0);
    central.writeUInt16LE(20,4);central.writeUInt16LE(0x0800,8);
    central.writeUInt32LE(crc,16);
    central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);
    central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,filename,body);
    centrals.push(central,filename);
    offset+=local.length+filename.length+body.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(FILENAMES.length,8);end.writeUInt16LE(FILENAMES.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  const bytes=Buffer.concat([...locals,directory,end]);
  inspectZipBytes(bytes);
  return bytes;
}
function verifiedMembers(zipBytes){
  // Full CRC/ratio/path/structure verification before accessing individual entries.
  const checked=inspectZipBytes(zipBytes);
  if(checked.entries!==FILENAMES.length)refuse('FILES_MISMATCH');
  const reference=trustedFixtureBytes();
  const tail=zipBytes.length-22;
  if(zipBytes.readUInt32LE(tail)!==0x06054b50||zipBytes.readUInt16LE(tail+20)!==0)
    refuse('UNSUPPORTED_LAYOUT');
  let cursor=zipBytes.readUInt32LE(tail+16);
  const members=new Map(),names=new Set();
  for(let i=0;i<checked.entries;i++){
    if(zipBytes.readUInt32LE(cursor)!==0x02014b50)refuse('UNSUPPORTED_LAYOUT');
    const method=zipBytes.readUInt16LE(cursor+10);
    const size=zipBytes.readUInt32LE(cursor+20);
    const nameLen=zipBytes.readUInt16LE(cursor+28),extraLen=zipBytes.readUInt16LE(cursor+30);
    const commentLen=zipBytes.readUInt16LE(cursor+32),localOffset=zipBytes.readUInt32LE(cursor+42);
    const name=new TextDecoder('utf-8',{fatal:true}).decode(zipBytes.subarray(cursor+46,cursor+46+nameLen));
    if(!reference.has(name)||names.has(name))refuse('FILES_MISMATCH');
    names.add(name);
    const start=localOffset+30+zipBytes.readUInt16LE(localOffset+26)+zipBytes.readUInt16LE(localOffset+28);
    const compressed=zipBytes.subarray(start,start+size);
    let data;
    try{data=method===0?Buffer.from(compressed):inflateRawSync(compressed,{maxOutputLength:2*1024*1024});}
    catch{refuse('CONTENTS_INVALID');}
    if(!data.equals(reference.get(name)))refuse('NOT_BUNDLED_SYNTHETIC');
    members.set(name,data);
    cursor+=46+nameLen+extraLen+commentLen;
  }
  if(members.size!==FILENAMES.length)refuse('FILES_MISMATCH');
  return members;
}
/**
 * Creates only a disposable copy of four byte-identical, pinned public fixtures.
 * Call cleanup when the local dashboard closes; no arbitrary customer input.
 */
export function openBundledSyntheticZipWorkspace(zipBytes){
  const members=verifiedMembers(zipBytes);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-synthetic-zip-'));
  let closed=false;
  const cleanup=()=>{if(!closed){closed=true;fs.rmSync(root,{recursive:true,force:true});}};
  try{
    for(const name of FILENAMES)fs.writeFileSync(path.join(root,name),members.get(name),{flag:'wx',mode:0o600});
    const pkg=loadPackage(root);
    if(pkg.manifest.project_id!=='synthetic-shop-001')refuse('PACKAGE_INVALID');
    return Object.freeze({root,cleanup,source:'BUNDLED_SYNTHETIC_ZIP_ONLY',
      customer_data_allowed:false,auto_approval:false});
  }catch(error){cleanup();throw error;}
}
