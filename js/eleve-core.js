/* eleve-core.js v1.1 — identification manuelle de l'élève pour toutes les « Applis pour les élèves ».
   Nécessite eps-core.js (v2.2) chargé avant. 100 % local (RGPD) : base IndexedDB « EPSEleves », distincte de celle du professeur.
   L'élève saisit nom, prénom et classe (ou ne s'identifie pas) : AUCUNE liste d'élèves n'est importée.
   Une seule identification pour toutes les applis élèves du même domaine (le portail la mémorise).

   API (toutes asynchrones) :
     ELEVE.courant()                       → {id,nom,prenom,classe} ou null (non identifié)
     ELEVE.demander()                      → ouvre la fenêtre d'identification si besoin ; résout l'élève, ou null si « sans m'identifier »
     ELEVE.definir({nom,prenom,classe})    → identifie l'élève (sans fenêtre)
     ELEVE.enregistrer(appId, ligne)       → ajoute une saisie datée {Date:'AAAA-MM-JJ',…} ; false si non identifié (rien n'est sauvegardé)
     ELEVE.enregistrerChamps(appId, obj)   → mode « colonnes » (une saisie par élève) ; false si non identifié
     ELEVE.donnees()                       → {appId:[saisies]} de l'élève courant
     ELEVE.exporter([appIds])              → télécharge le .xlsx de l'élève (à remettre au professeur)
     ELEVE.bandeau(element)                → affiche « 👤 Prénom NOM · classe » avec bouton Modifier
     ELEVE.importer(file)                  → (portail) restaure une sauvegarde .xlsx de l'élève : crée l'élève et ses saisies, l'identifie ; retourne {eleve,apps}
     ELEVE.effacerApp(appId)               → efface les saisies de l'élève courant pour UNE application (bouton « Effacer » des applis)
     ELEVE.changer() / ELEVE.supprimer()   → oublie l'élève courant / efface ses données sur cet appareil */
(function(){
EPS.useDB('EPSEleves');
const K='EPS_ELEVE_COURANT',KA='EPS_ELEVE_SANS_ID';let mem={};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return mem[k]||null}};
const lsSet=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){mem[k]=v}};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pub=e=>e?{id:e.id,nom:e.nom,prenom:e.prenom,classe:e.classe}:null;
const ELEVE={
 async courant(){const id=lsGet(K);if(!id)return null;return pub((await EPS.all()).find(e=>e.id===id))},
 sansIdentification(){return lsGet(KA)==='1'},
 async definir(x){const nom=(x.nom||'').trim(),prenom=(x.prenom||'').trim();if(!nom||!prenom)throw new Error('Nom et prénom obligatoires.');
  const e=await EPS.putEleve({nom,prenom,classe:(x.classe||'').trim()});lsSet(K,e.id);lsSet(KA,null);document.dispatchEvent(new Event('eleve-change'));return pub(e)},
 changer(){lsSet(K,null);lsSet(KA,null);document.dispatchEvent(new Event('eleve-change'))},
 async supprimer(){const id=lsGet(K);if(id){const d=await EPS.open();await new Promise((ok,ko)=>{const t=d.transaction('eleves','readwrite');t.objectStore('eleves').delete(id);t.oncomplete=ok;t.onerror=()=>ko(t.error)})}ELEVE.changer()},
 async enregistrer(appId,ligne){const e=await ELEVE.courant();if(!e)return false;await EPS.addLigne(appId,e.id,ligne);return true},
 async enregistrerChamps(appId,obj){const e=await ELEVE.courant();if(!e)return false;await EPS.setExt(appId,e.id,obj);return true},
 async donnees(){const e=await ELEVE.courant();if(!e)return{};const r=(await EPS.all()).find(x=>x.id===e.id)||{},out={};
  for(const a in r.ext||{}){const d=r.ext[a];out[a]=Array.isArray(d.lignes)?d.lignes:Object.keys(d).length?[d]:[]}return out},
 async exporter(appIds){const e=await ELEVE.courant();if(!e)throw new Error("Identifie-toi d'abord.");
  const o=await EPS.exportXLSX({ids:[e.id],apps:appIds,sansEleves:!!(appIds&&appIds.length)});
  EPS.downloadXLSX(o,'Mes_donnees_EPS_'+e.nom.replace(/[^\w-]+/g,'_')+'_'+e.prenom.replace(/[^\w-]+/g,'_')+'.xlsx')},
 async importer(file){const r=await EPS.importXLSX(await file.arrayBuffer(),file.name,{creer:true});
  if(!r.ids.length)throw new Error("Aucun élève ni aucune saisie reconnus dans ce fichier (fichier issu d'Applis EPS Élèves attendu).");
  lsSet(K,r.ids[0]);lsSet(KA,null);document.dispatchEvent(new Event('eleve-change'));return{eleve:await ELEVE.courant(),apps:r.apps,multi:r.ids.length>1}},
 async effacerApp(appId){const id=lsGet(K);if(!id)return false;const e=(await EPS.all()).find(x=>x.id===id);if(!e||!e.ext||!e.ext[appId])return false;
  delete e.ext[appId];const d=await EPS.open();await new Promise((ok,ko)=>{const t=d.transaction('eleves','readwrite');t.objectStore('eleves').put(e);t.oncomplete=ok;t.onerror=()=>ko(t.error)});document.dispatchEvent(new Event('eleve-change'));return true},
 demander(){return new Promise(async res=>{const cur=await ELEVE.courant();if(cur||ELEVE.sansIdentification())return res(cur);
  const ov=document.createElement('div');ov.setAttribute('style','position:fixed;inset:0;z-index:9999;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif');
  ov.innerHTML=`<form style="background:#fff;color:#1b2a49;border-radius:22px;padding:22px;max-width:380px;width:100%;box-shadow:0 10px 30px #0006">
   <h2 style="margin:0 0 6px">👤 Qui es-tu ?</h2><p style="margin:0 0 12px;font-size:.85rem;opacity:.8">Ton nom, ton prénom et ta classe servent à enregistrer tes résultats sur cet appareil. Ils ne sont envoyés nulle part.</p>
   ${[['nom','Nom','family-name'],['prenom','Prénom','given-name'],['classe','Classe (ex. 3PM)','off']].map(([n,l,a])=>`<label style="display:block;font-weight:700;margin:8px 0">${l}<input name="${n}" autocomplete="${a}" ${n!=='classe'?'required':''} style="display:block;width:100%;margin-top:4px;padding:10px;border-radius:12px;border:2px solid #0b4fd033;font-size:1rem"></label>`).join('')}
   <div id="em" style="color:#c0392b;font-weight:700;min-height:1.2em"></div>
   <button style="width:100%;border:0;border-radius:14px;padding:12px;font-weight:800;color:#fff;font-size:1rem;background:linear-gradient(#1f8bff,#0040d0);cursor:pointer">✅ Valider</button>
   <button type="button" id="sx" style="width:100%;margin-top:8px;border:0;border-radius:14px;padding:11px;font-weight:700;color:#fff;background:linear-gradient(#9aa4b5,#6b7587);cursor:pointer">Continuer sans m'identifier (rien ne sera enregistré)</button></form>`;
  document.body.appendChild(ov);const f=ov.querySelector('form');
  f.onsubmit=async ev=>{ev.preventDefault();try{const e=await ELEVE.definir({nom:f.nom.value,prenom:f.prenom.value,classe:f.classe.value});ov.remove();res(e)}catch(x){ov.querySelector('#em').textContent=x.message}};
  ov.querySelector('#sx').onclick=()=>{lsSet(KA,'1');ov.remove();res(null)}})},
 async bandeau(el){const draw=async()=>{const e=await ELEVE.courant();
   el.innerHTML=e?`👤 <b>${esc(e.prenom)} ${esc(e.nom.toUpperCase())}</b>${e.classe?' · '+esc(e.classe):''} <button type="button" style="margin-left:8px;border:0;border-radius:10px;padding:4px 10px;cursor:pointer">Modifier</button>`
    :`👤 Non identifié (rien n'est enregistré) <button type="button" style="margin-left:8px;border:0;border-radius:10px;padding:4px 10px;cursor:pointer">S'identifier</button>`;
   el.querySelector('button').onclick=async()=>{ELEVE.changer();await ELEVE.demander();draw()}};
  document.addEventListener('eleve-change',draw);draw()}
};
window.ELEVE=ELEVE})();
