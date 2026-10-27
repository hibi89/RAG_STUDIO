import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from './dashboard-server.mjs';
const defaultRoot=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const root=path.resolve(process.argv[2]||defaultRoot);
const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
try{
  const server=createDashboardServer({packageRoot:root});
  await listenDashboard(server,port);
  console.log('RAG Studio P3.1 — browser launch URL (session-specific; do not share):');
  console.log(dashboardLaunchUrl(server));
  console.log('Synthetic verified package; stop with Ctrl+C. No external API or uploads.');
}catch(err){
  // Only fixed diagnostics: filesystem exceptions may contain private local paths.
  if(err?.code==='EADDRINUSE')console.error('Dashboard startup blocked: loopback port already in use.');
  else if(err?.code==='EACCES'||err?.code==='EPERM')console.error('Dashboard startup blocked: loopback port permission denied.');
  else console.error('Dashboard startup blocked: package, runtime or port validation failed.');
  process.exitCode=1;
}
