/** Tiny deterministic actual PDF and OOXML .docx samples; synthetic test data only. */
const crcTable=Uint32Array.from({length:256},(_,i)=>{
 let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
 return c>>>0;
});
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
export function pdfFixture(pageTexts=['Product returns within 7 days','Shipping starts within 2 business days']){
 const objects=new Map(),kids=[];
 objects.set(1,'<< /Type /Catalog /Pages 2 0 R >>');
 objects.set(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 for(const [i,raw] of pageTexts.entries()){
   const page=4+i*2,stream=page+1;
   kids.push(page+' 0 R');
   const esc=raw.replace(/\\/gu,'\\\\').replace(/\(/gu,'\\(').replace(/\)/gu,'\\)');
   const body='BT /F1 14 Tf 52 720 Td ('+esc+') Tj ET\n';
   objects.set(page,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '+stream+' 0 R >>');
   objects.set(stream,'<< /Length '+Buffer.byteLength(body,'latin1')+' >>\nstream\n'+body+'endstream');
 }
 objects.set(2,'<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+kids.length+' >>');
 const max=Math.max(...objects.keys());let pdf='%PDF-1.4\n',offsets=[0];
 for(let n=1;n<=max;n++){offsets[n]=Buffer.byteLength(pdf,'latin1');pdf+=n+' 0 obj\n'+objects.get(n)+'\nendobj\n';}
 const xref=Buffer.byteLength(pdf,'latin1');
 pdf+='xref\n0 '+(max+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<=max;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+(max+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(pdf,'latin1');
}
function zip(files){
 const locals=[],centers=[];let off=0;
 for(const [filename,value] of Object.entries(files)){
   const n=Buffer.from(filename),body=Buffer.from(value),local=Buffer.alloc(30),center=Buffer.alloc(46),crc=crc32(body);
   local.writeUInt32LE(0x04034b50);local.writeUInt16LE(0x800,6);
   local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(n.length,26);
   center.writeUInt32LE(0x02014b50);center.writeUInt16LE(20,4);center.writeUInt16LE(0x800,8);
   center.writeUInt32LE(crc,16);center.writeUInt32LE(body.length,20);center.writeUInt32LE(body.length,24);center.writeUInt16LE(n.length,28);center.writeUInt32LE(off,42);
   locals.push(local,n,body);centers.push(center,n);off+=local.length+n.length+body.length;
 }
 const cd=Buffer.concat(centers),tail=Buffer.alloc(22);tail.writeUInt32LE(0x06054b50);tail.writeUInt16LE(Object.keys(files).length,8);tail.writeUInt16LE(Object.keys(files).length,10);tail.writeUInt32LE(cd.length,12);tail.writeUInt32LE(off,16);
 return Buffer.concat([...locals,cd,tail]);
}
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function docxFixture(paragraphs=['반품 규정 7일 이내','안전 점검 대상 부품입니다']){
 const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+
 paragraphs.map(s=>'<w:p><w:r><w:t>'+escape(s)+'</w:t></w:r></w:p>').join('')+
 '<w:sectPr/></w:body></w:document>';
 return zip({
   '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?>'+
   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
   '<Default Extension="xml" ContentType="application/xml"/>'+
   '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
   '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?>'+
   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
   'word/document.xml':doc
 });
}
