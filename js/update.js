/* Affichage de la version + vérification de mise à jour (compare avec version.json publié à côté de l'appli) */
(function () {
  'use strict';
  function mount(el, ver) {
    el.innerHTML = 'Version <b>' + ver + '</b> · <button type="button" class="btn sec sm" id="updBtn">🔄 Vérifier la mise à jour</button><div class="note" id="updMsg" style="margin-top:6px"></div>';
    const btn = el.querySelector('#updBtn'), msg = el.querySelector('#updMsg');
    async function check(silent) {
      if (!silent) msg.textContent = 'Vérification…';
      try {
        const r = await fetch('version.json?_=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        if (String(j.version) !== String(ver)) {
          msg.innerHTML = '🆕 Version <b>' + j.version + '</b> disponible. ';
          btn.textContent = '⬇ Installer la mise à jour'; btn.onclick = install; btn.className = 'btn sm';
        } else if (!silent) msg.textContent = '✔ Tu utilises la dernière version.';
      } catch (e) { if (!silent) msg.textContent = 'Vérification impossible (hors ligne ou fichier version.json absent).'; }
    }
    async function install() {
      msg.textContent = 'Mise à jour…';
      try {
        if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(x => x.unregister())); }
        if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
      } catch (e) { }
      location.reload();
    }
    btn.onclick = () => check(false);
    check(true);
  }
  window.ORUN_UPDATE = { mount };
})();
