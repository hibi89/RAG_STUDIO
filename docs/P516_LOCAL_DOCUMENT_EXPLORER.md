# P5.16 — Verified local document lines explorer

Date: 2026-10-27 KST. Public `hibi89/RAG_STUDIO` (synthetic developer preview).

## Working UX

Start a local dashboard with `npm run demo:zip` (or `npm run workspace -- <AX-folder>` after previously validating a package), open its per-run session URL, and in **문서와 출처** select **검증된 원문 보기** for an approved `.txt` or `.md` source. The viewer fetches exactly the original, 1-based numbered verified text lines; at most 40 lines per page. Next and previous maintain provenance. Project change clears the viewer, and outstanding older requests are ignored.

The data API `GET /api/documents?document_id=<manifest-id>&start=1` accepts a manifest document ID only, not a local path. All accepted files are SHA-revalidated on every request. A requested document must be manifest-listed, ACCEPTED, have a supported TXT/MD suffix, and have bounded lines. Returns only title, file ID, declared page metadata and line text; never absolute source paths. Uses established Host/bearer auth; no new filesystem traversal, external data transmission, HTML interpretation, network access or writes.

Malformed/duplicate/unknown query parameters, non-allowlisted document IDs, changed file data or excessive lines fail closed with 400/401/404/422. The viewer uses `textContent`; no `innerHTML` or third-party scripts.

## Evidence and limits

CI: [40489306463](https://github.com/hibi89/RAG_STUDIO/actions/runs/40489306463) at application/workflow SHA `8edd631a1460b6d6da112ae5340b5f610376aaeb`, GitHub Ubuntu24.04 Node22.16. `npm test` **329 PASS/0 FAIL/0 SKIP** including six new real loopback HTTP tests; `npm run doctor`, gold100, negative20, heldout24 and syntax all success. Actual local Chromium document-viewer click **7 checks PASS** in this run. This is not a Windows test, and does not verify commercial user rights or genuine Private SMAX source approval.

Only approved manifest TXT/MD lines are visible through the viewer. PDF/DOCX remain in a separate text-extraction preview workflow, not native-layout browsing. Manifest ACCEPTED is a self-declared label; Native producer approval, customer rights/consent, arbitrary ZIP ingestion, dense/LLM search and one-click installation are not supplied by this feature. No Vercel Production.
