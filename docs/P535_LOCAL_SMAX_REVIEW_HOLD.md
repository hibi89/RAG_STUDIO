# P5.35 — Local SMAX V1 source review HOLD (2026-10-28 KST)

## Goal, decision and scope
- Prioritize actual local input in the MVP-first workflow, not appearance, extra AI models, seller claims or auto-created AX accepted packages.
- The user explicitly selects three files: a SMAX_PREPROCESS_GENERIC_CSV_V1 JSON, its exact original UTF-8 CSV, and one UTF-8 TXT or Markdown document. The files remain on the user's own machine. Current UX is a command-line review, not a dashboard import wizard.
- Review is always **REVIEW_HOLD**, including clean files. No stage-to-approval transition is implemented: even producer `READY_FOR_HUMAN_REVIEW` and a valid digest do NOT prove ownership, data rights or human consent. A forged approval claim is rejected.

## How to run
Developer checkout (requires Node 22.23 on Windows, Node >=22.16 on tested Linux):
```shell
npm run review:smax:local -- "C:\\data\\smax-v1.json" "C:\\data\\original.csv" "C:\\data\\policy.txt"
```
Windows ZIP (installed Node.js 22.23.0, no runtime is bundled):
```bat
RUN_LOCAL_SMAX_REVIEW.cmd "C:\data\smax-v1.json" "C:\data\original.csv" "C:\data\policy.txt"
```
ZIP download: GitHub Actions [P5.35 #40533429780](https://github.com/hibi89/RAG_STUDIO/actions/runs/40533429780) → Artifacts → RAG_STUDIO_P535_LOCAL_REVIEW_MVP → unzip the included portable ZIP → run inside it. This build contains 62 public source/config files.

## Actual behavior
1. Explicit filenames only; regular files bounded to SMAX JSON <=4MiB, original CSV <=2MiB, TXT/MD document <=256KiB. Validates every ancestor for symlinks/reparse, rejects leaf symlink, verifies lstat-vs-open-file fstat dev/ino/size/mtime and stable file bytes. Re-reads each original after semantic parsing to detect changed files. Duplicate selected files/hardlinks are rejected.
2. Existing public SMAX V1 consumer independently verifies source digest, CSV fields, normalized values, duplicate IDs, positive quantities, quantity × price=amount and review queue. A valid cleaned source can have **provisional** local revenue/units/orders only; any row marked NEEDS_REVIEW returns null amounts, not invented totals.
3. Document is strictly UTF-8; rejects empty/control/oversized files; max 500 lines and 4,096 characters per line. Returns SHA256, byte size, source-line count, no document text or page citations.
4. Output is one safe JSON review record: `RAG_LOCAL_SMAX_REVIEW_HOLD_V1`, `REVIEW_HOLD`, CSV SHA and row count, provisional metrics or null, document hash/count, and all approval/import flags false. No source paths, original row values, source document text, JSON keys from customer input or credentials in stdout/error; no database mutations, output directory, persistent stage, network/API calls, auto-updates or service startup.
5. This is **not** an approved data importer and does not merge with currently displayed synthetic dashboard metrics. Existing P5.34 is still ONLY pinned public synthetic input. Local SMAX V1 file preview is deliberately separate.

## Real test evidence
- Code SHA `ba7424aa84dc468c6ccdadc9519c486e8bf32e49`, [Actions run #40533429780](https://github.com/hibi89/RAG_STUDIO/actions/runs/40533429780) `completed/success`: Windows2025 Node22.23 **465 PASS, 0 FAIL/SKIP/CANCEL**; Linux Ubuntu24.04 Node22.16 **465 PASS, 0 FAIL/SKIP/CANCEL**.
- Windows original CLI/CMD smoke **4/4**, copied portable CLI/CMD **5/5**. Linux direct CLI **3/3**, copied portable CLI **4/4**. The original portable P5.34 SMAX-shaped source → AX → real SQLite/SQL_DOCUMENT HTTP evidence **still passes** on both OS.
- The Windows ZIP built with 62 public files, expanded in a separate directory, passed manifest integrity verification (`PORTABLE_MVP_INTEGRITY_PASS`). GitHub artifact `RAG_STUDIO_P535_LOCAL_REVIEW_MVP`, artifact ID 12746134536, 117695 bytes, retention 7 days.
- New unit tests cover clean unapproved source, alternate recalculated source (158000 provisional KRW), review-needed null totals, tampered CSV SHA, forged producer approval, arithmetic forgery, binary/oversized/empty documents, duplicate paths, direct/ancestor symlinks and hardlink aliases, output sanitization, no persistent writes.
- First P5.35 run `#40533133365` had both platforms 465 tests pass, Windows portable CMD smoke failed due test incorrectly parsing two JSON lines (bundle integrity preflight JSON followed by review JSON) as a single JSON object. Corrected smoke parser only; final green `#40533429780` reran the complete suite. Security/source code was not weakened.

## Known limitations and next highest-priority task
- No real customer-provided inputs were used in CI; only public synthetic files copied into local temporary directories. Real file ownership/rights and content accuracy cannot be inferred from a valid SHA/preview.
- No authenticated reviewer, explicit meaningful customer approval, SMAX Private Native sign-off, permanent AX conversion, SQLite import, document index or user-visible dashboard registration of these local files.
- Node 22.16 on Windows is incompatible with strict file identity checks; 22.23 passed. Existing global package floor >=22.16 was not modified without product-policy approval.
- Next P5.36: design a local user-owned data review approval workflow with explicit field semantics (revenue definition, KRW integer, VAT/tax meaning) and durable audit evidence **without** accepting self-reported JSON approval or untrusted data. Obtain owner policy sign-off before turning `REVIEW_HOLD` into an AX accepted package. User-facing controls and real customer E2E come after that.
