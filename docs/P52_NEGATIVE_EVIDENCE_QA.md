# P5.2 — Negative evidence & integrity gates (2026-10-27 KST)

## Objective and decision

Make the existing RAG Studio synthetic-only QA robust against **false positive answers**, contradictory approved policy lines, missing approvals/evidence and tampered manifests/files. This unit **does not** expand the accepted customer-data surface, change runtime query behavior, or claim security certification.

| Candidate design | Runtime/memory/cost | Quality and maintenance | Selection |
| --- | --- | --- | --- |
| A. Add ad hoc assertions to the existing 100-question corpus | Low setup, no dependency | Corpus only contains one fixed accepted package, so it cannot meaningfully express state transitions and corrupted files; weak isolation | Rejected |
| B. Create independent isolated fixture-mutation benchmark with fixed expectations, clean temp copies and full suite gate | Node built-ins only; 0 paid API; 20 bounded fresh temp copies | Verifies real fail-closed behavior and data integrity without changing approved source or product router | **Selected** |

## Synthetic matrix (20 fixed cases)

| Category | Count | Examples | Required behavior |
| --- | ---: | --- | --- |
| Positive control | 1 | Original approved public mixed package | `ANSWERED` with exact sales sum, orders, 7-day return, 2-business-day shipping citations |
| Contradiction | 6 | Extra 14-day return, extra 5-day shipping, contradictory claims on one line, 30-day hidden lower-ranked document, mixed conflict | `POSSIBLE_CONFLICT`, no answer/partial SQL metric, multiple verified source references |
| Insufficient evidence | 5 | Return or shipping document `NEEDS_REVIEW`, explicit policy period removed, mixed return evidence missing | `INSUFFICIENT_EVIDENCE`, no answer/partial metric |
| Invalid/tampered | 8 | Accepted TXT/CSV byte mutation without SHA changes, forged SHA, traversal path, broken file reference, false summary count, duplicate document ID, malformed manifest JSON | Existing validator throws; the **benchmark report** labels these as `REJECTED_INVALID`. This is **not** a new router response code. |
| **Total** | **20** | | |

- `src/negative-evidence-eval.mjs`: fixed test definitions, explicit expected state/periods and error patterns. Before any test, validates the public seed package ID plus pinned canonical sales digest. Copies the public approved package into its own fresh temporary directory for every scenario; mutates only the temporary copy; deletes only that directory. For legitimately changed synthetic TXT evidence, recomputes SHA/size and manifest. For tamper cases, leaves original SHA to ensure rejection.
- `scripts/p52-negative-evidence.mjs`: fixed read-only public fixture entrypoint. CLI command `npm run test:negative` returns nonzero on failed expectation. Report includes ID/status only, not source text, local path, credentials or full errors.
- `tests/p52-negative-evidence.test.mjs`: four Node assertions (all 20 scenarios pass, no leakage, no original changes, reject invalid root).
- `package.json`: adds `test:negative`. Existing runtime `src/evidence-router.mjs`, original P5.1 100-question corpus, public package fixtures, UI/server and Private SMAX source are **unchanged**.

## Exact executed verification

- Public GitHub feature code SHA **`0efed750317797aadd5581ff5c104efc1e955c47`**, pulled into isolated temporary compute VM from an exact public source archive. Node **22.23.4** / Linux arm64.
- `node scripts/p52-negative-evidence.mjs`: **20/20 PASS, 0 FAIL**, exit 0.
- `node --test tests/*.test.mjs`: **194 PASS, 0 FAIL, 0 SKIP, 0 CANCELLED**, exit 0 (15 test files, prior 190 + 4 new).
- `node scripts/p5-gold-eval.mjs`: **100/100 PASS**, exit 0; prior positive+unsupported gold contract unchanged.
- Archive checkout created in isolated temporary directory and **removed**. No Floot project files or database modified. This verification was **NOT GitHub Actions**, NOT Windows, NOT real Chrome/browser, NOT customer/real ZIP and NOT Production. No deployment exists.

## Acceptance and next work

This is evidence that the bounded **synthetic fixture test matrix** passes on Node Linux; it does **not** establish formal data-integrity security assurance, universal absence of hallucination, real customer accuracy, or Windows portability.

Suggested next priority: independently reviewed out-of-sample cases and nontrivial false-confidence text, then a **separate trusted PRIVATE SMAX native producer** synthetic contract test without moving source/artifacts into the public repository. Windows three-machine install, real legacy RAG ZIP, PDF/DOCX+dense, browser UI, human approval, licensing, commercialization and Production remain unverified/not implemented.

Release discipline: compare the CI/tested SHA with feature HEAD; only documentation differences are permissible before guarded no-force integration into `develop`. Keep `main` unchanged.
