/**
 * 여행경비 트래커 - Google Drive 자동 백업용 Apps Script
 *
 * 이 스크립트는 index.html 앱의 "설정 > Google Drive 자동 백업"에서
 * [지금 백업] / [Drive에서 복원] 버튼이 호출하는 서버 역할을 합니다.
 *
 * - doPost: 앱에서 보낸 전체 데이터(JSON, 영수증 사진 포함)를 받아
 *   1) latest.json 파일에 최신 백업으로 덮어써서 저장 (복원 시 이 파일을 읽음)
 *   2) history 하위 폴더에 시각별 이력 파일로도 저장 (최근 5개만 보관, 오래된 것은 자동 삭제)
 * - doGet: latest.json의 내용을 그대로 돌려줍니다 (복원용)
 *   - 단, ?action=resolveMapUrl&url=... 파라미터가 있으면 그 대신 resolveMapUrl_()을 실행합니다
 *     (2026-09-18 추가 — 아래 설명 참고).
 *   - ?action=resolveCity&lat=...&lng=... 파라미터가 있으면 resolveCity_()를 실행합니다
 *     (2026-09-19 추가 — 아래 설명 참고).
 *   - 기존 방식(파라미터 없이 호출)은 그대로 동작합니다.
 */

var FOLDER_NAME = '여행경비트래커_백업';
var HISTORY_LIMIT = 5;

function getBackupFolder() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

function getHistoryFolder(parentFolder) {
  var folders = parentFolder.getFoldersByName('history');
  return folders.hasNext() ? folders.next() : parentFolder.createFolder('history');
}

function doPost(e) {
  try {
    var payload = e.postData.contents;
    var folder = getBackupFolder();

    // 1) 최신 백업 파일 (매번 덮어씀 - 복원 시 이걸 읽음)
    var latestFiles = folder.getFilesByName('latest.json');
    if (latestFiles.hasNext()) {
      latestFiles.next().setContent(payload);
    } else {
      folder.createFile('latest.json', payload, MimeType.PLAIN_TEXT);
    }

    // 2) 이력 백업 (시각별로 남기고, 최근 5개만 유지)
    var historyFolder = getHistoryFolder(folder);
    var stamp = Utilities.formatDate(new Date(), 'GMT+9', 'yyyyMMdd_HHmmss');
    historyFolder.createFile('backup_' + stamp + '.json', payload, MimeType.PLAIN_TEXT);

    var files = historyFolder.getFiles();
    var list = [];
    while (files.hasNext()) list.push(files.next());
    list.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
    for (var i = HISTORY_LIMIT; i < list.length; i++) {
      list[i].setTrashed(true);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2026-09-18 추가: "여행기록" 탭의 지도용 — 앱에 등록해둔 구글맵 주소 대부분이
 * "https://maps.app.goo.gl/..." 같은 짧은 공유링크인데, 이 링크 자체에는 좌표가 텍스트로 들어있지
 * 않고 구글 서버로 리다이렉트돼야 실제 좌표가 있는 최종 주소가 나온다. 브라우저(클라이언트) JS는
 * 보안정책(CORS) 때문에 그 리다이렉트를 직접 따라가서 최종 URL을 읽을 수 없지만, 서버(Apps Script)는
 * UrlFetchApp으로 리다이렉트를 한 단계씩 직접 따라갈 수 있다. 그래서 클라이언트가 이 주소를 서버로
 * 보내면, 서버가 리다이렉트를 다 따라가서 도착하는 최종 URL(대개 ".../@위도,경도,줌레벨z" 형태를 포함)
 * 에서 좌표를 뽑아 돌려준다.
 *
 * doGet 자체를 바꾸지 않고 맨 앞에 분기만 하나 추가했다 — ?action=resolveMapUrl 파라미터가 없는
 * 기존 호출(백업 복원)은 이 분기를 그대로 지나쳐 아래의 원래 로직을 한 글자도 바꾸지 않고 그대로 탄다.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'resolveMapUrl' && e.parameter.url) {
    return resolveMapUrl_(e.parameter.url);
  }
  if (e && e.parameter && e.parameter.action === 'resolveCity' && e.parameter.lat && e.parameter.lng) {
    return resolveCity_(e.parameter.lat, e.parameter.lng);
  }
  try {
    var folder = getBackupFolder();
    var files = folder.getFilesByName('latest.json');
    if (!files.hasNext()) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: '아직 백업된 데이터가 없습니다. 앱에서 "지금 백업"을 먼저 실행해주세요.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var content = files.next().getBlob().getDataAsString();
    return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * shortUrl(짧은 공유링크)의 리다이렉트를 최대 6단계까지 직접 따라가서 최종 URL을 구하고,
 * 그 URL에서 위도/경도를 뽑아 { ok, resolvedUrl, lat, lng } 형태로 돌려준다.
 * 좌표를 못 찾아도(최종 URL이 좌표를 안 담은 형태인 경우) 에러가 아니라 lat/lng를 null로 돌려준다 —
 * 클라이언트가 "시도는 했지만 못 찾음"으로 캐시해서 매번 다시 시도하지 않게 하기 위함.
 */
function resolveMapUrl_(shortUrl) {
  try {
    var url = shortUrl;
    var finalUrl = url;
    for (var i = 0; i < 6; i++) {
      var res = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true });
      var code = res.getResponseCode();
      if (code >= 300 && code < 400) {
        var headers = res.getAllHeaders();
        var loc = headers['Location'] || headers['location'];
        if (!loc) break;
        url = loc;
        finalUrl = loc;
      } else {
        finalUrl = url;
        break;
      }
    }

    var lat = null, lng = null;
    var m = finalUrl.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (!m) m = finalUrl.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
    if (!m) m = finalUrl.match(/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, resolvedUrl: finalUrl, lat: lat, lng: lng }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2026-09-19 추가: "도시별" 탭에서 city 칸을 직접 안 적은 지출도 자동으로 도시를 구분할 수 있게,
 * 좌표(lat,lng)를 OpenStreetMap Nominatim으로 역지오코딩해서 도시명을 알아온다.
 *
 * 브라우저(클라이언트)에서 곧바로 Nominatim을 호출하면 앱을 식별할 방법이 마땅치 않아(User-Agent를
 * 스크립트가 직접 못 바꾸고, 파일로 열었을 때는 Referer도 안 실림) 신원 불명 요청으로 보여 조용히
 * 막히는 경우가 많았다. Apps Script(서버)에서 대신 호출하면 이 스크립트를 식별하는 User-Agent를
 * 직접 붙일 수 있어 Nominatim의 이용정책에 맞고, 훨씬 안정적으로 응답을 받는다.
 *
 * 도시명이 있는 태그가 주소마다 달라서(city/town/village/municipality 등) 여러 후보를 순서대로
 * 확인하고, 그래도 못 찾으면 좀 더 넓은 행정구역명(county/state_district/state)까지 내려가서 쓴다.
 * 그래도 하나도 없으면 city:null로 돌려주고(에러 아님), 클라이언트는 이 경우 "찾아봤지만 도시명이
 * 없었음"으로 캐시해서 같은 좌표를 매번 다시 조회하지 않는다.
 */
function resolveCity_(latStr, lngStr) {
  try {
    var lat = parseFloat(latStr);
    var lng = parseFloat(lngStr);
    var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&zoom=10&accept-language=ko';
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        // Nominatim 이용정책: 앱을 식별할 수 있는 User-Agent를 요구한다. 실제 배포 URL/연락처로 바꿔도 좋다.
        'User-Agent': '여행경비트래커-개인용 (Google Apps Script 경유 역지오코딩)'
      }
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'HTTP ' + code }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var json = JSON.parse(res.getContentText());
    var addr = (json && json.address) || {};
    var city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district
      || addr.county || addr.state_district || addr.state || null;
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, city: city }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
/**
 * 배포 전 테스트용: 이 함수를 선택해서 ▶ 실행 버튼을 눌러보면
 * 권한 승인 팝업이 뜨고, Google Drive에 "여행경비트래커_백업" 폴더와
 * latest.json / history 폴더가 생성되는지 확인할 수 있습니다.
 */
function testSetup() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        categories: ["식사", "숙소", "교통", "기타"],
        countries: ["영국", "스페인", "한국"],
        currencies: ["KRW", "GBP", "EUR"],
        trips: [{ id: "test", name: "테스트 여행", startDate: "", endDate: "", budget: 0 }],
        currentTripId: "test",
        expenses: [],
        lastFxRate: {},
        settings: { driveUrl: "", lastBackup: null, autoBackup: false, periodicBackup: false, periodicIntervalMinutes: 60 }
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}

/**
 * 2026-09-18 추가 - 배포 전 테스트용: 이 함수를 선택해서 ▶ 실행 버튼을 눌러보면
 * 로그(보기 > 로그)에 좌표가 잘 풀리는지 확인할 수 있습니다. 실제 여행 데이터에 있는
 * 짧은 링크 하나로 바꿔서 테스트해보세요.
 */
function testResolveMapUrl() {
  var result = resolveMapUrl_('https://maps.app.goo.gl/saq6xoQpib11jYTR8?g_st=ac');
  Logger.log(result.getContent());
}

/**
 * 2026-09-19 추가 - 배포 전 테스트용: 이 함수를 선택해서 ▶ 실행 버튼을 눌러보면
 * 로그(보기 > 로그)에 빅벤 좌표(런던)의 역지오코딩 결과가 찍힙니다. city가 "London"(또는 한글)로
 * 나오면 정상 동작하는 것입니다.
 */
function testResolveCity() {
  var result = resolveCity_('51.5007', '-0.1246');
  Logger.log(result.getContent());
}