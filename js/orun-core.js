/* orun-core.js – socle partagé OrienRun (appli élève) + OrienRun Admin (appli prof)
   - chiffrement AES-GCM (clé dérivée de ORUN_CONFIG.secret, identique des deux côtés)
   - conteneur .xlsx : base de balises chiffrée, fichier de course élève
   - validation d'un pointage (code + distance GPS), statistiques de course */
(function (root) {
  'use strict';
  const CFG = root.ORUN_CONFIG || { secret: 'orienrun-IbicibuS-MADORIBUS-mon pass tu ne le trouveras-pas', seuilGPS: 5 };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const SHEET = 'OrienRun_Data', CHUNK = 30000;

  /* ---------- utilitaires ---------- */
  const b64 = {
    to(u8) { let s = ''; const n = 0x8000; for (let i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); },
    from(str) { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = n => String(n).padStart(2, '0');
  function fmtDur(s) {
    if (s == null || isNaN(s)) return '';
    s = Math.round(s); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  }
  const fmtHeure = ts => ts ? new Date(ts).toLocaleTimeString('fr-FR') : '';
  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'sans_nom';

  /* ---------- géographie ---------- */
  function haversine(la1, lo1, la2, lo2) {
    const R = 6371000, r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function pathLength(pts) { // pts : [[lat,lon,...],...]
    let d = 0; for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); return d;
  }

  /* ---------- QR ---------- */
  const qrPayload = b => 'ORUN:' + encodeURIComponent(b.identifiant) + ':' + b.code;
  function parseQr(txt) {
    txt = String(txt || '').trim();
    let m = /^ORUN:([^:]*):(\d{4})$/.exec(txt);
    if (m) { let id = m[1]; try { id = decodeURIComponent(id); } catch (e) { } return { identifiant: id, code: m[2] }; }
    return null;
  }

  /* ---------- validation d'un pointage ---------- */
  // balise : {identifiant, code, lat, lon}; fix : {lat, lon, acc} ou null
  function evaluer({ balise, code, identifiantScanne, fix, seuil }) {
    const c = String(code == null ? '' : code).trim();
    const codeOk = c !== '' && c === String(balise.code) && (!identifiantScanne || identifiantScanne === balise.identifiant);
    if (!codeOk) return { ok: false, motif: 'code' };
    if (!fix) return { ok: false, motif: 'gps', distance: null };
    const d = haversine(fix.lat, fix.lon, balise.lat, balise.lon);
    return d <= seuil ? { ok: true, distance: d } : { ok: false, motif: 'position', distance: d };
  }

  const STATUTS = {
    valide: 'Validée', erreur_code: 'Erreur de code', erreur_position: 'Position trop éloignée',
    erreur_gps: 'GPS indisponible', non_pointee: 'Non pointée'
  };

  function statsRun(run) {
    const bs = run.balises || [], n = bs.length;
    const valid = bs.filter(b => b.statut === 'valide');
    const total = run.arriveeTs && run.departTs ? (run.arriveeTs - run.departTs) / 1000 : null;
    const moy = valid.length ? valid.reduce((s, b) => s + (b.tempsInter || 0), 0) / valid.length : null;
    return {
      total: n, valides: valid.length, taux: n ? Math.round(valid.length / n * 100) : 0,
      tempsTotal: total, tempsMoyen: moy,
      errCode: bs.filter(b => b.statut === 'erreur_code').length,
      errPos: bs.filter(b => b.statut === 'erreur_position' || b.statut === 'erreur_gps').length,
      nonPointees: bs.filter(b => b.statut === 'non_pointee').length,
      distTrace: pathLength(run.trace || []),
      distTheorique: pathLength(bs.map(b => [b.lat, b.lon]))
    };
  }

  /* ---------- chiffrement ---------- */
  async function deriveKey(salt, secret) {
    const base = await crypto.subtle.importKey('raw', enc.encode(secret || CFG.secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, base,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptJSON(obj, secret) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await deriveKey(salt, secret);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj))));
    return { salt: b64.to(salt), iv: b64.to(iv), data: b64.to(ct) };
  }
  async function decryptJSON(pack, secret) {
    try {
      const k = await deriveKey(b64.from(pack.salt), secret);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.from(pack.iv) }, k, b64.from(pack.data));
      return JSON.parse(dec.decode(pt));
    } catch (e) {
      throw new Error('Fichier illisible : clé de chiffrement différente de celle de l\'application, ou fichier modifié.');
    }
  }

  /* ---------- conteneur .xlsx ---------- */
  async function dataSheet(XLSX, type, obj) {
    const p = await encryptJSON(obj);
    const n = Math.ceil(p.data.length / CHUNK);
    const rows = [['ORIENRUN', type, 1], ['sel', p.salt], ['iv', p.iv], ['morceaux', n], ['Données chiffrées – ne pas modifier cette feuille.']];
    for (let i = 0; i < n; i++) rows.push([p.data.slice(i * CHUNK, (i + 1) * CHUNK)]);
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 70 }]; return ws;
  }
  // lit la feuille de données : renvoie {type, pack}
  function readPack(XLSX, wb) {
    const ws = wb.Sheets[SHEET];
    if (!ws) throw new Error('Ce fichier n\'est pas un fichier OrienRun.');
    const r = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!r[0] || r[0][0] !== 'ORIENRUN') throw new Error('Ce fichier n\'est pas un fichier OrienRun.');
    const n = +r[3][1]; let data = '';
    for (let i = 0; i < n; i++) { if (!r[5 + i]) throw new Error('Fichier incomplet ou modifié.'); data += r[5 + i][0]; }
    return { type: r[0][1], pack: { salt: r[1][1], iv: r[2][1], data } };
  }
  async function readWorkbook(XLSX, wb, typesOk) {
    const { type, pack } = readPack(XLSX, wb);
    if (typesOk && typesOk.indexOf(type) < 0) throw new Error('Type de fichier inattendu (' + type + ').');
    return { type, data: await decryptJSON(pack) };
  }

  /* ---------- base de balises ---------- */
  function parcoursDetail(base, p) {
    const m = {}; base.balises.forEach(b => m[b.id] = b);
    return (p.balises || []).map(id => m[id]).filter(Boolean);
  }
  function baseForStudents(base) {
    return {
      app: 'orienrun', v: 1, id: base.id, nom: base.nom, maj: new Date().toISOString(), seuilGPS: base.seuilGPS,
      cartes: base.cartes.map(c => ({ id: c.id, numero: c.numero, nom: c.nom, ref: c.ref })),
      balises: base.balises.map(b => ({ id: b.id, couleur: b.couleur, identifiant: b.identifiant, code: b.code, lat: b.lat, lon: b.lon, carteId: b.carteId })),
      parcours: base.parcours.map(p => ({ id: p.id, code: p.code, nom: p.nom, carteId: p.carteId, balises: p.balises.slice() }))
    };
  }
  async function buildBaseWorkbook(XLSX, base, type) { // type : 'BASE' (élèves, sans images) ou 'ADMIN' (sauvegarde complète)
    const payload = type === 'ADMIN' ? base : baseForStudents(base);
    const wb = XLSX.utils.book_new();
    const info = type === 'ADMIN'
      ? ['OrienRun – sauvegarde complète du professeur', 'Fichier chiffré : à réimporter dans OrienRun Admin.']
      : ['OrienRun – base de référence des balises', 'Fichier chiffré : à importer dans l\'application élève. Son contenu n\'est pas lisible.'];
    const ws0 = XLSX.utils.aoa_to_sheet([[info[0]], [info[1]], [], ['Base', base.nom], ['Mise à jour', new Date().toLocaleString('fr-FR')],
    ['Balises', base.balises.length], ['Parcours', base.parcours.length]]);
    ws0['!cols'] = [{ wch: 80 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws0, 'Lisez-moi');
    XLSX.utils.book_append_sheet(wb, await dataSheet(XLSX, type, payload), SHEET);
    return wb;
  }
  function buildBaseReadableWorkbook(XLSX, base) { // sauvegarde lisible pour le professeur
    const cm = {}; base.cartes.forEach(c => cm[c.id] = c);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Couleur', 'Identifiant', 'Code', 'Latitude', 'Longitude', 'Carte']].concat(
      base.balises.map(b => [b.couleur, b.identifiant, b.code, b.lat, b.lon, (cm[b.carteId] || {}).nom || '']))), 'Balises');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['N°', 'Nom', 'Référence']].concat(
      base.cartes.map(c => [c.numero, c.nom, c.ref]))), 'Cartes');
    const rows = [['Code parcours', 'Nom', 'Carte', 'Ordre', 'Identifiant balise', 'Couleur', 'Code balise', 'Latitude', 'Longitude']];
    base.parcours.forEach(p => parcoursDetail(base, p).forEach((b, i) => rows.push([p.code, p.nom, (cm[p.carteId] || {}).nom || '', i + 1, b.identifiant, b.couleur, b.code, b.lat, b.lon])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Parcours');
    return wb;
  }

  /* ---------- fichier de course élève ---------- */
  function identiteTxt(p) { return (p.prenom + ' ' + p.nom).trim() + (p.classe ? ' (' + p.classe + ')' : ''); }
  async function buildRunWorkbook(XLSX, run) {
    const st = statsRun(run), wb = XLSX.utils.book_new();
    const e = run.eleve || {};
    const resume = [
      ['OrienRun – Bilan de course'], [],
      ['Élève', ((e.prenom || '') + ' ' + (e.nom || '')).trim()], ['Classe', e.classe || ''],
      ['Partenaires', (run.partenaires || []).map(identiteTxt).join(', ')], ['Nom du groupe', run.groupe || ''],
      ['Date', run.date || ''], ['Parcours', (run.parcours.code || '') + ' – ' + (run.parcours.nom || '')],
      ['Carte', run.parcours.carteNom || ''], ['Heure de départ', fmtHeure(run.departTs)], ['Heure d\'arrivée', fmtHeure(run.arriveeTs)],
      ['Temps total de course', fmtDur(st.tempsTotal)], ['Temps moyen par balise validée', fmtDur(st.tempsMoyen)],
      ['Balises validées', st.valides + ' / ' + st.total], ['Taux de réussite (%)', st.taux],
      ['Erreurs de code', st.errCode], ['Erreurs de position (> ' + run.seuil + ' m)', st.errPos], ['Balises non pointées', st.nonPointees]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(resume); ws1['!cols'] = [{ wch: 38 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Résumé');
    const head = ['Ordre', 'Identifiant', 'Résultat', 'Mode', 'Code saisi / importé', 'Latitude balise', 'Longitude balise',
      'Latitude élève', 'Longitude élève', 'Précision GPS (m)', 'Distance à la balise (m)', 'Heure', 'Temps depuis le départ', 'Temps sur la balise', 'Essais'];
    const rows = [head].concat((run.balises || []).map((b, i) => {
      const t = (b.essais || []).length > 0, f = b.fix || {};
      return [i + 1, b.identifiant, STATUTS[b.statut] || '', b.mode === 'scan' ? 'Scan QR' : (b.mode === 'saisie' ? 'Saisie' : ''), b.codeSaisi || '',
        t ? b.lat : '', t ? b.lon : '', f.lat != null ? +f.lat.toFixed(6) : '', f.lon != null ? +f.lon.toFixed(6) : '',
        f.acc != null ? Math.round(f.acc) : '', b.distance != null ? +b.distance.toFixed(1) : '',
        fmtHeure(b.ts), b.ts ? fmtDur(b.tempsTot) : '', b.ts ? fmtDur(b.tempsInter) : '', (b.essais || []).length];
    }));
    const ws2 = XLSX.utils.aoa_to_sheet(rows); ws2['!cols'] = head.map((h, i) => ({ wch: i === 2 ? 24 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Balises');
    XLSX.utils.book_append_sheet(wb, await dataSheet(XLSX, 'COURSE', run), SHEET);
    return wb;
  }
  async function readRunWorkbook(XLSX, wb) { return (await readWorkbook(XLSX, wb, ['COURSE'])).data; }

  root.ORUN = {
    CFG, uid, pad, fmtDur, fmtHeure, slug, haversine, pathLength, qrPayload, parseQr, evaluer, STATUTS, statsRun,
    encryptJSON, decryptJSON, readPack, readWorkbook, parcoursDetail, baseForStudents, buildBaseWorkbook,
    buildBaseReadableWorkbook, buildRunWorkbook, readRunWorkbook, identiteTxt
  };
  if (typeof module !== 'undefined') module.exports = root.ORUN;
})(typeof window !== 'undefined' ? window : globalThis);
