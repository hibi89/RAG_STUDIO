/** P5.48: local-only static PREP owner draft UI. No data API or upload route. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=fileURLToPath(new URL('../ui/',import.meta.url));
const ROUTES=new Map([
  ['/',{file:'prep-owner.html',type:'text/html; charset=utf-8'}],
  ['/prep-owner.js',{file:'prep-owner.js',type:'text/javascript; charset=utf-8'}],
  ['/prep-owner.css',{file:'prep-owner.css',type:'text/css; charset=utf-8'}]
]);
const CSP="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Read only a regular, single-link static asset pinned across the whole read. */
export function readPinnedStaticAsset(root,name){
 if(!['prep-owner.html','prep-owner.js','prep-owner.css'].includes(name))throw Error('INVALID_STATIC_ASSET');
 const directoryBefore=fs.lstatSync(root);
 if(!directoryBefore.isDirectory()||directoryBefore.isSymbolicLink())throw Error('INVALID_STATIC_DIRECTORY');
 const target=path.join(root,name),before=fs.lstatSync(target);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size<1||before.size>256*1024)throw Error('INVALID_STATIC_FILE');
 let fd;
 try{
  fd=fs.openSync(target,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));
  const opened=fs.fstatSync(fd);
  if(!opened.isFile()||opened.nlink!==1||opened.dev!==before.dev||opened.ino!==before.ino||
     opened.size!==before.size||opened.mtimeMs!==before.mtimeMs)throw Error('STATIC_FILE_CHANGED');
  const bytes=fs.readFileSync(fd);
  const after=fs.fstatSync(fd),now=fs.lstatSync(target),directoryNow=fs.lstatSync(root);
  if(!now.isFile()||now.isSymbolicLink()||now.nlink!==1||now.dev!==opened.dev||now.ino!==opened.ino||
     now.size!==opened.size||now.mtimeMs!==opened.mtimeMs||
     after.dev!==opened.dev||after.ino!==opened.ino||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||
     directoryNow.isSymbolicLink()||!directoryNow.isDirectory()||
     directoryNow.dev!==directoryBefore.dev||directoryNow.ino!==directoryBefore.ino||
     bytes.length!==opened.size)throw Error('STATIC_FILE_CHANGED');
  return bytes;
 }finally{if(fd!==undefined)fs.closeSync(fd);}
}

function deny(res,code){res.writeHead(code,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':'0'});res.end();}
export function createPrepOwnerLocalServer(){
 return http.createServer((req,res)=>{
  try{
   const host=req.headers.host;
   if(typeof host!=='string'||!/^127\.0\.0\.1:\d{1,5}$/u.test(host))return deny(res,403);
   const origin=req.headers.origin;
   if(origin!==undefined && origin!==`http://${host}`)return deny(res,403);
   if(req.method!=='GET' && req.method!=='HEAD')return deny(res,405);
   const route=ROUTES.get(req.url);
   if(!route)return deny(res,404);
   const bytes=readPinnedStaticAsset(folder,route.file);
   res.writeHead(200,{'Content-Type':route.type,'Content-Length':String(bytes.length),
    'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
    'Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'});
   res.end(req.method==='HEAD'?undefined:bytes);
  }catch{deny(res,500);}
 });
}
