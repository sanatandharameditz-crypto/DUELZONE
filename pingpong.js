// ═══════════════════════════════════════════════════════════════════
// DuelZone · Ping Pong — v5  (Spin + Smash Edition)
//
// WHAT CHANGED FROM v4:
//   • Full 2D paddle movement (X + Y) — paddles now follow mouse/touch
//     in both axes. Each paddle stays in its own half of the court.
//   • Vertical portrait table with real green surface, net, markings.
//   • SPIN PHYSICS:   ball.spinX / ball.spinY curve the trajectory.
//   • SMASH SYSTEM:   fast forward paddle hit → speed burst + orange
//     glow flash + camera shake + two-oscillator smash sound.
//   • Delta-time loop — physics are frame-rate independent.
//   • Friction:       ball.vx *= 0.995, ball.vy *= 0.995 each frame.
//   • Win score: 11, must win by 2 (standard table tennis rules).
//
// PRESERVED UNCHANGED:
//   window.ppInit, window.ppStop — same exported names as original.
//   All DOM ids, scoring display, mode/difficulty buttons,
//   pause/result/setup panels, sfx audio system.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════
     SECTION 1 — CONFIGURATION
  ═══════════════════════════════════════════════════════════════ */

  var WIN       = 11;      // first to WIN
  var WIN_BY    = 2;       // must lead by this many

  /* ── Table layout (fractions of W / H) ─────────────────────── */
  var F_TABLE_MX = 0.055;
  var F_TABLE_MY = 0.035;
  var F_NET_H    = 0.014;

  /* ── Paddle ──────────────────────────────────────────────────── */
  var F_PAD_R  = 0.108;    // paddle circle radius as fraction of W
  var PAD_LERP = 0.19;     // smooth-follow factor (exponential lerp)

  /* ── Ball ───────────────────────────────────────────────────── */
  var F_BALL_R   = 0.020;
  var F_BASE_SPD = 0.0020;  // gentle serve speed   (fraction of H per ms)
  var F_MAX_SPD  = 0.0115;  // hard smash cap        (fraction of H per ms)
  var F_SPD_INC  = 0.0;     // NO auto-increment — speed is set purely by paddle velocity
  var FRICTION   = 0.978;   // stronger decay so slow returns visibly lose pace

  /* ── ARC / GRAVITY PHYSICS ──────────────────────────────────── */
  // Z-axis = height above the table surface (0 = table level).
  // All F_ constants are fractions of H so physics scale with canvas.
  var F_GRAVITY_Z   = 0.0000066; // gravity accel  (H/ms²)
  var F_VZ_LAUNCH   = 0.000726;  // upward impulse on paddle hit (H/ms)
  var F_NET_Z_H     = 0.018;     // net height in z-space  (fraction of H)
  var TABLE_BOUNCE_Z= 0.48;      // z-restitution when ball hits table surface
  var F_TABLE_FRIC  = 0.0015;    // xy speed lost per ms when ball is rolling on table
  var Z_PERSP       = 0.65;      // how many screen-px the ball rises per z-unit

  /* ── computed z values (set in resize()) ──────────────────── */
  var gravityZ=0, vzLaunch=0, netZHeight=0;

  /* ── SPIN SYSTEM ─────────────────────────────────────────────── */
  var SPIN_FACTOR = 0.55;   // paddleVelocity × this = spin applied
  var SPIN_APPLY  = 0.010;  // spinX/Y added to vx/vy per frame
  var SPIN_DECAY  = 0.98;   // spin decay per frame
  var SPIN_BOUNCE = 0.35;   // spin fraction transferred on wall bounce

  /* ── SMASH SYSTEM ────────────────────────────────────────────── */
  var SMASH_VEL_THRESH = 0.012;  // paddle speed (px/ms) to trigger smash
  var SMASH_BOOST      = 1.80;   // velocity multiplier on smash
  var SMASH_FLASH_DUR  = 280;    // ms smash glow lasts
  var SHAKE_DUR        = 220;    // ms camera shake lasts
  var SHAKE_MAG        = 6;      // px

  /* ── Bot ────────────────────────────────────────────────────── */
  var BOT = {
    easy : { speedF:0.0028, errF:0.30, react:500, predict:false },
    med  : { speedF:0.0052, errF:0.11, react:175, predict:true  },
    hard : { speedF:0.012,  errF:0.001, react: 8, predict:true  }
  };

  /* ═══════════════════════════════════════════════════════════════
     SECTION 2 — RUNTIME STATE
  ═══════════════════════════════════════════════════════════════ */

  var canvas, ctx, W, H, raf = null;
  var gameState = 'idle';
  var mode = 'bot', diff = 'med';

  /* ── Computed pixel values ──────────────────────────────────── */
  var ballR, padR;
  var tX, tY, tW, tH;
  var netY, netH;
  var ballBase, ballMax, ballInc;
  var zoneTop, zoneBot;   // {yMin,yMax} paddle centre Y constraints

  /* ── Game objects ───────────────────────────────────────────── */
  var ball = null, p1 = null, p2 = null;

  /* ── Score & flash ──────────────────────────────────────────── */
  var s1 = 0, s2 = 0, flash = 0, flashSide = 0;

  /* ── Smash / camera shake ────────────────────────────────────── */
  var smashFlash = 0, smashFlashX = 0, smashFlashY = 0;
  var shakeTimer = 0, shakeX = 0, shakeY = 0;

  /* ── Timing ─────────────────────────────────────────────────── */
  var lastTs = 0;

  /* ── Bot ────────────────────────────────────────────────────── */
  var botTargetX = 0, botReactMs = 0;

  /* ── Pointer (canvas-space x,y per player) ───────────────────── */
  var ptr = { p1:{x:null,y:null}, p2:{x:null,y:null} };
  var touchOwner = {};

  /* ── DOM refs ───────────────────────────────────────────────── */
  var $sp1,$sp2,$lp1,$lp2,$ov,$setup,$pause,$result;
  var $resTitle,$resSub,$diffRow,$hintText,$ctrlHint;

  /* ── Wire-once guards ───────────────────────────────────────── */
  var _uiWired=false,_keysWired=false,_ptrWired=false,_resizeWired=false;

  /* ═══════════════════════════════════════════════════════════════
     SECTION 3 — PUBLIC API
  ═══════════════════════════════════════════════════════════════ */

  function ppInit(){
    canvas = document.getElementById('pp-canvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');

    $sp1=$id('pp-score-p1'); $sp2=$id('pp-score-p2');
    $lp1=$id('pp-label-p1'); $lp2=$id('pp-label-p2');
    $ov=$id('pp-overlay');   $setup=$id('pp-setup-panel');
    $pause=$id('pp-pause-panel'); $result=$id('pp-result-panel');
    $resTitle=$id('pp-result-title'); $resSub=$id('pp-result-sub');
    $diffRow=$id('pp-diff-row'); $hintText=$id('pp-hint-text');
    $ctrlHint=$id('pp-ctrl-hint');

    resetPtrs(); stopLoop(); resize();
    wireUI(); wireKeys(); wirePointer(); wireResize();
    setMode(mode); setDiff(diff);
    showPanel('setup'); gameState='idle';
    resetScores(); draw(0);
  }

  function $id(id){ return document.getElementById(id); }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 4 — RESIZE
  ═══════════════════════════════════════════════════════════════ */

  function resize(){
    var vw = window.innerWidth;
    var avW = Math.min(vw-24, 480);
    var asp = vw<520 ? 1.72 : 1.45;
    W = canvas.width  = Math.round(avW);
    H = canvas.height = Math.round(avW*asp);

    tX = Math.round(F_TABLE_MX*W);
    tY = Math.round(F_TABLE_MY*H);
    tW = W - tX*2;
    tH = H - tY*2;

    netH = Math.max(7,  Math.round(F_NET_H  *H));
    netY = tY + tH*0.5 - netH*0.5;

    ballR    = Math.max(7,  Math.round(F_BALL_R  *W));
    padR     = Math.max(20, Math.round(F_PAD_R   *W));
    ballBase = F_BASE_SPD*H;
    ballMax  = F_MAX_SPD *H;
    ballInc  = F_SPD_INC *H;

    /* ── Arc physics scaled to canvas height ──────────────────── */
    gravityZ   = F_GRAVITY_Z  * H;   // px/ms²
    vzLaunch   = F_VZ_LAUNCH  * H;   // px/ms
    netZHeight = F_NET_Z_H    * H;   // px (z-space)

    zoneTop = { yMin:tY+padR+2,           yMax:netY-padR-2 };
    zoneBot = { yMin:netY+netH+padR+2,    yMax:tY+tH-padR-2 };
  }

  function wireResize(){
    if(_resizeWired) return; _resizeWired=true;
    window.addEventListener('resize',function(){
      if(gameState==='playing'||gameState==='serving') return;
      resize(); draw(0);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 5 — UI
  ═══════════════════════════════════════════════════════════════ */

  function wireUI(){
    if(_uiWired) return; _uiWired=true;
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

  function wireKeys(){
    if(_keysWired) return; _keysWired=true;
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape') togglePause();
      if(['ArrowUp','ArrowDown',' '].indexOf(e.key)>-1) e.preventDefault();
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 6 — POINTER INPUT (tracks X AND Y — full 2D movement)
     bot mode  → whole canvas = P1
     2P mode   → bottom half = P1,  top half = P2
  ═══════════════════════════════════════════════════════════════ */

  function wirePointer(){
    if(_ptrWired) return; _ptrWired=true;

    canvas.addEventListener('mousemove',function(e){
      if(gameState!=='playing'&&gameState!=='serving') return;
      var pt=toCanvas(e.clientX,e.clientY);
      if(mode==='bot'){ ptr.p1.x=pt.x; ptr.p1.y=pt.y; }
      else{
        if(pt.y<H*0.5){ ptr.p2.x=pt.x; ptr.p2.y=pt.y; }
        else           { ptr.p1.x=pt.x; ptr.p1.y=pt.y; }
      }
    });
    canvas.addEventListener('mouseleave',function(){ resetPtrs(); });
    canvas.addEventListener('touchstart',  onTD,{passive:false});
    canvas.addEventListener('touchmove',   onTM,{passive:false});
    canvas.addEventListener('touchend',    onTU,{passive:false});
    canvas.addEventListener('touchcancel', onTU,{passive:false});
  }

  function toCanvas(cx,cy){
    var r=canvas.getBoundingClientRect();
    return {x:(cx-r.left)*(W/r.width), y:(cy-r.top)*(H/r.height)};
  }
  function sideFor(pt){ return (mode==='bot'||pt.y>=H*0.5) ? 'p1' : 'p2'; }

  function onTD(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i], pt=toCanvas(t.clientX,t.clientY);
      var s=sideFor(pt); touchOwner[t.identifier]=s;
      ptr[s].x=pt.x; ptr[s].y=pt.y;
    }
  }
  function onTM(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i], s=touchOwner[t.identifier]; if(!s) continue;
      var pt=toCanvas(t.clientX,t.clientY); ptr[s].x=pt.x; ptr[s].y=pt.y;
    }
  }
  function onTU(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var tid=e.changedTouches[i].identifier, s=touchOwner[tid]; if(!s) continue;
      var held=false;
      for(var j=0;j<e.touches.length;j++) if(touchOwner[e.touches[j].identifier]===s){held=true;break;}
      if(!held){ptr[s].x=null;ptr[s].y=null;}
      delete touchOwner[tid];
    }
  }
  function resetPtrs(){ ptr={p1:{x:null,y:null},p2:{x:null,y:null}}; touchOwner={}; }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 7 — MODE / DIFFICULTY / PANELS
  ═══════════════════════════════════════════════════════════════ */

  function setMode(m){
    mode=m;
    act('pp-mode-bot',m==='bot'); act('pp-mode-2p',m==='2p');
    hide($diffRow,m==='2p');
    if($ctrlHint) $ctrlHint.innerHTML = m==='bot'
      ? '<b>DRAG ANYWHERE</b> on court — paddle follows in all directions'
      : '<b>BOTTOM HALF</b> = Player 1 &nbsp;·&nbsp; <b>TOP HALF</b> = Player 2';
    if($hintText) $hintText.textContent = m==='bot'
      ? 'DRAG TO MOVE PADDLE FREELY  ·  ESC TO PAUSE'
      : 'BOTTOM = P1  ·  TOP = P2  ·  ESC TO PAUSE';
    updateLabels();
  }
  function setDiff(d){
    diff=d;
    ['easy','med','hard'].forEach(function(x){ act('pp-diff-'+x,x===d); });
  }
  function act(id,on){ var el=$id(id); if(!el)return; on?el.classList.add('active'):el.classList.remove('active'); }
  function hide(el,yes){ if(!el)return; yes?el.classList.add('pp-hidden'):el.classList.remove('pp-hidden'); }
  function showPanel(name){
    hide($ov,false);
    [$setup,$pause,$result].forEach(function(p){ if(p) hide(p,true); });
    if(name==='setup' &&$setup) hide($setup,false);
    if(name==='pause' &&$pause) hide($pause,false);
    if(name==='result'&&$result)hide($result,false);
    if(name==='none')           hide($ov,true);
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 8 — LIFECYCLE
  ═══════════════════════════════════════════════════════════════ */

  function backToHub(){
    stopLoop(); gameState='idle'; resetPtrs();
    if(typeof showHub==='function') showHub();
  }
  function startGame(){
    resize(); resetScores(); updateLabels(); buildObjects();
    resetPtrs(); smashFlash=0; shakeTimer=0;
    showPanel('none'); gameState='serving'; lastTs=0;
    startLoop(); scheduleLaunch(1);
  }
  function playAgain(){ startGame(); }
  function resumeGame(){ showPanel('none'); lastTs=0; gameState='playing'; startLoop(); }
  function backToMenu(){
    stopLoop(); gameState='idle'; resetPtrs();
    resetScores(); setMode(mode); setDiff(diff);
    showPanel('setup'); resize(); draw(0);
  }
  function togglePause(){
    if(gameState==='playing'||gameState==='serving'){
      stopLoop(); gameState='paused'; showPanel('pause'); draw(0);
    } else if(gameState==='paused'){ resumeGame(); }
  }
  function stopLoop(){ if(raf){cancelAnimationFrame(raf);raf=null;} }
  function startLoop(){ if(!raf) raf=requestAnimationFrame(tick); }
  function resetScores(){ s1=s2=0; if($sp1)$sp1.textContent='0'; if($sp2)$sp2.textContent='0'; }
  function updateLabels(){
    if($lp1)$lp1.textContent='PLAYER 1';
    if($lp2)$lp2.textContent= mode==='bot'?'BOT · '+diff.toUpperCase():'PLAYER 2';
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 9 — GAME OBJECTS
  ═══════════════════════════════════════════════════════════════ */

  function buildObjects(){
    var mx=tX+tW*0.5;
    p1={x:mx,y:zoneBot.yMax-padR*0.5,vx:0,vy:0,prevX:mx,prevY:zoneBot.yMax-padR*0.5};
    p2={x:mx,y:zoneTop.yMin+padR*0.5,vx:0,vy:0,prevX:mx,prevY:zoneTop.yMin+padR*0.5};
    ball=null; botTargetX=mx;
  }

  function launchBall(dir){
    var a=(Math.random()*30-15)*Math.PI/180;
    /* dir: -1 = going toward P2 (upward on screen, vy < 0)
            +1 = going toward P1 (downward on screen, vy > 0) */
    ball={
      x:W*0.5,
      y: dir < 0 ? (netY + tH*0.18) : (netY - tH*0.18),   // start on correct half
      vx:ballBase*Math.sin(a),
      vy:dir*ballBase*Math.cos(a),
      spd:ballBase,
      /* ── Z-AXIS (height above table) ────────────────────── */
      z:  0,          // on the table surface
      vz: vzLaunch,   // initial upward impulse — creates the natural arc
      /* ── SPIN PROPERTIES ─────────────────────────────────── */
      spinX:0,
      spinY:0,
      /* ── SMASH FLAG ──────────────────────────────────────── */
      isSmash:false,
      trail:[]
    };
  }

  function scheduleLaunch(dir){
    var d=dir;
    setTimeout(function(){
      if(gameState!=='serving') return;
      launchBall(d); gameState='playing'; botReactMs=0; calcBotTarget();
    },900);
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 10 — MAIN LOOP (requestAnimationFrame + delta time)
  ═══════════════════════════════════════════════════════════════ */

  function tick(ts){
    if(gameState!=='playing'&&gameState!=='serving'){raf=null;return;}
    var dt=lastTs?Math.min(ts-lastTs,34):16;
    lastTs=ts;

    movePaddles(dt);

    if(gameState==='playing'&&ball){
      /* ── PHYSICS UPDATE: all handled inside moveBall ───────── */
      moveBall(dt);

      /* 5. Timers */
      if(flash>0)      flash      -=dt;
      if(smashFlash>0) smashFlash -=dt;
      if(shakeTimer>0){
        shakeTimer-=dt;
        var mag=(shakeTimer/SHAKE_DUR)*SHAKE_MAG;
        shakeX=(Math.random()*2-1)*mag;
        shakeY=(Math.random()*2-1)*mag;
      } else { shakeX=0; shakeY=0; }
    }

    draw(dt);
    raf=requestAnimationFrame(tick);
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 11 — PADDLE MOVEMENT (full 2D, smooth lerp, zone-clamped)
  ═══════════════════════════════════════════════════════════════ */

  function movePaddles(dt){
    movePaddle(p1,ptr.p1,zoneBot,dt);
    if(mode==='bot') moveBotPaddle(dt);
    else             movePaddle(p2,ptr.p2,zoneTop,dt);
  }

  function movePaddle(pad,pt,zone,dt){
    pad.prevX=pad.x; pad.prevY=pad.y;
    if(pt.x!==null&&pt.y!==null){
      var f=1-Math.pow(1-PAD_LERP,dt/16);
      var tx=clamp(pt.x,tX+padR,tX+tW-padR);
      var ty=clamp(pt.y,zone.yMin,zone.yMax);
      pad.x+=(tx-pad.x)*f;
      pad.y+=(ty-pad.y)*f;
    }
    pad.x=clamp(pad.x,tX+padR,tX+tW-padR);
    pad.y=clamp(pad.y,zone.yMin,zone.yMax);
    /* Velocity tracked here — critical for spin + smash calculations */
    var dT=Math.max(dt,1);
    pad.vx=(pad.x-pad.prevX)/dT;
    pad.vy=(pad.y-pad.prevY)/dT;
  }

  function moveBotPaddle(dt){
    var cfg=BOT[diff];
    p2.prevX=p2.x; p2.prevY=p2.y;
    botReactMs-=dt;
    if(botReactMs<=0){ botReactMs=cfg.react+Math.random()*cfg.react*0.5; calcBotTarget(); }
    var spd=cfg.speedF*H;
    var tx=clamp(botTargetX,tX+padR,tX+tW-padR), ty=zoneTop.yMin+padR*0.6;
    var dx=tx-p2.x,dy=ty-p2.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d>0.5){ var mv=Math.min(d,spd*dt); p2.x+=(dx/d)*mv; p2.y+=(dy/d)*mv; }
    p2.x=clamp(p2.x,tX+padR,tX+tW-padR);
    p2.y=clamp(p2.y,zoneTop.yMin,zoneTop.yMax);
    p2.vx=(p2.x-p2.prevX)/Math.max(dt,1);
    p2.vy=(p2.y-p2.prevY)/Math.max(dt,1);
  }

  function calcBotTarget(){
    var cfg=BOT[diff];
    if(!ball||ball.vy>0){botTargetX=W*0.5+(Math.random()-0.5)*tW*0.25;return;}
    botTargetX=cfg.predict?predictBallX():ball.x;
    botTargetX+=(Math.random()*2-1)*cfg.errF*tW;
  }
  function predictBallX(){
    if(!ball) return W*0.5;
    var bx=ball.x,by=ball.y,bvx=ball.vx,bvy=ball.vy;
    for(var i=0;i<700;i++){
      bx+=bvx; by+=bvy;
      /* No side wall bounce — just keep within bounds for prediction */
      bx=clamp(bx,tX+ballR,tX+tW-ballR);
      if(bvy<0&&by<=p2.y) break;
    }
    return bx;
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 12 — BALL PHYSICS (sub-stepped, delta-time)
  ═══════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════
     SECTION 12 — BALL PHYSICS  (ARC EDITION)

     Coordinate system:
       ball.x / ball.y  →  2D position on screen / table plane
       ball.z           →  height above table (0 = table surface, + = up)
       ball.vz          →  vertical (z-axis) velocity (+ = rising)

     Arc lifecycle:
       1. Paddle hit sets vz = vzLaunch (upward impulse)
       2. Gravity pulls vz down each frame
       3. ball.z drops to 0  → table bounce (energy loss, vz reverses)
       4. Net only blocks if ball.z ≤ netZHeight when crossing net zone
       5. Side walls award point instead of bouncing
  ═══════════════════════════════════════════════════════════════ */

  function moveBall(dt){
    if(!ball) return;
    ball.trail.push({x:ball.x, y:ball.y - ball.z*Z_PERSP});
    if(ball.trail.length>16) ball.trail.shift();

    /* ── Z-axis: apply gravity ─────────────────────────────── */
    ball.vz -= gravityZ * dt;
    ball.z  += ball.vz * dt;

    /* ── Table surface bounce ─────────────────────────────── */
    if(ball.z <= 0){
      ball.z = 0;
      if(ball.vz < -0.005){
        ball.vz = -ball.vz * TABLE_BOUNCE_Z;
        /* rolling friction on table surface: reduce xy speed */
        var frFactor = Math.max(0, 1 - F_TABLE_FRIC * dt);
        ball.vx *= frFactor;
        ball.vy *= frFactor;
        sfx('wall');
      } else {
        ball.vz = 0;  // micro-bounce; just rest on table
      }
    }

    /* ── Spin influence on trajectory ──────────────────────── */
    var spinScale = dt/16;
    ball.vx += ball.spinX * SPIN_APPLY * spinScale;
    ball.vy += ball.spinY * SPIN_APPLY * spinScale;
    ball.spinX *= Math.pow(SPIN_DECAY, spinScale);
    ball.spinY *= Math.pow(SPIN_DECAY, spinScale);

    /* ── Horizontal friction ───────────────────────────────── */
    var fricScale = Math.pow(FRICTION, dt/16);
    ball.vx *= fricScale;
    ball.vy *= fricScale;

    /* ── Minimum horizontal speed clamp (prevent complete stall) ── */
    var hSpd = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
    if(hSpd > 0.001 && hSpd < ballBase * 0.25){
      var scMin = (ballBase * 0.25) / hSpd;
      ball.vx *= scMin;
      ball.vy *= scMin;
    }

    /* ── Maximum speed clamp ───────────────────────────────── */
    var capSpd = ball.isSmash ? ballMax * 1.35 : ballMax;
    if(hSpd > capSpd){
      ball.vx *= capSpd / hSpd;
      ball.vy *= capSpd / hSpd;
    }

    /* ── Sub-stepped XY movement + collision ───────────────── */
    var steps = clamp(Math.ceil(hSpd * dt / ballR), 1, 24);
    var sdx = ball.vx * dt / steps;
    var sdy = ball.vy * dt / steps;

    for(var s=0; s<steps; s++){
      ball.x += sdx;
      ball.y += sdy;

      /* ── Side walls → award point (no bounce) ───────────── */
      if(ball.x - ballR < tX){
        /* ball exited left — point to whoever it was heading toward */
        doScore(ball.vy < 0 ? 2 : 1);
        return;
      }
      if(ball.x + ballR > tX + tW){
        doScore(ball.vy < 0 ? 2 : 1);
        return;
      }

      /* ── NET LOGIC (arc-aware) ──────────────────────────── */
      /*
         The net occupies the horizontal band [netY .. netY+netH] on screen.
         It should only block the ball if ball.z ≤ netZHeight
         (i.e. the ball is physically low enough to hit the net).
         A ball arcing ABOVE the net passes freely.
      */
      var inNetBand = (ball.y + ballR >= netY) && (ball.y - ballR <= netY + netH);
      if(inNetBand && ball.x >= tX && ball.x <= tX + tW){
        if(ball.z <= netZHeight){
          /* Ball is too low — clips the net */
          /* Deflect downward and lose speed; do NOT reverse vy */
          ball.vz = -Math.abs(ball.vz) * 0.2;   // drop it down
          ball.z  = 0;
          ball.vx *= 0.45;
          ball.vy *= 0.30;
          sdy = ball.vy * dt / steps;
          sdx = ball.vx * dt / steps;
          ball.isSmash = false;
          sfx('wall');
        }
        /* If ball.z > netZHeight → arc clears net, do nothing → passes freely */
      }

      /* ── P1 paddle (bottom — ball moving downward vy > 0) ── */
      if(ball.vy > 0 && circleHit(ball,p1)){
        resolvePush(ball,p1);
        applyBounce(ball, p1, -1);    // dir=-1 → hit upward toward P2
        sdx = ball.vx*dt/steps;
        sdy = ball.vy*dt/steps;
        if(mode==='bot'){ botReactMs=0; calcBotTarget(); }
        break;
      }

      /* ── P2 paddle (top — ball moving upward vy < 0) ──────── */
      if(ball.vy < 0 && circleHit(ball,p2)){
        resolvePush(ball,p2);
        applyBounce(ball, p2, 1);     // dir=+1 → hit downward toward P1
        sdx = ball.vx*dt/steps;
        sdy = ball.vy*dt/steps;
        break;
      }

      /* ── Scoring: ball exits top/bottom of table ─────────── */
      if(ball.y - ballR < tY)      { doScore(1); return; }
      if(ball.y + ballR > tY + tH) { doScore(2); return; }
    }
  }

  /* ── Collision helpers ──────────────────────────────────────── */
  function circleHit(b,pad){
    var dx=b.x-pad.x,dy=b.y-pad.y;
    return dx*dx+dy*dy<(ballR+padR-1)*(ballR+padR-1);
  }
  function resolvePush(b,pad){
    var dx=b.x-pad.x,dy=b.y-pad.y,d=Math.sqrt(dx*dx+dy*dy)||0.001;
    var ov=(ballR+padR+1)-d; b.x+=(dx/d)*ov; b.y+=(dy/d)*ov;
  }

  /* ═══════════════════════════════════════════════════════════════
     applyBounce — CORE: SPIN PHYSICS + SMASH SYSTEM

     Parameters:
       b   = ball
       pad = paddle (has .vx .vy = velocity in px/ms at impact)
       dir = -1 (P1 → send upward) | +1 (P2 → send downward)
  ═══════════════════════════════════════════════════════════════ */
  function applyBounce(b,pad,dir){

    /* ── 1. Reflection angle from horizontal hit offset ──────── */
    var relX  = clamp((b.x-pad.x)/padR,-0.92,0.92);
    var angle = relX*65*Math.PI/180;

    /* ── 2. New speed — driven entirely by how hard the paddle swings ──
       padVMag = 0       → gentle tap  → speed drops toward ballBase
       padVMag = medium  → normal hit  → moderate speed
       padVMag = high    → hard swing  → fast ball up to ballMax
       The formula: base  +  (paddleSpeed × boost multiplier)
       A slow/still paddle actually REDUCES ball speed (soft return). */
    var padVMag = Math.sqrt(pad.vx*pad.vx + pad.vy*pad.vy);

    /* Convert paddle speed (px/ms) to a ball speed.
       Multiplier 3.8 maps a moderate swipe to a comfortable rally pace. */
    var hitSpd  = ballBase + padVMag * 3.8;
    /* Blend: 30 % of the incoming ball speed is carried through so the
       ball never feels completely dead on a soft return. */
    var newSpd  = clamp(hitSpd * 0.70 + b.spd * 0.30, ballBase, ballMax);
    b.spd = newSpd;

    /* ── 3. Apply directional velocity ─────────────────────────  */
    b.vx=newSpd*Math.sin(angle);
    b.vy=dir*newSpd*Math.cos(angle);

    /* Ensure ball always moves horizontally with minimum speed */
    var minHSpd = newSpd * 0.10;   // small — don't fight a soft return
    if(Math.abs(b.vx) < minHSpd) b.vx = (b.vx >= 0 ? 1 : -1) * minHSpd;

    /* ── 4. ARC PHYSICS: Set upward Z impulse ────────────────────
       Scale vz with ball speed so fast hits arc higher and steeper.
       Topspin (spinY in same dir as hit) reduces arc height.
       Backspin increases arc height (floaty lob).
    ════════════════════════════════════════════════════════════ */
    var speedRatio = newSpd / ballBase;
    var spinAdjust = 1.0 - clamp(b.spinY * dir * 0.6, -0.35, 0.35);
    b.vz = vzLaunch * speedRatio * spinAdjust;
    b.z  = Math.max(b.z, 2);   // lift ball off table so arc starts clean

    /* ══════════════════════════════════════════════════════════
       SPIN PHYSICS
       Paddle velocity at contact → spin added to ball
    ══════════════════════════════════════════════════════════ */
    b.spinX = pad.vx * SPIN_FACTOR;
    b.spinY = pad.vy * SPIN_FACTOR;
    b.vx += b.spinX * 0.08;

    /* ══════════════════════════════════════════════════════════
       SMASH SYSTEM
       Conditions: fast forward paddle hit near paddle centre
    ══════════════════════════════════════════════════════════ */
    var isForward = (dir===-1) ? (pad.vy<-0.001) : (pad.vy>0.001);
    var isCentre  = Math.abs(b.y-pad.y) < padR*0.55;
    var isSmash   = padVMag > SMASH_VEL_THRESH && isForward && isCentre;

    if(isSmash){
      b.vx *= SMASH_BOOST;
      b.vy *= SMASH_BOOST;
      b.vz *= 1.4;           // smash: flatter arc (less vz relative to speed)
      b.spd = clamp(b.spd*SMASH_BOOST,ballBase,ballMax*1.3);
      b.isSmash = true;
      smashFlash  = SMASH_FLASH_DUR;
      smashFlashX = b.x;
      smashFlashY = b.y;
      shakeTimer  = SHAKE_DUR;
      sfx('smash');
    } else {
      b.isSmash = false;
      sfx('paddle');
    }

    /* ── Hard speed cap ──────────────────────────────────────── */
    var capSpd = ballMax*(b.isSmash?1.35:1.0);
    var curMag = Math.sqrt(b.vx*b.vx+b.vy*b.vy);
    if(curMag>capSpd){ var sc=capSpd/curMag; b.vx*=sc; b.vy*=sc; }
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 13 — SCORING
  ═══════════════════════════════════════════════════════════════ */

  function doScore(who){
    if(who===1){s1++;if($sp1){ $sp1.textContent=s1; ppScorePop($sp1); } flashSide=1;}
    else        {s2++;if($sp2){ $sp2.textContent=s2; ppScorePop($sp2); } flashSide=2;}
    flash=400; smashFlash=0; shakeTimer=0; shakeX=0; shakeY=0;
    sfx('score');
    if(checkWin()) return;
    ball=null; gameState='serving';
    // Update serve indicator
    ppUpdateServeIndicator(who===1?1:-1);
    scheduleLaunch(who===1?1:-1);
  }

  function ppScorePop(el) {
    if (!el) return;
    el.classList.remove('pp-score-pop');
    // Force reflow to restart animation
    void el.offsetWidth;
    el.classList.add('pp-score-pop');
    setTimeout(function() { el.classList.remove('pp-score-pop'); }, 500);
  }

  function ppUpdateServeIndicator(dirY) {
    // dirY: -1 = top player serves, 1 = bottom player serves
    var si = document.getElementById('pp-serve-indicator');
    if (!si) return;
    si.style.display = 'block';
    if (dirY === -1) {
      si.textContent = '▲ TOP SERVES';
      si.className = 'pp-serve-ind pp-serve-top';
    } else {
      si.textContent = '▼ BOTTOM SERVES';
      si.className = 'pp-serve-ind pp-serve-bot';
    }
    setTimeout(function() { if (si) si.style.display = 'none'; }, 1800);
  }

  function checkWin(){
    if((s1>=WIN||s2>=WIN)&&Math.abs(s1-s2)>=WIN_BY){
      var w=s1>s2?'PLAYER 1':(mode==='bot'?'BOT':'PLAYER 2');
      gameState='over';
      setTimeout(function(){
        if($resTitle)$resTitle.textContent=w+' WINS!';
        if($resSub)  $resSub.textContent  =s1+' – '+s2;
        showPanel('result'); stopLoop();
      },600);
      return true;
    }
    return false;
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 14 — RENDERING
     Camera shake applied with ctx.translate(shakeX,shakeY)
  ═══════════════════════════════════════════════════════════════ */

  var PAL={
    bg:'#09091a', p1:'#ff4d4d', p2:'#00cfff', netBar:'#0d0e1e',
    netLine:'rgba(255,255,255,0.65)', tableBdr:'#0d0d0d',
    tLineW:'rgba(255,255,255,0.33)', tLineDot:'rgba(255,255,255,0.09)',
    shadow:'rgba(0,0,0,0.38)'
  };

  function draw(dt){
    ctx.save();
    if(shakeTimer>0) ctx.translate(shakeX,shakeY);
    ctx.clearRect(-SHAKE_MAG*2,-SHAKE_MAG*2,W+SHAKE_MAG*4,H+SHAKE_MAG*4);
    drawBg(); drawTable(); drawNet();
    if(ball){drawTrail();drawBall();}
    drawRacket(p1,PAL.p1,true);
    drawRacket(p2,PAL.p2,false);
    if(smashFlash>0) drawSmashFlash();
    drawScoreOnCanvas();
    if(gameState==='serving') drawServeHint();
    if(ptr.p1.x!==null) drawCursor(ptr.p1,PAL.p1);
    if(mode!=='bot'&&ptr.p2.x!==null) drawCursor(ptr.p2,PAL.p2);
    ctx.restore();
  }

  /* ── Background ─────────────────────────────────────────────── */
  function drawBg(){
    ctx.fillStyle=PAL.bg; ctx.fillRect(0,0,W,H);
    if(flash>0){
      var a=Math.min(flash/400,1)*0.22;
      var rgb=flashSide===1?'255,77,77':'0,207,255';
      ctx.fillStyle='rgba('+rgb+','+a+')'; ctx.fillRect(0,0,W,H);
    }
  }

  /* ── Table ──────────────────────────────────────────────────── */
  function drawTable(){
    ctx.shadowColor='rgba(0,0,0,0.65)'; ctx.shadowBlur=26; ctx.shadowOffsetY=10;
    var g=ctx.createLinearGradient(tX,tY,tX,tY+tH);
    g.addColorStop(0,'#1b5e25'); g.addColorStop(0.49,'#2e7a3c');
    g.addColorStop(0.51,'#256830'); g.addColorStop(1,'#1b5e25');
    ctx.fillStyle=g; ctx.beginPath(); rrect(tX,tY,tW,tH,8); ctx.fill();
    ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    ctx.strokeStyle=PAL.tableBdr; ctx.lineWidth=Math.max(3,W*0.013);
    ctx.beginPath(); rrect(tX,tY,tW,tH,8); ctx.stroke();
    // Centre vertical line
    ctx.strokeStyle=PAL.tLineW; ctx.lineWidth=Math.max(2,W*0.005);
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(W*0.5,tY+10); ctx.lineTo(W*0.5,tY+tH-10); ctx.stroke();
    // Service box dotted lines
    ctx.strokeStyle=PAL.tLineDot; ctx.lineWidth=1; ctx.setLineDash([4,7]);
    [0.25,0.75].forEach(function(f){
      ctx.beginPath(); ctx.moveTo(tX+8,tY+tH*f); ctx.lineTo(tX+tW-8,tY+tH*f); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  /* ── Net ────────────────────────────────────────────────────── */
  function drawNet(){
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(tX,netY-3,tW,netH+6);
    ctx.fillStyle=PAL.netBar; ctx.fillRect(tX,netY,tW,netH);
    var sh=Math.max(2,Math.floor(netH*0.18));
    ctx.fillStyle=PAL.netLine; ctx.fillRect(tX,netY+Math.floor(netH*0.35),tW,sh);
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(tX,netY,tW,2);
    var pw=Math.max(5,W*0.017),ph=netH*2.8,py=netY-netH*0.9;
    ctx.fillStyle='#999';
    ctx.fillRect(tX-pw*0.5,py,pw,ph); ctx.fillRect(tX+tW-pw*0.5,py,pw,ph);
    ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.fillRect(tX-pw*0.5+1,py+2,2,ph-4); ctx.fillRect(tX+tW-pw*0.5+1,py+2,2,ph-4);
  }

  /* ── Ball trail ─────────────────────────────────────────────── */
  function drawTrail(){
    if(!ball||!ball.trail.length) return;
    var n=ball.trail.length;
    var trailRGB=ball.isSmash?'255,160,40':'200,225,255';
    for(var i=0;i<n;i++){
      var pt=ball.trail[i],t=(i+1)/n;
      /* trail points already stored with z-offset applied */
      ctx.beginPath(); ctx.arc(pt.x,pt.y,ballR*t*(ball.isSmash?0.85:0.62),0,Math.PI*2);
      ctx.fillStyle='rgba('+trailRGB+','+(t*(ball.isSmash?0.45:0.28))+')'; ctx.fill();
    }
  }

  /* ── Ball ───────────────────────────────────────────────────── */
  function drawBall(){
    if(!ball) return;
    var bx = ball.x;
    var by = ball.y - ball.z * Z_PERSP;   // z lifts ball visually upward

    /* Shadow on the table surface (stays at ball.y, no z offset) */
    var shadowAlpha = clamp(0.35 - ball.z * 0.006, 0.06, 0.35);
    var shadowScale = clamp(1 + ball.z * 0.012, 1, 2.0);
    ctx.beginPath();
    ctx.ellipse(ball.x+2, ball.y+3, ballR*0.95*shadowScale, ballR*0.50, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,'+shadowAlpha+')';
    ctx.fill();

    var gI=ball.isSmash?'rgba(255,120,20,0.38)':'rgba(210,235,255,0.26)';
    var gO=ball.isSmash?'rgba(255,80,0,0.12)'  :'rgba(180,210,255,0.10)';
    var glow=ctx.createRadialGradient(bx,by,0,bx,by,ballR*4.5);
    glow.addColorStop(0,gI); glow.addColorStop(0.5,gO); glow.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(bx,by,ballR*4.5,0,Math.PI*2); ctx.fillStyle=glow; ctx.fill();

    var bg=ctx.createRadialGradient(bx-ballR*0.32,by-ballR*0.32,0,bx,by,ballR);
    if(ball.isSmash){
      bg.addColorStop(0,'#fff8f0'); bg.addColorStop(0.55,'#ffd080'); bg.addColorStop(1,'#e06020');
    } else {
      bg.addColorStop(0,'#ffffff'); bg.addColorStop(0.55,'#ddeeff'); bg.addColorStop(1,'#a8c8e8');
    }
    ctx.beginPath(); ctx.arc(bx,by,ballR,0,Math.PI*2); ctx.fillStyle=bg; ctx.fill();
    ctx.strokeStyle='rgba(80,120,180,0.35)'; ctx.lineWidth=Math.max(1,ballR*0.17);
    ctx.beginPath(); ctx.arc(bx,by,ballR*0.68,-0.25,Math.PI+0.25); ctx.stroke();

    /* ── SPIN VISUALISER ─────────────────────────────────────── */
    var spinMag=Math.sqrt(ball.spinX*ball.spinX+ball.spinY*ball.spinY);
    if(spinMag>0.002){
      var spinAngle=Math.atan2(ball.spinY,ball.spinX);
      ctx.save();
      ctx.globalAlpha=Math.min(spinMag*18,0.55);
      ctx.strokeStyle=ball.spinY<0?'#00ffaa':'#ff8800';
      ctx.lineWidth=Math.max(1.5,ballR*0.22);
      ctx.beginPath(); ctx.arc(bx,by,ballR*1.45,spinAngle-0.9,spinAngle+0.9); ctx.stroke();
      ctx.restore();
    }
  }

  /* ── SMASH IMPACT FLASH (expanding ring burst) ───────────────── */
  function drawSmashFlash(){
    var t=smashFlash/SMASH_FLASH_DUR; // 1 → 0
    var r=ballR*(3+5*(1-t));
    var g=ctx.createRadialGradient(smashFlashX,smashFlashY,0,smashFlashX,smashFlashY,r);
    g.addColorStop(0,'rgba(255,200,80,'+(t*0.85)+')');
    g.addColorStop(0.4,'rgba(255,100,20,'+(t*0.45)+')');
    g.addColorStop(1,'rgba(255,60,0,0)');
    ctx.beginPath(); ctx.arc(smashFlashX,smashFlashY,r,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    // Expanding ring
    ctx.save(); ctx.globalAlpha=t*0.7;
    ctx.strokeStyle='rgba(255,200,80,0.9)'; ctx.lineWidth=Math.max(2,ballR*0.3);
    ctx.beginPath(); ctx.arc(smashFlashX,smashFlashY,ballR*(2.5+(1-t)*4),0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  /* ── Racket ─────────────────────────────────────────────────── */
  function drawRacket(pad,col,isP1){
    if(!pad) return;
    var rx=pad.x,ry=pad.y,r=padR;
    var halo=ctx.createRadialGradient(rx,ry,0,rx,ry,r*1.9);
    halo.addColorStop(0,hexA(col,0.32)); halo.addColorStop(0.55,hexA(col,0.12)); halo.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(rx,ry,r*1.9,0,Math.PI*2); ctx.fillStyle=halo; ctx.fill();
    // Handle
    var hLen=r*1.25,hy1=isP1?ry+r*0.70:ry-r*0.70,hy2=isP1?hy1+hLen:hy1-hLen;
    ctx.lineCap='round'; ctx.lineWidth=Math.max(7,r*0.30); ctx.strokeStyle='#6b3a1f';
    ctx.beginPath(); ctx.moveTo(rx,hy1); ctx.lineTo(rx,hy2); ctx.stroke();
    ctx.lineWidth=Math.max(2,r*0.10); ctx.strokeStyle='#9b6040';
    var ws=hLen/4.5;
    for(var wi=1;wi<=3;wi++){
      var wy=isP1?hy1+ws*wi:hy1-ws*wi;
      ctx.beginPath(); ctx.moveTo(rx-r*0.20,wy); ctx.lineTo(rx+r*0.20,wy); ctx.stroke();
    }
    ctx.lineCap='butt';
    // Rim
    ctx.beginPath(); ctx.arc(rx,ry,r+2.5,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.60)'; ctx.fill();
    // Face
    var sf=ctx.createRadialGradient(rx-r*0.28,ry-r*0.28,0,rx,ry,r);
    sf.addColorStop(0,shiftHex(col,35)); sf.addColorStop(0.6,col); sf.addColorStop(1,shiftHex(col,-40));
    ctx.beginPath(); ctx.arc(rx,ry,r,0,Math.PI*2); ctx.fillStyle=sf; ctx.fill();
    // Grid texture
    ctx.save(); ctx.beginPath(); ctx.arc(rx,ry,r,0,Math.PI*2); ctx.clip();
    ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
    var step=Math.max(5,r*0.20);
    for(var xi=-r;xi<=r;xi+=step){ctx.beginPath();ctx.moveTo(rx+xi,ry-r);ctx.lineTo(rx+xi,ry+r);ctx.stroke();}
    for(var yi=-r;yi<=r;yi+=step){ctx.beginPath();ctx.moveTo(rx-r,ry+yi);ctx.lineTo(rx+r,ry+yi);ctx.stroke();}
    ctx.restore();
    // Edge band
    ctx.beginPath(); ctx.arc(rx,ry,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=Math.max(2,r*0.08); ctx.stroke();
    // Centre dot
    ctx.beginPath(); ctx.arc(rx,ry,r*0.14,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fill();
  }

  function drawScoreOnCanvas(){
    var fs=Math.max(11,Math.round(W*0.055));
    ctx.font='700 '+fs+'px Orbitron,monospace';
    ctx.textBaseline='top'; ctx.textAlign='left';
    ctx.fillStyle=PAL.p2; ctx.fillText(s2,tX+10,tY+8);
    ctx.textBaseline='bottom';
    ctx.fillStyle=PAL.p1; ctx.fillText(s1,tX+10,tY+tH-8);
    ctx.textBaseline='top';
  }
  function drawServeHint(){
    ctx.save(); ctx.globalAlpha=0.55;
    ctx.font='700 '+Math.round(H*0.036)+'px Orbitron,monospace';
    ctx.fillStyle='#00e5ff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('GET READY…',W*0.5,H*0.5); ctx.restore();
  }
  function drawCursor(pt,col){
    ctx.save(); ctx.globalAlpha=0.42; ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(pt.x,pt.y,10,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pt.x,pt.y-17); ctx.lineTo(pt.x,pt.y+17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pt.x-17,pt.y); ctx.lineTo(pt.x+17,pt.y); ctx.stroke();
    ctx.restore();
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 15 — SOUND EFFECTS
     Extends original sfx() with new 'smash' type.
  ═══════════════════════════════════════════════════════════════ */

  var _ac=null;
  function getAC(){
    if(!_ac)try{_ac=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}
    if(_ac&&_ac.state==='suspended')try{_ac.resume();}catch(e){}
    return _ac;
  }
  function sfx(type){
    var ac=getAC(); if(!ac) return;
    try{
      var o=ac.createOscillator(),g=ac.createGain();
      o.connect(g); g.connect(ac.destination);
      var t=ac.currentTime;
      if(type==='paddle'){
        o.type='sine';
        o.frequency.setValueAtTime(510,t); o.frequency.exponentialRampToValueAtTime(275,t+0.08);
        g.gain.setValueAtTime(0.20,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
        o.start(t); o.stop(t+0.13);
      } else if(type==='wall'){
        o.type='sine';
        o.frequency.setValueAtTime(255,t); o.frequency.exponentialRampToValueAtTime(125,t+0.06);
        g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09);
        o.start(t); o.stop(t+0.10);
      } else if(type==='score'){
        o.type='square';
        o.frequency.setValueAtTime(220,t); o.frequency.setValueAtTime(330,t+0.11); o.frequency.setValueAtTime(440,t+0.22);
        g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.48);
        o.start(t); o.stop(t+0.50);
      } else if(type==='smash'){
        /* ── SMASH SOUND: two-oscillator punch ─────────────── */
        // Transient click (high→low squeal)
        var o2=ac.createOscillator(),g2=ac.createGain();
        o2.connect(g2); g2.connect(ac.destination);
        o2.type='square';
        o2.frequency.setValueAtTime(900,t); o2.frequency.exponentialRampToValueAtTime(120,t+0.06);
        g2.gain.setValueAtTime(0.28,t); g2.gain.exponentialRampToValueAtTime(0.001,t+0.07);
        o2.start(t); o2.stop(t+0.08);
        // Body thud (bass drop)
        o.type='sine';
        o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(55,t+0.18);
        g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.20);
        o.start(t); o.stop(t+0.22);
      }
    }catch(e){}
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION 16 — UTILITIES
  ═══════════════════════════════════════════════════════════════ */

  function rrect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }
  function shiftHex(hex,amt){
    var c=hex.replace('#',''); if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    return '#'+h2(clamp(parseInt(c.substr(0,2),16)+amt,0,255))+
               h2(clamp(parseInt(c.substr(2,2),16)+amt,0,255))+
               h2(clamp(parseInt(c.substr(4,2),16)+amt,0,255));
  }
  function h2(v){return('0'+Math.round(v).toString(16)).slice(-2);}
  function hexA(hex,a){
    var c=hex.replace('#',''); if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    return 'rgba('+parseInt(c.substr(0,2),16)+','+parseInt(c.substr(2,2),16)+','+parseInt(c.substr(4,2),16)+','+a+')';
  }
  function clamp(v,lo,hi){return v<lo?lo:(v>hi?hi:v);}

  /* ═══════════════════════════════════════════════════════════════
     SECTION 17 — EXPORTS  (same names as original)
  ═══════════════════════════════════════════════════════════════ */
  window.ppInit = ppInit;
  window.ppStop = function(){ stopLoop(); gameState='idle'; resetPtrs(); };

})();
