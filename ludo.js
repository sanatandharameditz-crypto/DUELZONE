/* ═══════════════════════════════════════════════════════════
   DuelZone · Ludo  v6.0  –  FINAL PRODUCTION
   ✅ All race-condition bugs fixed   ✅ PvP pass-device overlay
   ✅ 1–4 local players + bots        ✅ Web Audio music + SFX
   ✅ Token lerp animations            ✅ Confetti win
   ✅ Fully visible grid/board         ✅ Skip finished players
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  /* ═══════════════════════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════════════════════ */
  const CH   = ['#f44336','#4caf50','#ffc107','#2196f3'];
  const CDK  = ['#b71c1c','#1b5e20','#e65100','#0d47a1'];
  const CN   = ['Red','Green','Yellow','Blue'];
  const CE   = ['🔴','🟢','🟡','🔵'];
  const RBCL = ['','lrb-green','lrb-yellow','lrb-blue'];

  const PATH = [
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
    [7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
    [14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
    [7,0],[6,0],
  ];
  const SAFE       = new Set([0,8,13,21,26,34,39,47]);
  const START      = [0,13,26,39];
  const HOME_ENTRY = [50,11,24,37];
  const HOME_COL   = [
    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  ];
  const YARD = [
    [[2,2],[2,3],[3,2],[3,3]],
    [[2,11],[2,12],[3,11],[3,12]],
    [[11,11],[11,12],[12,11],[12,12]],
    [[11,2],[11,3],[12,2],[12,3]],
  ];
  const YARD_ZONE = [[0,0],[0,9],[9,9],[9,0]];
  const DOTS = [
    [],
    [[.5,.5]],
    [[.28,.28],[.72,.72]],
    [[.28,.28],[.5,.5],[.72,.72]],
    [[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
    [[.28,.28],[.72,.28],[.5,.5],[.28,.72],[.72,.72]],
    [[.28,.28],[.72,.28],[.28,.5],[.72,.5],[.28,.72],[.72,.72]],
  ];

  /* ═══════════════════════════════════════════════════════
     GAME STATE
  ═══════════════════════════════════════════════════════ */
  let gameMode    = 'bots';          // 'bots' | 'pvp'
  let humanCount  = 1;               // humans in bots-mode (1-4)
  let pvpCount    = 2;               // players in pure-pvp mode (2-4)
  let humanColors = [0, 2, 1, 3];   // color index per player slot
  let botDiff     = 'medium';
  let humanSet    = new Set();       // set of color indices that are human
  let pvpNames    = ['','','',''];   // custom names entered in PvP setup

  let tokens    = [];
  let tokDisp   = null;    // visual {x,y} for smooth lerp
  let curPlayer = 0;
  let diceVal   = 0;
  // phase: 'idle' | 'rolling' | 'pick' | 'moving' | 'waiting' | 'pass' | 'bot' | 'done'
  let phase     = 'idle';
  let movable   = [];
  let sixStreak = 0;
  let turnCount = 0;
  let canvas, ctx;
  let animId    = null;
  let pulseT    = 0;
  let captureBanner = null;
  let confetti  = [];

  let _resizeHandler = null;   // cleanup reference

  /* ═══════════════════════════════════════════════════════
     AUDIO  (Web Audio API — zero external files)
  ═══════════════════════════════════════════════════════ */
  let audioCtx  = null;
  let musicOn   = false;
  let musicTid  = null;
  let musicIdx  = 0;

  const MELODY = [
    {f:523,d:.22},{f:659,d:.22},{f:784,d:.22},{f:659,d:.22},
    {f:523,d:.22},{f:440,d:.22},{f:523,d:.44},
    {f:659,d:.22},{f:784,d:.22},{f:880,d:.22},{f:784,d:.22},
    {f:659,d:.44},{f:523,d:.44},
    {f:440,d:.22},{f:523,d:.22},{f:659,d:.44},
    {f:523,d:.22},{f:440,d:.22},{f:392,d:.22},{f:440,d:.22},
    {f:523,d:.22},{f:659,d:.22},{f:784,d:.22},{f:659,d:.22},
    {f:523,d:.66},
  ];
  const BASS = [
    {f:130,d:.88},{f:98,d:.88},
    {f:110,d:.88},{f:98,d:.44},{f:87,d:.44},
    {f:98,d:.88},{f:110,d:.88},
    {f:130,d:1.32},
  ];

  function getAC() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    return audioCtx;
  }

  function playNote(freq,dur,type,vol,delay) {
    const ac=getAC(); if (!ac) return;
    try {
      const osc=ac.createOscillator(), g=ac.createGain();
      const t=ac.currentTime+(delay||0);
      osc.type=type||'sine'; osc.frequency.value=freq;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(vol||0.14, t+Math.min(0.02,dur*0.1));
      g.gain.setValueAtTime(vol||0.14, t+dur*0.65);
      g.gain.exponentialRampToValueAtTime(0.001, t+dur*0.95);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t); osc.stop(t+dur);
    } catch(e) {}
  }

  function sfxRoll() {
    const ac=getAC(); if (!ac) return;
    try {
      const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.09),ac.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length)*0.85;
      const s=ac.createBufferSource(), g=ac.createGain();
      s.buffer=buf; g.gain.value=0.22;
      s.connect(g); g.connect(ac.destination); s.start();
    } catch(e) {}
    playNote(300,0.08,'square',0.07);
  }

  function sfxMove()    { playNote(660,0.09,'sine',0.18); }
  function sfxCapture() {
    const ac=getAC(); if (!ac) return;
    try {
      const osc=ac.createOscillator(), g=ac.createGain();
      osc.type='sawtooth'; osc.frequency.setValueAtTime(380,ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80,ac.currentTime+0.28);
      g.gain.setValueAtTime(0.28,ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.32);
      osc.connect(g); g.connect(ac.destination); osc.start(); osc.stop(ac.currentTime+0.35);
    } catch(e) {}
  }
  function sfxHome() { [523,659,784,1047].forEach((f,i)=>playNote(f,0.14,'sine',0.22,i*0.08)); }
  function sfxSix()  { [523,784].forEach((f,i)=>playNote(f,0.12,'triangle',0.18,i*0.1)); }
  function sfxWin()  {
    const mel=[523,659,784,1047,1047,784,1047], drs=[.1,.1,.1,.2,.1,.1,.45];
    let t=0; mel.forEach((f,i)=>{ playNote(f,drs[i],'square',0.22,t); t+=drs[i]+0.02; });
  }
  function sfxPass() { playNote(660,0.05,'sine',0.12); playNote(880,0.08,'sine',0.12,0.07); }

  function playMelody() {
    if (!musicOn||!audioCtx) return;
    if (audioCtx.state==='suspended') audioCtx.resume();
    const n=MELODY[musicIdx%MELODY.length];
    if (musicIdx%4===0) { const b=BASS[Math.floor(musicIdx/4)%BASS.length]; playNote(b.f,b.d*0.9,'sine',0.05); }
    playNote(n.f,n.d*0.85,'triangle',0.05);
    musicIdx++;
    musicTid=setTimeout(playMelody, n.d*1000);
  }
  function startMusic() {
    const ac=getAC(); if (!ac) return;
    if (ac.state==='suspended') ac.resume();
    musicOn=true; musicIdx=0;
    clearTimeout(musicTid); playMelody();
    const b=$id('ludo-music-btn');
    if (b) { b.textContent='🎵'; b.classList.add('on'); }
  }
  function stopMusic() {
    musicOn=false; clearTimeout(musicTid); musicTid=null;
    const b=$id('ludo-music-btn');
    if (b) { b.textContent='🔇'; b.classList.remove('on'); }
  }
  function toggleMusic() { musicOn ? stopMusic() : startMusic(); }

  /* ═══════════════════════════════════════════════════════
     PASS-DEVICE OVERLAY
  ═══════════════════════════════════════════════════════ */
  let passOverlay=null;

  function createPassOverlay() {
    if ($id('ludo-pass-overlay')) return;
    const div=document.createElement('div');
    div.id='ludo-pass-overlay'; div.className='hidden';
    div.innerHTML=`
      <div id="ludo-pass-box">
        <div id="ludo-pass-emoji">📱</div>
        <div id="ludo-pass-title">PASS THE DEVICE</div>
        <div id="ludo-pass-sub">Hand the device to the next player</div>
        <div id="ludo-pass-hint" style="font-family:'DM Mono',monospace;font-size:0.62rem;color:rgba(255,255,255,0.3);margin-bottom:20px;margin-top:-14px;">Cover the screen while passing!</div>
        <button id="ludo-pass-btn">✅ I'M READY — LET'S PLAY!</button>
      </div>`;
    document.body.appendChild(div);
    passOverlay=div;

    $id('ludo-pass-btn').addEventListener('click',()=>{
      div.classList.add('hidden');
      phase='idle';
      updateChips();
      updateRollBtn();
      const who = humanSet.has(curPlayer) ? playerLabel(curPlayer) : 'Bot';
      setMsg('🎲',`${CE[curPlayer]} ${who}'s turn — Roll the dice!`);
    });
  }

  function showPassOverlay(toPlayer) {
    createPassOverlay();
    // BUG D FIX: re-fetch in case passOverlay var is stale (element existed before var was set)
    if (!passOverlay) passOverlay = $id('ludo-pass-overlay');
    const color = CH[toPlayer];
    const name  = playerLabel(toPlayer);
    $id('ludo-pass-box').style.setProperty('--po-color', color);
    $id('ludo-pass-emoji').textContent = CE[toPlayer];
    $id('ludo-pass-title').textContent = name.toUpperCase() + "'S TURN";
    const colorName = CN[toPlayer];
    $id('ludo-pass-sub').textContent =
      gameMode==='pvp'
        ? `Hand the device to ${name} — you're playing ${colorName}!`
        : `It's ${name}'s turn (${colorName})`;
    $id('ludo-pass-btn').style.background = color;
    $id('ludo-pass-btn').style.boxShadow  = `0 4px 24px ${color}77`;
    passOverlay.classList.remove('hidden');
    sfxPass();
  }

  /* ═══════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════ */
  const $id = id => document.getElementById(id);

  function makeEl(tag,cls,id) {
    const e=document.createElement(tag);
    if (cls) e.className=cls; if (id) e.id=id; return e;
  }

  function setMsg(icon,text) {
    const ic=$id('ludo-msg-icon'), tx=$id('ludo-msg-txt');
    if(ic) ic.textContent=icon; if(tx) tx.textContent=text;
  }

  function showBanner(ava,text) {
    const a=$id('ludo-banner-ava'), t=$id('ludo-banner-txt');
    if(a) a.textContent=ava; if(t) t.textContent=text;
  }

  function playerLabel(p) {
    const total = gameMode==='pvp' ? pvpCount : humanCount;
    for (let i=0;i<total;i++) {
      if (humanColors[i]===p) {
        if (gameMode==='pvp') {
          const name = pvpNames[i] && pvpNames[i].trim();
          return name ? name : 'P'+(i+1);
        }
        return total>1 ? 'P'+(i+1) : 'YOU';
      }
    }
    return 'BOT';
  }

  function rrect(c,x,y,w,h,r) {
    c.beginPath();
    c.moveTo(x+r,y); c.lineTo(x+w-r,y);
    c.quadraticCurveTo(x+w,y,x+w,y+r); c.lineTo(x+w,y+h-r);
    c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h);
    c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r);
    c.quadraticCurveTo(x,y,x+r,y); c.closePath();
  }

  // ── updateSideBtns: replaces updateChips() + updateRollBtn() ─
  function updateSideBtns() {
    [0,1,2,3].forEach(p=>{
      const btn=$id(`ludo-sbtn-${p}`);
      const sc=$id(`lsb-sc-${p}`);
      if (!btn) return;
      const finished=tokens[p].filter(t=>t.finished).length;
      if (sc) sc.textContent=`${finished}/4`;

      const isActive   = p===curPlayer && phase!=='done';
      const isHuman    = humanSet.has(p);
      const canRoll    = isActive && isHuman && phase==='idle';
      const isRolling  = isActive && (phase==='rolling'||phase==='bot'||
                                      phase==='moving'||phase==='waiting');

      btn.classList.toggle('lsb-active',   isActive);
      btn.classList.toggle('lsb-canroll',  canRoll);
      btn.classList.toggle('lsb-rolling',  isRolling);
      btn.classList.toggle('lsb-done',     tokens[p].every(t=>t.finished));
      btn.disabled = !canRoll;

      // Update label
      const nameEl=btn.querySelector('.lsb-name');
      if (nameEl) {
        if (!isHuman && isActive) nameEl.textContent='Bot thinking…';
        else if (canRoll)         nameEl.textContent='TAP TO ROLL!';
        else                      nameEl.textContent=playerLabel(p);
      }
    });
    drawDie(diceVal);
  }

  // Keep old function names as aliases so existing call-sites still work
  function updateChips()   { updateSideBtns(); }
  function updateRollBtn() { updateSideBtns(); }

  /* ═══════════════════════════════════════════════════════
     NAVIGATION
  ═══════════════════════════════════════════════════════ */
  function showScreen(id) {
    document.querySelectorAll('[id^="screen-"]').forEach(el=>
      el.classList.toggle('hidden',el.id!==id));
  }

  document.addEventListener('click', e=>{
    if (e.target.closest('.arena-card[data-screen="ludo"]')) {
      if(typeof window.showLudo==='function') window.showLudo();
      else showScreen('screen-ludo');
    }
  });
  document.addEventListener('click', e=>{
    if (e.target.id==='ludo-back-hub') { stopMusic(); if(typeof window.showHub==='function') window.showHub(); else showScreen('screen-hub'); }
  });
  document.addEventListener('click', e=>{
    if (e.target.id==='ludo-back-play') {
      if (animId) { cancelAnimationFrame(animId); animId=null; }
      // BUG F FIX: hide pass overlay so it doesn't bleed into the setup screen
      const po=$id('ludo-pass-overlay'); if (po) po.classList.add('hidden');
      phase='idle'; // reset phase so the next game isn't stuck in 'pass' state
      $id('ludo-play').classList.add('hidden');
      $id('ludo-home').classList.remove('hidden');
    }
  });

  // Player count
  document.addEventListener('click', e=>{
    const btn=e.target.closest('#ludo-count-group .diff-btn'); if (!btn) return;
    document.querySelectorAll('#ludo-count-group .diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    humanCount=parseInt(btn.dataset.lcount,10);
    updateSetupRows();
  });

  // Per-player color pickers
  [0,1,2,3].forEach(slot=>{
    document.addEventListener('click', e=>{
      const btn=e.target.closest(`#ludo-p${slot+1}-color .diff-btn`); if (!btn) return;
      document.querySelectorAll(`#ludo-p${slot+1}-color .diff-btn`).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      humanColors[slot]=parseInt(btn.dataset.lpcolor,10);
      resolveColorConflicts(slot);
      updateSetupPreview();
      if (gameMode==='pvp') renderPvpNameFields();
    });
  });

  // Bot difficulty
  document.addEventListener('click', e=>{
    const btn=e.target.closest('#ludo-diff-group .diff-btn'); if (!btn) return;
    document.querySelectorAll('#ludo-diff-group .diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); botDiff=btn.dataset.ldiff;
  });

  /* ── Auto-apply difficulty from challenge link ─────────── */
  (function() {
    if (!window.DZShare || typeof DZShare.getChallenge !== 'function') return;
    const _ch = DZShare.getChallenge();
    if (!_ch || _ch.slug !== 'ludo' || !_ch.diff) return;
    const target = _ch.diff.toLowerCase();
    document.querySelectorAll('#ludo-diff-group .diff-btn').forEach(btn => {
      if ((btn.dataset.ldiff || '').toLowerCase() === target) {
        document.querySelectorAll('#ludo-diff-group .diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        botDiff = target;
      }
    });
  })();

  // Start game
  document.addEventListener('click', e=>{
    if (!(e.target.id==='ludo-start-btn'||e.target.closest('#ludo-start-btn'))) return;
    $id('ludo-home').classList.add('hidden');
    $id('ludo-play').classList.remove('hidden');
    startGame();
  });

  // Play again
  document.addEventListener('click', e=>{
    if (e.target.id==='ludo-again') { $id('ludo-result').classList.add('hidden'); startGame(); }
  });

  // Hub from result
  document.addEventListener('click', e=>{
    if (e.target.id==='ludo-result-hub') {
      $id('ludo-result').classList.add('hidden');
      $id('ludo-play').classList.add('hidden');
      $id('ludo-home').classList.remove('hidden');
      stopMusic(); if(typeof window.showHub==='function') window.showHub(); else showScreen('screen-hub');
    }
  });

  // Music toggle
  document.addEventListener('click', e=>{
    if (e.target.id==='ludo-music-btn'||e.target.closest('#ludo-music-btn')) toggleMusic();
  });


  // Game mode toggle: Bots vs Pure PvP
  document.addEventListener('click', e=>{
    const btn=e.target.closest('#ludo-gamemode-group .diff-btn'); if (!btn) return;
    document.querySelectorAll('#ludo-gamemode-group .diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    gameMode = btn.dataset.lgamemode;
    const bs=$id('ludo-bots-section'), ps=$id('ludo-pvp-section');
    if (bs) bs.style.display = gameMode==='bots' ? '' : 'none';
    if (ps) ps.style.display  = gameMode==='pvp'  ? '' : 'none';
    updateSetupRows();
    renderPvpNameFields();
  });

  // PvP player count selector (2 / 3 / 4)
  document.addEventListener('click', e=>{
    const btn=e.target.closest('#ludo-pvp-count-group .diff-btn'); if (!btn) return;
    document.querySelectorAll('#ludo-pvp-count-group .diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    pvpCount = parseInt(btn.dataset.lpvpcount, 10);
    updateSetupRows();
    renderPvpNameFields();
  });

  /* ─── PvP name field renderer ─── */
  function renderPvpNameFields() {
    const wrap = document.getElementById('ludo-pvp-name-fields');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i < pvpCount; i++) {
      const colorIdx = humanColors[i];
      const field = document.createElement('div');
      field.className = 'lpvp-name-field';
      field.style.setProperty('--lnf-color', CH[colorIdx]);
      field.innerHTML = `
        <div class="lpvp-name-dot"></div>
        <input class="lpvp-name-input" type="text" maxlength="12"
               placeholder="${CE[colorIdx]} Player ${i+1}"
               data-pslot="${i}" />
      `;
      wrap.appendChild(field);
    }
    // BUG E FIX: set .value via DOM property (not innerHTML attr) to handle
    // names with quotes, angle brackets, or other special characters
    wrap.querySelectorAll('.lpvp-name-input').forEach(inp=>{
      const slot = parseInt(inp.dataset.pslot, 10);
      inp.value = pvpNames[slot] || '';          // safe DOM property assignment
      inp.addEventListener('input', ()=>{ pvpNames[slot] = inp.value; });
    });
  }

    /* ─── Setup UI helpers ─── */
  function updateSetupRows() {
    const total = gameMode==='pvp' ? pvpCount : humanCount;
    for (let s=0;s<4;s++) {
      const row=$id(`ludo-p${s+1}-row`);
      if (row) row.style.display = s<total?'':'none';
    }
    // Bot diff row only in bots mode and when < 4 humans
    const dr=$id('ludo-diff-row');
    if (dr) dr.style.display = (gameMode==='bots' && humanCount<4)?'':'none';
    updateSetupPreview();
    if (gameMode==='pvp') renderPvpNameFields();
  }

  function updateSetupPreview() {
    const wrap=$id('ludo-setup-preview'); if (!wrap) return;
    wrap.innerHTML='';
    const total = gameMode==='pvp' ? pvpCount : humanCount;
    const used  = humanColors.slice(0, total);
    [0,1,2,3].forEach(p=>{
      const pill=document.createElement('span');
      pill.className='lsetup-pill';
      pill.style.cssText=`border:1px solid ${CH[p]};color:${CH[p]};background:${CH[p]}22;padding:3px 10px;border-radius:20px;font-family:'DM Mono',monospace;font-size:0.63rem;display:inline-flex;align-items:center;`;
      const pIdx=used.indexOf(p);
      let label;
      if (pIdx>=0) { if (gameMode==='pvp') { const n=pvpNames[pIdx]&&pvpNames[pIdx].trim(); label=n?n:'P'+(pIdx+1); } else { label=total>1?'P'+(pIdx+1):'YOU'; } } else { label='🤖 BOT'; }
      pill.textContent=`${CE[p]} ${label}`;
      wrap.appendChild(pill);
    });
  }

  // BUG C FIX: resolveColorConflicts — all-vs-all cascade detection,
  //   dead variables removed, properly handles secondary conflicts.
  function resolveColorConflicts(changedSlot) {
    const total = gameMode==='pvp' ? pvpCount : humanCount;
    // Up to 4 passes to handle cascading reassignments
    for (let pass=0; pass<4; pass++) {
      let anyFixed=false;
      for (let s=0;s<total;s++) {
        // Check if slot s shares a colour with any OTHER slot
        const hasDuplicate = humanColors.slice(0,total).some((c,idx)=>idx!==s&&c===humanColors[s]);
        if (!hasDuplicate) continue;
        // Find a colour not used by any other slot
        const others = humanColors.slice(0,total).filter((_,idx)=>idx!==s);
        const freeForS = [0,1,2,3].find(c=>!others.includes(c));
        if (freeForS===undefined) continue; // impossible when total<=4
        humanColors[s]=freeForS;
        document.querySelectorAll(`#ludo-p${s+1}-color .diff-btn`).forEach(b=>{
          b.classList.toggle('active',parseInt(b.dataset.lpcolor,10)===freeForS);
        });
        anyFixed=true;
      }
      if (!anyFixed) break; // stable — no more conflicts
    }
  }

  /* ═══════════════════════════════════════════════════════
     GAME START
  ═══════════════════════════════════════════════════════ */
  function startGame() {
    if (animId) { cancelAnimationFrame(animId); animId=null; }

    // Sync PvP names from DOM inputs
    if (gameMode==='pvp') {
      document.querySelectorAll('.lpvp-name-input').forEach(inp=>{
        const slot = parseInt(inp.dataset.pslot, 10);
        pvpNames[slot] = inp.value.trim();
      });
    }

    // In pvp mode ALL players are human; in bots mode use humanCount
    const activeCount = gameMode==='pvp' ? pvpCount : humanCount;
    humanSet = new Set(humanColors.slice(0, activeCount));

    tokens    = [0,1,2,3].map(()=>[0,1,2,3].map(()=>({pos:-1,homeStep:0,finished:false})));
    tokDisp   = null;
    curPlayer = humanColors[0]; // BUG A FIX: P1's chosen colour goes first, not always Red
    diceVal   = 0;
    phase     = 'idle';
    movable   = [];
    sixStreak = 0;
    turnCount = 0;
    pulseT    = 0;
    captureBanner=null;
    confetti  = [];

    // BUG B FIX: in PvP mode mark inactive colour-slots as "done" so
    // advanceTurn skips them instead of treating them as bots
    if (gameMode==='pvp') {
      for (let p=0;p<4;p++) {
        if (!humanSet.has(p)) tokens[p].forEach(t=>{ t.finished=true; });
      }
    }

    buildUI();
    animId=requestAnimationFrame(loop);

    // FIX: ensure first turn starts correctly after UI is built
    setTimeout(()=>{
      if (humanSet.has(curPlayer)) {
        setMsg('🎲',`${CE[curPlayer]} ${playerLabel(curPlayer)}'s turn — Roll the dice!`);
        updateRollBtn();
      } else {
        setMsg('🤖',`${CN[curPlayer]} (Bot) goes first…`);
        setTimeout(()=>botTurn(),800);
      }
    },100);
  }

  /* ═══════════════════════════════════════════════════════
     BUILD UI
  ═══════════════════════════════════════════════════════ */
  function buildUI() {
    const app=$id('ludo-app'); app.innerHTML='';

    // ── Outer wrapper holds the 3-column/3-row grid ──────────
    const layout=makeEl('div','','ludo-layout');

    // Player → position:  Red=top, Green=right, Yellow=bottom, Blue=left
    const POS=['top','right','bottom','left'];
    POS.forEach((pos,p)=>{
      const isHuman=humanSet.has(p);
      const btn=makeEl('button','ludo-side-btn',`ludo-sbtn-${p}`);
      btn.dataset.pos=pos; btn.dataset.player=p;
      btn.style.setProperty('--lsb-color',CH[p]);
      btn.style.setProperty('--lsb-dark',CDK[p]);
      btn.innerHTML=
        `<span class="lsb-emoji">${CE[p]}</span>`+
        `<span class="lsb-name">${playerLabel(p)}</span>`+
        `<span class="lsb-score" id="lsb-sc-${p}">0/4</span>`;
      btn.addEventListener('click',()=>{
        if (p!==curPlayer||!humanSet.has(p)||phase!=='idle') return;
        onRoll();
      });
      layout.appendChild(btn);
    });

    // Centre board canvas
    const bw=makeEl('div','','ludo-bwrap');
    canvas=document.createElement('canvas');
    canvas.id='ludo-cv';
    canvas.addEventListener('pointerdown',onBoardClick);
    bw.appendChild(canvas);
    layout.appendChild(bw);

    app.appendChild(layout);

    // Message bar below grid
    const msg=makeEl('div','','ludo-msg');
    msg.innerHTML=`<span id="ludo-msg-icon">🎲</span><span id="ludo-msg-txt">Preparing game…</span>`;
    app.appendChild(msg);

    // Music toggle (small, sits below message)
    const mb=document.createElement('button');
    mb.id='ludo-music-btn'; mb.title='Toggle Music';
    mb.textContent=musicOn?'🎵':'🔇';
    if (musicOn) mb.classList.add('on');
    app.appendChild(mb);

    // Resize plumbing
    if (_resizeHandler) window.removeEventListener('resize',_resizeHandler);
    _resizeHandler=function(){ setLudoBoardSize(); resizeCanvas(); };
    window.addEventListener('resize',_resizeHandler);

    setTimeout(function(){
      setLudoBoardSize(); resizeCanvas(); updateSideBtns();
    },50);
  }

    // Banner
  /**
   * Calculates max board size so the whole Ludo UI fits without scrolling.
   * New layout: only msg (~48px) + side btns (~56px each) + padding (~24px)
   */
  function setLudoBoardSize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const isLandscape = vw > vh;
    // New layout: side buttons are ~56px each (top+bottom = 112px),
    // msg bar ~48px, padding ~24px, topbar ~54px → ~238px total
    const reserved = isLandscape ? 100 : 238;
    const boardMax = Math.max(180, vh - reserved);
    const app = $id('ludo-app');
    // Side buttons are outside the board, so available width = full container
    const containerW = app ? (app.clientWidth || vw) - 20 : vw - 20;
    // Subtract side button widths (~56px * 2) from width available for the board
    const boardW = Math.max(180, containerW - 112);
    const size = Math.min(boardMax, boardW);
    document.documentElement.style.setProperty('--ludo-board-size', size + 'px');
  }

  function resizeCanvas() {
    const wrap=$id('ludo-bwrap'); if (!wrap||!canvas) return;
    const sz=wrap.clientWidth;
    canvas.width=canvas.height=sz;
    ctx=canvas.getContext('2d');
    tokDisp=null; // force re-init visual positions on next frame
  }

  /* ═══════════════════════════════════════════════════════
     TOKEN LERP ANIMATION
  ═══════════════════════════════════════════════════════ */
  function initTokDisp() {
    if (!canvas) return;
    const cs=canvas.width/15;
    tokDisp=tokens.map((tl,p)=>tl.map((_,ti)=>{
      const {x,y}=tokenLogicalXY(p,ti,cs); return {x,y};
    }));
  }

  function stepTokDisp() {
    if (!tokDisp||!canvas) return;
    const cs=canvas.width/15;
    tokDisp.forEach((tl,p)=>tl.forEach((td,ti)=>{
      const {x,y}=tokenLogicalXY(p,ti,cs);
      td.x+=(x-td.x)*0.22; td.y+=(y-td.y)*0.22;
    }));
  }

  /* ═══════════════════════════════════════════════════════
     MOVEMENT LOGIC
  ═══════════════════════════════════════════════════════ */
  function distToEntry(p,pos) { return (HOME_ENTRY[p]-pos+52)%52; }

  function getLegalMoves(p,dice) {
    const moves=[];
    tokens[p].forEach((tok,ti)=>{
      if (tok.finished) return;
      if (tok.pos===-1) {
        if (dice===6) moves.push({ti,type:'out'});
        return;
      }
      if (tok.homeStep>0) {
        if (tok.homeStep+dice<=6) moves.push({ti,type:'home'});
        return;
      }
      const d=distToEntry(p,tok.pos);
      if      (d===0)      moves.push({ti,type:'enter'});         // on home-entry
      else if (d<dice)  { if (dice-d<=6) moves.push({ti,type:'enter'}); } // crosses entry
      else               moves.push({ti,type:'move'});            // normal move
    });
    return moves;
  }

  function doMove(p,ti,dice) {
    const tok=tokens[p][ti];
    let bonusTurn=(dice===6);
    let captureMsg='';

    if (tok.pos===-1) {
      tok.pos=START[p];
      captureMsg=tryCapture(p,ti);
    } else if (tok.homeStep>0) {
      tok.homeStep+=dice;
      if (tok.homeStep>=6) { tok.homeStep=6; tok.finished=true; bonusTurn=true; } // bonus roll on home
    } else {
      const d=distToEntry(p,tok.pos);
      if (d===0) {
        tok.homeStep=Math.min(dice,6);
        if (tok.homeStep>=6) { tok.homeStep=6; tok.finished=true; bonusTurn=true; } // bonus roll on home
      } else if (d<dice) {
        tok.homeStep=Math.min(dice-d,6);
        if (tok.homeStep>=6) { tok.homeStep=6; tok.finished=true; bonusTurn=true; } // bonus roll on home
      } else {
        tok.pos=(tok.pos+dice)%52;
        const cm=tryCapture(p,ti);
        if (cm) { captureMsg=cm; bonusTurn=true; }
      }
    }

    if      (tok.finished)  { sfxHome(); showBanner('🏠',`${CE[p]} Token HOME! 🎉 Roll again!`); }
    else if (captureMsg)    { sfxCapture(); showBanner('💥',captureMsg); captureBanner={text:captureMsg,alpha:1.0}; }
    else if (dice===6)      { sfxSix(); showBanner(CE[p],`Rolled 6! ${playerLabel(p)==='BOT'?CN[p]+' rolls again!':'Go again!'}`); }
    else                    { sfxMove(); }

    updateChips();
    return bonusTurn;
  }

  function tryCapture(p,ti) {
    // BUG G FIX: collect ALL captured opponents (multi-capture in 3/4-player games)
    const tok=tokens[p][ti];
    if (SAFE.has(tok.pos)) return '';
    const captured=[];
    for (let opp=0;opp<4;opp++) {
      if (opp===p) continue;
      tokens[opp].forEach(t=>{
        if (!t.finished&&t.homeStep===0&&t.pos!==-1&&t.pos===tok.pos) {
          t.pos=-1; captured.push(CE[opp]);
          if ('vibrate' in navigator) navigator.vibrate([40,20,60]);
        }
      });
    }
    if (!captured.length) return '';
    return `${CE[p]} captured ${captured.join(' ')}!`;
  }

  /* ═══════════════════════════════════════════════════════
     TURN FLOW
  ═══════════════════════════════════════════════════════ */
  function onRoll() {
    if (phase!=='idle') return;
    if (!humanSet.has(curPlayer)) return;
    phase='rolling';   // FIX: lock phase immediately, prevents double-roll
    updateRollBtn();
    sfxRoll();
    animateRoll(()=>afterRoll());
  }

  function afterRoll() {
    const moves=getLegalMoves(curPlayer,diceVal);

    if (diceVal===6) sixStreak++; else sixStreak=0;

    // Three 6s forfeit
    if (sixStreak>=3) {
      setMsg('😤','Three 6s in a row — turn forfeited!');
      sixStreak=0;
      phase='waiting';   // FIX: not 'idle' — prevents stray clicks during delay
      updateRollBtn();
      setTimeout(()=>advanceTurn(false), 1100);
      return;
    }

    // No moves
    if (moves.length===0) {
      setMsg('😔',`Rolled ${diceVal} — no valid moves. Turn passes.`);
      phase='waiting';   // FIX: not 'idle'
      updateRollBtn();
      setTimeout(()=>advanceTurn(false), 1100);
      return;
    }

    // One move: auto-execute
    // Set phase='moving' immediately (not 'pick') so onBoardClick is blocked
    // during the 420ms delay — otherwise a tap during the window calls pick()
    // a second time and the token moves twice.
    if (moves.length===1) {
      movable=[]; phase='moving';
      setMsg('✅',`Rolled ${diceVal}!`);
      setTimeout(()=>pick(curPlayer,moves[0].ti), 420);
      return;
    }

    // Multiple moves: player chooses
    movable=moves; phase='pick';
    setMsg('👆',`Rolled ${diceVal} — ${playerLabel(curPlayer)}: tap a token!`);
  }

  function pick(p,ti) {
    movable=[];
    phase='moving';     // FIX: non-idle during animation delay
    const gotBonus=doMove(p,ti,diceVal);
    if (checkWin(p)) { phase='done'; endGame(p); return; }
    setTimeout(()=>{ phase='idle'; advanceTurn(gotBonus); }, 700);
  }

  /* FIX: advanceTurn now handles:
     - Skipping finished players (all tokens home, still playing = shouldn't happen, but safety)
     - turnCount increments only on genuine new turns, not bonus rolls
     - Pass-device overlay for PvP mode
  */
  function advanceTurn(samePlayer) {
    const prevPlayer=curPlayer;

    if (!samePlayer) {
      // Advance to next player, skipping anyone whose all tokens are finished (shouldn't happen
      // since endGame is called immediately, but safety for edge cases)
      for (let i=1;i<=4;i++) {
        const next=(curPlayer+i)%4;
        if (!tokens[next].every(t=>t.finished)) { curPlayer=next; break; }
      }
      sixStreak=0;
      turnCount++;       // FIX: only count new turns, not bonus rolls
    }

    phase='idle';
    updateChips();
    updateRollBtn();

    const nextIsHuman=humanSet.has(curPlayer);

    // Pass-device: only in bots mode when multiple humans share one device.
    // In pure PvP mode each player has their own colour button — no popup needed.
    const needPass = !samePlayer && nextIsHuman && curPlayer!==prevPlayer &&
                     gameMode !== 'pvp' && humanCount > 1;
    if (needPass) {
      // Show pass overlay — the overlay's button sets phase='idle' and unblocks
      phase='pass';
      updateRollBtn();
      // Small delay so the board can visually settle before overlay appears
      setTimeout(()=>showPassOverlay(curPlayer), 350);
      return;
    }

    if (nextIsHuman) {
      setMsg('🎲',`${CE[curPlayer]} ${playerLabel(curPlayer)}'s turn — Roll!`);
    } else {
      setMsg('🤖',`${CN[curPlayer]} (Bot) is thinking…`);
      setTimeout(()=>botTurn(), 650);
    }
  }

  /* ═══════════════════════════════════════════════════════
     BOT AI
  ═══════════════════════════════════════════════════════ */
  function botTurn() {
    // FIX: strict guards — only fire when truly idle and current player is bot
    if (phase!=='idle') return;
    if (humanSet.has(curPlayer)) return;
    phase='bot';
    updateRollBtn();

    animateRoll(()=>{
      const moves=getLegalMoves(curPlayer,diceVal);

      if (diceVal===6) sixStreak++; else sixStreak=0;

      if (sixStreak>=3) {
        setMsg('😅','Bot rolled 3 sixes — forfeited!');
        sixStreak=0;
        phase='waiting';  // FIX: not 'idle' during delay
        updateRollBtn();
        setTimeout(()=>advanceTurn(false), 900);
        return;
      }

      if (moves.length===0) {
        setMsg('🤖',`Bot rolled ${diceVal} — no moves.`);
        phase='waiting';  // FIX: not 'idle' during delay
        updateRollBtn();
        setTimeout(()=>advanceTurn(false), 900);
        return;
      }

      const chosen=botPick(curPlayer,moves,diceVal);
      setMsg('🤖',`${CN[curPlayer]} rolled ${diceVal} — moving!`);
      phase='moving';    // FIX: not 'idle' until pick() fires
      updateRollBtn();
      setTimeout(()=>{ phase='idle'; pick(curPlayer,chosen.ti); }, 700);
    });
  }

  function botPick(p,moves,dice) {
    if (botDiff==='easy') return moves[Math.floor(Math.random()*moves.length)];

    return moves.map(m=>{
      let score=0;
      const tok=tokens[p][m.ti];

      // Highest priority: finish a token
      if (m.type==='home'&&tok.homeStep+dice>=6)               score+=5000;
      if (m.type==='enter'&&dice-distToEntry(p,tok.pos)>=6)    score+=5000;

      if (m.type==='move') {
        const np=(tok.pos+dice)%52;
        // Hard: capture opponents (very high priority)
        for (let opp=0;opp<4;opp++) {
          if (opp===p) continue;
          if (tokens[opp].some(t=>!t.finished&&t.homeStep===0&&t.pos===np&&!SAFE.has(np)))
            score+=botDiff==='hard'?1500:300;
        }
        // Hard: avoid squares where opponents can capture us next turn
        if (botDiff==='hard') {
          for (let opp=0;opp<4;opp++) {
            if (opp===p) continue;
            tokens[opp].forEach(t=>{
              if (!t.finished&&t.homeStep===0&&t.pos!==-1)
                for (let d2=1;d2<=6;d2++)
                  if ((t.pos+d2)%52===np&&!SAFE.has(np)) score-=80;
            });
          }
        }
        // Prefer safe squares
        if (SAFE.has(np)) score+=80;
        // Hard: prefer advancing the most-advanced token (push toward home)
        if (botDiff==='hard') {
          const progress=(tok.pos-START[p]+52)%52;
          score += progress * 2.5;
        }
      }

      // Strongly prefer getting tokens out of base
      if (m.type==='out') score+=botDiff==='hard'?300:160;

      // Home stretch: advance home tokens
      if (m.type==='home') score += tok.homeStep * 20;

      // General: prefer most-advanced token
      const progress=tok.pos===-1?0:
        tok.homeStep>0?52+tok.homeStep*10:(tok.pos-START[p]+52)%52;
      score+=progress*1.8;

      return {...m,score};
    }).sort((a,b)=>b.score-a.score)[0];
  }

  /* ═══════════════════════════════════════════════════════
     WIN CHECK
  ═══════════════════════════════════════════════════════ */
  function checkWin(p) { return tokens[p].every(t=>t.finished); }

  function spawnConfetti() {
    if (!canvas) return;
    const cols=['#f44336','#4caf50','#ffc107','#2196f3','#e91e63','#9c27b0','#ff9800','#00bcd4'];
    for(let i=0;i<130;i++) {
      confetti.push({
        x:Math.random()*canvas.width,
        y:Math.random()*canvas.height*0.4-30,
        vx:(Math.random()-0.5)*5,
        vy:Math.random()*3+1,
        color:cols[i%cols.length],
        size:Math.random()*5+3,
        rot:Math.random()*Math.PI*2,
        rotV:(Math.random()-0.5)*0.32,
        life:1, decay:Math.random()*0.005+0.003,
      });
    }
  }

  function endGame(winner) {
    phase='done';
    sfxWin(); spawnConfetti();

    const isHuman=humanSet.has(winner);
    const label=playerLabel(winner);
    let title, detail;
    if (gameMode==='pvp') {
      title = `${label} WINS! 🏆`;
      detail= `${CE[winner]} ${CN[winner]} — Champion in ${turnCount} turns! 🎉`;
    } else if (isHuman) {
      title = humanCount>1 ? `${label} WINS! 🏆` : 'YOU WIN! 🎉';
      detail= `${CE[winner]} ${CN[winner]} (${label}) finished in ${turnCount} turns!`;
    } else {
      title = '🤖 BOT WINS!';
      detail= `${CE[winner]} ${CN[winner]} (Bot) won. Better luck next time!`;
    }

    $id('ludo-result-emoji').textContent = isHuman?'🏆':'💀';
    $id('ludo-result-title').textContent  = title;
    $id('ludo-result-detail').textContent = detail;
    $id('ludo-result').classList.remove('hidden');
    if (window.DZShare) DZShare.setResult({ game:'Ludo', slug:'ludo', winner:title, detail:detail.replace(/[🎉💀🏆]/g,'').trim(), accent:'#ff1744', icon:'🎲', score:turnCount, diff:botDiff, isWin:isHuman });
  }

  /* ═══════════════════════════════════════════════════════
     BOARD CLICK
  ═══════════════════════════════════════════════════════ */
  function onBoardClick(e) {
    if (phase!=='pick') return;
    if (!humanSet.has(curPlayer)) return;
    if (!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width);
    const my=(e.clientY-rect.top) *(canvas.height/rect.height);
    const cs=canvas.width/15;
    for (const m of movable) {
      const {x,y}=tokenLogicalXY(curPlayer,m.ti,cs);
      if (Math.hypot(mx-x,my-y)<cs*0.55) { pick(curPlayer,m.ti); return; }
    }
  }

  /* ═══════════════════════════════════════════════════════
     DRAW LOOP
  ═══════════════════════════════════════════════════════ */
  function loop(ts) {
    pulseT=ts*0.004;
    if (!tokDisp) initTokDisp();
    stepTokDisp();
    stepConfetti();
    drawBoard();
    animId=requestAnimationFrame(loop);
  }

  function stepConfetti() {
    confetti=confetti.filter(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.vx*=0.99;
      p.rot+=p.rotV; p.life-=p.decay;
      return p.life>0&&p.y<(canvas?canvas.height*1.3:9999);
    });
  }

  /* ═══════════════════════════════════════════════════════
     BOARD DRAWING
  ═══════════════════════════════════════════════════════ */
  function drawBoard() {
    if (!canvas||!ctx) return;
    const S=canvas.width, cs=S/15;
    ctx.clearRect(0,0,S,S);

    // Background gradient
    const bg=ctx.createLinearGradient(0,0,S,S);
    bg.addColorStop(0,'#0b0d20'); bg.addColorStop(1,'#0e1018');
    ctx.fillStyle=bg; rrect(ctx,0,0,S,S,10); ctx.fill();

    // ── Step 1: Draw every PATH cell as a clearly visible box ──
    // Solid light fill + crisp border on every cell pieces can land on
    PATH.forEach(([r,c])=>{
      const x=c*cs, y=r*cs, pad=cs*0.05;
      ctx.fillStyle='rgba(210,225,255,0.22)';
      ctx.fillRect(x+pad,y+pad,cs-pad*2,cs-pad*2);
      ctx.strokeStyle='rgba(180,205,255,0.65)';
      ctx.lineWidth=1.2;
      ctx.strokeRect(x+pad,y+pad,cs-pad*2,cs-pad*2);
    });

    // ── Step 2: Cross corridor non-path cells (visual continuity) ──
    for (let r=6;r<=8;r++) for (let c=6;c<=8;c++) {
      const onPath=PATH.some(([pr,pc])=>pr===r&&pc===c);
      if (onPath||( r===7&&c===7)) continue;
      const x=c*cs, y=r*cs, pad=cs*0.05;
      ctx.fillStyle='rgba(255,255,255,0.07)';
      ctx.fillRect(x+pad,y+pad,cs-pad*2,cs-pad*2);
      ctx.strokeStyle='rgba(255,255,255,0.22)';
      ctx.lineWidth=0.8;
      ctx.strokeRect(x+pad,y+pad,cs-pad*2,cs-pad*2);
    }

    // ── Step 3: Light overall grid to frame the board ──
    ctx.strokeStyle='rgba(180,200,255,0.25)'; ctx.lineWidth=0.5;
    for (let i=0;i<=15;i++) {
      ctx.beginPath(); ctx.moveTo(i*cs,0); ctx.lineTo(i*cs,S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*cs); ctx.lineTo(S,i*cs); ctx.stroke();
    }
    // Bold cross corridor boundary
    ctx.strokeStyle='rgba(200,220,255,0.55)'; ctx.lineWidth=1.8;
    [6,9].forEach(i=>{
      ctx.beginPath(); ctx.moveTo(i*cs,0); ctx.lineTo(i*cs,S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*cs); ctx.lineTo(S,i*cs); ctx.stroke();
    });

    // Yard fills (radial gradient per color) — drawn OVER grid lines
    YARD_ZONE.forEach(([r,c],p)=>{
      const g=ctx.createRadialGradient((c+3)*cs,(r+3)*cs,0,(c+3)*cs,(r+3)*cs,3.2*cs);
      g.addColorStop(0,CH[p]+'60'); g.addColorStop(1,CH[p]+'20');
      ctx.fillStyle=g;
      rrect(ctx,c*cs+1,r*cs+1,6*cs-2,6*cs-2,cs*0.45); ctx.fill();
    });

    // Home column cells
    for (let r=0;r<15;r++) for (let c=0;c<15;c++) {
      const inCross=(r>=6&&r<=8)||(c>=6&&c<=8); if (!inCross) continue;
      const x=c*cs, y=r*cs;
      if      (r===7&&c>=1&&c<=6)  drawHomeCell(x,y,cs,0,c-1);
      else if (c===7&&r>=1&&r<=6)  drawHomeCell(x,y,cs,1,r-1);
      else if (r===7&&c>=8&&c<=13) drawHomeCell(x,y,cs,2,13-c);
      else if (c===7&&r>=8&&r<=13) drawHomeCell(x,y,cs,3,13-r);
      else if (r===7&&c===7)        drawDieOnBoard(cs);
    }

    // Yard zone borders + inner ring + label
    YARD_ZONE.forEach(([r,c],p)=>{
      ctx.strokeStyle=CH[p]+'ee'; ctx.lineWidth=2.5;
      rrect(ctx,c*cs+1,r*cs+1,6*cs-2,6*cs-2,cs*0.45); ctx.stroke();

      ctx.fillStyle='rgba(7,9,20,0.75)';
      rrect(ctx,(c+1)*cs+3,(r+1)*cs+3,4*cs-6,4*cs-6,cs*0.28); ctx.fill();
      ctx.strokeStyle=CH[p]+'66'; ctx.lineWidth=1.5;
      rrect(ctx,(c+1)*cs+3,(r+1)*cs+3,4*cs-6,4*cs-6,cs*0.28); ctx.stroke();

      ctx.fillStyle=CH[p]+'99'; ctx.font=`bold ${cs*0.52}px 'Orbitron',sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(CN[p][0],(c+3)*cs,(r+0.62)*cs);
    });

    // Start squares — solid colour fill so they pop
    START.forEach((idx,p)=>{
      const [r,c]=PATH[idx]; const x=c*cs,y=r*cs;
      ctx.fillStyle=CH[p]+'88'; ctx.fillRect(x+2,y+2,cs-4,cs-4);
      ctx.strokeStyle=CH[p]; ctx.lineWidth=2;
      ctx.strokeRect(x+2,y+2,cs-4,cs-4);
      ctx.fillStyle='#fff'; ctx.font=`bold ${cs*0.42}px 'DM Mono',monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('S',x+cs/2,y+cs/2);
    });

    // Safe squares
    SAFE.forEach(idx=>{
      if (START.includes(idx)) return;
      const [r,c]=PATH[idx]; const x=c*cs,y=r*cs;
      ctx.fillStyle='rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(x+cs/2,y+cs/2,cs*0.41,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.78)'; ctx.font=`${cs*0.42}px serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('★',x+cs/2,y+cs/2);
    });

    // Tokens
    const movableIdxs=(phase==='pick'&&humanSet.has(curPlayer))
      ?new Set(movable.map(m=>m.ti)):new Set();
    const pulse=Math.sin(pulseT*2.5)*0.5+0.5;

    tokens.forEach((tl,p)=>tl.forEach((tok,ti)=>{
      if (tok.finished) return;
      let x,y;
      if (tokDisp&&tokDisp[p]&&tokDisp[p][ti]) { x=tokDisp[p][ti].x; y=tokDisp[p][ti].y; }
      else { const lp=tokenLogicalXY(p,ti,cs); x=lp.x; y=lp.y; }
      drawToken(x,y,cs*0.33,p,p===curPlayer&&movableIdxs.has(ti),pulse);
    }));

    // Capture toast
    if (captureBanner&&captureBanner.alpha>0) {
      ctx.globalAlpha=captureBanner.alpha;
      ctx.fillStyle='rgba(188,22,42,0.94)';
      rrect(ctx,S*0.08,S*0.435,S*0.84,S*0.1,9); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.26)'; ctx.lineWidth=1;
      rrect(ctx,S*0.08,S*0.435,S*0.84,S*0.1,9); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font=`bold ${cs*0.68}px 'Rajdhani',sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(captureBanner.text,S/2,S*0.487);
      ctx.globalAlpha=1; captureBanner.alpha-=0.016;
    }

    // Confetti
    confetti.forEach(p=>{
      ctx.save(); ctx.globalAlpha=p.life;
      ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.color;
      ctx.fillRect(-p.size/2,-p.size*0.25,p.size,p.size*0.5);
      ctx.restore();
    });
  }

  function drawHomeCell(x,y,cs,p,step) {
    const a=Math.round(((step+1)/6)*110+90).toString(16).padStart(2,'0');
    ctx.fillStyle=CH[p]+a; ctx.fillRect(x+0.5,y+0.5,cs-1,cs-1);
    ctx.strokeStyle=CH[p]+'99'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,cs-1,cs-1);
  }

  function drawCenterStar(x,y,cs) {
    const g=ctx.createRadialGradient(x+cs/2,y+cs/2,0,x+cs/2,y+cs/2,cs*0.72);
    g.addColorStop(0,'rgba(255,255,255,0.22)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x+cs/2,y+cs/2,cs*0.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font=`${cs*0.56}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★',x+cs/2,y+cs/2);
  }

  function drawToken(x,y,r,p,glow,pulse) {
    if (glow) { ctx.shadowColor=CH[p]; ctx.shadowBlur=r*(0.9+pulse*1.5); }
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=CDK[p]; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,r*0.73,0,Math.PI*2); ctx.fillStyle=CH[p]; ctx.fill();
    ctx.beginPath(); ctx.arc(x-r*0.22,y-r*0.24,r*0.27,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();
    ctx.shadowBlur=0;
  }

  function tokenLogicalXY(p,ti,cs) {
    const tok=tokens[p][ti];
    if (tok.pos===-1) { const [r,c]=YARD[p][ti]; return {x:(c+0.5)*cs,y:(r+0.5)*cs}; }
    if (tok.homeStep>0) { const [r,c]=HOME_COL[p][tok.homeStep-1]; return {x:(c+0.5)*cs,y:(r+0.5)*cs}; }
    const [r,c]=PATH[tok.pos];
    const stack=tokens[p].filter((t2,i2)=>i2<ti&&t2.pos===tok.pos&&t2.homeStep===0&&!t2.finished).length;
    return {x:(c+0.5)*cs+stack*cs*0.17,y:(r+0.5)*cs-stack*cs*0.17};
  }

  /* ═══════════════════════════════════════════════════════
     DICE
  ═══════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════
     DICE — drawn at board center [7,7]
  ═══════════════════════════════════════════════════════ */
  function drawDie(val) {
    // Legacy: also draw on separate canvas if it still exists (transition safety)
    const dieCV=$id('ludo-die-cv');
    if (dieCV) {
      const dc=dieCV.getContext('2d'); const W=120,rr=18;
      dc.clearRect(0,0,W,W);
      const g=dc.createLinearGradient(0,0,W,W);
      g.addColorStop(0,'#1b1f3a'); g.addColorStop(1,'#10121f');
      dc.fillStyle=g; rrect(dc,4,4,W-8,W-8,rr); dc.fill();
      dc.strokeStyle='rgba(255,255,255,0.16)'; dc.lineWidth=1.5;
      rrect(dc,4,4,W-8,W-8,rr); dc.stroke();
      if (val>0) {
        const col=humanSet.has(curPlayer)?CH[curPlayer]:'#dde4ff';
        DOTS[val].forEach(([cx,cy])=>{
          dc.beginPath(); dc.arc(4+(W-8)*cx,4+(W-8)*cy,9.5,0,Math.PI*2);
          dc.fillStyle=col; dc.shadowColor=col+'99'; dc.shadowBlur=7;
          dc.fill(); dc.shadowBlur=0;
        });
      }
    }
    // Main dice drawn by drawDieOnBoard() during board loop — no extra work needed here
  }

  // Draw the dice at the board's center (called from drawBoard)
  function drawDieOnBoard(cs) {
    if (!ctx) return;

    // ── Center cell [7,7] geometry ────────────────────────────────────
    const cellX = 7 * cs;
    const cellY = 7 * cs;
    const cx    = cellX + cs / 2;
    const cy    = cellY + cs / 2;

    // ── 1. Large decorative background — fills the full center cell ───
    //    Slightly larger rounded rect with a dark gradient + subtle ring
    const bgSz = cs * 0.96;
    const bgX  = cx - bgSz / 2;
    const bgY  = cy - bgSz / 2;
    const bgR  = bgSz * 0.22;

    // Dark base
    ctx.fillStyle = '#08091a';
    rrect(ctx, bgX, bgY, bgSz, bgSz, bgR);
    ctx.fill();

    // Faint rainbow ring (all 4 player colours as gradient)
    const ring = ctx.createLinearGradient(bgX, bgY, bgX + bgSz, bgY + bgSz);
    ring.addColorStop(0,    '#f4433688');  // red
    ring.addColorStop(0.33, '#4caf5088');  // green
    ring.addColorStop(0.66, '#ffc10788');  // yellow
    ring.addColorStop(1,    '#2196f388');  // blue
    ctx.strokeStyle = ring;
    ctx.lineWidth   = 2;
    rrect(ctx, bgX, bgY, bgSz, bgSz, bgR);
    ctx.stroke();

    // ── 2. Dice — sits neatly inside the center cell ──────────────────
    const col = humanSet.has(curPlayer) ? CH[curPlayer] : '#dde4ff';
    const sz  = cs * 0.72;   // fits comfortably within the cell
    const r   = sz * 0.18;
    const x   = cx - sz / 2;
    const y   = cy - sz / 2;

    // Shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur    = 10;
    ctx.shadowOffsetY = 3;

    // Body gradient
    const bg = ctx.createLinearGradient(x, y, x + sz, y + sz);
    bg.addColorStop(0, '#252850');
    bg.addColorStop(1, '#0d0f22');
    ctx.fillStyle = bg;
    rrect(ctx, x, y, sz, sz, r);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Border — current player colour
    ctx.strokeStyle = col + 'cc';
    ctx.lineWidth   = 1.6;
    rrect(ctx, x, y, sz, sz, r);
    ctx.stroke();

    // ── 3. Dots or ? ──────────────────────────────────────────────────
    if (diceVal > 0) {
      const dotR = sz * 0.1;
      DOTS[diceVal].forEach(([fx, fy]) => {
        const dx = x + sz * fx;
        const dy = y + sz * fy;
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
        ctx.fillStyle   = col;
        ctx.shadowColor = col + 'bb';
        ctx.shadowBlur  = 6;
        ctx.fill();
        ctx.shadowBlur  = 0;
      });
    } else {
      ctx.fillStyle    = 'rgba(255,255,255,0.30)';
      ctx.font         = `bold ${sz * 0.48}px 'Orbitron',sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy);
    }

    // ── 4. Rolling pulse ring around dice ─────────────────────────────
    if (phase === 'rolling' || phase === 'bot') {
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.3 + Math.sin(pulseT * 14) * 0.3;
      rrect(ctx, x - 3, y - 3, sz + 6, sz + 6, r + 3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function animateRoll(cb) {
    // The dice is drawn on the main board canvas via drawDieOnBoard(),
    // so animation is driven by the RAF loop automatically.
    // We just need to tick diceVal rapidly then settle.
    const btn0=$id('ludo-sbtn-0'),btn1=$id('ludo-sbtn-1'),
          btn2=$id('ludo-sbtn-2'),btn3=$id('ludo-sbtn-3');
    [btn0,btn1,btn2,btn3].forEach(b=>{ if(b) b.disabled=true; });
    let ticks=0;
    const iv=setInterval(()=>{
      diceVal=1+Math.floor(Math.random()*6);
      if (++ticks>=9) {
        clearInterval(iv);
        [btn0,btn1,btn2,btn3].forEach(b=>{ if(b) b.disabled=false; });
        cb();
      }
    },55);
  }

  /* ═══════════════════════════════════════════════════════
     PUBLIC STOP / RESUME — called by dzPauseAllGames / dzResumeAllGames
  ═══════════════════════════════════════════════════════ */
  window.ludomStop = function () {
    stopMusic();
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  };

  window.ludomResume = function () {
    // Only restart if a game is in progress (ludo-play panel visible, not done)
    var playEl = document.getElementById('ludo-play');
    if (!playEl || playEl.classList.contains('hidden')) return;
    if (phase === 'done') return;
    // Restart RAF loop if it was cancelled
    if (!animId) animId = requestAnimationFrame(loop);
    // Restart background music (only if it was on before pause)
    if (!musicOn) startMusic();
  };

  /* ═══════════════════════════════════════════════════════
     INIT SETUP PREVIEW  (called once at script load)
  ═══════════════════════════════════════════════════════ */
  (function initSetup() {
    // Run after DOM is ready
    if (document.readyState==='loading') {
      document.addEventListener('DOMContentLoaded',()=>{ updateSetupPreview(); updateSetupRows(); renderPvpNameFields(); });
    } else {
      updateSetupPreview(); updateSetupRows(); renderPvpNameFields();
    }
  })();

})();
