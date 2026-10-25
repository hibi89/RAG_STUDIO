import {fail,loadPackage} from './validate.mjs';

function positiveInteger(value,label,allowZero=true){
  if (!/^(0|[1-9][0-9]*)$/.test(value) || (!allowZero&&value==='0')) fail(`${label}: unsigned integer expected`);
  return BigInt(value);
}
export function aggregateSales(root){
  const pkg=loadPackage(root);
  const dataset=pkg.manifest.datasets.find(x=>x.dataset_id==='dataset-sales');
  if(!dataset) fail('dataset-sales not declared');
  const file=pkg.fileMap.get(dataset.file_id);
  if(file.import_status!=='ACCEPTED' || dataset.columns.some(c=>c.review_status!=='APPROVED')) fail('dataset requires review');
  const content=pkg.textMap.get(dataset.file_id);
  const lines=content.replace(/\r\n/g,'\n').trimEnd().split('\n');
  const expected=['order_id','sku','quantity','unit_price_krw','amount_krw'];
  if(lines[0]!==expected.join(',')) fail('sales: unexpected header or unsupported CSV syntax');
  const actualCols=dataset.columns.map(c=>c.name);
  if(expected.some((x,i)=>x!==actualCols[i]) || dataset.columns.some(c=>c.source_column!==c.name)) fail('sales: schema/field mapping mismatch');
  let total=0n, units=0n;
  const evidence=[];
  for(let index=1;index<lines.length;index++){
    const parts=lines[index].split(',');
    if(parts.length!==5 || parts.some(x=>x.includes('"'))) fail(`sales: invalid row line ${index+1}`);
    const [order,sku,qtyStr,priceStr,amountStr]=parts;
    if(!/^[A-Z0-9-]{1,40}$/.test(order)||!/^[A-Z0-9-]{1,40}$/.test(sku)) fail('sales: invalid identifier');
    const qty=positiveInteger(qtyStr,'quantity',false);
    const unit=positiveInteger(priceStr,'unit_price_krw');
    const amount=positiveInteger(amountStr,'amount_krw');
    if(qty*unit!==amount) fail(`sales: inconsistent amount line ${index+1}`);
    total+=amount; units+=qty;
    evidence.push({file_id:dataset.file_id,csv_line:index+1,order_id:order,amount_krw:amount.toString()});
  }
  if(lines.length-1!==dataset.row_count) fail('sales: row_count mismatch');
  const doc=pkg.manifest.documents.find(d=>d.document_id==='document-returns');
  if(!doc || pkg.fileMap.get(doc.file_id).import_status!=='ACCEPTED' || !pkg.textMap.get(doc.file_id)) fail('document source pointer unavailable');
  return {schema_version:pkg.manifest.schema_version,project_id:pkg.manifest.project_id,orders:dataset.row_count,units:units.toString(),revenue_krw:total.toString(),dataset_file_id:dataset.file_id,row_evidence:evidence,document_source:{document_id:doc.document_id,file_id:doc.file_id,title:doc.source_title,page_info:doc.page_info,excerpt:pkg.textMap.get(doc.file_id).split(/\r?\n/)[1]}};
}
