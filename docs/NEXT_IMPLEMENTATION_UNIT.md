# Next Implementation Unit — P0 Standard Data Package Contract

> 2026-10-26 · **Ready to start next chat**, not yet implemented. New-chat trigger: `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]`.

## 목적

원본 RAG ZIP이나 Private SMAX 소스가 아직 `RAG_STUDIO`에 없더라도 구현 가능한 첫 실제 작업: **SMAX 표준화 출력의 공개·안전한 최소 교환 계약**을 정의하고, 합성 데이터 fixture·검증 테스트를 실행한다. RAG + DB + 대시보드의 첫 수직 슬라이스 입력을 확보하는 것이 목표. 사용자 재설명/재승인 불필요.

## 기존 상태/경계

- 공개 `hibi89/RAG_STUDIO`: 현재 문서뿐, 프로덕션 0, 코드·CI 없음 (새 채팅에서 GitHub 재검증).
- 비공개 `hibi89/SMAX`: 기존 `backend/site/csv-transform.mjs`는 고객 열을 직접 고르는 CSV 표준화 프로토타입이며 *해당 Private 파일을 복제/공개하지 않는다*. 실제 최신 소스·기능은 GitHub 확인.
- 공개 `hibi89/SOVIA_sovereign`: 감사 도메인/이벤트 포맷은 별도 프로젝트; 현재 P0에 SOVIA 설치 요구하지 않는다.
- 로컬 `rag-studio(1).zip` 과거 대화에서 언급됨. 접근/파일 해시·비밀정보 확인이 안 되면 원본이 준비됐다고 가정하지 말고 P0 공개 계약·테스트부터 수행.
- `main` = 기준 문서/안정화, `develop` = 개발 통합, `feature/p0-data-contract` = 다음 작업 브랜치. 새 채팅에서 실제 브랜치 존재 확인.

## P0 범위 (합성 fixture 한정, 공개 정보만)

### 예정 파일
- `contracts/ax_data_package_v0.schema.json` — JSON Schema Draft 2020-12 또는 명시적으로 검증 가능한 계약. 라이브러리를 선택하기 전에 환경 확인.
- `fixtures/ax_sample_v0/manifest.json` — project_id/version/생성시각/파일 manifest, datasets, documents, review 상태·provenance.
- `fixtures/ax_sample_v0/sales.csv` — 합성 유통 매출 6~12행, 상품ID/상품명/날짜/금액. 계산 결과를 손으로도 재검증할 수 있게 설계.
- `fixtures/ax_sample_v0/returns_policy.txt` — 합성 상품 환불 규정/출처 ID. 개인·기업 실데이터를 절대 넣지 않음.
- `tests/test_contract.*` — 정상 샘플 승인, 누락 필드/버전 오류 거부, 미승인 경로/파일명 거부, 원본 행 참조 무결성 및 읽기 전용 보장 검증.
- `docs/DATA_CONTRACT.md` — 고객 원본을 삭제·변경하지 않는 처리 계약, `NEEDS_REVIEW`와 `UNKNOWN` 처리, 확장 방향.

### 권장 계약 필드
- `schema_version`: `AX_DATA_PACKAGE_V0` (문자열).
- `project_id`: 합성 고정 ID; 고객 실사용에는 예측 불가능한 로컬 생성 값.
- `created_at_utc`: 명시 ISO 8601 날짜·시간.
- `files`: `file_id`, `relative_path`, `kind`(`dataset|document`), `sha256`, `size_bytes`, `import_status`(`ACCEPTED|NEEDS_REVIEW|REJECTED`).
- `datasets`: `dataset_id`, `file_id`, `columns`(name,type,source_column,review_status), `row_count`, `provenance_mode`.
- `documents`: `document_id`, `file_id`, `language`, `source_title`, `page_info`, `index_status`.
- `review_items`: `item_id`, `source_file_id`, `reason_code`, `status`.
- `processing_summary`: counts, failed file IDs, unverified/unsupported list.

형식은 **이 작업에서 구체화되는 v0 초안**이다. 개인정보 원문/민감 필드는 계약에 넣지 않고, 경로는 manifest 하위의 **상대경로**로 제한한다. 압축파일을 파싱하는 기술은 P1 이후, 여기서는 fixture 계약과 읽기·검증만.

### P0 종료 기준 (Done)
1. 실제 파일 1개 이상의 합성 데이터셋+문서 1개 이상을 읽는 **코드와 검증 테스트 존재**.
2. 정형 데이터의 합산/행 수가 미리 작성한 기대값과 일치하고 문서 source pointer가 끊기지 않는다.
3. 경로의 `../` / 절대경로 / 버전 불일치 / 필수 필드 누락이 오류로 처리되며 불확실 입력은 임의 보정하지 않는다.
4. 실제 로컬에서 수행한 테스트 명령과 **정확한 pass/fail 개수**를 남긴다. 커넥터 파일 문자열 점검은 **실 런타임 테스트와 명확히 구분**.
5. `STATUS.md`와 `HANDOFF.md` 갱신 후 원격 commit SHA 확인. Public SMAX Private 소스 복제 0, 고객 정보/토큰 0.

## 그 다음 P1~P5 (범위 확대는 게이트 통과 후)
- **P1 (첫 E2E)**: CSV 안전 로드/표준화 승인 → 읽기 전용 DB 집계, 텍스트/PDF 최소 문서 검색, 정확한 혼합 질의 1건.
- **P2 (차별화)**: 하이브리드 검색, 복수문서·대화형 질의, 출처/원본 행·정형 계산 링크, 동시 비교 평가.
- **P3 (UI)**: ZIP/폴더 인제스트 단계, 데이터 품질 체크/검토, 문서함, KPI/차트/대시보드.
- **P4 (판매 가능한 설치)**: Windows 로컬 원클릭 설치/업데이트·재실행·진단/복구, 유료 API·클라우드 없음, 사용자 자체 해결 UX.
- **P5 (출시검증)**: 동일 테스트셋 100문항, 3대 PC, 오류/악성 ZIP·성능/저사양, OSS/배포 라이선스, 구매/환불/지원 경계. 선택형 SOVIA는 제품 완성 뒤 별도.

## 절대 하지 말 것
- 기획만 쓰고 “다음에 실행”이라며 작업 결과 없이 종료하지 않는다(도구가 허용하는 한 코드+테스트 단위 완료).
- SMAX의 2026-11-07 집중 개발/릴리스 게이트 무단 변경, Public 저장소에 Private 코드·마스터플랜 상세 복제, GitHub Actions 유료 소진, 실 고객 원본/외부 연결/구매 수행.
- 제품 미완성 단계에 가격/성능/보안/매출이 검증됐다고 과장하거나 SOVIA를 필수 빌드 의존성으로 만들지 않는다.

### 가격/타깃 정확한 정본
Private `hibi89/SMAX/docs/RAG_STUDIO_AX_EDITION_MASTERPLAN_20261026.md` 참고. 제품 전략은 채택됐지만 판매 조건·기술 실현·품질은 출시 전 검증 대상.
