const CACHE = 'scadenze-v2';
const FILES = ['./', './index.html', './manifest.json', './icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && new URL(e.request.url).origin === location.origin) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request)));
});

// Push dal server (se in futuro colleghi un backend web-push)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'Scadenza', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Rinnovo in scadenza', {
    body: d.body || '', icon: 'icon.svg', badge: 'icon.svg', vibrate: [400, 200, 400, 200, 800],
    requireInteraction: true, tag: d.tag || 'scadenza', data: { url: './index.html?alarm=1' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { c.postMessage({ type: 'alarm' }); return c.focus(); }
    return clients.openWindow('./index.html?alarm=1');
  }));
});
// Controllo periodico in background (Chrome Android, PWA installata)
self.addEventListener('periodicsync', e => { if (e.tag === 'check-scadenze') e.waitUntil(checkFromIDB()); });
async function checkFromIDB() {
  const data = await new Promise(res => {
    const r = indexedDB.open('scadenze', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('users'); g.onsuccess = () => res(g.result || []); g.onerror = () => res([]); };
    r.onerror = () => res([]);
  });
  const t = new Date(); t.setHours(0,0,0,0); const tm = new Date(t); tm.setDate(tm.getDate()+1);
  const key = d => d.toISOString().slice(0,10);
  for (const u of data) {
    if (u.expiry === key(tm) || u.expiry === key(t)) {
      await self.registration.showNotification('⏰ Rinnovo ' + u.server, {
        body: u.name + ' scade il ' + u.expiry.split('-').reverse().join('/') + ' — rinnova!',
        icon: 'icon.svg', vibrate: [400,200,400,200,800], requireInteraction: true, tag: u.id + u.expiry,
        data: { url: './index.html?alarm=1' }
      });
    }
  }
}
