import {inflateRawSync} from 'node:zlib';

// Deliberately narrow, readonly ZIP parser for untrusted synthetic packages.
// Never extracts paths, persists input, executes content, or grants RAG approval.
const DEFAULT_LIMITS=Object.freeze({maxArchiveBytes:12*1024*1024,maxEntries:100,maxFileBytes:2*1024*1024,maxTotalBytes:10*1024*1024,maxRatio:50});
const decoder=new TextDecoder('utf-8',{fatal:true});
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc32(data){let crc=0xffffffff;for(let i=0;i<data.length;i++)crc=crcTable[(crc^data[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function reject(code){throw new Error('ZIP_PREFLIGHT_'+code);}
function nameSafe(name){
 if(!name||name.startsWith('/')||name.includes('\\')||name.includes('\0')||/[\u0000-\u001f\u007f]/u.test(name)|| /[<>"?*|:]/u.test(name)||name.endsWith('/')||name.length>240)reject('UNSAFE_PATH');
 const segments=name.split('/');
 if(segments.some(s=>!s||s==='.'||s==='..'||s.endsWith(' ')||s.endsWith('.')||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(s)))reject('UNSAFE_PATH');
 return name.normalize('NFC').toLowerCase();
}
function u16(b,p){if(p<0||p+2>b.length)reject('TRUNCATED');return b.readUInt16LE(p);}
function u32(b,p){if(p<0||p+4>b.length)reject('TRUNCATED');return b.readUInt32LE(p);}
function parsedName(b,at,len,flags){const raw=b.subarray(at,at+len);if(raw.length!==len)reject('TRUNCATED');if(!(flags&0x800)&&raw.some(x=>x>=0x80))reject('ENCODING');try{return decoder.decode(raw);}catch{reject('ENCODING');}}
/**
 * Validate a complete ZIP buffer without filesystem writes or arbitrary extraction.
 * Only STORE/DEFLATE, single-disk, non-encrypted, no-descriptor, no-ZIP64 files.
 * Returns counts only. It never represents business approval or antivirus scanning.
 */
export function inspectZipBytes(bytes,{limits=DEFAULT_LIMITS}={}){
 if(!Buffer.isBuffer(bytes))reject('BUFFER_REQUIRED');
 if(!limits||Object.keys(DEFAULT_LIMITS).some(k=>!Number.isSafeInteger(limits[k])||limits[k]<1||limits[k]>DEFAULT_LIMITS[k]))reject('INVALID_LIMITS');
 if(bytes.length>limits.maxArchiveBytes)reject('ARCHIVE_TOO_LARGE');
 if(bytes.length<22)reject('TRUNCATED');
 let eocd=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-22-65535);p--){if(u32(bytes,p)===0x06054b50 && p+22+u16(bytes,p+20)===bytes.length){eocd=p;break;}}
 if(eocd<0)reject('EOCD_REQUIRED');
 if(u16(bytes,eocd+4)!==0||u16(bytes,eocd+6)!==0||u16(bytes,eocd+8)!==u16(bytes,eocd+10))reject('MULTI_DISK');
 const count=u16(bytes,eocd+10),cdSize=u32(bytes,eocd+12),cdStart=u32(bytes,eocd+16);
 if(count===0||count>limits.maxEntries)reject('ENTRY_COUNT');
 if(cdStart===0xffffffff||cdSize===0xffffffff||count===0xffff)reject('ZIP64_UNSUPPORTED');
 if(cdStart+cdSize!==eocd||cdStart>=eocd)reject('CENTRAL_BOUNDS');
 let cursor=cdStart,total=0,lastLocalEnd=0;const paths=new Set();const methodCounts={store:0,deflate:0};
 for(let i=0;i<count;i++){
  if(cursor+46>eocd||u32(bytes,cursor)!==0x02014b50)reject('CENTRAL_INVALID');
  const madeBy=u16(bytes,cursor+4),flags=u16(bytes,cursor+8),method=u16(bytes,cursor+10);
  const checkCrc=u32(bytes,cursor+16),packed=u32(bytes,cursor+20),unpacked=u32(bytes,cursor+24),nameLen=u16(bytes,cursor+28),extraLen=u16(bytes,cursor+30),commentLen=u16(bytes,cursor+32);
  const disk=u16(bytes,cursor+34),attrs=u32(bytes,cursor+38),localOffset=u32(bytes,cursor+42);
  const end=cursor+46+nameLen+extraLen+commentLen;
  if(end>eocd||disk!==0)reject('CENTRAL_BOUNDS');
  let extraAt=cursor+46+nameLen;const extraEnd=extraAt+extraLen;while(extraAt<extraEnd){if(extraAt+4>extraEnd)reject('CENTRAL_BOUNDS');const extraId=u16(bytes,extraAt),extraSize=u16(bytes,extraAt+2);extraAt+=4+extraSize;if(extraAt>extraEnd)reject('CENTRAL_BOUNDS');if(extraId===0x0001)reject('ZIP64_UNSUPPORTED');}
  if(flags&~0x800)reject('UNSUPPORTED_FLAGS');
  if(method!==0&&method!==8)reject('UNSUPPORTED_METHOD');
  if(packed===0xffffffff||unpacked===0xffffffff||localOffset===0xffffffff)reject('ZIP64_UNSUPPORTED');
  if(madeBy>>>8===3){const type=(attrs>>>16)&0xf000;if(type!==0&&type!==0x8000)reject('NONREGULAR_FILE');}
  const name=parsedName(bytes,cursor+46,nameLen,flags);const key=nameSafe(name);
  if(paths.has(key))reject('DUPLICATE_PATH');paths.add(key);
  if(unpacked>limits.maxFileBytes||total+unpacked>limits.maxTotalBytes)reject('UNCOMPRESSED_LIMIT');
  if(unpacked>0 && (packed===0||unpacked/packed>limits.maxRatio))reject('COMPRESSION_RATIO');
  if(method===0&&packed!==unpacked)reject('STORED_SIZE_MISMATCH');
  if(localOffset<lastLocalEnd||localOffset+30>cdStart||u32(bytes,localOffset)!==0x04034b50)reject('LOCAL_INVALID');
  if(u16(bytes,localOffset+6)!==flags||u16(bytes,localOffset+8)!==method||u32(bytes,localOffset+14)!==checkCrc||u32(bytes,localOffset+18)!==packed||u32(bytes,localOffset+22)!==unpacked)reject('LOCAL_MISMATCH');
  const localNameLen=u16(bytes,localOffset+26),localExtraLen=u16(bytes,localOffset+28);
  if(localNameLen!==nameLen||!bytes.subarray(localOffset+30,localOffset+30+nameLen).equals(bytes.subarray(cursor+46,cursor+46+nameLen)))reject('LOCAL_MISMATCH');
  const dataAt=localOffset+30+localNameLen+localExtraLen;
  if(dataAt+packed>cdStart)reject('LOCAL_BOUNDS');
  const compressed=bytes.subarray(dataAt,dataAt+packed);
  let decoded;
  if(method===0)decoded=compressed;
  else{try{decoded=inflateRawSync(compressed,{maxOutputLength:Math.max(1,Math.min(limits.maxFileBytes,unpacked)+1)});}catch{reject('DEFLATE_INVALID');}}
  if(decoded.length!==unpacked||crc32(decoded)!==checkCrc)reject('PAYLOAD_MISMATCH');
  total+=unpacked;lastLocalEnd=dataAt+packed;
  methodCounts[method===0?'store':'deflate']++;
  cursor=end;
 }
 if(cursor!==eocd||lastLocalEnd!==cdStart)reject('STRUCTURE_GAP');
 return {contract:'rag.zip-preflight.v1',status:'STRUCTURE_VALID_ONLY',entries:count,uncompressed_bytes:total,methods:methodCounts,extracted:false,content_authorized:false,ax_package_approved:false,malware_scanned:false};
}
