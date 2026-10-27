# P5.4 — Public SMAX V1 consumer Unicode header safety (2026-10-27 KST)

## Goal and design choice
Close a narrow PUBLIC RAG consumer parser ambiguity while awaiting independently authorized private-side Native producer verification. Only `hibi89/RAG_STUDIO` public consumer and synthetic tests are modified. Private producer code, artifacts, mappings and any customer records are **not** copied or executed in this project.

| Design | Benefits | Risk / cost | Decision |
| --- | --- | --- | --- |
| Import Private producer parser into Public RAG | Might reuse native implementation | Discloses private IP; violates repository isolation and existing safety block | Rejected |
| Add RAG-owned, fail-closed canonical header validation using JS Unicode standards | Prevents unsafe metadata on read-only inspection; no external dependency/cost | Does **not** establish real producer provenance or complete semantic mapping | **Selected** |

## Changes
- `src/smax-intake.mjs`: in public `inspectSmaxV1` structural gate, reject zero-length, whitespace-padded, control-character or Unicode `Default_Ignorable_Code_Point` headers, and reject source header collisions after `NFKC` normalization and locale-insensitive casing (`ko-KR`). The source header's original text remains unchanged; this is rejection, not silent normalization.
- `tests/p54-smax-header-boundary.test.mjs`: six tests for existing accepted synthetic NOT_GRANTED fixture, invisible/control codepoints, canonical/case collisions, padded/whitespace fields, forged approval, disk-inspection immutable files and redacted report. File URL paths use `fileURLToPath` for portability.
- No change to AX approval logic, synthetic P4.2 exporter digest allowlist, arbitrary file import permissions, other runtime modules, browser UI, existing fixtures, or Private SMAX.

## Source/provenance and current verification
- Read-only **private** upstream inspection showed generic CSV V1 producer declares `NOT_GRANTED`, deterministic local mode, 1–64 explicit fields and a stricter header rule. Its publicly interoperable schema names/types were checked without copying private code to the public repository or any external compute VM.
- Historical private-side native preprocessing suite `59/59` applied only to an **older exact source SHA**. Additional upstream XLSX parser/validator/test modifications followed. The latest private branch *full Native* preprocessing QA remains **NOT VERIFIED**. Older results cannot be reattributed to current code. This public task never claims cross-repo private producer-to-consumer Native E2E.
- **Actual public QA** on exact public feature source SHA `6291c7edf3f38f181f62e09a2baa83124a301114`, isolated ephemeral Linux arm64 / Node v22.23.4 VM downloading **only PUBLIC RAG_STUDIO archive**:
  - `node --test tests/*.test.mjs`: **205 PASS / 0 FAIL / 0 SKIP / 0 CANCELLED**, 17 test files; 199 previous + 6 new.
  - P5.4 new tests **6 PASS / 0 FAIL**.
  - `node src/smax-intake-cli.mjs fixtures/smax_v1_boundary/unapproved.json --source fixtures/smax_v1_boundary/source.csv`: `REVIEW_REQUIRED`, exit 0, never approved.
  - Existing `node scripts/p5-gold-eval.mjs`: **100 PASS / 0 FAIL**.
  - `node scripts/p52-negative-evidence.mjs`: **20 PASS / 0 FAIL**.
  - `node scripts/p53-heldout.mjs`: **24 PASS / 0 FAIL**.
  - No Private code entered the VM. Public source temp directory deleted. This was **not GitHub Actions or current browser/Windows/Production validation**.

## Unresolved release gates and next step
- Native **private** `preprocessing` latest exact-source tests inside a trusted authorized private execution environment, including current CSV+XLSX suite and synthetic CLI, must be completed separately without source movement into public, unapproved CI billing, or copying artifacts out.
- The RAG public intake shape+digest report only signals `REVIEW_REQUIRED` and cannot approve, derive tax semantics or grant trusted reviewer identity. `SOURCE_DIGEST_VERIFIED` verifies supplied source bytes match advertised hash, **not producer authenticity or normalized business semantics**.
- After upstream private-side native success, the next integration decision must establish explicitly approved handoff, provenance, semantic review, and possible signed evidence. No data transfers, paid API, customer import, Windows distribution or product release were authorized here.
- Normal change process: compare tested SHA to latest feature HEAD (only docs changes allowed) then guarded non-force fast-forward to `develop`, leave `main` unchanged. Last known original `develop` at this work start: `904c661479bd63c8dffe0a087a57f42da1935ec7`.
