# P5.47 — Source-bound human-editable PREP mapping review (2026-11-11 KST)

## Scope and decision
RAG Studio preserves its public read-only CSV inspector and the P5.46 RAG-owned PREP mapping contract. Private SMAX PREP stays in its private repository. A direct auto-import / automatic column inference approach would silently assign business meaning and bypass consent; it is not allowed. This stage uses a human-edited **local JSON mapping draft**, cryptographically bound to the CSV SHA-256, and refuses stale or malformed drafts. It **does not** grant approval or create AX, SQLite or any index.

## Usage
With Node >=22.16.0 in the RAG Studio source checkout:
1. Inspect an authorized, local small UTF-8 CSV:
   node src/prep-mapping-cli.mjs /absolute/path/to/source.csv
   Read source_sha256 and proposed_columns in the printed metadata; no row values are emitted.
2. In a local editor, save a JSON file using this exact schema (source_sha256 must match the inspection):
   {
     "contract": "RAG_PREP_MAPPING_DRAFT_V1",
     "source_sha256": "<64 lowercase hex characters from the same CSV>",
     "requested_mapping": [
       {"key":"order_id","source":"주문번호","type":"text","required":true},
       {"key":"quantity","source":"quantity","type":"integer","required":true},
       {"key":"amount_krw","source":"amount_krw","type":"decimal","required":true}
     ]
   }
3. Review the mapping without importing:
   node src/prep-mapping-review-cli.mjs /absolute/path/to/source.csv /absolute/path/to/mapping.json
   Success returns RAG_PREP_MAPPING_PLAN_V1 with status REVIEW_HOLD, approval NOT_GRANTED and explicit blockers. Invalid/stale CSV, JSON, fields, duplicates or symlinked JSON produce only a generic PREP_REVIEW_BLOCKED and exit code 1. This is not an approval workflow.

## Implementation and limits
- src/prep-mapping-draft.mjs: bounded 16 KiB strict JSON, exact top-level and mapping keys, UTF-8, stable read-only source file and hash match against freshly inspected CSV; delegates mapping/type validation to canonical P5.46.
- src/prep-mapping-review-cli.mjs: absolute local CSV + local JSON only; no filesystem writes, network calls, implicit import, SOVIA usage or private producer. Never prints source path or CSV rows. Column headers and mapping names may still be sensitive; **do not share the output without review**.
- tests/p547-prep-mapping-draft.test.mjs: 10 scope tests including real subprocess CLI, stale SHA, malformed files, forged approval, type mismatch and byte preservation.
- Public GitHub Actions workflow p547-verify.yml performs P5.46+P5.47, repository npm test, gold/negative/heldout and router on Linux Node22.16 and Windows Node22.23, using synthetic inputs only. Verify actual workflow results separately before claiming pass.
- This is a developer-facing, manually edited configuration. Browser form, persistence, actual private SMAX producer E2E, physical Windows customer acceptance, original RAG ZIP, rights and paid release remain pending. No percent credit without full-scope regression and product acceptance.

## Rollback / security
Branch feature/p547-bound-draft-review forks feature/p546-rag-prep-mapping at 5dca9368d40992ad9233529f0ec8d73145ce2e55. Existing develop/main and private SMAX/SOVIA unchanged. Code is additive; revert feature commit(s) normally. No real customer files, secrets or payments were introduced.
