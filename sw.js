// 여행경비 트래커 서비스워커
// - 앱 화면(같은 출처 파일): 항상 네트워크 최신본 우선, 인터넷이 안 될 때만 저장해 둔 사본.
// - [2026-11-14] 지도(Leaflet)·글자 인식(Tesseract)·글꼴·지도 타일처럼 밖에서 받아오는 파일도
//   한 번 받으면 기기에 저장해 둔다 → 해외에서 인터넷이 끊겨도 지도 틀과 한 번 본 지역 지도, 영수증 인식이 동작.
// - Apps Script(백업) 등 그 밖의 외부 요청은 건드리지 않는다.

const CACHE_NAME = 'travel-budget-cache-v4';       // 배포할 때마다 숫자를 올린다
const EXT_CACHE = 'travel-budget-ext-v1';          // 외부 라이브러리·글꼴 (버전이 주소에 들어 있어 오래 보관)
const TILE_CACHE = 'travel-budget-tiles-v1';       // 지도 타일 (최대 TILE_MAX장)
const TILE_MAX = 800;
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const EXT_PRECACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];
const EXT_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'tessdata.projectnaptha.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const isTile = (url) => /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname);

// 외부 파일은 내용 확인이 가능한 방식(cors)으로 받아야 저장공간을 과하게 차지하지 않는다.
function corsFetch(url) { return fetch(url, { mode: 'cors', credentials: 'omit' }); }

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
    caches.open(EXT_CACHE).then((cache) => Promise.all(EXT_PRECACHE.map((u) =>
      corsFetch(u).then((res) => { if (res && res.ok) return cache.put(u, res); }).catch(() => {})
    )))
  ]));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME, EXT_CACHE, TILE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => keep.indexOf(k) === -1).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// 저장해 둔 것이 있으면 바로 주고, 없으면 받아서 저장
async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    const res = await corsFetch(req.url);
    if (res && res.ok) {
      await cache.put(req.url, res.clone());
      if (max) trimCache(cacheName, max);
    }
    return res;
  } catch (err) {
    return fetch(req);   // cors로 못 받는 경우 원래 방식 그대로(저장은 안 함)
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (isTile(url)) { event.respondWith(cacheFirst(req, TILE_CACHE, TILE_MAX)); return; }
    if (EXT_HOSTS.indexOf(url.hostname) !== -1) { event.respondWith(cacheFirst(req, EXT_CACHE, 0)); return; }
    return;   // 그 밖의 외부 요청(백업 서버 등)은 그대로 통과
  }

  // 같은 출처: 네트워크 우선, 실패 시 저장본. 오류 응답(404 등)은 저장하지 않는다.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
  );
});
