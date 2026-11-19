/* オフライン用：アプリ本体・アイコン・フォントをiPadの中に保存する */
const VERSION = 'tankentai-v2.3-2';
const CORE = ['./', './index.html', './manifest.webmanifest', './zh.html', './manifest-zh.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800&family=ZCOOL+KuaiLe&display=swap';
const READY_KEY = './__offline_ready__';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
    warmFonts();
  })());
});

let warming = null;
function warmFonts() {
  if (!warming) warming = (async () => {
    const c = await caches.open(VERSION);
    if (await c.match(READY_KEY)) return true;
    try {
      const css = await (await fetch(FONT_CSS, {mode: 'cors'})).text();
      await c.put(FONT_CSS, new Response(css, {headers: {'Content-Type': 'text/css; charset=utf-8'}}));
      const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
      let i = 0;
      const worker = async () => {
        while (i < urls.length) {
          const u = urls[i++];
          if (await c.match(u)) continue;
          for (let t = 0; t < 3; t++) {
            try { const r = await fetch(u, {mode: 'cors'}); if (r.ok) { await c.put(u, r); break; } } catch (err) {}
          }
        }
      };
      await Promise.all(Array.from({length: 6}, worker));
      for (const u of urls) if (!(await c.match(u))) throw new Error('font missing');
      await c.put(READY_KEY, new Response('ok'));
      return true;
    } catch (err) { return false; }
  })().finally(() => { warming = null; });
  return warming.then(ok => { tell(ok); return ok; });
}

async function tell(ok) {
  for (const cl of await self.clients.matchAll({includeUncontrolled: true})) cl.postMessage({type: 'offline', ok});
}

self.addEventListener('message', e => {
  if (e.data === 'offline?') e.waitUntil(warmFonts());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    const page = /\/zh\.html$/.test(new URL(req.url).pathname) ? './zh.html' : './index.html';
    e.respondWith(caches.match(page).then(r => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req.url, {ignoreVary: true}).then(r => r || fetch(req).then(res => {
    if (res.ok && (req.url.startsWith(self.location.origin) || /fonts\.(googleapis|gstatic)\.com/.test(req.url))) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req.url, copy));
    }
    return res;
  })));
});
