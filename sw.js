const V='orienrun-eleve-v2';
const SHELL=['./','index.html','config.js','manifest.webmanifest','css/base.css','css/app.css','js/orun-core.js','js/scanner.js','js/app.js','lib/xlsx.full.min.js','lib/jsQR.js','lib/leaflet/leaflet.js','lib/leaflet/leaflet.css','icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x.startsWith('orienrun-eleve')).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.hostname.endsWith('openstreetmap.org')||u.hostname.endsWith('opentopomap.org')){ // tuiles déjà vues uniquement
    e.respondWith(caches.open(V+'-tiles').then(c=>c.match(r).then(h=>h||fetch(r).then(n=>{c.put(r,n.clone());return n}).catch(()=>h))));return;}
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(r).then(n=>{const cp=n.clone();caches.open(V).then(c=>c.put(r,cp));return n}).catch(()=>caches.match(r)));
});
