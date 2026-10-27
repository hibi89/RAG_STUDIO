# P5.21 — Korean/English semantic retrieval readiness: controlled synthetic evidence

2026-10-27 KST · Public RAG Studio AX Edition `develop` candidate. This is an **offline baseline gap evaluation**, not model-backed dense search or commercial evidence.

## Why this unit

P5.20 generated reference identifiers (ZX####), whitespace changes, typos and reordered identifiers. Such a corpus can make a lexical RRF appear excellent without testing cross-lingual meaning. P5.21 **does not alter** production BM25, opt-in lexical RRF, `/api/knowledge`, models, dependencies or the local UI. It adds a distinct evaluation suite to identify specific failure modes before committing to a large local embedding/FAISS distribution.

## Dataset, source boundaries and limitations

- **20 SHA-256-verified synthetic TXT sources**, 10 Korean and 10 English. For each of 10 hand-authored operational topics, the Korean and English documents address *different factual requirements* within a related topic; selecting the same topic's wrong-language sibling is an incorrect citation.
- **120 positive question/source labels**: 30 Korean question→Korean source (KO_SAME), 30 English→English (EN_SAME), 30 Korean→English (KO_TO_EN), 30 English→Korean (EN_TO_KO). Plus **12 unrelated astrophysics / science questions** with no expected source.
- The labels and text were authored together by the implementation author; they are **not externally adjudicated human annotations or customer held-out data**. Language and domain coverage, specificity, annotation independence and paraphrase realism are limited. No ground-truth validation for legal/accounting interpretation.
- Repro: `node scripts/p521-bilingual-benchmark.mjs`. It creates a disposable `AX_DATA_PACKAGE_V0` temp directory with 21 total files (20 TXT+1 synthetic CSV), uses original format/manifest and fresh hashes, executes `searchDocuments` vs `searchLexicalHybrid` with `limit:3`, compares the **actual source document ID** rather than mere `FOUND`, captures @1/@3, unanswered positives and unrelated false positives, and deletes temporary input files in `finally`.

## Actual GitHub Actions results

[Run **40498808959**](https://github.com/hibi89/RAG_STUDIO/actions/runs/40498808959), exact source and workflow SHA `eccf112b33802e88462f2bf0cad9f1e2a1e7ed0c`, Ubuntu 24.04 Node 22.16.0, **`npm test` 379 PASS / 0 FAIL / 0 SKIP**, doctor, gold100, negative20 and heldout24 all successful; evaluation script successful. Six new Node tests cover label counts, package/hash integrity, opposite-language label direction, citation validity/read-only processing, tampering, and negative query contract. Production UI unchanged; no new Chromium test on this evaluation-only unit.

| Expected citation within top 3 | Default BM25 | Opt-in lexical bigram RRF |
|---|---:|---:|
| Korean question → Korean source | 30/30 | 30/30 |
| English question → English source | 30/30 | 30/30 |
| Korean question → English source | **0/30** | **0/30** |
| English question → Korean source | **0/30** | **0/30** |
| Overall positive @3 | **60/120** | **60/120** |
| Wrong citation on unrelated negatives | 4/12 | 6/12 |
| Median end-to-end latency (ms) | 0.907 | 1.492 |
| p95 latency (ms) | 1.654 | 2.915 |
| Total user CPU across 132 queries (ms) | 184.278 | 258.504 |

Top-1 source accuracy by same-language group: Korean 30/30 both, English 28/30 both. All 60 cross-lingual questions **missed correct source within top 3**, sometimes ranking a wrong same-topic sibling document above it. Distinguish **retrieval false positive** from a factual answer: `FOUND` is a candidate excerpt, not a verified human-facing answer. A wrong hit should not be promoted to certain policy guidance.

The p50/p95 and CPU metrics reflect one Linux runner, one run, 20 short documents and full per-request SHA/source verification, not throughput certification or Windows performance. Small negatives are insufficient to estimate deployed false-positive rates.

## Technical decision: Dense/FAISS not approved for shipping

**Default BM25 remains; lexical RRF stays clearly experimental.** Neither current engine performs trained cross-lingual semantic retrieval. Current repository contains no implemented/offline-distributed learned embedding model or FAISS index, so P5.21 **did not install/download** model weights or change dependency/security boundaries. No verified distribution license, signed weights+SHA, offline Korean/English semantic recall, 3-PC Windows CPU/RAM/index performance, or true semantic hallucination/abstention proof yet.

Required next staged gates before any model-based experiment in customer software:

1. Identify and independently inspect a candidate local multilingual embedding **weights distribution, architecture, license and redistribution allowance**, model size, CPU memory and tokenizer compatibility; avoid customer data upload.
2. Provide **explicit opt-in** local model preparation; preflight disk/RAM, refuse missing/modified weights and fail safely back to BM25 without auto-download. No production toggles yet.
3. Run an actual **local model-backed** prototype on this separate source/citation corpus, compare top-k with baselines, include doc tampering/approval gates and independent manual bilingual annotations; do not confuse random/hash vectors with semantics.
4. Only later evaluate FAISS or another proven bounded CPU local vector index, resource usage and Windows three-device offline installation/edge/browser compatibility.

Production release and Native Private SMAX signed/human-approved producer intake remain **unverified**. No Vercel deployment, main promotion, private repository changes or actual customer data occurred.
