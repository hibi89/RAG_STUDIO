# P5.12 — Offline PDF page / DOCX paragraph preview in RAG Studio

2026-10-27 KST. Public feature \`feature/p512-pdf-docx-local-preview\`. This phase advances the **functioning MVP first**, then original design gaps, then final commercial safety/compatibility approach. It is NOT a customer-ready arbitrary document importer.

## Design compared
- A: Add a handwritten PDF/OOXML parser with no new dependencies. Rejected for real document usability: PDF object streams, Unicode fonts and Word OOXML variants make a tiny homebrew parser unreliable.
- **B selected:** pin audited open-source library versions \`pdfjs-dist@6.4.299\` (Apache-2.0) and \`mammoth@1.12.2\` (BSD-2-Clause) for extraction. Extract locally to a disposable **derived, SHA-256-verified AX_DATA_PACKAGE_V0** temporary folder rather than rewriting all synchronous search/dashboard APIs. Costs no paid service/API, but adds offline installation/package and future license notice obligations. Libraries are installed with lifecycle scripts disabled in CI. npm lock must be committed before merging.

## Local command

\`\`\`bash
npm ci --ignore-scripts --no-audit --no-fund
npm run preview:document -- "./fixtures/ax_multi_doc_v0" "/absolute/local/path/sample.pdf"
npm run preview:document -- "./fixtures/ax_multi_doc_v0" "/absolute/local/path/sample.docx"
\`\`\`

Launches existing localhost bearer-protected dashboard. Search for words in the document; the result is a **literal quote from an extracted text line**:
- PDF line begins \`[PDF page 1]\` or another actual parsed page. Very long page text is split into multiple bounded lines with repeated page marker. The dashboard source line number refers to the **derived TXT line**, not the original PDF text geometry. No visual highlight, bounding boxes, table extraction, PDF embedded links or OCR.
- DOCX line begins \`[DOCX paragraph 1]\`, etc. **DOCX doesn't have stable page numbers**, and no arbitrary page is assigned. Mammoth raw extraction avoids the risks of HTML rendering, macros, images, links and external content.
- The source document is explicitly selected and read locally, size limited to **2 MiB**; existing base directory must already validate as an approved-by-manifest AX_DATA_PACKAGE_V0 and pass a second verification after copied. New output is only a temporary, new directory; user PDF/DOCX and base package remain unchanged. Ctrl+C triggers cleanup; non-normal OS termination may leave temp files pending later cleanup. No external API calls by application.
- The derived document is *preview text*, not proof of ownership, identity, privacy compliance, lawful use, trusted Native SMAX approvals, semantic mapping, malware-free input or suitability for customers. The source file's original SHA is not itself displayed to browser users; it is not a forensic chain of custody. The extracted TXT gets its own SHA and manifest entry.

## Test contract and known limits

Synthetic tests construct **real, parseable binary PDF (two pages)** and **real minimal OOXML DOCX (Korean text, two paragraphs)**, then validate the actual offline library extractor, original/source integrity, supported text/suffix/size bounds, symlink refusal, scanned PDF abstention, real child-process local CLI, 401 bearer auth, searchable derived page quote and correct SQLite retained metrics.

Existing \`npm test\`, gold100, negative20, heldout24 and doctor regressions must all run in CI. Refer to \`STATUS.md\` for the **exact CI run, tested SHA and observed pass/fail counts**. P5.11 real Chromium smoke remains separately verified; flaky ChromeDriver session setup is not part of the P5.12 native extraction CI gate, so do not claim new browser visuals from P5.12.

**Unsupported/unfinished:** scanned/image-only PDF (no OCR), encrypted/corrupt files, all PDF fonts/images/tables and DOCX complex layout, DOCX true rendered page numbers, source text bboxes/section anchors, file size over 2MiB, real Windows 3-PC native installation, customer ZIP/SMAX Native ingest, dense vector RAG and multi-turn dialog, original source ZIP, malware scanning, license distribution notices, product release. PDF.js standard font warning in Linux synthetic tests requires further compatibility review if field glyphs are missing. Some valid documents may be refused rather than guessed.

## Next working feature
Next iteration should widen supported local **data input** through real Native SMAX-vetted producer contract (read-only until owner approval), add visible source selector/document list UX or bounded PDF/DOCX page-level citations directly in dashboard. No repeated approval-only paperwork. Then dense/hybrid retrieval, conversation, model/installer options and release QA.
