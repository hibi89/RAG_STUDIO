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
