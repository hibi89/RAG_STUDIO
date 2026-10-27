# P4.3 — Public consumer contract lock and producer boundary

2026-10-27 KST. This document covers **only public synthetic fixtures** in RAG_STUDIO. It is not a claim of private SMAX Native CLI completion.

## Findings and boundaries

- The public 6-row sales CSV and pre-existing SMAX-shaped V1 JSON remain exact matches for fields, byte hash, counts, normalized value strings, source_record 2..7 and row review statuses. All clean rows are still READY_FOR_HUMAN_REVIEW; package approval remains NOT_GRANTED.
- An isolated V8 check of the genuine private producer/parser source previously showed that, on this synthetic CSV, the existing RAG public synthetic fixture matched the generated output exactly. The source evaluation used a deterministic UTF-8/hash adapter with independently checked source SHA-256; **it was not a native Node process or an end-to-end Private SMAX CLI execution**.
- Copying the newly generated sample from that private-source evaluation into the public repository was blocked by the tool security gate. **The operation was stopped.** No private-derived output file was transferred, and the block was not bypassed. The pre-existing public fixture remains the contract input.
- Therefore tests/p43-public-contract-lock.test.mjs independently verifies only PUBLIC test data and the PUBLIC RAG consumer boundary. It intentionally does not import any private producer code, private repository file or private-generated artifact.

## Acceptance and controls

- Source hash, record count, rows, five field names/values and quality counters are checked from the public canonical fixture. Source data mutations, forged approval or review flags, and duplicate record attacks are rejected. P4.0 shape checks never elevate a package to ACCEPTED; P4.2 independently rejects forged values/cells before any synthetic-only AX export.
- Run npm test, npm run inspect:smax, npm run demo:smax:export, npm run doctor, npm run demo:router and existing Chrome synthetic smoke on a standard public GitHub Actions runner. Exact test numbers are reported only after completion.
- No customer data, private strategy/code transfer, paid service or production deployment. Main stays release-blocked.
- A **Native private-side producer/consumer E2E** requires a separate authorized execution method that preserves private source isolation and respects private Actions billing/security settings. Until then mark this milestone PARTIAL; do not claim Native cross-repo CI or validated real-world semantic mapping.

## Next

Native producer/consumer acceptance via an approved private execution boundary; then true local reviewer authorization, durable audit record and separately reviewed arbitrary-file intake. Existing P4.2 synthetic-export SHA allowlist must remain enabled.
