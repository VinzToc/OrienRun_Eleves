/* Fenêtre « Nouveautés » : s'affiche une seule fois après chaque mise à jour de l'application.
   Autonome (aucune dépendance), isolée du style de l'appli (Shadow DOM).
   Lit nouveautes.json (à côté de ce fichier) : [{ "v":"1.2.0", "date":"2026-11-23", "titre":"(facultatif)", "items":["…"] }, …]
   La version courante = la plus haute « v » du fichier. Pour une nouvelle version : ajouter une entrée au début du fichier. */
(function () {
  'use strict';
  var script = document.currentScript, base = script && script.src ? script.src : location.href;
  var seg = (location.pathname.split('/')[1] || 'app').toLowerCase();
  var KEY = 'EPS_NV_' + seg;

  function cmp(a, b) {
    a = String(a).split('.').map(Number); b = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) { var d = (a[i] || 0) - (b[i] || 0); if (d) return d; }
    return 0;
  }
  function lire() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function ecrire(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var cache = null;
  function charger() {
    if (!cache) {
      cache = fetch(new URL('nouveautes.json', base).href, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (L) {
          L = (Array.isArray(L) ? L : []).filter(function (n) { return n && n.v; });
          return L.sort(function (a, b) { return cmp(b.v, a.v); });
        })
        .catch(function () { return []; });
    }
    return cache;
  }

  var CSS = '' +
    '.ov{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.fc{position:relative;box-sizing:border-box;width:100%;max-width:520px;max-height:86vh;overflow:auto;background:#0f1830;color:#eaf0ff;border:1px solid rgba(255,255,255,.18);border-radius:22px;padding:22px 22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6);line-height:1.45}' +
    'h3{margin:0 40px 10px 0;font-size:1.25rem;color:#fff}' +
    'h4{margin:16px 0 6px;font-size:1.02rem;color:#ffb347}h4 small{font-weight:500;opacity:.7;color:#eaf0ff}' +
    'ul{margin:0;padding-left:20px}li{margin:5px 0}' +
    '.x{position:absolute;top:12px;right:12px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:1rem;cursor:pointer}' +
    '.ok{display:block;margin:18px auto 0;border:0;border-radius:14px;padding:12px 26px;font:inherit;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,#2f9bff,#0b57d0);box-shadow:0 6px 18px rgba(47,155,255,.35)}' +
    '.x:focus-visible,.ok:focus-visible{outline:3px solid #ffb347;outline-offset:2px}';

  var hote = null;
  function fermer() {
    if (hote) { hote.remove(); hote = null; }
    document.removeEventListener('keydown', touche, true);
    charger().then(function (L) { if (L.length) ecrire(L[0].v); });
  }
  function touche(e) { if (e.key === 'Escape') fermer(); }

  function montrer(liste) {
    if (!liste.length || hote) return;
    hote = document.createElement('div');
    var ombre = hote.attachShadow({ mode: 'open' });
    var st = document.createElement('style'); st.textContent = CSS; ombre.appendChild(st);
    var ov = document.createElement('div'); ov.className = 'ov';
    var fc = document.createElement('div'); fc.className = 'fc'; fc.setAttribute('role', 'dialog'); fc.setAttribute('aria-label', 'Nouveautés');
    var x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Fermer');
    var h = document.createElement('h3'); h.textContent = '✨ Nouveautés';
    fc.appendChild(x); fc.appendChild(h);
    liste.forEach(function (n) {
      var t = document.createElement('h4');
      t.textContent = n.titre || ('Version ' + n.v);
      if (n.date && !n.titre) {
        var d = new Date(n.date); var s = document.createElement('small');
        if (!isNaN(d)) { s.textContent = ' · ' + d.toLocaleDateString('fr-FR'); t.appendChild(s); }
      }
      var ul = document.createElement('ul');
      (n.items || []).forEach(function (it) { var li = document.createElement('li'); li.textContent = it; ul.appendChild(li); });
      fc.appendChild(t); fc.appendChild(ul);
    });
    var ok = document.createElement('button'); ok.className = 'ok'; ok.type = 'button'; ok.textContent = "J'ai compris";
    fc.appendChild(ok); ov.appendChild(fc); ombre.appendChild(ov);
    x.onclick = ok.onclick = fermer;
    ov.onclick = function (e) { if (e.target === ov) fermer(); };
    document.addEventListener('keydown', touche, true);
    (document.body || document.documentElement).appendChild(hote);
    try { ok.focus({ preventScroll: true }); } catch (e) {}
  }

  function auto() {
    charger().then(function (L) {
      if (!L.length) return;
      var cur = L[0].v, vue = lire();
      if (!vue) montrer(L.slice(0, 1));                                   /* première ouverture : dernière version seulement */
      else if (cmp(cur, vue) > 0) montrer(L.filter(function (n) { return cmp(n.v, vue) > 0; }));
    });
  }

  /* Réouverture manuelle (depuis la console ou un bouton de l'appli) : window.voirNouveautes() */
  window.voirNouveautes = function () { return charger().then(function (L) { montrer(L.slice(0, 4)); }); };

  if (document.readyState === 'complete') setTimeout(auto, 400);
  else window.addEventListener('load', function () { setTimeout(auto, 400); });
})();
