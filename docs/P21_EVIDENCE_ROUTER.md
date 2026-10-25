# P2.1 — Evidence-aware deterministic query router (2026-10-26 KST)

## Scope
`src/evidence-router.mjs` connects verified `AX_DATA_PACKAGE_V0` synthetic inputs to the **existing** `withReadOnlySales` in-memory SQLite calculator and `searchDocuments` BM25 lexical retrieval. `src/router-cli.mjs` exposes a local command. The router supports only sales aggregate, explicit return/refund application period, and shipping preparation start period, individually or together. It makes **no claim** to generalized natural-language understanding, trained model generation, or arbitrary SQL.

## Architecture decision / alternative
- **A — selected**: inspect a bounded question for supported intent words; verify all package paths/digests/status; retrieve approved TXT documents; extract narrow, regex-identified duration claims from the complete verified TXT corpus (not only the top-10 ranked hits); cross-check each cited line with retrieval output; use fixed SQLite statements for validated sales totals; answer only if *all requested supported intents* have their evidence. Local/no paid API, simple maintenance, limited natural language coverage.
- B — deferred: LLM router + generated SQL + semantic dense vector retrieval. Broader coverage, but memory/model cost, security testing, reproducibility and refusal quality unresolved; generated SQL is prohibited as an MVP default.

## Output and refusal contracts
`routeQuestion(packageRoot, question)` returns `ANSWERED`, `NOT_SUPPORTED`, `INSUFFICIENT_EVIDENCE`, or `POSSIBLE_CONFLICT`. `ANSWERED` carries `kind` (`SQL_ONLY`, `DOCUMENT_ONLY`, `SQL_DOCUMENT`), `metric_evidence` (CSV source line pointers), `document_evidence` (document/file/title/one-based line/quote and day unit), and a small limitations list. Missing policy evidence **never yields a partial multi-part answer**. Contradictions on distinct `N일 이내` return or `N영업일 이내` shipping-prep values trigger `POSSIBLE_CONFLICT` with `review_evidence`; no answer. Every source is in a SHA-256 verified, `ACCEPTED` TXT file. File content and question text are never executable commands or SQL.

This is a **narrow lexical heuristic**: effective dates, product-specific exceptions, synonyms, negation, arbitrary clauses, and legal interpretation are **not** resolved. A result is a quoted synthetic-source fact, not a guarantee about customer policies. An unsupported subquestion not recognizable by this router is not guaranteed to be detected; downstream UI must display the limited supported scope. Retrieval must find at least one exact cited policy fact before answering. The small sample does not validate broad search quality.

## Test evidence
Linux container, Node `22.16.0` built-in `node:sqlite` experimental module, zero third-party npm packages.

```sh
npm test
npm run demo:router
npm run demo:mixed
npm run demo:search
```

Locally on 2026-10-26: **60 pass, 0 fail, 0 skip**: P0 16 + P1 12 + P2 17 + P2.1 15. Demo: 157,000 KRW (six orders, ten units), return application within seven calendar days (returns TXT line 2), shipping preparation within two business days (shipping TXT line 2). Negative tests cover no evidence, modified source hash, rejected source, unsupported/overlong question, conflicting periods including beyond top-10 retrieval hits, SQL injection text, immutable originals.

## Pending
Actual RAG original ZIP/license/secret scan, private SMAX producer adapter, Windows PCs, full PDF/DOCX, quality benchmark (100 questions), multiple datasets, UI/dashboard, offline installer/recovery, commercial policy and penetration testing. No cloud, Vercel production, third-party API or customer data involved. See `STATUS.md` and `HANDOFF.md`.
