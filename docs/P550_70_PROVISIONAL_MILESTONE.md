# P5.50 — RAG Studio 70% provisional engineering milestone, NOT a release

Date: 2026-11-11 KST. Repository hibi89/RAG_STUDIO, branch feature/p550-mapped-cited-journey. All test sources are public, synthetic and pinned. Main/develop and Private SMAX/SOVIA must remain untouched.

## Work and acceptance
- P5.47 prior: local review-only CSV + user-authored source-hash-bound mapping draft (10 scoped PASS; cross-platform P5.47 CI SUCCESS at ad2953f5).
- P5.48: customer-editable offline HTML column mapping proposal and browser JSON download, without HTTP, original row text, implicit approval or source overwrite. Linux local isolated 9/9 PASS and Chromium DOM+user-click download 1 end-to-end SUCCESS; file:// navigation blocked by runner policy (not a verified Windows double-click). Linux/Windows CI SUCCESS at ad76e04f274eae7eb7b665ed53646613c72b13f5.
- P5.49: binds the original verified CSV digest, mapping, source headers and public SMAX_PREPROCESS_GENERIC_CSV_V1 producer shape to an existing canonical sales provenance/arithmetic validator. Five-field canonical synthetic sales yields 6 orders, 10 units, 157000 KRW; unsupported fields are HOLD with ROW_VALUES_UNVERIFIED, never untruthful sales totals. Linux/Windows CI SUCCESS at source SHA 3e3be13e057179c0fdc7ada1b8a55f1e6b6df98f. Repaired incorrect SHA field access after first actual CI failure; also corrected inherited P5.45 invalid inline setup-node YAML in feature only.
- P5.50 new code src/prep-synthetic-journey.mjs and scripts/p550-prep-journey-cli.mjs composes the already verified public P5.34 synthetic SMAX→AX→SQL+TXT pipeline with the P5.49 bound mapping, asserting identical source digest, source rows, unit/revenue totals and at least one document citation; temp workspace is removed. Hard-pinned public fixture is mandatory (real data does not pass the exporter). An explicit CLI argument is refused.

## Exact GitHub Actions proof
Workflow .github/workflows/p550-verify.yml, code+test SHA a3f10f95db086f363fed3acff48425ca09b77d4f, run #42943551661 completed SUCCESS.
- Ubuntu24.04 Node22.16: P5.47-P5.50 selected 34/34 PASS, full npm test 571 PASS/0 FAIL/2 Windows-only SKIP (573 total). Gold/negative/heldout/router and explicit P5.50 CLI PASS.
- Windows2025 Node22.23: selected 34/34 PASS, full npm test 573 PASS/0 FAIL/0 SKIP. Gold/negative/heldout/router and explicit P5.50 CLI PASS.
- CLI observable result: SYNTHETIC_MAPPED_RAG_CITED_QUERY_PASS; source rows 6, orders 6, units 10, revenue_krw 157000, document_citations 1, mapping_verified true, source_digest_verified true, row_lineage_verified true; synthetic_only true, approval NOT_GRANTED, real_customer_indexed false.
- Exact GitHub new source/test blobs match locally generated development files: prep-synthetic-journey 598961b0ebb8c50d3fd74b9140fd80996449ef4f, journey CLI c8a6b81546d2d17d4dd69c5349eebe415965476d, tests 822cb56147e9e58487d340f27d113790fa293619. Remote GitHub workflow verified actual canonical dependencies, rather than any local mocked implementation.
- No claim of actual physical PC screen/Windows file:// opening or real customer/production test.

## Completion percentage accounting
Management baseline on 2026-11-11: RAG Studio final-product engineering estimate 55% provisional. Newly verified additive functional units are allocated explicitly (non-overlapping): P5.48 local end-user mapping UX +5 percentage points; P5.49 canonical producer-to-original binding with genuine sales arithmetic review +5; P5.50 one-command source-bound mapped synthetic SQL/document cited acceptance +5. **70% provisional engineering completion (55+15)** now reached under a feature-scope weighting estimate, not a measurement of sales readiness. The P5.47 prior improvement was already inside 55 and adds no extra percentage. The three milestones share existing modules but credit distinct user-facing capture, trust-boundary verification and vertical query integration.

## Still blocked — NOT commercial 100%
- Actual Private SMAX Native producer output, authenticated source rights/owner consent and trust signature, genuine arbitrary customer CSV to approved AX conversion, dynamic schema mappings outside fixed canonical sales, non-synthetic cited SQL+document E2E, broad 5 RAG use cases/semantic answer quality, local LLM model provisioning, physical Windows 3-PC install/upgrade/SmartScreen, signed installer/EXE, business licenses/returns/support policy and real sales.
- Portability and browser work remains: Chromium successful document injection was not native file:// opening; direct file:// blocked by policy. Hosted CI runners are not customer Windows PCs.
- Commercial release remains RELEASE HOLD; no Vercel/Production URL, no new credentials, no paid cloud/API, no real customer data transfer.
- RAG P5.45-to-develop divergence previously observed (10 ahead/1 behind), do not force push, merge or promote main without reconciliation.

## Next priority
1. Recheck current feature SHA and CI after documentation-only changes, then branch integration comparison without forced merge.
2. Real customer-ready CSV mapping/original PDF-DOCX intake, semantic type reconciliation, trusted local SMAX output, rights gate; add true non-synthetic E2E only with owner-approved local sample.
3. Windows browser GUI and real install ZIP/EXE repeatability, security/license, gold-set acceptance before release.

Rollback: isolated feature/p550-mapped-cited-journey based on P5.49 docs SHA e721245c495c21fdcc8986314c3f2d42e0e82982. No original source or production edits. 
