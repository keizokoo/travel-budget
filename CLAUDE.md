# 여행경비 트래커 (travel-budget)

## 무엇
- 해외 여행 경비 정리·정산 PWA. 여행별로 이동(이전/다음 여행), 날짜별·장소별 보기(data-view: day, place).
- 파일: index.html(단일 파일, 약 0.27MB) · sw.js · manifest.json · 아이콘.
- 데이터: Google 시트 ↔ Apps Script 웹앱 연동. 서버 코드: `gas/Code.gs` (2026-11-15 서버 현재본에서 가져옴).

## 이 앱만의 주의점
- 환율 환산·정산(누가 얼마를 내는지) 계산을 바꾸면 `financial-calc-verification` 스킬 적용.
- 백업은 병합이 아니라 **통째 덮어쓰기**(한 기기 사용 전제, 2026-11-14 확정). 서버 응답 `{ok:true}`를 확인한 경우에만 "백업 완료"로 표시한다 → `fetch`에 `mode:'no-cors'`를 다시 넣지 말 것.
- 영수증 사진은 IndexedDB(`travel_budget_db` / `photos`)에 지출 id별로 저장하고 localStorage에는 표시(`@idb`)만 둔다. 메모리의 `expense.receipt`는 사진 그대로. 덮어쓰기 전 보관본은 같은 DB의 `snaps`.
- 지운 지출·여행은 `data.trash`에 30일 보관(설정 > 삭제 보관함). 삭제 코드를 새로 만들면 `trashExpenses`/`trashTrip`을 거칠 것.
- sw.js는 지도(Leaflet)·글자 인식(Tesseract)·지도 타일을 기기에 저장한다(외부 주소를 바꾸면 sw.js의 `EXT_HOSTS`도 함께).
- 빌드: 앱 `APP_BUILD` + `CHANGELOG`(설정 화면에 표시), 서버 `CODE_VERSION`.

## 배포
- 확인 필요: GitHub Pages인지 다른 호스팅인지.

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
- 2026-11-14: 5개 앱 비교 점검 결과 반영(앱 2026-11-14-a / Code.gs 2026-11-14). 서버 인증키와 병합형 동기화는 하지 않기로 함.
