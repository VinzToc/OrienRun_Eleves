/* OrienRun – application élève */
(function () {
  'use strict';
  const O = window.ORUN, $ = id => document.getElementById(id);
  const VERSION = '2.0';
  const LS = { base: 'orun_base_pack', run: 'orun_run', id: 'orun_identite' };
  let base = null, run = null, cur = 0, gps = { watch: null, fixes: [], last: null }, clockT = null, wake = null, map = null;

  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms || 2600); }
  function show(id) { ['s-home', 's-course', 's-bilan'].forEach(s => $(s).hidden = s !== id); window.scrollTo(0, 0); }
  const seuil = () => (run && run.seuil) || (base && base.seuilGPS) || O.CFG.seuilGPS || 5;

  /* ---------- Base de référence ---------- */
  async function loadBaseFromStorage() {
    const pack = lsGet(LS.base); if (!pack) return;
    try { base = await O.decryptJSON(pack); } catch (e) { base = null; lsDel(LS.base); }
  }
  function renderBase() {
    const st = $('baseState'), sel = $('fParcours');
    if (!base) { st.innerHTML = '<span class="chip ko">Aucune base importée</span>'; sel.innerHTML = '<option value="">-- Importe d\'abord la base --</option>'; return; }
    st.innerHTML = '<span class="chip ok">✔ ' + esc(base.nom || 'Base') + '</span> <span class="note">' + base.parcours.length + ' parcours · ' + base.balises.length + ' balises</span>';
    const cartes = base.cartes.slice().sort((a, b) => (a.numero || 0) - (b.numero || 0));
    let h = '<option value="">-- Choisis ton parcours --</option>';
    cartes.forEach(c => {
      const ps = base.parcours.filter(p => p.carteId === c.id).sort((a, b) => a.code.localeCompare(b.code));
      if (!ps.length) return;
      h += '<optgroup label="' + esc(c.nom || ('Carte ' + c.numero)) + '">' + ps.map(p => '<option value="' + esc(p.id) + '">' + esc(p.code + ' – ' + (p.nom || '') + ' (' + p.balises.length + ' balises)') + '</option>').join('') + '</optgroup>';
    });
    const orph = base.parcours.filter(p => !base.cartes.some(c => c.id === p.carteId));
    if (orph.length) h += '<optgroup label="Autres">' + orph.map(p => '<option value="' + esc(p.id) + '">' + esc(p.code + ' – ' + (p.nom || '')) + '</option>').join('') + '</optgroup>';
    const prev = sel.value; sel.innerHTML = h; if (prev) sel.value = prev;
  }
  $('fileBase').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    $('baseErr').textContent = '';
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const r = await O.readWorkbook(XLSX, wb, ['BASE']);
      if (!r.data.parcours || !r.data.balises) throw new Error('Base vide ou invalide.');
      lsSet(LS.base, O.readPack(XLSX, wb).pack); base = r.data; renderBase(); toast('Base importée ✔');
    } catch (err) { $('baseErr').textContent = '⚠ ' + (err.message || err); }
  });

  /* ---------- Identification ---------- */
  function partnerRow(p) {
    p = p || {};
    const d = document.createElement('div'); d.className = 'partner';
    d.innerHTML = '<input class="pn" placeholder="Nom" autocapitalize="characters"><input class="pp" placeholder="Prénom"><input class="cl pc" placeholder="Classe"><button type="button" class="btn dng sm" aria-label="Retirer">✕</button>';
    d.querySelector('.pn').value = p.nom || ''; d.querySelector('.pp').value = p.prenom || ''; d.querySelector('.pc').value = p.classe || '';
    d.querySelector('button').onclick = () => { d.remove(); saveIdent(); };
    d.addEventListener('input', saveIdent);
    return d;
  }
  function readPartners() {
    return [].map.call($('partners').children, d => ({ nom: d.querySelector('.pn').value.trim(), prenom: d.querySelector('.pp').value.trim(), classe: d.querySelector('.pc').value.trim() })).filter(p => p.nom || p.prenom);
  }
  function saveIdent() { lsSet(LS.id, { nom: $('fNom').value, prenom: $('fPrenom').value, classe: $('fClasse').value, groupe: $('fGroupe').value, partenaires: readPartners() }); }
  function loadIdent() {
    const i = lsGet(LS.id) || {};
    $('fNom').value = i.nom || ''; $('fPrenom').value = i.prenom || ''; $('fClasse').value = i.classe || ''; $('fGroupe').value = i.groupe || '';
    (i.partenaires || []).forEach(p => $('partners').appendChild(partnerRow(p)));
    ['fNom', 'fPrenom', 'fClasse', 'fGroupe'].forEach(id => $(id).addEventListener('input', saveIdent));
  }
  $('addPartner').onclick = () => { const r = partnerRow(); $('partners').appendChild(r); r.querySelector('.pn').focus(); };

  /* ---------- GPS ---------- */
  function startGps() {
    if (gps.watch != null || !navigator.geolocation) { if (!navigator.geolocation) setGpsChip('ko', 'GPS indisponible'); return; }
    gps.watch = navigator.geolocation.watchPosition(p => {
      const f = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() };
      gps.last = f; gps.fixes.push(f); gps.fixes = gps.fixes.filter(x => f.t - x.t < 10000);
      setGpsChip(f.acc <= 8 ? 'ok' : f.acc <= 20 ? 'wa' : 'ko', 'GPS ±' + Math.round(f.acc) + ' m');
      if (run && !run.arriveeTs && f.acc <= 50) {
        const tr = run.trace, l = tr[tr.length - 1];
        if (!l || O.haversine(l[0], l[1], f.lat, f.lon) >= 3) { tr.push([+f.lat.toFixed(6), +f.lon.toFixed(6), Math.round(f.acc), +((f.t - run.departTs) / 1000).toFixed(1)]); }
      }
    }, e => setGpsChip('ko', e.code === 1 ? 'GPS refusé' : 'GPS indisponible'), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
  function stopGps() { if (gps.watch != null) navigator.geolocation.clearWatch(gps.watch); gps.watch = null; gps.fixes = []; gps.last = null; }
  function setGpsChip(cls, txt) { const c = $('cGps'); c.className = 'chip ' + cls; c.innerHTML = '<i class="dot ' + cls + '"></i> ' + txt; }
  function bestFix() {
    const now = Date.now(), r = gps.fixes.filter(f => now - f.t < 10000);
    if (!r.length) return gps.last && now - gps.last.t < 30000 ? gps.last : null;
    return r.reduce((a, b) => b.acc < a.acc ? b : a);
  }

  /* ---------- Départ ---------- */
  $('fDate').value = new Date().toISOString().slice(0, 10);
  $('btnDepart').onclick = () => {
    const err = $('homeErr'); err.textContent = '';
    const nom = $('fNom').value.trim(), prenom = $('fPrenom').value.trim(), classe = $('fClasse').value.trim();
    if (!base) return err.textContent = 'Importe d\'abord la base de balises fournie par ton professeur.';
    if (!nom || !prenom || !classe) return err.textContent = 'Renseigne ton nom, ton prénom et ta classe.';
    const p = base.parcours.find(x => x.id === $('fParcours').value);
    if (!p) return err.textContent = 'Choisis ton parcours.';
    const bals = O.parcoursDetail(base, p);
    if (!bals.length) return err.textContent = 'Ce parcours ne contient aucune balise.';
    const carte = base.cartes.find(c => c.id === p.carteId) || {};
    saveIdent();
    run = {
      v: 1, id: O.uid(), eleve: { nom, prenom, classe }, partenaires: readPartners(), groupe: $('fGroupe').value.trim(),
      date: $('fDate').value, baseId: base.id, baseNom: base.nom,
      parcours: { code: p.code, nom: p.nom, carteNom: carte.nom || '', carteRef: carte.ref || '' },
      seuil: base.seuilGPS || O.CFG.seuilGPS || 5, departTs: Date.now(), arriveeTs: null,
      balises: bals.map((b, i) => ({ rang: i + 1, identifiant: b.identifiant, couleur: b.couleur, lat: b.lat, lon: b.lon, statut: null, mode: null, codeSaisi: '', fix: null, distance: null, ts: null, tempsTot: null, tempsInter: null, essais: [] })),
      trace: []
    };
    cur = 0; persist(); enterCourse();
  };
  function persist() { if (run) lsSet(LS.run, run); }

  /* ---------- Course ---------- */
  async function keepAwake() { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { } }
  function enterCourse() {
    show('s-course'); startGps(); keepAwake();
    $('cParcours').textContent = run.parcours.code + (run.parcours.nom ? ' – ' + run.parcours.nom : '');
    clearInterval(clockT); clockT = setInterval(tickClock, 500); tickClock();
    renderCourse(null);
  }
  function tickClock() { if (run) $('cClock').textContent = O.fmtDur(Math.max(0, Math.round((Date.now() - run.departTs) / 1000))); }
  const isDone = b => b.ts != null;
  function renderCourse(banner) {
    const n = run.balises.length; const b = run.balises[cur];
    $('cRang').textContent = (cur + 1) + '/' + n;
    $('cIdent').textContent = b.identifiant;
    $('cDots').innerHTML = run.balises.map((x, i) => '<i class="' + (x.ts != null || x.statut ? (x.statut || '') : '') + (i === cur ? ' cur' : '') + '"></i>').join('');
    const valid = run.balises.filter(x => x.statut === 'valide').length;
    $('cScore').textContent = '✔ ' + valid + ' / ' + n;
    const bn = $('cBanner'); bn.innerHTML = banner ? '<div class="banner ' + banner.cls + '"><div class="t">' + esc(banner.t) + '</div><div class="d">' + esc(banner.d || '') + '</div></div>' : '';
    const ok = b.statut === 'valide' && isDone(b);
    $('cActions').hidden = ok; $('cNext').hidden = !ok;
    $('btnSkip').hidden = ok || !b.essais.length;
    $('btnSkip').textContent = '⏭ ' + (cur + 1 >= n ? 'Terminer sans valider cette balise' : 'Passer à la balise suivante (non validée)');
    $('btnNext').textContent = cur + 1 >= n ? 'Voir mon bilan 🏁' : 'Balise suivante ➜';
  }
  function finalizeBalise(b, ts) {
    const prev = run.balises.slice(0, cur).reverse().find(x => x.ts != null);
    b.ts = ts; b.tempsTot = Math.round((ts - run.departTs) / 1000);
    b.tempsInter = Math.round((ts - (prev ? prev.ts : run.departTs)) / 1000);
  }
  function refBalise(i) {
    const p = base.parcours.find(x => x.code === run.parcours.code) || {};
    const l = O.parcoursDetail(base, p); return l[i];
  }
  function submit(code, mode, identifiantScanne) {
    const b = run.balises[cur], ts = Date.now(), fix = bestFix();
    const ref = refBalise(cur);
    const r = O.evaluer({ balise: ref, code, identifiantScanne, fix, seuil: seuil() });
    const fx = fix ? { lat: +fix.lat.toFixed(6), lon: +fix.lon.toFixed(6), acc: Math.round(fix.acc) } : null;
    const statut = r.ok ? 'valide' : r.motif === 'code' ? 'erreur_code' : r.motif === 'position' ? 'erreur_position' : 'erreur_gps';
    b.essais.push({ ts, mode, code: String(code), statut, fix: fx, distance: r.distance != null ? Math.round(r.distance * 10) / 10 : null });
    b.statut = statut; b.mode = mode; b.codeSaisi = String(code); b.fix = fx; b.distance = r.distance != null ? Math.round(r.distance * 10) / 10 : null;
    let banner;
    if (r.ok) { finalizeBalise(b, ts); banner = { cls: 'ok', t: '✅ Balise validée !', d: 'Position à ' + b.distance.toFixed(1) + ' m de la balise · ' + O.fmtDur(b.tempsInter) }; if (navigator.vibrate) navigator.vibrate(120); }
    else if (r.motif === 'code') banner = { cls: 'ko', t: '❌ Code incorrect', d: mode === 'scan' ? 'Ce QR code ne correspond pas à la balise attendue (' + b.identifiant + '). Réessaie ou passe à la suivante.' : 'Le code saisi n\'est pas le bon. Vérifie la balise (' + b.identifiant + ') et réessaie.' };
    else if (r.motif === 'position') banner = { cls: 'ko', t: '❌ Position trop éloignée', d: 'Tu es à ' + r.distance.toFixed(1) + ' m de la balise (maximum ' + seuil() + ' m). Rapproche-toi et recommence.' };
    else banner = { cls: 'ko', t: '❌ Position GPS indisponible', d: 'Attends que le signal GPS soit disponible (en extérieur) puis recommence.' };
    persist(); renderCourse(banner);
  }
  $('btnSkip').onclick = () => {
    const b = run.balises[cur]; if (b.statut === null) b.statut = 'non_pointee';
    finalizeBalise(b, Date.now()); next();
  };
  $('btnNext').onclick = next;
  function next() {
    if (cur + 1 >= run.balises.length) return finish();
    cur++; persist(); renderCourse(null);
  }
  $('btnFinish').onclick = () => {
    if (confirm('Terminer la course maintenant ? Les balises restantes seront comptées comme non pointées.')) finish();
  };
  function finish() {
    run.balises.forEach(b => { if (b.statut == null) b.statut = 'non_pointee'; });
    run.arriveeTs = Date.now(); persist(); clearInterval(clockT); stopGps();
    try { if (wake) wake.release(); } catch (e) { } wake = null;
    renderBilan();
  }
  // Mapping: la balise courante peut ne pas être finalisée au moment de "terminer"
  /* ---------- Saisie du code ---------- */
  function closeOv() { $('ov').innerHTML = ''; }
  $('btnCode').onclick = () => {
    let v = '';
    $('ov').innerHTML = '<div class="overlay"><div class="modal"><h3>Entrer le code</h3><div class="note" style="text-align:center">Balise ' + esc(run.balises[cur].identifiant) + '</div>' +
      '<div id="codeDisp"><div></div><div></div><div></div><div></div></div><div class="keys">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button data-k="' + n + '">' + n + '</button>').join('') +
      '<button class="del" data-k="x">Effacer</button><button data-k="0">0</button><button class="del" data-k="b">⌫</button></div>' +
      '<div class="row"><button class="btn dng" id="kCancel">Annuler</button><button class="btn" id="kOk" disabled>Valider</button></div></div></div>';
    const paint = () => { [].forEach.call($('codeDisp').children, (d, i) => { d.textContent = v[i] || ''; d.className = v[i] ? 'f' : (i === v.length ? 'on' : ''); }); $('kOk').disabled = v.length !== 4; };
    paint();
    $('ov').querySelector('.keys').onclick = e => {
      const k = e.target.dataset && e.target.dataset.k; if (!k) return;
      if (k === 'x') v = ''; else if (k === 'b') v = v.slice(0, -1); else if (v.length < 4) v += k;
      paint();
    };
    $('kCancel').onclick = closeOv;
    $('kOk').onclick = () => { const c = v; closeOv(); submit(c, 'saisie'); };
  };

  /* ---------- Scan ---------- */
  $('btnScan').onclick = () => {
    ORUN_SCAN.open({
      accept: t => !!O.parseQr(t),
      onFound: t => { const q = O.parseQr(t); submit(q.code, 'scan', q.identifiant); },
      onCancel: () => { },
      onManual: () => $('btnCode').click()
    });
  };

  /* ---------- Bilan ---------- */
  const LBL = { valide: 'Validée', erreur_code: 'Code incorrect', erreur_position: 'Position trop éloignée', erreur_gps: 'GPS indisponible', non_pointee: 'Non pointée' };
  function renderBilan() {
    show('s-bilan');
    const s = O.statsRun(run);
    $('bTaux').textContent = Math.round(s.taux) + ' %';
    $('bTauxD').textContent = s.valides + ' balise(s) validée(s) sur ' + s.total;
    const rows = [
      ['Élève' + (run.partenaires.length ? 's' : ''), esc([O.identiteTxt(run.eleve)].concat(run.partenaires.map(O.identiteTxt)).join(' · '))],
      run.groupe ? ['Groupe', esc(run.groupe)] : null,
      ['Parcours', esc(run.parcours.code + (run.parcours.nom ? ' – ' + run.parcours.nom : ''))],
      ['Départ', O.fmtHeure(run.departTs)], ['Arrivée', O.fmtHeure(run.arriveeTs)],
      ['Temps total', O.fmtDur(Math.round((run.arriveeTs - run.departTs) / 1000))],
      ['Temps moyen / balise validée', s.valides ? O.fmtDur(Math.round(s.tempsMoyen)) : '—'],
      ['Erreurs de code', s.errCode], ['Erreurs de position', s.errPos], ['Non pointées', s.nonPointees],
      ['Distance parcourue', s.distTrace ? Math.round(s.distTrace) + ' m' : '—'], ['Distance théorique', s.distTheorique ? Math.round(s.distTheorique) + ' m' : '—']
    ].filter(Boolean);
    $('bSum').innerHTML = rows.map(r => '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td></tr>').join('');
    $('bTable').innerHTML = '<tr><th>#</th><th>Balise</th><th>Résultat</th><th>Temps</th><th>Détail</th></tr>' + run.balises.map(b => {
      let d = '';
      if (b.statut === 'erreur_code') d = 'code saisi : ' + esc(b.codeSaisi);
      else if (b.statut === 'erreur_position') d = (b.distance != null ? b.distance.toFixed(1) : '?') + ' m de la balise (max ' + run.seuil + ' m)';
      else if (b.statut === 'valide') d = (b.distance != null ? b.distance.toFixed(1) + ' m' : '') + (b.essais.length > 1 ? ' · ' + b.essais.length + ' essais' : '');
      return '<tr><td>' + b.rang + '</td><td><b>' + esc(b.identifiant) + '</b></td><td class="st ' + b.statut + '">' + LBL[b.statut] + '</td><td>' + (b.tempsInter != null ? O.fmtDur(b.tempsInter) : '—') + '</td><td>' + d + '</td></tr>';
    }).join('');
    setTimeout(drawMap, 50);
  }
  function drawMap() {
    if (map) { map.remove(); map = null; }
    try {
      map = L.map('bMap', { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      const pts = [];
      const ref = run.balises.map(b => [b.lat, b.lon]);
      L.polyline(ref, { color: '#fff', weight: 2, dashArray: '6 6', opacity: .8 }).addTo(map); pts.push.apply(pts, ref);
      if (run.trace.length > 1) { const tr = run.trace.map(p => [p[0], p[1]]); L.polyline(tr, { color: '#FF6B00', weight: 4 }).addTo(map); pts.push.apply(pts, tr); }
      run.balises.forEach(b => L.marker([b.lat, b.lon], { icon: L.divIcon({ className: '', iconSize: [26, 26], html: '<div style="width:26px;height:26px;border-radius:50%;background:' + (b.statut === 'valide' ? '#22e58b' : '#ff5d5d') + ';color:#000;font:800 12px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff">' + b.rang + '</div>' }) }).addTo(map));
      map.fitBounds(pts, { padding: [24, 24] });
    } catch (e) { $('bMap').innerHTML = '<div class="note" style="padding:12px">Carte indisponible hors ligne.</div>'; }
  }

  /* ---------- Export ---------- */
  function fileName() {
    const nom = run.groupe ? run.groupe : run.eleve.nom + '_' + run.eleve.prenom;
    return 'OrienRun_' + O.slug(nom) + '_' + O.slug(run.parcours.code) + '.xlsx';
  }
  $('btnExport').onclick = async () => {
    try {
      const wb = await O.buildRunWorkbook(XLSX, run);
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const file = new File([blob], fileName(), { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'OrienRun' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName(); document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); toast('Fichier enregistré ✔');
    } catch (e) { toast('Erreur d\'export : ' + e.message, 5000); }
  };
  $('btnNew').onclick = () => {
    if (!confirm('Commencer une nouvelle course ? Assure-toi d\'avoir exporté ton fichier.')) return;
    run = null; lsDel(LS.run); show('s-home');
  };

  /* ---------- Démarrage ---------- */
  (async function init() {
    $('ver').textContent = VERSION;
    loadIdent(); await loadBaseFromStorage(); renderBase();
    const saved = lsGet(LS.run);
    if (saved && saved.balises) {
      run = saved;
      if (run.arriveeTs) renderBilan();
      else {
        const i = run.balises.findIndex(b => !(b.ts != null));
        cur = i < 0 ? run.balises.length - 1 : i;
        enterCourse();
      }
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  })();
})();
