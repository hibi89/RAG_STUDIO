import {fileURLToPath} from 'node:url';
import {searchDocuments} from './document-search.mjs';
const fallback=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const root=process.argv[2]||fallback;
const question=process.argv.slice(3).join(' ')||'반품 신청 기간과 배송 준비 기간을 알려줘';
try { console.log(JSON.stringify(searchDocuments(root,question),null,2)); }
catch(e) { console.error(String(e.message));process.exitCode=1; }
