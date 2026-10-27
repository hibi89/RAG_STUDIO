/** Explicit operator-selected, local-only TXT/MD preview dashboard. */
import path from 'node:path';
import {openLocalTextPreview} from './local-text-workspace.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from './dashboard-server.mjs';
let workspace,server;
try{
 const args=process.argv.slice(2);
 if(args.length<2||args.length>5||args.some(x=>!x.trim()))
   throw Object.assign(new Error('INPUT_REQUIRED'),{code:'LOCAL_TEXT_INPUT_REQUIRED'});
 workspace=openLocalTextPreview(path.resolve(args[0]),args.slice(1).map(x=>path.resolve(x)));
 server=createDashboardServer({packageRoot:workspace.root});
 const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
 await listenDashboard(server,port);
 console.log('RAG Studio temporary LOCAL TEXT preview — '+workspace.added_documents+' TXT/MD file(s).');
 console.log('Local data stays on this computer; no SMAX rights/consent certification.');
 console.log('Private session link (never share):');
 console.log(dashboardLaunchUrl(server));
 let stopping=false;
 const stop=()=>{
   if(stopping)return;stopping=true;
   server.close(()=>{workspace.cleanup();process.exitCode=0;});
 };
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 process.on('exit',()=>workspace.cleanup());
}catch(e){
 if(server?.listening)server.close();
 workspace?.cleanup();
 console.error('LOCAL_TEXT_PREVIEW_BLOCKED: '+(
   e?.code==='EADDRINUSE'?'PORT_BUSY':
   e?.code==='EACCES'||e?.code==='EPERM'?'PORT_DENIED':
   typeof e?.code==='string'&&e.code.startsWith('LOCAL_TEXT_')?e.code:'INPUT_INVALID'));
 console.error('Usage: npm run preview:text -- <verified-AX-folder> <file.txt|file.md> [up to 4 files]');
 process.exitCode=1;
}
