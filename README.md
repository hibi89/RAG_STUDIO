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
