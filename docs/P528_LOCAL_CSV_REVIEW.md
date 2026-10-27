# P5.28 — Local CSV schema review without automatic approval

2026-10-27 KST; develop baseline a6d90afd2cacffe53fe269bb1a7ae64866aa4831. This is a functional local CSV inspection workflow, not a signed SMAX producer or customer import.

Command: npm run inspect:csv -- "/absolute/selected.csv" ["/absolute/verified-AX_DATA_PACKAGE_V0"].

The CLI opens exactly one operator-selected UTF-8 .csv via read-only file handle with inode/mtime/size checks. It parses comma delimiter and double-quoted/multiline fields, reports source physical line and row, header names, missing values, candidate TEXT/INTEGER/DECIMAL/BOOLEAN/DATE/MIXED types, duplicate/empty/formula-like headers, incorrect column counts, mixed values and potential spreadsheet formulas. Source data values and absolute paths are not echoed; error examples are bounded to 40. Source-file hash is reported locally for integrity.

All review outputs have status NEEDS_REVIEW, including syntactically clean inputs; the software cannot infer data rights, semantics, monetary units, or schema mapping approval. No source CSV changes, no persistent output, no AX manifest creation, no SQLite row import, no LLM SQL, no network calls or paid external APIs. Optionally independently re-check an existing verified AX folder and show unchanged base totals; it does not merge the previewed CSV.

Limits: <=1MiB CSV, <=2000 data rows, <=64 columns, <=512 UTF-16 code units per cell, <=12000 physical lines. Fatal malformed quote, UTF-8, C0 binary controls and oversize inputs are blocked with sanitized JSON status. Row width mismatches produce review issues, not silently padded or cast. All numeric types are heuristic; leading-zero IDs remain text, >safe integer values remain text; formula-like fields are never executed.

CI regression includes real local CLI, synthetic 157000 KRW baseline preservation, row/line provenance, CSV escaping, malformed/binary source and symlink rejection. Windows 3-PC real install, actual customer-data approval, native SMAX production contract and user-facing browser selection remain open. Next P5.29: authenticated local dashboard CSV review UI while retaining strict no-import boundary. No promotion to main prior to release verification.
