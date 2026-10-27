# P5.19 — Offline lexical fusion candidate (not semantic Dense RAG)

2026-10-27 KST · RAG Studio AX Edition developer-preview, synthetic verified package only.

## Decision/implementation
Existing production behavior: `searchDocuments(...)` BM25+Korean ngrams over SHA-verified UTF-8 TXT/MD. Preserved as **default**. New **optional experiment**: distinct Unicode character bigrams (NFKC lowercase, punctuation/whitespace stripped), cosine of overlapping bigram sets, top-10 candidate rankings fused with BM25 top-10 using reciprocal rank fusion `1/(60+rank)`; final evidence never exceeds original request limit 10 and always carries verified document/file IDs and 1-based lines. This mode is **lexical**, not a trained embedding, vector database, FAISS, BGE/sentence-transformer semantic retrieval or a claim of semantic answer accuracy. No package downloads, paid APIs or new dependencies. The existing SQL+document deterministic answer router and unselected BM25 searches remain unchanged.

In **선택 문서 지식베이스**, select 1–8 accepted TXT/MD files, enter query, choose **BM25 · 기본** or **BM25 + 문자 n-gram RRF · 실험**, then press **선택 문서 검색**. Exact authenticated API body for experimental mode:
```json
{"action":"search","project_key":"<current random 32-hex session key>","document_ids":["document-returns"],"question":"반품 신청 기간","mode":"lexical_hybrid"}
```
`mode` is optional for BM25/backward compatible. Illegal modes, mode on `compare`, unknown/duplicate document IDs, source modification, bad token/Host/Origin and stale project keys fail closed. No arbitrary local path and no persistent chat or file writes.

## Recorded evaluation
[Exact GitHub Actions #40495256771](https://github.com/hibi89/RAG_STUDIO/actions/runs/40495256771), full source+workflow SHA `516216c081e984f409ffc5c99d8e32314644a867`, Ubuntu24.04 Node22.16: `npm test` **368/368 PASS** (11 new tests over 357), doctor/gold100/negative20/heldout24 SUCCESS; ChromeDriver real UI **15 checks PASS**. `node scripts/p519-retrieval-benchmark.mjs` reads 2 synthetic policy files and 8 manually labeled Korean retrieval questions, repeats 3 times; end-to-end wall time includes manifest re-validation and source loading, not just ranking. Measured second run:

| Measure | BM25 default | Lexical ngram RRF |
|---|---:|---:|
| Recall@3 (questions) | 8/8 | 8/8 |
| Median response elapsed (ms) | 0.318 | 0.757 |
| p95 response elapsed (ms) | 0.942 | 1.164 |

First run #40495060835 also produced 8/8 both, median 0.333ms and 0.693ms respectively. **No recall improvement on this tiny test; lexical candidate is slower median**. Heap/RSS before-after deltas from sequential shared-process runs are not peak memory, nor reliable overhead comparisons. Repeat on larger and varied language/domain datasets before selecting any hybrid by default. Benchmark unit metrics should not be confused with real PC throughput or customer quality.

## Remaining original architecture gap
The masterplan's Dense FAISS + RRF/MMR with offline embeddings is **not implemented**. Before introducing learned-model downloads and on-device CPU/GPU/RAM cost, do independent held-out semantic/lexical regression on Korean real-like authorized synthetic queries, license/model binary audit, Windows offline stability and realistic large-document latency measurements. Existing `ACCEPTED` manifest label is not a signed/human approved Native SMAX producer. No customer dataset or commercial release proof.
