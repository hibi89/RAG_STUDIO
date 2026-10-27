/** Run the existing verified synthetic SMAX-shaped V1 producer-to-query route.
 * No arguments, no customer input; one local bearer-protected dashboard.
 */
import {openSyntheticSmaxVertical} from '../src/smax-vertical-mvp.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from '../src/dashboard-server.mjs';
let workspace,server;
try{
 if(process.argv.length!==2)throw Error('NO_CUSTOMER_INPUT_PERMITTED');
 workspace=openSyntheticSmaxVertical();
 server=createDashboardServer({packageRoot:workspace.root});
 const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
 await listenDashboard(server,port);
 console.log('RAG_STUDIO P5.34 SMAX-shaped SYNTHETIC MVP: V1 SHA/source rows -> verified AX -> read-only SQLite + cited TXT dashboard');
 console.log('Synthetic-only, no authenticated human review or Private SMAX Native; no real customer data approved.');
 console.log('Source verified, temporary workspace deleted on Ctrl+C.');
 console.log('Private localhost session URL (never share):');
 console.log(dashboardLaunchUrl(server));
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;
   server.closeAllConnections();
   server.close(()=>{workspace.cleanup();process.exitCode=0;});
 };
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 process.on('exit',()=>workspace.cleanup());
}catch{
 if(server?.listening){server.closeAllConnections();server.close();}
 workspace?.cleanup();
 console.error('SMAX_SYNTHETIC_MVP_BLOCKED: invalid fixture, source, environment or port.');
 process.exitCode=1;
}
