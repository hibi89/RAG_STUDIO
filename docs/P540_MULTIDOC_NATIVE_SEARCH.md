# P5.40 — Search 2–4 PDF/DOCX originals in a single offline RAG Studio project

2026-10-28 KST. This work connects and generalizes the **already working** P5.12 single-file native PDF/DOCX preview. It does not claim the initial PDF/DOCX parser was missing.

## Architecture decision
1. **Duplicate the old one-file dashboard** per document and search independently: minimal rewrite, but results cannot be compared or searched together in one verified session.
2. **Create one bounded derived AX preview package containing 2–4 user-selected PDF/DOCX text extractions** (chosen): reuse the existing `extractLocalDocument` PDF.js + Mammoth parser and existing SHA-verified AX+SQLite, search, Knowledge Base, source-explorer, localhost bearer server. Leave old `openNativeDocumentPreview` untouched for single file compatibility. No paid API or model.

## Usage (local developer checkout, dependencies installed)
```shell
npm ci --ignore-scripts --no-audit --no-fund
npm run preview:document -- "./fixtures/ax_multi_doc_v0" "/absolute/file1.pdf" "/absolute/file2.docx"
npm run preview:document -- "./fixtures/ax_multi_doc_v0" "/absolute/file1.pdf" "/absolute/file2.docx" "/absolute/file3.pdf" "/absolute/file4.docx"
```
One-file command also works exactly as before. CLI accepts 1–4 PDF/DOCX source paths; every other count is rejected. This is a command-line launched, local bearer-protected browser dashboard, not a native GUI file picker. A zero-port test override can be configured as `RAG_DASHBOARD_PORT=0` for isolated local tests.

## Actual data and citation path
- Validate the source AX package first. **Only already accepted-by-package, SHA-verified synthetic data** is used for current demonstration. No real customer's rights/consent are inferred.
- For multiple selected documents, each is an explicit absolute path. Reject symlinks in every path segment, oversized files (maximum 2 MiB each), duplicate names/hardlink aliases, invalid suffixes, parser failures, missing text, or modified bytes. Input is opened by file descriptor and checked against on-disk inode/dev/size/mtime; after parsing, all original bytes are reopened and compared again. Do not print original path or text in error messages.
- Extract each PDF page as `[PDF page 1]` and DOCX paragraph as `[DOCX paragraph 1]` on derived text lines. **PDF page is a parsed page number**, DOCX has no stable page number. Source citation line numbers in the UI refer to derived TXT lines and display page/paragraph prefixes, not visual bounding-box positions.
- Create a fresh disposable temp AX folder, copy only files listed in the validated package manifest, and SHA-verify copies. Add one distinct random file/document ID and SHA-verified derived text file per native original. Revalidate whole derived package; use the same authenticated search/knowledge/readonly SQL APIs. The originals and customer file bytes are never copied into the derived package, uploaded or written over.
- `cleanup()` removes only the disposable package, and CLI handles Ctrl+C. Hard kill/OS crash can leave a temp folder and is outside this mechanism's cleanup guarantee.

## Functional proof and limitations
`tests/p540-native-collection.test.mjs` constructs **real synthetic PDF and OOXML DOCX bytes** and tests: mixed-file BM25 source citations, user-selected Knowledge Base scope, unchanged synthetic SQLite totals, no customer approval, original data preservation, 401/200 bearer API, real child-process multi-input local server launch, duplicates/hardlinks/path-symlink refusals, invalid document and unapproved package, and legacy CLI refusal. CI uses Linux Node22.16/Windows Node22.23 with existing 491-test baseline, Gold100, Negative20, Heldout24 and P5.37 regression.

No image-only/scanned PDF OCR; no PDF visual bbox, embedded charts/tables extraction accuracy certification, DOCX actual layout page numbers, third-party document permission certification, malicious-parser sandbox/antivirus, true customer approval, unreviewed SMAX Native import, Windows physical-PC installer or Production deployment. This is an offline, **unverified-source text preview** on a verified **synthetic** package.

## Next gate
After complete green CI, integrate guarded fast-forward into `develop`, keep `main` stable. Only then evaluate practical local launch ergonomics and end-to-end user flows; UI styling remains last.
