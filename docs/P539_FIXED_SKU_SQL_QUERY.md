# P5.39 — Fixed SKU SQLite questions with original CSV citations

2026-10-28 KST · public RAG_STUDIO synthetic local MVP.

## Problem and engineering decision
Previously, the read-only SQLite overview calculated SKU aggregates, but `routeQuestion` deliberately refused SKU-based questions. P5.39 connects that existing verified database to source-cited questions.

Two alternatives were assessed: (A) arbitrary model-generated SQL and free-form filters (unsafe and too broad); (B) a fixed whitelist of explicit SKU metric questions and immutable parameter-free SQLite SELECT statements (implemented). No new runtime packages, network calls, customer import, direct SQL entry, permissions or files.

## Exact supported wording
The following forms also accept `보여줘` instead of `알려줘` and optional terminal question punctuation:

- `SKU별 매출 알려줘`
- `SKU별 주문 건수 알려줘`
- `SKU별 판매 수량 알려줘`
- `SKU별 매출과 주문 건수, 판매 수량 알려줘`
- `SKU N-02 매출 알려줘`
- `SKU N-01 주문 건수 알려줘`
- `SKU N-03 판매 수량 알려줘`

Both grouped and single-SKU responses intentionally include all three **already supported** metrics: KRW revenue, order count and sold units. All grouped SKUs are sorted by SKU. Exact SKU lookup matches only an identifier from the verified source. Unknown SKU => `INSUFFICIENT_EVIDENCE`; ambiguous/unsupported questions => `NOT_SUPPORTED`, no partial global answer.

## Data flow and source reconciliation
`src/sku-query.mjs` parses the exact question, then calls preexisting `withReadOnlySales(root)`:

1. `aggregateSales` checks accepted import status and column review, original CSV SHA-256, row lineage, integer arithmetic and TXT source linkage.
2. Build only in-memory SQLite with verified rows, mark query-only, compute existing verified grand totals.
3. Run fixed `GROUP BY sku` and fixed `ORDER BY csv_line` statements, independently check 100 SKU and 5000 cited-row maximum. Sum per-SKU groups to grand total and each selected SKU's row totals back to its group.
4. Return `metric_evidence.sku_totals` and `row_evidence` with validated `file_id`, one-based `csv_line`, `order_id`, `sku`, exact `amount_krw`. The preexisting clickable citation resolver links to the source row in the local UI.
5. Close database. No copied source files, persistent DB, external API, arbitrary WHERE clause or SQL interpolation.

Synthetic example on bundled dataset: N-01 45,000 KRW/2 orders/3 units; N-02 72,000 KRW/2 orders/3 units; N-03 40,000 KRW/2 orders/4 units; sum 157,000 KRW/6 orders/10 units.

## Quality oracle compatibility
The existing immutable gold100/heldout24 questions `SKU별 매출 집계` and `SKU별 매출?` retain their prior **NOT_SUPPORTED** expectation; do not silently rewrite historical labels as new capabilities without a separately versioned oracle. `SKU별 재고`, SKU-based ranking, temporal filtering, custom SQL, indirect product references and combined unsupported domains remain denied.

## Verification plan / no overclaim
`tests/p539-sku-query.test.mjs` has 9 tests including real authenticated local HTTP POST and unauthenticated denial, source tamper and unapproved manifest, group-to-source reconciliation, exact SKU lines 3 and 6, unknown SKU, rejection of programmatic fake intents and no fixture mutation. CI `.github/workflows/p539-verify.yml`: Linux Node22.16 and Windows Node22.23 `npm test` plus original gold100, negative20, heldout24, P5.37 wizard smoke, router demo and UI JS syntax. Refer to actual completed job logs for counts.

No actual Windows browser click testing, real customer input, licensing/consent review, Native Private SMAX producer signoff, signed portable installer or Production/Vercel release has been performed by this feature.

## Confirmed CI checkpoint (2026-10-28 KST)
Functional/UI/doc source SHA `177740b45daa21f3c298481e347e9407157e3550`, [GitHub Actions #40542300601](https://github.com/hibi89/RAG_STUDIO/actions/runs/40542300601) completed/success. Both Linux Node22.16 and Windows Node22.23 ran `npm test` with **491 PASS, 0 FAIL, 0 SKIP**. Both completed existing gold100, negative20, heldout24, router demo, P5.37 read-only smoke and UI syntax. Nine P5.39 tests are included in 491. No customer data, actual interactive Chrome/Edge screenshot run, physical Windows 3-PC or deployment accepted.
