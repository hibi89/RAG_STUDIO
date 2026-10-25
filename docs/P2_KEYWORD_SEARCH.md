# P2 synthetic multi-document keyword search — 2026-10-26 KST

## Scope and evidence
- New `src/document-search.mjs`: bounded on-demand, in-memory BM25 scoring over approved, SHA-256-verified UTF-8 TXT lines from `AX_DATA_PACKAGE_V0` packages. Zero third-party dependency; no LLM, vector store or API calls. Every excerpt carries `document_id`, `file_id`, `source_title`, **one-based line** and lexical relevance score.
- New `src/search-cli.mjs`: `npm run demo:search` uses a second synthetic package containing `sales.csv`, `returns_policy.txt`, `shipping_policy.txt`.
- New `tests/document-search.test.mjs`: 17 additional tests. Existing P0 (16) and P1 (12) suites are retained unchanged.
- Korean tokenization: Unicode NFKC lower-case, whole words + 2/3 character Hangul n-grams, BM25 on individual text lines. This is **lexical** search, not semantic retrieval or natural-language reasoning.
- `POSSIBLE_CONFLICT` status for differently stated `N일 이내` return periods across retrieved source documents; answer withheld pending human review. Limited lexical heuristic, not full policy contradiction detection.
- `NO_EVIDENCE` for no matched source; unapproved documents skipped, integrity/path failures rejected; source documents never mutated.

## Design choice (MVP-first)
| Approach | Performance | Cost | Maintenance | Decision |
|---|---|---|---|---|
| A. On-demand bounded BM25 from verified TXT | Re-indexes on every query, adequate for small packages | No API, no npm deps, zero cloud | Minimal; simple inspection and test | **Selected P2** |
| B. Persistent hybrid BM25 + FAISS vectors | Faster repeated/larger corpora once indexed, heavier initial setup | Model storage/CPU/RAM; possible native dependencies | Index versioning, Windows installer, rebuild/rollback | Defer until original RAG archive licensing and Windows/quality evaluation |

## Actual local validation
- Runtime: Node `v22.16.0`, Linux container, `node:sqlite` experimental warning from existing P1.
- Command: `npm test` => **45 pass, 0 fail, 0 skip** (P0=16, P1=12, P2=17).
- Command: `npm run demo:search` => `FOUND`, returns 7-day policy at `document-returns` line 2, shipping preparation 2 business days at `document-shipping` line 2. Output includes both source pointers, no generated unverified business claim.
- P1 `npm run demo:mixed`: still synthetic SQLite+TXT, no arbitrary SQL.
- Not tested: Windows, original RAG ZIP, SMAX private producer integration, PDF/DOCX parsing, production, FAISS, user interviews, software licensing/distribution.

## Limitations and safeguards
- This is an independently executable **search micro-slice**, not a fully integrated production RAG; the existing mixed answer route still uses its original narrow policy extraction.
- Only accepted TXT files are indexed; unapproved files never searched, and unsupported file types are silently not part of the P2 search corpus. The validator enforces relative-path, symlink, hash and file size checks.
- Question length 1–500 chars, results 1–10, source line max 4096 chars, at most 10,000 nonempty lines per request. Text never becomes code/SQL. Some short, ambiguous or morphological questions may be misranked; BM25 scores are not probabilities.
- No proof of perfect contradiction detection: it only flags *two different* `N일 이내` periods in separate retrieved documents on a return/refund query. Human review must examine business context, precedence, exceptions, language and effective dates.
- In-memory indexing happens per query. Latency/memory/quality benchmarks with larger multilingual corpora are needed before selecting permanent index strategy.

## Next safe work
1. Compare P2 output with existing P1 mixed question and add a **verified multi-document answer router** with complete abstention/source tracking.
2. Obtain, hash and review original RAG ZIP for secrets/OSS license before reuse; never invent the migration.
3. Improve ranking/stopword coverage and add 100-question Korean gold-set against free competitors; follow with Document, Knowledge Base, Multi-Document, Conversational and SQL+Document modes.
4. UI/preview and dashboard later; local Windows installation/security before customer sale. Private SMAX schedule unchanged; SOVIA optional.
