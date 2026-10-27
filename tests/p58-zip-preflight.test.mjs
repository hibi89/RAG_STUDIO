import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {inspectZipBytes} from '../src/zip-preflight.mjs';
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zip(items){const locals=[],centrals=[];let offset=0;
 for(const it of items){const name=Buffer.from(it.name),body=Buffer.from(it.body??'ok'),method=it.method??0,blob=method===8?deflateRawSync(body):body,crc=crc32(body),flags=it.flags??0;
  const local=Buffer.alloc(30),central=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(blob.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(it.unixType===undefined?20:0x0314,4);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(blob.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(((it.unixType??0)*65536)>>>0,38);central.writeUInt32LE(offset,42);
  locals.push(local,name,blob);centrals.push(central,name);offset+=local.length+name.length+blob.length;
 }
 const cd=Buffer.concat(centrals),eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50);eocd.writeUInt16LE(items.length,8);eocd.writeUInt16LE(items.length,10);eocd.writeUInt32LE(cd.length,12);eocd.writeUInt32LE(offset,16);return Buffer.concat([...locals,cd,eocd]);
}
const expectReject=(b,code)=>assert.throws(()=>inspectZipBytes(b),new RegExp('ZIP_PREFLIGHT_'+code));
test('P5.8 STORE and DEFLATE CRC-verified no extraction or approval',()=>{const r=inspectZipBytes(zip([{name:'sales.csv',body:'sku,amount\na,100\n'},{name:'docs/policy.txt',body:'반품 7일',method:8}]));assert.equal(r.entries,2);assert.equal(r.status,'STRUCTURE_VALID_ONLY');for(const k of ['extracted','content_authorized','ax_package_approved','malware_scanned'])assert.equal(r[k],false);});
test('P5.8 traversal, drive, ADS, slash, Windows device and trailing dot blocked',()=>{for(const name of ['../a.csv','a/../b.csv','/root.csv','C:/evil.csv','x\\evil.csv','dir//x.csv','dir/CON','AUX.txt','trailing./file.csv','f:stream','./x.csv'])expectReject(zip([{name}]),'UNSAFE_PATH');});
test('P5.8 duplicate paths including case folded paths blocked',()=>{expectReject(zip([{name:'Folder/File.csv'},{name:'folder/file.csv'}]),'DUPLICATE_PATH');});
test('P5.8 symlink and unsupported executable type blocked',()=>{expectReject(zip([{name:'link',unixType:0xa000}]),'NONREGULAR_FILE');});
test('P5.8 rejects encrypted, data descriptor and unsupported compression',()=>{expectReject(zip([{name:'x.csv',flags:1}]),'UNSUPPORTED_FLAGS');expectReject(zip([{name:'x.csv',flags:8}]),'UNSUPPORTED_FLAGS');expectReject(zip([{name:'x.csv',method:12}]),'UNSUPPORTED_METHOD');});
test('P5.8 rejects actual high ratio stream and large uncompressed file before inflation',()=>{expectReject(zip([{name:'bomb.txt',body:'a'.repeat(100000),method:8}]),'COMPRESSION_RATIO');expectReject(zip([{name:'big.txt',body:'b'.repeat(2*1024*1024+1)}]),'UNCOMPRESSED_LIMIT');});
test('P5.8 refuses forged uncompressed size and CRC instead of metadata-only pass',()=>{const b=zip([{name:'a.csv',body:'test'}]);b.writeUInt32LE(5,22);b.writeUInt32LE(5,b.indexOf(Buffer.from('PK\x01\x02','binary'))+24);expectReject(b,'STORED_SIZE_MISMATCH');const c=zip([{name:'a.csv',body:'test'}]);c[30+'a.csv'.length]^=1;expectReject(c,'PAYLOAD_MISMATCH');});
test('P5.8 central/local mismatch and ZIP64 marker cannot pass',()=>{const a=zip([{name:'a.csv'}]);a.writeUInt32LE(0,18);expectReject(a,'LOCAL_MISMATCH');const b=zip([{name:'a.csv'}]);const p=b.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));b.writeUInt32LE(0xffffffff,p+24);expectReject(b,'ZIP64_UNSUPPORTED');});
test('P5.8 tampered archive tail and structure gaps refused',()=>{const z=zip([{name:'a.csv'}]);expectReject(Buffer.concat([z,Buffer.from([1])]),'EOCD_REQUIRED');expectReject(Buffer.concat([Buffer.from('lead'),z]),'CENTRAL_BOUNDS');});
test('P5.8 entry count and total budgets enforced',()=>{expectReject(zip(Array.from({length:101},(_,i)=>({name:'file'+i+'.txt',body:''}))),'ENTRY_COUNT');const z=zip([{name:'a.csv',body:'x'}]);assert.throws(()=>inspectZipBytes(z,{limits:{maxArchiveBytes:1}}),/INVALID_LIMITS/);});
test('P5.8 empty and non-buffer reject closed',()=>{expectReject(Buffer.alloc(0),'TRUNCATED');assert.throws(()=>inspectZipBytes('zip'),/BUFFER_REQUIRED/);});
