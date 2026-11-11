import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPrepOwnerLocalServer} from '../src/prep-owner-local-server.mjs';
const base=fileURLToPath(new URL('../',import.meta.url));
async function fixture(t){const s=createPrepOwnerLocalServer();await new Promise((resolve,reject)=>s.listen(0,'127.0.0.1',resolve).once('error',reject));t.after(()=>new Promise(resolve=>s.close(resolve)));return s.address().port;}
function fetch(port,pathname,options={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:pathname,method:options.method||'GET',headers:options.headers||{}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({code:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end(options.body);});}
test('P5.48 only the 3 static assets are served with real original bytes',async t=>{const p=await fixture(t);for(const [route,file] of [['/','prep-owner.html'],['/prep-owner.js','prep-owner.js'],['/prep-owner.css','prep-owner.css']]){const r=await fetch(p,route);assert.equal(r.code,200);assert.equal(r.body,fs.readFileSync(path.join(base,'ui',file),'utf8'));assert.equal(r.headers['cache-control'],'no-store');}});
test('P5.48 connection is fixed loopback; strict CSP forbids outgoing network',async t=>{const p=await fixture(t);const r=await fetch(p,'/');assert.match(r.headers['content-security-policy'],/connect-src 'none'/);assert.equal(r.headers['x-frame-options'],'DENY');assert.equal(r.headers['referrer-policy'],'no-referrer');assert.equal(r.headers['access-control-allow-origin'],undefined);});
test('P5.48 Host spoofing and cross-origin request rejected',async t=>{const p=await fixture(t);for(const headers of [{Host:'example.org'},{Host:'localhost:'+p},{Origin:'http://evil.example'},{Origin:'null'}]){const r=await fetch(p,'/',{headers});assert.equal(r.code,403);assert.equal(r.body,'');}});
test('P5.48 no file browsing, upload, query, data or arbitrary endpoints',async t=>{const p=await fixture(t);for(const route of ['/../../etc/passwd','/%2e%2e/secret','/prep-owner.js?x=1','/api/read','/proposal.json','/favicon.ico','/index.html']){const r=await fetch(p,route);assert.equal(r.code,404,route);}const post=await fetch(p,'/',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"token":"do-not-send"}'});assert.equal(post.code,405);});
test('P5.48 HEAD request returns metadata but not document bytes',async t=>{const p=await fixture(t);const r=await fetch(p,'/prep-owner.js',{method:'HEAD'});assert.equal(r.code,200);assert.equal(r.body,'');assert.equal(Number(r.headers['content-length']),fs.statSync(path.join(base,'ui/prep-owner.js')).size);});
