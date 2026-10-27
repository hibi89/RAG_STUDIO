# P5.8 — Synthetic ZIP readonly preflight (source-level gate)

Updated: 2026-10-27 KST. Public `hibi89/RAG_STUDIO`, feature branch `feature/p58-zip-preflight`.

## Design choice
- A. Add an unzip extraction dependency and auto-unpack into a working folder. Rejected: larger supply-chain, disk and path exposure; easily mistaken for import authorization.
- B. Inspect bounded ZIP bytes entirely in memory using Node built-ins. **Selected:** `src/zip-preflight.mjs` and synthetic `tests/p58-zip-preflight.test.mjs`. It does **not** unzip into a filesystem, import source data, decide license/PII safety, approve SMAX business semantics, create an AX package or release a customer installer.

## Current read-only contract
`inspectZipBytes(Buffer)` returns `rag.zip-preflight.v1`, `STRUCTURE_VALID_ONLY`, entry count, uncompressed total, STORE/DEFLATE counts, and four explicit false gates: `extracted`, `content_authorized`, `ax_package_approved`, `malware_scanned`. It never returns source filenames or contents. It throws fixed `ZIP_PREFLIGHT_*` codes on invalid data. No filesystem/network/API access by this module.

Default hard ceilings: 12 MiB archive, 100 files, 2 MiB single file, 10 MiB total expanded payload, maximum ratio 50:1. It only supports single-disk normal ZIP with STORE or DEFLATE, exact local/central metadata, CRC32-verified bounded decompression, a contiguous local-entry layout, strict Unicode and conservative Windows-safe paths. Blocks directory entries, traversal/absolute/Windows-drive/ADS/reserved device names, case-folded collisions, Unix symlinks, encryption, data descriptors, ZIP64, unsupported compression, oversized/bomb input and malformed structure. Compatibility is intentionally narrow: many ordinary ZIP variants, especially data-descriptor ZIPs, are rejected rather than silently trusted.

## Execution evidence and limits
- Exact standalone local Node v22.16.0: `node --test tests/p58-zip-preflight.test.mjs` **11 PASS / 0 FAIL / 0 SKIP**, plus source/test `node --check` PASS. Code and test blob parity must be separately matched to GitHub.
- Existing P5.7 Linux arm64 `224 PASS` belongs to an earlier SHA only; **do not claim cumulative 235 PASS** unless current full `npm test` completes.
- Actual Windows/Edge, Chrome P5.7 opt-in 7 journeys, real ZIP, malicious fuzz corpus, filesystem extraction, accepted AX_DATA_PACKAGE_V0 conversion, SMAX private producer and customer/legal approval remain **unverified**.

## Safe next work
Run full repository `npm test` on connected authorized CI; verify synthetic `npm run doctor`, gold/negative/heldout regression, and inspect any failures. Keep this feature isolated until results are reviewed. Next P5.9 may add an explicit local-only read-only import approval contract (separate from ZIP structure), but must **not** auto-extract or treat a passing ZIP preflight as authorization. No real customer files or private SMAX data in this public repository.

Production/Vercel: not applicable. Public `main` is unchanged. No release authorization.
