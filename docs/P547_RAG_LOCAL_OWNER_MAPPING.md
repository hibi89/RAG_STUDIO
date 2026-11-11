# P5.47 — Local owner-mapping draft editor and byte-pinned recheck (2026-11-12 KST)

## User-facing purpose

This is an **offline, RAG-owned review workflow** for an explicitly selected local CSV. It does **not** run private SMAX code, import SQLite, approve customer data, or send files to the network. Its only deliverable is a re-checked, still-unapproved `RAG_PREP_MAPPING_PLAN_V1`.

Two approaches were compared:

1. **Private SMAX direct reuse** — fewer mapping adapters but source exposure and version coupling in the public RAG_STUDIO repository, and conflicts with the SMAX owner workflow. Rejected.
2. **Public RAG draft + independent SHA recheck** — small local files, no external APIs, contract boundaries remain separate, and the CSV must still be re-read before use. Chosen.

## Reproducible local sequence

Prerequisite: checkout of this exact feature branch and Node.js >=22.16.0. Use **only data you own or are authorized to inspect**, and do not upload plan JSONs to a shared/public destination: header names and hashes can be sensitive.

1. Run `node src/prep-mapping-cli.mjs "/absolute/input.csv" > "proposal.json"` in a local terminal. On Windows, use absolute Windows CSV paths. This produces a metadata-only REVIEW_HOLD proposal; direct stdout redirection should be done in a user-controlled directory.
2. Open `ui/prep-owner.html` in a local browser. Select `proposal.json`. Choose each source column's target key, type and required flag. The form pre-fills neither target key nor type; user semantics are explicit. Download `rag-prep-owner-draft.json`.
3. Run `node src/prep-owner-verify-cli.mjs "/absolute/input.csv" "/absolute/rag-prep-owner-draft.json"`. The read-only CLI requires both absolute local files, re-reads original CSV bytes via P5.28 reader, enforces saved SHA+byte-size agreement and strict mapping schema, and returns a `REVIEW_HOLD` verification JSON. Modified CSV, duplicate binding, malicious path, symlink JSON, oversized draft and contradictory status fail closed.
4. A reviewer must separately resolve `HUMAN_FIELD_SEMANTICS_UNVERIFIED`, `SOURCE_RIGHTS_UNVERIFIED`, `SMAX_NATIVE_PRODUCER_UNVERIFIED`, plus any incomplete/type/quality flags. This implementation provides **no approval/AX import** path.

The browser editor loads only the plan JSON from user selection, uses text-only DOM operations, does not load source rows or network resources, and downloads only a mapping draft. A customer/SMAX approval protocol remains entirely out of scope. Windows browser file:// handling and downloaded file UX require real-world testing.

## Verification boundaries

- Node v22.16.0 Linux: scoped **14 PASS / 0 FAIL / 0 SKIP**, `node --test tests/p547-owner-ui.test.mjs tests/p547-owner-verify.test.mjs`; existing public `src/local-csv-review.mjs` blob `76fcab001cde51e71df8056a2eb51d808a57f522` and `src/prep-mapping-plan.mjs` blob `699f5228b6dcbda4677688da3cf89822eabcc72e` matched local test copies exactly.
- Scope includes CLI actual child process on synthetic local CSV, original file byte immutability, mutation rejection, prototype/unknown key schema refusal, review blockers and simulated UI draft function through Node VM. This is **not** an actual full browser click or Windows customer acceptance test.
- GitHub full npm/Gold100/Negative20/Heldout24 and Windows GitHub CI are **pending until runs are observed** on the committed source SHA. Do not treat workflow definition as evidence of success.
- Original SMAX private repo, RAG develop/main, original customer/ZIP assets, GitHub deployment and release are untouched.

## Next safe milestone

Real local browser UI interaction test (HTML file selection, mapping, downloaded draft, returned CLI), **full repo Windows+Linux CI**, then independent public contract integration and no-row-data cited search preview. The private SMAX producer/owner signature and actual customer acceptance remain separate user-approved gates. Until then the project retains its documented **70% provisional final-product score**; this source-only review unit does not independently establish 85% readiness, and RELEASE HOLD continues.
