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
   const stat=fs.statSync(path.join(folder,route.file));
   if(!stat.isFile()||stat.size>256*1024)return deny(res,500);
   const bytes=fs.readFileSync(path.join(folder,route.file));
   res.writeHead(200,{'Content-Type':route.type,'Content-Length':String(bytes.length),
    'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
    'Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'});
   res.end(req.method==='HEAD'?undefined:bytes);
  }catch{deny(res,500);}
 });
}
