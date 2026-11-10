// ── spill-utils.js v2.4 ──
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
  if(rb) rb.style.display='';
  if(rc) rc.textContent=code;
  if(!code) return;
  window._roomCode=code;
  whenFb(()=>{
    const name=window.playerName;
    window._update(window._ref(window._db,'rooms/'+code+'/players/'+name),{score:0,lastUpdated:Date.now()});
    if(onPlayers){
      window._onValue(window._ref(window._db,'rooms/'+code+'/players'),snap=>{ if(snap.val()) onPlayers(snap.val()); });
    }
    window._onValue(window._ref(window._db,'rooms/'+code+'/matchOver'),snap=>{
      if(snap.val()!==true) return;
      const vis=d=>window.SU.showMatchOverToast((d&&d.result)||'Kampen er over!');
      if(window._get) window._get(window._ref(window._db,'rooms/'+code)).then(s=>vis(s.val())).catch(()=>vis(null));
      else vis(null);
    });
  });
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

// Originalene, så spill som lager egne versjoner fortsatt kan bruke dem
window.SU={generateNickname,readSession,getActiveSession,getNickname,whenFb,syncToTimecode,syncToTimecodeGeneric,
  levelTracker,initRoom,syncRoomScore,showMatchOverToast,showToast,getRoomBadgeHTML,buildLevelSelect,selectMode,
  recordResult,changeLevel,addPlayerChrome,menuHref,startTidMaling};
