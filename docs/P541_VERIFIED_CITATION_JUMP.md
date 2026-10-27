# P5.41 — Authenticated line-level citation jump for native previews

Date: 2026-10-28 KST. P5.40 already indexed 2–4 PDF/DOCX files. Its citation button focused only the document card. P5.41 opens the actual SHA-rechecked source line and focuses it.

Workflow: Use the existing local dashboard's document-only search or selected collection. Source labels now distinguish "파일 1 · PDF 추출 1페이지" and "파일 2 · DOCX 추출 2문단" for untrusted native text preview only. DOCX paragraph number is never claimed to be a rendered page number, and PDF coordinates are unavailable. Native document titles are generic and reveal no original file pathname.

Clicking the citation uses the existing authenticated GET /api/documents with the current manifest's document ID and one-based 40-line page start. The server checks all package hashes again, and the client verifies file ID, exact line number and exact trimmed quoted text before highlighting the specific line in the derived TXT explorer. A changed source is rejected; newer clicks or project switches supersede older responses through docRequestSequence. Existing card highlight and CSV citations remain.

Files changed: ui/provenance.js exports bounded documentPageStartForLine and nativeSourceLocation; ui/app.js connects the click and rechecks the citation; ui/app.css adds only a line highlight; tests/p541-source-line-jump.test.mjs tests label honesty, pagination boundaries, real PDF/DOCX cited API, 401/422 denials and UI contract. CI runs full Linux and Windows tests, Gold100, Negative20, Heldout24, and P5.37 wizard smoke.

No native PDF coordinates, OCR, customer data approval, user-selected file permissions verification, physical Windows UI acceptance, signed installer, freeform SQL or Production deployment. This remains a public synthetic local preview; main stays stable.

## Checked implementation and CI
- Functional+test source SHA `4adf1fcc7d75bfe1292dc17f6084f8830d5098fb`, [GitHub Actions #40546464374](https://github.com/hibi89/RAG_STUDIO/actions/runs/40546464374). Windows Node22.23 completed **506 pass / 0 fail / 0 skip** and existing quality gates; Linux runner queued when noted. Do not mark Linux success without actual job log.
- Earlier failures in test-only compatibility: old P3.2 UI mock assumed synchronous citation text; updated to supply verified document API reply, assert pending state, await source response, and assert exact row focus. First fix had mismatching regex for pending UI sentence; updated test matcher. No code security condition was removed.
- Real Chrome/Edge click on user's physical Windows PC not separately run; mocked DOM and real authenticated source API tests included.
