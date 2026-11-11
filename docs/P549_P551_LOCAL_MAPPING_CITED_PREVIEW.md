# P5.49–P5.51: local owned CSV mapping → audited sales preview → unapproved document citations

**2026-11-12 KST · Public RAG_STUDIO · Synthetic tests only · RELEASE HOLD**

## Why this boundary
Option A, importing arbitrary customer CSV into in-memory SQL/AX after a self-declared mapping, risks treating unauthenticated/unsourced data as accepted evidence. Option B, **separate immutable read-only previews that never promote to AX or a trusted RAG answer**, requires extra steps but protects source/approval boundaries and isolates private SMAX from public RAG. B implemented.

## Data flow
- Explicit local absolute `.csv` and owner mapping JSON (P5.47): strict selected source SHA256, byte size and schema. P5.49 reopens the CSV using no-follow read-only fd and checks identity/times/size, independently hashes physical bytes and validates P5.28 CSV syntax and P5.46 owner column mapping. Only exact named five sales keys; all required, text/integer type checks, unique ASCII order IDs, bounded uppercase SKU, exact safe BigInt arithmetic; incompatible and ambiguous values fail closed. No truncation/rounding, altered input or SQLite import.
- Output `RAG_PREP_SALES_PREVIEW_V1`, `REVIEW_HOLD`, provisional orders/units/revenue/sku and up to 40 source citations by original physical CSV line; source SHA+line acts as recheck pointer, not customer permission. A partial 40-line preview is flagged. No order IDs/full rows in output.
- P5.50 browser UI accepts a selected report JSON, strictly checks source digest against open proposal if provided, independent SKU-to-grand-totals aggregation and citation ordering; displays only textContent, no HTML injection. JSON itself can be forged, so this is **not a signature**; trusted observations require re-running CLI on original source.
- P5.51 optional explicitly chosen local `.txt`/`.md` returns a separate source-hashed/line-cited policy excerpt for a narrow sales + refund question. Numeric return-period conflicts produce POSSIBLE_CONFLICT and no answer; missing support produces INSUFFICIENT_DOCUMENT_EVIDENCE. Prompt injection text is never executed; policy text is unapproved, not indexed. CSV re-read after document inspection; all originals immutable. There is no generated SQL or full RAG completion/automatic customer import.

## Use
```shell
node src/prep-mapping-cli.mjs "/absolute/source.csv" > proposal.json
npm run review:prep:owner
node src/prep-mapped-sales-cli.mjs "/absolute/source.csv" "/absolute/rag-prep-owner-draft.json" > sales-review.json
node src/prep-mixed-preview-cli.mjs "/absolute/source.csv" "/absolute/rag-prep-owner-draft.json" "/absolute/policy.txt" "매출과 반품 신청 기간은?"
```

Sales preview requires source columns explicitly mapped to `order_id`, `sku`, `quantity`, `unit_price_krw`, `amount_krw` with correct types, required=true. The HTML accepts proposal.json and then sales-review.json. Mixed CLI prints JSON locally; do not upload private reports to the public repository.

## Verified scope and blockers
- Linux Node 22.16: exact-code isolated **48/48 tests PASS**, includes existing 19 P5.47/P5.48 and new P5.49 14, P5.50 5, P5.51 10. Actual child processes, filesystem hash, malformed/duplicate/overflow, source mutation, symlink/hardlink cases, TXT/MD conflicts. Git Blob SHA of all transferred new code/test files matched the local tested bytes. Windows native full tests NOT RUN.
- Chromium144 synthetic DOM with input-file select and download, actual Node P5.49 CLI produced 3 orders/6 units/360 KRW and real source line citations, DOM rendered these values; no JS errors/no outbound network/original mutation. **Direct `http://127.0.0.1` navigation** hit sandbox `ERR_BLOCKED_BY_ADMINISTRATOR`, so browser HTTP response/CSP wiring is NOT VERIFIED by that test. P5.48 Node HTTP security tests passed separately.
- Prior GitHub Actions #43092180863 **completed failure with ZERO jobs**, also previous P545 affected. Does not prove code failure; no new SHA full npm/Windows/Gold100/Negative20/Heldout24 success asserted. Release HOLD.
- Private SMAX Native producer identity, owner/legal rights/real customer data, physical Windows installation, complete 5 RAG modes, final portable package & sellable terms all outside this evidence. Internal weighted coverage estimate: 73→81% provisional, 85 target remains.

No customer secrets, real CSV, private SMAX implementation, API keys or credentials were checked into this public branch.