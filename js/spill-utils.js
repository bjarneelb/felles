// ── spill-utils.js v2.6 ──
// Felles hjelpefunksjoner for alle fagsider og spill.
//
// VIKTIG: Lastes i <head>, FØR spillets egen kode:
//   <script src="./js/spill-utils.js"></script>   (spill i roten)
//   <script src="../js/spill-utils.js"></script>  (spill i undermappe)
// Da er window.playerName satt før spillet starter, og et spill kan trygt lage
// sin egen versjon av en funksjon her (den nyeste definisjonen vinner).
// Originalene ligger alltid tilgjengelig i window.SU.

// Innstillinger ligger samlet her, så de ikke kolliderer med navn i sidene
window.SU_CONF=window.SU_CONF||{
  sessionKey:'matte_session',
  nickKey:'spiller_nick',
  nickWords:['Tiger','Drage','Ørn','Falk','Ulv','Bjørn','Rev','Hauk','Puma','Leopard',
    'Kobra','Delfin','Hai','Panter','Gaupe','Jerv','Vandrefalk','Kongeørn','Lynx','Oter'],
};

// ── SESJON ──
function generateNickname(){
  const w=window.SU_CONF.nickWords;
  return w[Math.floor(Math.random()*w.length)]+(Math.floor(Math.random()*90)+10);
}
function readSession(){
  try{ return JSON.parse(sessionStorage.getItem(window.SU_CONF.sessionKey)||'null'); }catch(e){ return null; }
}
// Gyldig timekode-sesjon (brukes til rapportering). null uten gyldig kode.
function getActiveSession(){
  const s=readSession();
  if(!s||s.skipped||s.noCode||s.expired||!s.code) return null;
  if(s.expires&&Date.now()>s.expires) return null;
  return s;
}

// ── SPILLERNAVN (nickname) ──
// Samme nickname i alle spill til fanen lukkes. Det ekte navnet vises aldri på skjerm.
function getNickname(){
  const s=readSession();
  if(s&&!s.skipped){
    if(!s.nickname){
      s.nickname=generateNickname();
      try{ sessionStorage.setItem(window.SU_CONF.sessionKey,JSON.stringify(s)); }catch(e){}
    }
    return s.nickname;
  }
  let n=null;
  try{ n=sessionStorage.getItem(window.SU_CONF.nickKey); }catch(e){}
  if(!n){
    n=generateNickname();
    try{ sessionStorage.setItem(window.SU_CONF.nickKey,n); }catch(e){}
  }
  return n;
}
window.playerName=getNickname();

// ── FIREBASE-HJELP ──
function whenFb(cb){
  if(window._fbReady) cb(); else setTimeout(()=>whenFb(cb),200);
}

// ── RAPPORTERING TIL TIMEKODE ──
// Bruk: syncToTimecode('spillnavn', {level, startLevel, maxLevel, score, correct, wrong, sessionStart})
// Lagres under timecodes/KODE/players/EKTE_NAVN/games/spillnavn
function syncToTimecode(spillnavn,data){
  // Husk hva eleven holder på med, så «rekk opp hånda» kan sende det med
  window.__suSist={spillnavn,level:data&&data.level,sett:data&&data.sett};
  const s=getActiveSession();
  if(!s||!s.name||!spillnavn) return;
  whenFb(()=>{
    window._update(window._ref(window._db,'timecodes/'+s.code+'/players/'+s.name+'/games/'+spillnavn),
      Object.assign({lastUpdated:Date.now()},data||{}));
    window._update(window._ref(window._db,'timecodes/'+s.code+'/players/'+s.name),
      {lastSeen:Date.now(),name:s.name,nickname:window.playerName});
  });
}
// Eldre navn, brukes fortsatt av naturfag og motorene
function syncToTimecodeGeneric(spillnavn,data){ window.SU.syncToTimecode(spillnavn,data); }

// Holder styr på startnivå og høyeste nivå for et spill
function levelTracker(){
  return {
    start:null, max:0,
    note(level){
      if(level===null||level===undefined) return;
      if(this.start===null) this.start=level;
      this.max=Math.max(this.max,level);
    }
  };
}

// ── ROM (baner) ──
function initRoom(code,onPlayers){
  const rb=document.getElementById('roomBadge');
  const rc=document.getElementById('roomBadgeCode');
  if(!code) return;
  code=String(code).trim().toUpperCase();
  function joinRoom(code){
    window._roomCode=code;
    if(rb) rb.style.display='';
    if(rc) rc.textContent=code;
    const name=window.playerName;
    window._update(window._ref(window._db,'rooms/'+code+'/players/'+name),{score:window.currentScore||0,lastUpdated:Date.now()});
    if(onPlayers){
      window._onValue(window._ref(window._db,'rooms/'+code+'/players'),snap=>{ if(snap.val()) onPlayers(snap.val()); });
    }
    window._onValue(window._ref(window._db,'rooms/'+code+'/matchOver'),snap=>{
      if(snap.val()!==true) return;
      const vis=d=>window.SU.showMatchOverToast((d&&d.result)||'Kampen er over!');
      if(window._get) window._get(window._ref(window._db,'rooms/'+code)).then(s=>vis(s.val())).catch(()=>vis(null));
      else vis(null);
    });
  }
  // Bli med først når rommet finnes (banen er åpnet på storskjermen). Til da sendes ingen poeng.
  whenFb(()=>{
    window._get(window._ref(window._db,'rooms/'+code+'/meta')).then(snap=>{
      if(snap.val()) joinRoom(code); else roomNotFound(code,joinRoom);
    }).catch(()=>joinRoom(code)); // ingen kontakt: ikke stopp eleven
  });
}
// Romkoden finnes ikke: la eleven skrive den på nytt, eller spille videre uten bane
function roomNotFound(code,joinRoom){
  if(document.getElementById('suRoomMissing')) return;
  const o=document.createElement('div');
  o.id='suRoomMissing';
  o.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Nunito,system-ui,sans-serif;';
  o.innerHTML='<div style="background:#fff;border-radius:16px;padding:22px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+
    '<div style="font-size:2.2rem">🏁</div><h3 style="font-size:1.15rem;font-weight:900;margin:4px 0 6px;color:#1e293b">Fant ikke rommet «'+suEsc(code)+'»</h3>'+
    '<p style="font-size:.9rem;font-weight:700;color:#64748b;line-height:1.5;margin-bottom:12px">Sjekk romkoden på storskjermen. Banen må være åpnet før du kan bli med.</p>'+
    '<input id="suRoomRetry" maxlength="8" value="'+suEsc(code)+'" style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:1.1rem;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:3px;margin-bottom:10px" autocomplete="off">'+
    '<div id="suRoomMsg" style="min-height:1.2em;color:#dc2626;font-weight:800;font-size:.85rem;margin-bottom:8px"></div>'+
    '<button id="suRoomTry" style="width:100%;padding:11px;border:none;border-radius:10px;background:#4f46e5;color:#fff;font-family:inherit;font-weight:900;font-size:1rem;cursor:pointer;margin-bottom:8px">Prøv igjen</button>'+
    '<button id="suRoomSkip" style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;color:#475569;font-family:inherit;font-weight:800;cursor:pointer">Spill uten bane</button></div>';
  document.body.appendChild(o);
  const inp=o.querySelector('#suRoomRetry'), msg=o.querySelector('#suRoomMsg');
  inp.focus(); inp.select();
  const tryIt=()=>{
    const c=inp.value.trim().toUpperCase();
    if(!c){ msg.textContent='Skriv inn romkoden.'; return; }
    msg.style.color='#64748b'; msg.textContent='Sjekker …';
    window._get(window._ref(window._db,'rooms/'+c+'/meta')).then(snap=>{
      if(!snap.val()){ msg.style.color='#dc2626'; msg.textContent='Fant ikke «'+c+'» heller. Er banen åpnet?'; return; }
      o.remove(); joinRoom(c);
    }).catch(()=>{ msg.style.color='#dc2626'; msg.textContent='Fikk ikke kontakt. Prøv igjen.'; });
  };
  o.querySelector('#suRoomTry').onclick=tryIt;
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter') tryIt(); });
  o.querySelector('#suRoomSkip').onclick=()=>{ o.remove(); window.gameMode='practice'; };
}
function syncRoomScore(score){
  const code=window._roomCode;
  if(!code||!window._fbReady) return;
  window._update(window._ref(window._db,'rooms/'+code+'/players/'+window.playerName),{score,lastUpdated:Date.now()});
}

// ── MELDINGER ──
function showMatchOverToast(result){
  if(document.getElementById('matchOverOverlay')) return;
  const overlay=document.createElement('div');
  overlay.id='matchOverOverlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:Nunito,sans-serif;';
  overlay.innerHTML=`
    <div style="font-size:3rem">🏆</div>
    <div style="color:white;font-size:1.6rem;font-weight:900;text-align:center;padding:0 20px">${result}</div>
    <div style="color:rgba(255,255,255,0.7);font-size:0.88rem;text-align:center;padding:0 20px">Kampen er over! Start et nytt spill med kampkoden for en ny kamp.</div>
    <a href="./" style="padding:12px 28px;background:#5b4fcf;color:white;border-radius:12px;font-weight:800;font-size:1rem;text-decoration:none;margin-top:8px">🏠 Tilbake til meny</a>`;
  document.body.appendChild(overlay);
}
function showToast(msg,type){
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=msg;
  t.className='toast '+type;
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}
function getRoomBadgeHTML(){
  return '<span class="badge" id="roomBadge" style="display:none;background:rgba(255,255,255,0.25);color:white;letter-spacing:1px">🏎️ <span id="roomBadgeCode"></span></span>';
}

// ── NIVÅVALG OG MODUS (krever LEVELS, currentLevel, gameMode i spillet) ──
function buildLevelSelect(){
  const el=document.getElementById('levelSelect');
  if(!el||typeof LEVELS==='undefined') return;
  el.innerHTML='';
  Object.keys(LEVELS).forEach(l=>{
    const btn=document.createElement('button');
    btn.className='level-btn'+(parseInt(l,10)===currentLevel?' active':'');
    btn.textContent=l;
    btn.title=LEVELS[l].desc||LEVELS[l].name||'';
    btn.onclick=()=>{
      currentLevel=parseInt(l,10);
      document.querySelectorAll('.level-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    };
    el.appendChild(btn);
  });
}
function selectMode(mode){
  gameMode=mode;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  // Nyere spill: én boks med id="multiOpts"
  const mo=document.getElementById('multiOpts');
  if(mo) mo.style.display=mode==='multi'?'block':'none';
  // Eldre spill: én boks per modus med id="opts-<modus>" og klassen .mode-options
  document.querySelectorAll('.mode-options[id^="opts-"]').forEach(el=>{
    el.classList.toggle('visible',el.id==='opts-'+mode);
  });
}

// ── ADAPTIV NIVÅJUSTERING (krever currentLevel, MIN_LEVEL, MAX_LEVEL, LEVELS, streak, errorStreak) ──
function recordResult(correct){
  const up=window.UP_STREAK||3, down=window.DOWN_ERRORS||2;
  if(correct){ errorStreak=0; streak=(streak||0)+1; if(streak>=up) window.SU.changeLevel(1); }
  else { streak=0; errorStreak=(errorStreak||0)+1; if(errorStreak>=down) window.SU.changeLevel(-1); }
}
function changeLevel(d){
  const n=Math.max(MIN_LEVEL,Math.min(MAX_LEVEL,currentLevel+d));
  if(n===currentLevel) return;
  currentLevel=n; streak=0; errorStreak=0;
  const lb=document.getElementById('levelBadge');
  const navn=(LEVELS[currentLevel]&&LEVELS[currentLevel].name)||('Nivå '+currentLevel);
  if(lb) lb.textContent=navn;
  showToast(d>0?'⬆️ '+navn+'!':'⬇️ '+navn,'success');
  document.querySelectorAll('.level-btn').forEach(b=>b.classList.toggle('active',parseInt(b.textContent,10)===currentLevel));
}

// ── SPILLERNAVN OG MENYKNAPP PÅ SKJERMEN ──
// Legges inn automatisk i alle spill som laster denne fila (ikke på menysidene).
// - Spillernavnet (f.eks. 🐾 Gaupe20) vises i topplinjen og på startskjermen.
// - Spill som mangler en knapp tilbake til menyen, får en.
// En side kan slå dette av med <body data-su-chrome="off">.
function menuHref(){
  // Menyen i samme mappe som spillet: temamenyen (f.eks. figurtall/) eller fagets forside
  return './';
}
function isMenuPage(){
  const p=location.pathname;
  return p.endsWith('/')||/\/index\.html?$/i.test(p)||(document.body&&document.body.dataset.suChrome==='off');
}
function suEsc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function addPlayerChrome(){
  if(isMenuPage()) return;
  // Smale skjermer: la topplinjen bryte over flere linjer, så ingenting havner utenfor skjermen
  if(!document.getElementById('su-chrome-css')){
    const st=document.createElement('style');
    st.id='su-chrome-css';
    st.textContent='@media (max-width:700px){'+
      '.header{flex-wrap:wrap!important;row-gap:6px;height:auto!important;}'+
      '.header-right{flex-wrap:wrap!important;justify-content:flex-end;row-gap:5px;min-width:0;max-width:100%;}'+
      '.header .version-tag{display:none!important;}}';
    document.head.appendChild(st);
  }
  const name=window.playerName||'';
  const header=document.querySelector('.header-right')||document.querySelector('.header')||document.querySelector('header');
  const chipCss='display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:20px;font-size:0.8rem;'+
    'font-weight:800;background:rgba(255,255,255,0.92);color:#1e293b;border:1px solid rgba(0,0,0,0.08);white-space:nowrap;font-family:inherit;';
  // 1) Spillernavn i topplinjen (eldre spill med #headerName viser det allerede, men først etter start)
  const hn=document.getElementById('headerName');
  if(hn&&name&&/^[\s–-]*$/.test(hn.textContent)) hn.textContent=name;
  if(name&&!document.getElementById('headerName')&&!document.querySelector('.su-player')){
    const chip=document.createElement('span');
    chip.className='su-player';
    chip.title='Spillernavnet ditt';
    chip.textContent='🐾 '+name;
    chip.style.cssText=chipCss;
    if(header){
      const rb=document.getElementById('roomBadge');
      if(rb&&rb.parentNode===header) header.insertBefore(chip,rb); else header.insertBefore(chip,header.firstChild);
    } else {
      chip.style.cssText+='position:fixed;bottom:10px;left:10px;z-index:150;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
      document.body.appendChild(chip);
    }
  }
  // 2) «Du spiller som …» på startskjermen (eldre spill med #displayName viser det allerede)
  const card=document.querySelector('#startScreen .start-card, #lobbyScreen .screen-card');
  if(name&&card&&!document.getElementById('displayName')&&!card.querySelector('.su-player-start')){
    const d=document.createElement('div');
    d.className='su-player-start';
    d.style.cssText='margin:0 0 14px;font-weight:800;font-size:0.9rem;color:#475569;';
    d.innerHTML='Du spiller som <span style="display:inline-block;padding:2px 12px;border-radius:20px;background:#f1f5f9;color:#1e293b;border:1px solid #e2e8f0">🐾 '+suEsc(name)+'</span>';
    const p=card.querySelector('p');
    if(p&&p.parentNode===card) p.after(d); else card.insertBefore(d,card.firstChild);
  }
  // 2b) Lenke tilbake til menyen nederst på startskjermen (topplinjen ligger under startskjermen)
  if(card&&!card.querySelector('.su-start-menu')){
    const a=document.createElement('a');
    a.className='su-start-menu';
    a.href=menuHref();
    a.textContent='← Tilbake til menyen';
    a.style.cssText='display:inline-block;margin-top:14px;font-size:0.85rem;font-weight:800;color:#64748b;text-decoration:none;';
    card.appendChild(a);
  }
  // 3) Knapp tilbake til menyen, hvis spillet ikke har en
  const hasMenu=[...document.querySelectorAll('a')].some(a=>/meny/i.test(a.textContent));
  if(!hasMenu){
    const a=document.createElement('a');
    a.className='su-menu';
    a.href=menuHref();
    a.textContent='← Meny';
    a.style.cssText=chipCss+'text-decoration:none;cursor:pointer;';
    if(header) header.appendChild(a);
    else { a.style.cssText+='position:fixed;top:10px;left:10px;z-index:150;box-shadow:0 2px 8px rgba(0,0,0,0.15);'; document.body.appendChild(a); }
  }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addPlayerChrome);
else addPlayerChrome();

// ── TID I SPILLET ──
// Måler hvor lenge eleven er aktiv, inaktiv og borte fra spillet (bytter vindu/fane, minimerer,
// låser skjermen). Siden vet bare at den mister fokus, ikke hva eleven gjør ellers.
// Lagres under timecodes/KODE/players/NAVN/tid = {aktivMs, inaktivMs, borteMs, borteAntall, borteNa, oppdatert}
const SU_TID={IDLE_MS:90000, MIN_BORTE_MS:5000, SYNC_MS:15000};
function startTidMaling(){
  const s=getActiveSession();
  if(!s||!s.name) return;
  const key='su_tid_'+s.code;
  let T={aktivMs:0,inaktivMs:0,borteMs:0,borteAntall:0};
  try{ Object.assign(T,JSON.parse(sessionStorage.getItem(key)||'{}')); }catch(e){}
  let lastInput=Date.now(), lastTick=Date.now(), borteFra=null, dirty=true, lastSync=0;
  const here=()=>document.visibilityState==='visible'&&document.hasFocus();
  const path=()=>window._ref(window._db,'timecodes/'+s.code+'/players/'+s.name+'/tid');
  function save(){ try{ sessionStorage.setItem(key,JSON.stringify(T)); }catch(e){} }
  function sync(extra){
    lastSync=Date.now(); dirty=false;
    whenFb(()=>window._update(path(),Object.assign({aktivMs:Math.round(T.aktivMs),inaktivMs:Math.round(T.inaktivMs),
      borteMs:Math.round(T.borteMs),borteAntall:T.borteAntall,borteNa:borteFra,oppdatert:Date.now()},extra||{})));
  }
  function tick(){
    const now=Date.now(), dt=Math.min(now-lastTick,5000); lastTick=now;
    if(borteFra===null){
      if(now-lastInput<SU_TID.IDLE_MS) T.aktivMs+=dt; else T.inaktivMs+=dt;
      dirty=true;
    }
    if(now-lastSync>=SU_TID.SYNC_MS&&dirty){ save(); sync(); }
  }
  function gone(){
    if(borteFra!==null) return;
    tick(); borteFra=Date.now(); save(); sync();
  }
  function back(){
    if(borteFra===null||!here()) return;
    const dur=Date.now()-borteFra;
    if(dur>=SU_TID.MIN_BORTE_MS){ T.borteMs+=dur; T.borteAntall++; }
    else T.aktivMs+=dur; // korte blink regnes som at eleven var her
    borteFra=null; lastTick=lastInput=Date.now(); save(); sync();
  }
  ['pointerdown','keydown','touchstart','wheel','mousemove'].forEach(ev=>
    window.addEventListener(ev,()=>{ lastInput=Date.now(); back(); },{passive:true,capture:true}));
  window.addEventListener('blur',gone);
  window.addEventListener('focus',back);
  document.addEventListener('visibilitychange',()=>document.visibilityState==='visible'?back():gone());
  // Siden lukkes eller eleven går til et annet spill: merk som borte. Neste side nullstiller dette.
  window.addEventListener('pagehide',()=>{ if(borteFra===null){ tick(); save(); sync({borteNa:Date.now()}); } });
  setInterval(tick,1000);
  if(!here()) borteFra=Date.now();
  sync();
}
// Kort beskjed til eleven om at tiden registreres
const SU_TID_TEKST='⏱️ Læreren ser hvor lenge du er aktiv i spillet.';
function addTidNotice(){
  if(!getActiveSession()) return;
  const slot=document.getElementById('suTidNote');
  if(slot){ slot.textContent=SU_TID_TEKST; slot.style.display=''; return; }
  const card=document.querySelector('#startScreen .start-card, #lobbyScreen .screen-card');
  if(card&&!card.querySelector('.su-tid-note')){
    const d=document.createElement('div');
    d.className='su-tid-note';
    d.style.cssText='margin:10px 0 0;font-weight:700;font-size:0.8rem;color:#64748b;';
    d.textContent=SU_TID_TEKST;
    const menu=card.querySelector('.su-start-menu');
    if(menu) card.insertBefore(d,menu); else card.appendChild(d);
  }
}
function suTidInit(){ try{ startTidMaling(); addTidNotice(); }catch(e){} }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',suTidInit); else suTidInit();

// ── REKK OPP HÅNDA ──
// Lagres under timecodes/KODE/hender/NAVN = {ts, nick, spill, tittel, nivaa, sett, valg, tekst}
// Læreren ser køen på lærersiden og tar hånda ned med «Hjulpet».
const SU_HAND_VALG=['Forstår ikke oppgaven','Får feil hele tiden','Vet ikke hva jeg skal gjøre','Noe virker ikke'];
function startHand(){
  const s=getActiveSession();
  const p=location.pathname;
  if(!s||!s.name||p.endsWith('/')||/\/index\.html?$/i.test(p)) return;
  if(document.getElementById('suHand')) return;
  const st=document.createElement('style');
  st.textContent=
    '#suHand{position:fixed;right:12px;bottom:12px;z-index:400;font-family:Nunito,system-ui,sans-serif;}'+
    '#suHandBtn{display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:24px;border:2px solid #e2e8f0;background:#fff;color:#1e293b;font-weight:900;font-size:.88rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);font-family:inherit;}'+
    '#suHandBtn:hover{border-color:#f59e0b;}'+
    '#suHandBtn.up{background:#fef3c7;border-color:#f59e0b;color:#92400e;animation:suWave 2.4s ease-in-out infinite;}'+
    '@keyframes suWave{0%,100%{transform:none}50%{transform:translateY(-2px)}}'+
    '#suHandPanel{position:absolute;right:0;bottom:52px;width:min(320px,calc(100vw - 24px));background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);padding:14px;display:flex;flex-direction:column;gap:8px;color:#1e293b;}'+
    '#suHandPanel h4{font-size:1rem;font-weight:900;margin:0;}'+
    '#suHandPanel .ch{padding:9px 12px;border-radius:10px;border:2px solid #e2e8f0;background:#fff;font-weight:800;font-size:.86rem;text-align:left;cursor:pointer;font-family:inherit;color:#1e293b;}'+
    '#suHandPanel .ch.on{border-color:#f59e0b;background:#fffbeb;}'+
    '#suHandPanel textarea{border:2px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-family:inherit;font-weight:700;font-size:.86rem;resize:none;height:56px;}'+
    '#suHandPanel .row{display:flex;gap:8px;}'+
    '#suHandPanel .go{flex:1;padding:10px;border-radius:10px;border:none;background:#f59e0b;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;}'+
    '#suHandPanel .no{padding:10px 14px;border-radius:10px;border:none;background:#f1f5f9;color:#475569;font-weight:800;cursor:pointer;font-family:inherit;}'+
    '#suHandPanel .info{font-size:.75rem;color:#64748b;font-weight:700;}'+
    '@media (max-width:520px){#suHandBtn .t{display:none;}#suHandBtn{padding:10px 12px;}#suHandBtn.up .t{display:inline;}}';
  document.head.appendChild(st);
  const box=document.createElement('div'); box.id='suHand';
  box.innerHTML='<div id="suHandPanel" style="display:none"></div><button id="suHandBtn" type="button">✋ <span class="t">Rekk opp hånda</span></button>';
  document.body.appendChild(box);
  const btn=box.querySelector('#suHandBtn'), panel=box.querySelector('#suHandPanel');
  const base='timecodes/'+s.code+'/hender';
  let mine=null, iLowered=false, valg='';
  btn.onclick=()=>{ if(mine) openLower(); else openRaise(); };
  function close(){ panel.style.display='none'; }
  function openRaise(){
    valg='';
    const sist=window.__suSist||{};
    panel.innerHTML='<h4>✋ Hva trenger du hjelp med?</h4>'+
      SU_HAND_VALG.map(v=>'<button class="ch" type="button">'+suEsc(v)+'</button>').join('')+
      '<textarea maxlength="140" placeholder="Skriv mer hvis du vil (valgfritt)"></textarea>'+
      '<div class="info">Læreren ser også hvilket spill'+(sist.level!=null?' og nivå':'')+' du er på.</div>'+
      '<div class="row"><button class="no" type="button">Avbryt</button><button class="go" type="button">✋ Rekk opp</button></div>';
    panel.querySelectorAll('.ch').forEach(b=>b.onclick=()=>{ valg=valg===b.textContent?'':b.textContent;
      panel.querySelectorAll('.ch').forEach(x=>x.classList.toggle('on',x.textContent===valg)); });
    panel.querySelector('.no').onclick=close;
    panel.querySelector('.go').onclick=()=>{
      const sist=window.__suSist||{};
      const d={ts:Date.now(),nick:window.playerName||'',tittel:(document.title||'').slice(0,60),spill:sist.spillnavn||'',
        valg,tekst:panel.querySelector('textarea').value.trim().slice(0,140)};
      if(sist.level!==undefined&&sist.level!==null) d.nivaa=sist.level;
      if(sist.sett) d.sett=String(sist.sett).slice(0,40);
      whenFb(()=>window._set(window._ref(window._db,base+'/'+s.name),d));
      close();
    };
    panel.style.display='flex';
  }
  function openLower(){
    panel.innerHTML='<h4>✋ Hånda di er oppe</h4><div class="info">Læreren kommer så snart hen kan. Du kan spille videre mens du venter.</div>'+
      '<div class="row"><button class="no" type="button">Lukk</button><button class="go" type="button" style="background:#64748b">Ta ned hånda</button></div>';
    panel.querySelector('.no').onclick=close;
    panel.querySelector('.go').onclick=()=>{ iLowered=true; whenFb(()=>window._remove(window._ref(window._db,base+'/'+s.name))); close(); };
    panel.style.display='flex';
  }
  whenFb(()=>window._onValue(window._ref(window._db,base),snap=>{
    const all=snap.val()||{};
    const had=!!mine;
    mine=all[s.name]||null;
    if(mine){
      const nr=Object.values(all).filter(h=>h&&h.ts<=mine.ts).length;
      btn.classList.add('up'); btn.innerHTML='✋ <span class="t">Hånda er oppe – du er nr. '+nr+'</span>';
    } else {
      btn.classList.remove('up'); btn.innerHTML='✋ <span class="t">Rekk opp hånda</span>';
      if(had&&!iLowered){
        if(document.getElementById('toast')) showToast('✓ Læreren har sett hånda di','success');
        else { const t=document.createElement('div'); t.textContent='✓ Læreren har sett hånda di';
          t.style.cssText='position:absolute;right:0;bottom:52px;white-space:nowrap;background:#16a34a;color:#fff;font-weight:900;padding:9px 14px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.2);';
          box.appendChild(t); setTimeout(()=>t.remove(),3500); }
      }
      iLowered=false;
    }
  }));
}
function suHandInit(){ try{ startHand(); }catch(e){} }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',suHandInit); else suHandInit();

// Originalene, så spill som lager egne versjoner fortsatt kan bruke dem
window.SU={generateNickname,readSession,getActiveSession,getNickname,whenFb,syncToTimecode,syncToTimecodeGeneric,
  levelTracker,initRoom,syncRoomScore,showMatchOverToast,showToast,getRoomBadgeHTML,buildLevelSelect,selectMode,
  recordResult,changeLevel,addPlayerChrome,menuHref,startTidMaling};
