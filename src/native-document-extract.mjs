/**
 * P5.12: bounded, local-only PDF (actual page) / DOCX (paragraph) text extraction.
 * These are *preview* citations, not authenticated source ownership or OCR.
 * Never evaluate PDF scripts, fetch URLs, render HTML, or guess DOCX page numbers.
 */
const MAX_BYTES=2*1024*1024;
const MAX_PAGES=50;
const MAX_PARAGRAPHS=500;
const MAX_CHARS=60000;
const MAX_LINE=3000;
const REPLACEMENT=/\uFFFD/u;
function reject(code){throw Object.assign(new Error('Local document preview unavailable'),{code:'NATIVE_DOC_'+code});}
function checked(bytes,kind){
 if(!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>MAX_BYTES)reject('SIZE_OR_BUFFER');
 if(!['pdf','docx'].includes(kind))reject('UNSUPPORTED_FORMAT');
}
function textLine(s){
 if(typeof s!=='string')reject('TEXT_INVALID');
 const result=s.normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/gu,' ').replace(/\s+/gu,' ').trim();
 if(REPLACEMENT.test(result))reject('INVALID_TEXT');
 return result;
}
function chunk(value,prefix){
 const words=value.split(/\s+/u),out=[];let line=prefix;
 for(const word of words){
   if(!word)continue;
   if(word.length>MAX_LINE-prefix.length-1)reject('UNSUPPORTED_LONG_TOKEN');
   if(line.length+word.length+1>MAX_LINE){out.push(line);line=prefix+word;}
   else line+=(line===prefix?'':' ')+word;
 }
 if(line!==prefix)out.push(line);
 return out;
}
export async function extractLocalDocument(bytes,kind){
 checked(bytes,kind);
 let lines=[],units=0;
 if(kind==='pdf'){
   if(!bytes.subarray(0,8).toString('latin1').startsWith('%PDF-'))reject('PDF_HEADER');
   let loading;
   try{
     const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
     loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,
       disableFontFace:true,stopAtErrors:true,disableAutoFetch:true,disableStream:true});
     const pdf=await loading.promise;
     if(pdf.numPages<1||pdf.numPages>MAX_PAGES)reject('PDF_PAGE_LIMIT');
     units=pdf.numPages;
     for(let p=1;p<=pdf.numPages;p++){
       const page=await pdf.getPage(p);
       const content=await page.getTextContent({disableNormalization:false});
       const body=textLine(content.items.filter(v=>typeof v.str==='string').map(v=>v.str).join(' '));
       if(body)lines.push(...chunk(body,'[PDF page '+p+'] '));
       page.cleanup();
     }
   }catch(e){
     if(e?.code?.startsWith('NATIVE_DOC_'))throw e;
     reject('PDF_PARSING_FAILED');
   }finally{try{await loading?.destroy();}catch{}}
 }else{
   if(bytes.readUInt32LE(0)!==0x04034b50)reject('DOCX_ZIP_HEADER');
   let result;
   try{
     const mammoth=(await import('mammoth')).default;
     result=await mammoth.extractRawText({buffer:Buffer.from(bytes)});
   }catch{reject('DOCX_PARSING_FAILED');}
   // Mammoth deliberately gives plain paragraphs, not layout/page coordinates.
   const paras=result.value.replace(/\r\n?/gu,'\n').split(/\n{2,}/u).map(textLine).filter(Boolean);
   if(paras.length<1||paras.length>MAX_PARAGRAPHS)reject('DOCX_PARAGRAPH_LIMIT');
   units=paras.length;
   for(let i=0;i<paras.length;i++)lines.push(...chunk(paras[i],'[DOCX paragraph '+(i+1)+'] '));
 }
 const total=lines.reduce((n,s)=>n+s.length,0);
 if(lines.length===0)reject('NO_EXTRACTABLE_TEXT'); // Scans/OCR are NOT silently accepted.
 if(lines.length>MAX_PARAGRAPHS||total>MAX_CHARS)reject('TEXT_LIMIT');
 if(lines.some(line=>line.length>MAX_LINE||line.includes('\u0000')))reject('TEXT_LIMIT');
 return Object.freeze({kind,status:'LOCAL_TEXT_EXTRACTED_UNVERIFIED_SOURCE',units,
   citation_unit:kind==='pdf'?'page':'paragraph',text:lines.join('\n')+'\n',
   lines:lines.length,ocr_performed:false,source_rights_verified:false,
   reviewer_identity_verified:false});
}
