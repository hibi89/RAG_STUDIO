/** Explicit local PREP review draft; never an authorization or import instruction. */
import fs from 'node:fs';
import path from 'node:path';
import {buildRagPrepMappingPlan} from './prep-mapping-plan.mjs';

const MAX_DRAFT_BYTES = 16 * 1024;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw Object.assign(new Error('RAG_PREP_DRAFT_BLOCKED'), {code:'RAG_PREP_DRAFT_BLOCKED'}); };
const sameKeys = (obj, keys) => Object.keys(obj).length === keys.length &&
  keys.every(key => Object.hasOwn(obj,key));

export function parseRagPrepDraft(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_DRAFT_BYTES) fail();
  let draft;
  try {
    const text = new TextDecoder('utf-8', {fatal:true,ignoreBOM:false}).decode(bytes);
    draft = JSON.parse(text);
  } catch { fail(); }
  if (!isObject(draft) || !sameKeys(draft,['contract','source_sha256','requested_mapping']) ||
      draft.contract !== 'RAG_PREP_MAPPING_DRAFT_V1' ||
      typeof draft.source_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(draft.source_sha256) ||
      !Array.isArray(draft.requested_mapping) || draft.requested_mapping.length > 64) fail();
  for (const m of draft.requested_mapping) {
    if (!isObject(m) || !sameKeys(m,['key','source','type','required']) ||
        typeof m.key !== 'string' || typeof m.source !== 'string' ||
        typeof m.type !== 'string' || typeof m.required !== 'boolean') fail();
  }
  return draft;
}

export function buildRagPrepReviewFromDraft(review, draft) {
  if (!isObject(draft) || draft.contract !== 'RAG_PREP_MAPPING_DRAFT_V1' ||
      draft.source_sha256 !== review?.source_sha256 ||
      !Array.isArray(draft.requested_mapping)) fail();
  // The canonical P5.46 planner revalidates every mapping and always returns REVIEW_HOLD.
  const plan = buildRagPrepMappingPlan(review,draft.requested_mapping);
  if (plan.status !== 'REVIEW_HOLD' || plan.approval !== 'NOT_GRANTED' ||
      plan.source_sha256 !== draft.source_sha256) fail();
  return plan;
}

export function readLocalRagPrepDraft(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename) ||
      path.extname(filename).toLowerCase() !== '.json') fail();
  let fd;
  try {
    const initial = fs.lstatSync(filename);
    if (!initial.isFile() || initial.isSymbolicLink() || initial.size < 1 ||
        initial.size > MAX_DRAFT_BYTES) fail();
    fd = fs.openSync(filename,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.dev !== initial.dev || before.ino !== initial.ino ||
        before.size !== initial.size || before.mtimeMs !== initial.mtimeMs) fail();
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    const current = fs.lstatSync(filename);
    if (bytes.length !== before.size || after.size !== before.size ||
        after.dev !== before.dev || after.ino !== before.ino || after.mtimeMs !== before.mtimeMs ||
        current.isSymbolicLink() || current.dev !== before.dev || current.ino !== before.ino ||
        current.size !== before.size || current.mtimeMs !== before.mtimeMs) fail();
    return parseRagPrepDraft(bytes);
  } catch { fail(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
