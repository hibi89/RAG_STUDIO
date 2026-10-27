# P5.27 — explicitly selected local TXT/Markdown into existing verified RAG workspace

2026-10-27 KST; baseline develop \`167af0f8e50f2a3fda22eaf3abe8526891a6a3b4\`.

P5.11 already allows opening a validated AX_DATA_PACKAGE_V0 folder, and P5.12 adds one separately selected PDF/DOCX to a disposable derived package. P5.27 extends the functional MVP to allow a user to select **1–4 independent local UTF-8 TXT/Markdown documents** for a temporary copy alongside an already SHA-verified sales/project package. The original files and baseline AX folder are never modified.

\`\`\`bash
npm ci --ignore-scripts --no-audit --no-fund
npm run preview:text -- "/absolute/verified-AX-folder" "/absolute/my-policy.txt" "/absolute/manual.md"
\`\`\`

The CLI starts the existing protected loopback dashboard on 127.0.0.1, prints its private per-run fragment token, and on Ctrl+C removes the derived temporary package. Selected source texts are not scanned automatically, uploaded externally, made persistent by this CLI, or approved by SMAX. The source titles in UI are generic (not filenames or local paths); new documents have 1-based line citations and are searchable through existing BM25 and knowledge selection. Verified CSV, SQLite totals and preexisting source lines remain intact. This is a **local operator preview**, not a customer consent/legal rights proof or a complete general ZIP-import pipeline.

Security/limits: only explicit TXT/MD regular files, no symlinks or invalid UTF-8, ≤256 KiB each, at most 500 lines of ≤4096 characters, max 4 new files, read-only original file handles, startup SHA verification of all approved original package bytes and copied derived files, and path-free error codes. Malicious control bytes are refused. No arbitrary zip decompression, model installation, cloud/API costs or generated LLM factual answers.

Evidence: Node test cases cover TXT and MD source citations, unchanged verified 157,000 KRW SQLite totals, temporary cleanup, source tamper, input symlinks, encoding limits, no path leakage and a real 401/200 authorized local HTTP launch. CI should verify full npm test/doctor/gold/negative/heldout. A real user's source file, SMAX Native signed producer, Windows 3-PC installer and customer release remain unverified.

**Next P5.28**: refine local user-selected file workflow for general CSV schema review without silently approving arbitrary customer fields, then harden Windows self-install/upgrade and all five RAG journeys. No production main promotion before product gates.
