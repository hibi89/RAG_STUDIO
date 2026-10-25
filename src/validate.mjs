import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION = 'AX_DATA_PACKAGE_V0';
const statuses = ['ACCEPTED', 'NEEDS_REVIEW', 'REJECTED'];
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export function fail(message) { throw new Error(`AX_DATA_PACKAGE_V0: ${message}`); }
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name}: object required`);
  return value;
}
function keys(value, required, allowed, name) {
  object(value, name);
  for (const k of required) if (!Object.hasOwn(value,k)) fail(`${name}.${k}: required`);
  for (const k of Object.keys(value)) if (!allowed.includes(k)) fail(`${name}.${k}: unknown`);
}
function string(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: nonempty string required`);
}
function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label}: nonnegative safe integer required`);
}
function array(value, label) { if (!Array.isArray(value)) fail(`${label}: array required`); }
function id(value, label) {
  string(value,label);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) fail(`${label}: invalid identifier`);
}
export function safeRelativePath(name) {
  string(name,'relative_path');
  if (name.includes('\\') || name.includes('\0') || name.startsWith('/') || name.includes('//') || /^[a-z]:/i.test(name)) fail('relative_path: unsafe syntax');
  const segments=name.split('/');
  if (segments.some(s=>s==='.' || s==='..' || !s)) fail('relative_path: traversal');
  if (segments.some(s=>s.endsWith(' ')||s.endsWith('.'))) fail('relative_path: unsafe Windows name');
  return segments;
}
function readVerified(root, descriptor, maxBytes) {
  const segments=safeRelativePath(descriptor.relative_path);
  let current=root;
  for (const segment of segments) {
    current=path.join(current,segment);
    const st=fs.lstatSync(current);
    if (st.isSymbolicLink()) fail(`${descriptor.file_id}: symlink blocked`);
  }
  const st=fs.statSync(current);
  if (!st.isFile() || st.size > maxBytes || st.size !== descriptor.size_bytes) fail(`${descriptor.file_id}: file size/type mismatch`);
  const bytes=fs.readFileSync(current);
  if (bytes.length !== st.size || crypto.createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) fail(`${descriptor.file_id}: sha256 mismatch`);
  return textDecoder.decode(bytes);
}
export function loadPackage(packageRoot) {
  const root=fs.realpathSync(packageRoot);
  if (!fs.statSync(root).isDirectory()) fail('package root must be directory');
  const manifestStat=fs.lstatSync(path.join(root,'manifest.json'));
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size>256*1024) fail('manifest: invalid file');
  let manifest;
  try { manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')); }
  catch { fail('manifest: invalid JSON'); }
  keys(manifest,['schema_version','project_id','created_at_utc','files','datasets','documents','review_items','processing_summary'],['schema_version','project_id','created_at_utc','files','datasets','documents','review_items','processing_summary'],'manifest');
  if (manifest.schema_version!==VERSION) fail('unsupported schema_version');
  id(manifest.project_id,'project_id');
  if (typeof manifest.created_at_utc!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(manifest.created_at_utc) || Number.isNaN(Date.parse(manifest.created_at_utc))) fail('created_at_utc: UTC required');
  array(manifest.files,'files'); array(manifest.datasets,'datasets'); array(manifest.documents,'documents'); array(manifest.review_items,'review_items');
  if(manifest.files.length<2 || manifest.files.length>100) fail('files: count out of bounds');
  const fileMap=new Map(), paths=new Set(), textMap=new Map();
  for(const f of manifest.files){
    keys(f,['file_id','relative_path','kind','sha256','size_bytes','import_status'],['file_id','relative_path','kind','sha256','size_bytes','import_status'],'file');
    id(f.file_id,'file_id'); safeRelativePath(f.relative_path);
    if(fileMap.has(f.file_id)||paths.has(f.relative_path.toLowerCase())) fail('duplicate file_id/path');
    if(!['dataset','document'].includes(f.kind)||!statuses.includes(f.import_status)) fail('file: invalid kind/status');
    if(typeof f.sha256!=='string'|| !/^[a-f0-9]{64}$/.test(f.sha256)) fail('file: invalid sha256');
    integer(f.size_bytes,'size_bytes');
    fileMap.set(f.file_id,f); paths.add(f.relative_path.toLowerCase());
    if(f.import_status==='ACCEPTED') textMap.set(f.file_id,readVerified(root,f,2*1024*1024));
  }
  const datasetIds=new Set(), documentIds=new Set();
  for(const d of manifest.datasets){
    keys(d,['dataset_id','file_id','row_count','provenance_mode','columns'],['dataset_id','file_id','row_count','provenance_mode','columns'],'dataset');
    id(d.dataset_id,'dataset_id'); id(d.file_id,'dataset.file_id');
    if(datasetIds.has(d.dataset_id)) fail('duplicate dataset_id'); datasetIds.add(d.dataset_id);
    if(fileMap.get(d.file_id)?.kind!=='dataset') fail('dataset file reference broken');
    integer(d.row_count,'row_count');
    if(d.provenance_mode!=='csv_line_1_based') fail('unsupported row provenance');
    array(d.columns,'columns'); if(d.columns.length===0) fail('columns: empty');
    const colNames=new Set();
    for(const c of d.columns){
      keys(c,['name','type','source_column','review_status'],['name','type','source_column','review_status'],'column');
      string(c.name,'column.name'); string(c.source_column,'source_column');
      if(colNames.has(c.name)) fail('duplicate column'); colNames.add(c.name);
      if(!['string','integer','decimal'].includes(c.type)|| !['APPROVED','NEEDS_REVIEW','UNKNOWN'].includes(c.review_status)) fail('column: invalid type/review');
    }
  }
  for(const d of manifest.documents){
    keys(d,['document_id','file_id','language','source_title','page_info','index_status'],['document_id','file_id','language','source_title','page_info','index_status'],'document');
    id(d.document_id,'document_id'); id(d.file_id,'document.file_id');
    if(documentIds.has(d.document_id)) fail('duplicate document_id'); documentIds.add(d.document_id);
    if(fileMap.get(d.file_id)?.kind!=='document') fail('document file reference broken');
    string(d.language,'language'); string(d.source_title,'source_title'); string(d.page_info,'page_info');
    if(!['NOT_INDEXED','INDEXED'].includes(d.index_status)) fail('document: invalid index status');
  }
  for(const r of manifest.review_items){
    keys(r,['item_id','source_file_id','reason_code','status'],['item_id','source_file_id','reason_code','status'],'review_item');
    id(r.item_id,'review.item_id'); id(r.source_file_id,'review.source_file_id'); string(r.reason_code,'reason_code');
    if(!fileMap.has(r.source_file_id) || !['OPEN','RESOLVED'].includes(r.status)) fail('review: invalid reference/status');
  }
  const summary=manifest.processing_summary;
  keys(summary,['accepted','needs_review','rejected','failed_file_ids','unsupported'],['accepted','needs_review','rejected','failed_file_ids','unsupported'],'processing_summary');
  for(const k of ['accepted','needs_review','rejected']){
    integer(summary[k],`summary.${k}`);
    if(summary[k]!==manifest.files.filter(f=>f.import_status===k.toUpperCase()).length) fail(`summary: ${k} mismatch`);
  }
  array(summary.failed_file_ids,'failed_file_ids'); array(summary.unsupported,'unsupported');
  for(const fid of summary.failed_file_ids) if(!fileMap.has(fid) || fileMap.get(fid).import_status==='ACCEPTED') fail('failed_file_ids: invalid reference');
  for(const item of summary.unsupported) string(item,'unsupported item');
  return {manifest,fileMap,textMap};
}
