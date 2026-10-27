# P5.37 — Windows local review-plan launcher without CMD path expansion (2026-10-28 KST)

## Engineering decision (operational MVP first)
- **Option A: three path arguments in a Windows CMD wrapper.** Smallest code, but exposes user-controlled strings to CMD expansion and relies on correct quoting around special characters. Existing P5.35 supports this but P5.37 should not widen the shell-input surface.
- **Option B: zero path arguments in CMD; one bounded Node.js interactive reader** (**implemented**). Slightly more code, but reduces shell parsing of untrusted paths and improves local self-service when a user can paste absolute filenames. No browser UX or production installer claimed.

## Actual behavior
Windows Node 22.23.0+:
1. In a GitHub checkout or verified portable synthetic bundle, run `RUN_LOCAL_SMAX_APPROVAL_PLAN.cmd`.
2. Paste the three local **absolute** file paths requested, one per line: SMAX V1 JSON, corresponding original CSV, and TXT or MD policy. Surrounding Windows drag-and-drop quotes are stripped in Node, never CMD.
3. The P5.35 verifier reads/validates and rechecks all three untrusted files. P5.36 returns a deterministic ten-item rights/semantics list, fixed REVIEW_HOLD and NOT_AUTHORIZED_FOR_AX_PROMOTION, source digests/counts and no customer text, raw cells, path, provisional sales amounts or claim of actual consent. Failures exit nonzero with generic error.
4. No AX conversion, SQLite import, document indexing, approvals, background service, customer input persistence, server/API usage, external upload or customer source mutation.

Developer-only alternate command (Linux/Windows, Node 22.16+ Linux; Windows 22.23 checked):
```
npm run plan:smax:wizard
```

## Bundling and regression checks
- Add `RUN_LOCAL_SMAX_APPROVAL_PLAN.cmd` to the P5.33 portable source allowlist AND required-hash manifest. All source modules are bundled by the existing `src/*.mjs` policy and separately SHA256-verified after bundle creation.
- `tests/p537-wizard.test.mjs` tests path normalization, quotes, malformed paths, EOF, actual CLI stdin, tamper/no-leak and read-only semantics.
- `scripts/p537-interactive-smoke.mjs` checks copied public synthetic source files against both native CMD and Node wizard, source hash mismatch, no source modifications, no user input paths, and the portable integrity gate.
- `.github/workflows/p537-verify.yml` runs `npm test`, direct/portable smoke and preexisting P5.35/P5.34 regression on Linux Node22.16 + Windows Node22.23, ZIP archive/extraction integrity, ephemeral 7-day artifact.

## Boundaries
- User ownership, financial field meaning, tax/VAT treatment, rights, authenticated approvals and real customer input remain unverified and cannot be inferred from local read-only processing.
- Only public synthetic files are used by automated tests. Windows CI VM != three physical Windows PCs. Bundle not digitally signed; Node runtime is not shipped.
- No Product/Vercel deployment. `develop` integration requires completed green CI. `main` must remain stable.

## Next implementation direction
After P5.37 CI passes, review the original roadmap's still-unmet **functionality** rather than add another declarative approval checklist: improve local document indexing/query behavior or integrate an owner-approved SMAX Native interface. Any authorization/promotion beyond REVIEW_HOLD requires user policy approval and separate auditable acceptance logic.
