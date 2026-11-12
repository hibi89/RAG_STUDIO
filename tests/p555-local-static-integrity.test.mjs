import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readPinnedStaticAsset} from '../src/prep-owner-local-server.mjs';

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p555-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'prep-owner.js'),'const safe = true;');
 return root;
}
test('P5.55 regular allowlisted local UI bytes are readable',t=>{
 const root=fixture(t);
 assert.equal(readPinnedStaticAsset(root,'prep-owner.js').toString(),'const safe = true;');
 assert.throws(()=>readPinnedStaticAsset(root,'../../secret.txt'));
 assert.throws(()=>readPinnedStaticAsset(root,'sales-review.json'));
});
test('P5.55 missing, zero length and oversized UI assets are rejected',t=>{
 const root=fixture(t),file=path.join(root,'prep-owner.js');
 fs.truncateSync(file,0);assert.throws(()=>readPinnedStaticAsset(root,'prep-owner.js'));
 fs.writeFileSync(file,Buffer.alloc(256*1024+1,0x41));
 assert.throws(()=>readPinnedStaticAsset(root,'prep-owner.js'));
 fs.unlinkSync(file);assert.throws(()=>readPinnedStaticAsset(root,'prep-owner.js'));
});
test('P5.55 symlink or multiple hard-linked UI file cannot be served',t=>{
 const root=fixture(t),file=path.join(root,'prep-owner.js'),other=path.join(root,'other.js');
 try{fs.linkSync(file,other);}catch(e){if(['EPERM','ENOSYS','ENOTSUP','EACCES'].includes(e.code)){t.diagnostic('hardlink unavailable');return;}throw e;}
 assert.throws(()=>readPinnedStaticAsset(root,'prep-owner.js'));
 fs.unlinkSync(other);
 fs.unlinkSync(file);
 try{fs.symlinkSync(path.join(root,'real.js'),file,'file');}catch(e){if(['EPERM','ENOSYS','ENOTSUP','EACCES'].includes(e.code)){t.diagnostic('symlink unavailable');return;}throw e;}
 assert.throws(()=>readPinnedStaticAsset(root,'prep-owner.js'));
});
test('P5.55 file replacement during physical read fails closed',t=>{
 const root=fixture(t),file=path.join(root,'prep-owner.js'),moved=path.join(root,'original.js');
 const original=fs.readFileSync;
 let swapped=false;
 try{
  fs.readFileSync=function(target,...rest){
   if(typeof target==='number'&&!swapped){
    fs.renameSync(file,moved);
    fs.writeFileSync(file,'UNRELATED OWNER FILE');
    swapped=true;
   }
   return original.call(this,target,...rest);
  };
  assert.throws(()=>readPinnedStaticAsset(root,'prep-owner.js'),/STATIC_FILE_CHANGED/u);
 }finally{fs.readFileSync=original;}
 assert.equal(swapped,true);
 assert.equal(fs.readFileSync(file,'utf8'),'UNRELATED OWNER FILE');
});
test('P5.55 root directory swap during file read is rejected',t=>{
 const root=fixture(t),moved=root+'-moved',original=fs.readFileSync;
 let swapped=false;
 t.after(()=>{if(fs.existsSync(moved))fs.rmSync(moved,{recursive:true,force:true});});
 try{
  fs.readFileSync=function(target,...rest){
   if(typeof target==='number'&&!swapped){
    fs.renameSync(root,moved);
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root,'prep-owner.js'),'NOT ORIGINAL');
    swapped=true;
   }
   return original.call(this,target,...rest);
  };
  assert.throws(()=>readPinnedStaticAsset(root,'prep-owner.js'),/STATIC_FILE_CHANGED/u);
 }finally{fs.readFileSync=original;}
 assert.equal(swapped,true);
});
