/**
 * P5.9: local-only, readonly ZIP review *intent* boundary.
 * A caller-supplied form does NOT authenticate a reviewer, prove ownership,
 * scan for malware, or authorize import. There is deliberately no export path.
 */
import {createHash} from 'node:crypto';
import {inspectZipBytes} from './zip-preflight.mjs';

const SCHEMA='RAG_ZIP_REVIEW_INTENT_V1';
const ACK='I_UNDERSTAND_THIS_DOES_NOT_AUTHORIZE_IMPORT';
const FIELDS=['schema_version','archive_sha256','scope','rights_attestation',
  'privacy_attestation','semantic_review','decision','acknowledgement'];
const own=Object.hasOwn;
function refuse(code){
  throw Object.assign(new Error('ZIP review intent refused'),{code:'ZIP_REVIEW_'+code});
}
function exactDataObject(obj,fields){
  if(obj===null||typeof obj!=='object'||Array.isArray(obj))return false;
  const keys=Object.keys(obj);
  if(keys.length!==fields.length||!fields.every(key=>own(obj,key)))return false;
  return fields.every(k=>{
    const descriptor=Object.getOwnPropertyDescriptor(obj,k);
    return descriptor&&own(descriptor,'value')&&typeof descriptor.value==='string';
  });
}
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function verdict(status,source,hasRecord){
  return Object.freeze({
    contract:'rag.zip-review-intent.v1',
    status,
    archive_sha256:source.archive_sha256,
    entries:source.entries,
    uncompressed_bytes:source.uncompressed_bytes,
    structural_preflight_verified:true,
    requester_attestation_recorded:hasRecord,
    reviewer_identity_verified:false,
    ownership_or_license_verified:false,
    privacy_compliance_verified:false,
    semantic_mapping_approved:false,
    malware_scanned:false,
    import_authorized:false,
    extraction_allowed:false,
    ax_package_created:false,
    customer_data_allowed:false
  });
}
/**
 * A SHA256-bound assessment of a ZIP buffer and a separate untrusted declaration.
 * The ZIP is revalidated on every call; previously inspected metadata cannot be
 * replayed to authorize changed bytes. No files, network or output bundle.
 */
export function assessZipReviewIntent(zipBytes,review=null){
  const result=inspectZipBytes(zipBytes);
  if(result.status!=='STRUCTURE_VALID_ONLY'||result.extracted!==false||
     result.ax_package_approved!==false)refuse('PREFLIGHT_INVALID');
  const source={archive_sha256:digest(zipBytes),entries:result.entries,
    uncompressed_bytes:result.uncompressed_bytes};
  if(review===null)return verdict('REVIEW_NOT_RECORDED',source,false);
  if(!exactDataObject(review,FIELDS)||
     review.schema_version!==SCHEMA||
     review.archive_sha256!==source.archive_sha256||
     review.scope!=='LOCAL_OFFLINE_ASSESSMENT_ONLY'||
     !['DECLARED_AUTHORIZED','UNKNOWN'].includes(review.rights_attestation)||
     !['DECLARED_REVIEWED','UNKNOWN'].includes(review.privacy_attestation)||
     review.semantic_review!=='PENDING_SEPARATE_VALIDATION'||
     !['HOLD','REQUEST_TRUSTED_REVIEW'].includes(review.decision)||
     review.acknowledgement!==ACK)refuse('DECLARATION_INVALID');
  // Even completely filled self-declared fields cannot grant import.
  if(review.decision==='HOLD'||review.rights_attestation==='UNKNOWN'||
     review.privacy_attestation==='UNKNOWN')
    return verdict('REVIEW_HOLD',source,true);
  return verdict('UNTRUSTED_REVIEW_REQUEST_RECORDED',source,true);
}
export const ZIP_REVIEW_INTENT_SCHEMA=SCHEMA;
export const ZIP_REVIEW_INTENT_ACKNOWLEDGEMENT=ACK;
