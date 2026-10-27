/** P5.12 optional local PDF/DOCX extraction preview with private localhost UI. */
import path from 'node:path';
import {openNativeDocumentPreview} from './native-document-workspace.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from './dashboard-server.mjs';

let workspace,server;
try{
 if(process.argv.length!==4||!process.argv[2]?.trim()||!process.argv[3]?.trim())
   throw new Error('INPUT_REQUIRED');
 workspace=await openNativeDocumentPreview(path.resolve(process.argv[2]),path.resolve(process.argv[3]));
 server=createDashboardServer({packageRoot:workspace.root});
 const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
 await listenDashboard(server,port);
 console.log('RAG Studio local PDF/DOCX text preview — untrusted source, no upload.');
 console.log('PDF citation = page; DOCX citation = paragraph; OCR is not supported.');
 console.log('Private session URL (never share):');
 console.log(dashboardLaunchUrl(server));
 let closing=false;
 const close=()=>{if(closing)return;closing=true;server.close(()=>{workspace.cleanup();process.exitCode=0;});};
 process.once('SIGINT',close);process.once('SIGTERM',close);
 process.on('exit',()=>workspace.cleanup());
}catch(e){
 if(server?.listening)server.close();
 workspace?.cleanup();
 console.error('LOCAL_DOCUMENT_PREVIEW_BLOCKED: '+(
   e?.code==='EADDRINUSE'?'PORT_BUSY':e?.code==='EACCES'?'PORT_DENIED':
   e?.code?.startsWith('NATIVE_DOC_')?e.code:
   e?.code?.startsWith('NATIVE_IMPORT_')?e.code:'INVALID_INPUT_OR_RUNTIME'));
 console.error('Usage: npm run preview:document -- <verified-local-AX-package-folder> <local.pdf|local.docx>');
 process.exitCode=1;
}
