/** P5.45: local, non-authorizing review summary export. Never export source bytes. */
import crypto from 'node:crypto';
const fail=()=>{throw Object.assign(new Error('REVIEW_EXPORT_BLOCKED'),{code:'REVIEW_EXPORT_BLOCKED'});};
export function exportHeldReviewSummary(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan))fail();
 if(plan.contract!=='RAG_LOCAL_SMAX_APPROVAL_PLAN_V1'||plan.status!=='REVIEW_HOLD'||
 plan.promotion_status!=='NOT_AUTHORIZED_FOR_AX_PROMOTION'||
 plan.ax_package_created!==false||plan.sqlite_imported!==false||
 plan.source_rights_verified!==false||plan.customer_consent_verified!==false||
 !Array.isArray(plan.review_items)||plan.review_items.length<1||plan.review_items.length>50||
 !Number.isSafeInteger(plan.unresolved_review_items)||
 plan.unresolved_review_items!==plan.review_items.length||
 plan.review_items.some(item=>!item||item.status!=='UNVERIFIED'))fail();
 const key=plan.review_key_sha256;
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail();
 const result={contract:'RAG_REVIEW_HOLD_EXPORT_V1',review_key_sha256:key,
  status:'REVIEW_HOLD',promotion_status:'NOT_AUTHORIZED_FOR_AX_PROMOTION',
  unresolved_review_items:plan.review_items.length,customer_data_approved:false,
  source_rights_verified:false,customer_consent_verified:false,
  ax_package_created:false,sqlite_imported:false,
  disclaimer:'Review checklist only. No data import or approval.'};
 const json=JSON.stringify(result)+'\n';
 return Object.freeze({json,sha256:crypto.createHash('sha256').update(json).digest('hex')});
}
