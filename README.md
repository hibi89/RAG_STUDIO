> **새 채팅 바로 재개:** `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]` → [CHAT_BOOTSTRAP.md](CHAT_BOOTSTRAP.md) → [AGENTS.md](AGENTS.md) → [STATUS.md](STATUS.md) → [다음 구현 단위](docs/NEXT_IMPLEMENTATION_UNIT.md). 입력 시 GitHub 최신 조회 후 안전한 실제 코딩/테스트 단위로 진행.

# RAG Studio — Local AI Data & Knowledge Workspace

> 상태(2026-10-27): **합성 ZIP→SQLite·TXT/Markdown 검색→로컬 대시보드 실행 및 표준 폴더 직접 열기 기능 개발 완료**. 정식 고객용 자동 전처리·SMAX Native 실연동·PDF/DOCX·설치기·배포는 미완성. `main`은 미출시 기준 브랜치.

## 2026-10-27 — 실행 가능한 합성 ZIP MVP 경로 (P5.10)

현재 `develop` 기반 개발본은 정형 SQLite·TXT 인용·로컬 대시보드를 이미 포함한다. 최신 P5.10 기능은 **고정된 공개 합성 자료 ZIP을 생성 → 무결성 검증 → 임시 패키지 → 실제 SQLite/문서 근거 → 브라우저**로 연결한다. 비공개 SMAX Native 출력이나 고객 ZIP을 처리하는 제품 완성은 아니다.

```bash
# Node.js >=22.16.0, 의존성 설치 없이 실행
npm run demo:zip
# 터미널에 출력된 일회성 로컬 URL을 브라우저에서 열고 Ctrl+C로 종료
npm test
```

판매/실고객용 파일 입력/자동 설치/LLM/벡터/PDF/DOCX는 아직 구현·검증 중이다. 기술 격차와 우선 개발순서는 [MVP-first 구현 지도](docs/MVP_FIRST_IMPLEMENTATION_MAP_20261027.md), 실제 실행검증은 [STATUS.md](STATUS.md) 참조. 이전 P0/P1 상태 설명은 역사 기록으로 유지한다.

## P5.11 — 로컬 패키지 열기 및 Markdown 출처 검색

이미 표준화된 `AX_DATA_PACKAGE_V0` 폴더를 로컬에서 선택해 실행할 수 있습니다. 일반 CSV/ZIP을 임의로 자동 변환하지 않습니다. 검증된 UTF-8 `.md`와 기존 `.txt` 문서를 원본 행 번호·문장 인용으로 검색합니다.

```bash
npm run open:package -- "/path/to/local/AX_DATA_PACKAGE_V0"
# 셀프 테스트용 기존 합성 데모
npm run demo:zip
```

폴더는 다른 서버로 업로드하지 않습니다. 단, `manifest.json`의 `ACCEPTED` 표시는 실제 사용자 인증·권리/개인정보 승인 또는 SMAX Native 검증의 증거가 아닙니다. **현재 명령은 개발용 로컬 미리보기**입니다. [P5.11 사용법·제약](docs/P511_MARKDOWN_LOCAL_MVP.md), [실제 테스트](STATUS.md).

## P5.12 — PDF·DOCX 실제 로컬 텍스트 검색 (개발자 미리보기)

Node.js >=22.16.0. 고정된 오픈소스 추출 의존성(설치 시 네트워크 필요)을 설치한 뒤 **선택한 PDF/DOCX 원본을 수정하지 않고** 임시 표준 패키지에 텍스트를 추가해 기존 검색·SQLite 대시보드에서 인용합니다.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run preview:document -- "./fixtures/ax_multi_doc_v0" "/absolute/local/path/manual.pdf"
npm run preview:document -- "./fixtures/ax_multi_doc_v0" "/absolute/local/path/manual.docx"
```

PDF에는 페이지 번호(`[PDF page 1]`), DOCX에는 문단 번호(`[DOCX paragraph 1]`)를 **추출 텍스트에 명시**합니다. 이는 파생 TXT의 원본 행 인용과 별개이며, DOCX 페이지·PDF 화면 좌표를 임의로 생성하지 않습니다. PDF 스캔·OCR/복잡한 표·암호화 파일·2MiB 초과 원본은 미지원 또는 개별 검증 필요합니다. 원본파일/문서는 외부 업로드하지 않지만, 이 기능은 사용자/원본 사용권을 독립적으로 검증하지 않는 **로컬 프리뷰**로서 상용 데이터 반입 승인/SMAX Native 연동을 뜻하지 않습니다.

[한도·정확성·복구 설명](docs/P512_NATIVE_DOCUMENT_PREVIEW.md) · [실행 증거](STATUS.md).

## P5.13 — SMAX 범용 CSV 결과의 실제 계산 미리보기

SMAX `preprocessing`이 출력하는 `SMAX_PREPROCESS_GENERIC_CSV_V1` JSON과 **그때 사용한 원본 CSV**를 두 파일로 지정하면 RAG Studio가 원본 행·해시·정규화 값과 매출 수식을 다시 검증해 합성/로컬 미리보기 KPI를 계산합니다. 원본은 수정하지 않습니다.

```bash
npm run preview:smax -- "./local/smax-v1.json" "./local/original.csv"
```

현재는 `order_id`, `sku`, `quantity`, `unit_price_krw`, `amount_krw`를 갖춘 **엄격한 매출 스키마 전용**입니다. `NOT_GRANTED`/검토 필요 데이터를 승인된 AX 데이터로 자동 변환하지 않으며, 오류나 검토 행이 있으면 합계 표시를 차단합니다. 실제 SMAX Native 런타임의 양쪽 저장소 교차 실행은 별도 검증입니다. [연동 범위·한계](docs/P513_SMAX_SALES_PREVIEW.md).

## P5.14 — 브라우저에서 SMAX JSON·CSV 두 파일 선택

이미 실행 중인 **로컬 대시보드** 화면에 `SMAX 매출 미리보기` 작업 공간이 추가되었습니다.

```bash
npm ci --no-audit --no-fund --ignore-scripts
npm run demo:zip
# 출력된 비공개 로컬 주소 열기 → SMAX 매출 미리보기
# 합성 예제: fixtures/smax_p42/synthetic_v1.json + fixtures/ax_multi_doc_v0/sales.csv
```

해당 화면은 두 파일을 내 PC의 **127.0.0.1 서버에만 전달**하여 원본 SHA·행 값·수식과 대조합니다. 미승인 결과는 기존 KPI·SQLite에 합치지 않고 임시로 별도 표시합니다. 검토 필요 행이 있으면 합계가 표시되지 않습니다. 로컬 파일도 브라우저에서 Node 로컬 프로세스로 전달되므로 독립적인 고객 데이터 승인/권리 확인 기능은 아닙니다.

[실제 파일 선택·보안 한계](docs/P514_SMAX_LOCAL_BROWSER_PREVIEW.md) · [검증 실행 현황](STATUS.md).

## P5.15 — 검증된 로컬 프로젝트 여러 개를 브라우저에서 선택

```bash
npm ci --no-audit --no-fund --ignore-scripts
npm run workspace -- "/local/AX-project-1" "/local/AX-project-2"
```

실행할 때 명시한 최대 8개 `AX_DATA_PACKAGE_V0` 폴더의 해시·스키마·SQLite 집계를 검증하고, 화면의 **로컬 프로젝트 선택**에서 전환합니다. 그때마다 매출·SKU·문서 검색의 출처도 같이 변경되며 이전 질문 내용은 지웁니다. 파일 경로를 브라우저에 전송하거나 외부 네트워크에 업로드하지 않습니다. 단일 프로젝트 데모·SMAX 별도 미승인 계산·PDF/DOCX 로컬 미리보기도 이전과 같이 유지됩니다.

`ACCEPTED`는 패키지 내부 표기이지 실제 SMAX Native 서명·사용권·고객 동의의 증거는 아닙니다. 정식 고객용 인입 및 설치 프로그램은 미완성입니다. [기능·제약·검증](docs/P515_LOCAL_WORKSPACE_SWITCHER.md).

## P5.16 — 로컬 원문 행 탐색 (TXT/Markdown)

검증된 데이터 패키지로 `npm run demo:zip` 또는 `npm run workspace -- <AX-folder>` 실행 후, 화면 **문서와 출처**의 **검증된 원문 보기**를 누르면 등록된 TXT/Markdown 문서를 원본 행 번호로 40행씩 조회할 수 있습니다. 문서 내용은 서버에서 다시 SHA-256 검증되며 브라우저에는 경로 없이 텍스트로만 표시됩니다. 인증되지 않은 접근·등록되지 않은 문서 ID·무결성 오류는 차단됩니다.

[실행 범위와 검증](docs/P516_LOCAL_DOCUMENT_EXPLORER.md). 기존 원본 PDF/DOCX 레이아웃 표시, Native SMAX 승인/권리 검증, Windows 설치 및 고객 출시까지 완료된 기능은 아닙니다.

## P5.17 — 출처 재검증형 후속 질문 (대화형 RAG 제한 MVP)

`npm run demo:zip`으로 로컬 대시보드를 시작한 뒤 **반품 기간은?** 질문에 검증된 근거가 표시되면 **그건 며칠이야?**를 입력하고 **근거 확인 후속 질문**을 누릅니다. 이전 질문의 출처와 현재 프로젝트를 다시 확인한 후 7일 이내라는 근거를 재표시합니다. 배송 준비 기간도 지원합니다.

지원하는 짧은 기간 후속 질문만 안전하게 재작성하며, 매출 질문이나 다중 주제처럼 대상이 모호하면 **답변을 보류**합니다. 이 기능은 로컬·무저장·규칙 기반 구현으로 자유 대화용 LLM, 벡터 검색, 일반적인 다중 문맥 추론을 의미하지 않습니다. 프로젝트 전환 시 맥락을 초기화합니다.

[범위/테스트](docs/P517_GROUNDED_CONVERSATIONAL_MVP.md) · [CI 검증](https://github.com/hibi89/RAG_STUDIO/actions/runs/40490943430). 승인된 Private SMAX Native 데이터 반입 및 Windows 설치·상용 출시는 별도 검증 필요.

## P5.18 — 선택 문서 지식베이스 및 다중 출처 대조

로컬 대시보드의 **문서와 출처**에서 검증된 문서 1~8개를 선택하면 해당 문서만 근거로 검색할 수 있습니다. 2개 이상을 선택하면 반품 신청 및 배송 준비 기간의 명시적인 문장과 원본 행을 나란히 확인할 수 있습니다. 같은 정책이 7일/14일 등 충돌하면 확정 답변을 보류합니다.

`npm run demo:zip` (합성 예제), `npm run workspace -- <verified-AX-folder>` (이미 검증된 패키지). [P5.18 사용법과 검증](docs/P518_KNOWLEDGE_COLLECTION.md). 자동 승인된 실제 비즈니스 정책 분석이나 임의 문서 비교/LLM 생성 답변은 아닙니다.

## P5.19 — 로컬 검색 방식 실험 (BM25 기본 유지)

Knowledge Base의 검색 방식에서 **BM25 (기본)** 또는 **BM25 + 문자 n-gram RRF (실험)** 을 선택할 수 있습니다. 두 방식 모두 SHA-256으로 검증한 선택 문서만 검색합니다. 두 번째 방식은 로컬 **어휘형 결합 검색**으로, 최초 설계의 임베딩/FAISS 기반 의미형 하이브리드를 구현한 것이 아닙니다.

[실제 측정과 한계](docs/P519_OFFLINE_LEXICAL_RETRIEVAL_EVALUATION.md) · [CI 368 PASS / Chromium 15 PASS](https://github.com/hibi89/RAG_STUDIO/actions/runs/40495256771). 합성 8문항에서 두 방식 Recall@3이 동일하고 실험 방식 중앙 처리시간이 더 느리므로 기본값은 BM25로 유지합니다.

## P5.20 — 문서 규모·검색 품질·자원 사용 독립 검증

`node scripts/p520-scale-gate.mjs`: 비공개 데이터 없는 합성 V0 패키지 **24/64/96개 문서**를 임시로 만들고, 규모마다 **120개 정답 레이블 질문 + 12개 부정 질문**으로 기존 BM25와 선택형 문자 n-gram RRF 검색을 평가합니다. 각 검색 방식은 별도 Node 프로세스에서 CPU·Linux 최대 RSS·처리시간을 측정합니다.

[계측표, 코드 및 검증 한계](docs/P520_RETRIEVAL_SCALING_GATE.md). 최대 96개 문서에서 Recall@3 **BM25 85/120 대 lexical 120/120**이었으나 생성된 식별자 띄어쓰기·오타 사례에 편향된 결과이며, lexical 중앙 처리시간은 **8.302ms 대 16.968ms**로 더 길었습니다. **BM25 기본값 유지**, Dense/FAISS 미구현·상용 QA 미완입니다.

## P5.21 — 한국어·영어 의미 검색 격차 측정

`node scripts/p521-bilingual-benchmark.mjs`는 별도 합성 **한국어·영어 문서 20개**를 만들고, 같은 언어 검색 60문항·언어 간 검색 60문항·무관 질문 12문항에서 두 어휘 검색기의 **정답 출처 ID**를 비교합니다. [검증 방법·결과·모델 도입 조건](docs/P521_BILINGUAL_SEMANTIC_EVALUATION.md).

[CI 379 PASS](https://github.com/hibi89/RAG_STUDIO/actions/runs/40498808959): 두 검색기 모두 동일 언어 Recall@3 60/60, **한국어↔영어 교차 검색 0/60**. 실제 로컬 Dense·FAISS 및 다국어 임베딩은 여전히 미구현이고 라이선스/Windows/실사용 검수 전까지 기존 BM25 기본값을 유지합니다.

## P5.22 — 선택형 로컬 Dense 기반과 BM25 자동 복귀 (개발자 실험)

SHA-256으로 검증된 **로컬 모델 파일**이 별도로 제공될 때에만 임베딩 기반 후보 검색을 실행하도록 하는 실험용 CLI를 추가했습니다. 384차원 정규화 벡터 코사인 검색, BM25 결합(RRF), 선택 문서 격리 및 근거 행 인용을 구현했습니다. **모델 파일이 없으면 실제 BM25로 복귀**하며, 모델 다운로드·호스팅·유료 API 요청은 자동 수행하지 않습니다.

**주의:** [P5.22 구현과 테스트의 정확한 범위](docs/P522_OFFLINE_DENSE_ADAPTER.md). 테스트의 벡터는 합성 입력이며 실제 E5 ONNX 가중치 추론/Windows 호환/한영 의미 검색 성능은 아직 미검증입니다. FAISS 구현이나 상용 Dense 출시 완료를 의미하지 않습니다. [CI 389 PASS](https://github.com/hibi89/RAG_STUDIO/actions/runs/40501134514).

## P5.29 — 브라우저 로컬 CSV 구조 검토 (개발자 미리보기)

`npm run demo:zip`으로 로컬 대시보드를 연 후 **CSV 구조 검토** 메뉴에서 1MiB 이하 UTF-8 CSV 1개를 선택합니다. 컬럼·후보 타입·오류 위치를 표시하지만 모든 필드는 `NEEDS_REVIEW`이며 승인, SQLite 반입, 기존 KPI 변경은 하지 않습니다. [제약/테스트](docs/P529_BROWSER_CSV_REVIEW.md).

## 방향
RAG Studio는 로컬 PC에서 고객이 승인한 업무 자료를 구조화·검색·분석하고, 문서 출처와 정확한 데이터 집계를 결합해 활용 가능한 대시보드를 만드는 제품을 목표로 한다.

- **SMAX² 필수 표준화 계층**: 고객 ZIP/폴더의 지원 형식 분류, 템플릿 기반 데이터 매핑·확인·표준화. 소스는 Private `hibi89/SMAX`에 별도 유지한다.
- **RAG Studio 핵심**: BM25·FAISS 혼합 검색, 로컬 LLM, 문서 관리, 정형 데이터 읽기 전용 분석, 근거가 있는 답변, KPI/차트·대시보드.
- **SOVIA Sovereign 선택 연동**: 감사 이벤트·권한·정책 기반 위험 분석. `hibi89/SOVIA_sovereign`의 독립 개발 일정·검증을 존중한다.
- **Local-first**: 고객이 자기 PC에서 자료를 처리하고 직접 설치한다. 유료 외부 API/중앙 서버는 기본 요구사항이 아니다.

## 5가지 고객 활용 유형 (개발 목표)
1. Document RAG — PDF/DOCX/TXT/MD 출처 기반 문서 검색.
2. Knowledge Base RAG — 내규·FAQ·매뉴얼 통합 검색.
3. Multi-Document RAG — 여러 자료의 비교와 출처 구분.
4. Conversational RAG — 대화 맥락을 사용한 후속 질문.
5. SQL + Document RAG — 검증된 정형 데이터 집계와 문서 근거 결합 (**차별화 목표**).

이는 5개의 독립 모델/엔진을 의미하지 않으며 기능 대부분은 공통 검색·색인/DB 코어를 활용한다. GraphRAG·멀티모달·임의 외부 업무 실행 등은 초기 범위에서 제외한다.

## 저장소 간 책임
| Repo | 책임 |
|---|---|
| `hibi89/SMAX` (private) | AX 데이터·업무 표준화, 공통 표준 데이터 패키지 |
| `hibi89/RAG_STUDIO` (public, 여기) | 문서 인덱싱, 혼합 질의, 분석, 데이터 UI, 대시보드 |
| `hibi89/SOVIA_sovereign` | 감사 이벤트, 정책 위반 및 증거 기반 리포트(선택형) |

Public 저장소에 Private SMAX 코드·사업 민감자료·실제 고객 파일·시크릿을 복제하거나 커밋하지 않는다.

## 복원할 정본
**2026-10-26 사용자가 채택한 상세 상품 계획/가격/세 구매자 시장/개발 게이트/연동 계약은 비공개 SMAX 문서**에 있다.

- [RAG Studio AX Edition 비공개 마스터플랜 (권한 필요)](https://github.com/hibi89/SMAX/blob/main/docs/RAG_STUDIO_AX_EDITION_MASTERPLAN_20261026.md)
- [이 저장소의 이어가기 안내](HANDOFF.md)

SMAX의 기존 사장님 SELF 출시 일정 및 기술 지원 범위를 본 통합 목표 때문에 임의로 변경하지 않는다.

## 상태 구분
- **채택된 전략**: SMAX 필수 + RAG/DB/대시보드 통합, SOVIA 옵션, 저비용 로컬·셀프 설치.
- **미구현/미검증**: RAG 원본 소스 GitHub 업로드, 파일 ZIP 전체 자동처리, DB 자동 구축, SQL+문서 혼합 검색, 원클릭 설치, 품질·시장 구매 의사.
- **금지**: 프로그램이 완성됐다고 홍보하기, 검증 없는 전 파일/업종 자동 표준화 주장, 무단 원본·로그 외부 전송.

## 다음 기술 단계
원본 RAG ZIP의 안전한 확인/이식 → SMAX 표준 데이터 계약 fixture 작성 → CSV 1종+문서 1종 통합 데모 → 읽기 전용 집계·문서 인용 → 대시보드·자동 설치·검증.

세부 작업과 상태는 HANDOFF.md에 유지한다.

## 합성 P1 SQLite + 문서 혼합 질의 (개발 브랜치)
`feature/p1-mixed-query`에서 Node.js 22.16 이상으로 `npm test`, `npm run demo:mixed`를 실행한다. 정형 CSV의 정확한 SQLite 집계(157000원/6건/10개)와 검증된 TXT의 반품 규정 2행 근거를 결합한다. **Node 22 내장 SQLite는 실험적이며 Windows 설치·프로덕션은 미검증**이다. [P1 범위/검증](docs/P1_SQL_DOCUMENT_SLICE.md).
