# P5.29 — Authenticated Browser CSV Review (NO IMPORT)

2026-10-27 KST. Branch `feature/p529-csv-browser-review`.

## Alternatives
- JSON/base64: reuses existing bearer/Origin/Host gate; ~33% network overhead for <=1MiB files, no new parser dependency. **Chosen**.
- Multipart streaming: lower transfer overhead but additional boundary parser and security surface. Deferred.

## Scope
Browser explicitly selects one UTF-8 CSV (<=1MiB). UI uses only local 127.0.0.1 /api/csv-review, session bearer and Content-Type application/json. Server gates Host and Authorization before any body read and Origin before source parsing. Decoded payload is bounded and strict base64; no filesystem path accepted. P5.28 inspectCsvBytes returns only header, candidate types, counts, bounded issue codes/line numbers, hash and explicit NEEDS_REVIEW. Raw record cells not returned. No DB writes, source modifications, imports, approvals, model calls or external network.

Source headers are intentionally visible to the local operator through textContent-only rendering. Everything still requires independent SMAX approval, consent and mapping before use.

## Tests
`npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, doctor, gold, negative, heldout. CI status and exact SHA must be checked; syntax/string review is not runtime evidence. No claimed real Chrome/Edge or Windows 3-machine coverage.

## Open gates
Trusted customer input/SMAX native approval-to-AX conversion, Windows self installer and 3 hardware checks, trained semantic dense model/license, end-user terms/consent. Product not released.
