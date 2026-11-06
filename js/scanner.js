/* Scanner de QR code : caméra en direct (BarcodeDetector si présent, sinon jsQR local) + secours par photo.
   Un bandeau de diagnostic indique ce qui se passe (résolution, décodeur, images analysées). */
(function (root) {
  'use strict';
  let stream = null, timer = null, running = false, overlay = null;

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function stop() {
    running = false; clearTimeout(timer);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function decodeCanvas(ctx, w, h, both) {
    const img = ctx.getImageData(0, 0, w, h);
    let r = root.jsQR && root.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    if (!r && both && root.jsQR) r = root.jsQR(img.data, w, h, { inversionAttempts: 'onlyInvert' });
    return r ? r.data : null;
  }

  // Décode une image (photo) : essaie plusieurs tailles
  async function decodePhoto(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { bmp = await createImageBitmap(file); }
    const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
    for (const maxS of [1000, 1600, 600, 2200]) {
      const k = Math.min(1, maxS / Math.max(bmp.width, bmp.height));
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      if ('BarcodeDetector' in root) {
        try { const r = await new root.BarcodeDetector({ formats: ['qr_code'] }).detect(c); if (r && r[0]) return r[0].rawValue; } catch (e) { }
      }
      const t = decodeCanvas(ctx, c.width, c.height, true);
      if (t) return t;
    }
    return null;
  }

  /* open({ accept(text) -> bool|object, onFound(text), onCancel(), onManual() }) */
  function open(opt) {
    stop();
    overlay = el('div'); overlay.id = 'scanOv';
    const video = el('video'); video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.autoplay = true;
    const hud = el('div', 'scanHud');
    const title = el('div', 'scanTitle', 'Scanner le code');
    const frame = el('div', 'scanFrame');
    const diag = el('div', 'scanDiag', 'Démarrage de la caméra…');
    const btns = el('div', 'scanBtns');
    const bPhoto = el('label', 'btn sec sm', '📷 Prendre une photo');
    const fin = el('input'); fin.type = 'file'; fin.accept = 'image/*'; fin.setAttribute('capture', 'environment'); fin.hidden = true; bPhoto.appendChild(fin);
    const bMan = el('button', 'btn sec sm', '⌨️ Saisir le code'); const bX = el('button', 'btn dng sm', '✕ Fermer');
    btns.append(bPhoto, bMan, bX);
    hud.append(title, frame, el('div'), diag, btns);
    // le 3e élément (vide) sert d'espaceur
    hud.children[2].style.flex = '1';
    overlay.append(video, hud); document.body.appendChild(overlay);

    let done = false, frames = 0, hits = 0, info = '';
    const found = txt => {
      const ok = opt.accept ? opt.accept(txt) : true;
      if (!ok) { hits++; diag.textContent = 'QR détecté mais ce n\'est pas un code OrienRun.'; return false; }
      if (done) return true; done = true; stop(); opt.onFound(txt); return true;
    };
    bX.onclick = () => { done = true; stop(); opt.onCancel && opt.onCancel(); };
    bMan.onclick = () => { done = true; stop(); opt.onManual && opt.onManual(); };
    fin.onchange = async () => {
      const f = fin.files && fin.files[0]; if (!f) return;
      diag.textContent = 'Analyse de la photo…';
      try { const t = await decodePhoto(f); if (t) found(t); else diag.textContent = 'Aucun QR code lu sur la photo. Rapproche-toi, évite les reflets, ou saisis le code.'; }
      catch (e) { diag.textContent = 'Photo illisible : ' + e.message; }
      fin.value = '';
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      diag.textContent = 'Caméra en direct indisponible sur ce navigateur (HTTPS requis). Utilise la photo ou saisis le code.'; return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(s => {
        if (done) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s; video.srcObject = s;
        const p = video.play(); if (p && p.catch) p.catch(() => { });
        running = true;
        const bd = ('BarcodeDetector' in root) ? new root.BarcodeDetector({ formats: ['qr_code'] }) : null;
        const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
        const tick = async () => {
          if (!running) return;
          if (video.readyState >= 2 && video.videoWidth) {
            const k = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
            cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
            ctx.drawImage(video, 0, 0, cv.width, cv.height);
            frames++;
            let txt = null;
            try {
              if (bd) { const r = await bd.detect(cv); if (r && r[0]) txt = r[0].rawValue; }
              if (!txt && root.jsQR) txt = decodeCanvas(ctx, cv.width, cv.height, frames % 3 === 0);
            } catch (e) { }
            info = video.videoWidth + '×' + video.videoHeight + ' · ' + (bd ? 'détecteur natif + jsQR' : 'jsQR') + ' · ' + frames + ' images';
            if (txt) { if (found(txt)) return; }
            else if (!hits) diag.textContent = info;
          } else diag.textContent = 'En attente de l\'image de la caméra…';
          timer = setTimeout(tick, 120);
        };
        tick();
      })
      .catch(e => { diag.textContent = 'Caméra refusée ou indisponible (' + (e.name || e.message) + '). Autorise la caméra, ou utilise la photo / saisis le code.'; });
  }

  root.ORUN_SCAN = { open, stop, decodePhoto };
})(window);
