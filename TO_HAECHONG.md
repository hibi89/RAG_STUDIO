# 해총님에게 — RAG_STUDIO 개발 병목 제거 독립 검수 보고서

- **작성 기준:** 2026-10-28 KST
- **저장소/실제 개발 브랜치:** \`hibi89/RAG_STUDIO\` / \`develop\`
- **비교 기준:** 개선 전 \`5aaeeb4e18b4cb530ed572c43eb3589dcced19d9\` (P5.42 종료) → P5.43 작동 검증 \`36c2658de3ba365e650f9ce8ee40659e0fea50ab\` → \`develop\` \`19df0b54db3e974373ea3880268f564ed54337a6\` (AGENTS 지침만 후속 정리).
- **한 문장 답변:** GitHub 파일별 수정과 중복 인수인계, 분산 Windows 검증/수동 npm 설치가 병목이었다. 기능 단위 변경·단일 검증·필요 문서만 갱신하는 규칙을 실제 적용했고, 그 뒤 **PDF/DOCX 파서 의존성을 함께 실은 서명 없는 로컬 포터블 실행 패키지**를 생성해 *패키지 복사본*에서 실 HTTP 검색·출처/매출·401 인증·SHA 무결성을 검증했다. **반복 작업 소요시간 감소는 계측하지 않았으므로 증명되지 않았다.**

## 1. 기존 병목 TOP 3
1. **GitHub 원격 파일별 수정, 여러 커밋·HEAD/CI 반복 조회:** 통합된 한 기능도 원격 호출·문서 커밋으로 나뉘어 실제 실행 가능한 산출물 검증까지 시간이 걸렸다.
2. **문서 및 인수인계 중복 갱신:** 과거 작은 기능마다 \`STATUS.md\`, \`HANDOFF.md\`, \`README.md\`에 검증 링크와 같은 설명을 반복 기록했다.
3. **Windows 실행/검증과 배포의 분절:** P5.42는 Windows 파일 선택창이 있어도 개발 소스에서 \`npm ci\`를 먼저 수행해야 했고, CLI·브라우저·패키지 복사본·무결성 검사가 별도 단계였다.

## 2. 원인과 측정 한계
- 원인 1: **GitHub API 중심 개발 방식**에서 작은 파일 수정을 개별 커밋/원격 재검사로 수행. 같은 SHA에 대한 재조회가 누적됐다.
- 원인 2: **문서가 테스트보다 선행되는 작업 순서**와 매 커밋마다 모든 요약문서를 갱신하도록 되어 있던 옛 \`AGENTS.md\` 제10조.
- 원인 3: **테스트/배포 환경 경계**: GitHub Actions에서 Windows Node 22.23을 실행할 수 있지만 사용자 물리 PC의 파일 선택창 클릭은 자동으로 검증되지 않음. 배포본에 고정 PDF.js/Mammoth 런타임이 포함되지 않아 수동 dependency 설치 필요.
- **도구 호출 횟수, 개발 소요시간, 절감률은 사전/사후 일관되게 계측하지 않았다.** 우선순위는 작업 기록을 통해 판단한 정성 진단이며 '가장 많은 시간'의 정량적 순위는 아님.

## 3. 실제 개선 조치 — 완료와 미완료 구분
**실제 소스에 적용:**
- \`AGENTS.md\`의 과거 '작업 후 STATUS·HANDOFF 일괄 업데이트' 규칙을 바꿔, **STATUS=검증 현황, HANDOFF=복원/다음 과제, README=사용법**, 변경에 필요한 문서만 갱신하게 했다. P5.43 기능 코드 후에는 이 3개를 기계적으로 수정하지 않고 \`AGENTS.md\` 한 곳에 검증·다음 과제 기록.
- 기능 목표 → 관련 코드·테스트 묶음 → 핵심 테스트 → 실제 결함 재현/수정 → CI 최종검증 → 최소 문서화; 브랜치 예상 SHA 검증과 비강제 fast-forward를 지침에 명시. 실제 P5.43은 기능·안전·패키징 파일을 하나의 feature 브랜치에서 작업하고 검증 뒤에 \`develop\` FF 적용. **다만 오류 수정으로 추가 커밋과 CI 재실행은 발생했다. 불필요한 호출이 없어졌다고 단정하지 않는다.**
- \`verify_local.ps1\`를 만들어 Windows에서 \`.\verify_local.ps1 -Quick\` 또는 전체 \`.\verify_local.ps1\` **단일 실행**으로 Node 버전/파일 구문·핵심/전체·Gold/Negative/Heldout·Wizard 검증을 묶고, **새 임시 폴더에 JSON 요약·로그**를 남기도록 했다. 기존 원본·DB 삭제/덮어쓰기 없음. Windows hosted CI에서 **Quick 실행 PASS**; 일반 사용자 Windows에서 전체 모드 직접 실행은 별도 미확인.
- \`scripts/p543-native-portable.mjs\`와 \`scripts/p543-verify-native-portable.mjs\`로 **사전 설치한 고정 오픈소스 node_modules 포함** 로컬 실행 폴더를 생성, 매 파일 SHA-256/상대경로 검증. 포터블 모드 시작 CMD에 필수 체크를 넣었다. 배포 사용자는 이 산출물에서 \`npm ci\`가 필요 없지만 **Node.js 22.23+ 설치는 여전히 필요**.
- Windows Actions에서 패키지 구성 → *복사된 패키지 자체* SHA 검증/의도적 파일 변조 차단 → 합성 PDF+DOCX 자동 선택 데이터 입력 → localhost bearer 검색, 문서 인용 및 고정 SKU 집계 → ZIP용 업로드 아티팩트 생성까지 **한 통합 CI 작업**에 결합했다.

**미개선/미계측:**
- GitHub API 도구 호출·커밋 수와 시간의 절감 **실측 없음**. 실제 개발 중 빌드 출력 부모 폴더 누락, PowerShell JSON 배열 변환 오류, 정적 테스트의 주석 오탐으로 CI 재실행이 발생했다. 이를 해결했으나 반복 실패 자체를 '제거'했다고 할 수 없다.
- 물리 Windows GUI 파일 선택·Chrome/Edge 사용, 사용자 실제 파일 권리 승인/Private SMAX 연결, Node 없는 서명형 설치기 **미완료**.

## 4. 개선 이후 새롭게 완성한 기능
1. **실사용 가능한 형태의 P5.43 포터블 폴더:** P5.42는 개발 체크아웃·별도 \`npm ci\`가 필요한 Windows 파일 선택 방식이었다. P5.43은 Windows Node 22.23+만 사전 설치하면 **고정 파서 의존성 포함** 폴더에서 실행 가능한 별도 산출물로 개선. 고정 공개 합성 AX 데이터를 기본으로, 사용자가 선택한 원본 PDF/DOCX는 **권리 미검증 로컬 추출 미리보기**로만 사용하고 SQLite 승인에 승격시키지 않음.
2. **포터블 무결성 fail-closed:** manifest 및 배포 파일의 SHA 검증; 테스트에서 임의 파일 변조 시 차단을 실제 확인.
3. **배포된 폴더의 기능 실행 증거:** 별도 복사본의 Node 자식 프로세스를 실제 시작해 PDF 1페이지/DOCX 2문단 인용, 고정 SKU N-02 매출 **72,000 KRW**, 익명 401/유효 Bearer 200, 검증 후 원본 보존을 확인.
4. **검증 자동화:** \`verify_local.ps1\` 단일 명령으로 QUICK 테스트를 실행·보고하는 경로를 실제 Windows CI에서 검증.
- **새로운 임베딩·범용 승인 고객 데이터 반입·Private SMAX Native 인증은 완성하지 않았다.** 기존 P5.40~42 검색을 재활용했다.

## 5. 변경 SHA·파일·실행 증거
- **전:** \`develop 5aaeeb4e18b4cb530ed572c43eb3589dcced19d9\`, [P5.42 Windows/Linux CI #40549445191](https://github.com/hibi89/RAG_STUDIO/actions/runs/40549445191) **Windows 515/515 PASS**, Linux 513 PASS/2 Windows 전용 SKIP.
- **새 기능 실제 검증:** \`36c2658de3ba365e650f9ce8ee40659e0fea50ab\`, [P5.43 GitHub Actions #40552982971](https://github.com/hibi89/RAG_STUDIO/actions/runs/40552982971) **Windows 520 PASS / 0 FAIL / 0 SKIP**, Linux **518 PASS / 0 FAIL / 2 Windows 전용 SKIP**. Gold100, Negative20, Heldout24, router demo, Windows QUICK/빌드/HTTP smoke 모두 PASS.
- **아티팩트:** Actions run의 \`RAG_STUDIO_P543_NATIVE_PORTABLE_SYNTHETIC\` (artifact id \`12755258665\`, 약 26.9MB, 보존 7일). GitHub Actions 아티팩트는 서명/고객 동의의 증거가 아님.
- **검증 이후 지침만 변경:** \`develop 19df0b54db3e974373ea3880268f564ed54337a6\`. 실제 전체 테스트를 수행한 소스 SHA와 인수인계 후속 SHA는 구분한다.
- **P5.42→P5.43 핵심 변경 경로 (실제 compare 결과):** \`AGENTS.md\`, \`RUN_NATIVE_DOCUMENT_PICKER_WINDOWS.cmd\`, \`verify_local.ps1\`, \`scripts/p543-native-portable.mjs\`, \`scripts/p543-verify-native-portable.mjs\`, \`scripts/p543-native-portable-smoke.mjs\`, \`tests/p543-native-portable.test.mjs\`, \`packaging/P543_NATIVE_PORTABLE_README.txt\`, \`.github/workflows/p543-verify.yml\`. STATUS/HANDOFF/README 반복 갱신은 이 차분에 없음.
- **검증 실패도 공개:** 초반 CI는 정적 코멘트 오탐, 그다음은 PowerShell 요약 직렬화, 이전 실행은 생성 대상 부모 폴더 누락으로 실패했고, 정정 후 **위 정확한 최종 SHA**에서 성공. 테스트 작성 건수와 실행 결과를 혼동하지 않는다.

## 6. 여전히 남은 병목 (책임 주체별)
**AI가 현재 GitHub/CI에서 해결 가능:** 소스·테스트 일괄 변경, 단일 검증 및 요약, 고정 합성 케이스의 HTTP/SQL/출처 테스트, 포터블 자동 패키징, 소프트웨어 취약성 검사와 OSS 라이선스/재배포 조건 점검, 파서 정상/오류 경로 보강. 다음 기능 단위를 성공 CI 1회로 수렴하도록 개선.
**사용자 Windows PC나 승인된 실제 GUI 환경 필요:** 표준 파일 선택창 클릭·취소·한국어 경로·브라우저 실제 키보드 동작, 사용자 3대 물리 PC의 설치·복구·SmartScreen·Defender/메모리·재시작 검증. 이 부분은 단일 로컬 스크립트로 준비하고 사용자에게 **반복 실행 작업을 떠넘기지 않는다**.
**별도 사용자 명시 승인 필요:** 실제 고객 데이터 처리/동의/법적 이용권, Private SMAX Native 승인·서명 실연동, 외부 공유/출시/유료 작업·계정/서비스 연결. 공개 합성 테스트가 이를 대체하지 않음.

## 7. 다음 개발 계획과 완료 조건
- **MVP 현황:** 고정 공개 합성 AX 데이터 및 사용자가 고른 미승인 PDF/DOCX의 **로컬 미리보기 MVP는 작동**. 최초 상용 RAG Studio 설계에 포함된 진짜 승인 고객 입력→SMAX 표준화→SQLite+문서 인용이 완성된 것은 아니다.
- **최우선 P5.44:** 기존 공개 SMAX \`REVIEW_HOLD\` 인터페이스에서 선택된 파일의 원본 무결성·미승인 사유를 한 번에 확인하고, **권한 없는 SQLite/AX 승격 없이** 실제 UI에서 검토·비승인 상태를 분명히 표시하는 기능 간극 해결. Private SMAX Native 인증/허가 없이 자동 승인하지 않는다.
- **다음 완료 기준:** 재현 가능한 공개 합성/권한 미확인 fixture → 실제 로컬 API/UI 리뷰 표시 → 승인 여부가 불분명하면 \`REVIEW_HOLD\` → 기존 승인 합성 SQL·PDF/DOCX 출처 기능 불변 → Linux/Windows 핵심 테스트+통합 회귀 CI PASS. 변경 파일·검증 SHA만 기록.
- **후속 최종 완성에 필요한 영역:** 승인 가능한 SMAX Native 계약(소유자 협의 필요), 사용자 소스용 범용 표준화/검색·임베딩 경계, 오프라인 저메모리 동작, Windows 물리 PC QA·설치/복구, OSS 라이선스와 상용 보안 검토, 고객 권리·지원 정책, 마지막 UI 정리. **시간·완료율은 실제 기능별 수용기준과 외부 승인 여부가 확정되지 않아 본 보고서에서 임의 산정하지 않는다.**

## 해총 판정 요청
- **KEEP:** 합성/승인 경계 유지, 실제 포터블 복사본 실행 검증, 한 명령 검증/임시 요약.
- **FIX:** CLI/포터블의 물리 Windows GUI 수용성, 실측 개발 시간/호출 기준선, 테스트 수정 중 주석 오탐.
- **STOP:** 매 수정마다 3개 문서 의무 갱신, 동일 SHA 불필요한 CI 재실행, 변경 기능과 무관한 테스트 증식.
- **ACCELERATE:** P5.44의 실제 로컬 리뷰 기능과 이후 SMAX 계약 연동, 단 실제 승인·고객 파일 사용은 별도 허가 후.
