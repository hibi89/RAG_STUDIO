/**
 * P5.11 MVP: open a locally selected AX_DATA_PACKAGE_V0 directory.
 * No uploads, auto-approval, arbitrary ZIP extraction, or cloud API.
 * This is a developer preview; ACCEPTED in a user-authored manifest is
 * not evidence of legal authorization or authenticated SMAX review.
 */
import path from 'node:path';
import {loadPackage} from './validate.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from './dashboard-server.mjs';

let server;
try {
  if(process.argv.length!==3 || !process.argv[2]?.trim())throw new Error('INPUT_REQUIRED');
  const root=path.resolve(process.argv[2]);
  const pkg=loadPackage(root);
  if(!pkg.manifest.files.every(file=>file.import_status==='ACCEPTED')||
     !pkg.manifest.datasets.every(ds=>ds.columns.every(col=>col.review_status==='APPROVED'))||
     pkg.manifest.documents.length<1)throw new Error('PACKAGE_NOT_READY');

  server=createDashboardServer({packageRoot:root});
  const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
  await listenDashboard(server,port);
  console.log('RAG Studio LOCAL FOLDER PREVIEW — SHA-checked AX_DATA_PACKAGE_V0 (read-only)');
  console.log('Selected files stay on this machine. Manifest approval is not independently authenticated.');
  console.log('Open this private session URL only on your own computer:');
  console.log(dashboardLaunchUrl(server));
  console.log('Stop with Ctrl+C. No customer-ready certification or SMAX Native verification.');
  let closing=false;
  const close=()=>{
    if(closing)return;
    closing=true;
    server.close(()=>{process.exitCode=0;});
  };
  process.once('SIGINT',close);
  process.once('SIGTERM',close);
} catch(error) {
  if(server?.listening)server.close();
  const code=error?.code==='EADDRINUSE'?'PORT_BUSY':
    error?.code==='EACCES'||error?.code==='EPERM'?'PORT_DENIED':
    process.argv.length!==3?'INPUT_REQUIRED':'PACKAGE_OR_PORT_INVALID';
  // Never echo system paths, filenames, manifest contents or exceptions.
  console.error('LOCAL_FOLDER_PREVIEW_BLOCKED: '+code);
  console.error('Usage: npm run open:package -- <verified-AX_DATA_PACKAGE_V0-folder>');
  process.exitCode=1;
}
