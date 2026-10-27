# P5.17 — Bounded local grounded conversational follow-up

2026-10-27 KST · Public RAG Studio developer-preview on synthetic data, Node >=22.16.0. No customer ingestion or external LLM.

## Contract / design trade-off
- **A: stateless client-provided prior question + independently verified evidence + active opaque project key (chosen).** Zero server chat persistence, lower support cost, explicit provenance and no cross-tab chat state. The prior question is not trusted: `routeQuestion` validates it and complete source data again, then one canonical period intent is re-run.
- **B: server-maintained per-session context.** Shorter request but exposes shared-tab/project-state contamination, lifecycle/memory limits and persistence/security complexity; not selected for first MVP.

`POST /api/conversation` body is **exactly**:
```json
{"question":"그건 며칠이야?","previous_question":"반품 기간은?","project_key":"<opaque current session key>"}
```
The project key is obtained from authenticated `GET /api/projects`, never from a filesystem path. If the previous evidence was not ANSWERED or has sales/multiple domain intents, the endpoint abstains with `CONTEXT_UNVERIFIED` or `AMBIGUOUS_CONTEXT`. Only limited explicit ellipses for prior return/shipping *periods* are resolved, with `conversation.resolved_question` set to canonical verified period question for next turn. Unsupported wording returns `NOT_SUPPORTED`. Changing project returns HTTP 409 before source evaluation; changed source hash returns 422; non-auth requests 401 and wrong Origin 403. Strict 2KiB input and length/type/unknown-field checks. No generated SQL, arbitrary path, source file writes, session memory, external calls, or confidential raw source in new API error messages.

## UI
Normal **통합 질의 실행** continues unchanged. After an ANSWERED result and confirmed current project key, **근거 확인 후속 질문** becomes available. The browser sends the last verified question only if the user explicitly clicks follow-up, then replaces it with the canonical verified question after ANSWERED. Reload, unsupported/failed query, or successful project switch clears context. Pending old-project answers are discarded and controls restored after switch. Existing document, CSV, KPI and SMAX preview paths remain separate.

## Measured acceptance
[GitHub Actions #40490943430](https://github.com/hibi89/RAG_STUDIO/actions/runs/40490943430), source/workflow SHA `cec2094f2d59ca605ed921af5c98089f3f0445ac`, Ubuntu24.04 Node22.16: `npm test` **342 pass / 0 fail / 0 skip**; doctor, gold100, negative20, heldout24, syntax all successful. Actual local Chromium simple original-question -> explicit follow-up UI **10 checks PASS**; browser job was continue-on-error for driver startup variability but actual concluded success. Unit and live localhost tests include provenance, prior unverified/mixed/sales rejection, 401/403/409/413/415, malformed JSON, changed source, third turn and mock UI race/project reset.

## Known limits
Only narrowly phrased Korean period follow-ups, not general multi-turn freeform conversation, model-driven query rewriting, dense/hybrid ranking, future/past time context, all business schemas, signed Private SMAX reviewed output, local model operations, Windows/Edge 3-PC, real customer data authorization, installer, SOVIA, Vercel or commercial release. No claims of commercial readiness.
