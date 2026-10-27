/** P5.12 optional local PDF/DOCX extraction preview with private localhost UI. */
import path from 'node:path';
import {openNativeDocumentPreview} from './native-document-workspace.mjs';
import {openNativeDocumentCollectionPreview} from './native-document-collection.mjs';
import {createDashboardServer,listenDashboard,dashboardLaunchUrl} from './dashboard-server.mjs';

let workspace,server;
try{
 if(process.argv.length<4||process.argv.length>7||process.argv.slice(2).some(x=>!x?.trim()))
   throw new Error('INPUT_REQUIRED');
 const root=path.resolve(process.argv[2]);
 const selected=process.argv.slice(3).map(value=>path.resolve(value));
 workspace=selected.length===1
  ?await openNativeDocumentPreview(root,selected[0])
  :await openNativeDocumentCollectionPreview(root,selected);
 server=createDashboardServer({packageRoot:workspace.root});
 const port=process.env.RAG_DASHBOARD_PORT===undefined?8765:Number(process.env.RAG_DASHBOARD_PORT);
 await listenDashboard(server,port);
 console.log('RAG Studio local PDF/DOCX text preview — up to 4 selected files, no upload.');
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
   e?.code?.startsWith('NATIVE_IMPORT_')?e.code:
   e?.code?.startsWith('NATIVE_COLLECTION_')?e.code:'INVALID_INPUT_OR_RUNTIME'));
 console.error('Usage: npm run preview:document -- <verified-local-AX-package-folder> <one-to-four local.pdf|local.docx files>');
 process.exitCode=1;
}
