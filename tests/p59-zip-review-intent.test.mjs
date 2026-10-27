import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessZipReviewIntent,ZIP_REVIEW_INTENT_SCHEMA,ZIP_REVIEW_INTENT_ACKNOWLEDGEMENT} from '../src/zip-review-intent.mjs';

const table=Uint32Array.from({length:256},(_,i)=>{
  let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;
});
function crc32(b){let c=0xffffffff;for(const v of b)c=table[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function syntheticZip(text='synthetic data only',name='demo.txt'){
  const data=Buffer.from(text),filename=Buffer.from(name);
  const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
  const crc=crc32(data);
  local.writeUInt32LE(0x04034b50,0);
  local.writeUInt32LE(crc,14);
  local.writeUInt32LE(data.length,18);
  local.writeUInt32LE(data.length,22);
  local.writeUInt16LE(filename.length,26);
  const offset=30+filename.length+data.length;
  central.writeUInt32LE(0x02014b50,0);
  central.writeUInt16LE(20,4);
  central.writeUInt32LE(crc,16);
  central.writeUInt32LE(data.length,20);
  central.writeUInt32LE(data.length,24);
  central.writeUInt16LE(filename.length,28);
  const cdirSize=46+filename.length;
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(1,8);
  end.writeUInt16LE(1,10);
  end.writeUInt32LE(cdirSize,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([local,filename,data,central,filename,end]);
}
function declaration(bytes,override={}){
  return {
    schema_version:ZIP_REVIEW_INTENT_SCHEMA,
    archive_sha256:createHash('sha256').update(bytes).digest('hex'),
    scope:'LOCAL_OFFLINE_ASSESSMENT_ONLY',
    rights_attestation:'DECLARED_AUTHORIZED',
    privacy_attestation:'DECLARED_REVIEWED',
    semantic_review:'PENDING_SEPARATE_VALIDATION',
    decision:'REQUEST_TRUSTED_REVIEW',
    acknowledgement:ZIP_REVIEW_INTENT_ACKNOWLEDGEMENT,
    ...override
  };
}
const allFalse=['reviewer_identity_verified','ownership_or_license_verified',
  'privacy_compliance_verified','semantic_mapping_approved','malware_scanned',
  'import_authorized','extraction_allowed','ax_package_created','customer_data_allowed'];

test('P5.9 missing review never permits import',()=>{
  const bytes=syntheticZip();
  const result=assessZipReviewIntent(bytes);
  assert.equal(result.status,'REVIEW_NOT_RECORDED');
  assert.equal(result.structural_preflight_verified,true);
  assert.equal(result.requester_attestation_recorded,false);
  assert.equal(result.archive_sha256,declaration(bytes).archive_sha256);
  for(const key of allFalse)assert.equal(result[key],false,key);
  assert.ok(Object.isFrozen(result));
});
test('P5.9 full self-declaration remains untrusted, never approved',()=>{
  const bytes=syntheticZip(),result=assessZipReviewIntent(bytes,declaration(bytes));
  assert.equal(result.status,'UNTRUSTED_REVIEW_REQUEST_RECORDED');
  assert.equal(result.requester_attestation_recorded,true);
  assert.equal(result.entries,1);
  for(const key of allFalse)assert.equal(result[key],false,key);
  assert.equal(result.ax_package_created,false);
  assert.equal(Object.hasOwn(result,'approved'),false);
});
test('P5.9 explicit HOLD always blocks even when other claims are affirmative',()=>{
  const bytes=syntheticZip();
  assert.equal(assessZipReviewIntent(bytes,declaration(bytes,{decision:'HOLD'})).status,'REVIEW_HOLD');
});
test('P5.9 unresolved rights or privacy cannot request a trusted review',()=>{
  const bytes=syntheticZip();
  for(const patch of [{rights_attestation:'UNKNOWN'},{privacy_attestation:'UNKNOWN'},
    {rights_attestation:'UNKNOWN',privacy_attestation:'UNKNOWN'}]){
    const out=assessZipReviewIntent(bytes,declaration(bytes,patch));
    assert.equal(out.status,'REVIEW_HOLD');assert.equal(out.import_authorized,false);
  }
});
test('P5.9 binding to exact SHA refuses another individually valid archive',()=>{
  const a=syntheticZip('alpha'),b=syntheticZip('bravo');
  assert.notEqual(declaration(a).archive_sha256,declaration(b).archive_sha256);
  assert.throws(()=>assessZipReviewIntent(b,declaration(a)),{code:'ZIP_REVIEW_DECLARATION_INVALID'});
});
test('P5.9 original bytes mutated after proposal are revalidated',()=>{
  const bytes=syntheticZip('alpha'),review=declaration(bytes);
  bytes[30+'demo.txt'.length]^=1;
  assert.throws(()=>assessZipReviewIntent(bytes,review),/ZIP_PREFLIGHT_PAYLOAD_MISMATCH/);
});
test('P5.9 refuses uninspected malicious ZIP even with a completed declaration',()=>{
  const bad=syntheticZip('data','../escape.txt');
  assert.throws(()=>assessZipReviewIntent(bad,declaration(bad)),/ZIP_PREFLIGHT_UNSAFE_PATH/);
});
test('P5.9 forged approval keys cannot elevate review',()=>{
  const bytes=syntheticZip();
  for(const key of ['import_authorized','reviewer_identity_verified','customer_data_allowed']){
    const fake={...declaration(bytes),[key]:true};
    assert.throws(()=>assessZipReviewIntent(bytes,fake),{code:'ZIP_REVIEW_DECLARATION_INVALID'});
  }
});
test('P5.9 refuses arbitrary or missing schema/rights/privacy/acknowledgement',()=>{
  const bytes=syntheticZip();
  for(const patch of [
    {schema_version:'RAG_ZIP_REVIEW_INTENT_V2'},
    {rights_attestation:'VERIFIED'},
    {privacy_attestation:'CLEARED'},
    {acknowledgement:'YES'},
    {scope:'CUSTOMER_IMPORT_APPROVED'},
    {decision:'APPROVE_IMPORT'},
    {semantic_review:'APPROVED'}
  ])assert.throws(()=>assessZipReviewIntent(bytes,declaration(bytes,patch)),
    {code:'ZIP_REVIEW_DECLARATION_INVALID'});
});
test('P5.9 refuses accessor fields, arrays and non-string fields',()=>{
  const bytes=syntheticZip();
  assert.throws(()=>assessZipReviewIntent(bytes,[]),{code:'ZIP_REVIEW_DECLARATION_INVALID'});
  assert.throws(()=>assessZipReviewIntent(bytes,123),{code:'ZIP_REVIEW_DECLARATION_INVALID'});
  assert.throws(()=>assessZipReviewIntent(bytes,{...declaration(bytes),decision:true}),
    {code:'ZIP_REVIEW_DECLARATION_INVALID'});
  const obj=declaration(bytes);
  Object.defineProperty(obj,'decision',{enumerable:true,get(){throw Error('getter run');}});
  assert.throws(()=>assessZipReviewIntent(bytes,obj),{code:'ZIP_REVIEW_DECLARATION_INVALID'});
});
test('P5.9 summary returns no source filenames, original text or sensitive review fields',()=>{
  const bytes=syntheticZip('PRIVATE SYNTHETIC TEXT','confidential-demo.txt');
  const out=assessZipReviewIntent(bytes,declaration(bytes));
  const serialized=JSON.stringify(out);
  assert.doesNotMatch(serialized,/confidential-demo|PRIVATE SYNTHETIC|rights_attestation|acknowledgement|privacy_attestation/);
  assert.equal(out.uncompressed_bytes,Buffer.byteLength('PRIVATE SYNTHETIC TEXT'));
});
test('P5.9 malformed and unsupported input fails closed without catching ZIP errors',()=>{
  assert.throws(()=>assessZipReviewIntent(Buffer.alloc(0)),/ZIP_PREFLIGHT_TRUNCATED/);
  assert.throws(()=>assessZipReviewIntent('source ZIP'),/ZIP_PREFLIGHT_BUFFER_REQUIRED/);
});
