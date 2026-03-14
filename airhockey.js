// ═══════════════════════════════════════════════════════════════
// AIR HOCKEY — Neon Ice Edition  (airhockey.js)
// ─────────────────────────────────────────────────────────────
// BUGS FIXED (this revision):
//   1. showAH() never defined → ReferenceError on "← Menu" click
//   2. _hitThisFrame reset once before sub-step loop → puck tunnels
//      through paddle at high speed (must reset per sub-step)
//   3. dot>=0 early-return → puck glues to stationary paddle (dot=0)
//   4. stuck-rescue timer check runs AFTER ahEnforceMinSpeed, so
//      curSpd is always > threshold → timer always resets → rescue
//      never fires (check must come BEFORE enforceMinSpeed)
//   5. Bot pvx/pvy not zeroed during goal-freeze → first post-serve
//      collision uses stale velocity
//   6. ahPredictPuck only bounces left/right, ignores top/bottom →
//      bot intercept is wrong for any banked shot
//   7. No goalpost corner colliders → puck clips through post tips
//   8. ahResize() only resizes canvas, not puck/paddle geometry →
//      mid-game resize breaks all physics
//   9. startAHGame() never calls ahStopLoop() → "Play Again" spawns
//      a second RAF loop alongside the first
// ═══════════════════════════════════════════════════════════════

// ── Local Audio Engine (fallback when SoundManager is absent) ──
var ahAudio = (function () {
  var ctx = null;
  function gc() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function tone(freq, type, vol, dur, delay, freqEnd) {
    try {
      var c = gc(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type || 'sine';
      var t0 = c.currentTime + (delay || 0);
      o.frequency.setValueAtTime(freq, t0);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.15, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.12));
      o.start(t0); o.stop(t0 + (dur || 0.12) + 0.01);
    } catch (e) {}
  }
  function noise(vol, dur, delay, cutoff) {
    try {
      var c = gc();
      var bufSize = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, bufSize, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource(); src.buffer = buf;
      var gn = c.createGain();
      var flt = c.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = cutoff || 1200;
      src.connect(flt); flt.connect(gn); gn.connect(c.destination);
      var t0 = c.currentTime + (delay || 0);
      gn.gain.setValueAtTime(vol, t0);
      gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.start(t0); src.stop(t0 + dur + 0.01);
    } catch (e) {}
  }
  return {
    paddleHit: function (spd) {
      var vol = Math.min(0.25, 0.08 + (spd || 0) * 0.006);
      tone(180 + (spd || 0) * 3, 'square', vol * 0.6, 0.06);
      noise(vol, 0.05, 0, 1200);
    },
    wallBounce: function () { tone(320, 'square', 0.07, 0.05); noise(0.05, 0.04, 0, 800); },
    goal: function (isP1) {
      var base = isP1 ? 523 : 392;
      [0, 0.12, 0.24, 0.38].forEach(function (d, i) {
        tone(base * [1, 1.25, 1.5, 2][i], 'sine', 0.2, 0.2, d);
      });
    },
    win:  function () { [523,659,784,1047,1319].forEach(function(f,i){ tone(f,'sine',0.18,0.22,i*0.1); }); },
    lose: function () { tone(440,'sawtooth',0.13,0.2); tone(330,'sawtooth',0.1,0.25,0.18); tone(220,'sawtooth',0.08,0.3,0.36); },
    puckStart: function () { tone(800, 'sine', 0.12, 0.15, 0, 400); },
    click: function () { tone(600, 'sine', 0.07, 0.06); }
  };
})();

// ── Safe sound wrapper — prefers SoundManager, falls back to ahAudio ──
var ahSnd = {
  paddleHit:  function(s)  { try { if(typeof SoundManager!=='undefined'&&SoundManager.ahPaddleHit){SoundManager.ahPaddleHit(s);return;}  }catch(e){} ahAudio.paddleHit(s); },
  wallBounce: function()   { try { if(typeof SoundManager!=='undefined'&&SoundManager.ahWallBounce){SoundManager.ahWallBounce();return;} }catch(e){} ahAudio.wallBounce(); },
  goal:       function(p1) { try { if(typeof SoundManager!=='undefined'&&SoundManager.ahGoal){SoundManager.ahGoal(p1);return;}           }catch(e){} ahAudio.goal(p1); },
  win:        function()   { try { if(typeof SoundManager!=='undefined'&&SoundManager.ahWin){SoundManager.ahWin();return;}                }catch(e){} ahAudio.win(); },
  lose:       function()   { try { if(typeof SoundManager!=='undefined'&&SoundManager.ahLose){SoundManager.ahLose();return;}              }catch(e){} ahAudio.lose(); },
  puckStart:  function()   { try { if(typeof SoundManager!=='undefined'&&SoundManager.ahPuckStart){SoundManager.ahPuckStart();return;}    }catch(e){} ahAudio.puckStart(); },
  click:      function()   { try { if(typeof SoundManager!=='undefined'&&SoundManager.click){SoundManager.click();return;}                }catch(e){} ahAudio.click(); }
};

// ── Bot difficulty configs ─────────────────────────────────────
var AH_BOT = {
  easy:   { reaction_time: 380, max_speed: 300,  error_margin: 65,  aggression: 0.25 },
  medium: { reaction_time: 160, max_speed: 520,  error_margin: 22,  aggression: 0.62 },
  hard:   { reaction_time: 40,  max_speed: 800,  error_margin: 5,   aggression: 0.92 }
};
AH_BOT.extreme = AH_BOT.hard;

// ── State ──────────────────────────────────────────────────────
var ahCanvas, ahCtx;
var ahW, ahH;
var ahRAF      = null;
var ahRunning  = false;
var ahPaused   = false;
var ahMode     = 'pvb';
var ahDiff     = 'easy';
var ahWinScore = 7;
var ahLastTime = 0;

var ahPuck = { x:0, y:0, vx:0, vy:0, r:0, vServe:null };
var ahPaddles = [
  { x:0, y:0, r:0, pvx:0, pvy:0, _hitThisFrame:false, key:{up:false,dn:false,lt:false,rt:false} },
  { x:0, y:0, r:0, pvx:0, pvy:0, _hitThisFrame:false, key:{up:false,dn:false,lt:false,rt:false} }
];

var ahAccumulator = 0;   // fixed-timestep accumulator (ms)
var AH_FIXED_DT   = 1000 / 60;  // 16.667 ms — one physics tick
var ahBotTimer    = 0;
var ahBotTarget   = { x:0, y:0 };
var ahGoalFreezeMs = 0;
var ahServeWho    = 0;
var ahTrail       = [];
var ahParticles   = [];
var ahSpeedLines  = [];
var ahRings       = [];
var ahStuckTimer  = 0;
var ahCornerTimer = 0;       // FIX: corner-escape timer
var ahPuckTargetSpeed = 0;   // FIX: constant speed target
var ahP1Score = 0, ahP2Score = 0;
var ahMatchCount  = 0;

// ── Helpers ────────────────────────────────────────────────────
function ahStopLoop() {
  ahRunning = false;
  if (ahRAF) { cancelAnimationFrame(ahRAF); ahRAF = null; }
  window.removeEventListener('resize', ahResize);
}

// FIX 8: ahResize now rescales all in-game geometry when canvas dimensions change.
// Previously it only resized the canvas element — mid-game resize left puck/paddle
// at stale pixel positions and with radii from the old canvas size.
function ahResize() {
  var field = document.getElementById('ah-canvas-field');
  if (!field || !ahCanvas) return;
  var fw = field.clientWidth  || 360;
  var fh = field.clientHeight || Math.round(fw * 1.55);
  var oldW = ahW || 0, oldH = ahH || 0;
  ahW = Math.min(fw, 420);
  ahH = Math.max(Math.round(ahW * 1.5), Math.min(fh, 660));
  ahCanvas.width  = ahW;
  ahCanvas.height = ahH;
  if (oldW > 0 && (oldW !== ahW || oldH !== ahH)) {
    var sx = ahW / oldW, sy = ahH / oldH;
    ahPuck.r        = ahW * 0.055;
    ahPaddles[0].r  = ahW * 0.09;
    ahPaddles[1].r  = ahW * 0.09;
    ahPuck.x       *= sx;  ahPuck.y       *= sy;
    ahPaddles[0].x *= sx;  ahPaddles[0].y *= sy;
    ahPaddles[1].x *= sx;  ahPaddles[1].y *= sy;
    ahBotTarget.x  *= sx;  ahBotTarget.y  *= sy;
    // Scale velocity and target speed so puck pace matches new canvas size.
    ahPuck.vx *= sx; ahPuck.vy *= sy;
    if (ahPuckTargetSpeed > 0) {
      ahPuckTargetSpeed = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy);
      if (ahPuckTargetSpeed < 0.01) ahPuckTargetSpeed = ahW * 1.6;
    }
    ahClampPaddle(ahPaddles[0], 0);
    ahClampPaddle(ahPaddles[1], 1);
  }
}

function ahGoalWidth() { return ahW * 0.42; }

function ahClampPaddle(p, idx) {
  var m = p.r, cy = ahH / 2;
  p.x = Math.max(m, Math.min(ahW - m, p.x));
  if (idx === 0) p.y = Math.max(cy + m * 0.25, Math.min(ahH - m, p.y));
  else           p.y = Math.max(m, Math.min(cy - m * 0.25, p.y));
}

// ── Init ───────────────────────────────────────────────────────
function ahInit() {
  ahCanvas = document.getElementById('ah-canvas');
  ahCtx    = ahCanvas.getContext('2d');
  ahResize();
  ahP1Score = ahP2Score = 0;
  ahPuck.r       = ahW * 0.055;
  ahPaddles[0].r = ahW * 0.09;
  ahPaddles[1].r = ahW * 0.09;
  ahTrail=[]; ahParticles=[]; ahSpeedLines=[]; ahRings=[];
  ahBotTimer=0; ahStuckTimer=0; ahCornerTimer=0; ahAccumulator=0; ahPuckTargetSpeed=0; ahGoalFreezeMs=0; ahBotPhase='defend';
  ahBotTarget.x = ahW / 2;
  ahBotTarget.y = ahH * 0.2;
  ahResetPositions(0);
  ahUpdateScoreUI();
  window.addEventListener('resize', ahResize);
}

function ahResetPositions(serveWho) {
  ahPuck.x = ahW/2; ahPuck.y = ahH/2; ahPuck.vx=0; ahPuck.vy=0;
  ahPaddles[0].x = ahW/2; ahPaddles[0].y = ahH*0.82; ahPaddles[0].pvx=0; ahPaddles[0].pvy=0;
  ahPaddles[1].x = ahW/2; ahPaddles[1].y = ahH*0.18; ahPaddles[1].pvx=0; ahPaddles[1].pvy=0;
  ahServeWho = serveWho;
  ahGoalFreezeMs = 1300;
  ahTrail=[]; ahSpeedLines=[];
  // Fixed speed every serve — only direction angle is randomised.
  var SERVE_SPEED = ahW * 1.6;
  ahPuckTargetSpeed = SERVE_SPEED;
  var dir = (serveWho === 0) ? -1 : 1;
  // Angle: mostly vertical (±20° spread) so the serve is clearly aimed at opponent.
  var spread = (Math.random() - 0.5) * 0.7;          // ±~20°
  var baseAng = dir < 0 ? -Math.PI/2 : Math.PI/2;    // straight up or down
  var ang = baseAng + spread;
  ahPuck.vServe = { vx: Math.cos(ang)*SERVE_SPEED, vy: Math.sin(ang)*SERVE_SPEED };
}

// ── Bot AI ─────────────────────────────────────────────────────
var ahBotPhase = 'defend';

// FIX 6: ahPredictPuck now correctly bounces off top/bottom walls in addition
// to left/right. Previously the bot's intercept calculation flew the puck
// into empty space past the top/bottom walls, giving totally wrong positions.
function ahPredictPuck(numSteps, dt_sub) {
  var x=ahPuck.x, y=ahPuck.y, vx=ahPuck.vx, vy=ahPuck.vy;
  var r=ahPuck.r, sec=dt_sub/1000;
  var gw=ahGoalWidth()/2, cx=ahW/2;
  for (var s=0; s<numSteps; s++) {
    x+=vx*sec; y+=vy*sec;
    if (x-r<0)   { x=r;     vx= Math.abs(vx); }
    if (x+r>ahW) { x=ahW-r; vx=-Math.abs(vx); }
    // Bounce off top/bottom walls (respecting goal openings, same as physics)
    if (y-r<0   && !(x>cx-gw && x<cx+gw)) { y=r;     vy= Math.abs(vy); }
    if (y+r>ahH && !(x>cx-gw && x<cx+gw)) { y=ahH-r; vy=-Math.abs(vy); }
    if (vy>0 && y>ahH*0.65) break; // puck clearly in player half, stop early
  }
  return { x:x, y:y };
}

function ahUpdateBot(dt) {
  if (ahMode!=='pvb') return;
  var cfg=AH_BOT[ahDiff]||AH_BOT.easy;
  ahBotTimer+=dt;
  if (ahBotTimer<cfg.reaction_time) return;
  ahBotTimer=0;

  var b=ahPaddles[1], pk=ahPuck;
  var err=(Math.random()-0.5)*cfg.error_margin*2;
  var puckInBotHalf = pk.y < ahH*0.5;
  var puckComingUp   = pk.vy < 0; // negative y = moving toward bot (top)

  // FIX: Keep bot targets well clear of walls so it never drives the puck
  // into a corner.  xMin/xMax keep the bot off the side walls; yMin/yMax
  // keep it in its own half with a safe margin from the top wall.
  var wm = b.r + 8;                 // horizontal wall margin
  var xMin = wm, xMax = ahW - wm;
  var yMin = b.r + 6, yMax = ahH * 0.5 - b.r - 6;

  if (puckInBotHalf) {
    // Bot wants to get ABOVE (lower y) the puck then drive it downward.
    var aimX = ahW/2 + err * (1 - cfg.aggression*0.6);
    var swingOffset = (b.r + pk.r) * 1.8;

    // Only enter attack if there's room to position above the puck without
    // being squeezed against the top wall — that's exactly what caused the
    // corner-trapping loop.
    var minYForAttack = yMin + swingOffset + b.r;
    if (pk.y > minYForAttack) {
      var dx_lean = (pk.x - aimX) * 0.3;
      var tx = pk.x - dx_lean + err*0.15;
      var ty = pk.y - swingOffset;
      ahBotTarget.x = Math.max(xMin, Math.min(xMax, tx));
      ahBotTarget.y = Math.max(yMin, Math.min(yMax, ty));
      var windupDx = b.x - ahBotTarget.x, windupDy = b.y - ahBotTarget.y;
      var alignedForStrike = (windupDx*windupDx + windupDy*windupDy) < (b.r*2.5)*(b.r*2.5);
      if (alignedForStrike || cfg.aggression > 0.85) {
        var strikeY = pk.y + (b.r + pk.r) * (1.6 + cfg.aggression * 0.8);
        ahBotTarget.x = Math.max(xMin, Math.min(xMax, aimX));
        ahBotTarget.y = Math.min(yMax, strikeY);
      }
    } else {
      // Puck is too close to the top wall — retreat to centre rather than
      // chasing the puck into the corner.  The puck will bounce back shortly.
      ahBotTarget.x = Math.max(xMin, Math.min(xMax, ahW/2 + err*0.2));
      ahBotTarget.y = Math.max(yMin, Math.min(yMax, ahH * 0.22));
    }
  } else if (puckComingUp) {
    var lookSteps = Math.max(8, Math.round(20*cfg.aggression));
    var pred = ahPredictPuck(lookSteps, 14);
    ahBotTarget.x = Math.max(xMin, Math.min(xMax, pred.x + err));
    ahBotTarget.y = Math.max(yMin, Math.min(yMax, pred.y + err*0.2));
  } else {
    var defX = pk.x*0.45 + ahW/2*0.55 + err*0.15;
    var defY = cfg.aggression>0.7 ? ahH*0.13 : cfg.aggression>0.4 ? ahH*0.11 : ahH*0.09;
    ahBotTarget.x = Math.max(xMin, Math.min(xMax, defX));
    ahBotTarget.y = Math.max(yMin, Math.min(yMax, defY));
  }
}

function ahMoveBot(dt) {
  if (ahMode!=='pvb') return;
  var cfg=AH_BOT[ahDiff]||AH_BOT.easy, b=ahPaddles[1];
  var dx=ahBotTarget.x-b.x, dy=ahBotTarget.y-b.y;
  var dist=Math.sqrt(dx*dx+dy*dy);
  if (dist<0.5) { b.pvx=0; b.pvy=0; return; }
  var step=Math.min(cfg.max_speed*(dt/1000), dist);
  b.pvx=(dx/dist)*step/(dt/1000);
  b.pvy=(dy/dist)*step/(dt/1000);
  b.x+=(dx/dist)*step; b.y+=(dy/dist)*step;
  ahClampPaddle(b,1);
}

// ── Physics ─────────────────────────────────────────────────────
function ahCircleCollide(a,b) {
  var dx=b.x-a.x, dy=b.y-a.y;
  return dx*dx+dy*dy<(a.r+b.r)*(a.r+b.r);
}

function ahResolvePaddlePuck(paddle,puck) {
  var dx=puck.x-paddle.x, dy=puck.y-paddle.y;
  var d=Math.sqrt(dx*dx+dy*dy);
  if (d===0) { d=0.01; dx=1; dy=0; }
  var nx=dx/d, ny=dy/d;

  // Push puck out of paddle to prevent embedding
  var overlap=(paddle.r+puck.r+2)-d;
  if (overlap>0) { puck.x+=nx*overlap; puck.y+=ny*overlap; }

  var relVx=puck.vx-paddle.pvx, relVy=puck.vy-paddle.pvy;
  var dot=relVx*nx+relVy*ny;
  if (dot > 0) return; // already separating

  // Reflect puck velocity off the collision normal (pure elastic, no spin/boost
  // so the direction changes but magnitude is untouched before we normalize).
  puck.vx -= 2*dot*nx;
  puck.vy -= 2*dot*ny;

  // If paddle is moving, add a nudge in its direction so hits feel responsive,
  // but immediately re-normalize so speed is unaffected.
  var paddleSpd=Math.sqrt(paddle.pvx*paddle.pvx+paddle.pvy*paddle.pvy);
  if (paddleSpd > 10) {
    var nudge = 0.18;
    puck.vx += paddle.pvx * nudge;
    puck.vy += paddle.pvy * nudge;
  }

  // Hard-lock to constant speed — direction only ever changes on a hit
  var spd=Math.sqrt(puck.vx*puck.vx+puck.vy*puck.vy)||1;
  puck.vx = puck.vx / spd * ahPuckTargetSpeed;
  puck.vy = puck.vy / spd * ahPuckTargetSpeed;

  // Guarantee puck is moving away from paddle after collision
  var sepVel = puck.vx*nx + puck.vy*ny;
  if (sepVel < 0) { puck.vx -= 2*sepVel*nx; puck.vy -= 2*sepVel*ny;
    var s2=Math.sqrt(puck.vx*puck.vx+puck.vy*puck.vy)||1;
    puck.vx=puck.vx/s2*ahPuckTargetSpeed; puck.vy=puck.vy/s2*ahPuckTargetSpeed; }
  ahSpawnImpact(puck.x,puck.y);
  ahRings.push({x:puck.x,y:puck.y,r:paddle.r,life:1});
  ahSnd.paddleHit(spd/60);
}

function ahSpawnImpact(x,y) {
  var colors=['#00e5ff','#ffffff','#7effff','#b2ebf2'];
  for (var i=0;i<12;i++) {
    var a=Math.random()*Math.PI*2, spd=(Math.random()*4+1)*60;
    ahParticles.push({x:x,y:y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
      life:1,color:colors[Math.floor(Math.random()*colors.length)],size:2+Math.random()*3});
  }
}

function ahSpawnWallSparks(x,y) {
  for (var i=0;i<6;i++) {
    var a=Math.random()*Math.PI*2, spd=(Math.random()*2.5+0.5)*60;
    ahParticles.push({x:x,y:y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:0.7,color:'#aae8ff',size:1.5});
  }
}

// Safety: if puck somehow becomes stationary (should never happen), kick it.
// Constant speed is maintained per sub-step inside ahPhysicsStep and on every
// paddle hit in ahResolvePaddlePuck — this function is the final safety net only.
function ahEnforceMinSpeed() {
  var target = ahPuckTargetSpeed > 0 ? ahPuckTargetSpeed : ahW * 0.75;
  var spd2 = ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy;
  if (spd2 < 1) {
    var ang = Math.atan2(ahH/2 - ahPuck.y, ahW/2 - ahPuck.x) + (Math.random()-0.5)*1.2;
    ahPuck.vx = Math.cos(ang) * target;
    ahPuck.vy = Math.sin(ang) * target;
  }
}

function ahPhysicsStep(dt_sub, wallFlags) {
  var sec=dt_sub/1000, r=ahPuck.r, gw=ahGoalWidth()/2, cx=ahW/2;

  ahPuck.x+=ahPuck.vx*sec; ahPuck.y+=ahPuck.vy*sec;

  // Side walls
  if (ahPuck.x-r<0) {
    ahPuck.x=r; ahPuck.vx=Math.abs(ahPuck.vx);
    if (!wallFlags.left) { wallFlags.left=true; ahSpawnWallSparks(r,ahPuck.y); ahSnd.wallBounce(); }
  }
  if (ahPuck.x+r>ahW) {
    ahPuck.x=ahW-r; ahPuck.vx=-Math.abs(ahPuck.vx);
    if (!wallFlags.right) { wallFlags.right=true; ahSpawnWallSparks(ahW-r,ahPuck.y); ahSnd.wallBounce(); }
  }
  // Top/bottom walls (exclude goal mouth)
  if (ahPuck.y-r<0 && !(ahPuck.x>cx-gw&&ahPuck.x<cx+gw)) {
    ahPuck.y=r; ahPuck.vy=Math.abs(ahPuck.vy);
    if (!wallFlags.top) { wallFlags.top=true; ahSpawnWallSparks(ahPuck.x,r); ahSnd.wallBounce(); }
  }
  if (ahPuck.y+r>ahH && !(ahPuck.x>cx-gw&&ahPuck.x<cx+gw)) {
    ahPuck.y=ahH-r; ahPuck.vy=-Math.abs(ahPuck.vy);
    if (!wallFlags.bot) { wallFlags.bot=true; ahSpawnWallSparks(ahPuck.x,ahH-r); ahSnd.wallBounce(); }
  }

  // FIX 7: Goalpost corner colliders. The tips of the four goal posts sit at
  // (cx±gw, 0) and (cx±gw, H). Without explicit collision geometry a fast puck
  // can cross the wall/goal boundary and clip straight past the post. Each post
  // is modelled as a small circle so the puck reflects correctly off the corner.
  var postR = r * 0.6;
  var posts = [{x:cx-gw,y:0},{x:cx+gw,y:0},{x:cx-gw,y:ahH},{x:cx+gw,y:ahH}];
  for (var ip=0; ip<4; ip++) {
    var pt = posts[ip];
    var pdx = ahPuck.x - pt.x, pdy = ahPuck.y - pt.y;
    var pd2 = pdx*pdx + pdy*pdy, minD = r + postR;
    if (pd2 < minD*minD && pd2 > 0.0001) {
      var pd = Math.sqrt(pd2), pnx = pdx/pd, pny = pdy/pd;
      // Push puck out
      ahPuck.x = pt.x + pnx*(minD+1);
      ahPuck.y = pt.y + pny*(minD+1);
      // Elastic reflect off post normal
      var dv = ahPuck.vx*pnx + ahPuck.vy*pny;
      if (dv < 0) { ahPuck.vx -= 2*dv*pnx; ahPuck.vy -= 2*dv*pny; }
      if (!wallFlags.post) { wallFlags.post=true; ahSpawnWallSparks(ahPuck.x,ahPuck.y); ahSnd.wallBounce(); }
    }
  }

  // Paddle collisions
  // FIX 2: _hitThisFrame must be reset inside the sub-step loop (done in ahLoop),
  // not once before the whole loop. With the old approach, sub-step 2+ found the
  // flag already true and only did a position nudge — no velocity correction —
  // so a fast puck would tunnel straight through the paddle.
  for (var pi=0;pi<2;pi++) {
    if (ahCircleCollide(ahPaddles[pi],ahPuck)) {
      if (!ahPaddles[pi]._hitThisFrame) {
        ahResolvePaddlePuck(ahPaddles[pi],ahPuck);
        ahPaddles[pi]._hitThisFrame=true;
      } else {
        var _dx=ahPuck.x-ahPaddles[pi].x, _dy=ahPuck.y-ahPaddles[pi].y;
        var _d=Math.sqrt(_dx*_dx+_dy*_dy)||0.01;
        var _ov=(ahPaddles[pi].r+ahPuck.r+2)-_d;
        if (_ov>0) { ahPuck.x+=(_dx/_d)*_ov; ahPuck.y+=(_dy/_d)*_ov; }
      }
    }
  }

  // Constant speed — re-normalise after every sub-step
  if (ahPuckTargetSpeed > 0) {
    var _spd = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy) || 1;
    ahPuck.vx = ahPuck.vx / _spd * ahPuckTargetSpeed;
    ahPuck.vy = ahPuck.vy / _spd * ahPuckTargetSpeed;
  }

  // Goal detection
  if (ahPuck.y-r<0 && ahPuck.x>cx-gw && ahPuck.x<cx+gw) {
    ahP1Score++; ahSnd.goal(true); ahUpdateScoreUI(); ahShowGoalFlash(0);
    if (ahP1Score>=ahWinScore) { ahGameOver(0); return true; }
    ahResetPositions(1); return true;
  }
  if (ahPuck.y+r>ahH && ahPuck.x>cx-gw && ahPuck.x<cx+gw) {
    ahP2Score++; ahSnd.goal(false); ahUpdateScoreUI(); ahShowGoalFlash(1);
    if (ahP2Score>=ahWinScore) { ahGameOver(1); return true; }
    ahResetPositions(0); return true;
  }
  return false;
}

// ── Score UI ───────────────────────────────────────────────────
function ahUpdateScoreUI() {
  var e1=document.getElementById('ah-p1-val'), e2=document.getElementById('ah-p2-val');
  if (e1) e1.textContent=ahP1Score;
  if (e2) e2.textContent=ahP2Score;
  ahUpdatePips('ah-p1-pips',ahP1Score,ahWinScore,'#00e5ff');
  ahUpdatePips('ah-p2-pips',ahP2Score,ahWinScore,'#ff4081');
}

function ahUpdatePips(id,score,total,color) {
  var el=document.getElementById(id); if (!el) return;
  el.innerHTML='';
  var show=Math.min(total,10);
  for (var i=0;i<show;i++) {
    var pip=document.createElement('div');
    pip.className='ah-pip'+(i<score?' ah-pip--on':'');
    pip.style.setProperty('--pip-color',color);
    el.appendChild(pip);
  }
}

function ahShowGoalFlash(who) {
  var el=document.getElementById('ah-goal-flash'); if (!el) return;
  clearTimeout(el._t);
  el.style.display='none';
  el.className='ah-goal-flash';
  void el.offsetWidth;
  el.className='ah-goal-flash ah-goal-flash--'+(who===0?'p1':'p2');
  el.textContent='⚡ GOAL!';
  el.style.display='flex';
  el._t=setTimeout(function(){el.style.display='none';},1100);
}

function ahGameOver(winner) {
  ahStopLoop();
  ahMatchCount++;
  var label=winner===0?'PLAYER 1':(ahMode==='pvb'?'BOT':'PLAYER 2');
  var color=winner===0?'#00e5ff':(ahMode==='pvb'?'#ff4081':'#ff9100');
  if (winner===0) ahSnd.win(); else if (ahMode==='pvp') ahSnd.win(); else ahSnd.lose();
  var el=document.getElementById('ah-overlay-msg');
  if (!el) return;
  el.style.display='flex'; el.className='ah-overlay-msg';
  function showResult() {
    el.innerHTML=
      '<div class="ah-win-icon">'+(winner===0?'🏆':'😤')+'</div>'+
      '<div class="ah-win-title" style="color:'+color+'">'+label+' WINS!</div>'+
      '<div class="ah-win-score">'+ahP1Score+' \u2013 '+ahP2Score+'</div>'+
      '<button class="ah-win-btn" onclick="startAHGame()">\u21ba Play Again</button>'+
      '<button class="ah-win-btn ah-win-btn--sec" onclick="showAH()">\u2190 Menu</button>';
  }
  if (ahMatchCount%2===0 && window.show_9092988 && typeof window.show_9092988==='function') {
    el.innerHTML='<div style="color:#888;font-size:13px;letter-spacing:0.1em;">Loading\u2026</div>';
    try { window.show_9092988().then(showResult).catch(showResult); } catch(e){ showResult(); }
  } else { showResult(); }
}

// ── Main Loop ──────────────────────────────────────────────────
function ahLoop(ts) {
  if (!ahRunning) return;
  if (document.hidden) { ahLastTime=ts; ahRAF=requestAnimationFrame(ahLoop); return; }
  var dt=ahLastTime===0?16:Math.min(ts-ahLastTime,50);
  ahLastTime=ts;
  if (ahPaused) { ahDraw(); ahRAF=requestAnimationFrame(ahLoop); return; }

  if (ahGoalFreezeMs>0) {
    ahGoalFreezeMs-=dt;
    ahClampPaddle(ahPaddles[0],0);
    ahClampPaddle(ahPaddles[1],1);
    // FIX 5: zero bot pvx/pvy during the freeze so stale pre-goal velocity
    // doesn't corrupt the first paddle collision after the serve launches.
    ahPaddles[1].pvx=0; ahPaddles[1].pvy=0;
    if (ahGoalFreezeMs<=0) {
      ahGoalFreezeMs=0;
      if (ahPuck.vServe) {
        ahPuck.vx=ahPuck.vServe.vx; ahPuck.vy=ahPuck.vServe.vy;
        // Re-sync target speed (already set in ahResetPositions; this is a safety guard).
        ahPuckTargetSpeed = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy);
        ahPuck.vServe=null;
        ahAccumulator=0;  // start fresh — no accumulated debt from freeze period
        ahLoop._lastPx=ahPuck.x; ahLoop._lastPy=ahPuck.y; ahStuckTimer=0;
        ahSnd.puckStart();
      }
    }
    ahDraw(); ahRAF=requestAnimationFrame(ahLoop); return;
  }

  // ── Fixed-timestep accumulator ─────────────────────────────
  // Accumulate real elapsed time, then drain it in fixed 16.667 ms ticks.
  // This decouples physics from the display frame-rate so the puck always
  // travels exactly (ahPuckTargetSpeed * AH_FIXED_DT/1000) px per tick —
  // constant perceived speed regardless of monitor Hz or frame drops.
  ahAccumulator += dt;
  // Safety cap: if we've fallen more than 5 ticks behind (e.g. tab was hidden
  // beyond the dt=50 guard), discard the surplus so we don't spiral.
  if (ahAccumulator > AH_FIXED_DT * 5) ahAccumulator = AH_FIXED_DT * 5;

  var goalScored = false;
  while (ahAccumulator >= AH_FIXED_DT && !goalScored) {
    var tickDt = AH_FIXED_DT;          // always the same — the whole point

    ahUpdateBot(tickDt);
    ahMoveBot(tickDt);

    // Keyboard P1
    var kSpd=ahW*1.35*(tickDt/1000), p0=ahPaddles[0];
    if (p0.key.up) { p0.pvy=-kSpd/(tickDt/1000); p0.y-=kSpd; }
    else if (p0.key.dn) { p0.pvy=kSpd/(tickDt/1000); p0.y+=kSpd; } else p0.pvy=0;
    if (p0.key.lt) { p0.pvx=-kSpd/(tickDt/1000); p0.x-=kSpd; }
    else if (p0.key.rt) { p0.pvx=kSpd/(tickDt/1000); p0.x+=kSpd; } else p0.pvx=0;
    ahClampPaddle(p0,0);

    // Keyboard P2 (PvP)
    if (ahMode==='pvp') {
      var p1=ahPaddles[1];
      if (p1.key.up) { p1.pvy=-kSpd/(tickDt/1000); p1.y-=kSpd; }
      else if (p1.key.dn) { p1.pvy=kSpd/(tickDt/1000); p1.y+=kSpd; } else p1.pvy=0;
      if (p1.key.lt) { p1.pvx=-kSpd/(tickDt/1000); p1.x-=kSpd; }
      else if (p1.key.rt) { p1.pvx=kSpd/(tickDt/1000); p1.x+=kSpd; } else p1.pvx=0;
      ahClampPaddle(p1,1);
    }

    // Sub-step physics (collision precision within each fixed tick)
    var puckSpd=Math.sqrt(ahPuck.vx*ahPuck.vx+ahPuck.vy*ahPuck.vy);
    var subSteps=Math.max(1,Math.min(10,Math.ceil(puckSpd*(tickDt/1000)/(ahPuck.r*0.4))));
    var dt_sub=tickDt/subSteps;
    var wallFlags={left:false,right:false,top:false,bot:false,post:false};
    for (var s=0;s<subSteps&&!goalScored;s++) {
      ahPaddles[0]._hitThisFrame=false;
      ahPaddles[1]._hitThisFrame=false;
      goalScored=ahPhysicsStep(dt_sub,wallFlags);
    }

    // Stuck-rescue (position-drift check, runs once per tick)
    if (!ahLoop._lastPx) { ahLoop._lastPx=ahPuck.x; ahLoop._lastPy=ahPuck.y; }
    var _pdx=ahPuck.x-ahLoop._lastPx, _pdy=ahPuck.y-ahLoop._lastPy;
    var _moved=Math.sqrt(_pdx*_pdx+_pdy*_pdy);
    ahLoop._lastPx=ahPuck.x; ahLoop._lastPy=ahPuck.y;
    if (_moved > ahPuck.r*0.3) { ahStuckTimer=0; }
    ahStuckTimer += tickDt;
    if (ahStuckTimer>2000) {
      ahStuckTimer=0;
      var _kickAng=Math.atan2(ahH/2-ahPuck.y, ahW/2-ahPuck.x)+(Math.random()-0.5)*1.0;
      ahPuck.vx=Math.cos(_kickAng)*ahPuckTargetSpeed;
      ahPuck.vy=Math.sin(_kickAng)*ahPuckTargetSpeed;
      ahSnd.puckStart();
    }

    // Corner-escape
    var gw2 = ahGoalWidth()/2, cx2 = ahW/2;
    var nearSideWall = ahPuck.x < ahPuck.r*5 || ahPuck.x > ahW - ahPuck.r*5;
    var nearEndWall  = (ahPuck.y < ahPuck.r*5 && !(ahPuck.x>cx2-gw2 && ahPuck.x<cx2+gw2)) ||
                       (ahPuck.y > ahH - ahPuck.r*5 && !(ahPuck.x>cx2-gw2 && ahPuck.x<cx2+gw2));
    if (nearSideWall && nearEndWall) {
      ahCornerTimer += tickDt;
      if (ahCornerTimer > 700) {
        ahCornerTimer = 0;
        var kickAng = Math.atan2(ahH/2 - ahPuck.y, ahW/2 - ahPuck.x) + (Math.random()-0.5)*0.6;
        ahPuck.vx = Math.cos(kickAng) * (ahPuckTargetSpeed || ahW*0.85);
        ahPuck.vy = Math.sin(kickAng) * (ahPuckTargetSpeed || ahW*0.85);
      }
    } else {
      ahCornerTimer = 0;
    }

    // Safety: kick puck if stationary
    ahEnforceMinSpeed();

    // HARD LOCK — puck exits every tick at exactly ahPuckTargetSpeed
    if (ahPuckTargetSpeed > 0) {
      var _fs = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy) || 1;
      ahPuck.vx = ahPuck.vx / _fs * ahPuckTargetSpeed;
      ahPuck.vy = ahPuck.vy / _fs * ahPuckTargetSpeed;
    }

    ahAccumulator -= AH_FIXED_DT;
  }

  if (goalScored) { ahDraw(); ahRAF=requestAnimationFrame(ahLoop); return; }

  // Trail (updated once per render frame, not per tick)
  ahTrail.push({x:ahPuck.x,y:ahPuck.y});
  var maxTrail=18;
  if (ahTrail.length>maxTrail) ahTrail.shift();

  // Speed lines (use puckSpd from last tick)
  var puckSpd=Math.sqrt(ahPuck.vx*ahPuck.vx+ahPuck.vy*ahPuck.vy);
  if (puckSpd>ahW*1.5&&Math.random()<0.4) {
    var angle=Math.atan2(ahPuck.vy,ahPuck.vx)+Math.PI;
    ahSpeedLines.push({x:ahPuck.x,y:ahPuck.y,angle:angle+(Math.random()-0.5)*0.5,
      len:8+Math.random()*20,life:1});
  }
  var slDecay=9.0*(dt/1000);  // visual-only: use render dt
  for (var i=ahSpeedLines.length-1;i>=0;i--) {
    ahSpeedLines[i].life-=slDecay; if (ahSpeedLines[i].life<=0) ahSpeedLines.splice(i,1);
  }

  // Particles
  var pDecay=2.2*(dt/1000), drag=Math.pow(0.88,dt/1000*60);  // visual-only
  for (var i=ahParticles.length-1;i>=0;i--) {
    var p=ahParticles[i];
    p.x+=p.vx*(dt/1000); p.y+=p.vy*(dt/1000);
    p.life-=pDecay; p.vx*=drag; p.vy*=drag;
    if (p.life<=0) ahParticles.splice(i,1);
  }

  // Rings
  var rGrow=180*(dt/1000), rDecay=5.0*(dt/1000);
  for (var i=ahRings.length-1;i>=0;i--) {
    ahRings[i].r+=rGrow; ahRings[i].life-=rDecay;
    if (ahRings[i].life<=0) ahRings.splice(i,1);
  }

  ahDraw();
  ahRAF=requestAnimationFrame(ahLoop);
}

// ── Drawing ────────────────────────────────────────────────────
function ahDraw() {
  var ctx=ahCtx, W=ahW, H=ahH;

  // Background
  var bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#020c18'); bg.addColorStop(0.5,'#040f20'); bg.addColorStop(1,'#020c18');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  var shimmer=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.7);
  shimmer.addColorStop(0,'rgba(0,229,255,0.04)');
  shimmer.addColorStop(0.6,'rgba(0,100,180,0.02)');
  shimmer.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=shimmer; ctx.fillRect(0,0,W,H);

  // Table border
  ctx.save();
  var brd=6;
  ctx.shadowColor='#00e5ff'; ctx.shadowBlur=24;
  ctx.strokeStyle='#00e5ff'; ctx.lineWidth=3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(brd,brd,W-brd*2,H-brd*2,12); else ctx.rect(brd,brd,W-brd*2,H-brd*2);
  ctx.stroke();
  ctx.shadowBlur=8; ctx.strokeStyle='rgba(0,229,255,0.2)'; ctx.lineWidth=1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(brd+6,brd+6,W-brd*2-12,H-brd*2-12,8); else ctx.rect(brd+6,brd+6,W-brd*2-12,H-brd*2-12);
  ctx.stroke();
  ctx.restore();

  // Goals
  var gw=ahGoalWidth(), gx=(W-gw)/2, gDepth=ahPuck.r*2.2;
  ctx.save();
  var tgg=ctx.createLinearGradient(0,0,0,gDepth);
  tgg.addColorStop(0,'rgba(0,229,255,0.5)'); tgg.addColorStop(1,'rgba(0,229,255,0.02)');
  ctx.fillStyle=tgg; ctx.fillRect(gx,0,gw,gDepth);
  ctx.shadowColor='#00e5ff'; ctx.shadowBlur=16; ctx.strokeStyle='#00e5ff'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(gx,gDepth); ctx.lineTo(gx,3); ctx.lineTo(gx+gw,3); ctx.lineTo(gx+gw,gDepth); ctx.stroke();
  ctx.fillStyle='#00e5ff'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(gx,gDepth,5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(gx+gw,gDepth,5,0,Math.PI*2); ctx.fill();
  var bgg=ctx.createLinearGradient(0,H,0,H-gDepth);
  bgg.addColorStop(0,'rgba(255,64,129,0.5)'); bgg.addColorStop(1,'rgba(255,64,129,0.02)');
  ctx.fillStyle=bgg; ctx.fillRect(gx,H-gDepth,gw,gDepth);
  ctx.shadowColor='#ff4081'; ctx.strokeStyle='#ff4081';
  ctx.beginPath(); ctx.moveTo(gx,H-gDepth); ctx.lineTo(gx,H-3); ctx.lineTo(gx+gw,H-3); ctx.lineTo(gx+gw,H-gDepth); ctx.stroke();
  ctx.fillStyle='#ff4081'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(gx,H-gDepth,5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(gx+gw,H-gDepth,5,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Centre markings
  ctx.save();
  ctx.shadowColor='rgba(0,229,255,0.3)'; ctx.shadowBlur=10;
  ctx.strokeStyle='rgba(0,229,255,0.25)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(W/2,H/2,W*0.16,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(0,229,255,0.12)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(W/2,H/2,W*0.06,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(0,229,255,0.18)'; ctx.lineWidth=1.5;
  ctx.setLineDash([10,7]);
  ctx.beginPath(); ctx.moveTo(brd+8,H/2); ctx.lineTo(W-brd-8,H/2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor='#00e5ff'; ctx.shadowBlur=14;
  var cdg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,6);
  cdg.addColorStop(0,'rgba(0,229,255,0.9)'); cdg.addColorStop(1,'rgba(0,229,255,0)');
  ctx.fillStyle=cdg; ctx.beginPath(); ctx.arc(W/2,H/2,6,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(0,229,255,0.1)'; ctx.lineWidth=1;
  [H*0.25,H*0.75].forEach(function(fy){[W*0.25,W*0.75].forEach(function(fx){
    ctx.beginPath(); ctx.arc(fx,fy,W*0.06,0,Math.PI*2); ctx.stroke();
  });});
  ctx.restore();

  // Speed lines
  ctx.save();
  for (var i=0;i<ahSpeedLines.length;i++) {
    var sl=ahSpeedLines[i];
    ctx.globalAlpha=sl.life*0.6; ctx.strokeStyle='rgba(120,220,255,0.8)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sl.x,sl.y);
    ctx.lineTo(sl.x+Math.cos(sl.angle)*sl.len,sl.y+Math.sin(sl.angle)*sl.len); ctx.stroke();
  }
  ctx.restore();

  // Trail
  ctx.save();
  for (var i=0;i<ahTrail.length;i++) {
    var frac=i/ahTrail.length, r2=ahPuck.r*frac*0.7; if (r2<0.5) continue;
    var tg=ctx.createRadialGradient(ahTrail[i].x,ahTrail[i].y,0,ahTrail[i].x,ahTrail[i].y,r2);
    tg.addColorStop(0,'rgba(0,229,255,'+(frac*0.55)+')'); tg.addColorStop(1,'rgba(0,229,255,0)');
    ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(ahTrail[i].x,ahTrail[i].y,r2,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Puck
  ctx.save();
  var puckSpd=Math.sqrt(ahPuck.vx*ahPuck.vx+ahPuck.vy*ahPuck.vy);
  var sFrac=Math.min(1,puckSpd/(ahW*2.4));
  ctx.shadowColor=sFrac>0.5?'rgba(255,120,0,0.9)':'#00e5ff';
  ctx.shadowBlur=Math.min(48,14+puckSpd*0.018);
  var pg=ctx.createRadialGradient(ahPuck.x-ahPuck.r*0.35,ahPuck.y-ahPuck.r*0.35,ahPuck.r*0.05,ahPuck.x,ahPuck.y,ahPuck.r);
  pg.addColorStop(0,'rgb('+Math.round(232+23*sFrac)+','+Math.round(248-100*sFrac)+','+Math.round(255-80*sFrac)+')');
  pg.addColorStop(0.3,'#70d8ff'); pg.addColorStop(0.7,'#0099cc'); pg.addColorStop(1,'#003355');
  ctx.beginPath(); ctx.arc(ahPuck.x,ahPuck.y,ahPuck.r,0,Math.PI*2); ctx.fillStyle=pg; ctx.fill();
  ctx.strokeStyle=sFrac>0.6?'rgba(255,'+Math.round(100*(1-sFrac))+',80,0.85)':'rgba(150,220,255,0.7)';
  ctx.lineWidth=2; ctx.stroke();
  ctx.shadowBlur=0; ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(ahPuck.x-ahPuck.r*0.3,ahPuck.y); ctx.lineTo(ahPuck.x+ahPuck.r*0.3,ahPuck.y);
  ctx.moveTo(ahPuck.x,ahPuck.y-ahPuck.r*0.3); ctx.lineTo(ahPuck.x,ahPuck.y+ahPuck.r*0.3);
  ctx.stroke(); ctx.restore();

  // Rings
  ctx.save();
  for (var i=0;i<ahRings.length;i++) {
    var ring=ahRings[i];
    ctx.globalAlpha=ring.life*0.6; ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2*ring.life;
    ctx.shadowColor='#00e5ff'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // Paddles
  var pColors=['#00e5ff',ahMode==='pvb'?'#ff4081':'#ff9100'];
  var pDark=['#003344',ahMode==='pvb'?'#440022':'#442200'];
  var pGlow=['rgba(0,229,255,0.9)',ahMode==='pvb'?'rgba(255,64,129,0.9)':'rgba(255,145,0,0.9)'];
  var pLabels=['1',ahMode==='pvb'?'🤖':'2'];
  for (var pi=0;pi<2;pi++) {
    var pad=ahPaddles[pi]; ctx.save();
    ctx.shadowColor=pGlow[pi]; ctx.shadowBlur=26;
    var glowR=ctx.createRadialGradient(pad.x,pad.y,pad.r*0.5,pad.x,pad.y,pad.r*1.8);
    glowR.addColorStop(0,'rgba(255,255,255,0.06)'); glowR.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glowR; ctx.beginPath(); ctx.arc(pad.x,pad.y,pad.r*1.8,0,Math.PI*2); ctx.fill();
    var rg=ctx.createRadialGradient(pad.x-pad.r*0.3,pad.y-pad.r*0.35,pad.r*0.04,pad.x,pad.y,pad.r);
    rg.addColorStop(0,'#ffffff'); rg.addColorStop(0.35,pColors[pi]);
    rg.addColorStop(0.75,pColors[pi]+'99'); rg.addColorStop(1,pDark[pi]);
    ctx.beginPath(); ctx.arc(pad.x,pad.y,pad.r,0,Math.PI*2); ctx.fillStyle=rg; ctx.fill();
    ctx.strokeStyle=pColors[pi]; ctx.lineWidth=2.5; ctx.stroke();
    ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(pad.x,pad.y,pad.r*0.62,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=pDark[pi]; ctx.shadowColor=pColors[pi]; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.arc(pad.x,pad.y,pad.r*0.22,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.font='bold '+Math.round(pad.r*0.28)+'px Orbitron,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.shadowBlur=0;
    ctx.fillText(pLabels[pi],pad.x,pad.y); ctx.restore();
  }

  // Particles
  ctx.save();
  for (var i=0;i<ahParticles.length;i++) {
    var p=ahParticles[i]; ctx.globalAlpha=p.life;
    ctx.shadowColor=p.color; ctx.shadowBlur=8; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Serve hint
  if (ahGoalFreezeMs>250) {
    var servingP1=ahServeWho===0;
    ctx.save();
    ctx.globalAlpha=Math.min(1,(ahGoalFreezeMs-250)/350);
    ctx.font='bold '+Math.round(W*0.042)+'px Orbitron,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.shadowColor='#00e5ff'; ctx.shadowBlur=16;
    var serveLabel = servingP1 ? '\u25b2 YOUR SERVE' : (ahMode==='pvp' ? '\u25bc P2 SERVE' : '\u25bc BOT SERVE');
    ctx.fillText(serveLabel,W/2,servingP1?H*0.73:H*0.27);
    ctx.restore();
  }

  // Pause overlay
  if (ahPaused) {
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,H);
    ctx.font='bold '+Math.round(W*0.1)+'px Orbitron,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#00e5ff'; ctx.shadowColor='#00e5ff'; ctx.shadowBlur=30;
    ctx.fillText('PAUSED',W/2,H/2); ctx.restore();
  }
}

// ── Touch / Pointer ─────────────────────────────────────────────
(function(){
  var active={}, prevPos={}, prevTime={};
  function setup() {
    var canvas=document.getElementById('ah-canvas'); if (!canvas) return;
    function getScaled(e) {
      var rect=canvas.getBoundingClientRect();
      return {x:(e.clientX-rect.left)*(ahW/rect.width),y:(e.clientY-rect.top)*(ahH/rect.height)};
    }
    canvas.addEventListener('pointerdown',function(e){
      e.preventDefault();
      var s=getScaled(e);
      var pi=s.y>ahH/2?0:(ahMode==='pvp'?1:-1);
      if (pi>=0) { active[e.pointerId]=pi; prevPos[e.pointerId]=s; prevTime[e.pointerId]=performance.now(); }
    },{passive:false});
    canvas.addEventListener('pointermove',function(e){
      e.preventDefault();
      if (!(e.pointerId in active)) return;
      var s=getScaled(e), pi=active[e.pointerId];
      var now=performance.now(), prev=prevPos[e.pointerId]||s, pt=prevTime[e.pointerId]||now;
      var dtT=Math.max(1,now-pt);
      var rawVx=(s.x-prev.x)/(dtT/1000), rawVy=(s.y-prev.y)/(dtT/1000);
      var maxV=ahW*4.5, mag=Math.sqrt(rawVx*rawVx+rawVy*rawVy);
      if (mag>maxV){rawVx=rawVx/mag*maxV;rawVy=rawVy/mag*maxV;}
      ahPaddles[pi].x=s.x; ahPaddles[pi].y=s.y;
      ahClampPaddle(ahPaddles[pi],pi);
      ahPaddles[pi].pvx=rawVx; ahPaddles[pi].pvy=rawVy;
      prevPos[e.pointerId]=s; prevTime[e.pointerId]=now;
    },{passive:false});
    function onEnd(e){
      if (e.pointerId in active){var pi=active[e.pointerId];ahPaddles[pi].pvx=0;ahPaddles[pi].pvy=0;}
      delete active[e.pointerId];delete prevPos[e.pointerId];delete prevTime[e.pointerId];
    }
    canvas.addEventListener('pointerup',onEnd);
    canvas.addEventListener('pointercancel',onEnd);
  }
  setup();
})();

// ── Keyboard ───────────────────────────────────────────────────
(function(){
  var keyMap={
    'KeyW':{p:0,dir:'up'},'ArrowUp':{p:0,dir:'up'},
    'KeyS':{p:0,dir:'dn'},'ArrowDown':{p:0,dir:'dn'},
    'KeyA':{p:0,dir:'lt'},'ArrowLeft':{p:0,dir:'lt'},
    'KeyD':{p:0,dir:'rt'},'ArrowRight':{p:0,dir:'rt'},
    'KeyI':{p:1,dir:'up'},'KeyK':{p:1,dir:'dn'},
    'KeyJ':{p:1,dir:'lt'},'KeyL':{p:1,dir:'rt'}
  };
  function isActive(){
    var pp=document.getElementById('ah-play-panel');
    return ahRunning&&!ahPaused&&pp&&!pp.classList.contains('hidden');
  }
  document.addEventListener('keydown',function(e){
    if (!isActive()) return;
    var k=keyMap[e.code]; if (k){ahPaddles[k.p].key[k.dir]=true;e.preventDefault();}
  });
  document.addEventListener('keyup',function(e){
    var k=keyMap[e.code]; if (k) ahPaddles[k.p].key[k.dir]=false;
  });
})();

// ── Home page wiring ───────────────────────────────────────────
var ahHPMode='pvb', ahHPDiff='easy', ahHPWinScore=7;
(function(){
  function q(id){return document.getElementById(id);}
  ['ah-mode-pvb','ah-mode-pvp'].forEach(function(id){
    var el=q(id); if (!el) return;
    el.addEventListener('click',function(){
      ahHPMode=el.getAttribute('data-mode');
      document.querySelectorAll('#ah-home .ah-pill[data-mode]').forEach(function(b){b.classList.remove('active');});
      el.classList.add('active');
      var dr=q('ah-diff-row'); if (dr) dr.style.display=ahHPMode==='pvb'?'':'none';
      ahSnd.click();
    });
  });
  ['ah-diff-easy','ah-diff-medium','ah-diff-hard'].forEach(function(id){
    var el=q(id); if (!el) return;
    el.addEventListener('click',function(){
      ahHPDiff=el.getAttribute('data-diff');
      document.querySelectorAll('#ah-home .ah-pill[data-diff]').forEach(function(b){b.classList.remove('active');});
      el.classList.add('active'); ahSnd.click();
    });
  });
  ['ah-score-5','ah-score-7','ah-score-10'].forEach(function(id){
    var el=q(id); if (!el) return;
    el.addEventListener('click',function(){
      ahHPWinScore=parseInt(el.getAttribute('data-val'));
      document.querySelectorAll('#ah-home .ah-pill[data-val]').forEach(function(b){b.classList.remove('active');});
      el.classList.add('active'); ahSnd.click();
    });
  });
  var mb=q('ah-main-back');   if (mb) mb.addEventListener('click',function(){if(typeof showHub==='function')showHub();});
  var bb=q('ah-back-to-home');if (bb) bb.addEventListener('click',function(){showAH();});
  var sb=q('ah-hp-start');    if (sb) sb.addEventListener('click',startAHGame);
  var pb=q('ah-pause-btn');
  if (pb) pb.addEventListener('click',function(){
    ahPaused=!ahPaused; this.textContent=ahPaused?'▶':'⏸'; ahSnd.click();
  });
})();

// FIX 1: showAH was called from the game-over "← Menu" button (inline onclick)
// and the back-to-home button listener, but was NEVER defined anywhere in this
// file or in index.html — every click caused a ReferenceError crash.
function showAH() {
  ahStopLoop();
  var homeEl = document.getElementById('ah-home');
  var playEl = document.getElementById('ah-play-panel');
  var ol     = document.getElementById('ah-overlay-msg');
  var gf     = document.getElementById('ah-goal-flash');
  if (playEl) playEl.classList.add('hidden');
  if (homeEl) homeEl.classList.remove('hidden');
  if (ol) { ol.style.display='none'; ol.className='ah-overlay-msg hidden'; }
  if (gf) gf.style.display='none';
  // Ensure the screen itself is visible (in case we are navigating from hub)
  var screen = document.getElementById('screen-airhockey');
  if (screen) {
    document.querySelectorAll('[id^="screen-"]').forEach(function(s){
      s.classList.add('hidden');
    });
    screen.classList.remove('hidden');
  }
  window.scrollTo(0,0);
}
window.showAH = showAH; // expose for hub card routing (SHOW_FNS map in index.html)

// FIX 9: startAHGame now calls ahStopLoop() first. Previously, hitting "Play Again"
// while any loop was still alive would start a second RAF alongside the first,
// causing double-speed physics, doubled sound effects, and score corruption.
function startAHGame(){
  ahStopLoop();
  ahMode=ahHPMode; ahDiff=ahHPDiff; ahWinScore=ahHPWinScore;
  var homeEl=document.getElementById('ah-home'), playEl=document.getElementById('ah-play-panel');
  if (homeEl) homeEl.classList.add('hidden');
  if (playEl) playEl.classList.remove('hidden');
  var p2l=document.getElementById('ah-p2-label'); if (p2l) p2l.textContent=ahMode==='pvb'?'BOT':'P2';
  var ol=document.getElementById('ah-overlay-msg');
  if (ol){ol.style.display='none';ol.className='ah-overlay-msg hidden';}
  var gf=document.getElementById('ah-goal-flash'); if (gf) gf.style.display='none';
  ahPaused=false;
  var pb=document.getElementById('ah-pause-btn'); if (pb) pb.textContent='⏸';
  ahInit();
  ahRunning=true; ahLastTime=0;
  ahRAF=requestAnimationFrame(ahLoop);
  ahUpdatePips('ah-p1-pips',0,ahWinScore,'#00e5ff');
  ahUpdatePips('ah-p2-pips',0,ahWinScore,'#ff4081');
  ahSnd.puckStart();
}
