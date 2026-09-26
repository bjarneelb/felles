/* Boblespillet – felles motor.
   Brukes av flere fag. Faget leverer bare innholdet, alt annet skjer her.

   Bruk:
     <link rel="stylesheet" href="/js/motorer/bobler.css">
     <script src="/js/spill-utils.js"></script>
     <script src="/js/motorer/bobler.js"></script>
     <script>
       Boblespill.start({
         spillnavn: 'bobler-kjemi',                 // navnet i lærerrapporten
         tittel: '🫧 Boblejakten',
         intro: 'Kort forklaring til eleven.',
         ledetekst: 'skriv symbolet …',             // i skrivefeltet
         settTittel: 'Hvilke grunnstoffer?',
         sett: [{ id: '20', navn: '20 vanligste', par: [['Sølv', ['Ag']], ...] }],
         retninger: [{ id: 'no-de', navn: 'Norsk → tysk' },
                     { id: 'de-no', navn: 'Tysk → norsk', snu: true }],   // valgfritt
         ignorerTegn: false                         // true: é og e regnes som like
       });
   Paret er [det som står på boblen, liste med godkjente svar].
*/
window.Boblespill = (function () {
  'use strict';

  let cfg = null, rot = null;
  const $ = s => rot.querySelector(s);

  // ---------- tekstbehandling ----------
  const reint = t => {
    let s = (t || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (cfg.ignorerTegn) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s;
  };
  const svarene = p => (Array.isArray(p[1]) ? p[1] : [p[1]]).map(reint);

  // ---------- innstillinger ----------
  let valgtSett = null, valgtRetning = null, modus = 'solo', romkode = null, liste = [];
  function byggListe() {
    const s = cfg.sett.find(x => x.id === valgtSett) || cfg.sett[0];
    const snu = !!(valgtRetning && (cfg.retninger.find(r => r.id === valgtRetning) || {}).snu);
    liste = s.par.map(p => {
      const svar = Array.isArray(p[1]) ? p[1] : [p[1]];
      return snu ? [svar[0], [p[0]]] : [p[0], svar];
    });
  }

  // ---------- tilstand ----------
  let bobler = [], spillGaar = false, pauset = false, forrigeTid = 0;
  let poeng = 0, rekke = 0, besteRekke = 0, riktige = 0, feil = 0, niva = 1, hoyesteNiva = 1;
  let nesteSpawn = 0, spiltTid = 0, idTeller = 1;
  let stage = null, typeInput = null;

  const MAKS_DEKNING = 0.62;
  const nivaFor = t => Math.min(12, 1 + Math.floor(t / 22));
  const spawnPause = n => Math.max(900, 3200 - n * 190);
  const vekstfart = n => 5.5 + n * 1.15;
  const maksBobler = n => Math.min(9, 3 + Math.floor(n / 2));
  const flate = () => { const r = stage.getBoundingClientRect(); return { w: r.width, h: r.height }; };

  // ---------- bobler ----------
  function nyBoble() {
    const { w, h } = flate();
    const brukt = new Set(bobler.map(b => b.tekst));
    const valg = liste.filter(p => !brukt.has(p[0]));
    if (!valg.length) return;
    const par = valg[Math.floor(Math.random() * valg.length)];
    const r0 = Math.max(26, Math.min(w, h) * 0.05);
    let best = null;
    for (let i = 0; i < 24; i++) {
      const x = r0 + 10 + Math.random() * Math.max(10, w - 2 * r0 - 20);
      const y = r0 + 10 + Math.random() * Math.max(10, h - 2 * r0 - 20);
      let naermest = Infinity;
      bobler.forEach(b => { naermest = Math.min(naermest, Math.hypot(b.x - x, b.y - y) - b.r); });
      if (!best || naermest > best.d) best = { x, y, d: naermest };
      if (naermest > r0 * 2.2) break;
    }
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = par[0];
    stage.appendChild(el);
    bobler.push({ id: idTeller++, tekst: par[0], svar: svarene(par), fasit: (Array.isArray(par[1]) ? par[1] : [par[1]])[0], x: best.x, y: best.y, r: r0, el });
  }

  const maalCtx = document.createElement('canvas').getContext('2d');
  const breddeCache = new Map();
  function tekstBredde(t) {
    if (!breddeCache.has(t)) {
      maalCtx.font = '700 100px "Atkinson Hyperlegible", system-ui, sans-serif';
      breddeCache.set(t, maalCtx.measureText(t).width / 100);
    }
    return breddeCache.get(t);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => breddeCache.clear());

  function tegnBoble(b) {
    const d = b.r * 2;
    b.el.style.width = d + 'px';
    b.el.style.height = d + 'px';
    const plass = (d * 0.80) / tekstBredde(b.tekst);
    b.el.style.fontSize = Math.max(9, Math.min(b.r * 0.40, 32, plass)) + 'px';
    b.el.style.setProperty('--x', (b.x - b.r) + 'px');
    b.el.style.setProperty('--y', (b.y - b.r) + 'px');
    b.el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`;
  }
  function dekning() {
    const { w, h } = flate();
    const sum = bobler.reduce((s, b) => s + Math.PI * b.r * b.r, 0);
    return Math.min(1, sum / (Math.max(1, w * h) * MAKS_DEKNING));
  }

  // ---------- skriving ----------
  // Boblen sprekker med en gang svaret er entydig. Passer det du har skrevet også
  // på begynnelsen av et lengre svar, venter spillet på neste tast. Enter velger.
  function sjekkSkriving(medEnter) {
    const tekst = reint(typeInput.value);
    marker(tekst);
    if (!tekst) return;
    const eksakt = bobler.filter(b => b.svar.includes(tekst));
    const lengre = bobler.filter(b => b.svar.some(s => s.startsWith(tekst) && s.length > tekst.length));
    if (eksakt.length && (medEnter || !lengre.length)) {
      eksakt.sort((a, b) => b.r - a.r);
      sprekk(eksakt[0]);
      typeInput.value = ''; marker('');
      return;
    }
    if (medEnter) {
      feil++; rekke = 0;
      typeInput.classList.add('bad');
      setTimeout(() => typeInput.classList.remove('bad'), 320);
      typeInput.value = ''; marker(''); oppdaterTall();
    }
  }
  function marker(tekst) {
    bobler.forEach(b => b.el.classList.toggle('hit', !!tekst && b.svar.some(s => s.startsWith(tekst))));
  }

  function sprekk(b) {
    const { w, h } = flate();
    const fart = Math.max(0, 1 - (b.r / (Math.min(w, h) * 0.34)));
    const gitt = Math.round((10 + 25 * fart) * (1 + Math.min(rekke, 9) * 0.1));
    poeng += gitt; riktige++; rekke++; besteRekke = Math.max(besteRekke, rekke);
    visPoeng(b, gitt);
    b.el.classList.add('pop');
    const el = b.el; setTimeout(() => el.remove(), 260);
    bobler = bobler.filter(x => x !== b);
    oppdaterTall(); meldPoeng();
  }
  function visPoeng(b, n) {
    const f = document.createElement('div');
    f.className = 'float'; f.textContent = '+' + n;
    f.style.left = (b.x - 12) + 'px'; f.style.top = (b.y - 10) + 'px';
    f.style.fontSize = Math.max(14, Math.min(b.r * 0.5, 30)) + 'px';
    stage.appendChild(f); setTimeout(() => f.remove(), 800);
  }
  function oppdaterTall() {
    $('#bScore').textContent = poeng; $('#bStreak').textContent = rekke; $('#bLevel').textContent = niva;
  }

  // ---------- spilløkka ----------
  function steg(naa) {
    if (!spillGaar) return;
    const dt = Math.min(0.1, (naa - forrigeTid) / 1000 || 0);
    forrigeTid = naa;
    if (!pauset) {
      spiltTid += dt;
      niva = nivaFor(spiltTid); hoyesteNiva = Math.max(hoyesteNiva, niva);
      const vf = vekstfart(niva), { w, h } = flate(), maksR = Math.min(w, h) * 0.36;
      bobler.forEach(b => {
        b.r = Math.min(maksR, b.r + vf * dt);
        b.x = w > 2 * b.r ? Math.min(Math.max(b.r, b.x), w - b.r) : w / 2;
        b.y = h > 2 * b.r ? Math.min(Math.max(b.r, b.y), h - b.r) : h / 2;
        tegnBoble(b);
      });
      nesteSpawn -= dt * 1000;
      if (nesteSpawn <= 0 && bobler.length < maksBobler(niva)) {
        nyBoble(); nesteSpawn = spawnPause(niva) * (0.75 + Math.random() * 0.5);
      }
      const d = dekning();
      $('#bFillBar').style.width = (d * 100).toFixed(0) + '%';
      $('#bFillOut').textContent = Math.round(d * 100) + ' %';
      oppdaterTall(); meldDuell(d);
      if (d >= 1) { avslutt('full'); return; }
    }
    requestAnimationFrame(steg);
  }

  function start() {
    byggListe();
    bobler.forEach(b => b.el.remove());
    bobler = []; poeng = 0; rekke = 0; besteRekke = 0; riktige = 0; feil = 0;
    niva = 1; hoyesteNiva = 1; spiltTid = 0; nesteSpawn = 0;
    spillGaar = true; pauset = false; forrigeTid = 0;
    $('#bStart').hidden = true; $('#bOver').hidden = true; $('#bWait').hidden = true;
    $('#bTypebar').hidden = false; $('#bPause').hidden = false; $('#bPause').textContent = 'Pause';
    typeInput.value = ''; typeInput.focus();
    oppdaterTall();
    $('#bFillBar').style.width = '0%'; $('#bFillOut').textContent = '0 %';
    nyBoble();
    requestAnimationFrame(steg);
  }

  function avslutt(grunn, tekst) {
    if (!spillGaar) return;
    spillGaar = false;
    $('#bTypebar').hidden = true; $('#bPause').hidden = true;
    const bom = bobler.map(b => `${b.tekst} (${b.fasit})`);
    $('#bRScore').textContent = poeng; $('#bRRight').textContent = riktige;
    $('#bRBest').textContent = besteRekke; $('#bRLevel').textContent = hoyesteNiva;
    $('#bMissed').textContent = bom.length ? 'Disse rakk du ikke: ' + bom.join(', ') + '.' : '';
    if (grunn === 'tapt') { $('#bOverTitle').textContent = 'Du tapte runden'; $('#bOverText').textContent = tekst || 'Skjermen din ble full først.'; }
    else if (grunn === 'vunnet') { $('#bOverTitle').textContent = 'Du vant runden!'; $('#bOverText').textContent = tekst || 'Motstanderen fikk skjermen full først.'; }
    else { $('#bOverTitle').textContent = 'Skjermen ble full'; $('#bOverText').textContent = `Du holdt det gående i ${Math.round(spiltTid)} sekunder.`; }
    $('#bOver').hidden = false;
    if (grunn === 'full' && modus === 'duell') meldDuellSlutt();
    meldTimekode(true);
  }

  // ================= Firebase: rom, timekode og duell =================
  const adj = ['Raske','Lynraske','Smarte','Ville','Smidige','Modige','Gylne','Flinke','Dristige','Skarpe'];
  const dyr = ['Gaupe','Rev','Bjørn','Ulv','Hauk','Ugle','Løve','Tiger','Ørn','Gepard','Panter','Falken'];
  const fbKlar = () => window._fbReady && window._db;
  function lesOkt() {
    try {
      const o = JSON.parse(sessionStorage.getItem('matte_session') || 'null');
      if (!o || o.skipped) return null;
      if (o.expires && Date.now() > o.expires) return null;
      return o;
    } catch (e) { return null; }
  }
  let sisteMeldt = 0, duellStoppet = false, tcStart = Date.now(), sisteTc = 0;

  function meldPoeng() {
    if (romkode && fbKlar()) {
      try { window._update(window._ref(window._db, 'rooms/' + romkode + '/players/' + window.playerName), { score: poeng, lastUpdated: Date.now() }); } catch (e) {}
    }
    meldTimekode(false);
  }
  function meldTimekode(tving) {
    const naa = Date.now();
    if (!tving && naa - sisteTc < 4000) return;
    sisteTc = naa;
    if (typeof syncToTimecodeGeneric !== 'function') return;
    syncToTimecodeGeneric(cfg.spillnavn, {
      score: poeng, correct: riktige, wrong: feil, level: niva, maxLevel: hoyesteNiva,
      sett: valgtSett, retning: valgtRetning || '', streak: besteRekke, sessionStart: tcStart
    });
  }
  function meldDuell(d) {
    if (modus !== 'duell' || !romkode || !fbKlar()) return;
    const naa = Date.now();
    if (naa - sisteMeldt < 400) return;
    sisteMeldt = naa;
    try {
      window._update(window._ref(window._db, 'duell/' + romkode + '/players/' + window.playerName),
        { fill: Math.round(d * 100), score: poeng, alive: true, spill: cfg.spillnavn, lastUpdated: naa });
    } catch (e) {}
  }
  function meldDuellSlutt() {
    if (!romkode || !fbKlar()) return;
    try {
      window._update(window._ref(window._db, 'duell/' + romkode), { over: true, loser: window.playerName, at: Date.now() });
      window._update(window._ref(window._db, 'duell/' + romkode + '/players/' + window.playerName), { alive: false, fill: 100 });
    } catch (e) {}
  }
  function startDuell(kode, klar) {
    romkode = kode;
    $('#bRoom').hidden = false; $('#bRoomCode').textContent = kode;
    rot.classList.add('duel');
    if (!fbKlar()) { klar(false); return; }
    const base = 'duell/' + kode;
    window._set(window._ref(window._db, base + '/players/' + window.playerName), { fill: 0, score: 0, alive: true, spill: cfg.spillnavn, lastUpdated: Date.now() });
    window._set(window._ref(window._db, base + '/over'), null);
    window._set(window._ref(window._db, 'rooms/' + kode + '/players/' + window.playerName), { score: 0, lastUpdated: Date.now() });
    window._onValue(window._ref(window._db, base), snap => {
      const d = snap.val() || {};
      const andre = Object.entries(d.players || {}).filter(([n]) => n !== window.playerName);
      $('#bWaitList').textContent = andre.length ? 'Motstander på plass: ' + andre[0][0] : 'Du er den eneste her akkurat nå.';
      if (andre.length) {
        $('#bOppName').textContent = andre[0][0];
        $('#bOppBar').style.width = (andre[0][1].fill || 0) + '%';
        $('#bOppOut').textContent = (andre[0][1].fill || 0) + ' %';
        klar(true);
      }
      if (d.over && !duellStoppet) {
        duellStoppet = true;
        if (d.loser === window.playerName) avslutt('tapt');
        else avslutt('vunnet', d.loser + ' fikk skjermen full først.');
      }
    });
    klar(false);
  }
  function forlatDuell() {
    if (!romkode || !fbKlar()) return;
    try { window._set(window._ref(window._db, 'duell/' + romkode + '/players/' + window.playerName), null); } catch (e) {}
  }

  // ================= Skjermbildet =================
  function byggUI() {
    const settKnapper = cfg.sett.map((s, i) =>
      `<button class="choice" data-set="${s.id}" aria-pressed="${i === 0}">${s.navn}</button>`).join('');
    const retningFelt = (cfg.retninger && cfg.retninger.length) ? `
      <div class="field">
        <span>Retning</span>
        <div class="choices" id="bDirChoices">${cfg.retninger.map((r, i) =>
          `<button class="choice" data-dir="${r.id}" aria-pressed="${i === 0}">${r.navn}</button>`).join('')}</div>
      </div>` : '';
    rot.innerHTML = `
      <header class="top">
        <h1>${cfg.tittel}</h1>
        <span class="badge" id="bSetBadge">${cfg.sett[0].navn}</span>
        <span class="stat">Poeng <b id="bScore">0</b></span>
        <span class="stat">Rekke <b id="bStreak">0</b></span>
        <span class="stat">Nivå <b id="bLevel">1</b></span>
        <span class="grow"></span>
        <span class="badge" id="bName" hidden></span>
        <span class="badge" id="bRoom" hidden>🏎️ <span id="bRoomCode"></span></span>
        <button class="btn" id="bPause" hidden>Pause</button>
        <a class="btn" href="${cfg.menyLenke || './'}">Meny</a>
      </header>

      <div class="stage" id="bStage">
        <div class="screen" id="bStart">
          <div class="sheet">
            <h2>${cfg.overskrift || cfg.tittel.replace(/^[^\wÆØÅæøå]+/, '')}</h2>
            <p>${cfg.intro}</p>
            <div class="field">
              <span>${cfg.settTittel || 'Hva vil du øve på?'}</span>
              <div class="choices" id="bSetChoices">${settKnapper}</div>
            </div>
            ${retningFelt}
            <div class="field">
              <span>Spillemåte</span>
              <div class="choices" id="bModeChoices">
                <button class="choice" data-mode="solo" aria-pressed="true">Alene</button>
                <button class="choice" data-mode="duell" aria-pressed="false">Mot en annen elev</button>
              </div>
            </div>
            <div class="field" id="bRoomField" hidden>
              <span>Kampkode – begge skriver den samme</span>
              <input type="text" id="bRoomInput" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="F.eks. KODE1">
              <p class="note" style="margin:.4rem 0 0">Bruker dere timekoden fra læreren, følger poengene med på banen i klasserommet.</p>
            </div>
            <div class="row">
              <button class="btn primary big" id="bStartBtn">Start</button>
              <span class="note" id="bSessionNote"></span>
            </div>
          </div>
        </div>

        <div class="screen" id="bWait" hidden>
          <div class="sheet">
            <h2>Venter på motstander</h2>
            <p>Kampkode: <b id="bWaitCode"></b>. Spillet starter når begge er inne.</p>
            <div class="wait"><span id="bWaitList">Du er den eneste her akkurat nå.</span></div>
            <div class="row">
              <button class="btn primary" id="bWaitSolo">Start alene i stedet</button>
              <button class="btn" id="bWaitCancel">Avbryt</button>
            </div>
          </div>
        </div>

        <div class="screen" id="bOver" hidden>
          <div class="sheet">
            <h2 id="bOverTitle">Skjermen ble full</h2>
            <p id="bOverText"></p>
            <div class="result">
              <div><b id="bRScore">0</b><span>poeng</span></div>
              <div><b id="bRRight">0</b><span>riktige</span></div>
              <div><b id="bRBest">0</b><span>beste rekke</span></div>
              <div><b id="bRLevel">1</b><span>høyeste nivå</span></div>
            </div>
            <p class="note" id="bMissed"></p>
            <div class="row">
              <button class="btn primary big" id="bAgain">Spill igjen</button>
              <button class="btn" id="bChange">Endre innstillinger</button>
            </div>
          </div>
        </div>
      </div>

      <div class="typebar" id="bTypebar" hidden>
        <input type="text" id="bType" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Skriv svaret" placeholder="${cfg.ledetekst || 'skriv svaret …'}">
        <div class="meter">
          <div class="lbl"><span>Full skjerm</span><span id="bFillOut">0 %</span></div>
          <div class="bar"><div class="fill" id="bFillBar"></div></div>
        </div>
        <div class="meter opp">
          <div class="lbl"><span id="bOppName">Motstander</span><span id="bOppOut">0 %</span></div>
          <div class="bar"><div class="fill" id="bOppBar"></div></div>
        </div>
      </div>`;
    stage = $('#bStage');
    typeInput = $('#bType');
  }

  function koble() {
    const merk = (gruppe, felt, verdi) =>
      gruppe.querySelectorAll('.choice').forEach(b => b.setAttribute('aria-pressed', b.dataset[felt] === verdi));

    $('#bSetChoices').addEventListener('click', ev => {
      const b = ev.target.closest('.choice'); if (!b) return;
      valgtSett = b.dataset.set; merk($('#bSetChoices'), 'set', valgtSett);
      $('#bSetBadge').textContent = b.textContent;
    });
    if ($('#bDirChoices')) $('#bDirChoices').addEventListener('click', ev => {
      const b = ev.target.closest('.choice'); if (!b) return;
      valgtRetning = b.dataset.dir; merk($('#bDirChoices'), 'dir', valgtRetning);
    });
    $('#bModeChoices').addEventListener('click', ev => {
      const b = ev.target.closest('.choice'); if (!b) return;
      modus = b.dataset.mode; merk($('#bModeChoices'), 'mode', modus);
      $('#bRoomField').hidden = modus !== 'duell';
    });
    $('#bStartBtn').addEventListener('click', () => {
      if (modus === 'duell') {
        const kode = ($('#bRoomInput').value || '').trim().toUpperCase();
        if (!kode) { $('#bRoomInput').focus(); return; }
        duellStoppet = false;
        $('#bStart').hidden = true; $('#bWait').hidden = false; $('#bWaitCode').textContent = kode;
        let startet = false;
        startDuell(kode, motstanderKlar => {
          if (motstanderKlar && !startet) { startet = true; $('#bWait').hidden = true; start(); }
        });
        setTimeout(() => {
          if (startet || $('#bWait').hidden) return;
          $('#bWaitList').textContent = fbKlar()
            ? 'Ingen motstander ennå. Sjekk at dere har skrevet nøyaktig samme kampkode.'
            : 'Får ikke kontakt med nettverket. Du kan spille alene i stedet.';
        }, 5000);
      } else {
        const s = typeof getActiveSession === 'function' ? getActiveSession() : null;
        romkode = s && s.code ? s.code : null;
        if (romkode) { $('#bRoom').hidden = false; $('#bRoomCode').textContent = romkode; }
        start();
      }
    });
    $('#bWaitCancel').addEventListener('click', () => { forlatDuell(); $('#bWait').hidden = true; $('#bStart').hidden = false; });
    $('#bWaitSolo').addEventListener('click', () => { modus = 'solo'; rot.classList.remove('duel'); $('#bWait').hidden = true; start(); });
    $('#bAgain').addEventListener('click', () => { duellStoppet = false; start(); });
    $('#bChange').addEventListener('click', () => { $('#bOver').hidden = true; $('#bStart').hidden = false; });
    $('#bPause').addEventListener('click', () => {
      pauset = !pauset;
      $('#bPause').textContent = pauset ? 'Fortsett' : 'Pause';
      if (!pauset) { forrigeTid = performance.now(); typeInput.focus(); }
    });
    typeInput.addEventListener('input', () => sjekkSkriving(false));
    typeInput.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { sjekkSkriving(true); ev.preventDefault(); }
      if (ev.key === 'Escape') { typeInput.value = ''; marker(''); }
    });
    stage.addEventListener('pointerdown', () => { if (spillGaar && !pauset) typeInput.focus(); });
    window.addEventListener('beforeunload', () => {
      forlatDuell();
      if (romkode && fbKlar()) { try { window._set(window._ref(window._db, 'rooms/' + romkode + '/players/' + window.playerName), null); } catch (e) {} }
    });
  }

  function start_(config) {
    cfg = config;
    valgtSett = cfg.sett[0].id;
    valgtRetning = (cfg.retninger && cfg.retninger.length) ? cfg.retninger[0].id : null;
    window.playerName = window.playerName ||
      adj[Math.floor(Math.random() * adj.length)] + ' ' + dyr[Math.floor(Math.random() * dyr.length)];
    rot = document.createElement('div');
    rot.className = 'bobler';
    document.body.appendChild(rot);
    byggUI();
    koble();
    byggListe();
    // getActiveSession gir bare noe tilbake når eleven har timekode.
    // Navnet vises likevel, om eleven har skrevet det inn på menysiden.
    const s = lesOkt();
    if (s && s.name) {
      $('#bName').hidden = false; $('#bName').textContent = '👤 ' + s.name;
    }
    $('#bSessionNote').textContent = s && s.code
      ? 'Timekode ' + s.code + ' er aktiv, så læreren ser hva du jobber med.'
      : 'Uten timekode blir ingenting registrert.';
  }

  return { start: start_ };
})();
