// ═══════════════════════════════════════════════════════════════
// AIR HOCKEY — Neon Ice Edition  (airhockey.js)
//
// Game logic ported from air.js (original by Valerio Riva).
// Physics: air.js discrete-angle system (3-segment paddle hits,
// speed increment per rally, simplified CPU AI) adapted 90° for
// DuelZone's portrait top-down canvas.
//
// Axis rotation:  air.js side-view        →  DuelZone top-down
//   P1 left paddle (tracks mouse Y)       →  P1 bottom (tracks X)
//   P2 right paddle (AI tracks ball Y)    →  P2 top    (AI tracks ball X)
//   Ball goals: left / right              →  top / bottom
//   Ball walls: top / bottom              →  left / right
//
// Speed table (air.js px/50ms frame → px/s × canvas scale):
//   base   = (15 + inc) × 20 = (300 + 20×inc) × (W/400)
//   medium = (10 + inc) × 20 = (200 + 20×inc) × (W/400)
//   slow   = ( 5 + inc) × 20 = (100 + 20×inc) × (W/400)
//   inc caps at 20  →  max speed = 700 × (W/400) px/s
// ═══════════════════════════════════════════════════════════════

// ── Local Audio Engine ─────────────────────────────────────────
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
    win:       function () { [523,659,784,1047,1319].forEach(function(f,i){ tone(f,'sine',0.18,0.22,i*0.1); }); },
    lose:      function () { tone(440,'sawtooth',0.13,0.2); tone(330,'sawtooth',0.1,0.25,0.18); tone(220,'sawtooth',0.08,0.3,0.36); },
    puckStart: function () { tone(800, 'sine', 0.12, 0.15, 0, 400); },
    click:     function () { tone(600, 'sine', 0.07, 0.06); }
  };
})();

// ── Safe sound wrapper ─────────────────────────────────────────
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
// Factor is applied to ahGetSpeed() so the bot automatically keeps
// pace as the puck accelerates with each paddle hit (ahInc).
// easy   0.48 → ~50% of puck speed   (beatable by beginners)
// medium 0.72 → ~72% of puck speed   (fair challenge)
// hard   0.95 → ~95% of puck speed   (very tough)
var AH_BOT = {
  easy:   { factor: 0.48 },
  medium: { factor: 0.72 },
  hard:   { factor: 0.95 }
};
AH_BOT.extreme = AH_BOT.hard;

// ── State ──────────────────────────────────────────────────────
var ahCanvas, ahCtx;
var ahW, ahH;
var ahRAF     = null;
var ahRunning = false;
var ahPaused  = false;
var ahMode    = 'pvb';
var ahDiff    = 'easy';
var ahWinScore = 7;
var ahLastTime = 0;

var ahPuck = { x:0, y:0, vx:0, vy:0, r:0, vServe:null };
var ahPaddles = [
  { x:0, y:0, r:0, pvx:0, pvy:0, hitMs:0, key:{up:false,dn:false,lt:false,rt:false} },
  { x:0, y:0, r:0, pvx:0, pvy:0, hitMs:0, key:{up:false,dn:false,lt:false,rt:false} }
];

// air.js-derived state
var ahInc          = 0;   // speed increment — grows +1.3 per paddle hit, caps at 20
                           // (air.js: var inc, aumenta())

var ahGoalFreezeMs = 0;
var ahServeWho     = 0;
var ahTrail        = [];
var ahParticles    = [];
var ahSpeedLines   = [];
var ahRings        = [];
var ahStuckTimer      = 0;
var ahLastWallSoundMs = 0;   // debounce wall-bounce sounds across sub-steps
var ahP1Score = 0, ahP2Score = 0;
var ahMatchCount      = 0;

// ── Speed helpers (port of air.js SetAngle speeds) ─────────────
// air.js full:   (15+inc) px/50ms × 20fps = (300+20×inc) px/s
// air.js medium: (10+inc) px/50ms × 20fps = (200+20×inc) px/s
// air.js slow:   ( 5+inc) px/50ms × 20fps = (100+20×inc) px/s
// All scaled by (ahW/400) so physics feel the same on any canvas width.

function ahGetSpeed()    { return (300 + 20 * ahInc) * (ahW / 400); }
function ahGetMedSpeed() { return (200 + 20 * ahInc) * (ahW / 400); }
function ahGetSlowSpeed(){ return (100 + 20 * ahInc) * (ahW / 400); }

// air.js aumenta(): inc += 1.3, capped at 20
function ahAumenta() { if (ahInc < 20) ahInc += 1.3; }

// ── Helpers ────────────────────────────────────────────────────
function ahStopLoop() {
  ahRunning = false;
  if (ahRAF) { cancelAnimationFrame(ahRAF); ahRAF = null; }
  window.removeEventListener('resize', ahResize);
}

function ahResize() {
  var field = document.getElementById('ah-canvas-field');
  if (!field || !ahCanvas) return;
  var vw = window.innerWidth, vh = window.innerHeight;
  var isLandscape = vw > vh;
  var fw = field.clientWidth  || 360;
  var fh = field.clientHeight || (isLandscape ? vh - 90 : Math.round(fw * 1.55));
  var newW, newH;
  if (isLandscape) {
    // Landscape: fill the available height, use portrait-like aspect inside
    newH = Math.min(fh, vh - 90);
    newW = Math.min(fw, Math.round(newH / 1.5), 420);
    newH = Math.round(newW * 1.5);
  } else {
    newW = Math.min(fw, 420);
    newH = Math.max(Math.round(newW * 1.5), Math.min(fh, 660));
  }
  if (ahRunning && ahW && ahH && (newW !== ahW || newH !== ahH)) {
    var sx = newW / ahW, sy = newH / ahH;
    ahPuck.x *= sx; ahPuck.y *= sy;
    ahPuck.r = newW * 0.055;
    for (var i = 0; i < 2; i++) {
      ahPaddles[i].x *= sx; ahPaddles[i].y *= sy;
      ahPaddles[i].r = newW * 0.09;
    }
    // Rescale pending serve velocity to new canvas size
    if (ahPuck.vServe) {
      var sm = Math.sqrt(ahPuck.vServe.vx*ahPuck.vServe.vx + ahPuck.vServe.vy*ahPuck.vServe.vy);
      if (sm > 0.01) {
        var newSpd = ahGetSpeed();
        ahPuck.vServe.vx = ahPuck.vServe.vx / sm * newSpd;
        ahPuck.vServe.vy = ahPuck.vServe.vy / sm * newSpd;
      }
    }
    // Rescale live puck velocity proportionally then re-lock to current target speed.
    // sx and sy can differ when the canvas aspect ratio changes, so a simple
    // component-wise scale would change the actual speed — normalize after.
    if (ahPuck.vx !== 0 || ahPuck.vy !== 0) {
      ahPuck.vx *= sx; ahPuck.vy *= sy;
      var vm = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy);
      if (vm > 0.01) {
        var ts = ahGetSpeed();
        ahPuck.vx = ahPuck.vx / vm * ts;
        ahPuck.vy = ahPuck.vy / vm * ts;
      }
    }
  }
  ahW = newW; ahH = newH;
  ahCanvas.width = ahW; ahCanvas.height = ahH;
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
  ahInc = 0;                         // air.js: inc=0 at game start
  ahPuck.r       = ahW * 0.055;
  ahPaddles[0].r = ahW * 0.09;
  ahPaddles[1].r = ahW * 0.09;
  ahTrail=[]; ahParticles=[]; ahSpeedLines=[]; ahRings=[];
  ahStuckTimer=0; ahGoalFreezeMs=0; ahLastWallSoundMs=0;
  ahResetPositions(0);
  ahUpdateScoreUI();
  window.addEventListener('resize', ahResize);
}

// ── Reset for serve ────────────────────────────────────────────
// Mirrors air.js: pallino=0 → P1 (bottom) serves upward
//                 pallino=1 → P2 (top) serves downward
function ahResetPositions(serveWho) {
  ahPuck.x = ahW/2; ahPuck.y = ahH/2; ahPuck.vx = 0; ahPuck.vy = 0;
  ahPaddles[0].x = ahW/2; ahPaddles[0].y = ahH*0.82; ahPaddles[0].pvx=0; ahPaddles[0].pvy=0; ahPaddles[0].hitMs=0;
  ahPaddles[1].x = ahW/2; ahPaddles[1].y = ahH*0.18; ahPaddles[1].pvx=0; ahPaddles[1].pvy=0; ahPaddles[1].hitMs=0;
  ahServeWho = serveWho;
  ahGoalFreezeMs = 1300;
  ahStuckTimer = 0;          // prevent rescue nudge firing immediately after a goal
  ahLastWallSoundMs = 0;     // reset sound debounce so first bounce after serve sounds
  ahTrail=[]; ahSpeedLines=[];
  // air.js: if pallino==0 → ball goes toward P2 (UP in top-down)
  //         if pallino==1 → ball goes toward P1 (DOWN in top-down)
  var dir = (serveWho === 0) ? -1 : 1;
  var angle = (Math.random() - 0.5) * (Math.PI / 5); // ±18° random spread
  var spd = ahGetSpeed();
  ahPuck.vServe = {
    vx: Math.sin(angle) * spd,
    vy: dir * Math.cos(angle) * spd
  };
}

// ── Paddle hit angle assignment (core air.js port) ─────────────
//
// air.js P1 (left vertical paddle, ball hits at Y position in paddle):
//   Segment 1 (top 1/3):    dirX=0.5(right med),  dirY=0.5(up full)
//   Segment 2 (mid 1/3):    dirX=0  (right full),  dirY=1.5(down slow)
//   Segment 3 (bot 1/3):    dirX=0  (right full),  dirY=1  (down med)
//
// Rotated 90° for top-down bottom paddle (ball hits at X relative to centre):
//   Left  1/3 → goes UP-LEFT  (vx=-med, vy=-full)  ← air.js seg1 mapped
//   Mid   1/3 → goes STRAIGHT UP  (vx=0,   vy=-full)  ← air.js seg2 mapped
//   Right 1/3 → goes UP-RIGHT (vx=+med, vy=-full)  ← air.js seg3 mapped
//
// air.js P2 (right vertical CPU paddle, two halves):
//   Upper half: dirX=1.5(left full), dirY=0.5(up)
//   Lower half: dirX=1  (left full)
//
// Rotated 90° for top-down top paddle:
//   Left  half → DOWN-LEFT  (vx=-full, vy=+full)
//   Right half → DOWN-RIGHT (vx=+med,  vy=+full)

function ahAssignPuckAngle(paddle, paddleIdx) {
  // Push puck cleanly out of overlap
  var dx = ahPuck.x - paddle.x, dy = ahPuck.y - paddle.y;
  var d  = Math.sqrt(dx*dx + dy*dy);
  if (d < 0.01) { dx = 0; dy = (paddleIdx === 0 ? -1 : 1); d = 1; }
  var nx = dx/d, ny = dy/d;
  var overlap = (paddle.r + ahPuck.r + 2) - d;
  if (overlap > 0) {
    ahPuck.x += nx*overlap;
    ahPuck.y += ny*overlap;
    // Re-clamp against walls: the push may have moved the puck past the boundary
    ahPuck.x = Math.max(ahPuck.r, Math.min(ahW - ahPuck.r, ahPuck.x));
    ahPuck.y = Math.max(ahPuck.r, Math.min(ahH - ahPuck.r, ahPuck.y));
  }

  var spd = ahGetSpeed();

  // ── Continuous angle based on where the puck strikes the paddle ──
  // relX in [-1, +1]: -1 = far left edge, 0 = centre, +1 = far right edge.
  // Lateral deflection scales linearly with hit position (max 68% of speed at edge).
  var relX = Math.max(-1, Math.min(1, (ahPuck.x - paddle.x) / paddle.r));
  var vx   = relX * spd * 0.68;
  var vy   = Math.sqrt(Math.max(0, spd * spd - vx * vx));

  if (paddleIdx === 0) { ahPuck.vx = vx;  ahPuck.vy = -vy; }  // P1 → always UP
  else                 { ahPuck.vx = vx;  ahPuck.vy = +vy; }  // P2 → always DOWN

  // ── Add 25% of paddle's own momentum (fast smashes travel faster/wider) ──
  ahPuck.vx += paddle.pvx * 0.25;
  var vyBonus = paddle.pvy * 0.25;
  if (paddleIdx === 0) ahPuck.vy = Math.min(-spd * 0.2, ahPuck.vy + vyBonus);
  else                 ahPuck.vy = Math.max(+spd * 0.2, ahPuck.vy + vyBonus);

  // ── Clamp final speed to [0.85×, 1.35×] base speed ──
  var mag = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy);
  if (mag > 0.01) {
    var clamped = Math.max(spd * 0.85, Math.min(spd * 1.35, mag));
    ahPuck.vx = ahPuck.vx / mag * clamped;
    ahPuck.vy = ahPuck.vy / mag * clamped;
  }

  ahAumenta();
  paddle.hitMs = performance.now(); // start 80ms cooldown — blocks rapid re-collision
  ahSpawnImpact(ahPuck.x, ahPuck.y);
  ahRings.push({x:ahPuck.x, y:ahPuck.y, r:paddle.r, life:1});
  ahSnd.paddleHit(spd / 60);
}

// ── Bot puck prediction ────────────────────────────────────────
// Returns the X position where the puck will arrive at targetY,
// accounting for left/right wall bounces.
// movingToward: pass -1 if target is at top (puck must have vy<0 to reach it),
//               pass +1 if target is at bottom (puck must have vy>0 to reach it).
function ahPredictPuckX(targetY, movingToward) {
  // Only predict when puck is actually heading toward the target
  if (movingToward < 0 && ahPuck.vy >= 0) return ahW / 2;
  if (movingToward > 0 && ahPuck.vy <= 0) return ahW / 2;
  var py = ahPuck.y, px = ahPuck.x;
  var vy = ahPuck.vy, vx = ahPuck.vx;
  var dy = Math.abs(py - targetY);
  if (dy <= 0) return px;
  var t = dy / Math.abs(vy);
  var predX = px + vx * t;
  // Fold predicted X to account for wall bounces
  var lo = ahPuck.r, hi = ahW - ahPuck.r, range = hi - lo;
  if (range > 0) {
    predX -= lo;
    predX = predX % (2 * range);
    if (predX < 0) predX += 2 * range;
    if (predX > range) predX = 2 * range - predX;
    predX += lo;
  }
  return Math.max(lo, Math.min(hi, predX));
}

// ── Bot AI ─────────────────────────────────────────────────────
// Behavioural differences per difficulty (not just speed):
//   easy   — tracks puck X but with ±10 % oscillating error
//   medium — tracks puck X directly, retreats to centre when
//            puck is heading away
//   hard   — predicts where the puck will land using wall-bounce
//            math; retreats to centre when puck heading away
function ahMoveBot(dt) {
  if (ahMode !== 'pvb' || ahGoalFreezeMs > 0) return;
  var cfg      = AH_BOT[ahDiff] || AH_BOT.medium;
  var botSpeed = ahGetSpeed() * cfg.factor;          // scales with puck speed
  var step     = botSpeed * (dt / 1000);
  var bot      = ahPaddles[1];
  var cx       = ahW / 2;

  // puck coming toward bot = vy < 0 (moving up toward top goal)
  var puckComing = ahPuck.vy < 0;

  var targetX;
  if (!puckComing) {
    // Puck heading away — hold near centre, ready for return
    targetX = cx;
  } else if (ahDiff === 'easy') {
    // Easy: track puck position + sinusoidal error (≈±8% of table width)
    var err = Math.sin(performance.now() * 0.003) * ahW * 0.08;
    targetX = ahPuck.x + err;
  } else if (ahDiff === 'medium') {
    // Medium: track puck X directly
    targetX = ahPuck.x;
  } else {
    // Hard: predict where the puck crosses the bot's front edge
    targetX = ahPredictPuckX(bot.y + bot.r, -1);
  }

  targetX = Math.max(bot.r, Math.min(ahW - bot.r, targetX));
  var dx = targetX - bot.x;
  if (Math.abs(dx) <= step) {
    bot.x   = targetX;
    bot.pvx = 0;
  } else {
    bot.x  += dx > 0 ? step : -step;
    bot.pvx = (dx > 0 ? 1 : -1) * botSpeed;
  }
  bot.pvy = 0;
  ahClampPaddle(bot, 1);
}

// ── Circle collision detection ─────────────────────────────────
function ahCircleCollide(a, b) {
  var dx = b.x-a.x, dy = b.y-a.y;
  return dx*dx+dy*dy <= (a.r+b.r)*(a.r+b.r);
}

// ── Particle helpers ───────────────────────────────────────────
function ahSpawnImpact(x, y) {
  var colors = ['#00e5ff','#ffffff','#7effff','#b2ebf2'];
  for (var i = 0; i < 12; i++) {
    var a = Math.random()*Math.PI*2, s = (Math.random()*4+1)*60;
    ahParticles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:1, color:colors[Math.floor(Math.random()*colors.length)], size:2+Math.random()*3});
  }
}

function ahSpawnWallSparks(x, y) {
  for (var i = 0; i < 6; i++) {
    var a = Math.random()*Math.PI*2, s = (Math.random()*2.5+0.5)*60;
    ahParticles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.7,color:'#aae8ff',size:1.5});
  }
}

// ── Physics step with sub-stepping to prevent high-speed tunneling ────────
// At max speed (ahInc=20, W=360) the puck moves ~630 px/s.  In a 50 ms frame
// that is ≈31 px — equal to the paddle radius, so the puck can skip through
// the paddle entirely in one step.  Sub-stepping to ≤10 ms keeps the overlap
// test reliable at every speed.
function ahPhysicsStep(dt) {
  var MAX_SUB_MS = 10;
  var steps = Math.max(1, Math.ceil(dt / MAX_SUB_MS));
  var subDt  = dt / steps;
  for (var s = 0; s < steps; s++) {
    if (ahPhysicsSubStep(subDt)) return true;
  }
  return false;
}

function ahPhysicsSubStep(dt) {
  var sec = dt/1000, r = ahPuck.r, gw = ahGoalWidth()/2, cx = ahW/2;

  ahPuck.x += ahPuck.vx * sec;
  ahPuck.y += ahPuck.vy * sec;

  // ── Wall bounces ───────────────────────────────────────────────
  // Each wall check: correct position, flip the relevant component, then
  // re-normalize to ahGetSpeed() so the bounce never alters puck speed.

  var bounced = false;

  if (ahPuck.x - r < 0) {
    ahPuck.x = r;
    ahPuck.vx = Math.abs(ahPuck.vx);
    bounced = true;
    ahSpawnWallSparks(r, ahPuck.y);
  }
  if (ahPuck.x + r > ahW) {
    ahPuck.x = ahW - r;
    ahPuck.vx = -Math.abs(ahPuck.vx);
    bounced = true;
    ahSpawnWallSparks(ahW - r, ahPuck.y);
  }
  if (ahPuck.y - r < 0 && !(ahPuck.x > cx-gw && ahPuck.x < cx+gw)) {
    ahPuck.y = r;
    ahPuck.vy = Math.abs(ahPuck.vy);
    bounced = true;
    ahSpawnWallSparks(ahPuck.x, r);
  }
  if (ahPuck.y + r > ahH && !(ahPuck.x > cx-gw && ahPuck.x < cx+gw)) {
    ahPuck.y = ahH - r;
    ahPuck.vy = -Math.abs(ahPuck.vy);
    bounced = true;
    ahSpawnWallSparks(ahPuck.x, ahH - r);
  }

  if (bounced) {
    // Play wall sound at most once per 80ms across all sub-steps —
    // prevents AudioContext overload when sub-stepping fires multiple bounces.
    var _bNow = performance.now();
    if (_bNow - ahLastWallSoundMs > 80) { ahLastWallSoundMs = _bNow; ahSnd.wallBounce(); }
  }

  // ── Paddle collisions ──────────────────────────────────────────
  // Per-paddle 80ms cooldown stops rapid re-collision (chasing paddle
  // catches the puck again in the next sub-step and rewrites velocity).
  // break after first hit stops both paddles firing the same sub-step.
  var hitThisStep = false;
  var _hitNow = performance.now();
  for (var pi = 0; pi < 2; pi++) {
    if (_hitNow - ahPaddles[pi].hitMs < 80) continue;
    if (ahCircleCollide(ahPaddles[pi], ahPuck)) {
      ahAssignPuckAngle(ahPaddles[pi], pi);
      hitThisStep = true;
      break;
    }
  }

  // Corner escape — skipped when a paddle hit just fired this sub-step.
  // Corner escape is position-based, so without this guard it would
  // immediately overwrite the paddle's assigned velocity while the puck
  // is still physically inside the corner zone.
  if (!hitThisStep) {
    var MIN_CORNER = Math.sin(18 * Math.PI / 180);
    var inLeftWall  = ahPuck.x - r <= r * 1.5;
    var inRightWall = ahPuck.x + r >= ahW - r * 1.5;
    var inTopWall   = ahPuck.y - r <= r * 1.5;
    var inBotWall   = ahPuck.y + r >= ahH - r * 1.5;
    if ((inLeftWall || inRightWall) && (inTopWall || inBotWall)) {
      var curSpd = Math.max(ahGetSpeed(), ahW * 0.5);
      if (Math.abs(ahPuck.vx) < curSpd * MIN_CORNER)
        ahPuck.vx = curSpd * MIN_CORNER * (inRightWall ? -1 : 1);
      if (Math.abs(ahPuck.vy) < curSpd * MIN_CORNER)
        ahPuck.vy = curSpd * MIN_CORNER * (inBotWall ? -1 : 1);
      var cm = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy);
      if (cm > 0.01) { ahPuck.vx = ahPuck.vx/cm*curSpd; ahPuck.vy = ahPuck.vy/cm*curSpd; }
    }
  }

  // ── Goals (ball fully past end line inside goal zone) ──
  // P1 scores: puck into P2's goal at top
  if (ahPuck.y - r < 0 && ahPuck.x > cx-gw && ahPuck.x < cx+gw) {
    ahP1Score++;
    ahSnd.goal(true);
    ahUpdateScoreUI();
    ahShowGoalFlash(0);
    if (ahP1Score >= ahWinScore) { ahGameOver(0); return true; }
    ahInc = 0;                  // air.js: reset inc after a goal
    ahResetPositions(1);
    return true;
  }
  // P2 scores: puck into P1's goal at bottom
  if (ahPuck.y + r > ahH && ahPuck.x > cx-gw && ahPuck.x < cx+gw) {
    ahP2Score++;
    ahSnd.goal(false);
    ahUpdateScoreUI();
    ahShowGoalFlash(1);
    if (ahP2Score >= ahWinScore) { ahGameOver(1); return true; }
    ahInc = 0;                  // air.js: reset inc after a goal
    ahResetPositions(0);
    return true;
  }

  return false;
}

// ── Score UI ───────────────────────────────────────────────────
function ahUpdateScoreUI() {
  var e1=document.getElementById('ah-p1-val'), e2=document.getElementById('ah-p2-val');
  if (e1) e1.textContent=ahP1Score;
  if (e2) e2.textContent=ahP2Score;
  ahUpdatePips('ah-p1-pips', ahP1Score, ahWinScore, '#00e5ff');
  ahUpdatePips('ah-p2-pips', ahP2Score, ahWinScore, '#ff4081');
}

function ahUpdatePips(id, score, total, color) {
  var el=document.getElementById(id); if (!el) return;
  el.innerHTML='';
  var show=Math.min(total,10);
  for (var i=0; i<show; i++) {
    var pip=document.createElement('div');
    pip.className='ah-pip'+(i<score?' ah-pip--on':'');
    pip.style.setProperty('--pip-color',color);
    el.appendChild(pip);
  }
}

function ahShowGoalFlash(who) {
  var el=document.getElementById('ah-goal-flash'); if (!el) return;
  el.className='ah-goal-flash ah-goal-flash--'+(who===0?'p1':'p2');
  el.textContent='⚡ GOAL!';
  el.style.display='flex';
  clearTimeout(el._t);
  el._t=setTimeout(function(){ el.style.display='none'; }, 1100);
}

function ahGameOver(winner) {
  ahStopLoop();
  ahMatchCount++;
  var label = winner===0 ? 'PLAYER 1' : (ahMode==='pvb' ? 'BOT' : 'PLAYER 2');
  var color = winner===0 ? '#00e5ff'   : (ahMode==='pvb' ? '#ff4081' : '#ff9100');
  if (winner===0) ahSnd.win(); else ahSnd.lose();
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
    if (window.DZShare) DZShare.setResult({ game:'Air Hockey', slug:'air-hockey', winner:label+' WINS!', detail:'Final: '+ahP1Score+' \u2013 '+ahP2Score, accent:'#2979ff', icon:'🏒' });
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
  var dt = ahLastTime===0 ? 16 : Math.min(ts - ahLastTime, 50);
  ahLastTime = ts;
  // Also honour the global DZ menu pause (set by the hamburger menu)
  if (ahPaused || window.DZ_PAUSED) { ahDraw(); ahRAF=requestAnimationFrame(ahLoop); return; }

  ahMoveBot(dt);

  // Goal freeze: paddles can still move, puck is held at centre
  if (ahGoalFreezeMs > 0) {
    ahGoalFreezeMs -= dt;
    ahClampPaddle(ahPaddles[0], 0);
    ahClampPaddle(ahPaddles[1], 1);
    if (ahGoalFreezeMs <= 0) {
      ahGoalFreezeMs = 0;
      if (ahPuck.vServe) {
        ahPuck.vx = ahPuck.vServe.vx;
        ahPuck.vy = ahPuck.vServe.vy;
        ahPuck.vServe = null;
        ahSnd.puckStart();
      }
    }
    ahDraw(); ahRAF=requestAnimationFrame(ahLoop); return;
  }

  // Keyboard P1 (WASD)
  var kSpd  = ahGetSpeed() * 0.9;
  var kStep = kSpd * (dt/1000);
  var p0 = ahPaddles[0];
  if (p0.key.up) { p0.pvy=-kSpd; p0.y-=kStep; } else if (p0.key.dn) { p0.pvy=kSpd; p0.y+=kStep; } else p0.pvy=0;
  if (p0.key.lt) { p0.pvx=-kSpd; p0.x-=kStep; } else if (p0.key.rt) { p0.pvx=kSpd; p0.x+=kStep; } else p0.pvx=0;
  ahClampPaddle(p0, 0);

  // Keyboard P2 (Arrow / IJKL) — PvP only
  if (ahMode==='pvp') {
    var p1=ahPaddles[1];
    if (p1.key.up) { p1.pvy=-kSpd; p1.y-=kStep; } else if (p1.key.dn) { p1.pvy=kSpd; p1.y+=kStep; } else p1.pvy=0;
    if (p1.key.lt) { p1.pvx=-kSpd; p1.x-=kStep; } else if (p1.key.rt) { p1.pvx=kSpd; p1.x+=kStep; } else p1.pvx=0;
    ahClampPaddle(p1, 1);
  }

  var goalScored = ahPhysicsStep(dt);

  // ── Stuck puck rescue ─────────────────────────────────────────
  // Only fires when the puck has genuinely lost speed (two paddles
  // colliding, serve glitch, etc.).  Corner oscillation is already
  // handled by the corner-escape in the wall-bounce code above.
  var puckSpd = Math.sqrt(ahPuck.vx*ahPuck.vx + ahPuck.vy*ahPuck.vy);
  var nearZero = puckSpd < 40 * (ahW/400);

  if (nearZero) {
    ahStuckTimer += dt;
    if (ahStuckTimer > 900) {
      ahStuckTimer = 0;
      var rescueDir   = ahPuck.y < ahH/2 ? 1 : -1;
      var rescueAngle = (Math.random()-0.5) * (Math.PI/4);
      var rspd = ahGetSpeed();
      ahPuck.vx = Math.sin(rescueAngle) * rspd;
      ahPuck.vy = rescueDir * Math.cos(rescueAngle) * rspd;
      ahSnd.puckStart();
    }
  } else {
    ahStuckTimer = 0;
  }

  if (!goalScored) {
    // Trail
    ahTrail.push({x:ahPuck.x, y:ahPuck.y});
    var maxTrail = Math.max(8, Math.round(350 / Math.max(dt, 8)));
    if (ahTrail.length > maxTrail) ahTrail.shift();

    // Speed lines
    if (puckSpd > ahW*1.5 && Math.random() < 0.4) {
      var angle = Math.atan2(ahPuck.vy, ahPuck.vx) + Math.PI;
      ahSpeedLines.push({x:ahPuck.x,y:ahPuck.y,
        angle:angle+(Math.random()-0.5)*0.5, len:8+Math.random()*20, life:1});
    }
    var slDecay = 9.0*(dt/1000);
    for (var i=ahSpeedLines.length-1; i>=0; i--) {
      ahSpeedLines[i].life-=slDecay;
      if (ahSpeedLines[i].life<=0) ahSpeedLines.splice(i,1);
    }

    // Particles
    var pDecay=2.2*(dt/1000), drag=Math.pow(0.88,dt/1000*60);
    for (var i=ahParticles.length-1; i>=0; i--) {
      var p=ahParticles[i];
      p.x+=p.vx*(dt/1000); p.y+=p.vy*(dt/1000);
      p.life-=pDecay; p.vx*=drag; p.vy*=drag;
      if (p.life<=0) ahParticles.splice(i,1);
    }

    // Rings
    var rGrow=180*(dt/1000), rDecay=5.0*(dt/1000);
    for (var i=ahRings.length-1; i>=0; i--) {
      ahRings[i].r+=rGrow; ahRings[i].life-=rDecay;
      if (ahRings[i].life<=0) ahRings.splice(i,1);
    }
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
  ctx.stroke(); ctx.restore();

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
  for (var i=0; i<ahSpeedLines.length; i++) {
    var sl=ahSpeedLines[i];
    ctx.globalAlpha=sl.life*0.6; ctx.strokeStyle='rgba(120,220,255,0.8)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sl.x,sl.y);
    ctx.lineTo(sl.x+Math.cos(sl.angle)*sl.len, sl.y+Math.sin(sl.angle)*sl.len);
    ctx.stroke();
  }
  ctx.restore();

  // Trail
  ctx.save();
  for (var i=0; i<ahTrail.length; i++) {
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
  for (var i=0; i<ahRings.length; i++) {
    var ring=ahRings[i];
    ctx.globalAlpha=ring.life*0.6; ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2*ring.life;
    ctx.shadowColor='#00e5ff'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // Paddles
  var pColors=['#00e5ff', ahMode==='pvb'?'#ff4081':'#ff9100'];
  var pDark  =['#003344', ahMode==='pvb'?'#440022':'#442200'];
  var pGlow  =['rgba(0,229,255,0.9)', ahMode==='pvb'?'rgba(255,64,129,0.9)':'rgba(255,145,0,0.9)'];
  var pLabels=['1', ahMode==='pvb'?'🤖':'2'];
  for (var pi=0; pi<2; pi++) {
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
  for (var i=0; i<ahParticles.length; i++) {
    var p=ahParticles[i]; ctx.globalAlpha=p.life;
    ctx.shadowColor=p.color; ctx.shadowBlur=8; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Serve hint (fades in during freeze)
  if (ahGoalFreezeMs > 250) {
    var servingP1 = ahServeWho === 0;
    ctx.save();
    ctx.globalAlpha=Math.min(1,(ahGoalFreezeMs-250)/350);
    ctx.font='bold '+Math.round(W*0.042)+'px Orbitron,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.shadowColor='#00e5ff'; ctx.shadowBlur=16;
    var p2Label = ahMode==='pvb' ? '\u25bc BOT SERVE' : '\u25bc P2 SERVE';
    ctx.fillText(servingP1 ? '\u25b2 YOUR SERVE' : p2Label,
                 W/2, servingP1 ? H*0.73 : H*0.27);
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

// ── Touch / Pointer ────────────────────────────────────────────
(function(){
  var active={}, prevPos={}, prevTime={};
  function setup() {
    var canvas=document.getElementById('ah-canvas'); if (!canvas) return;
    function getScaled(e) {
      var rect=canvas.getBoundingClientRect();
      return {x:(e.clientX-rect.left)*(ahW/rect.width), y:(e.clientY-rect.top)*(ahH/rect.height)};
    }
    canvas.addEventListener('pointerdown',function(e){
      e.preventDefault();
      var s=getScaled(e);
      var pi=s.y>ahH/2 ? 0 : (ahMode==='pvp' ? 1 : -1);
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
      delete active[e.pointerId]; delete prevPos[e.pointerId]; delete prevTime[e.pointerId];
    }
    canvas.addEventListener('pointerup',onEnd);
    canvas.addEventListener('pointercancel',onEnd);
  }
  setup();
})();

// ── Keyboard ───────────────────────────────────────────────────
(function(){
  var keyMap={
    'KeyW':{p:0,dir:'up'},'ArrowUp':{p:1,dir:'up'},
    'KeyS':{p:0,dir:'dn'},'ArrowDown':{p:1,dir:'dn'},
    'KeyA':{p:0,dir:'lt'},'ArrowLeft':{p:1,dir:'lt'},
    'KeyD':{p:0,dir:'rt'},'ArrowRight':{p:1,dir:'rt'},
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
  function q(id){ return document.getElementById(id); }
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
  // freshBtn: clone-replaces an element, stripping ALL existing listeners
  // (including ones script.js added at parse time) so exactly ONE handler fires.
  function freshBtn(id) {
    var el = q(id); if (!el) return null;
    var clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }
  var mb = freshBtn('ah-main-back');
  if (mb) mb.addEventListener('click', function(){ if(typeof showHub==='function') showHub(); });
  var bb = freshBtn('ah-back-to-home');
  if (bb) bb.addEventListener('click', function(){ if(typeof showAH==='function') showAH(); });
  var sb = freshBtn('ah-hp-start');
  if (sb) sb.addEventListener('click', startAHGame);
  var pb = freshBtn('ah-pause-btn');
  if (pb) pb.addEventListener('click', function(){
    ahPaused=!ahPaused; this.textContent=ahPaused?'▶':'⏸'; ahSnd.click();
  });
})();

function startAHGame() {
  // 1. Kill any running loop — prevents orphaned RAF handles stacking on restart.
  ahStopLoop();

  ahMode=ahHPMode; ahDiff=ahHPDiff; ahWinScore=ahHPWinScore;
  var homeEl=document.getElementById('ah-home'), playEl=document.getElementById('ah-play-panel');
  if (homeEl) homeEl.classList.add('hidden');
  if (playEl) playEl.classList.remove('hidden');
  var p2l=document.getElementById('ah-p2-label');
  if (p2l) p2l.textContent=ahMode==='pvb'?'BOT':'P2';
  var ol=document.getElementById('ah-overlay-msg');
  if (ol){ ol.style.display='none'; ol.className='ah-overlay-msg hidden'; }
  var gf=document.getElementById('ah-goal-flash'); if (gf) gf.style.display='none';

  // 2. Clear BOTH pause flags unconditionally before the loop starts.
  //    DZ_PAUSED can be left true by: orientation handler (landscape+hub at load),
  //    previous menu open, or game switching. Any truthy value freezes ahLoop.
  ahPaused = false;
  window.DZ_PAUSED = false;

  // 3. Re-wire pause button fresh — strips any stale extra listener.
  var pb = document.getElementById('ah-pause-btn');
  if (pb) {
    pb.textContent = '⏸';
    var pbNew = pb.cloneNode(true);
    pb.parentNode.replaceChild(pbNew, pb);
    pbNew.addEventListener('click', function(){
      ahPaused = !ahPaused;
      this.textContent = ahPaused ? '▶' : '⏸';
      ahSnd.click();
    });
  }

  ahInit();
  ahRunning=true; ahLastTime=0;
  ahRAF=requestAnimationFrame(ahLoop);
  ahUpdatePips('ah-p1-pips', 0, ahWinScore, '#00e5ff');
  ahUpdatePips('ah-p2-pips', 0, ahWinScore, '#ff4081');
  ahSnd.puckStart();
}

// Register with the global DZ pause system so the hamburger menu
// can pause / resume the game just like any other DuelZone game.
(function() {
  var _prev = window.dzPauseAllGames;
  window.dzPauseAllGames = function() {
    if (typeof _prev === 'function') _prev();
    if (ahRunning) {
      ahPaused = true;
      var pb = document.getElementById('ah-pause-btn');
      if (pb) pb.textContent = '▶';
    }
  };
})();
