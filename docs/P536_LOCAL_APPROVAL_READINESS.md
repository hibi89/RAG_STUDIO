# P5.36 — Local approval-readiness plan, deny-by-default (2026-10-28 KST)

## Scope and deliberate boundary
This unit is a **read-only review plan**, NOT real authorization. It consumes the verified P5.35 `RAG_LOCAL_SMAX_REVIEW_HOLD_V1` output, which is re-created by reopening the three explicitly provided local files. It creates no AX package, accepted-data state, SQLite import, document index, account, approval record, network request or remote upload.

## Local usage
On a checkout (Node 22.16+ Linux or tested Windows 22.23+):
```shell
npm run plan:smax:local -- "<absolute path>/smax-v1.json" "<absolute path>/original.csv" "<absolute path>/policy.txt"
```
The existing P5.35 reviewer validates each file path, digest, source row/amount provenance and document UTF-8 boundaries. Invalid or changed inputs fail with a generic error, not raw input data or paths.

## Output
- Contract `RAG_LOCAL_SMAX_APPROVAL_PLAN_V1`, final `REVIEW_HOLD`, `NOT_AUTHORIZED_FOR_AX_PROMOTION`.
- Fixed checklist of ten **UNVERIFIED** items: ownership/license of source, processing rights, sales field mapping, gross/net/refunds/discounts, KRW unit and rounding, VAT treatment, document ownership, policy effective version, private SMAX Native sign-off, reviewer identity and explicit decision.
- SHA-256 `review_key_sha256` binds CSV digest, document digest, row counts, unapproved preview state to an ephemeral review key. **A SHA does not prove customer rights, consent, semantics or identity**.
- Output allowlists digest/count/status codes only; no original rows, provisional revenue figures, raw text or source paths. Never treats a caller's claimed approval state as valid.

## Two implementation alternatives evaluated
1. **Independent pure read-only plan** (chosen): minimal new code, deterministic, local, no persistence or privilege escalation. Does not advance data past HOLD.
2. **Approval/promotion workflow with durable signatures** (deferred): can eventually move reviewed real customer input into AX/SQLite, but requires policy decisions about ownership, reviewer authentication, sensitive data retention and revocation. User sign-off and a threat model are needed before implementation.

## Exact verification boundary
The isolated module test set was executed locally using Node 22.16.0: 5 passed, 0 failed. New end-to-end CLI tests require the full GitHub checkout and have their own `tests/p536-cli-integration.test.mjs` file. Linux and Windows full suite is configured under `.github/workflows/p536-verify.yml`; refer to actual completed run for results rather than assuming green.

No customer dataset, physical Windows PC, Vercel/production deployment, authenticated reviewer, legal rights validation, or real SMAX Private Native integration is tested here.

## Next gate
Maintain all local originals unchanged and `REVIEW_HOLD`. Before any product promotion, obtain explicit owner approval of: actor identity/authentication, proof of data rights and processing scope, meaning of prices/amount/VAT/refunds, document legal use/version, audit log retention and revocation behavior. Then design a **separate** verified approve/import transition, with independent negative tests. No inferred consents or auto-approval from a structured JSON field.
