// ── logg.js ──
// Felles logging for verktøy som ikke er spill, altså sider uten poeng.
// Registrerer bare når eleven har en gyldig timekode, og sender resultater,
// ikke hvert klikk. Alt havner i timecodes/KODE/players/NAVN/games/<navn>.
//
// Bruk:
//   <script src="./js/firebase-config.js" type="module"> ... globalene ... </script>
//   <script src="./js/spill-utils.js"></script>
//   <script src="./js/logg.js"></script>
//   Logg.start('periodesystem');
//   Logg.tell('grunnstoff', 'Na');     // teller unike verdier
//   Logg.tell('atom');                 // teller antall
//
// Feltene som sendes: minutter (aktiv tid), pluss det siden selv teller.

window.Logg = (function () {
  'use strict';

  const MAKS_LISTE = 30;          // hvor mange navn vi tar vare på i rapporten
  const PAUSE_ETTER = 90000;      // står siden urørt så lenge, telles ikke tiden
  const SEND_HVER = 20000;

  let spillnavn = null, aktiv = 0, sistTikk = Date.now(), sistBruk = Date.now();
  let tellere = {}, lister = {}, endret = false, startet = 0;

  function iBruk() {
    return !document.hidden && (Date.now() - sistBruk) < PAUSE_ETTER;
  }
  function tikk() {
    const nå = Date.now();
    if (iBruk()) aktiv += nå - sistTikk;
    sistTikk = nå;
  }
  function data() {
    const ut = { minutter: Math.round(aktiv / 60000 * 10) / 10, startet, ...tellere };
    Object.entries(lister).forEach(([k, sett]) => {
      ut[k] = [...sett].slice(0, MAKS_LISTE).join(', ');
      ut['antall' + k[0].toUpperCase() + k.slice(1)] = sett.size;
    });
    return ut;
  }
  function send(tving) {
    tikk();
    if (!spillnavn || (!endret && !tving)) return;
    endret = false;
    if (typeof syncToTimecodeGeneric === 'function') syncToTimecodeGeneric(spillnavn, data());
  }

  function start(navn) {
    spillnavn = navn;
    startet = Date.now();
    sistTikk = Date.now(); sistBruk = Date.now();
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(h =>
      document.addEventListener(h, () => { sistBruk = Date.now(); }, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => { tikk(); if (document.hidden) send(true); });
    window.addEventListener('pagehide', () => send(true));
    setInterval(() => send(false), SEND_HVER);
    setTimeout(() => send(true), 4000);         // vis at eleven er i gang
  }

  // tell('atom') teller opp, tell('grunnstoff', 'Na') teller unike verdier
  function tell(felt, verdi) {
    if (!spillnavn) return;
    sistBruk = Date.now();
    if (verdi === undefined) tellere[felt] = (tellere[felt] || 0) + 1;
    else {
      if (!lister[felt]) lister[felt] = new Set();
      if (lister[felt].has(verdi)) return;
      lister[felt].add(verdi);
    }
    endret = true;
  }

  return { start, tell, send: () => send(true) };
})();
