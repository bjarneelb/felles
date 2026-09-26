// ── spill-utils.js v2.0 ──
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
    <a href="/" style="padding:12px 28px;background:#5b4fcf;color:white;border-radius:12px;font-weight:800;font-size:1rem;text-decoration:none;margin-top:8px">🏠 Tilbake til meny</a>`;
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
  const mo=document.getElementById('multiOpts');
  if(mo) mo.style.display=mode==='multi'?'block':'none';
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

// Originalene, så spill som lager egne versjoner fortsatt kan bruke dem
window.SU={generateNickname,readSession,getActiveSession,getNickname,whenFb,syncToTimecode,syncToTimecodeGeneric,
  levelTracker,initRoom,syncRoomScore,showMatchOverToast,showToast,getRoomBadgeHTML,buildLevelSelect,selectMode,
  recordResult,changeLevel};
