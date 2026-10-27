import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildNativePortable} from '../scripts/p543-native-portable.mjs';
import {verifyNativePortable} from '../scripts/p543-verify-native-portable.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('P5.43 refuses in-place overwrite and relative bundle output',()=>{
 assert.throws(()=>buildNativePortable('relative/output'),{code:'FRESH_ABSOLUTE_DESTINATION_REQUIRED'});
 assert.throws(()=>buildNativePortable(root),{code:'FRESH_ABSOLUTE_DESTINATION_REQUIRED'});
});
test('P5.43 absent or malformed bundle contract is refused without touching originals',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p543-invalid-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.equal(verifyNativePortable(dir).status,'NATIVE_PORTABLE_INTEGRITY_BLOCKED');
 fs.writeFileSync(path.join(dir,'native-portable-manifest.json'),'{"contract":"WRONG"}');
 assert.equal(verifyNativePortable(dir).status,'NATIVE_PORTABLE_INTEGRITY_BLOCKED');
});
test('P5.43 portable launcher refuses bypass of self-check and has no auto installer',()=>{
 const cmd=fs.readFileSync(path.join(root,'RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd'),'utf8');
 assert.match(cmd,/if exist "native-portable-manifest\.json"/);
 assert.match(cmd,/node "scripts\\p543-verify-native-portable\.mjs"/);
 assert.match(cmd,/if errorlevel 1 \([\s\S]*echo Native preview bundle integrity check failed/);
 assert.doesNotMatch(cmd,/npm ci\s+--|curl |Invoke-WebRequest/iu);
});
test('P5.43 single local verification command is immutable-fixture, uses temp reports',()=>{
 const src=fs.readFileSync(path.join(root,'verify_local.ps1'),'utf8');
 assert.match(src,/rag-studio-verify-/);
 assert.match(src,/RAG_STUDIO_LOCAL_VERIFY_V1/);
 assert.match(src,/function Execute-Step/);
 assert.match(src,/\[switch\]\$Quick/);
 assert.match(src,/test:gold/);
 assert.match(src,/test:negative/);
 assert.match(src,/test:heldout/);
 assert.doesNotMatch(src,/Remove-Item|npm install|npm ci|git reset|git clean/iu);
});
test('P5.43 owner accelerated protocol persisted without mandatory repeat-doc edits',()=>{
 const src=fs.readFileSync(path.join(root,'AGENTS.md'),'utf8');
 assert.match(src,/개발 가속 프로토콜/);
 assert.match(src,/verify_local\.ps1/);
 assert.match(src,/fast-forward/);
 assert.match(src,/문서만/);
});
