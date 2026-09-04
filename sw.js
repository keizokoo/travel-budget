// 여행경비 트래커 - 오프라인 설치(PWA)용 최소 서비스워커
// 앱 화면(같은 출처의 정적 파일)만 캐싱하고, 외부 요청은 그대로 통과시킵니다.

const CACHE_NAME = 'travel-budget-cache-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // 오프라인 첫 설치 등 실패해도 무시
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 요청, 같은 출처(우리 앱 파일)만 다룹니다.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // 네트워크 우선, 실패 시 캐시 (앱 최신 버전을 우선 반영하되 오프라인에서도 열리게)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
