/* eps-core.js v2.3 — base de données élèves partagée (IndexedDB "MesAppsEPS"), 100 % locale (RGPD).
   Import : CSV Pronote, CSV/XLSX Mes Apps EPS.  Export : XLSX multi-feuilles (une feuille par application).
   Données d'une application : EPS.setExt(appId, eleveId, {champ:valeur,...})
     - mode « colonnes » : une ligne par élève, une colonne par champ
     - mode « lignes »   : champ spécial  lignes:[{col:val,...},...]  → une ligne par enregistrement (ex. un test)
   v2.1 : EPS.addLigne(appId,eleveId,ligne) ajoute un enregistrement daté sans doublon ; EPS.exportXLSX({ids,apps}) exporte un sous-ensemble ;
          EPS.downloadXLSX(octets,nomFichier) déclenche le téléchargement.
   v2.3 : importXLSX(buf,nom,{creer:true}) crée les élèves absents (portail élèves : restauration d'une sauvegarde) ; {ignorerEleves:true} ignore la feuille « Élèves » (portail prof : fichier d'élève) ; retourne aussi ids.
   v2.2 : EPS.useDB(nom) choisit une autre base locale (portail élèves : « EPSEleves », à appeler avant tout autre appel) ;
          EPS.putEleve({nom,prenom,classe}) crée/met à jour un élève ; exportXLSX({sansEleves:true}) omet la feuille « Élèves » ;
          l'import XLSX rattache une feuille d'application à un élève par Nom + Prénom (+ Classe) quand la colonne « Né(e) le » est absente. */
(function(){
let DB='MesAppsEPS',_db;
const open=()=>_db?Promise.resolve(_db):new Promise((ok,ko)=>{const r=indexedDB.open(DB,1);
 r.onupgradeneeded=()=>{r.result.createObjectStore('eleves',{keyPath:'id'});r.result.createObjectStore('meta',{keyPath:'k'})};
 r.onsuccess=()=>ok(_db=r.result);r.onerror=()=>ko(r.error)});
const tx=async(s,m,f)=>{const d=await open();return new Promise((ok,ko)=>{const t=d.transaction(s,m),o=t.objectStore(s);const q=f(o);t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>ko(t.error)})};
const norm=s=>(s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const makeId=e=>norm(e.nom)+'_'+norm(e.prenom)+'_'+norm(e.naissance);
function parseCSV(t){t=t.replace(/^\uFEFF/,'');const f=t.split('\n')[0];const d=[';',',','\t'].sort((a,b)=>f.split(b).length-f.split(a).length)[0];
 const rows=[];let r=[],c='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];
  if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}
  else if(ch=='"')q=true;else if(ch==d){r.push(c);c=''}
  else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;r.push(c);rows.push(r);r=[];c=''}else c+=ch}
 if(c||r.length){r.push(c);rows.push(r)}
 return{delim:d,rows:rows.filter(x=>x.some(v=>v.trim()))}}
async function decode(file){const b=await file.arrayBuffer();try{return new TextDecoder('utf-8',{fatal:true}).decode(b)}catch(e){return new TextDecoder('windows-1252').decode(b)}}
const MAP={nom:['nom','nomeleve','eleves','eleve'],prenom:['prenom','prenoms','prenomeleve'],naissance:['neele','nele','naissance','datedenaissance','nele'],classe:['classe','classederattachement','division'],regime:['regime']};
function findCol(h,k){const n=h.map(norm);for(const a of MAP[k]){const i=n.indexOf(a);if(i>=0)return i}
 return n.findIndex(x=>MAP[k].some(a=>x.startsWith(a)))}
/* Pronote : colonne unique « NOM Prénom » → NOM = mots sans minuscule, Prénom = le reste */
const splitName=v=>{const w=v.trim().split(/\s+/);let i=0;while(i<w.length-1&&w[i]===w[i].toUpperCase()&&!/[a-zà-ÿ]/.test(w[i]))i++;
 if(i===0)i=1;return[w.slice(0,i).join(' '),w.slice(i).join(' ')]};

/* ───────── XLSX : écriture (ZIP « stocké », sans dépendance) ───────── */
const XL_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL_NS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=crcT[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
const concat=a=>{const o=new Uint8Array(a.reduce((s,x)=>s+x.length,0));let p=0;for(const x of a){o.set(x,p);p+=x.length}return o};
function zip(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;const n=new Date();
 const dt=(n.getHours()<<11)|(n.getMinutes()<<5)|(n.getSeconds()>>1),dd=((n.getFullYear()-1980)<<9)|((n.getMonth()+1)<<5)|n.getDate();
 for(const f of files){const nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length;
  const l=new DataView(new ArrayBuffer(30));l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);l.setUint16(10,dt,true);l.setUint16(12,dd,true);
  l.setUint32(14,crc,true);l.setUint32(18,sz,true);l.setUint32(22,sz,true);l.setUint16(26,nm.length,true);
  parts.push(new Uint8Array(l.buffer),nm,f.data);
  const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(12,dt,true);c.setUint16(14,dd,true);
  c.setUint32(16,crc,true);c.setUint32(20,sz,true);c.setUint32(24,sz,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
  cen.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+sz}
 const cs=cen.reduce((s,x)=>s+x.length,0),e=new DataView(new ArrayBuffer(22));
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
 return concat([...parts,...cen,new Uint8Array(e.buffer)])}
const xe=v=>String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const colL=i=>{let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
function sheetXml(rows){let nc=1;for(const r of rows)nc=Math.max(nc,r.length);
 const w=[];for(let c=0;c<nc;c++){let m=8;for(const r of rows)m=Math.max(m,String(r[c]??'').length+2);w.push(Math.min(40,m))}
 let x=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XL_NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>`
  +w.map((v,i)=>`<col min="${i+1}" max="${i+1}" width="${v}" customWidth="1"/>`).join('')+'</cols><sheetData>';
 rows.forEach((r,ri)=>{x+=`<row r="${ri+1}">`;
  for(let ci=0;ci<r.length;ci++){const v=r[ci];if(v===null||v===undefined||v==='')continue;const ref=colL(ci)+(ri+1),st=ri===0?' s="1"':'';
   if(typeof v==='number'&&isFinite(v))x+=`<c r="${ref}"${st}><v>${v}</v></c>`;
   else x+=`<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xe(typeof v==='object'?JSON.stringify(v):v)}</t></is></c>`}
  x+='</row>'});
 return x+'</sheetData></worksheet>'}
function buildXLSX(sheets){const enc=new TextEncoder(),H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const f=[
 {name:'[Content_Types].xml',x:H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  +sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'},
 {name:'_rels/.rels',x:H+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
 {name:'xl/workbook.xml',x:H+`<workbook xmlns="${XL_NS}" xmlns:r="${REL_NS}"><sheets>`+sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}"${s.hidden?' state="hidden"':''} r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>'},
 {name:'xl/_rels/workbook.xml.rels',x:H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`},
 {name:'xl/styles.xml',x:H+`<styleSheet xmlns="${XL_NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`},
 ...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,x:sheetXml(s.rows)}))];
 return zip(f.map(o=>({name:o.name,data:enc.encode(o.x)})))}

/* ───────── XLSX : lecture ───────── */
const isZip=b=>{const u=new Uint8Array(b,0,Math.min(4,b.byteLength));return u[0]===0x50&&u[1]===0x4B};
async function unzip(buf){const u=new Uint8Array(buf),v=new DataView(buf);let e=u.length-22;
 while(e>=0&&v.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('Fichier XLSX invalide.');
 const n=v.getUint16(e+10,true);let p=v.getUint32(e+16,true);const dec=new TextDecoder(),out={};
 for(let i=0;i<n&&v.getUint32(p,true)===0x02014b50;i++){
  const m=v.getUint16(p+10,true),cs=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),xl=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),lo=v.getUint32(p+42,true);
  const name=dec.decode(u.subarray(p+46,p+46+nl)),ds=lo+30+v.getUint16(lo+26,true)+v.getUint16(lo+28,true);let d=u.subarray(ds,ds+cs);
  if(m===8){if(typeof DecompressionStream==='undefined')throw new Error("Ce navigateur ne sait pas lire un XLSX enregistré par Excel : utilisez un navigateur récent ou un export de Mes Apps EPS.");
   d=new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())}
  else if(m!==0)throw new Error('Compression XLSX non prise en charge.');
  out[name]=d;p+=46+nl+xl+cl}
 return out}
const unxml=s=>s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-fA-F]+);/g,(_,k)=>({lt:'<',gt:'>',quot:'"',apos:"'",amp:'&'}[k]||String.fromCodePoint(k[1]==='x'?parseInt(k.slice(2),16):+k.slice(1))));
const attr=(t,n)=>{const m=new RegExp('(?:^|\\s)'+n+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')').exec(t);return m?unxml(m[1]??m[2]):null};
const strs=b=>[...b.replace(/<rPh\b[\s\S]*?<\/rPh>/g,'').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>unxml(m[1])).join('');
const colI=r=>{let n=0;for(const ch of /^[A-Z]+/.exec(r)[0])n=n*26+ch.charCodeAt(0)-64;return n-1};
function readSheet(x,ss){const rows=[];let rn=0;
 for(const rm of x.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)){
  const r=attr(rm[1],'r'),ri=r?+r-1:rn;rn=ri+1;const row=rows[ri]=[];
  for(const cm of(rm[2]||'').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const ref=attr(cm[1],'r'),t=attr(cm[1],'t'),b=cm[2]||'',ci=ref?colI(ref):row.length;let v;
   if(t==='inlineStr')v=strs(b);
   else{const m=/<v>([\s\S]*?)<\/v>/.exec(b);if(m){const raw=m[1];
    if(t==='s')v=ss[+raw];else if(t==='str'||t==='e')v=unxml(raw);else if(t==='b')v=raw==='1';
    else{const n=Number(raw);v=raw!==''&&isFinite(n)?n:unxml(raw)}}}
   if(v!==undefined)row[ci]=v}}
 return rows}
const dense=r=>Array.from(r||[],v=>v==null?'':String(v));
const cell=v=>v==null?'':String(v).trim();
const lkey=o=>JSON.stringify(Object.keys(o).sort().map(k=>[k,o[k]]));
function mergeLignes(a,b){const seen=new Set(a.map(lkey)),out=[...a];
 for(const o of b){const k=lkey(o);if(!seen.has(k)){seen.add(k);out.push(o)}}
 if(out.every(o=>typeof o.Date==='string'))out.sort((x,y)=>x.Date<y.Date?-1:x.Date>y.Date?1:0);return out}

const EPS={parseCSV,splitName,
 open,norm,XLSX_MIME,
 /* Change de base locale (avant toute lecture/écriture). Les applications élèves utilisent « EPSEleves » pour ne jamais toucher à la liste du professeur. */
 useDB(name){DB=name;_db=null},
 /* Crée ou met à jour un élève saisi à la main (nom, prénom, classe) ; conserve ses données d'applications. */
 async putEleve(e){const id=makeId(e),p=(await EPS.all()).find(x=>x.id===id);
  const n={id,nom:cell(e.nom),prenom:cell(e.prenom),naissance:cell(e.naissance),classe:cell(e.classe),regime:cell(e.regime),ext:p?p.ext||{}:{}};
  await tx('eleves','readwrite',o=>o.put(n));return n},
 async all(){return (await tx('eleves','readonly',o=>o.getAll()))||[]},

 /* Import automatique : XLSX (signature ZIP) ou CSV (Pronote / Mes Apps EPS). Alias historique : importCSV */
 async importFile(file){const b=await file.arrayBuffer();return isZip(b)?EPS.importXLSX(b,file.name):EPS.importCSVOnly(file)},
 async importXLSX(buf,fname,opt){opt=opt||{};const ids=new Set();const files=await unzip(buf),T=n=>files[n]?new TextDecoder().decode(files[n]):null;
  const wb=T('xl/workbook.xml'),rel=T('xl/_rels/workbook.xml.rels');if(!wb||!rel)throw new Error('Fichier XLSX invalide.');
  const tg={};for(const m of rel.matchAll(/<Relationship\b[^>]*>/g)){const id=attr(m[0],'Id'),t=attr(m[0],'Target');if(id&&t)tg[id]=t.startsWith('/')?t.slice(1):'xl/'+t}
  const ss=[],sx=T('xl/sharedStrings.xml');if(sx)for(const m of sx.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g))ss.push(strs(m[1]||''));
  const sheets=[];for(const m of wb.matchAll(/<sheet\b[^>]*>/g)){const p=tg[attr(m[0],'r:id')];if(p&&files[p])sheets.push({name:attr(m[0],'name'),rows:readSheet(T(p),ss)})}
  const meta={},ms=sheets.find(s=>s.name==='_meta');if(ms)ms.rows.slice(1).forEach(r=>{if(r&&r[0]!=null)meta[r[0]]={app:String(r[1]??r[0]),mode:r[2]}});
  const old=new Map((await EPS.all()).map(e=>[e.id,e]));let add=0,upd=0,ign=0,apps=0;
  const es=sheets.find(s=>norm(s.name)==='eleves');
  if(es&&!opt.ignorerEleves){const h=dense(es.rows[0]),ix={};for(const k in MAP)ix[k]=findCol(h,k);
   if(ix.nom<0)throw new Error('Feuille « Élèves » : colonne Nom introuvable.');
   for(const r of es.rows.slice(1)){if(!r)continue;const e={};for(const k in ix)e[k]=ix[k]>=0?cell(r[ix[k]]):'';
    if(ix.prenom<0&&e.nom){const s=splitName(e.nom);e.nom=s[0];e.prenom=s[1]}
    if(!e.nom&&!e.prenom)continue;e.id=makeId(e);const p=old.get(e.id);
    if(p){upd++;e.ext=p.ext||{}}else{add++;e.ext={}}ids.add(e.id);old.set(e.id,e)}}
  const byName=new Map();old.forEach(e=>{const k=norm(e.nom)+'_'+norm(e.prenom);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(e)});
  const resolve=(nom,prenom,nais,classe)=>{if(nais){const id=makeId({nom,prenom,naissance:nais});if(old.has(id))return id}
   let c=byName.get(norm(nom)+'_'+norm(prenom))||[];if(c.length>1&&classe)c=c.filter(e=>norm(e.classe)===norm(classe));if(c.length===0&&opt.creer&&nom&&prenom){const e={nom,prenom,naissance:'',classe,regime:'',ext:{}};e.id=makeId(e);old.set(e.id,e);byName.set(norm(nom)+'_'+norm(prenom),[e]);add++;return e.id}
   return c.length===1?c[0].id:null};
  for(const s of sheets){if(s===es||s===ms)continue;const h=dense(s.rows[0]);
   const ni=findCol(h,'nom'),pi=findCol(h,'prenom'),bi=findCol(h,'naissance'),ci=findCol(h,'classe');if(ni<0||pi<0)continue;
   const m=meta[s.name]||{app:s.name},fields=h.map((_,i)=>i).filter(i=>![ni,pi,bi,ci].includes(i)&&h[i]!=='');
   const rows=[],cnt={};
   for(const r of s.rows.slice(1)){if(!r)continue;const id=resolve(cell(r[ni]),cell(r[pi]),bi>=0?cell(r[bi]):'',ci>=0?cell(r[ci]):'');
    if(!id){if(cell(r[ni])||cell(r[pi]))ign++;continue}
    const o={};fields.forEach(i=>{const v=r[i];if(v!==undefined&&v!=='')o[h[i]]=typeof v==='string'?v.trim():v});
    ids.add(id);rows.push({id,o});cnt[id]=(cnt[id]||0)+1}
   const mode=m.mode||(Object.values(cnt).some(n=>n>1)?'lignes':'colonnes');
   if(rows.length)apps++;
   for(const{id,o}of rows){const e=old.get(id);e.ext=e.ext||{};const d=e.ext[m.app]=e.ext[m.app]||{};
    if(mode==='lignes')d.lignes=mergeLignes(Array.isArray(d.lignes)?d.lignes:[],[o]);else Object.assign(d,o)}}
  const d=await open();await new Promise((ok,ko)=>{const t=d.transaction('eleves','readwrite'),o=t.objectStore('eleves');old.forEach(e=>o.put(e));t.oncomplete=ok;t.onerror=()=>ko(t.error)});
  await tx('meta','readwrite',o=>o.put({k:'lastImport',v:new Date().toISOString(),n:fname||'export.xlsx'}));
  return{add,upd,ign,apps,cols:[],ids:[...ids]}},

 async importCSVOnly(file){const{rows}=parseCSV(await decode(file));
  // l'en-tête = première ligne contenant "nom" et "classe"
  const hi=rows.findIndex(r=>{const n=r.map(norm);return n.some(x=>x.startsWith('nom')||x==='eleves'||x==='eleve')&&n.some(x=>x.startsWith('classe'))});
  if(hi<0)throw new Error("En-têtes introuvables (colonnes Nom et Classe requises).");
  const h=rows[hi],ix={};for(const k in MAP)ix[k]=findCol(h,k);
  // colonnes APP_<appId>_<champ> d'un ancien export CSV : restaurées dans ext[appId]
  const ac=[];h.forEach((x,i)=>{const m=/^APP_([^_]+)_(.+)$/.exec(String(x).trim());if(m)ac.push({i,a:m[1],f:m[2]})});
  const old=new Map((await EPS.all()).map(e=>[e.id,e]));let add=0,upd=0;const d=await open();
  const t=d.transaction('eleves','readwrite'),o=t.objectStore('eleves');
  for(const r of rows.slice(hi+1)){const e={};for(const k in ix)e[k]=ix[k]>=0?(r[ix[k]]||'').trim():'';
   if(ix.prenom<0&&e.nom){const s=splitName(e.nom);e.nom=s[0];e.prenom=s[1]}
   if(!e.nom&&!e.prenom)continue;e.id=makeId(e);const p=old.get(e.id);
   if(p){upd++;e.ext=p.ext||{}}else{add++;e.ext={}}
   for(const c of ac){let v=(r[c.i]||'').trim();if(v==='')continue;
    if(c.f==='lignes'){try{v=JSON.parse(v)}catch(x){continue}}
    (e.ext[c.a]=e.ext[c.a]||{})[c.f]=v}
   o.put(e)}
  await new Promise(ok=>t.oncomplete=ok);
  await tx('meta','readwrite',o=>o.put({k:'lastImport',v:new Date().toISOString(),n:file.name}));
  return{add,upd,cols:Object.keys(ix).filter(k=>ix[k]<0&&!(k==='prenom'&&ix.nom>=0))}},

 /* API pour les applications : données propres à une app, rangées sous ext[appId] */
 async getExt(appId){return (await EPS.all()).map(e=>({id:e.id,nom:e.nom,prenom:e.prenom,classe:e.classe,naissance:e.naissance,regime:e.regime,data:(e.ext||{})[appId]||{}}))},
 async setExt(appId,id,data){const d=await open();return new Promise((ok,ko)=>{const t=d.transaction('eleves','readwrite'),o=t.objectStore('eleves');const g=o.get(id);
  g.onsuccess=()=>{const e=g.result;if(!e)return ko('élève inconnu');e.ext=e.ext||{};e.ext[appId]=Object.assign(e.ext[appId]||{},data);o.put(e)};t.oncomplete=ok;t.onerror=()=>ko(t.error)})},
 /* Ajoute un enregistrement (mode « lignes ») à un élève, sans doublon (clic répété sans effet). Champ Date conseillé : AAAA-MM-JJ. */
 async addLigne(appId,id,ligne){const e=(await EPS.all()).find(x=>x.id===id);if(!e)throw new Error('élève inconnu');
  const cur=((e.ext||{})[appId]||{}).lignes;return EPS.setExt(appId,id,{lignes:mergeLignes(Array.isArray(cur)?cur:[],[ligne])})},
 /* Télécharge un classeur produit par exportXLSX */
 downloadXLSX(bytes,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:XLSX_MIME}));a.download=name||'Mes_Apps_EPS.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)},
 async meta(){return tx('meta','readonly',o=>o.get('lastImport'))},
 async clear(){await tx('eleves','readwrite',o=>o.clear());await tx('meta','readwrite',o=>o.clear())},

 /* Export XLSX : feuille « Élèves » + une feuille par application (+ feuille masquée « _meta »). Retourne un Uint8Array. */
/* opts facultatif : {ids:[idsÉlèves]} limite aux élèves listés ; {apps:[idsApps]} limite aux feuilles d'applications listées ; {sansEleves:true} omet la feuille « Élèves » (fichier d'un élève). */
 async exportXLSX(opts){opts=opts||{};
  const L=(await EPS.all()).filter(e=>!opts.ids||opts.ids.includes(e.id)).sort((a,b)=>(a.classe||'').localeCompare(b.classe||'','fr',{numeric:true})||(a.nom+a.prenom).localeCompare(b.nom+b.prenom,'fr'));
  const ID=['Nom','Prénom','Né(e) le','Classe'],idv=e=>[e.nom,e.prenom,e.naissance,e.classe];
  const sheets=opts.sansEleves?[]:[{name:'Élèves',rows:[[...ID,'Régime'],...L.map(e=>[...idv(e),e.regime])]}];
  const apps=[];L.forEach(e=>Object.keys(e.ext||{}).forEach(a=>{if(!apps.includes(a)&&(!opts.apps||opts.apps.includes(a)))apps.push(a)}));
  const meta=[['Feuille','Application','Mode']],used=new Set(['Élèves','_meta']);
  for(const a of apps){
   const mode=L.some(e=>Array.isArray(((e.ext||{})[a]||{}).lignes))?'lignes':'colonnes';
   let name=(a.replace(/[\[\]:*?\/\\]/g,'-').slice(0,31))||'app',k=2;while(used.has(name))name=name.slice(0,28)+'-'+k++;used.add(name);
   const keys=[],rows=[];
   if(mode==='lignes'){
    L.forEach(e=>(((e.ext||{})[a]||{}).lignes||[]).forEach(l=>Object.keys(l).forEach(c=>{if(!keys.includes(c))keys.push(c)})));
    rows.push([...ID,...keys]);
    L.forEach(e=>(((e.ext||{})[a]||{}).lignes||[]).forEach(l=>rows.push([...idv(e),...keys.map(c=>l[c])])));
   }else{
    L.forEach(e=>Object.keys((e.ext||{})[a]||{}).forEach(c=>{if(!keys.includes(c))keys.push(c)}));
    rows.push([...ID,...keys]);
    L.forEach(e=>{const d=(e.ext||{})[a];if(d&&Object.keys(d).length)rows.push([...idv(e),...keys.map(c=>d[c])])});
   }
   sheets.push({name,rows});meta.push([name,a,mode]);
  }
  if(!sheets.length&&!apps.length)throw new Error('Aucune donnée à exporter.');
  if(apps.length)sheets.push({name:'_meta',rows:meta,hidden:true});
  return buildXLSX(sheets)},

 /* Export CSV (ancien format, conservé) : une colonne par champ d'app, nommée APP_<appId>_<champ> */
 async exportCSV(){const L=await EPS.all();const ec=[];L.forEach(e=>{for(const a in e.ext||{})for(const c in e.ext[a]){if(!ec.some(x=>x.a===a&&x.c===c))ec.push({a,c,n:`APP_${a}_${c}`})}});
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',s=v=>v&&typeof v==='object'?JSON.stringify(v):v;
  const H=['Nom','Prénom','Né(e) le','Classe','Régime',...ec.map(x=>x.n)];
  const lines=[H.map(q).join(';')];L.forEach(e=>lines.push([e.nom,e.prenom,e.naissance,e.classe,e.regime,...ec.map(x=>s(((e.ext||{})[x.a]||{})[x.c]))].map(q).join(';')));
  return '\uFEFF'+lines.join('\r\n')}
};
EPS.importCSV=EPS.importFile; // compatibilité : l'ancien nom accepte désormais aussi le XLSX
window.EPS=EPS})();
