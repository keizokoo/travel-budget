# 여행경비 트래커 (travel-budget)

## 무엇
- 해외 여행 경비 정리·정산 PWA(회의비/마이라이프와 **별도 독립 앱**). localStorage 키 `travel_budget_app_v1`.
- 디자인: 쿨톤 뉴트럴 배경 + 버건디빛 테라코타 포인트 `#C1440E`, 다크모드.
- 주요 기능: 카드승인 문자 자동인식(국내+해외승인, 통화·환율 계산), 영수증 OCR(Tesseract.js, 방향 자동보정), 일괄 업로드 검토, Day별 지출목록, 차트, 여러 여행(트립) 관리, CSV·정산 리포트, JSON 백업/복원 + Google Drive 자동 백업(서버가 latest.json + history 5개 로테이션).
- "일자별 요약" 탭(안E 하이브리드): 날짜별 자동 요약 + 메모 + **구글 타임라인 업로드 연동**(`semanticSegments`·`timelineObjects` 둘 다 파싱), OpenStreetMap Nominatim 역지오코딩.
- 파일: index.html(단일 파일, 약 0.27MB) · sw.js · manifest.json · 아이콘.
- 데이터: Google 시트 ↔ Apps Script 웹앱 연동. 서버 코드: `gas/Code.gs` (2026-11-15 서버 현재본에서 가져옴).

## 타임라인·장소 로직 (재발 방지)
- 시간은 ISO 문자열의 **현지 UTC 오프셋 그대로** 표시(브라우저 시간대로 변환 금지). 오프셋 없는 "Z" 시각은 ⚠ 표시.
- Nominatim 사용정책: 초당 1건 큐, 좌표별 영구 캐시, 출처 표시("위치정보 제공: OpenStreetMap 기여자"), 실패 시 최대 5회 지수 백오프.
- 조회 큐(`enqueueGeocodesForTrip`)는 **모든 개별 방문 좌표**를 넣되 **반드시 여행 기간으로 좁힐 것**(빼먹으면 수년치 위치기록이 큐를 막음).
- 스팟 병합(`computeDaySpots`): "시간 겹침 OR (200m 이내 AND 간격 15분 이내)". 대표 이름은 `placeQuality`(직접수정 > POI명 > 도로명 부근 > 이름 없음 > 미조회)로 더 좋은 후보를 승격.
- "메모 입력 중엔 화면 안 바뀌게" 보호는 **진짜 textarea 입력 중일 때만**(`<details>` 펼침 포커스는 제외).
- ✏️ 장소명 직접 수정(좌표 기준 override)은 자동인식보다 항상 우선.

## 검증 루틴
- `node --check`, DOM id 중복 검사(의도적 중복만 허용: `budgetView`, `timelineUploadBtn`, `timelineHelpBtn`), Playwright로 `#timelineFileInput`에 타임라인 JSON 픽스처 업로드 + Nominatim은 `page.route()` 모의응답, 라이트/다크 스크린샷.

## 이 앱만의 주의점
- 환율 환산·정산(누가 얼마를 내는지) 계산을 바꾸면 `financial-calc-verification` 스킬 적용.
- 최근 수정: 2026-09-19 (4개 앱 중 가장 오래됨).

## 배포
- GitHub Pages(main, 추정 — 저장소 Settings → Pages에서 확인 필요). 서버는 `gas/Code.gs` → Claude 배포기 자동 반영.
- 새 기능은 시안(스크린샷) → 컨펌 → 구현. 타임라인 기능은 사용자 실기기 테스트 피드백을 기다렸다가 후속 조치.

## 작업 규칙 (모든 앱 공통)
- 코드 수정: `solo-app-code-edit` 스킬 절차를 따른다. 새 기능·탭 추가: `solo-app-new-build` 스킬.
- Apps Script·시트·배포 콘솔처럼 사용자가 직접 화면을 조작해야 하면 `gas-nondev-walkthrough` 스타일로 단계별 안내.
- index.html은 단일 파일이고 크다 → 전체를 다시 쓰지 말고 필요한 부분만 수정. 수정 전에 grep으로 관련 코드를 모두 찾을 것.
- 배포할 때마다 sw.js의 `CACHE_NAME` 버전을 올린다 (안 올리면 PWA가 옛 화면을 계속 보여줌).
- localStorage 키 이름(`*_v1` 등)을 바꾸면 기존 사용자 데이터가 사라진 것처럼 보인다 → 바꿀 때는 이전(마이그레이션) 코드 필수.
- 서버 코드는 저장소 `gas/Code.gs`가 원본. main에 병합되면 "Claude 배포기"(moneytrail 저장소 `tools/gas-deployer/`)가 5분 안에 Apps Script에 자동 배포한다(웹앱 URL 유지, 백업·롤백 있음). 사용자에게 붙여넣기를 시키지 않는다.
- 시트 동기화 형식을 바꾸면 index.html과 `gas/Code.gs`를 **같은 PR**에서 함께 바꾼다.
- `gas/Code.gs`에 토큰·키·비밀번호를 절대 쓰지 않는다(공개 저장소). 비밀값은 `PropertiesService.getScriptProperties()`로 읽는다.
- 작업은 브랜치 → PR → 사용자가 병합. main에 직접 push하지 않는다.
- 변경 후 Playwright로 index.html을 열어 콘솔 오류가 없는지 확인한다.

## 사용자
- 비개발자 1인 운영. 설명은 한국어 존댓말, 결론 먼저, 사용자가 할 일은 번호 매긴 단계로.

## 결정 기록 (채팅에서 확정한 사항을 한 줄씩 추가)
- 2026-11-15: 개발은 Claude Code로 이전. 예전 채팅 문서의 "다운로드 파일로 전달 / Code.gs FULL본 요청·붙여넣기 / 사용자가 GitHub에 업로드" 규칙은 **더 이상 적용하지 않는다** → 브랜치·PR로 전달, 병합 후 자동 배포.
- 상세 이력: Drive "여행경비트래커_작업컨텍스트.md"(2026-09-06).
