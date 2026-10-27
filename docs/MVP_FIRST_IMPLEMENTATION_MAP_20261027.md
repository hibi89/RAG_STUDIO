# RAG Studio — MVP-first implementation map (2026-10-27 KST)

This public, non-sensitive implementation map reconciles the existing RAG Studio code with the owner's technical product direction. Actual original ZIP source and Private SMAX producer remain separately governed; no Private strategy/source copied here.

## Immediate execution rule (user change 2026-10-27)
**Finish an operational MVP flow → compare against initial architecture and fill missing features → complete security/stability/Windows/browser compatibility and release QA.** Keep minimum high-risk controls from day one: no directory traversal, arbitrary SQL, remote data exfiltration or disguised synthetic approval. Do not spend repeated iterations on purely declarative review gates while input/query/UX remain incomplete.

## Current runnable MVP milestone, scope and evidence
- The initial, public **synthetic-only** vertical demo can now run via `npm run demo:zip`: make a bounded ZIP from four pinned public fixtures -> P5.8 CRC/structure preflight -> compare every entry byte-for-byte to the pinned bundled files -> disposable temporary `AX_DATA_PACKAGE_V0` folder -> validate -> actual Node in-memory readonly SQLite and verified TXT line search -> protected localhost dashboard. The launch URL is per-run bearer capability; stop the process to remove temporary files. No internet service or runtime dependency added.
- Existing direct folder path remains `npm run dashboard -- fixtures/ax_multi_doc_v0`; neither path implies real customer support.
- The ZIP demo **cannot load user/customer ZIPs**; it intentionally works only with the checked-in known synthetic fixtures. General ZIP use will require trusted local authorization/SMAX producer ingestion, no automatic approval based on P5.9 declarations.
- CI verifies full unit suite, native subprocess launch and 401/200 HTTP responses, verified 157,000 KRW/6 orders/10 units and two TXT citations; separate preexisting real Chrome smoke. Exact count and link in STATUS/HANDOFF after run. CI != Windows 3-PC or customer acceptance.

## Initial architecture vs current actual evidence

| Architecture requirement | Current code evidence | MVP decision |
| --- | --- | --- |
| Input ZIP/folder + preservation | Folder loader and synthetic ZIP -> temp workspace | **Demo connected**; customer ZIP import still absent |
| SMAX² standardization producer | P4.0/P4.1 isolated consumer review plus fixed P4.2 public synthetic export | **Not native producer-to-consumer** |
| CSV -> approved readonly relational aggregations | `src/mixed-question.mjs`, fixed SQLite SQL | **Demo works** |
| TXT multi-document source retrieval | `src/document-search.mjs` BM25-like line scoring | **Demo works** |
| SQL + document combined answer | `src/evidence-router.mjs`, metric and TXT source citations | **Demo works** |
| Browser dashboard and provenance | `ui/`, `src/dashboard-server.mjs` | **Demo works; customer UX incomplete** |
| PDF/DOCX/MD, dense/hybrid, multi-turn conversation | No verified full implementations in current public source | **Missing** |
| Self-install/upgrade and nonexpert onboarding | Windows synthetic `.cmd` preflight and doctor | **No installer/3-PC acceptance** |
| SOVIA integration | optional separate product | Defer until core MVP |

## Fast-track next development priorities
1. **MVP functional generalization:** locally selected project flow with verified, user-controlled source package, show unsupported formats/fields clearly and preserve originals. Integrate approved Private SMAX outputs only through a public contract, with owner-approved real data access where needed. Keep data local.
2. **Document functionality and visible UX:** Markdown then small bounded PDF/DOCX text extraction with precise citations and unsupported/garbled-document reporting; enhance document management. No unverifiable page citations or automatic LLM conclusions.
3. **RAG capability:** hybrid/embedding on device with resource-aware optional model installation, bounded conversation context and safe abstention, using the fixed SQL + document workflow as core value.
4. **Completion hardening:** Windows 3-PC self-install/restart/uninstall, actual P5.7 seven-journey browser tests, dependency licenses, model size/offline limits, performance and low-memory QA, malicious ZIP/provenance/permissions and supported-file docs, before commercial release.

**Not counted as finished:** original RAG ZIP source/license evaluation, customer input, private producer native acceptance, PDF/DOCX, Windows installation and sale. No Vercel Production deployment or sales.
