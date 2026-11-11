/** P5.47: re-attest a human-edited mapping draft against the *current* CSV bytes.
 * Never approves customer data, invokes SMAX, performs SQL import or writes files.
 */
import fs from 'node:fs';
import path from 'node:path';
import {inspectLocalCsv} from './local-csv-review.mjs';
import {buildRagPrepMappingPlan} from './prep-mapping-plan.mjs';
const MAX_OWNER_BYTES = 64 * 1024;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const matches = (o, keys) => object(o) &&
  Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o,k));
function blocked(){ throw Object.assign(new Error('RAG_PREP_OWNER_BLOCKED'),{code:'RAG_PREP_OWNER_BLOCKED'}); }

export function verifyOwnerMappingAgainstReview(review, owner) {
  if (!matches(owner,['contract','source_sha256','source_size_bytes','fields']) ||
      owner.contract !== 'RAG_PREP_OWNER_MAPPING_V1' ||
      typeof owner.source_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(owner.source_sha256) ||
      !Number.isSafeInteger(owner.source_size_bytes) || owner.source_size_bytes < 1 ||
      !Array.isArray(owner.fields) || owner.fields.length > 64) blocked();
  const plan = buildRagPrepMappingPlan(review,owner.fields);
  if (plan.source_sha256 !== owner.source_sha256 ||
      plan.source_size_bytes !== owner.source_size_bytes) blocked();
  return Object.freeze({...plan,owner_draft_rechecked:true,
    owner_draft_contract:'RAG_PREP_OWNER_MAPPING_V1'});
}

function readLocalDraft(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename) ||
      path.extname(filename).toLowerCase() !== '.json') blocked();
  const before = fs.lstatSync(filename);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 ||
      before.size < 2 || before.size > MAX_OWNER_BYTES) blocked();
  const fd=fs.openSync(filename,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try {
    const opened=fs.fstatSync(fd);
    if (!opened.isFile() || opened.ino!==before.ino || opened.dev!==before.dev ||
        opened.size!==before.size || opened.nlink!==1) blocked();
    const bytes=fs.readFileSync(fd);
    const after=fs.fstatSync(fd),current=fs.lstatSync(filename);
    if (bytes.length!==before.size || after.size!==before.size ||
        after.mtimeMs!==opened.mtimeMs || after.ino!==opened.ino ||
        current.isSymbolicLink() || current.ino!==opened.ino || current.dev!==opened.dev ||
        current.mtimeMs!==opened.mtimeMs || current.size!==opened.size) blocked();
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch { blocked(); }
  finally {fs.closeSync(fd);}
}

export function verifyLocalOwnerMapping(csvPath, draftPath) {
  // Both must be explicitly supplied absolute local files; never inferred or searched.
  const owner=readLocalDraft(draftPath);
  const inspection=inspectLocalCsv(csvPath);
  return verifyOwnerMappingAgainstReview(inspection,owner);
}
