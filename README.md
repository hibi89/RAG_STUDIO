> **새 채팅 바로 재개:** `[RAG_STUDIO 깃헙 레포지토리 보고 작업이어가셈]` → [CHAT_BOOTSTRAP.md](CHAT_BOOTSTRAP.md) → [AGENTS.md](AGENTS.md) → [STATUS.md](STATUS.md) → [다음 구현 단위](docs/NEXT_IMPLEMENTATION_UNIT.md). 입력 시 GitHub 최신 조회 후 안전한 실제 코딩/테스트 단위로 진행.

# RAG Studio — Local AI Data & Knowledge Workspace

> 상태: **신규 저장소 초기 문서 / 소스 이식 및 제품 개발 전** (2026-10-26 KST). 이 저장소에 실행 가능한 프로그램이 있다고 가정하지 않는다.

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