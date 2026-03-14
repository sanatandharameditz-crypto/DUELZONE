// ═══════════════════════════════════════════════════════════════════
// DuelZone · Ping Pong — Final v4
// Controls: Mouse move (desktop) · Finger drag (mobile)
//           Left half of canvas = P1 · Right half = P2 (2P mode)
//           ESC = pause
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  /* ── Bot difficulty ─────────────────────────────────────────── */
  var BOT = {
    easy : { spd:0.026, err:0.24, react:440 },
    med  : { spd:0.050, err:0.09, react:160 },
    hard : { spd:0.085, err:0.02, react: 50 }
  };

  /* ── Design constants (fractions of canvas H) ───────────────── */
  var WIN=7, FPW=0.028, FPH=0.22, FPE=0.045, FBR=0.022;
  var FIS=0.0125, FMS=0.031, FIN=0.0008;

  /* ── Runtime ────────────────────────────────────────────────── */
  var canvas, ctx, W, H, raf=null;
  var gameState='idle'; // idle|playing|serving|paused|over
  var mode='bot', diff='med';

  var p1, p2, ball;
  var s1=0, s2=0, flash=0, flashSide=0;

  /* ── Scaled px values (set by resize()) ─────────────────────── */
  var pW, pH, pEdge, bR, iSpd, mSpd, inc;

  /* ── Bot ────────────────────────────────────────────────────── */
  var botY=0, botTick=0;

  /* ── Pointer input (mouse + touch unified) ──────────────────── */
  // pointerY[side] = current Y in canvas-space, or null if no pointer
  var pointerY = { p1:null, p2:null };
  // Map touch identifier → side ('p1'|'p2')
  var touchSide = {};

  /* ── DOM refs ───────────────────────────────────────────────── */
  var $sp1,$sp2,$lp1,$lp2,$ov,$setup,$pause,$result;
  var $resTitle,$resSub,$diffRow,$hintText,$ctrlHint;

  /* ── One-time wiring guards ─────────────────────────────────── */
  var _uiWired=false, _keysWired=false, _ptrWired=false, _resizeWired=false;

  /* ═══════════════════════════════════════════════════════════
     PUBLIC
  ═══════════════════════════════════════════════════════════ */
  function ppInit() {
    canvas = document.getElementById('pp-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    $sp1=$id('pp-score-p1'); $sp2=$id('pp-score-p2');
    $lp1=$id('pp-label-p1'); $lp2=$id('pp-label-p2');
    $ov=$id('pp-overlay');   $setup=$id('pp-setup-panel');
    $pause=$id('pp-pause-panel'); $result=$id('pp-result-panel');
    $resTitle=$id('pp-result-title'); $resSub=$id('pp-result-sub');
    $diffRow=$id('pp-diff-row'); $hintText=$id('pp-hint-text');
    $ctrlHint=$id('pp-ctrl-hint');

    // Reset pointer state on every entry
    pointerY={p1:null,p2:null}; touchSide={};

    stopLoop(); resize();
    wireUI(); wireKeys(); wirePointer(); wireResize();
    setMode(mode); setDiff(diff);
    showPanel('setup'); gameState='idle';
    resetScores(); drawIdle();
  }

  function $id(id){ return document.getElementById(id); }

  /* ── Resize ─────────────────────────────────────────────────── */
  function resize() {
    var vw=window.innerWidth, vh=window.innerHeight;
    var isLandscape = vw > vh && vh < 520;
    var avW, avH;
    if (isLandscape) {
      // Landscape phone: height drives the canvas size
      // Reserve ~80px for header + score row
      avH = vh - 80;
      avW = Math.min(vw - 16, Math.round(avH / 0.5625)); // keep 16:9
    } else {
      avW = Math.min(vw - 24, 740);
      var asp = vw < 480 ? 0.80 : vw < 680 ? 0.68 : 0.5625;
      avH = Math.round(avW * asp);
    }
    W = canvas.width  = Math.round(avW);
    H = canvas.height = Math.round(avH);
    pW   =Math.max(7, Math.round(FPW*H));
    pH   =Math.max(32,Math.round(FPH*H));
    pEdge=Math.max(6, Math.round(FPE*H));
    bR   =Math.max(5, Math.round(FBR*H));
    iSpd=FIS*H; mSpd=FMS*H; inc=FIN*H;
  }

  function wireResize() {
    if (_resizeWired) return; _resizeWired=true;
    window.addEventListener('resize', function(){
      if (gameState==='playing'||gameState==='serving') return;
      resize(); drawIdle();
    });
  }

  /* ── UI buttons ─────────────────────────────────────────────── */
  function wireUI() {
    if (_uiWired) return; _uiWired=true;
    on('pp-back-btn',        backToHub);
    on('pp-pause-btn',       togglePause);
    on('pp-mode-bot',  function(){ setMode('bot'); });
    on('pp-mode-2p',   function(){ setMode('2p');  });
    on('pp-diff-easy', function(){ setDiff('easy'); });
    on('pp-diff-med',  function(){ setDiff('med');  });
    on('pp-diff-hard', function(){ setDiff('hard'); });
    on('pp-start-btn',       startGame);
    on('pp-resume-btn',      resumeGame);
    on('pp-pause-menu-btn',  backToMenu);
    on('pp-again-btn',       playAgain);
    on('pp-result-menu-btn', backToMenu);
  }
  function on(id,fn){ var el=$id(id); if(el) el.addEventListener('click',fn); }

  /* ── Keyboard ───────────────────────────────────────────────── */
  function wireKeys() {
    if (_keysWired) return; _keysWired=true;
    document.addEventListener('keydown', function(e){
      if (e.key==='Escape') togglePause();
      if (['ArrowUp','ArrowDown',' '].indexOf(e.key)>-1) e.preventDefault();
    });
  }

  /* ── Pointer: mouse + touch, wired once ─────────────────────── */
  function wirePointer() {
    if (_ptrWired) return; _ptrWired=true;

    // Mouse — move anywhere on canvas controls p1 in bot mode,
    // or the half the cursor is on in 2P mode
    canvas.addEventListener('mousemove', function(e){
      if (gameState!=='playing'&&gameState!=='serving') return;
      var rect=canvas.getBoundingClientRect();
      var cy=(e.clientY-rect.top)*(H/rect.height);
      if (mode==='bot') {
        pointerY.p1=cy;
      } else {
        if (e.clientX-rect.left < rect.width*0.5) pointerY.p1=cy;
        else                                       pointerY.p2=cy;
      }
    });

    canvas.addEventListener('mouseleave', function(){
      pointerY.p1=null; pointerY.p2=null;
    });

    // Touch — multi-touch: each finger owns the half it started on
    canvas.addEventListener('touchstart', onTouchDown, {passive:false});
    canvas.addEventListener('touchmove',  onTouchMove,  {passive:false});
    canvas.addEventListener('touchend',   onTouchUp,    {passive:false});
    canvas.addEventListener('touchcancel',onTouchUp,    {passive:false});
  }

  function canvasY(clientY){
    var rect=canvas.getBoundingClientRect();
    return (clientY-rect.top)*(H/rect.height);
  }
  function canvasX(clientX){
    var rect=canvas.getBoundingClientRect();
    return (clientX-rect.left)*(W/rect.width);
  }

  function onTouchDown(e){
    e.preventDefault();
    for (var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      var cx=canvasX(t.clientX);
      // Assign side based on where finger STARTED
      var side;
      if (mode==='bot') {
        side='p1'; // any finger controls player in bot mode
      } else {
        side= cx < W*0.5 ? 'p1' : 'p2';
      }
      touchSide[t.identifier]=side;
      pointerY[side]=canvasY(t.clientY);
    }
  }

  function onTouchMove(e){
    e.preventDefault();
    for (var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      var side=touchSide[t.identifier];
      if (side) pointerY[side]=canvasY(t.clientY);
    }
  }

  function onTouchUp(e){
    e.preventDefault();
    for (var i=0;i<e.changedTouches.length;i++){
      var id=e.changedTouches[i].identifier;
      var side=touchSide[id];
      if (side) {
        // Only null out if no other touch still holds this side
        var stillHeld=false;
        var remaining=e.touches;
        for (var j=0;j<remaining.length;j++){
          if (touchSide[remaining[j].identifier]===side){ stillHeld=true; break; }
        }
        if (!stillHeld) pointerY[side]=null;
        delete touchSide[id];
      }
    }
  }

  /* ── Mode / Difficulty ──────────────────────────────────────── */
  function setMode(m) {
    mode=m;
    act('pp-mode-bot', m==='bot'); act('pp-mode-2p', m==='2p');
    hide($diffRow, m==='2p');
    // Update control hint text
    if ($ctrlHint) {
      $ctrlHint.innerHTML = m==='bot'
        ? '<b>MOVE MOUSE</b> or <b>DRAG FINGER</b> anywhere on the court'
        : '<b>LEFT SIDE</b> = Player 1 &nbsp;·&nbsp; <b>RIGHT SIDE</b> = Player 2';
    }
    if ($hintText) {
      $hintText.textContent = m==='bot'
        ? 'MOVE MOUSE / DRAG TO PLAY  ·  ESC TO PAUSE'
        : 'LEFT HALF = P1  ·  RIGHT HALF = P2  ·  ESC TO PAUSE';
    }
    updateLabels();
  }

  function setDiff(d) {
    diff=d;
    ['easy','med','hard'].forEach(function(x){ act('pp-diff-'+x, x===d); });
  }

  function act(id,on){ var el=$id(id); if(!el)return; on?el.classList.add('active'):el.classList.remove('active'); }
  function hide(el,yes){ if(!el)return; yes?el.classList.add('pp-hidden'):el.classList.remove('pp-hidden'); }

  /* ── Panels ─────────────────────────────────────────────────── */
  function showPanel(name){
    hide($ov,false);
    [$setup,$pause,$result].forEach(function(p){ if(p) hide(p,true); });
    if(name==='setup'  &&$setup)  hide($setup, false);
    if(name==='pause'  &&$pause)  hide($pause, false);
    if(name==='result' &&$result) hide($result,false);
    if(name==='none')             hide($ov,    true);
  }

  /* ── Lifecycle ──────────────────────────────────────────────── */
  function backToHub(){
    stopLoop(); gameState='idle';
    pointerY={p1:null,p2:null}; touchSide={};
    if(typeof showHub==='function') showHub();
  }

  function startGame(){
    resize(); resetScores(); updateLabels(); buildObjects();
    botTick=0; calcBotTarget();
    pointerY={p1:null,p2:null}; touchSide={};
    showPanel('none'); gameState='playing'; startLoop();
  }

  function playAgain(){ startGame(); }

  function backToMenu(){
    stopLoop(); gameState='idle';
    pointerY={p1:null,p2:null}; touchSide={};
    resetScores(); setMode(mode); setDiff(diff);
    showPanel('setup'); resize(); drawIdle();
  }

  function togglePause(){
    if(gameState==='playing'||gameState==='serving'){
      stopLoop(); gameState='paused'; showPanel('pause'); draw();
    } else if(gameState==='paused'){
      resumeGame();
    }
  }

  function resumeGame(){
    showPanel('none'); gameState='playing'; startLoop();
  }

  function stopLoop(){ if(raf){cancelAnimationFrame(raf);raf=null;} }
  function startLoop(){ if(!raf) raf=requestAnimationFrame(tick); }

  /* ── Score / Labels ─────────────────────────────────────────── */
  function resetScores(){
    s1=s2=0;
    if($sp1) $sp1.textContent='0';
    if($sp2) $sp2.textContent='0';
  }

  function updateLabels(){
    if($lp1) $lp1.textContent='PLAYER 1';
    if($lp2) $lp2.textContent= mode==='bot' ? 'BOT · '+diff.toUpperCase() : 'PLAYER 2';
  }

  /* ── Objects ────────────────────────────────────────────────── */
  function buildObjects(){
    p1={x:pEdge,      y:H/2-pH/2, w:pW, h:pH};
    p2={x:W-pEdge-pW, y:H/2-pH/2, w:pW, h:pH};
    launchBall(Math.random()<0.5?1:-1);
  }

  function launchBall(dir){
    var a=(Math.random()*50-25)*Math.PI/180;
    ball={x:W/2,y:H/2, vx:dir*iSpd*Math.cos(a), vy:iSpd*Math.sin(a), spd:iSpd, trail:[]};
  }

  /* ── Tick ───────────────────────────────────────────────────── */
  function tick(now){
    if(gameState==='playing'||gameState==='serving'){
      movePaddles(now);
      if(gameState==='playing'){ moveBall(); if(flash>0)flash--; }
      draw();
      raf=requestAnimationFrame(tick);
    } else {
      raf=null;
    }
  }

  /* ── Paddle movement — pure pointer tracking ────────────────── */
  function movePaddles(now){
    // P1: snap center to pointer Y
    if(pointerY.p1!==null){
      p1.y=clamp(pointerY.p1 - pH/2, 0, H-pH);
    }
    // P2: bot or player
    if(mode==='bot'){
      moveBot(now);
    } else {
      if(pointerY.p2!==null){
        p2.y=clamp(pointerY.p2 - pH/2, 0, H-pH);
      }
    }
  }

  /* ── Bot AI ─────────────────────────────────────────────────── */
  function moveBot(now){
    var cfg=BOT[diff], spd=cfg.spd*H;
    if(now-botTick>cfg.react){ botTick=now; calcBotTarget(); }
    var centre=p2.y+pH/2, delta=botY-centre;
    p2.y=clamp(p2.y + Math.sign(delta)*Math.min(Math.abs(delta),spd), 0, H-pH);
  }

  function calcBotTarget(){
    var cfg=BOT[diff];
    if(!ball||ball.vx<=0){ botY=H/2+(Math.random()-.5)*pH*.4; return; }
    var py=predictBallY(p2.x);
    botY=clamp(py+(Math.random()*2-1)*cfg.err*H, pH/2, H-pH/2);
  }

  function predictBallY(tx){
    var sx=ball.x,sy=ball.y,svx=ball.vx,svy=ball.vy;
    for(var i=0;i<600;i++){
      sx+=svx; sy+=svy;
      if(sy-bR<0){sy=bR;   svy= Math.abs(svy);}
      if(sy+bR>H){sy=H-bR; svy=-Math.abs(svy);}
      if(sx>=tx||sx<-10) break;
    }
    return sy;
  }

  /* ── Ball — sub-stepped ─────────────────────────────────────── */
  function moveBall(){
    ball.trail.push({x:ball.x,y:ball.y});
    if(ball.trail.length>10) ball.trail.shift();

    var steps=Math.min(16,Math.max(1,Math.ceil(Math.abs(ball.vx)/(pW*0.55))));
    var dx=ball.vx/steps, dy=ball.vy/steps;

    for(var s=0;s<steps;s++){
      ball.x+=dx; ball.y+=dy;

      if(ball.y-bR<0){ ball.y=bR; ball.vy=Math.abs(ball.vy); dy=ball.vy/steps; sfx('wall'); }
      if(ball.y+bR>H){ ball.y=H-bR; ball.vy=-Math.abs(ball.vy); dy=ball.vy/steps; sfx('wall'); }

      // P1 paddle
      if(ball.vx<0 && ball.x-bR<p1.x+p1.w+1 && ball.x+bR>p1.x && ball.y+bR>p1.y && ball.y-bR<p1.y+p1.h){
        ball.x=p1.x+p1.w+bR+1; bounce(p1,1); dx=ball.vx/steps; dy=ball.vy/steps; sfx('paddle'); break;
      }
      // P2 paddle
      if(ball.vx>0 && ball.x+bR>p2.x-1 && ball.x-bR<p2.x+p2.w && ball.y+bR>p2.y && ball.y-bR<p2.y+p2.h){
        ball.x=p2.x-bR-1; bounce(p2,-1); dx=ball.vx/steps; dy=ball.vy/steps; sfx('paddle');
        if(mode==='bot') botTick=0;
        break;
      }

      if(ball.x+bR<0){  s2++; if($sp2)$sp2.textContent=s2; flashSide=2; flash=22; sfx('score'); if(!checkWin())serve(1);  return; }
      if(ball.x-bR>W){  s1++; if($sp1)$sp1.textContent=s1; flashSide=1; flash=22; sfx('score'); if(!checkWin())serve(-1); return; }
    }
  }

  function bounce(pad,dir){
    var rel=clamp((ball.y-(pad.y+pad.h/2))/(pad.h/2),-0.95,0.95);
    var a=rel*63*Math.PI/180;
    ball.spd=Math.min(ball.spd+inc,mSpd);
    ball.vx=dir*ball.spd*Math.cos(a);
    ball.vy=ball.spd*Math.sin(a);
  }

  function serve(dir){
    gameState='serving'; startLoop();
    setTimeout(function(){
      if(gameState==='serving'){ launchBall(dir); gameState='playing'; botTick=0; calcBotTarget(); }
    },700);
  }

  function checkWin(){
    if(s1>=WIN||s2>=WIN){
      var w=s1>=WIN?'PLAYER 1':(mode==='bot'?'BOT':'PLAYER 2');
      gameState='over';
      setTimeout(function(){
        if($resTitle) $resTitle.textContent=w+' WINS!';
        if($resSub)   $resSub.textContent=s1+' – '+s2;
        showPanel('result'); stopLoop();
      },700);
      return true;
    }
    return false;
  }

  /* ── Draw ───────────────────────────────────────────────────── */
  var C1='#00cfff', C2='#ff6060', CW='#e8eaf6';

  function draw(){
    ctx.clearRect(0,0,W,H);
    drawBg(); drawNet();
    // In 2P mode draw divider guide while serving/playing
    if(mode==='2p' && (gameState==='playing'||gameState==='serving')) drawSideguide();
    if(ball){drawTrail();drawBall();}
    if(p1) drawPad(p1,C1);
    if(p2) drawPad(p2,C2);
    if(gameState==='serving') drawServeHint();
    // Draw subtle pointer dot so player can see exactly where mouse is
    drawPointerDot();
  }

  function drawIdle(){
    if(!ctx) return;
    ctx.clearRect(0,0,W,H); drawBg(); drawNet();
    if(mode==='2p') drawSideguide();
    drawPad({x:pEdge,      y:H/2-pH/2,w:pW,h:pH},C1);
    drawPad({x:W-pEdge-pW, y:H/2-pH/2,w:pW,h:pH},C2);
  }

  function drawBg(){
    ctx.fillStyle='#060810'; ctx.fillRect(0,0,W,H);
    if(flash>0){
      var a=(flash/22)*.16, rgb=flashSide===1?'0,207,255':'255,96,96';
      var g=ctx.createLinearGradient(flashSide===1?W:0,0,flashSide===1?0:W,0);
      g.addColorStop(0,'rgba('+rgb+','+a+')'); g.addColorStop(.55,'rgba('+rgb+',0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    }
  }

  function drawNet(){
    var seg=Math.round(H*.055),gap=Math.round(H*.03),x=W/2-1;
    ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=2;
    for(var y=0;y<H;y+=seg+gap){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,Math.min(y+seg,H)); ctx.stroke(); }
  }

  // Subtle centre line to show 2P split zone
  function drawSideguide(){
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,0.04)';
    ctx.setLineDash([4,6]);
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
    ctx.setLineDash([]);
    // Labels
    ctx.font='bold '+Math.round(H*.04)+'px Rajdhani,sans-serif';
    ctx.textBaseline='top'; ctx.fillStyle='rgba(0,207,255,0.07)';
    ctx.textAlign='left';  ctx.fillText('P1',pEdge+pW+6, 6);
    ctx.textAlign='right'; ctx.fillStyle='rgba(255,96,96,0.07)';
    ctx.fillText('P2',W-pEdge-pW-6,6);
    ctx.restore();
  }

  function drawTrail(){
    var n=ball.trail.length;
    for(var i=0;i<n;i++){
      var pt=ball.trail[i],a=((i+1)/n)*.28,r=bR*((i+1)/n)*.75;
      ctx.beginPath(); ctx.arc(pt.x,pt.y,r,0,Math.PI*2);
      ctx.fillStyle='rgba(0,229,255,'+a+')'; ctx.fill();
    }
  }

  function drawBall(){
    var g=ctx.createRadialGradient(ball.x,ball.y,0,ball.x,ball.y,bR*3.5);
    g.addColorStop(0,'rgba(0,229,255,0.25)'); g.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(ball.x,ball.y,bR*3.5,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.arc(ball.x,ball.y,bR,0,Math.PI*2); ctx.fillStyle=CW; ctx.fill();
  }

  function drawPad(pad,col){
    var cx=pad.x+pad.w/2, cy=pad.y+pad.h/2;
    var g=ctx.createRadialGradient(cx,cy,0,cx,cy,pad.h*.9);
    g.addColorStop(0,col+'38'); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.fillRect(cx-pad.h,cy-pad.h,pad.h*2,pad.h*2);
    var rx=Math.min(pad.w/2,5);
    ctx.beginPath();
    if(ctx.roundRect){ ctx.roundRect(pad.x,pad.y,pad.w,pad.h,rx); }
    else{
      var x=pad.x,y=pad.y,w=pad.w,h=pad.h;
      ctx.moveTo(x+rx,y); ctx.lineTo(x+w-rx,y); ctx.quadraticCurveTo(x+w,y,x+w,y+rx);
      ctx.lineTo(x+w,y+h-rx); ctx.quadraticCurveTo(x+w,y+h,x+w-rx,y+h);
      ctx.lineTo(x+rx,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-rx);
      ctx.lineTo(x,y+rx); ctx.quadraticCurveTo(x,y,x+rx,y); ctx.closePath();
    }
    ctx.fillStyle=col; ctx.fill();
  }

  function drawPointerDot(){
    // Draw a small crosshair at the active pointer position(s)
    // so the player can see where their control point is
    var pairs=[['p1',C1],['p2',C2]];
    for(var i=0;i<pairs.length;i++){
      var side=pairs[i][0], col=pairs[i][1];
      var py=pointerY[side];
      if(py===null) continue;
      // Determine X: p1 on left quarter, p2 on right quarter
      var px= side==='p1' ? W*0.12 : W*0.88;
      ctx.save();
      ctx.globalAlpha=0.35;
      ctx.strokeStyle=col; ctx.lineWidth=1.5;
      var r=6;
      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px,py-r-4); ctx.lineTo(px,py+r+4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px-r-4,py); ctx.lineTo(px+r+4,py); ctx.stroke();
      ctx.restore();
    }
  }

  function drawServeHint(){
    ctx.save();
    ctx.globalAlpha=.4;
    ctx.font='bold '+Math.round(H*.058)+'px Orbitron,monospace';
    ctx.fillStyle='#00e5ff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('GET READY',W/2,H*.2);
    ctx.restore();
  }

  /* ── SFX ────────────────────────────────────────────────────── */
  var _ac=null;
  function getAC(){ if(!_ac)try{_ac=new(window.AudioContext||window.webkitAudioContext)();}catch(e){} return _ac; }

  function sfx(type){
    var ac=getAC(); if(!ac) return;
    var o=ac.createOscillator(),g=ac.createGain();
    o.connect(g); g.connect(ac.destination);
    var t=ac.currentTime;
    if(type==='paddle'){
      o.frequency.setValueAtTime(500,t); o.frequency.exponentialRampToValueAtTime(270,t+.07);
      g.gain.setValueAtTime(.16,t); g.gain.exponentialRampToValueAtTime(.001,t+.10);
      o.start(t); o.stop(t+.11);
    } else if(type==='wall'){
      o.frequency.setValueAtTime(240,t); o.frequency.exponentialRampToValueAtTime(130,t+.05);
      g.gain.setValueAtTime(.07,t); g.gain.exponentialRampToValueAtTime(.001,t+.07);
      o.start(t); o.stop(t+.08);
    } else if(type==='score'){
      o.type='square';
      o.frequency.setValueAtTime(200,t); o.frequency.setValueAtTime(300,t+.1); o.frequency.setValueAtTime(420,t+.2);
      g.gain.setValueAtTime(.07,t); g.gain.exponentialRampToValueAtTime(.001,t+.40);
      o.start(t); o.stop(t+.41);
    }
  }

  function clamp(v,lo,hi){ return v<lo?lo:(v>hi?hi:v); }

  window.ppInit=ppInit;
  window.ppStop=function(){ stopLoop(); gameState='idle'; pointerY={p1:null,p2:null}; touchSide={}; };
})();
