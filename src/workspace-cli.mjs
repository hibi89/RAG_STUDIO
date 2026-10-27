/**
 * P5.15: Explicit local AX package workspace chooser. No source scanning,
 * path upload, remote network, filesystem mutation, auto SMAX approval or deploy.
 */
import path from 'node:path';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from './dashboard-server.mjs';
let server;
try{
 const roots=process.argv.slice(2);
 if(roots.length<1||roots.length>8||roots.some(x=>typeof x!=='string'||!x.trim()))
   throw Object.assign(new Error('Input required'),{code:'INPUT'});
 // Every root is vetted before a listener exists, including actual fixed SQLite query.
 const paths=roots.map(x=>path.resolve(x));
 server=createDashboardServer({packageRoot:paths[0],projectRoots:paths});
 const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
 await listenDashboard(server,port);
 console.log('RAG STUDIO LOCAL WORKSPACE — '+roots.length+' explicitly selected verified AX projects');
 console.log('No automatic SMAX consent/rights, no arbitrary folder picker, no network deployment.');
 console.log('Session-only URL (do not share):');
 console.log(dashboardLaunchUrl(server));
 let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;server.close(()=>{process.exitCode=0;});};
 process.once('SIGINT',stop);
 process.once('SIGTERM',stop);
}catch(e){
 if(server?.listening)server.close();
 console.error('RAG_WORKSPACE_BLOCKED: '+(
   e?.code==='EADDRINUSE'?'PORT_BUSY':
   e?.code==='EACCES'||e?.code==='EPERM'?'PORT_PERMISSION':
   e?.code==='INPUT'?'INPUT_REQUIRED':'PROJECT_INVALID'));
 console.error('Usage: npm run workspace -- <verified-AX-package-folder> [other-verified-AX-folder ...]');
 process.exitCode=1;
}
