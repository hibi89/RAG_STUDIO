# P5.42 — Windows native PDF/DOCX selection and local preview launch

2026-10-28 KST · Public **synthetic-only** local preview. P5.40 already supports 2–4 PDF/DOCX files via command line. P5.42 removes the need to type those file paths.

## Windows source-checkout quick start

Prerequisites: **Windows Node.js 22.23 or newer** and an unpacked/local RAG_STUDIO **source checkout**. Once, in the project root, install pinned dependencies:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
```

Then **double-click** `RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd`, select **2–4** local PDF or DOCX files in the standard Windows file dialog, and choose **Open**. A browser is opened automatically to a newly generated **127.0.0.1** private session URL; if Windows does not open it, use the URL shown in the console. Use normal RAG Studio document search, Knowledge Base, PDF page / DOCX paragraph citation jump, and fixed synthetic SQLite/SKU metrics. Press Ctrl+C in the console to end the session and delete the temporary derived AX folder.

Only the bundled, verified **public synthetic AX project** `fixtures/ax_multi_doc_v0` is used as the underlying metric demo. Selecting a PDF/DOCX extracts **untrusted local text preview**, NOT a new approved customer data source, real user identity proof, owner permission, document copyright/right-to-process approval, or SMAX Native import. Original PDF/DOCX files remain unchanged and are not remotely uploaded. The local server remains bearer-protected.

**Important:** This launcher is currently provided for the repository **source checkout after npm ci**, not as a one-click standalone EXE/ZIP installer. The older synthetic portable ZIP intentionally does not bundle the PDF.js/Mammoth dependencies. No unattended installation, auto-update, admin privileges or paid service is performed.

## Architecture and boundaries

1. The literal `RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd` takes **no arguments**, starts in its own repository folder, requires Windows Node22.23+, and checks for both parser dependencies. If a `portable-manifest.json` exists, the existing integrity verifier must pass. The fixed `powershell.exe -NoProfile -STA -File scripts/p542-native-file-picker.ps1` uses `System.Windows.Forms.OpenFileDialog` and rejects cancellation without touching sources.
2. The file-dialog selected paths are **never expanded into CMD variables**, interpolated into PowerShell `-Command`, passed as shell arguments, or included in a URL. The PowerShell script serializes `{source:"WINDOWS_NATIVE_PICKER_V1",documents:[...]}` as UTF-8 (sets PowerShell5.1 pipeline `$OutputEncoding`), pipes it to one fixed Node script via stdin.
3. `src/native-document-picker-cli.mjs` applies a fatal UTF-8 decoder, 16 KiB input cap, exact JSON keys, 2–4 distinct absolute .pdf/.docx paths and control-character refusal. The existing `openNativeDocumentCollectionPreview` then enforces original inode/size/digest checks, 2MiB-per-file bounds, no symlink/hardlink aliases, real PDF.js/Mammoth extraction, SHA-verified ephemeral TXT manifest and derived verified source search. The synthetic AX base path is **hardcoded**, not accepted from stdin.
4. The newly generated bearer session URL is allowed for Windows Explorer auto-open only after its precise `http://127.0.0.1:<port>/#session=<43 chars>` pattern is checked. `explorer.exe` is spawned with `shell:false` and **one URL argument**. No external domains are opened by this feature.
5. No source paths or PDF contents are intentionally written to console, logs, or manifest source titles. Browser session links are secrets; don't share or log them. If Windows cannot launch a default browser, the console URL remains available. Node localhost server lifetime controls ephemeral data cleanup (hard kill may leave temp data, and cleanup after abnormal OS termination is not guaranteed).

## CI contract
`tests/p542-native-file-picker.test.mjs` covers narrow selection, UTF-8 Korean/special-character path bytes, duplicate/injection refusal, bad JSON/budgets, safe loopback browser dispatch with injected spawn, actual spawned Node CLI through stdin with 200/401 HTTP and both formats' citations and SKU totals, no original modification, Windows script static protection, actual PowerShell parser and CMD unexpected-arg refusal on Windows. Linux tests must not claim a real Windows GUI dialog was clicked.

The new `.github/workflows/p542-verify.yml` validates Linux Node22.16 and Windows Node22.23 `npm test` plus original Gold100, Negative20, Heldout24, P5.37 smoke, `node --check` and existing router demo. CI can verify PowerShell syntax but GitHub hosted runners do **not** validate an actual interactive file-dialog click on a personal Windows PC. Do not claim signed native installer, customer dataset authorization or Production deployment.

The safe fallback remains `npm run preview:document -- ./fixtures/ax_multi_doc_v0 <file1.pdf> <file2.docx>` (manually supplied paths). The existing single-file command remains unchanged.
