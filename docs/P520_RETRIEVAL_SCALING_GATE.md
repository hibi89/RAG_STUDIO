# P5.20 — 24/64/96 documents, 120 grounded questions per scale

**2026-10-27 KST · Synthetic controlled gate, NOT an independent semantic/dense benchmark.**

## Engineering decisions
P5.19 showed 8/8 recall for both methods on only two files. To avoid declaring a winner from that toy corpus, P5.20 adds generated, hash-checked V0 packages at **24, 64, 96 TXT documents** plus exactly one pre-existing synthetic CSV dataset. Largest package contains **97 files**, within current V0 validator **100-file bound**; 12 lines/document, at most 1,152 document lines in this test. Generator uses `mkdtemp`, original synthetic sales.csv/manifest schema, fresh document IDs, individual source-byte SHA-256 and self-consistent processing summary; sources live in disposable OS temp only, are never sent externally, and are removed at completion.

Ground truth is generated *before* search results: **120 positively labeled questions per corpus** split evenly into 30 exact identifier, 30 identifier with whitespace, 30 one-character identifier typo, 30 reordered reference/topic queries, plus **12 unrelated negative queries**. Deliberately restrictive: generated unique `ZX0001` identifiers and repeated 12-topic templates favor lexical overlap. This is **not natural-language semantic generalization**, paraphrase outside these four families, OCR/real PDFs, domain/customer QA, or an independent human-annotated gold corpus. No customer data used.

## Measurement method
`node scripts/p520-scale-gate.mjs` performs six **isolated Node processes**, one for each (doc count 24,64,96) × (BM25, opt-in lexical RRF) combination. Each worker evaluates 132 questions, retaining Recall@1, Recall@3, MRR@3 and family-level counts, negative false-positive count, request median/p95 time, cumulative CPU user/system ms, Linux `process.resourceUsage().maxRSS` peak memory, and observed RSS. It includes **repeated manifest validation and in-process source-loading/tokenizing cost** in every request; **not** just ranking throughput. MaxRSS includes Node/runtime startup and memory allocator behavior, is not GPU/FAISS/dense model memory; peak values are individual-process estimates, not Windows RAM certification. A single run with no confidence intervals does not characterize field variance.

### CI observations — exact run
[GitHub Actions **40496742548**](https://github.com/hibi89/RAG_STUDIO/actions/runs/40496742548), Ubuntu 24.04, Node.js 22.16.0, code/workflow SHA `56eb23f819489a65b164446b12aa7d04d5e8c814`. `npm test` **373 PASS / 0 FAIL / 0 SKIP**, `npm run doctor`, `test:gold`, `test:negative`, `test:heldout` passed; benchmark step completed successfully. **No additional Chromium test was introduced for this benchmark-only unit**; P5.19 Chrome 15 checks previously PASS and production UI code is unchanged.

| Documents | BM25 Recall@1 | Lexical RRF Recall@1 | BM25 Recall@3 | Lexical RRF Recall@3 |
|---|---:|---:|---:|---:|
| 24 | 90/120 (75.0%) | 120/120 (100%) | 120/120 (100%) | 120/120 (100%) |
| 64 | 71/120 (59.2%) | 118/120 (98.3%) | 96/120 (80.0%) | 120/120 (100%) |
| 96 | 67/120 (55.8%) | 108/120 (90.0%) | 85/120 (70.8%) | 120/120 (100%) |

| Documents | BM25 p50 / p95 | Lexical RRF p50 / p95 | BM25 CPU user total | Lexical RRF CPU user total |
|---|---:|---:|---:|---:|
| 24 | 2.665 / 5.142 ms | 4.999 / 8.289 ms | 535.18 ms | 859.16 ms |
| 64 | 5.524 / 10.449 ms | 11.559 / 17.408 ms | 908.67 ms | 1754.34 ms |
| 96 | 8.302 / 15.941 ms | 16.968 / 25.099 ms | 1380.41 ms | 2431.92 ms |

All six cohorts reported **0/12 negative false-positive cases** on their synthetic unrelated questions (72 negative evaluations overall). The separate-process Linux max RSS measurements were: 24-doc BM25 **81,698,816 B** vs lexical RRF **100,085,760 B**; 64-doc **101,105,664 B** vs **107,048,960 B**; 96-doc **125,509,632 B** vs **106,672,128 B**. The nonmonotonic 96-document difference is an explicit warning not to infer a consistent memory advantage from this limited single run. Wider memory/low-end Windows evaluation is still needed.

## Product decision / original-blueprint gap
**Keep BM25 as user default.** P5.19 lexical fusion remains a manual opt-in experiment, and P5.20 measured meaningful gains only on the deterministic identifier perturbation cases, at nearly 2x latency. This benchmark **does not implement or evaluate true embedding-based Dense/FAISS**, RRF/MMR with learned vectors, scanned PDFs/DOCX semantics, customer documents, multiple locales or long 10k-line workloads. Dense adoption requires offline model/license and explicit download policy, independent human-like Korean/English semantic held-out gold and baseline comparisons, test of prompt/data privacy, bounded streaming index/CPU and RAM peaks, and Windows/Edge 3-machine compatibility. No deployment, no Private SMAX Native approval bypass and no `main` release.

## Reproduce and provenance
From checkout with Node >=22.16.0: `npm ci --ignore-scripts --no-audit --no-fund && npm test && node scripts/p520-scale-gate.mjs`. Raw JSON output prints both methods' source counts, family-level breakdown and machine timings for all three sizes; results vary across hardware/runs. `scripts/p520-corpus.mjs` and `scripts/p520-benchmark-worker.mjs` are isolated eval-only modules and do not alter `/api/knowledge` or any production code. No customer/secret files, paid calls, persistent benchmark artifacts or repository data mutation.
