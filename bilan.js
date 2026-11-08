// ─────────────────────────────────────────────────────────────────────────────
// BILAN.JS – Page bilan de course
// ─────────────────────────────────────────────────────────────────────────────

function initPageBilan() {
  const container = document.getElementById('page-bilan');
  const d = window.courseData;
  const temps = formatTemps(d.tempsFinal || d.secondesEcoulees);
  const nbBalises = d.balises.length;

  // Calcul score (pourcentage de balises trouvées)
  const score = Math.round((nbBalises / 20) * 100);

  container.innerHTML = `
  <style>
    #page-bilan {
      min-height: 100vh;
      position: relative;
      z-index: 1;
      padding-bottom: 30px;
    }

    .pb-header {
      padding: 18px 20px 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .pb-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.5rem;
      letter-spacing: 0.15em;
      color: #FFD600;
      text-shadow: 0 0 15px rgba(255,214,0,0.4);
    }

    .pb-badge {
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      background: rgba(255,214,0,0.12);
      border: 1px solid rgba(255,214,0,0.3);
      border-radius: 20px;
      padding: 4px 12px;
      color: #FFD600;
    }

    .pb-card {
      margin: 0 10px;
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 2px solid rgba(255,214,0,0.35);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }

    /* Score hero */
    .score-hero {
      text-align: center;
      padding: 16px 0 8px;
      margin-bottom: 16px;
      background: linear-gradient(135deg, rgba(255,107,0,0.1), rgba(255,214,0,0.08));
      border-radius: 12px;
      border: 1px solid rgba(255,107,0,0.2);
    }

    .score-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 4rem;
      background: linear-gradient(135deg, #FF6B00, #FFD600);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
    }

    .score-label {
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.4);
      margin-top: 4px;
    }

    /* Summary stats */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }

    .stat-box {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 12px;
      text-align: center;
    }

    .stat-box-label {
      font-size: 0.65rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,171,0,0.6);
      margin-bottom: 5px;
    }

    .stat-box-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.5rem;
      color: #FFD600;
    }

    /* Info coureur */
    .coureur-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.82rem;
      color: rgba(255,255,255,0.5);
      padding: 8px 0 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 14px;
      gap: 8px;
      flex-wrap: wrap;
    }

    .coureur-info span {
      background: rgba(255,255,255,0.04);
      padding: 3px 10px;
      border-radius: 20px;
      white-space: nowrap;
    }

    /* Table */
    .pb-table-wrap {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      margin-bottom: 14px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }

    thead tr {
      background: rgba(255,171,0,0.12);
    }

    thead th {
      padding: 10px 8px;
      font-size: 0.65rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,171,0,0.8);
      font-weight: 600;
      text-align: left;
      border-bottom: 1px solid rgba(255,171,0,0.15);
    }

    tbody tr {
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.15s;
    }

    tbody tr:hover { background: rgba(255,255,255,0.03); }
    tbody tr:last-child { border-bottom: none; }

    tbody td {
      padding: 9px 8px;
      color: #e0e0e0;
      vertical-align: middle;
    }

    .td-num {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.1rem;
      color: #FFD600;
      text-align: center;
      width: 36px;
    }

    .td-temps {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1rem;
      color: #FF6B00;
    }

    .td-gps {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.5);
    }

    .td-qr {
      font-size: 0.72rem;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty-table {
      text-align: center;
      padding: 24px;
      color: rgba(255,255,255,0.25);
      font-style: italic;
    }

    /* Divider */
    .pb-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,214,0,0.25), transparent);
      margin: 14px 0;
    }

    /* Export button */
    .btn-export {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #FF6B00, #FFD600);
      border: none;
      border-radius: 12px;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.3rem;
      letter-spacing: 0.1em;
      color: #000;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(255,107,0,0.4);
      transition: transform 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-export:active { transform: scale(0.97); }

    .eps-box { margin-bottom: 12px; text-align: center; }
    .eps-statut { font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: rgba(255,255,255,0.7); }
    .eps-statut.ok { color: #7CFC9A; } .eps-statut.err { color: #ff8a80; }
    .btn-eps { width: 100%; padding: 12px; border-radius: 12px; border: 1.5px solid rgba(255,214,0,0.5); background: rgba(255,214,0,0.08);
      color: #FFD600; font-family: 'Exo 2', sans-serif; font-weight: 700; font-size: 0.95rem; cursor: pointer; }
    .btn-eps:disabled { opacity: .45; cursor: default; }
    /* Nouvelle course */
    .btn-new {
      width: 100%;
      margin-top: 10px;
      padding: 13px;
      background: transparent;
      border: 1.5px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      font-family: 'Exo 2', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-new:hover {
      border-color: rgba(255,255,255,0.3);
      color: rgba(255,255,255,0.8);
    }

    /* Score bar */
    .score-bar-wrap {
      margin: 10px 0 0;
    }

    .score-bar-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: rgba(255,255,255,0.35);
      margin-bottom: 5px;
    }

    .score-bar-track {
      height: 8px;
      background: rgba(255,255,255,0.08);
      border-radius: 4px;
      overflow: hidden;
    }

    .score-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, #FF6B00, #FFD600);
      transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 0 10px rgba(255,107,0,0.4);
    }

    /* Carte Leaflet */
    .carte-section {
      margin: 0 10px 14px;
      border: 2px solid rgba(255,214,0,0.35);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .carte-header {
      background: rgba(0,0,0,0.5);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .carte-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.1rem;
      letter-spacing: .1em;
      color: #FFD600;
    }
    .carte-legende {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .leg-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: .7rem;
      color: rgba(255,255,255,.6);
    }
    .leg-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    #carteTrace {
      width: 100%;
      height: 320px;
    }
    /* Surcharger le z-index Leaflet pour qu'il reste sous nos overlays */
    .leaflet-pane { z-index: 1 !important; }
    .leaflet-top, .leaflet-bottom { z-index: 2 !important; }
  </style>

  <div class="pb-header">
    <div class="pb-title">🏆 BILAN DE COURSE</div>
    <div class="pb-badge">Terminée</div>
  </div>

  <!-- CARTE DE TRACE -->
  <div class="carte-section">
    <div class="carte-header">
      <div class="carte-title">🗺️ TRACE DU PARCOURS</div>
      <div class="carte-legende">
        <div class="leg-item"><div class="leg-dot" style="background:#FF6B00"></div>Trace</div>
        <div class="leg-item"><div class="leg-dot" style="background:#00ff88"></div>Départ</div>
        <div class="leg-item"><div class="leg-dot" style="background:#FFD600"></div>Arrivée</div>
        <div class="leg-item"><div class="leg-dot" style="background:#f9a825"></div>Jaune ✅</div>
        <div class="leg-item"><div class="leg-dot" style="background:#42a5f5"></div>Bleue ✅</div>
        <div class="leg-item"><div class="leg-dot" style="background:#ef5350"></div>Rouge ✅</div>
        <div class="leg-item"><div class="leg-dot" style="background:rgba(255,255,255,.25);border:1px dashed rgba(255,255,255,.4)"></div>Non trouvée</div>
      </div>
    </div>
    <div id="carteTrace"></div>
  </div>

  <div class="pb-card">

    <!-- Infos coureur -->
    <div class="coureur-info">
      <span>👤 ${d.nom}</span>
      <span>📅 ${d.date}</span>
      <span>🗺️ ${d.parcours}</span>
    </div>

    <!-- Score hero -->
    <div class="score-hero">
      <div class="score-value">${score}%</div>
      <div class="score-label">Taux de réussite</div>
      <div class="score-bar-wrap" style="padding:0 16px;">
        <div class="score-bar-track">
          <div class="score-bar-fill" id="scoreBarFill" style="width:0%"></div>
        </div>
        <div class="score-bar-label"><span>0%</span><span>100%</span></div>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-box-label">⏱ Temps Total</div>
        <div class="stat-box-value">${temps}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">🚩 Balises Trouvées</div>
        <div class="stat-box-value">${nbBalises}/20</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">⏱ Moy. / Balise</div>
        <div class="stat-box-value">${nbBalises > 0 ? formatTemps(Math.round((d.tempsFinal || d.secondesEcoulees) / nbBalises)) : '—'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">📋 Parcours</div>
        <div class="stat-box-value" style="font-size:1rem;">${d.parcours}</div>
      </div>
    </div>

    <div class="pb-divider"></div>

    <!-- Tableau des balises -->
    <div class="pb-table-wrap">
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Code balise</th>
            <th>Temps inter.</th>
            <th>Position GPS</th>
          </tr>
        </thead>
        <tbody id="bilanTableBody">
          ${d.balises.length === 0
            ? `<tr><td colspan="4" class="empty-table">Aucune balise enregistrée</td></tr>`
            : d.balises.map(b => {
                const couleurDot = b.couleur === 'Jaune' ? '#f9a825'
                                 : b.couleur === 'Bleu'  ? '#42a5f5'
                                 : b.couleur === 'Rouge' ? '#ef5350'
                                 : '#FFD600';
                // Correction : distance entre GPS élève et GPS balise
                let distInfo = '';
                if (b.baliseLat && b.baliseLon && b.lat !== '—' && b.lon !== '—') {
                  const dist = Math.round(haversine(
                    parseFloat(b.lat), parseFloat(b.lon),
                    b.baliseLat, b.baliseLon
                  ));
                  const ok = dist <= 30;
                  distInfo = `<br/><span style="font-size:.7rem;color:${ok?'#00ff88':'#ff7070'}">${ok?'✅':'⚠️'} ${dist}m de la balise</span>`;
                }
                return `<tr>
                  <td class="td-num">${String(b.numero).padStart(2,'0')}</td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:5px;">
                      <span style="width:8px;height:8px;border-radius:50%;background:${couleurDot};flex-shrink:0;"></span>
                      <strong style="font-family:monospace;font-size:.9rem;color:${couleurDot}">${b.identifiant || b.qr}</strong>
                    </span>
                  </td>
                  <td class="td-temps">${formatTemps(b.tempsInter)}</td>
                  <td class="td-gps">${b.lat},<br/>${b.lon}
                    ${b.precision !== null && b.precision !== undefined ? `<br/><span style="font-size:.68rem;color:rgba(255,255,255,.3)">±${b.precision}m</span>` : ''}
                    ${distInfo}</td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>
    </div>

    <div class="pb-divider"></div>

    <!-- Mes Apps EPS -->
    <div class="eps-box">
      <div id="epsStatut" class="eps-statut"></div>
      <button class="btn-eps" id="btnEps" onclick="sauvegarderEPS()">💾 Enregistrer sur cet appareil</button>
    </div>

    <button class="btn-eps" id="btnEff" onclick="effacerDonneesOrienRun()" style="margin-bottom:8px;border-color:rgba(255,80,80,.6);background:rgba(255,80,80,.08)">🗑 Effacer mes données OrienRun</button>

    <!-- Export XLSX au format Mes Apps EPS -->
    <button class="btn-export" onclick="exportXLSX()">
      📥 EXPORTER MES RÉSULTATS (.XLSX)
    </button>
    <button class="btn-new" onclick="exportCSV()">
      Détail des balises et GPS (.csv)
    </button>

    <!-- Nouvelle course -->
    <button class="btn-new" onclick="nouvelleCourse()">
      🔄 Nouvelle course
    </button>

  </div>
  `;

  majStatutEPS();

  // Animer la barre de score
  setTimeout(() => {
    const fill = document.getElementById('scoreBarFill');
    if (fill) fill.style.width = score + '%';
  }, 200);

  // Initialiser la carte après rendu DOM (300ms pour laisser Leaflet le temps)
  setTimeout(() => initCarte(), 300);
}

// ─── Haversine : distance en mètres entre 2 points GPS ────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── Carte Leaflet – trace + balises ──────────────────────────────────────
async function initCarte() {
  const d       = window.courseData;
  const trace   = d.trace   || [];
  const balises = d.balises || [];

  const el = document.getElementById('carteTrace');
  if (!el) return;

  // Aucune donnée GPS
  if (trace.length === 0 && balises.length === 0) {
    el.innerHTML = '<div style="height:320px;display:flex;align-items:center;justify-content:center;' +
      'color:rgba(255,255,255,.3);font-family:\'Exo 2\',sans-serif;font-size:.9rem;">' +
      'Aucune donnée GPS enregistrée</div>';
    return;
  }

  // Charger Leaflet si absent
  if (!window.L) {
    await new Promise(function(res, rej) {
      var lnk  = document.createElement('link');
      lnk.rel  = 'stylesheet';
      lnk.href = 'vendor/leaflet.css';
      document.head.appendChild(lnk);
      var s    = document.createElement('script');
      s.src    = 'vendor/leaflet.js';
      s.onload  = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  var L = window.L;

  // Détruire carte existante
  if (window._carteLeaflet) {
    window._carteLeaflet.remove();
    window._carteLeaflet = null;
  }

  // Points pour le fitBounds
  var tousPoints = [];
  trace.forEach(function(p)   { tousPoints.push([p.lat, p.lon]); });
  balises.forEach(function(b) {
    if (b.lat !== '—' && b.lon !== '—') tousPoints.push([parseFloat(b.lat), parseFloat(b.lon)]);
  });
  if (tousPoints.length === 0) {
    el.innerHTML = '<div style="height:320px;display:flex;align-items:center;justify-content:center;' +
      'color:rgba(255,255,255,.3);font-family:\'Exo 2\',sans-serif;font-size:.9rem;">' +
      'GPS non disponible pendant la course</div>';
    return;
  }

  var map = L.map(el, { zoomControl: true, attributionControl: false });
  window._carteLeaflet = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    opacity: 0.9
  }).addTo(map);

  // ── Trace GPS (polyligne orange) ─────────────────────────────────────
  if (trace.length >= 2) {
    var latlngs = trace.map(function(p) { return [p.lat, p.lon]; });
    L.polyline(latlngs, {
      color: '#FF6B00', weight: 4, opacity: 0.9,
      lineJoin: 'round', lineCap: 'round'
    }).addTo(map);

    // Départ
    L.marker(latlngs[0], { icon: mkIcon('#00ff88', '🚀', 18) })
      .bindPopup('<b>🟢 Départ</b>').addTo(map);

    // Arrivée
    L.marker(latlngs[latlngs.length - 1], { icon: mkIcon('#FFD600', '🏁', 18) })
      .bindPopup('<b>🏁 Arrivée</b>').addTo(map);
  }

  // ── Balises trouvées ─────────────────────────────────────────────────
  balises.forEach(function(b, idx) {
    if (b.lat === '—' || b.lon === '—') return;
    var c = b.couleur === 'Jaune' ? '#f9a825'
          : b.couleur === 'Bleu'  ? '#42a5f5'
          : b.couleur === 'Rouge' ? '#ef5350'
          : '#FFD600';
    var label = String(idx + 1).padStart(2, '0');
    var accTxt = (b.precision != null) ? ('<br/>GPS ±' + b.precision + 'm') : '';
    var popup  = '<b style="color:' + c + '">' + (b.identifiant || b.qr) + '</b>' +
                 '<br/>N°' + String(b.numero).padStart(2,'0') +
                 '<br/>' + formatTemps(b.tempsInter) + accTxt;
    L.marker([parseFloat(b.lat), parseFloat(b.lon)], { icon: mkIconNum(c, label) })
      .bindPopup(popup).addTo(map);
  });

  // ── Ajuster le zoom ───────────────────────────────────────────────────
  try {
    map.fitBounds(L.latLngBounds(tousPoints), { padding: [24, 24] });
  } catch(e) {
    map.setView(tousPoints[0], 17);
  }
}

// ── Fabrique d'icônes rondes simples ──────────────────────────────────────
function mkIcon(bg, emoji, size) {
  return window.L.divIcon({
    className: '',
    html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
          'background:' + bg + ';border:2px solid #fff;' +
          'box-shadow:0 0 6px ' + bg + ';' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:' + Math.round(size * 0.55) + 'px;box-sizing:border-box;">' +
          '</div>',
    iconSize:   [size, size],
    iconAnchor: [size/2, size/2]
  });
}

function mkIconNum(bg, label) {
  return window.L.divIcon({
    className: '',
    html: '<div style="width:24px;height:24px;border-radius:50%;' +
          'background:' + bg + ';border:2px solid #fff;' +
          'box-shadow:0 0 6px ' + bg + ';' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-family:\'Bebas Neue\',sans-serif;font-size:10px;color:#000;' +
          'box-sizing:border-box;">' + label + '</div>',
    iconSize:   [24, 24],
    iconAnchor: [12, 12]
  });
}

// ─── Export CSV ─────────────────────────────────────────────────────────────
function exportCSV() {
  const d = window.courseData;
  const sep = ';';

  let csv = '\uFEFF'; // BOM UTF-8
  csv += `BILAN DE COURSE – OrienRun\n`;
  csv += `Coureur/Équipe${sep}${d.nom}\n`;
  csv += `Date${sep}${d.date}\n`;
  csv += `Parcours${sep}${d.parcours}\n`;
  csv += `Temps Total${sep}${formatTemps(d.tempsFinal || d.secondesEcoulees)}\n`;
  csv += `Balises Trouvées${sep}${d.balises.length}/20\n`;
  csv += `\n`;
  csv += `N° Balise${sep}Code${sep}Couleur${sep}Temps Total${sep}Temps Intermédiaire${sep}Latitude élève${sep}Longitude élève${sep}Précision GPS (m)${sep}Distance balise (m)\n`;

  d.balises.forEach(b => {
    let dist = '';
    if (b.baliseLat && b.baliseLon && b.lat !== '—' && b.lon !== '—') {
      dist = Math.round(haversine(parseFloat(b.lat), parseFloat(b.lon), b.baliseLat, b.baliseLon));
    }
    csv += [
      String(b.numero).padStart(2,'0'),
      b.identifiant || b.qr,
      b.couleur || '',
      formatTemps(b.tempsTot),
      formatTemps(b.tempsInter),
      b.lat,
      b.lon,
      b.precision !== null && b.precision !== undefined ? b.precision : '',
      dist
    ].join(sep) + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const filename = `orientrun_${d.nom.replace(/\s+/g,'_')}_${d.date}.csv`;
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Statut de l'enregistrement dans Mes Apps EPS ──────────────────────────
function majStatutEPS() {
  const el = document.getElementById('epsStatut'), btn = document.getElementById('btnEps'), d = window.courseData;
  if (!el) return;
  el.className = 'eps-statut';
  if (d.epsEtat === 'ok') { el.classList.add('ok'); el.textContent = '✅ Course enregistrée sur cet appareil. Exporte le fichier .xlsx pour le remettre à ton professeur.'; }
  else if (d.epsEtat === 'libre') { el.textContent = "ℹ️ Course sans identification : rien n'est enregistré. Identifie-toi sur le portail Applis EPS Élèves avant le départ pour enregistrer et exporter."; if (btn) btn.disabled = true; }
  else if (d.epsEtat === 'err') { el.classList.add('err'); el.textContent = '⚠️ Enregistrement impossible : touche le bouton pour réessayer.'; }
  else el.textContent = '⏳ Enregistrement…';
}

// ─── Export .xlsx de l'élève (feuille « orienrun » en mode lignes, sans liste d'élèves) : à remettre au professeur ──
async function exportXLSX() {
  const d = window.courseData, ids = d.eleveIds || [], el = document.getElementById('epsStatut');
  if (!ids.length) { if (el) { el.className = 'eps-statut err'; el.textContent = '⚠️ Export .xlsx impossible : identifie-toi sur le portail avant le départ. Le CSV détaillé reste disponible.'; } return; }
  try {
    await sauvegarderEPS(); // la course est dans la base avant l'export
    const octets = await EPS.exportXLSX({ ids, apps: ['orienrun'], sansEleves: true });
    EPS.downloadXLSX(octets, 'OrienRun_' + d.date + '_' + String(d.parcours).replace(/\s+/g, '_') + '.xlsx');
  } catch (err) {
    console.warn(err);
    if (el) { el.className = 'eps-statut err'; el.textContent = '⚠️ Export .xlsx impossible : ' + err.message; }
  }
}

// ─── Nouvelle course ─────────────────────────────────────────────────────────
function nouvelleCourse() {
  if (!confirm('Démarrer une nouvelle course ?\nLes données actuelles seront perdues si non exportées.')) return;

  // Reset
  window.courseData = {
    nom: '', date: '', parcours: '',
    heureDepart: null, chronometre: null,
    secondesEcoulees: 0, balises: [],
    baliseCourante: 1, dernierTemps: 0
  };

  window.courseData.epsEtat = undefined;
  document.getElementById('page-bilan').style.display  = 'none';
  document.getElementById('page-course').style.display = 'none';
  document.getElementById('page-accueil').style.display = 'block';

  // Reset form
  document.getElementById('nomCoureur').value = '';
  if (window.resetEleves) window.resetEleves();
  document.getElementById('parcours').value   = '';
  document.getElementById('chronoAccueil').style.display = 'none';
  document.getElementById('chronoAccueilTime').textContent = '00:00:00';
}

window.initPageBilan  = initPageBilan;
window.exportCSV      = exportCSV;
window.exportXLSX     = exportXLSX;
window.majStatutEPS   = majStatutEPS;
async function effacerDonneesOrienRun() {
  const e = await ELEVE.courant();
  if (!e) { alert("Tu n'es pas identifié : aucune donnée n'est enregistrée sur cet appareil."); return; }
  if (!confirm("⚠ As-tu pensé à exporter tes résultats (.xlsx) avant d'effacer ?\n\nToutes tes courses OrienRun enregistrées sur cet appareil seront supprimées définitivement.")) return;
  const ok = await ELEVE.effacerApp('orienrun');
  alert(ok ? 'Tes données OrienRun ont été effacées.' : "Aucune donnée OrienRun à effacer.");
}
window.effacerDonneesOrienRun = effacerDonneesOrienRun;
window.nouvelleCourse = nouvelleCourse;
