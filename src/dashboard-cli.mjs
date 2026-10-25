import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDashboardServer,listenDashboard} from './dashboard-server.mjs';
const defaultRoot=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const root=path.resolve(process.argv[2]||defaultRoot);
const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
try{
  const server=createDashboardServer({packageRoot:root});
  const address=await listenDashboard(server,port);
  console.log(`RAG Studio P3 local-only demo: ${address}`);
  console.log('Synthetic verified package; stop with Ctrl+C. No external API or user data uploads.');
}catch(err){console.error(`Dashboard startup failed: ${err.message}`);process.exitCode=1;}
