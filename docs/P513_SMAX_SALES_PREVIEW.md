# P5.13 — SMAX Generic CSV V1 → local RAG sales preview

Date: 2026-10-27 KST. Public RAG Studio working branch `feature/p513-smax-native-sales-preview`.

## Implemented working bridge
- Inspected the existing **Private SMAX** `preprocessing` branch contract and its generic CSV V1 output. Only public-compatible field names and behavior are documented; **no Private source copied** to this Public RAG Studio repo.
- New `src/smax-sales-preview.mjs` consumes an independently supplied `SMAX_PREPROCESS_GENERIC_CSV_V1` JSON and its **exact original CSV bytes**, verifies source digest and source-row integrity, independently reparses the input (including quoted/multiline CSV cells), verifies SMAX normalized mapped fields and recomputes SKU-level revenue, quantity, order count and `amount=quantity*price`. This supports more than the one old hardcoded SHA: a different valid sales CSV and V1 JSON are independently calculated.
- Explicit sales columns required: `order_id`, `sku`, `quantity`, `unit_price_krw`, `amount_krw`. For this restricted preview they must have those literal meanings and integer KRW values. Unknown schema, duplicate IDs, changed source/normalized cells, overflow, unsupported syntax or invalid arithmetic all fail closed. No tax, foreign currency or arbitrary industry inference. Public inspector `src/smax-intake.mjs` now handles the actual Native V1 `UNMAPPED_FORMULA_RISK` issue code as a **review block**, not an automatic approval.
- A nonzero review queue returns `REVIEW_HOLD` with **no financial totals**. Otherwise `CALCULATED_PREVIEW_NOT_APPROVED` reports sales preview numbers with `customer_data_approved:false`, `ax_package_created:false`, `importer_enabled:false`, `source_rights_verified:false`. A producer's `READY_FOR_HUMAN_REVIEW` remains unapproved and never silently becomes an AX_DATA_PACKAGE_V0 file.

## Local CLI
```bash
npm ci --no-audit --no-fund --ignore-scripts
npm run preview:smax -- "/local/smax-v1.json" "/local/original.csv"
```
No network requests, original source mutation, persistent files, secrets or auto-import. Local CLI returns aggregate metrics and SKU identifiers, which may be sensitive; do not upload or publicly post actual customer output. CLI errors print fixed messages without local paths or source data.

## Source evidence and next step
- Connected Private SMAX preprocessing was **read**, not executed as a Native producer from this Public CI. Public tests use independently authored *synthetic producer-shaped* JSON matching original CSV, including the prior P4.2 fixture, plus dynamic changed-data samples, alternate field order, review holds, tampering, real child-process file CLI and preservation. These tests **do not certify** the latest private producer artifact's actual runtime output. Exact GitHub Actions run, pass/fail counts and source SHA are recorded in `STATUS.md` after execution.
- Next working step: exported **truly human-reviewed and independently verified** SMAX AX_DATA_PACKAGE_V0 into existing `npm run open:package` browser workflow once the separate SMAX producer interface supports that. Until then, do not convert an unapproved V1 result to an authorized SQLite/AX package. Continue product input UI, then Windows/installer and final release QA. No Production deployment/paid activity.
