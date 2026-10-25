> **P0 LATEST (2026-10-26 KST, supersedes earlier 'docs-only' / 'not remotely mirrored' entries below):** The tested Node source and all 16 tests have now been staged for this feature branch commit alongside synthetic CSV/TXT/manifest and Draft 2020-12 schema. Exact Git blob hashes for src/validate.mjs, src/summary.mjs, src/cli.mjs, tests/contract.test.mjs, fixtures/ax_sample_v0/*.csv|*.txt|manifest.json match the local sources where local npm test returned 16 PASS / 0 FAIL, demo 6 orders / 10 units / KRW 157000. The remote branch is a code mirror; GitHub-hosted CI and Windows execution remain UNVERIFIED. SMAX producer, original RAG ZIP, SQLite, retrieval, UI, SOVIA, actual customer and production are NOT DONE. Merge to develop and main is pending review.

# STATUS — RAG Studio AX Edition

> 검증 기준: **2026-10-26 KST**. GitHub와 실제 코드를 재조회하지 않고 이 문서만으로 현재 구현 완료를 주장하지 말 것.

## 제품 결정
- 제품: RAG Studio AX Edition (SMAX² 필수 표준화·RAG/DB·분석 대시보드, 선택형 SOVIA 사후 감사).
- 가격 전략 목표: 정가 149,000원 / 초기 프로모션 99,000원(30건 제안); SOVIA +99,000원, 번들 229,000원은 후속 가설.
- 고객 우선순위: 쇼핑몰·소규모 유통 → 소규모 제조·기술서비스 → 1인 사업자·컨설턴트/분석가.
- 기능 목표: Document / Knowledge Base / Multi-Document / Conversational / SQL+Document 5개 활용 유형.
- 전략 정본: Private [SMAX AX Edition Masterplan](https://github.com/hibi89/SMAX/blob/main/docs/RAG_STUDIO_AX_EDITION_MASTERPLAN_20261026.md). 구체적인 가격·판매범위 실증 없음.

## 현재 구현·검증 상태 (2026-10-26 문서화 시점)
| 항목 | 상태 | 근거/제한 |
|---|---|---|
| GitHub `hibi89/RAG_STUDIO` Public + main | VERIFIED | GitHub repo/commit 조회 |
| 2026-10-26 제품 통합 기획 | DONE (docs) | README, HANDOFF, 비공개 SMAX masterplan |
| 정확한 1문장 복원 규칙 | DONE (docs) | CHAT_BOOTSTRAP.md, AGENTS.md |
| 다음 작업 단위와 테스트 수락 기준 | DONE (docs) | docs/NEXT_IMPLEMENTATION_UNIT.md |
| 개발용 브랜치 | CHECK_LIVE | develop, feature/p0-data-contract 실제 브랜치 재조회 |
| 원본 RAG ZIP → GitHub 안전 이식 | NOT_STARTED | ZIP 실제 업로드/시크릿·OSS 검증 없음 |
| P0 공통 표준데이터 계약 코드/fixture/테스트 | NOT_STARTED | 다음 실제 개발 작업 |
| ZIP 인제스트 + SMAX 통합 | NOT_IMPLEMENTED | 미래 P1/P3 |
| SQL + Document 혼합 질의 | NOT_IMPLEMENTED | 미래 P1/P2 |
| 자동 KPI/대시보드 | NOT_IMPLEMENTED | 미래 P3 |
| 셀프 Windows 설치기 | NOT_IMPLEMENTED | 미래 P4 |
| SOVIA 감사 통합 | FUTURE_OPTION | SOVIA 자체 계획 독립 유지 |
| 런타임 테스트 | NOT_RUN (0 pass, 0 fail) | 문서만 작성, 설치·실행 검증 없음 |
| CI / Windows E2E / 제품 판매/결제 | NOT_STARTED | URL/판매 수 없음 |

## Next (명확한 종료 기준)
- [ ] `feature/p0-data-contract` 실제 GitHub 브랜치 상태 확인.
- [ ] `AX_DATA_PACKAGE_V0` JSON 계약 + 합성 CSV/문서 fixture 구현.
- [ ] 정상/오류/경로·필드·버전 테스트 **실제로 실행**하고 정확한 passed/failed 기록.
- [ ] 실행 증거와 commit SHA, 차단·남은 기능을 본 문서/HANDOFF에 갱신.
- [ ] 그다음 P1에 대해 CSV 정형 집계 + TXT/PDF 문서 출처를 한 질의로 결합하는 좁은 수직 기능 구현.

## 다른 프로젝트 영향 금지
Private `hibi89/SMAX`의 2026-11-07 집중 개발 일정과 브랜치/기능을 변경하지 않았다. `hibi89/SOVIA_sovereign`의 감사 엔진·판매 일정도 변경하지 않는다. 이 저장소의 기획 등록을 셋 중 어느 제품의 상용 준비 완료로 간주하지 않는다.

## 핸드오프
정확한 새 채팅 문장: **`[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]`** → `CHAT_BOOTSTRAP.md` → `AGENTS.md` → `STATUS.md` → `HANDOFF.md` → `docs/NEXT_IMPLEMENTATION_UNIT.md` → Private SMAX masterplan → 코드 확인/실행.


## 2026-10-26 P0 incremental execution update
- Synthetic AX_DATA_PACKAGE_V0 schema and sample CSV/TXT/manifest, npm script scaffold committed on feature/p0-data-contract; producer is still unverified. Repo base 1d809ea.
- Independently in local container, complete candidate validator/aggregator/CLI and 16 unit tests **passed on Node 22.16.0** (npm test, pass 16, fail 0), demo: six orders/10 units/157000 KRW plus policy source pointer.
- IMPORTANT: the local code/test source is currently an exported verified ZIP artifact, **not yet mirrored to GitHub**. Do not claim remote P0 implementation PASS until uploaded and checked. Original RAG ZIP not located; no SMAX source copied. No production/Windows/LLM/DB.
- Next: commit local candidate src/ and tests/ exact files, independently run regression, review feature branch and update handoff. Do not merge while feature incomplete.
