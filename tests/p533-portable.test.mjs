import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {buildPortableMvp} from '../scripts/p533-build-portable.mjs';
import {verifyPortableMvp} from '../scripts/p533-verify-portable.mjs';
const make=t=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rag-mvp-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));return path.join(tmp,'rag-studio-mvp');};
test('P5.33 portable build copies fixed synthetic package without installing dependencies',t=>{
 const target=make(t),built=buildPortableMvp(target);
 assert.equal(built.status,'BUNDLE_CREATED');
 assert.ok(built.file_count>=25&&built.file_count<=80);
 assert.equal(fs.existsSync(path.join(target,'node_modules')),false);
 assert.equal(fs.existsSync(path.join(target,'.git')),false);
 assert.equal(fs.existsSync(path.join(target,'tests')),false);
 const ready=verifyPortableMvp(target);
 assert.equal(ready.status,'PORTABLE_MVP_INTEGRITY_PASS');
 assert.equal(ready.files_verified,built.file_count);
 assert.equal(ready.customer_data_approved,false);
 assert.equal(ready.not_signed,true);
});
test('P5.33 corrupted source refuses start (SHA) without mutating originals',t=>{
 const target=make(t);buildPortableMvp(target);
 const src=path.join(target,'ui','index.html');
 const raw=fs.readFileSync(src);
 fs.writeFileSync(src,Buffer.concat([raw,Buffer.from('\nTAMPERED\n')]));
 assert.equal(verifyPortableMvp(target).status,'PORTABLE_MVP_INTEGRITY_BLOCKED');
});
test('P5.33 missing source blocks portable demo',t=>{
 const target=make(t);buildPortableMvp(target);
 fs.unlinkSync(path.join(target,'src','dashboard-cli.mjs'));
 assert.equal(verifyPortableMvp(target).status,'PORTABLE_MVP_INTEGRITY_BLOCKED');
});
test('P5.33 destination must be new; never overwrite an owned folder',t=>{
 const target=make(t);buildPortableMvp(target);
 const prior=fs.readFileSync(path.join(target,'portable-manifest.json'));
 assert.throws(()=>buildPortableMvp(target),/DESTINATION_NOT_FRESH/);
 assert.deepEqual(fs.readFileSync(path.join(target,'portable-manifest.json')),prior);
});
test('P5.33 manifest rejects symlink substitution on supported hosts',t=>{
 const target=make(t);buildPortableMvp(target);
 const original=path.join(target,'ui','index.html'),backup=path.join(target,'ui','original.txt');
 fs.renameSync(original,backup);
 try{fs.symlinkSync(backup,original,'file');}
 catch{t.skip('symlink creation restricted on this host');return;}
 assert.equal(verifyPortableMvp(target).status,'PORTABLE_MVP_INTEGRITY_BLOCKED');
});


test('P5.59 fixed synthetic bundle excludes unapproved PREP and ZIP review modules',t=>{
 const target=make(t),built=buildPortableMvp(target);
 assert.ok(built.file_count>=25&&built.file_count<=80);
 const listing=JSON.parse(fs.readFileSync(path.join(target,'portable-manifest.json'),'utf8'));
 const names=listing.files.map(f=>f.relative_path);
 assert.ok(names.includes('src/dashboard-cli.mjs'));
 assert.ok(names.includes('src/review-hold-export.mjs'));
 assert.ok(!names.some(name=>name.startsWith('src/prep-')||name.startsWith('src/review-bundle-')||
  name==='src/review-zip-verify.mjs'));
 assert.equal(verifyPortableMvp(target).status,'PORTABLE_MVP_INTEGRITY_PASS');
});
test('P5.59 synthetic bundle failed write cannot delete swapped unrelated owner directory',t=>{
 const target=make(t),tmp=path.dirname(target),owner=path.join(tmp,'foreign-owner'),
  partial=path.join(tmp,'partial-from-build'),marker='NEVER DELETE';
 fs.mkdirSync(owner);fs.writeFileSync(path.join(owner,'marker.txt'),marker);
 const before=fs.readFileSync(path.join(owner,'marker.txt'));
 const original=fs.writeFileSync;let swapped=false;
 try{
  fs.writeFileSync=function(filename,...args){
   if(filename===path.join(target,'portable-manifest.json')){
    fs.renameSync(target,partial);fs.renameSync(owner,target);
    swapped=true;throw Error('SYNTHETIC_MANIFEST_DISK_FAILURE');
   }
   return original.call(this,filename,...args);
  };
  assert.throws(()=>buildPortableMvp(target),/SYNTHETIC_MANIFEST_DISK_FAILURE/u);
 }finally{fs.writeFileSync=original;}
 assert.equal(swapped,true);
 assert.deepEqual(fs.readFileSync(path.join(target,'marker.txt')),before);
 assert.equal(fs.existsSync(path.join(partial,'src/dashboard-cli.mjs')),true);
 assert.equal(fs.existsSync(path.join(partial,'portable-manifest.json')),false);
});
