/* TirsHand Prof — cartes de tirs des équipes, projets tactiques, import des fichiers élèves (EPS · Handball)
   Intégrée à Mes Apps EPS : identifiant d'application « tirshand » (le même que l'appli élève, pour réunir les données).
   100 % local : base partagée de Mes Apps EPS (eps-core.js, non modifié). Aucune donnée envoyée sur Internet. */
(function () {
'use strict';

const APP = 'tirshand';
const ZONES = ['Aile G', 'Arrière G', 'Centre', 'Arrière D', 'Aile D', '6 m'];
const TYPES = ['En appui', 'En suspension', 'Après course'];
const EQUIPES = [1, 2, 3, 4, 5, 6, 7, 8];
const INTENTIONS = [
  'Chercher plus de tirs à 6 m (jeu avec le pivot)',
  'Écarter le jeu pour utiliser les ailes',
  'Tirer de loin seulement quand on est démarqué',
  'Prendre le temps : moins de tirs précipités',
  'Varier la façon de tirer face au gardien',
  'Jouer plus vite (contre-attaque, tirs après course)'
];
const CLE_COURANT = 'tirshand_prof_courant';

/* ───────── Outils ───────── */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const aujourdhui = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dateFr = iso => { const [a, m, j] = String(iso).split('-'); return j ? `${j}/${m}/${a}` : iso; };
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const nomEl = e => `${String(e.nom || '').toUpperCase()} ${e.prenom || ''}`.trim();
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };

function toast(html) {
  const t = $('#toast'); t.innerHTML = `<span>${html}</span>`; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2800);
}
function confirmer(texte) {
  return new Promise(res => {
    const d = $('#confirmer'); $('#confirmer-texte').textContent = texte;
    const fin = v => { d.close(); res(v); };
    $('#confirmer-oui').onclick = () => fin(true);
    $('#confirmer-non').onclick = () => fin(false);
    d.oncancel = e => { e.preventDefault(); fin(false); };
    d.showModal();
  });
}

/* ───────── Données (base Mes Apps EPS) ───────── */
let L = [];          // élèves
let classe = lsGet('tirshand_prof_classe') || '';
const lignesDe = e => { const d = (e.ext || {})[APP]; return d && Array.isArray(d.lignes) ? d.lignes : []; };

async function chargerEleves() {
  try { L = (await EPS.all()).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr')); } catch (e) { L = []; }
  const cl = classes();
  if (classe && !cl.includes(classe)) classe = '';
  if (!classe && cl.length) classe = cl[0];
}
const classes = () => [...new Set(L.map(e => e.classe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
function selectClasse(id) {
  const cl = classes();
  return `<label class="choix-titre" style="display:block">Classe
    <select id="${id}">${cl.map(c => `<option ${c === classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`;
}
function brancherClasse(el, id, fn) { const s = $('#' + id, el); if (s) s.onchange = () => { classe = s.value; lsSet('tirshand_prof_classe', classe); fn(); }; }

/* Remplace les lignes TirsHand d'un élève (suppression d'un tir, bilan mis à jour…) */
async function majLignes(id, fn) {
  const e = (await EPS.all()).find(x => x.id === id); if (!e) return;
  await EPS.setExt(APP, id, { lignes: fn(lignesDe(e)) });
}

/* Regroupe toutes les lignes en matchs : clé = date | classe | match.
   Match saisi par le prof : un élève = un tireur. Fichier d'élève : le marqueur porte tous les tirs de son équipe. */
function matchs(filtreClasse) {
  const G = new Map();
  for (const e of L) {
    if (filtreClasse && e.classe !== filtreClasse) continue;
    for (const l of lignesDe(e)) {
      if (!l.Date || !l.Match) continue;
      const cle = l.Date + '|' + (e.classe || '') + '|' + l.Match;
      let g = G.get(cle);
      if (!g) {
        const mm = /Éq\.(\d+) vs Éq\.(\d+)/.exec(l.Match) || [];
        g = { cle, date: l.Date, classe: e.classe || '', label: l.Match, equipe: mm[1] || '?', adv: mm[2] || '?', prof: /^Prof/.test(l.Match), membres: new Map(), tirs: [], bilan: null };
        G.set(cle, g);
      }
      g.membres.set(e.id, e);
      if (l['N° tir'] === 'Bilan') { if (!g.bilan || l['Projet tactique']) g.bilan = l; }
      else if (ZONES.includes(l.Zone)) g.tirs.push({ n: +l['N° tir'], zone: l.Zone, type: l['Type de tir'], res: l['Résultat'], eleve: e });
    }
  }
  const R = [...G.values()];
  R.forEach(g => { g.tirs.sort((a, b) => a.n - b.n); const s = String((g.bilan || {}).Score || '').split('-'); g.scoreAdv = s.length === 2 ? +s[1] || 0 : null; });
  return R.sort((a, b) => b.date.localeCompare(a.date) || b.label.localeCompare(a.label, 'fr', { numeric: true }));
}
const sourceMatch = g => g.prof ? '👩‍🏫 Saisi par le professeur' : `📱 Noté par ${[...g.membres.values()].map(nomEl).map(esc).join(', ')} (appli élève)`;

/* ───────── Statistiques ───────── */
function stats(tirs) {
  const z = {}, ty = {};
  ZONES.forEach(k => z[k] = { n: 0, buts: 0, arrets: 0, hc: 0 });
  TYPES.forEach(k => ty[k] = { n: 0, buts: 0 });
  let buts = 0, arrets = 0, hc = 0;
  for (const t of tirs) {
    const s = z[t.zone]; if (!s) continue;
    s.n++; if (ty[t.type]) ty[t.type].n++;
    if (t.res === 'But') { s.buts++; buts++; if (ty[t.type]) ty[t.type].buts++; }
    else if (t.res === 'Arrêt') { s.arrets++; arrets++; } else { s.hc++; hc++; }
  }
  return { z, ty, n: tirs.length, buts, arrets, hc };
}
function meilleureZone(st, pire) {
  let best = null;
  for (const k of ZONES) {
    const s = st.z[k]; if (s.n < 2) continue;
    const e = s.buts / s.n;
    if (!best || (pire ? e < best.e || (e === best.e && s.n > best.n) : e > best.e || (e === best.e && s.n > best.n))) best = { zone: k, e, n: s.n, buts: s.buts };
  }
  return best;
}

/* ───────── Terrain (SVG) ───────── */
const POLY = {
  'Aile G': '0,0 50,0 57,41 70,65 85,85 43,127 0,170',
  '6 m': '85,85 110,104 170,120 230,120 290,104 315,85 357,127 320,156 230,180 170,180 80,156 43,127',
  'Arrière G': '0,170 43,127 80,156 140,177 140,300 0,300',
  'Centre': '140,177 170,180 230,180 260,177 260,300 140,300',
  'Arrière D': '400,170 357,127 320,156 260,177 260,300 400,300',
  'Aile D': '400,0 350,0 343,41 330,65 315,85 357,127 400,170'
};
const LABEL = { 'Aile G': [28, 52], 'Aile D': [372, 52], '6 m': [200, 150], 'Arrière G': [70, 232], 'Centre': [200, 232], 'Arrière D': [330, 232] };
function couleur(s) {
  if (!s || !s.n) return 'rgba(255,255,255,.10)';
  const e = s.buts / s.n;
  return e >= .67 ? '#22c55e' : e >= .5 ? '#a3e635' : e >= .34 ? '#f59e0b' : '#ef4444';
}
/* mode : 'saisie' (zones cliquables, compteur) ou 'carte' (couleurs d'efficacité) */
function terrain(st, mode, sel) {
  let h = `<svg class="terrain" viewBox="0 0 400 300" role="img" aria-label="Demi-terrain de handball découpé en zones de tir">
  <rect x="0" y="0" width="400" height="300" rx="10" fill="#26324a"/>`;
  for (const k of ZONES) {
    const s = st && st.z[k];
    const fill = mode === 'carte' ? couleur(s) : (k === sel ? 'rgba(255,94,0,.55)' : 'rgba(10,79,208,.35)');
    h += `<polygon class="zone${k === sel ? ' sel' : ''}" data-zone="${k}" points="${POLY[k]}" fill="${fill}" role="button" aria-label="${k}"/>`;
  }
  h += `<path d="M50,0 A120,120 0 0 0 170,120 L230,120 A120,120 0 0 0 350,0 Z" fill="#c8a24a" fill-opacity=".55" stroke="#fff" stroke-width="3"/>
  <path d="M0,59 A180,180 0 0 0 170,180 L230,180 A180,180 0 0 0 400,59" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="8 7"/>
  <rect x="170" y="0" width="60" height="9" fill="#fff"/><text x="200" y="50" text-anchor="middle" fill="#3b2a00" font-size="13">Gardien</text>`;
  for (const k of ZONES) {
    const [x, y] = LABEL[k], s = st && st.z[k];
    const fonce = mode === 'carte' && s && s.n && s.buts / s.n >= .34;
    const col = fonce ? '#0a1428' : '#fff';
    const nom = k.replace('Arrière', 'Arr.');
    let val = '';
    if (s && s.n) val = mode === 'carte' ? `${s.buts}/${s.n} · ${pct(s.buts, s.n)} %` : `${s.buts} but${s.buts > 1 ? 's' : ''} sur ${s.n}`;
    else if (mode === 'carte') val = k.startsWith('Aile') ? 'aucun / tir' : 'aucun tir';
    h += `<text class="nom" x="${x}" y="${y}" text-anchor="middle" fill="${col}">${nom}</text>`;
    const lignesVal = k.startsWith('Aile') ? val.split(/ · | \/ | (?=sur )/) : [val]; // ailes étroites : chiffres sur deux lignes
    lignesVal.forEach((v, i) => { if (v) h += `<text class="val" x="${x}" y="${y + 18 + i * 17}" text-anchor="middle" fill="${col}">${v}</text>`; });
  }
  return h + '</svg>';
}
const legende = `<p class="aide">Couleurs : <b style="color:#22c55e">■</b> 67 % et plus · <b style="color:#a3e635">■</b> 50 à 66 % · <b style="color:#f59e0b">■</b> 34 à 49 % · <b style="color:#ef4444">■</b> moins de 34 % de réussite</p>`;


/* ───────── Écran MATCH (saisie par le professeur) ───────── */
let courant = null;
try { courant = JSON.parse(lsGet(CLE_COURANT)); } catch (e) { courant = null; }
const sauverCourant = () => lsSet(CLE_COURANT, courant ? JSON.stringify(courant) : null);
let prepa = { equipe: null, adv: null, joueurs: [] };
let saisie = { zone: null, type: null, tireur: null };

function tirsCourants() {
  if (!courant) return [];
  const T = [];
  for (const id of courant.joueurs) {
    const e = L.find(x => x.id === id); if (!e) continue;
    for (const l of lignesDe(e)) if (l.Date === courant.date && l.Match === courant.label && ZONES.includes(l.Zone))
      T.push({ n: +l['N° tir'], zone: l.Zone, type: l['Type de tir'], res: l['Résultat'], eleve: e });
  }
  return T.sort((a, b) => a.n - b.n);
}

function rendreMatch() {
  const el = $('#ecran-match');
  if (!L.length) { el.innerHTML = `<div class="carte"><h2>🏁 Match</h2><p>Aucune liste d'élèves sur cet appareil. Chargez-la dans l'onglet <b>📥 Import</b>, ou ouvrez d'abord le portail Mes Apps EPS dans ce navigateur.</p></div>`; return; }
  if (!courant) return rendrePrepa(el);
  const T = tirsCourants(), st = stats(T);
  const joueurs = courant.joueurs.map(id => L.find(x => x.id === id)).filter(Boolean);
  const prec = matchs(courant.classe).find(g => g.date <= courant.date && g.label !== courant.label && (g.equipe == courant.equipe) && g.bilan && g.bilan['Projet tactique']);
  el.innerHTML = `
  <div class="carte">
    <p class="source">${esc(courant.classe)} · ${dateFr(courant.date)} · ${esc(courant.label)}</p>
    <div class="score"><span>Éq. ${esc(courant.equipe)}</span><span class="chiffre">${st.buts}</span><span>–</span><span class="chiffre">${courant.scoreAdv}</span><span>Éq. ${esc(courant.adv)}</span></div>
    <div class="ligne-boutons"><button class="btn" data-adv="-1">➖ But adverse</button><button class="btn btn-accent" data-adv="1">➕ But adverse</button></div>
    ${prec ? `<div class="rappel">🎯 Projet de l'équipe (${dateFr(prec.date)}) : ${esc(prec.bilan['Projet tactique'])}</div>` : ''}
  </div>
  <div class="carte">
    <span class="etape">1</span> <b>Zone du tir</b>
    ${terrain(st, 'saisie', saisie.zone)}
    <span class="etape">2</span> <b>Type de tir</b>
    <div class="grille g3">${TYPES.map(t => `<button class="btn choix${saisie.type === t ? ' sel' : ''}" data-type="${t}">${t}</button>`).join('')}</div>
    <span class="etape">3</span> <b>Tireur</b>
    <div class="puces">${joueurs.map(e => `<button class="puce${saisie.tireur === e.id ? ' sel' : ''}" data-tireur="${esc(e.id)}">${esc(e.prenom)} ${esc(String(e.nom).charAt(0))}.</button>`).join('')}</div>
    <span class="etape">4</span> <b>Résultat</b> <span class="aide">(enregistre le tir)</span>
    <div class="grille g3">
      <button class="btn res-but" data-res="But">⚽ But</button>
      <button class="btn res-arret" data-res="Arrêt">🧤 Arrêt</button>
      <button class="btn res-hc" data-res="Hors cadre">↗️ Hors cadre</button>
    </div>
    <p class="compteur">${st.n} tir${st.n > 1 ? 's' : ''} · ${st.buts} but${st.buts > 1 ? 's' : ''} · ${st.arrets} arrêt${st.arrets > 1 ? 's' : ''} · ${st.hc} hors cadre</p>
    ${T.length ? `<div class="ligne-boutons"><button class="btn" id="annuler-tir">↩️ Annuler le dernier tir</button></div>` : ''}
  </div>
  <div class="carte">
    <button class="btn btn-accent btn-large" id="fin-match">🏁 Fin du match : voir la carte de tirs</button>
    <div class="ligne-boutons"><button class="btn btn-danger" id="abandon">🗑️ Supprimer ce match</button></div>
  </div>`;
  el.querySelectorAll('.zone').forEach(p => p.addEventListener('click', () => { saisie.zone = p.dataset.zone; rendreMatch(); }));
  el.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { saisie.type = b.dataset.type; rendreMatch(); });
  el.querySelectorAll('[data-tireur]').forEach(b => b.onclick = () => { saisie.tireur = b.dataset.tireur; rendreMatch(); });
  el.querySelectorAll('[data-res]').forEach(b => b.onclick = () => ajouterTir(b.dataset.res));
  el.querySelectorAll('[data-adv]').forEach(b => b.onclick = () => { courant.scoreAdv = Math.max(0, courant.scoreAdv + +b.dataset.adv); sauverCourant(); rendreMatch(); });
  const an = $('#annuler-tir', el); if (an) an.onclick = annulerTir;
  $('#fin-match', el).onclick = finMatch;
  $('#abandon', el).onclick = async () => {
    if (!await confirmer(`Supprimer ce match et ses ${T.length} tir(s) ? Cette action est définitive.`)) return;
    for (const id of courant.joueurs) await majLignes(id, X => X.filter(l => !(l.Date === courant.date && l.Match === courant.label)));
    courant = null; sauverCourant(); await chargerEleves(); rendreMatch();
  };
}

async function ajouterTir(res) {
  if (!saisie.zone) return toast('👆 Touchez d\'abord la zone du tir.');
  if (!saisie.type) return toast('👆 Choisissez le type de tir.');
  if (!saisie.tireur) return toast('👆 Choisissez le tireur.');
  courant.n = (courant.n || 0) + 1; sauverCourant();
  const e = L.find(x => x.id === saisie.tireur);
  await EPS.addLigne(APP, saisie.tireur, { Date: courant.date, Match: courant.label, 'N° tir': courant.n, Zone: saisie.zone, 'Type de tir': saisie.type, 'Résultat': res });
  toast(`Tir n°${courant.n} : ${esc(e ? e.prenom : '')} · ${esc(saisie.zone)} · <b>${esc(res)}</b>`);
  saisie = { zone: null, type: null, tireur: null };
  await chargerEleves(); rendreMatch();
}

async function annulerTir() {
  const T = tirsCourants(); if (!T.length) return;
  const t = T[T.length - 1];
  if (!await confirmer(`Supprimer le tir n°${t.n} (${t.eleve.prenom} · ${t.zone} · ${t.type} · ${t.res}) ?`)) return;
  await majLignes(t.eleve.id, X => X.filter(l => !(l.Date === courant.date && l.Match === courant.label && +l['N° tir'] === t.n)));
  await chargerEleves(); rendreMatch(); toast('Tir supprimé.');
}

async function finMatch() {
  const T = tirsCourants(), st = stats(T);
  const ligne = { Date: courant.date, Match: courant.label, 'N° tir': 'Bilan', Score: `${st.buts}-${courant.scoreAdv}` };
  for (const id of courant.joueurs) await majLignes(id, X => X.filter(l => !(l.Date === courant.date && l.Match === courant.label && l['N° tir'] === 'Bilan')).concat([{ ...ligne }]));
  bilanVu = courant.date + '|' + courant.classe + '|' + courant.label;
  courant = null; sauverCourant(); saisie = { zone: null, type: null, tireur: null };
  await chargerEleves(); montrer('bilan');
}

function rendrePrepa(el) {
  const eleves = L.filter(e => e.classe === classe);
  prepa.joueurs = prepa.joueurs.filter(id => eleves.some(e => e.id === id));
  const ok = prepa.equipe && prepa.adv && prepa.joueurs.length;
  el.innerHTML = `
  <div class="carte">
    <h2>🏁 Nouveau match</h2>
    <p class="aide">Vous notez les tirs d'une équipe. Chaque tir est enregistré sur la fiche du tireur dans Mes Apps EPS.</p>
    ${selectClasse('m-classe')}
    <div class="choix-titre">Équipe observée</div>
    <div class="grille g4">${EQUIPES.map(n => `<button class="btn choix${prepa.equipe === n ? ' sel' : ''}" data-eq="${n}">Éq. ${n}</button>`).join('')}</div>
    <div class="choix-titre">Adversaire</div>
    <div class="grille g4">${EQUIPES.map(n => `<button class="btn choix${prepa.adv === n ? ' sel' : ''}" data-adv="${n}" ${prepa.equipe === n ? 'disabled' : ''}>Éq. ${n}</button>`).join('')}</div>
    <div class="choix-titre">Joueurs de l'équipe (${prepa.joueurs.length})</div>
    <div class="puces">${eleves.map(e => `<button class="puce${prepa.joueurs.includes(e.id) ? ' sel' : ''}" data-j="${esc(e.id)}">${esc(nomEl(e))}</button>`).join('') || '<span class="aide">Aucun élève dans cette classe.</span>'}</div>
  </div>
  <button class="btn btn-accent btn-large" id="commencer" ${ok ? '' : 'disabled'}>▶️ Commencer le match</button>`;
  brancherClasse(el, 'm-classe', () => { prepa.joueurs = []; rendreMatch(); });
  el.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { prepa.equipe = +b.dataset.eq; if (prepa.adv === prepa.equipe) prepa.adv = null; rendreMatch(); });
  el.querySelectorAll('[data-adv]').forEach(b => b.onclick = () => { prepa.adv = +b.dataset.adv; rendreMatch(); });
  el.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { const id = b.dataset.j; prepa.joueurs = prepa.joueurs.includes(id) ? prepa.joueurs.filter(x => x !== id) : prepa.joueurs.concat(id); rendreMatch(); });
  $('#commencer', el).onclick = () => {
    const date = aujourdhui(), base = `Prof · Éq.${prepa.equipe} vs Éq.${prepa.adv}`;
    const existants = new Set(matchs(classe).filter(g => g.date === date).map(g => g.label));
    let k = 1; while (existants.has(base + ' #' + k)) k++;
    courant = { date, classe, label: base + ' #' + k, equipe: prepa.equipe, adv: prepa.adv, joueurs: prepa.joueurs.slice(), scoreAdv: 0, n: 0 };
    sauverCourant(); saisie = { zone: null, type: null, tireur: null }; rendreMatch();
  };
}

/* ───────── Écran BILAN ───────── */
let bilanVu = null, compare = null, projet = { choix: [], texte: '' };

function phraseProjet(p) {
  const m = [];
  if (p.zonePlus) m.push(`tirer davantage depuis « ${p.zonePlus} »`);
  if (p.zoneMoins) m.push(`éviter les tirs depuis « ${p.zoneMoins} »`);
  (p.choix || []).forEach(c => m.push(c.charAt(0).toLowerCase() + c.slice(1)));
  let ph = m.length ? 'Au prochain match, nous allons ' + m.join(', ') + '.' : '';
  if (p.texte) ph += (ph ? ' ' : '') + p.texte;
  return ph;
}

function rendreBilan() {
  const el = $('#ecran-bilan');
  const G = matchs(classe);
  let h = `<div class="carte"><h2>🗺️ Bilan des matchs</h2>${L.length ? selectClasse('b-classe') : ''}`;
  if (!G.length) { el.innerHTML = h + `<p>Aucun match pour cette classe. Saisissez un match (onglet 🏁) ou importez les fichiers des élèves (onglet 📥).</p></div>`; brancherClasse(el, 'b-classe', rendreBilan); return; }
  if (!bilanVu || !G.some(g => g.cle === bilanVu)) bilanVu = G[0].cle;
  const g = G.find(x => x.cle === bilanVu), st = stats(g.tirs);
  h += `<label class="choix-titre" style="display:block">Match
      <select id="b-match">${G.map(x => `<option value="${esc(x.cle)}" ${x.cle === g.cle ? 'selected' : ''}>${dateFr(x.date)} · ${esc(x.label)} · ${esc([...x.membres.values()].map(e => e.prenom).join(', '))}</option>`).join('')}</select></label>
    <div class="score"><span>Éq. ${esc(g.equipe)}</span><span class="chiffre">${st.buts}</span><span>–</span><span class="chiffre">${g.scoreAdv ?? '?'}</span><span>Éq. ${esc(g.adv)}</span></div>
    <p class="compteur">${dateFr(g.date)} · ${st.n} tirs · réussite ${pct(st.buts, st.n)} %</p>
    <p class="source">${sourceMatch(g)}</p></div>`;

  h += `<div class="carte accent"><h2>Carte de tirs</h2>${terrain(st, 'carte')}${legende}
    <table><tr><th>Type de tir</th><th>Tirs</th><th>Buts</th><th>Réussite</th></tr>
    ${TYPES.map(k => `<tr><td>${k}</td><td>${st.ty[k].n}</td><td>${st.ty[k].buts}</td><td>${st.ty[k].n ? pct(st.ty[k].buts, st.ty[k].n) + ' %' : '–'}</td></tr>`).join('')}
    <tr><td><b>Total</b></td><td><b>${st.n}</b></td><td><b>${st.buts}</b></td><td><b>${pct(st.buts, st.n)} %</b></td></tr></table>`;
  if (g.prof) {
    const parJ = [...g.membres.values()].map(e => { const s = stats(g.tirs.filter(t => t.eleve.id === e.id)); return { e, s, best: meilleureZone(s) }; });
    h += `<h3>Par joueur</h3><div class="table-defile"><table><tr><th>Joueur</th><th>Tirs</th><th>Buts</th><th>Réussite</th><th>Zone la plus tentée</th></tr>
      ${parJ.map(({ e, s }) => { const z = ZONES.slice().sort((a, b) => s.z[b].n - s.z[a].n)[0]; return `<tr><td>${esc(nomEl(e))}</td><td>${s.n}</td><td>${s.buts}</td><td>${s.n ? pct(s.buts, s.n) + ' %' : '–'}</td><td>${s.n ? esc(z) : '–'}</td></tr>`; }).join('')}</table></div>`;
  }
  h += `</div>`;

  // Projet et co-évaluation
  const b = g.bilan || {};
  h += `<div class="carte"><h2>🎯 Projet tactique</h2>
    ${b['Projet tactique'] ? `<div class="phrase">${esc(b['Projet tactique'])}</div>` : '<p class="aide">Pas encore de projet pour ce match.</p>'}
    ${b['Co-évaluation'] ? `<p>🤝 Co-évaluation du binôme : <b>${esc(b['Co-évaluation'])}</b></p>` : ''}
    <details ${b['Projet tactique'] ? '' : 'open'}><summary class="choix-titre" style="cursor:pointer;min-height:44px">✏️ ${b['Projet tactique'] ? 'Réécrire' : 'Écrire'} le projet avec l'équipe</summary>
      <div class="choix-titre">Zone à privilégier</div>
      <div class="grille g3">${ZONES.map(z => `<button class="btn choix${projet.zonePlus === z ? ' sel' : ''}" data-zp="${z}">${z}</button>`).join('')}</div>
      <div class="choix-titre">Zone à éviter (facultatif)</div>
      <div class="grille g3">${ZONES.map(z => `<button class="btn choix${projet.zoneMoins === z ? ' sel' : ''}" data-zm="${z}" ${projet.zonePlus === z ? 'disabled' : ''}>${z}</button>`).join('')}</div>
      <div class="choix-titre">Comment ? (1 ou 2 choix)</div>
      <div class="grille g2">${INTENTIONS.map(c => `<button class="btn choix${projet.choix.includes(c) ? ' sel' : ''}" data-int="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="choix-titre">Un détail à ajouter ? (facultatif)</div>
      <textarea id="projet-texte" rows="2" maxlength="200">${esc(projet.texte)}</textarea>
      <div class="phrase" id="phrase" style="margin-top:10px">${esc(phraseProjet(projet)) || '<span class="aide">Choisissez au moins une zone ou une intention.</span>'}</div>
      <button class="btn btn-accent btn-large" id="sauver-projet" style="margin-top:10px">💾 Enregistrer le projet</button>
    </details></div>`;

  // Comparaison
  const autres = G.filter(x => x.cle !== g.cle);
  if (autres.length) {
    if (!compare || !autres.some(x => x.cle === compare)) compare = (autres.find(x => x.equipe === g.equipe && x.date <= g.date) || autres[0]).cle;
    const A = autres.find(x => x.cle === compare), sa = stats(A.tirs);
    const fl = (a, c) => c > a ? '<span class="haut">⬆️</span>' : c < a ? '<span class="bas">⬇️</span>' : '＝';
    h += `<div class="carte"><h2>⚖️ Comparer avec un autre match</h2>
      <select id="b-comp">${autres.map(x => `<option value="${esc(x.cle)}" ${x.cle === compare ? 'selected' : ''}>${dateFr(x.date)} · ${esc(x.label)}</option>`).join('')}</select>
      <div class="cartes-cote"><div><h3>${dateFr(A.date)}</h3>${terrain(sa, 'carte')}</div><div><h3>${dateFr(g.date)} (affiché)</h3>${terrain(st, 'carte')}</div></div>
      <table><tr><th>Zone</th><th>${dateFr(A.date)}</th><th>${dateFr(g.date)}</th><th></th></tr>
      ${ZONES.map(z => { const x = sa.z[z], y = st.z[z]; return `<tr><td>${z}</td><td>${x.buts}/${x.n}${x.n ? ' · ' + pct(x.buts, x.n) + ' %' : ''}</td><td>${y.buts}/${y.n}${y.n ? ' · ' + pct(y.buts, y.n) + ' %' : ''}</td><td>${x.n && y.n ? fl(x.buts / x.n, y.buts / y.n) : ''}</td></tr>`; }).join('')}
      <tr><td><b>Total</b></td><td><b>${pct(sa.buts, sa.n)} %</b></td><td><b>${pct(st.buts, st.n)} %</b></td><td>${fl(sa.n ? sa.buts / sa.n : 0, st.n ? st.buts / st.n : 0)}</td></tr></table></div>`;
  }
  h += `<div class="ligne-boutons"><button class="btn btn-danger" id="suppr-match">🗑️ Supprimer ce match</button></div>`;
  el.innerHTML = h;

  brancherClasse(el, 'b-classe', () => { bilanVu = null; rendreBilan(); });
  $('#b-match', el).onchange = e => { bilanVu = e.target.value; projet = { choix: [], texte: '' }; rendreBilan(); };
  const bc = $('#b-comp', el); if (bc) bc.onchange = e => { compare = e.target.value; garder(); };
  const garder = () => { const y = window.scrollY, ouvert = $('details', el).open; rendreBilan(); $('details', el).open = ouvert; window.scrollTo(0, y); };
  el.querySelectorAll('[data-zp]').forEach(x => x.onclick = () => { projet.zonePlus = projet.zonePlus === x.dataset.zp ? null : x.dataset.zp; if (projet.zoneMoins === projet.zonePlus) projet.zoneMoins = null; garder(); });
  el.querySelectorAll('[data-zm]').forEach(x => x.onclick = () => { projet.zoneMoins = projet.zoneMoins === x.dataset.zm ? null : x.dataset.zm; garder(); });
  el.querySelectorAll('[data-int]').forEach(x => x.onclick = () => {
    const c = x.dataset.int;
    if (projet.choix.includes(c)) projet.choix = projet.choix.filter(v => v !== c);
    else { if (projet.choix.length >= 2) return toast('2 choix maximum.'); projet.choix.push(c); }
    garder();
  });
  const ta = $('#projet-texte', el); ta.oninput = () => { projet.texte = ta.value.trim(); $('#phrase', el).textContent = phraseProjet(projet); };
  $('#sauver-projet', el).onclick = async () => {
    const ph = phraseProjet(projet); if (!ph) return toast('✍️ Choisissez au moins une zone ou une intention.');
    const ligne = { Date: g.date, Match: g.label, 'N° tir': 'Bilan', Score: b.Score || `${st.buts}-${g.scoreAdv ?? 0}`, 'Projet tactique': ph };
    if (b['Co-évaluation']) ligne['Co-évaluation'] = b['Co-évaluation'];
    for (const id of g.membres.keys()) await majLignes(id, X => X.filter(l => !(l.Date === g.date && l.Match === g.label && l['N° tir'] === 'Bilan')).concat([{ ...ligne }]));
    projet = { choix: [], texte: '' }; await chargerEleves(); rendreBilan(); toast('✅ Projet enregistré dans Mes Apps EPS.');
  };
  $('#suppr-match', el).onclick = async () => {
    if (!await confirmer(`Supprimer le match « ${g.label} » du ${dateFr(g.date)} (${g.tirs.length} tirs et son bilan) ? Cette action est définitive.`)) return;
    for (const id of g.membres.keys()) await majLignes(id, X => X.filter(l => !(l.Date === g.date && l.Match === g.label)));
    bilanVu = null; await chargerEleves(); rendreBilan(); toast('🗑️ Match supprimé.');
  };
}

/* ───────── Écran SUIVI (classe) ───────── */
let eleveVu = null;
function rendreSuivi() {
  const el = $('#ecran-suivi');
  const eleves = L.filter(e => e.classe === classe);
  let h = `<div class="carte"><h2>📊 Suivi de la classe</h2>${L.length ? selectClasse('s-classe') : '<p>Aucune liste d\'élèves.</p>'}
    <p class="aide">Touchez un élève pour voir sa progression. Pour un fichier d'élève, les tirs comptés sont ceux de toute l'équipe, notés par cet élève (le marqueur).</p>
    <div class="table-defile"><table><tr><th>Élève</th><th>Matchs</th><th>Tirs</th><th>Réussite</th><th>Dernier projet</th></tr>`;
  for (const e of eleves) {
    const G = matchs(classe).filter(g => g.membres.has(e.id));
    const T = G.flatMap(g => g.tirs.filter(t => t.eleve.id === e.id)), s = stats(T);
    const dp = G.find(g => g.bilan && g.bilan['Projet tactique']);
    h += `<tr class="cliquable${eleveVu === e.id ? ' sel' : ''}" data-el="${esc(e.id)}"><td>${eleveVu === e.id ? '▶ ' : ''}${esc(nomEl(e))}</td><td>${G.length || '–'}</td><td>${s.n || '–'}</td><td>${s.n ? pct(s.buts, s.n) + ' %' : '–'}</td><td style="text-align:left;font-size:.85rem">${dp ? esc(dp.bilan['Projet tactique']) : '–'}</td></tr>`;
  }
  h += `</table></div></div>`;
  const e = eleves.find(x => x.id === eleveVu);
  if (e) {
    const G = matchs(classe).filter(g => g.membres.has(e.id)).reverse();
    h += `<div class="carte"><h2>📈 ${esc(nomEl(e))}</h2>`;
    h += G.length >= 2 ? graphique(G.map(g => ({ date: g.date, tirs: g.tirs.filter(t => t.eleve.id === e.id), projet: g.bilan && g.bilan['Projet tactique'] }))) : '<p class="aide">Il faut au moins 2 matchs pour tracer une progression.</p>';
    h += G.slice().reverse().map(g => { const s = stats(g.tirs.filter(t => t.eleve.id === e.id)); return `<p>• <b>${dateFr(g.date)}</b> · ${esc(g.label)} · ${s.buts}/${s.n} (${pct(s.buts, s.n)} %)${g.bilan && g.bilan['Projet tactique'] ? `<br><span class="aide">🎯 ${esc(g.bilan['Projet tactique'])}</span>` : ''}</p>`; }).join('');
    h += `</div>`;
  }
  h += `<div class="carte"><h2>⬇️ Exporter</h2>
    <div class="ligne-boutons"><button class="btn btn-accent" id="exp-tout">⬇ Fichier compilé Mes Apps EPS (.xlsx)</button><button class="btn" id="exp-app">⬇ TirsHand seule (.xlsx)</button></div>
    <div class="ligne-boutons"><button class="btn btn-danger" id="effacer-app">🗑️ Effacer les données de l'appli</button></div></div>`;
  el.innerHTML = h;
  brancherClasse(el, 's-classe', () => { eleveVu = null; rendreSuivi(); });
  el.querySelectorAll('[data-el]').forEach(r => r.onclick = () => { eleveVu = eleveVu === r.dataset.el ? null : r.dataset.el; rendreSuivi(); });
  const exp = async (opts, nom) => { try { EPS.downloadXLSX(await EPS.exportXLSX(opts), nom + aujourdhui() + '.xlsx'); toast('✅ Fichier exporté.'); } catch (x) { toast('⚠️ ' + esc(x.message || x)); } };
  $('#exp-tout', el).onclick = () => exp(null, 'Mes_Apps_EPS_');
  $('#exp-app', el).onclick = () => exp({ apps: [APP] }, 'TirsHand_');
  $('#effacer-app', el).onclick = effacerTout;
}

function graphique(M) {
  const W = 600, H = 240, g = 40, n = M.length;
  const pts = M.map((m, i) => { const st = stats(m.tirs); return { x: g + (n === 1 ? 0 : i * (W - 2 * g) / (n - 1)), y: H - g - (st.n ? st.buts / st.n : 0) * (H - 2 * g), v: pct(st.buts, st.n), d: dateFr(m.date).slice(0, 5), p: !!m.projet }; });
  let s = `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Réussite au tir à chaque match">`;
  [0, 25, 50, 75, 100].forEach(v => { const y = H - g - v / 100 * (H - 2 * g); s += `<line x1="${g}" x2="${W - g}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.15)"/><text x="${g - 6}" y="${y + 4}" text-anchor="end" fill="#c9d6ee" font-size="12">${v} %</text>`; });
  s += `<polyline fill="none" stroke="url(#dg)" stroke-width="4" points="${pts.map(p => p.x + ',' + p.y).join(' ')}"/>
  <defs><linearGradient id="dg"><stop offset="0" stop-color="#ff5e00"/><stop offset="1" stop-color="#4f8bff"/></linearGradient></defs>`;
  pts.forEach(p => { s += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="${p.p ? '#ff5e00' : '#fff'}"/><text x="${p.x}" y="${p.y - 12}" text-anchor="middle" fill="#fff" font-size="14" font-weight="900">${p.v} %</text><text x="${p.x}" y="${H - 14}" text-anchor="middle" fill="#c9d6ee" font-size="12">${p.d}</text>`; });
  return s + `</svg><p class="aide">Réussite au tir (buts ÷ tirs) à chaque match. Point orange = un projet tactique a été écrit après ce match.</p>`;
}

/* ───────── Écran IMPORT ───────── */
async function importer(fichiers) {
  const log = $('#imp-journal'); log.innerHTML = ''; const creer = $('#imp-creer').checked; let tot = 0;
  for (const f of fichiers) {
    try {
      const r = await EPS.importXLSX(await f.arrayBuffer(), f.name, { ignorerEleves: true, creer });
      const msg = r.ids.length ? `✅ <b>${esc(f.name)}</b> : ${r.ids.length} élève(s) mis à jour${r.add ? `, ${r.add} créé(s)` : ''}` : `⚠ <b>${esc(f.name)}</b> : aucun élève reconnu`;
      log.insertAdjacentHTML('beforeend', `<div class="${r.ign || !r.ids.length ? 'att' : ''}">${msg}${r.ign ? ` · ${r.ign} ligne(s) ignorée(s) : élève absent de votre liste ou homonyme (cochez « Créer les élèves absents » si besoin)` : ''}</div>`);
      tot += r.ids.length;
    } catch (x) { log.insertAdjacentHTML('beforeend', `<div class="ko">❌ <b>${esc(f.name)}</b> : ${esc(x.message || x)}</div>`); }
  }
  await chargerEleves(); infoListe();
  if (tot) toast(`✅ ${tot} fiche(s) élève mise(s) à jour. Voir l'onglet Bilan.`);
}
function infoListe() {
  $('#liste-info').textContent = L.length ? `${L.length} élèves dans Mes Apps EPS sur cet appareil (${classes().length} classe(s)).` : 'Aucune liste sur cet appareil : chargez le fichier .xlsx de Mes Apps EPS ou l\'export Pronote (.csv), ou ouvrez d\'abord le portail Mes Apps EPS dans ce navigateur.';
  $('#imp-creer').checked = !L.length;
}
function initImport() {
  $('#imp-fichiers').onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) importer(f); };
  const d = $('#depot');
  ['dragenter', 'dragover'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.add('survol'); }));
  ['dragleave', 'drop'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.remove('survol'); }));
  d.addEventListener('drop', e => { const f = [...e.dataTransfer.files].filter(x => /\.xlsx$/i.test(x.name)); if (f.length) importer(f); else toast('Déposez des fichiers .xlsx'); });
  $('#liste-fichier').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const r = await EPS.importFile(f); toast(`✅ ${r.add} élève(s) ajouté(s), ${r.upd} mis à jour`); await chargerEleves(); infoListe(); } catch (x) { toast('❌ ' + esc(x.message || x)); }
  };
}

async function effacerTout() {
  if (!await confirmer('Effacer toutes les données TirsHand (tirs, bilans, projets) de tous les élèves sur cet appareil ? La liste des élèves et les autres applis ne sont pas touchées. Cette action est définitive.')) return;
  const d = await EPS.open();
  for (const e of await EPS.all()) {
    if (!e.ext || !e.ext[APP]) continue;
    delete e.ext[APP];
    await new Promise((ok, ko) => { const t = d.transaction('eleves', 'readwrite'); t.objectStore('eleves').put(e); t.oncomplete = ok; t.onerror = () => ko(t.error); });
  }
  courant = null; sauverCourant(); videoEffacer();
  if ($('#confid').open) $('#confid').close();
  await chargerEleves(); toutRendre(); toast('🗑️ Données TirsHand effacées.');
}

/* ───────── Écran VIDÉO (différé, en mémoire vive uniquement) ───────── */
const V = { stream: null, video: null, frames: [], capt: null, raf: 0, delai: 5, mode: 'diff', vitesse: .5, rep: null, occupe: false, dernier: null, off: null };
const FPS = 12, GARDE = 22000, DUREE_RALENTI = 8000;

async function videoDemarrer() {
  if (V.stream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('⚠️ Caméra indisponible sur cet appareil.');
  try {
    V.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  } catch (e) { return toast('⚠️ Accès à la caméra refusé. Autorise la caméra dans le navigateur.'); }
  V.video = document.createElement('video'); V.video.muted = true; V.video.playsInline = true; V.video.srcObject = V.stream;
  await V.video.play().catch(() => {});
  V.off = document.createElement('canvas');
  V.frames = []; V.mode = 'diff';
  V.capt = setInterval(() => {
    const v = V.video; if (!v || !v.videoWidth) return;
    // On garde les proportions réelles de la caméra (paysage ou portrait) : aucune déformation
    const w = 640, h = Math.round(w * v.videoHeight / v.videoWidth);
    if (V.off.width !== w || V.off.height !== h) { V.off.width = w; V.off.height = h; }
    V.off.getContext('2d').drawImage(v, 0, 0, w, h);
    const t = performance.now();
    V.off.toBlob(b => { if (b && V.stream) V.frames.push({ t, b }); }, 'image/jpeg', .7);
    const lim = performance.now() - GARDE; while (V.frames.length && V.frames[0].t < lim) V.frames.shift();
  }, 1000 / FPS);
  boucle(); majVideo();
}

function boucle() {
  V.raf = requestAnimationFrame(boucle);
  if (V.occupe || !V.frames.length) return;
  const now = performance.now(); let f = null;
  if (V.mode === 'diff') {
    const cible = now - V.delai * 1000;
    for (let i = V.frames.length - 1; i >= 0; i--) if (V.frames[i].t <= cible) { f = V.frames[i]; break; }
    const etat = $('#v-etat');
    if (!f) { etat.textContent = `⏳ Différé dans ${Math.ceil((V.frames[0].t - cible) / 1000)} s…`; return; }
    etat.textContent = `🔴 Différé ${V.delai} s · rien n'est enregistré`;
  } else if (V.rep && V.rep.frames.length) {
    const R = V.rep, pos = R.debut + ((now - R.t0) * V.vitesse) % (R.fin - R.debut);
    f = R.frames[0]; for (const x of R.frames) { if (x.t <= pos) f = x; else break; }
    $('#v-etat').textContent = `🐢 Ralenti ×${String(V.vitesse).replace('.', ',')} (en boucle)`;
  }
  if (!f || f === V.dernier) return;
  V.occupe = true; V.dernier = f;
  createImageBitmap(f.b).then(bm => { const c = $('#v-canvas'); if (c.width !== bm.width || c.height !== bm.height) { c.width = bm.width; c.height = bm.height; } c.getContext('2d').drawImage(bm, 0, 0); bm.close(); })
    .catch(() => {}).finally(() => { V.occupe = false; });
}

function videoRalenti() {
  if (!V.stream) return;
  const fin = V.mode === 'diff' ? performance.now() - V.delai * 1000 : performance.now();
  const frames = V.frames.filter(f => f.t <= fin && f.t >= fin - DUREE_RALENTI);
  if (frames.length < 2) return toast('Pas encore assez d\'images : attends quelques secondes.');
  V.rep = { frames, debut: frames[0].t, fin: frames[frames.length - 1].t + 1, t0: performance.now() };
  V.mode = 'rep'; majVideo();
}

function videoEffacer() {
  clearInterval(V.capt); cancelAnimationFrame(V.raf);
  if (V.stream) V.stream.getTracks().forEach(t => t.stop());
  if (V.video) V.video.srcObject = null;
  V.stream = null; V.video = null; V.frames = []; V.rep = null; V.dernier = null; V.mode = 'diff';
  const c = $('#v-canvas'); if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
  const e = $('#v-etat'); if (e) e.textContent = 'Caméra arrêtée · images effacées';
  majVideo();
}

function majVideo() {
  const on = !!V.stream;
  $('#v-ralenti').disabled = !on;
  $('#v-vitesse').disabled = !on;
  $('#v-retour').disabled = !on || V.mode === 'diff';
  $('#v-vitesse').textContent = 'Vitesse ×' + String(V.vitesse).replace('.', ',');
  $('#v-demarrer').disabled = on;
}

function initVideo() {
  $('#v-demarrer').onclick = videoDemarrer;
  $('#v-effacer').onclick = () => { videoEffacer(); toast('🗑️ Images effacées, caméra arrêtée.'); };
  $('#v-ralenti').onclick = videoRalenti;
  $('#v-vitesse').onclick = () => { V.vitesse = V.vitesse === .5 ? .25 : .5; if (V.rep) V.rep.t0 = performance.now(); majVideo(); };
  $('#v-retour').onclick = () => { V.mode = 'diff'; V.rep = null; majVideo(); };
  document.querySelectorAll('#v-delais [data-d]').forEach(b => b.onclick = () => {
    V.delai = +b.dataset.d; document.querySelectorAll('#v-delais [data-d]').forEach(x => x.classList.toggle('sel', x === b));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) videoEffacer(); });
  window.addEventListener('pagehide', videoEffacer);
}


/* ───────── Navigation ───────── */
let ecran = 'match';
function montrer(nom) {
  if (ecran === 'video' && nom !== 'video') videoEffacer();
  ecran = nom;
  document.querySelectorAll('.onglet').forEach(b => b.classList.toggle('actif', b.dataset.ecran === nom));
  document.querySelectorAll('.ecran').forEach(s => s.classList.toggle('actif', s.id === 'ecran-' + nom));
  if (nom === 'match') rendreMatch();
  if (nom === 'bilan') rendreBilan();
  if (nom === 'suivi') rendreSuivi();
  if (nom === 'import') infoListe();
  window.scrollTo(0, 0);
}
function toutRendre() { rendreMatch(); rendreBilan(); rendreSuivi(); infoListe(); }

async function init() {
  document.querySelectorAll('.onglet').forEach(b => b.onclick = async () => { await chargerEleves(); montrer(b.dataset.ecran); });
  $('#lien-confid').onclick = () => $('#confid').showModal();
  $('#confid [data-fermer]').onclick = () => $('#confid').close();
  $('#btn-effacer-tout').onclick = effacerTout;
  initVideo(); initImport();
  await chargerEleves();
  toutRendre();
}
init().catch(e => { console.error(e); toast('⚠️ Problème au démarrage : rechargez la page.'); });
})();
