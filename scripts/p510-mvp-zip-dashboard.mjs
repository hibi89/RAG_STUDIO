/**
 * P5.10: one-command public synthetic ZIP -> verified SQLite/TXT dashboard.
 * The ZIP is generated from pinned checked-in fixtures, never from customers.
 */
import {buildBundledSyntheticZip,openBundledSyntheticZipWorkspace} from '../src/synthetic-zip-workspace.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';

let workspace,server;
try{
  workspace=openBundledSyntheticZipWorkspace(buildBundledSyntheticZip());
  server=createDashboardServer({packageRoot:workspace.root});
  const requestedPort=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
  await listenDashboard(server,requestedPort);
  console.log('RAG Studio — bundled synthetic ZIP -> validated AX package -> local dashboard');
  console.log('Local session URL (do not share):');
  console.log(dashboardLaunchUrl(server));
  console.log('Source: known synthetic ZIP only. No customer ZIP, network upload, or SMAX approval.');
  let stopping=false;
  const close=()=>{
    if(stopping)return;
    stopping=true;
    server.close(()=>{workspace.cleanup();process.exitCode=0;});
  };
  process.once('SIGINT',close);
  process.once('SIGTERM',close);
  process.on('exit',()=>workspace.cleanup());
}catch{
  if(server?.listening)server.close();
  workspace?.cleanup();
  console.error('Synthetic ZIP demo startup blocked: fixtures, package or local port unavailable.');
  process.exitCode=1;
}
