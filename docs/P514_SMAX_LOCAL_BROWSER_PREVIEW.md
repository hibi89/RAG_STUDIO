# P5.14 — Select SMAX JSON and exact original CSV in the local dashboard

Date: 2026-10-27 KST. Public RAG Studio branch `feature/p514-smax-browser-preview`.

## What actually works

The previously verified RAG local browser dashboard now has a dedicated **SMAX 매출 미리보기** area. Choose two local files in the browser: a `SMAX_PREPROCESS_GENERIC_CSV_V1` result JSON (maximum 4 MiB) and the exact original UTF-8 CSV that produced it (maximum 2 MiB). Clicking **원본 대조 후 집계** reads those files in memory and submits them to the **same 127.0.0.1 Node server** that hosts the dashboard.

A new bearer-authenticated `POST /api/smax-preview` accepts exactly `{v1, source_csv_base64}`. This API uses the existing P5.13 independent source SHA-256, row provenance, validated field meaning, integer normalization, and quantity×price checks; successful synthetic source returns `CALCULATED_PREVIEW_NOT_APPROVED` and sales, unit, orders and per-SKU totals. Native `NEEDS_REVIEW` rows become `REVIEW_HOLD`: **no preview financial totals shown**. The existing approved-by-manifest dashboard data and KPI remain completely separate; an unapproved SMAX result is **never imported or merged into AX_DATA_PACKAGE_V0/SQLite**.

The interface never injects source HTML: results are rendered using DOM `textContent` and `createElement`. Source filenames/paths, order IDs and raw cells are neither echoed on errors nor included in source-controlled fixtures. Per-SKU identifiers and calculated figures are returned only to the authenticated local client. The server doesn't write files, index source data, or contact external servers. **The selected files do cross the browser-to-loopback-process boundary in memory**; they don't leave the computer. Crashes or operating-system process swapping are not an independently verified secure deletion guarantee.

## How to use

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run demo:zip
# Open the private localhost URL printed in the terminal
# Scroll to "SMAX 매출 미리보기" and choose your local V1 .json and matching .csv
# Click "원본 대조 후 집계"
# Ctrl+C to close the dashboard
```

For public synthetic regression, file controls can use:
- JSON: `fixtures/smax_p42/synthetic_v1.json`
- CSV: `fixtures/ax_multi_doc_v0/sales.csv`

These exact public fixtures produce **157,000 KRW, 6 orders, 10 units, 3 SKU groups**, status `CALCULATED_PREVIEW_NOT_APPROVED`. No claim of business or source approval.

## Explicit security / trust scope

- Existing loopback Host check, session-only 43-character bearer header, and POST Origin restriction apply to this endpoint. An unauthenticated attempt gets 401 before parsing the body; invalid Origin gets 403.
- JSON media-type is required. The API limits total request body to 8.25 MiB, source CSV to 2 MiB and serialized V1 input to 4 MiB. Base64 must use canonical alphabet and round trip exactly. Rejects unknown/missing fields. Incoming JSON and CSV are held temporarily in process memory and discarded after responding, without writing to disk.
- A producer's `NOT_GRANTED`/row `READY_FOR_HUMAN_REVIEW` **is never approval**. The API does not implement producer identity verification, signed human review, legal rights clearance, malware scanning, consent recording, AX package import, external model/vector ingestion, customer onboarding, or public upload. It is a **local developer preview**. Actual connected Native Private SMAX producer was read to understand its contract but was not executed in this Public CI; cross-repo end-to-end acceptance remains missing.
- File-picker behavior may differ on Windows Edge/Chrome; native Windows test and product release acceptance remain pending. The optional separate real Chromium UI smoke can fail due to ChromeDriver session startup; report it separately from stable Node tests.

## Exact verification evidence

The P5.14 tests exercise the real same-loopback server, bearer 401 and 200, forbidden Origin, invalid SHA/source, review HOLD, malformed/oversized/extra-field JSON, media type, no source mutation, plus imported browser UI module simulated with File ArrayBuffers to verify selection, base64, approval warning, existing KPI preservation and generic errors. The separate Chromium test operates on only synthetic public files. See `STATUS.md` and Actions for the exact SHA and executed counts.

## Next functional MVP task

The pipeline is presently `SMAX preprocessor V1 -> source-verified calculation preview`, **not** `trusted SMAX Native output -> authorized AX_DATA_PACKAGE_V0 -> persisted RAG index`. Next prioritize a valid human-reviewed Native AX producer contract in Private SMAX (through its own owner) and visible project/file selection in RAG Studio; only ingest real customer files with proper rights/consent and validation. Complete remaining original blueprint requirements, then final Windows self-install, compatibility, security and release QA.
