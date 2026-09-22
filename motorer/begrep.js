/* Begrepsspillet – felles motor.
   Faget leverer par av begrep og forklaring, resten skjer her.

   Bruk:
     <link rel="stylesheet" href="/js/motorer/begrep.css">
     <script src="/js/spill-utils.js"></script>
     <script src="/js/motorer/begrep.js"></script>
     <script>
       Begrepsspill.start({
         spillnavn: 'begrep-kjemi',
         tittel: '🧩 Begrepsjakten',
         intro: 'Kort forklaring til eleven.',
         sett: [{ id: 'kjemi', navn: 'Kjemi', par: [['proton', 'Positivt ladd partikkel i kjernen.']] }]
       });
     </script>
*/
window.Begrepsspill = (function () {
  'use strict';

  let cfg = null, rot = null;
  const $ = s => rot.querySelector(s);
  const bland = liste => liste.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

  let valgtSett = null, modus = 'par', romkode = null;
  let par = [], igjen = [], paaBrettet = [], valgtKort = null, laast = false;
  let poeng = 0, riktige = 0, feil = 0, rekke = 0, besteRekke = 0, bom = [];
  let start = 0, spmStart = 0, spmNr = 0, gjeldende = null, ferdig = false;

  const PAR_PAA_BRETT = 4;

  // ---------- oppstart ----------
  function nyRunde() {
    const s = cfg.sett.find(x => x.id === valgtSett) || cfg.sett[0];
    par = s.par.map(p => ({ begrep: p[0], forklaring: p[1] }));
    igjen = bland(par.slice());
    poeng = 0; riktige = 0; feil = 0; rekke = 0; besteRekke = 0; bom = [];
    paaBrettet = []; valgtKort = null; laast = false; spmNr = 0; ferdig = false;
    start = Date.now();
    $('#bgStart').hidden = true; $('#bgSlutt').hidden = true; $('#bgFelt').hidden = false;
    tall();
    if (modus === 'par') startPar(); else nesteSpørsmål();
  }
  function tall() {
    $('#bgPoeng').textContent = poeng;
    $('#bgRiktige').textContent = riktige;
    $('#bgRekke').textContent = rekke;
    $('#bgFramdrift').textContent = modus === 'par'
      ? `${riktige} av ${par.length}`
      : `${Math.min(spmNr, par.length)} av ${par.length}`;
  }
  function gi(poengFor, msBrukt) {
    const fart = Math.max(0, 1 - msBrukt / 15000);
    const sum = Math.round((poengFor + 20 * fart) * (1 + Math.min(rekke, 9) * 0.1));
    poeng += sum; return sum;
  }

  // ---------- parspill ----------
  function fyllBrett() {
    while (paaBrettet.length < PAR_PAA_BRETT && igjen.length) paaBrettet.push(igjen.shift());
    const kort = bland(paaBrettet.flatMap(p => [
      { p, type: 'begrep', tekst: p.begrep },
      { p, type: 'forklaring', tekst: p.forklaring }
    ]));
    $('#bgKort').innerHTML = kort.map((k, i) =>
      `<button class="kort ${k.type === 'begrep' ? 'begrep-kort' : ''}" data-i="${i}">${k.tekst}</button>`).join('');
    [...$('#bgKort').children].forEach((el, i) => { el._kort = kort[i]; });
    spmStart = Date.now();
  }
  function startPar() {
    $('#bgPar').hidden = false; $('#bgHurtig').hidden = true;
    fyllBrett();
  }
  function klikkKort(el) {
    if (laast || el.classList.contains('borte')) return;
    const k = el._kort;
    if (!valgtKort) { valgtKort = { el, k }; el.classList.add('valgt'); return; }
    if (valgtKort.el === el) { el.classList.remove('valgt'); valgtKort = null; return; }
    const a = valgtKort, b = { el, k };
    valgtKort = null; a.el.classList.remove('valgt');
    if (a.k.p === b.k.p && a.k.type !== b.k.type) {
      riktige++; rekke++; besteRekke = Math.max(besteRekke, rekke);
      const fikk = gi(20, Date.now() - spmStart);
      spmStart = Date.now();
      [a.el, b.el].forEach(e => { e.classList.add('riktig'); });
      laast = true;
      setTimeout(() => {
        [a.el, b.el].forEach(e => e.classList.add('borte'));
        paaBrettet = paaBrettet.filter(p => p !== a.k.p);
        laast = false;
        if (!paaBrettet.length && !igjen.length) return avslutt();
        if (paaBrettet.length <= PAR_PAA_BRETT - 2 || !paaBrettet.length) fyllBrett();
      }, 420);
      meld(`Riktig! ${a.k.p.begrep} · +${fikk}`);
    } else {
      feil++; rekke = 0;
      if (a.k.type === 'begrep') bom.push(a.k.p.begrep); else if (b.k.type === 'begrep') bom.push(b.k.p.begrep);
      laast = true;
      [a.el, b.el].forEach(e => e.classList.add('feil'));
      setTimeout(() => { [a.el, b.el].forEach(e => e.classList.remove('feil')); laast = false; }, 520);
      meld('Ikke riktig par. Prøv igjen.');
    }
    tall();
  }

  // ---------- hurtigrunde ----------
  function nesteSpørsmål() {
    $('#bgPar').hidden = true; $('#bgHurtig').hidden = false;
    if (spmNr >= par.length) return avslutt();
    gjeldende = igjen[spmNr];
    spmNr++;
    const feilSvar = bland(par.filter(p => p !== gjeldende)).slice(0, 3);
    const alt = bland([gjeldende, ...feilSvar]);
    $('#bgSpm').textContent = gjeldende.forklaring;
    $('#bgSvar').innerHTML = alt.map((p, i) => `<button data-i="${i}">${p.begrep}</button>`).join('');
    [...$('#bgSvar').children].forEach((el, i) => { el._par = alt[i]; });
    $('#bgFasit').textContent = '';
    spmStart = Date.now();
    tall();
  }
  function svar(el) {
    if (laast) return;
    laast = true;
    const riktig = el._par === gjeldende;
    [...$('#bgSvar').children].forEach(b => { b.disabled = true; if (b._par === gjeldende) b.classList.add('riktig'); });
    if (riktig) {
      riktige++; rekke++; besteRekke = Math.max(besteRekke, rekke);
      const fikk = gi(15, Date.now() - spmStart);
      $('#bgFasit').innerHTML = `Riktig · +${fikk} poeng`;
    } else {
      feil++; rekke = 0; bom.push(gjeldende.begrep);
      el.classList.add('feil');
      $('#bgFasit').innerHTML = `Riktig svar er <b>${gjeldende.begrep}</b>`;
    }
    tall(); meldPoeng();
    setTimeout(() => { laast = false; nesteSpørsmål(); }, riktig ? 700 : 1600);
  }

  // ---------- slutt ----------
  function avslutt() {
    ferdig = true;
    const sek = Math.round((Date.now() - start) / 1000);
    $('#bgFelt').hidden = true; $('#bgSlutt').hidden = false;
    $('#bgRPoeng').textContent = poeng;
    $('#bgRRiktige').textContent = riktige;
    $('#bgRFeil').textContent = feil;
    $('#bgRTid').textContent = sek + ' s';
    const unike = [...new Set(bom)];
    $('#bgBom').innerHTML = unike.length
      ? '<p class="note">Disse bommet du på underveis:</p><ul class="liste">' +
        unike.map(b => { const p = par.find(x => x.begrep === b); return `<li><b>${b}</b> – ${p ? p.forklaring : ''}</li>`; }).join('') + '</ul>'
      : '<p class="note">Du traff på alle uten bom.</p>';
    meldPoeng(); meldTimekode(true);
  }

  // ---------- Firebase ----------
  const adj = ['Raske','Lynraske','Smarte','Ville','Smidige','Modige','Gylne','Flinke','Dristige','Skarpe'];
  const dyr = ['Gaupe','Rev','Bjørn','Ulv','Hauk','Ugle','Løve','Tiger','Ørn','Gepard','Panter','Falken'];
  const fbKlar = () => window._fbReady && window._db;
  let tcStart = Date.now(), sisteTc = 0;
  function meldPoeng() {
    if (romkode && fbKlar()) {
      try { window._update(window._ref(window._db, 'rooms/' + romkode + '/players/' + window.playerName), { score: poeng, lastUpdated: Date.now() }); } catch (e) {}
    }
    meldTimekode(false);
  }
  function meldTimekode(tving) {
    const nå = Date.now();
    if (!tving && nå - sisteTc < 4000) return;
    sisteTc = nå;
    if (typeof syncToTimecodeGeneric !== 'function') return;
    syncToTimecodeGeneric(cfg.spillnavn, {
      score: poeng, correct: riktige, wrong: feil, streak: besteRekke,
      modus, sett: valgtSett, ferdig: ferdig ? 1 : 0, sessionStart: tcStart
    });
  }
  function lesØkt() {
    try {
      const o = JSON.parse(sessionStorage.getItem('matte_session') || 'null');
      if (!o || o.skipped) return null;
      if (o.expires && Date.now() > o.expires) return null;
      return o;
    } catch (e) { return null; }
  }

  // ---------- meldinger ----------
  let meldTimer = null;
  function meld(tekst) {
    const el = $('#bgMeld');
    el.textContent = tekst;
    clearTimeout(meldTimer);
    meldTimer = setTimeout(() => { el.textContent = ''; }, 2600);
  }

  // ---------- skjermbildet ----------
  function byggUI() {
    const settKnapper = cfg.sett.map((s, i) =>
      `<button data-set="${s.id}" aria-pressed="${i === 0}">${s.navn}<span class="und">${s.par.length} begreper</span></button>`).join('');
    rot.innerHTML = `
      <header class="top">
        <h1>${cfg.tittel}</h1>
        <span class="badge" id="bgModus">Parspill</span>
        <span class="stat">Poeng <b id="bgPoeng">0</b></span>
        <span class="stat">Riktige <b id="bgRiktige">0</b></span>
        <span class="stat">Rekke <b id="bgRekke">0</b></span>
        <span class="badge" id="bgFramdrift">0 av 0</span>
        <span class="grow"></span>
        <span class="badge" id="bgNavn" hidden></span>
        <span class="badge" id="bgRom" hidden>🏎️ <span id="bgRomKode"></span></span>
        <button class="btn" id="bgAvbryt" hidden>Avslutt runden</button>
        <a class="btn" href="${cfg.menyLenke || './'}">Meny</a>
      </header>

      <div class="felt" id="bgStart">
        <div class="sheet">
          <h2>${cfg.overskrift || cfg.tittel.replace(/^[^\wÆØÅæøå]+/, '')}</h2>
          <p>${cfg.intro}</p>
          <div class="valg" id="bgModusValg">
            <button data-mode="par" aria-pressed="true">Parspill<span class="und">Finn begrepet som hører til forklaringen</span></button>
            <button data-mode="hurtig" aria-pressed="false">Hurtigrunde<span class="und">Velg riktig begrep så raskt du kan</span></button>
          </div>
          ${cfg.sett.length > 1 ? `<div class="valg" id="bgSettValg">${settKnapper}</div>` : ''}
          <div class="rad">
            <button class="btn primary big" id="bgStartBtn">Start</button>
            <span class="note" id="bgØktNote"></span>
          </div>
        </div>
      </div>

      <div class="felt" id="bgFelt" hidden>
        <div class="ark">
          <div id="bgPar" hidden><div class="kort-rad" id="bgKort"></div></div>
          <div id="bgHurtig" hidden>
            <div class="spm" id="bgSpm"></div>
            <div class="svar" id="bgSvar"></div>
            <div class="fasit" id="bgFasit"></div>
          </div>
          <p class="fasit" id="bgMeld"></p>
        </div>
      </div>

      <div class="felt" id="bgSlutt" hidden>
        <div class="sheet">
          <h2>Runden er ferdig</h2>
          <div class="resultat">
            <div><b id="bgRPoeng">0</b><span>poeng</span></div>
            <div><b id="bgRRiktige">0</b><span>riktige</span></div>
            <div><b id="bgRFeil">0</b><span>bom</span></div>
            <div><b id="bgRTid">0 s</b><span>tid</span></div>
          </div>
          <div id="bgBom"></div>
          <div class="rad">
            <button class="btn primary big" id="bgIgjen">Spill igjen</button>
            <button class="btn" id="bgTilbake">Endre innstillinger</button>
          </div>
        </div>
      </div>`;
  }

  function koble() {
    const merk = (gruppe, felt, verdi) =>
      gruppe.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset[felt] === verdi));
    $('#bgModusValg').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      modus = b.dataset.mode; merk($('#bgModusValg'), 'mode', modus);
      $('#bgModus').textContent = modus === 'par' ? 'Parspill' : 'Hurtigrunde';
    });
    if ($('#bgSettValg')) $('#bgSettValg').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      valgtSett = b.dataset.set; merk($('#bgSettValg'), 'set', valgtSett);
    });
    $('#bgStartBtn').addEventListener('click', () => {
      const s = lesØkt();
      romkode = s && s.code ? s.code : null;
      if (romkode) { $('#bgRom').hidden = false; $('#bgRomKode').textContent = romkode; }
      $('#bgAvbryt').hidden = false;
      nyRunde();
    });
    $('#bgKort').addEventListener('click', ev => { const k = ev.target.closest('.kort'); if (k) klikkKort(k); });
    $('#bgSvar').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b && !b.disabled) svar(b); });
    $('#bgIgjen').addEventListener('click', nyRunde);
    $('#bgTilbake').addEventListener('click', () => { $('#bgSlutt').hidden = true; $('#bgStart').hidden = false; $('#bgAvbryt').hidden = true; });
    $('#bgAvbryt').addEventListener('click', () => { if (!ferdig) avslutt(); $('#bgAvbryt').hidden = true; });
    document.addEventListener('keydown', ev => {
      if ($('#bgHurtig').hidden || laast) return;
      const n = Number(ev.key);
      if (n >= 1 && n <= 4) { const b = $('#bgSvar').children[n - 1]; if (b) svar(b); }
    });
  }

  function start_(config) {
    cfg = config;
    valgtSett = cfg.sett[0].id;
    window.playerName = window.playerName ||
      adj[Math.floor(Math.random() * adj.length)] + ' ' + dyr[Math.floor(Math.random() * dyr.length)];
    rot = document.createElement('div');
    rot.className = 'begrep';
    document.body.appendChild(rot);
    byggUI(); koble();
    const s = lesØkt();
    if (s && s.name) { $('#bgNavn').hidden = false; $('#bgNavn').textContent = '👤 ' + s.name; }
    $('#bgØktNote').textContent = s && s.code
      ? 'Timekode ' + s.code + ' er aktiv, så poengene følger med på banen.'
      : 'Uten timekode blir ingenting registrert.';
  }

  return { start: start_ };
})();
