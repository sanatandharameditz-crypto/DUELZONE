// ═══════════════════════════════════════════════════════════════
// spacedodge.js — SPACE DODGE: Enhanced Edition
// New: Laser shooting · Danger arrows · Wave system · Nuke &
//      Timewarp powerups · Floating damage numbers · Meteor HP ·
//      Kill counter · Low-HP sparks · Nebula BG · Better FX
//
// Controls:
//   P1: W/A/D = thrust/turn  |  SPACE = boost  |  F = fire laser
//   P2: Arrows = thrust/turn |  Shift = boost  |  Enter/P = fire
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CONFIG
  // ─────────────────────────────────────────────────────────────
  var CFG = {
    W: 800, H: 600,

    ARENA_R:      { small: 220, medium: 270, large: 340 },
    SHRINK_DELAY: 15,
    SHRINK_RATE:  0.48,
    ARENA_MIN:    80,
    BOUNDARY_DMG: 18,

    SHIP_HP:    120,
    SHIP_R:     13,
    THRUST:     480,        // ↑ faster normal acceleration
    MAX_SPD:    380,        // ↑ higher normal top speed
    ROT_SPD:    3.8,        // slightly snappier turning
    FRICTION:   0.87,
    BOOST_FORCE:1400,       // massive burst force for nitro
    BOOST_MAX:  1140,       // 3× normal max speed (380×3) during nitro
    BOOST_DUR:  0.38,       // slightly longer nitro window
    BOOST_CD:   2.8,
    RAM_DMG:    22,

    // Lasers
    LASER_RATE:  0.26,   // cooldown seconds between shots
    LASER_SPD:   580,
    LASER_LEN:   18,
    LASER_DMG_SHIP:  28,
    LASER_DMG_ROCK:  55,  // damage dealt to meteor hp
    LASER_RANGE: 420,     // max travel distance

    // Meteors
    M_BASE: 1.0,
    M_RAMP: 0.012,
    M_MAX:  5.8,
    M_TYPES: [
      { prob:0.48, r:7,  spd:190, dmg:12, hp:1, color:'#cc6633', glow:'#ff8844', name:'small'   },
      { prob:0.28, r:13, spd:118, dmg:24, hp:2, color:'#aa4422', glow:'#dd6633', name:'medium'  },
      { prob:0.14, r:22, spd:70,  dmg:40, hp:3, color:'#882211', glow:'#cc3322', name:'large'   },
      { prob:0.10, r:10, spd:148, dmg:16, hp:1, color:'#dd8800', glow:'#ffcc00', name:'cluster' }
    ],
    CLUSTER_N: 3,

    // Powerups
    PU_RATE: 0.22,
    PU_DUR:  6.5,
    PU_R:    14,

    // Waves — every WAVE_INTERVAL seconds a bonus wave erupts
    WAVE_INTERVAL: 22,
    WAVE_COUNT:    8,

    AI: {
      easy:   { react:560, evade:0.38, horizon:180, spdFac:0.68, boostP:0.12, risk:0.65, fireP:0.25 },
      medium: { react:200, evade:0.75, horizon:420, spdFac:0.90, boostP:0.44, risk:0.38, fireP:0.55 },
      hard:   { react:8,   evade:0.999, horizon:1200, spdFac:1.00, boostP:0.95, risk:0.02, fireP:0.98 }
    }
  };

  var PARTICLE_HIT     = 8;
  var PARTICLE_EXPLODE = 40;

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  var canvas, ctx;
  var animId   = null;
  var lastTime = 0;
  var gameTime = 0;
  var isPvP    = false;
  var isPaused = false;
  var isOver   = false;
  var inCD     = true;
  var cdNum    = 3;
  var cdTimer  = 0;
  var arenaSize = 'medium';
  var aiDiff    = 'medium';

  var arena = { cx:400, cy:300, r:270 };
  var stars      = [];
  var nebulaBlobs= [];
  var meteors    = [];
  var particles  = [];
  var powerups   = [];
  var lasers     = [];
  var dmgNums    = [];   // floating damage numbers
  var blackHoles = [];   // black hole objects
  var ships      = [];

  var meteorTimer  = 0;
  var powerupTimer = 0;
  var waveTimer    = 0;
  var waveCount    = 0;
  var shakeX = 0, shakeY = 0, shakeTimer = 0, shakeMag = 0;
  var shrinkOn = false;
  var pulse    = 0;
  var timeWarp = 0;     // > 0 → meteors + bullets move slower

  // Wave announcement
  var waveBanner = { text:'', alpha:0, scale:1.4 };

  // AI state
  var aiState = { timer:0, wander:0, turn:0, thrust:false, boost:false, fire:false };

  // Input
  var keys = {};
  var joy1  = { active:false, id:-1, sx:0, sy:0, dx:0, dy:0 };
  var joy2  = { active:false, id:-1, sx:0, sy:0, dx:0, dy:0 };
  var bst1  = false;
  var bst2  = false;
  var fir1  = false;  // fire touch flag p1
  var fir2  = false;  // fire touch flag p2

  // DOM refs
  var domCanvas, domHome, domPlay, domResult, domPause;
  var domP1Hp, domP2Hp, domP1Fill, domP2Fill, domTimer;
  var domP1Pu, domP2Pu;

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  window.sdStopGame = function () {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup',   onKeyUp);
    window.removeEventListener('resize', resizeCanvas);
    detachTouch();
  };

  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────
  function init() {
    domCanvas = document.getElementById('sd-canvas');
    ctx       = domCanvas ? domCanvas.getContext('2d') : null;
    domHome   = document.getElementById('sd-home');
    domPlay   = document.getElementById('sd-play-panel');
    domResult = document.getElementById('sd-result');
    domPause  = document.getElementById('sd-pause-overlay');
    domP1Hp   = document.getElementById('sd-p1-hp');
    domP2Hp   = document.getElementById('sd-p2-hp');
    domP1Fill = document.getElementById('sd-p1-hp-fill');
    domP2Fill = document.getElementById('sd-p2-hp-fill');
    domTimer  = document.getElementById('sd-timer');
    domP1Pu   = document.getElementById('sd-p1-powerup');
    domP2Pu   = document.getElementById('sd-p2-powerup');
    wireUI();
  }

  // ─────────────────────────────────────────────────────────────
  // UI WIRING
  // ─────────────────────────────────────────────────────────────
  function wireUI() {
    qs('.sd-diff-btn',  function(b){ b.addEventListener('click', function(){
      qa('.sd-diff-btn', function(x){ x.classList.remove('active'); });
      b.classList.add('active'); aiDiff = b.getAttribute('data-diff');
    }); });
    qs('.sd-arena-btn', function(b){ b.addEventListener('click', function(){
      qa('.sd-arena-btn', function(x){ x.classList.remove('active'); });
      b.classList.add('active'); arenaSize = b.getAttribute('data-size');
    }); });
    on('sd-back-hub',   function(){ if (typeof showHub === 'function') showHub(); });
    on('sd-start-pvp',  function(){ startGame(true);  });
    on('sd-start-bot',  function(){ startGame(false); });
    on('sd-back-setup', goSetup);
    on('sd-pause-btn',  togglePause);
    on('sd-resume-btn', togglePause);
    on('sd-play-again', function(){ startGame(isPvP); });
    on('sd-to-setup',   goSetup);
  }

  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  function qs(sel, fn) { document.querySelectorAll(sel).forEach(fn); }
  function qa(sel, fn) { document.querySelectorAll(sel).forEach(fn); }
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  function goSetup() {
    sdStopGame();
    hide(domResult); hide(domPause); hide(domPlay);
    show(domHome);
  }

  // ─────────────────────────────────────────────────────────────
  // START GAME
  // ─────────────────────────────────────────────────────────────
  function startGame(pvp) {
    isPvP    = pvp;
    isOver   = false;
    isPaused = false;
    inCD     = true;
    cdNum    = 3;
    cdTimer  = 0;
    gameTime = 0;
    shrinkOn = false;
    pulse    = 0;
    timeWarp = 0;
    meteors  = []; particles = []; powerups = []; lasers = []; dmgNums = []; blackHoles = [];
    meteorTimer = 0; powerupTimer = 0; waveTimer = 0; waveCount = 0;
    shakeX = 0; shakeY = 0; shakeTimer = 0;
    waveBanner.alpha = 0;

    sdStopGame();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    arena.cx = CFG.W / 2;
    arena.cy = CFG.H / 2;
    arena.r  = CFG.ARENA_R[arenaSize] || 270;

    var offset = arena.r * 0.44;
    ships = [
      makeShip(0, arena.cx - offset, arena.cy, '#00e5ff', '#002233', 'P1'),
      makeShip(1, arena.cx + offset, arena.cy, '#ff3d71', '#330015', isPvP ? 'P2' : 'BOT')
    ];
    ships[0].angle = 0;
    ships[1].angle = Math.PI;

    genStars();
    genNebula();

    aiState.timer  = 0;
    aiState.wander = Math.random() * Math.PI * 2;

    keys = {};
    joy1  = { active:false, id:-1, sx:0, sy:0, dx:0, dy:0 };
    joy2  = { active:false, id:-1, sx:0, sy:0, dx:0, dy:0 };
    bst1 = false; bst2 = false; fir1 = false; fir2 = false;

    hide(domResult); hide(domPause);
    hide(domHome);
    show(domPlay);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    attachTouch();

    lastTime = performance.now();
    animId   = requestAnimationFrame(gameLoop);
  }

  // ─────────────────────────────────────────────────────────────
  // CANVAS RESIZE
  // ─────────────────────────────────────────────────────────────
  function resizeCanvas() {
    if (!domCanvas) return;
    var maxW = Math.min(window.innerWidth - 8, CFG.W);
    var sc   = maxW / CFG.W;
    domCanvas.width  = CFG.W;
    domCanvas.height = CFG.H;
    domCanvas.style.width  = Math.round(CFG.W * sc) + 'px';
    domCanvas.style.height = Math.round(CFG.H * sc) + 'px';
  }

  // ─────────────────────────────────────────────────────────────
  // STARS (multi-layer parallax)
  // ─────────────────────────────────────────────────────────────
  function genStars() {
    stars = [];
    for (var i = 0; i < 160; i++) {
      var layer = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? 1 : 2);
      stars.push({
        x: Math.random() * CFG.W,
        y: Math.random() * CFG.H,
        r: layer === 0 ? 0.4 + Math.random()*0.6
         : layer === 1 ? 0.8 + Math.random()*0.9
         : 1.2 + Math.random()*1.5,
        a: 0.15 + Math.random()*0.6,
        tw: Math.random() * Math.PI * 2,
        twSpd: 0.003 + Math.random()*0.018,
        layer: layer,
        col: Math.random() < 0.08 ? '#aaddff'
           : Math.random() < 0.05 ? '#ffddaa'
           : '#ffffff'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // NEBULA blobs (static decorative background wisps)
  // ─────────────────────────────────────────────────────────────
  function genNebula() {
    nebulaBlobs = [];
    var cols = ['rgba(80,0,160,', 'rgba(0,50,130,', 'rgba(120,0,80,', 'rgba(0,100,100,'];
    for (var i = 0; i < 7; i++) {
      nebulaBlobs.push({
        x: Math.random() * CFG.W,
        y: Math.random() * CFG.H,
        rx: 80 + Math.random()*140,
        ry: 60 + Math.random()*100,
        rot: Math.random()*Math.PI,
        col: cols[Math.floor(Math.random()*cols.length)],
        a: 0.04 + Math.random()*0.06
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SHIP FACTORY
  // ─────────────────────────────────────────────────────────────
  function makeShip(idx, x, y, col, col2, label) {
    return {
      idx:idx, x:x, y:y, vx:0, vy:0, angle:0,
      hp:CFG.SHIP_HP, col:col, col2:col2, label:label,
      boostTimer:0, boostCd:0, isBoosting:false,
      shield:0, speedUp:0, invincible:0, laserCharge:0,
      dead:false, trail:[], flash:0,
      fireCd:0,    // laser fire cooldown
      kills:0,     // meteor kills
      sparkTimer:0 // low-hp sparks
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GAME LOOP
  // ─────────────────────────────────────────────────────────────
  function gameLoop(now) {
    var rawDt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime  = now;
    var dt    = timeWarp > 0 ? rawDt * 0.32 : rawDt;   // time warp effect

    if (!isPaused && !isOver) {
      if (inCD) { tickCountdown(rawDt); }
      else      { gameTime += rawDt; update(dt, rawDt); }
    }

    render();
    if (!isOver) animId = requestAnimationFrame(gameLoop);
  }

  // ─────────────────────────────────────────────────────────────
  // COUNTDOWN
  // ─────────────────────────────────────────────────────────────
  function tickCountdown(dt) {
    cdTimer += dt;
    if (cdTimer >= 0.85) {
      cdTimer = 0;
      cdNum > 0 ? cdNum-- : (inCD = false, cdNum = -1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────
  function update(dt, rawDt) {
    pulse    += dt * 1.4;
    shrinkOn  = gameTime > CFG.SHRINK_DELAY;
    if (timeWarp > 0) timeWarp -= rawDt;

    // Shrink arena
    if (shrinkOn && arena.r > CFG.ARENA_MIN) {
      arena.r -= CFG.SHRINK_RATE * rawDt;
      if (arena.r < CFG.ARENA_MIN) arena.r = CFG.ARENA_MIN;
    }

    // Meteor spawning
    var spawnRate = Math.min(CFG.M_BASE + CFG.M_RAMP * gameTime, CFG.M_MAX);
    meteorTimer += dt;
    while (meteorTimer >= 1 / spawnRate) {
      meteorTimer -= 1 / spawnRate;
      spawnMeteor();
    }

    // Powerup spawning
    powerupTimer += rawDt;
    if (powerupTimer >= 1 / CFG.PU_RATE) {
      powerupTimer = 0;
      if (Math.random() < 0.65) spawnPowerup();
    }

    // Wave system
    waveTimer += rawDt;
    if (waveTimer >= CFG.WAVE_INTERVAL) {
      waveTimer = 0;
      waveCount++;
      triggerWave(waveCount);
    }

    // Wave banner fade
    if (waveBanner.alpha > 0) {
      waveBanner.alpha -= rawDt * 1.1;
      waveBanner.scale  = Math.max(1.0, waveBanner.scale - rawDt * 2.5);
    }

    // Screen shake
    if (shakeTimer > 0) {
      shakeTimer -= rawDt;
      var sm = shakeMag * (shakeTimer / (shakeMag * 0.05 + 0.001)) * 0.02;
      shakeX = (Math.random() - 0.5) * sm * 5;
      shakeY = (Math.random() - 0.5) * sm * 5;
    } else { shakeX = 0; shakeY = 0; }

    // Ships
    updateShip(ships[0], dt, rawDt, false);
    updateShip(ships[1], dt, rawDt, !isPvP);

    // Lasers
    var lIdx = lasers.length;
    while (lIdx--) {
      var l = lasers[lIdx];
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.dist += Math.sqrt(l.vx*l.vx + l.vy*l.vy) * dt;
      var lDead = l.dist > CFG.LASER_RANGE || l.x < -20 || l.x > CFG.W+20 || l.y < -20 || l.y > CFG.H+20;

      if (!lDead) {
        // Hit meteor?
        var mHit = false;
        for (var mi = meteors.length-1; mi >= 0 && !mHit; mi--) {
          var mr = meteors[mi];
          var ldx = l.x - mr.x, ldy = l.y - mr.y;
          if (ldx*ldx + ldy*ldy < (mr.r + 4) * (mr.r + 4)) {
            mr.hp -= 1;
            ships[l.owner].kills++;
            spawnParts(l.x, l.y, 5, mr.glow || mr.color);
            if (mr.hp <= 0) {
              spawnParts(mr.x, mr.y, PARTICLE_HIT + Math.floor(mr.r/4), mr.color);
              spawnParts(mr.x, mr.y, 4, '#ffffff');
              if (mr.name === 'cluster') clusterBurst(mr);
              addDmgNum(mr.x, mr.y, '💥', '#ffaa44');
              meteors.splice(mi, 1);
              doShake(4, 0.12);
            } else {
              addDmgNum(mr.x, mr.y, ''+Math.round(CFG.LASER_DMG_ROCK)+'', mr.glow || '#ffaa44');
            }
            lDead = mHit = true;
          }
        }

        // Hit enemy ship (PvP)?
        if (!mHit && isPvP) {
          var enemy = ships[1 - l.owner];
          if (enemy && !enemy.dead && enemy.invincible <= 0) {
            var edx = l.x - enemy.x, edy = l.y - enemy.y;
            if (edx*edx + edy*edy < (CFG.SHIP_R + 5) * (CFG.SHIP_R + 5)) {
              if (enemy.shield <= 0) {
                hurtShip(enemy, CFG.LASER_DMG_SHIP);
                addDmgNum(enemy.x, enemy.y - 18, '-'+Math.round(CFG.LASER_DMG_SHIP), '#ff4444');
              } else {
                spawnParts(enemy.x, enemy.y, 5, '#44ffff');
                addDmgNum(enemy.x, enemy.y - 18, 'SHIELDED', '#44ffff');
              }
              doShake(5, 0.14);
              lDead = true;
            }
          }
        }
      }

      if (lDead) lasers.splice(lIdx, 1);
    }

    // Meteors + ship collision
    var mIdx = meteors.length;
    while (mIdx--) {
      var m = meteors[mIdx];
      m.x    += m.vx * dt;
      m.y    += m.vy * dt;
      m.spin += m.spinRate * dt;
      m.life -= rawDt;

      if (m.x < -110 || m.x > CFG.W+110 || m.y < -110 || m.y > CFG.H+110 || m.life <= 0) {
        meteors.splice(mIdx, 1); continue;
      }

      var mHitShip = false;
      for (var sIdx = 0; sIdx < 2 && !mHitShip; sIdx++) {
        var ship = ships[sIdx];
        if (ship.dead || ship.invincible > 0) continue;
        var mdx = ship.x - m.x, mdy = ship.y - m.y;
        if (mdx*mdx + mdy*mdy < (CFG.SHIP_R + m.r) * (CFG.SHIP_R + m.r)) {
          if (ship.shield <= 0) {
            hurtShip(ship, m.dmg);
            addDmgNum(ship.x, ship.y - 20, '-'+m.dmg, '#ff4444');
          } else {
            spawnParts(m.x, m.y, 6, '#44ffff');
            addDmgNum(ship.x, ship.y - 20, 'BLOCKED', '#44ffff');
          }
          spawnParts(m.x, m.y, PARTICLE_HIT, m.color);
          if (m.name === 'cluster') clusterBurst(m);
          meteors.splice(mIdx, 1);
          doShake(6, 0.20);
          mHitShip = true;
        }
      }
    }

    // Powerups + ship
    var puIdx = powerups.length;
    while (puIdx--) {
      var pu = powerups[puIdx];
      pu.life  -= rawDt;
      pu.pulse += rawDt;
      if (pu.life <= 0) { powerups.splice(puIdx, 1); continue; }
      for (var psi = 0; psi < 2; psi++) {
        var ps = ships[psi];
        if (ps.dead) continue;
        var pdx = ps.x - pu.x, pdy = ps.y - pu.y;
        if (pdx*pdx + pdy*pdy < (CFG.SHIP_R + CFG.PU_R) * (CFG.SHIP_R + CFG.PU_R)) {
          applyPU(ps, pu.kind);
          spawnParts(pu.x, pu.y, 14, PU_COLORS[pu.kind] || '#ffffff');
          spawnParts(pu.x, pu.y, 6, '#ffffff');
          addDmgNum(pu.x, pu.y - 16, PU_LABELS[pu.kind] || '★', PU_COLORS[pu.kind] || '#fff');
          powerups.splice(puIdx, 1);
          doShake(3, 0.10);
          break;
        }
      }
    }

    // Ship vs ship ram
    var s0 = ships[0], s1 = ships[1];
    if (!s0.dead && !s1.dead) {
      var rdx = s0.x - s1.x, rdy = s0.y - s1.y;
      var rd2 = rdx*rdx + rdy*rdy;
      var md2 = (CFG.SHIP_R * 2.1) * (CFG.SHIP_R * 2.1);
      if (rd2 < md2 && rd2 > 0.01) {
        var rd  = Math.sqrt(rd2);
        var rnx = rdx/rd, rny = rdy/rd;
        if (s0.shield <= 0) { hurtShip(s0, CFG.RAM_DMG); addDmgNum(s0.x, s0.y-18, '-'+CFG.RAM_DMG, '#ff4444'); }
        if (s1.shield <= 0) { hurtShip(s1, CFG.RAM_DMG); addDmgNum(s1.x, s1.y-18, '-'+CFG.RAM_DMG, '#ff4444'); }
        s0.vx += rnx * 240; s0.vy += rny * 240;
        s1.vx -= rnx * 240; s1.vy -= rny * 240;
        s0.invincible = 0.45; s1.invincible = 0.45;
        doShake(10, 0.28);
      }
    }

    // Particles
    var pIdx = particles.length;
    while (pIdx--) {
      var p = particles[pIdx];
      p.x    += p.vx * dt; p.y += p.vy * dt;
      p.vx   *= 0.91;      p.vy *= 0.91;
      p.life -= rawDt;
      if (p.life <= 0) particles.splice(pIdx, 1);
    }

    // Floating damage numbers
    var dIdx = dmgNums.length;
    while (dIdx--) {
      var dn = dmgNums[dIdx];
      dn.y    -= 38 * rawDt;
      dn.life -= rawDt;
      if (dn.life <= 0) dmgNums.splice(dIdx, 1);
    }

    // Black holes — grow, suck meteors, then collapse
    var bhIdx = blackHoles.length;
    while (bhIdx--) {
      var bh = blackHoles[bhIdx];
      bh.life -= rawDt;
      // Grow to maxR in first 30% of life, hold, then collapse
      var lifeRatio = bh.life / bh.maxLife;
      if (lifeRatio > 0.70) {
        bh.r = bh.maxR * (1 - lifeRatio) / 0.30;   // growing
      } else if (lifeRatio > 0.15) {
        bh.r = bh.maxR;                              // full size
      } else {
        bh.r = bh.maxR * (lifeRatio / 0.15);        // collapsing
      }

      // Pull nearby meteors toward black hole centre
      for (var bmi = meteors.length-1; bmi >= 0; bmi--) {
        var bm = meteors[bmi];
        var bdx2 = bh.x - bm.x, bdy2 = bh.y - bm.y;
        var bd2  = Math.sqrt(bdx2*bdx2 + bdy2*bdy2) || 1;
        // Strong gravity pull
        var pullF = Math.min(800 / bd2, 320);
        bm.vx += (bdx2/bd2) * pullF * rawDt;
        bm.vy += (bdy2/bd2) * pullF * rawDt;
        // Destroy if sucked in
        if (bd2 < bh.r * 0.55) {
          spawnParts(bm.x, bm.y, 6, '#aa44ff');
          meteors.splice(bmi, 1);
        }
      }

      // Final collapse shockwave destroys anything nearby
      if (bh.life <= 0) {
        for (var bmi2 = meteors.length-1; bmi2 >= 0; bmi2--) {
          var bm2 = meteors[bmi2];
          var bd3 = Math.sqrt((bh.x-bm2.x)*(bh.x-bm2.x)+(bh.y-bm2.y)*(bh.y-bm2.y));
          if (bd3 < bh.maxR * 1.2) {
            spawnParts(bm2.x, bm2.y, 5, '#aa44ff');
            meteors.splice(bmi2, 1);
          }
        }
        spawnParts(bh.x, bh.y, 22, '#8822ff');
        spawnParts(bh.x, bh.y, 10, '#ffffff');
        doShake(12, 0.35);
        blackHoles.splice(bhIdx, 1);
      }
    }

    // Check game over
    var aliveCount = (!s0.dead ? 1 : 0) + (!s1.dead ? 1 : 0);
    if (aliveCount < 2) endGame();

    refreshHUD();
  }

  // ─────────────────────────────────────────────────────────────
  // WAVE SYSTEM
  // ─────────────────────────────────────────────────────────────
  function triggerWave(n) {
    var count = CFG.WAVE_COUNT + Math.floor(n * 1.5);
    for (var i = 0; i < count; i++) {
      setTimeout(function(){ if(!isOver) spawnMeteor(); }, i * 120);
    }
    waveBanner.text  = 'WAVE ' + n + '!';
    waveBanner.alpha = 1.8;
    waveBanner.scale = 1.6;
    doShake(8, 0.3);
  }

  // ─────────────────────────────────────────────────────────────
  // SHIP UPDATE
  // ─────────────────────────────────────────────────────────────
  function updateShip(ship, dt, rawDt, isAI) {
    if (ship.dead) return;

    if (ship.boostCd    > 0) ship.boostCd    -= rawDt;
    if (ship.boostTimer > 0) { ship.boostTimer -= dt; ship.isBoosting = true; }
    else                       ship.isBoosting = false;
    if (ship.shield     > 0) ship.shield     -= rawDt;
    if (ship.speedUp    > 0) ship.speedUp    -= rawDt;
    if (ship.invincible > 0) ship.invincible -= rawDt;
    if (ship.flash      > 0) ship.flash      -= rawDt;
    if (ship.fireCd     > 0) ship.fireCd     -= rawDt;
    if (ship.laserCharge> 0) ship.laserCharge-= rawDt;
    if (ship.sparkTimer > 0) ship.sparkTimer -= rawDt;

    var turn = 0, thrust = false, boost = false, fire = false;

    if (isAI) {
      runAI(ship, dt);
      turn = aiState.turn; thrust = aiState.thrust;
      boost = aiState.boost; fire = aiState.fire;
    } else if (ship.idx === 0) {
      var jm1 = Math.sqrt(joy1.dx*joy1.dx + joy1.dy*joy1.dy);
      if (joy1.active && jm1 > 0.18) {
        var ja1 = Math.atan2(joy1.dy, joy1.dx);
        var jd1 = wrapAng(ja1 - ship.angle);
        turn = jd1 > 0.12 ? 1 : jd1 < -0.12 ? -1 : 0;
        thrust = jm1 > 0.28;
      } else {
        if (keys['a']) turn = -1;
        if (keys['d']) turn =  1;
        thrust = !!keys['w'];
      }
      boost = bst1 || !!(keys[' ']);
      fire  = fir1 || !!(keys['f']) || !!(keys['control']);
    } else {
      if (isPvP) {
        var jm2 = Math.sqrt(joy2.dx*joy2.dx + joy2.dy*joy2.dy);
        if (joy2.active && jm2 > 0.18) {
          var ja2 = Math.atan2(joy2.dy, joy2.dx);
          var jd2 = wrapAng(ja2 - ship.angle);
          turn = jd2 > 0.12 ? 1 : jd2 < -0.12 ? -1 : 0;
          thrust = jm2 > 0.28;
        } else {
          if (keys['arrowleft'])  turn = -1;
          if (keys['arrowright']) turn =  1;
          thrust = !!keys['arrowup'];
        }
        boost = bst2 || !!(keys['shift']);
        fire  = fir2 || !!(keys['enter']) || !!(keys['p']);
      }
    }

    ship.angle += turn * CFG.ROT_SPD * dt;

    if (boost && ship.boostCd <= 0 && !ship.isBoosting) {
      ship.isBoosting = true;
      ship.boostTimer = CFG.BOOST_DUR;
      ship.boostCd    = CFG.BOOST_CD;
    }

    // Fire laser
    if (fire && ship.fireCd <= 0) {
      fireLaser(ship);
      ship.fireCd = CFG.LASER_RATE * (ship.laserCharge > 0 ? 0.35 : 1.0);
    }

    var maxSpd = ship.isBoosting
      ? CFG.BOOST_MAX                                     // 3× normal top speed during nitro
      : CFG.MAX_SPD * (ship.speedUp > 0 ? 1.65 : 1.0);  // normal or speed-up cap
    if (ship.isBoosting) {
      ship.vx += Math.cos(ship.angle) * CFG.BOOST_FORCE * dt;
      ship.vy += Math.sin(ship.angle) * CFG.BOOST_FORCE * dt;
    } else if (thrust) {
      ship.vx += Math.cos(ship.angle) * CFG.THRUST * dt;
      ship.vy += Math.sin(ship.angle) * CFG.THRUST * dt;
    }

    var spd = Math.sqrt(ship.vx*ship.vx + ship.vy*ship.vy);
    if (spd > maxSpd && spd > 0) { ship.vx = ship.vx/spd*maxSpd; ship.vy = ship.vy/spd*maxSpd; }
    var fric = Math.pow(CFG.FRICTION, dt * 60);
    ship.vx *= fric; ship.vy *= fric;
    ship.x  += ship.vx * dt;
    ship.y  += ship.vy * dt;

    // Arena boundary
    var bdx = ship.x - arena.cx, bdy = ship.y - arena.cy;
    var bd  = Math.sqrt(bdx*bdx + bdy*bdy);
    var safe = arena.r - CFG.SHIP_R;
    if (bd > safe && bd > 0) {
      ship.x = arena.cx + bdx/bd * safe;
      ship.y = arena.cy + bdy/bd * safe;
      ship.vx *= -0.22; ship.vy *= -0.22;
      if (ship.shield <= 0) {
        hurtShip(ship, CFG.BOUNDARY_DMG * dt);
      }
    }

    // Low-HP sparks
    var hpRatio = ship.hp / CFG.SHIP_HP;
    if (hpRatio < 0.30 && !ship.dead) {
      if (ship.sparkTimer <= 0) {
        ship.sparkTimer = 0.08 + Math.random() * 0.12;
        var sa = Math.random() * Math.PI * 2;
        particles.push({
          x:ship.x + Math.cos(sa)*CFG.SHIP_R,
          y:ship.y + Math.sin(sa)*CFG.SHIP_R,
          vx:(Math.random()-0.5)*120, vy:(Math.random()-0.5)*120 - 60,
          r:1.5 + Math.random()*2,
          life:0.25 + Math.random()*0.2,
          maxLife:0.45,
          color: hpRatio < 0.15 ? '#ff2200' : '#ff8800'
        });
      }
    }

    // Trail
    if (thrust || ship.isBoosting) {
      ship.trail.push({
        x:ship.x - Math.cos(ship.angle)*CFG.SHIP_R*0.5,
        y:ship.y - Math.sin(ship.angle)*CFG.SHIP_R*0.5,
        a: ship.isBoosting ? 0.7 : 0.45,
        life:0.32,
        col: ship.isBoosting ? '#ffffff' : ship.col
      });
    }
    var tIdx = ship.trail.length;
    while (tIdx--) {
      ship.trail[tIdx].life -= rawDt;
      if (ship.trail[tIdx].life <= 0) ship.trail.splice(tIdx, 1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // LASER FIRE
  // ─────────────────────────────────────────────────────────────
  function fireLaser(ship) {
    var spd = CFG.LASER_SPD;
    lasers.push({
      x:     ship.x + Math.cos(ship.angle) * (CFG.SHIP_R + 4),
      y:     ship.y + Math.sin(ship.angle) * (CFG.SHIP_R + 4),
      vx:    Math.cos(ship.angle) * spd,
      vy:    Math.sin(ship.angle) * spd,
      angle: ship.angle,
      dist:  0,
      owner: ship.idx,
      col:   ship.col,
      charged: ship.laserCharge > 0
    });
    // Tiny recoil
    ship.vx -= Math.cos(ship.angle) * 18;
    ship.vy -= Math.sin(ship.angle) * 18;
  }

  // ─────────────────────────────────────────────────────────────
  // AI
  // ─────────────────────────────────────────────────────────────
  function runAI(ship, dt) {
    var cfg = CFG.AI[aiDiff] || CFG.AI.medium;
    aiState.timer -= dt * 1000;
    if (aiState.timer > 0) return;
    aiState.timer = cfg.react;

    var enemy  = ships[0];
    var hor    = cfg.horizon / 1000;

    // Find nearest threat
    var nearM  = null, nearD = Infinity;
    for (var mi2 = 0; mi2 < meteors.length; mi2++) {
      var mRef = meteors[mi2];
      var fx  = mRef.x + mRef.vx * hor - (ship.x + ship.vx * hor);
      var fy  = mRef.y + mRef.vy * hor - (ship.y + ship.vy * hor);
      var fd  = Math.sqrt(fx*fx + fy*fy);
      if (fd < nearD) { nearD = fd; nearM = mRef; }
    }

    var dangerR  = (CFG.SHIP_R + 65) / cfg.risk;
    var evading  = nearM && nearD < dangerR;
    var distCtr  = Math.sqrt((ship.x-arena.cx)*(ship.x-arena.cx) + (ship.y-arena.cy)*(ship.y-arena.cy));
    var nearEdge = distCtr > arena.r * 0.75;

    var nearPu = null, nearPuD = Infinity;
    for (var pui3 = 0; pui3 < powerups.length; pui3++) {
      var puRef = powerups[pui3];
      var pid   = Math.sqrt((puRef.x-ship.x)*(puRef.x-ship.x) + (puRef.y-ship.y)*(puRef.y-ship.y));
      if (pid < nearPuD) { nearPuD = pid; nearPu = puRef; }
    }

    var tgt;
    if (nearEdge) {
      tgt = Math.atan2(arena.cy - ship.y, arena.cx - ship.x);
    } else if (evading && Math.random() < cfg.evade) {
      var away = Math.atan2(ship.y - nearM.y, ship.x - nearM.x);
      away += (Math.random() < 0.5 ? 1 : -1) * 0.45 * Math.PI;
      tgt = away;
    } else if (nearPu && nearPuD < 180 && Math.random() < 0.60) {
      tgt = Math.atan2(nearPu.y - ship.y, nearPu.x - ship.x);
    } else if (!enemy.dead && enemy.hp < CFG.SHIP_HP * 0.38 && aiDiff !== 'easy') {
      tgt = Math.atan2(enemy.y - ship.y, enemy.x - ship.x);
    } else {
      aiState.wander += (Math.random() - 0.5) * 0.55;
      tgt = Math.atan2(arena.cy - ship.y, arena.cx - ship.x) + aiState.wander * 0.28;
    }

    var diff2        = wrapAng(tgt - ship.angle);
    aiState.turn    = Math.abs(diff2) > 0.12 ? (diff2 > 0 ? 1 : -1) : 0;
    aiState.thrust  = Math.abs(diff2) < 1.3 || evading || nearEdge;
    aiState.boost   = (evading || nearEdge) && ship.boostCd <= 0 && Math.random() < cfg.boostP;

    // AI shooting: fire if a meteor is in the forward arc
    aiState.fire = false;
    if (Math.random() < cfg.fireP && ship.fireCd <= 0) {
      for (var ai2 = 0; ai2 < meteors.length; ai2++) {
        var am = meteors[ai2];
        var adx = am.x - ship.x, ady = am.y - ship.y;
        var ad  = Math.sqrt(adx*adx + ady*ady);
        if (ad < 220) {
          var aAngle = Math.atan2(ady, adx);
          var aOff   = Math.abs(wrapAng(aAngle - ship.angle));
          if (aOff < 0.38) { aiState.fire = true; break; }
        }
      }
    }
  }

  function wrapAng(a) {
    while (a >  Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  // ─────────────────────────────────────────────────────────────
  // METEORS
  // ─────────────────────────────────────────────────────────────
  function spawnMeteor() {
    var t    = pickMType();
    var edge = Math.floor(Math.random() * 4);
    var sx, sy;
    if      (edge===0){sx=Math.random()*CFG.W; sy=-35;}
    else if (edge===1){sx=CFG.W+35; sy=Math.random()*CFG.H;}
    else if (edge===2){sx=Math.random()*CFG.W; sy=CFG.H+35;}
    else              {sx=-35; sy=Math.random()*CFG.H;}

    var tx  = arena.cx + (Math.random()-0.5) * arena.r * 1.1;
    var ty  = arena.cy + (Math.random()-0.5) * arena.r * 1.1;
    var ang = Math.atan2(ty-sy, tx-sx);
    var spd = t.spd * (0.78 + Math.random() * 0.44);

    meteors.push({
      x:sx, y:sy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
      r:t.r, dmg:t.dmg, hp:t.hp, maxHp:t.hp,
      color:t.color, glow:t.glow, name:t.name,
      life:9.0, spin:0, spinRate:(Math.random()-0.5)*4
    });
  }

  function clusterBurst(m) {
    for (var ci = 0; ci < CFG.CLUSTER_N; ci++) {
      var ca = Math.random() * Math.PI * 2;
      var cs = 125 + Math.random() * 75;
      meteors.push({
        x:m.x, y:m.y, vx:Math.cos(ca)*cs, vy:Math.sin(ca)*cs,
        r:5, dmg:8, hp:1, maxHp:1, color:'#ffbb44', glow:'#ffee88', name:'small',
        life:3.5, spin:0, spinRate:(Math.random()-0.5)*6
      });
    }
  }

  function pickMType() {
    var rv = Math.random(), acc = 0;
    for (var ti6 = 0; ti6 < CFG.M_TYPES.length; ti6++) {
      acc += CFG.M_TYPES[ti6].prob;
      if (rv < acc) return CFG.M_TYPES[ti6];
    }
    return CFG.M_TYPES[0];
  }

  // ─────────────────────────────────────────────────────────────
  // POWERUPS
  // ─────────────────────────────────────────────────────────────
  var PU_ICONS   = { shield:'🛡️', repair:'💊', speed:'⚡', emp:'💥', nuke:'💣', timewarp:'⏱️', lasercharge:'🔋', blackhole:'🌀' };
  var PU_COLORS  = { shield:'#44ffff', repair:'#44ff88', speed:'#ffff44', emp:'#ff8800', nuke:'#ff4444', timewarp:'#8888ff', lasercharge:'#ff88ff', blackhole:'#aa44ff' };
  var PU_LABELS  = { shield:'SHIELDED!', repair:'+32 HP', speed:'SPEED UP!', emp:'EMP!', nuke:'NUKE!', timewarp:'TIME WARP!', lasercharge:'RAPID FIRE!', blackhole:'BLACK HOLE!' };
  var PU_KINDS   = ['shield','repair','speed','emp','nuke','timewarp','lasercharge','blackhole'];
  var PU_WEIGHTS = [0.20,    0.20,    0.14,  0.11, 0.09,  0.09,      0.08,         0.09      ];

  function spawnPowerup() {
    var kind = pickPUKind();
    var ang2  = Math.random() * Math.PI * 2;
    var dist2 = Math.random() * (arena.r * 0.55);
    powerups.push({
      x: arena.cx + Math.cos(ang2)*dist2,
      y: arena.cy + Math.sin(ang2)*dist2,
      kind:kind, life:8.0, pulse:0
    });
  }

  function pickPUKind() {
    var rv = Math.random(), acc = 0;
    for (var i = 0; i < PU_KINDS.length; i++) {
      acc += PU_WEIGHTS[i];
      if (rv < acc) return PU_KINDS[i];
    }
    return 'repair';
  }

  function applyPU(ship, kind) {
    if (kind === 'shield')      { ship.shield = CFG.PU_DUR; }
    if (kind === 'repair')      { ship.hp = Math.min(CFG.SHIP_HP, ship.hp + 32); }
    if (kind === 'speed')       { ship.speedUp = CFG.PU_DUR; }
    if (kind === 'lasercharge') { ship.laserCharge = 5.0; }
    if (kind === 'timewarp')    { timeWarp = 4.0; }
    if (kind === 'blackhole') {
      // Spawn a black hole object that sucks meteors in and then collapses
      blackHoles.push({
        x: ship.x, y: ship.y,
        life: 3.2, maxLife: 3.2,
        r: 0, maxR: 80,
        owner: ship.idx
      });
      doShake(6, 0.2);
    }
    if (kind === 'nuke') {
      for (var ni = meteors.length-1; ni >= 0; ni--) {
        var nm = meteors[ni];
        spawnParts(nm.x, nm.y, 8, nm.color);
        spawnParts(nm.x, nm.y, 3, '#ffffff');
      }
      meteors = [];
      doShake(18, 0.5);
    }
    if (kind === 'emp') {
      var enemy2 = ships[1 - ship.idx];
      if (enemy2 && !enemy2.dead) {
        var edx2 = enemy2.x - ship.x, edy2 = enemy2.y - ship.y;
        var ed2  = Math.sqrt(edx2*edx2 + edy2*edy2) || 1;
        enemy2.vx += edx2/ed2 * 420; enemy2.vy += edy2/ed2 * 420;
        if (enemy2.shield <= 0) { hurtShip(enemy2, 10); addDmgNum(enemy2.x, enemy2.y-20, '-10', '#ff8800'); }
        spawnParts(enemy2.x, enemy2.y, 16, '#ffff44');
        doShake(10, 0.24);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DAMAGE & PARTICLES
  // ─────────────────────────────────────────────────────────────
  function hurtShip(ship, dmg) {
    if (ship.dead || ship.invincible > 0) return;
    ship.hp   -= dmg;
    ship.flash = 0.16;
    if (ship.hp <= 0) {
      ship.hp   = 0;
      ship.dead = true;
      spawnParts(ship.x, ship.y, PARTICLE_EXPLODE,     ship.col);
      spawnParts(ship.x, ship.y, PARTICLE_EXPLODE >> 1, '#ffffff');
      spawnParts(ship.x, ship.y, 12, '#ff8800');
      doShake(18, 0.55);
    }
  }

  function spawnParts(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      var a2 = Math.random() * Math.PI * 2;
      var s2 = 55 + Math.random() * 200;
      particles.push({
        x:x, y:y, vx:Math.cos(a2)*s2, vy:Math.sin(a2)*s2,
        r:1.5 + Math.random()*3.8,
        life:0.35 + Math.random()*0.55,
        maxLife:0.9, color:color
      });
    }
  }

  function addDmgNum(x, y, text, color) {
    dmgNums.push({ x:x, y:y, text:text, color:color, life:1.1, maxLife:1.1 });
  }

  function doShake(mag, dur) { shakeMag = mag; shakeTimer = dur; }

  // ─────────────────────────────────────────────────────────────
  // END GAME
  // ─────────────────────────────────────────────────────────────
  function endGame() {
    if (isOver) return;
    isOver = true;
    window.sdStopGame();

    setTimeout(function() {
      var alive  = ships.filter(function(s){ return !s.dead; });
      var winner = alive.length === 1 ? alive[0] : null;
      var title, sub, icon;

      if (winner) {
        if (!isPvP) {
          if (winner.idx === 0) {
            title='VICTORY';  icon='🏆';
            sub = 'Survived ' + fmt(gameTime) + ' · Meteors destroyed: ' + ships[0].kills;
          } else {
            title='DESTROYED'; icon='💀';
            sub = 'The bot survived! ⏱ ' + fmt(gameTime);
          }
        } else {
          title = winner.label + ' WINS'; icon = '🏆';
          sub   = winner.label + ' wins! ⏱ ' + fmt(gameTime) +
                  ' · Kills: ' + winner.kills;
        }
      } else {
        title = 'DRAW'; icon = '💫'; sub = 'Both ships destroyed simultaneously!';
      }

      document.getElementById('sd-result-icon').textContent  = icon;
      document.getElementById('sd-result-title').textContent = title;
      document.getElementById('sd-result-sub').innerHTML     = sub;
      show(domResult);

      try {
        if (!isPvP && winner && winner.idx === 0) {
          var w = parseInt(localStorage.getItem('sd_wins') || '0');
          localStorage.setItem('sd_wins', w + 1);
        }
      } catch(e) {}

      render();
    }, 900);
  }

  function fmt(t) {
    var s = Math.floor(t);
    return Math.floor(s/60) + ':' + ('0'+(s%60)).slice(-2);
  }

  // ─────────────────────────────────────────────────────────────
  // PAUSE
  // ─────────────────────────────────────────────────────────────
  function togglePause() {
    if (isOver || inCD) return;
    isPaused = !isPaused;
    if (isPaused) show(domPause); else hide(domPause);
    if (!isPaused) lastTime = performance.now();
  }

  // ─────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────
  function refreshHUD() {
    var h0 = Math.max(0, ships[0].hp), h1 = Math.max(0, ships[1].hp);
    if (domP1Hp)   domP1Hp.textContent   = Math.ceil(h0);
    if (domP2Hp)   domP2Hp.textContent   = Math.ceil(h1);
    if (domP1Fill) domP1Fill.style.width = (h0 / CFG.SHIP_HP * 100) + '%';
    if (domP2Fill) domP2Fill.style.width = (h1 / CFG.SHIP_HP * 100) + '%';
    if (domTimer)  domTimer.textContent  = fmt(gameTime);

    // Powerup icons with kill counters
    if (domP1Pu) domP1Pu.innerHTML =
      (ships[0].shield      > 0 ? '🛡️' : '') +
      (ships[0].speedUp     > 0 ? '⚡' : '') +
      (ships[0].laserCharge > 0 ? '🔋' : '') +
      (timeWarp > 0 ? '⏱️' : '') +
      '<span style="font-size:11px;color:#00e5ff;margin-left:3px;">×'+ships[0].kills+'</span>';
    if (domP2Pu) domP2Pu.innerHTML =
      (ships[1].shield      > 0 ? '🛡️' : '') +
      (ships[1].speedUp     > 0 ? '⚡' : '') +
      (ships[1].laserCharge > 0 ? '🔋' : '') +
      '<span style="font-size:11px;color:#ff3d71;margin-left:3px;">×'+ships[1].kills+'</span>';
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  function render() {
    if (!ctx) return;
    var W = CFG.W, H = CFG.H;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── Background ─────────────────────────────────────────────
    ctx.fillStyle = '#020408';
    ctx.fillRect(-10, -10, W+20, H+20);

    // ── Nebula wisps ───────────────────────────────────────────
    for (var ni2 = 0; ni2 < nebulaBlobs.length; ni2++) {
      var nb = nebulaBlobs[ni2];
      ctx.save();
      ctx.translate(nb.x, nb.y);
      ctx.rotate(nb.rot);
      var ng = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(nb.rx, nb.ry));
      ng.addColorStop(0, nb.col + (nb.a + 0.04) + ')');
      ng.addColorStop(1, nb.col + '0)');
      ctx.scale(nb.rx / Math.max(nb.rx, nb.ry), nb.ry / Math.max(nb.rx, nb.ry));
      ctx.globalAlpha = 1;
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(nb.rx, nb.ry), 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // ── Stars (multi-layer) ────────────────────────────────────
    for (var si3 = 0; si3 < stars.length; si3++) {
      var st = stars[si3];
      st.tw += st.twSpd;
      ctx.globalAlpha = st.a * (0.72 + 0.28 * Math.sin(st.tw));
      ctx.fillStyle   = st.col;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Arena glow fill (clipped) ──────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(arena.cx, arena.cy, arena.r, 0, Math.PI*2);
    ctx.clip();
    var grd = ctx.createRadialGradient(arena.cx, arena.cy, 0, arena.cx, arena.cy, arena.r);
    grd.addColorStop(0,   'rgba(80,0,140,0.14)');
    grd.addColorStop(0.65,'rgba(20,0,55,0.08)');
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    // Subtle grid
    ctx.strokeStyle = 'rgba(90,30,180,0.05)';
    ctx.lineWidth = 1;
    for (var gx3 = 0; gx3 < W; gx3 += 52) {
      ctx.beginPath(); ctx.moveTo(gx3,0); ctx.lineTo(gx3,H); ctx.stroke();
    }
    for (var gy3 = 0; gy3 < H; gy3 += 52) {
      ctx.beginPath(); ctx.moveTo(0,gy3); ctx.lineTo(W,gy3); ctx.stroke();
    }
    ctx.restore();

    // ── Time warp overlay ──────────────────────────────────────
    if (timeWarp > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(timeWarp / 4.0, 1) * 0.12;
      ctx.fillStyle   = '#8888ff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Arena ring ─────────────────────────────────────────────
    var ringPls = 0.55 + 0.45 * Math.sin(pulse * 2.2);
    var ringCol = shrinkOn ? '#ff4444' : (timeWarp > 0 ? '#8888ff' : '#b400ff');
    ctx.save();
    ctx.globalAlpha = 0.55 + ringPls * 0.25;
    ctx.shadowColor = ringCol; ctx.shadowBlur = 16 + ringPls * 14;
    ctx.strokeStyle = ringCol; ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.arc(arena.cx, arena.cy, arena.r, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#b400ff'; ctx.lineWidth = 1;
    ctx.setLineDash([7,9]);
    ctx.beginPath(); ctx.arc(arena.cx, arena.cy, Math.max(arena.r-18,10), 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // Red danger pulse at edge when shrinking — multi-layer pulse
    if (shrinkOn && arena.r > CFG.ARENA_MIN + 10) {
      // Outer danger ring — fast pulse
      ctx.globalAlpha = 0.12 + 0.14 * Math.sin(pulse * 8);
      ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.arc(arena.cx, arena.cy, arena.r, 0, Math.PI*2); ctx.stroke();
      // Inner warning stripe
      ctx.globalAlpha = 0.06 + 0.06 * Math.sin(pulse * 5);
      ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(arena.cx, arena.cy, arena.r - 10, 0, Math.PI*2); ctx.stroke();
      // SHRINK label on ring
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(pulse * 6);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 11px "Rajdhani",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⚠ ZONE SHRINKING', arena.cx, arena.cy - arena.r + 14);
    }

    // Pre-shrink warning — 5 seconds before shrink starts, show pulsing countdown
    if (!shrinkOn && !inCD) {
      var srLeft = Math.ceil(CFG.SHRINK_DELAY - gameTime);
      if (srLeft > 0) {
        var countAlpha = srLeft <= 5 ? (0.7 + 0.3 * Math.sin(pulse * (6 - srLeft))) : 0.55;
        var countColor = srLeft <= 3 ? '#ff4444' : (srLeft <= 5 ? '#ffaa00' : '#b400ff');
        ctx.save();
        ctx.globalAlpha = countAlpha; ctx.fillStyle = countColor;
        ctx.font = 'bold ' + (srLeft <= 3 ? '14' : '12') + 'px "Rajdhani",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SHRINK IN ' + srLeft + 's', arena.cx, arena.cy - arena.r + 17);
        // Extra ring flash when imminent
        if (srLeft <= 3) {
          ctx.globalAlpha = 0.06 + 0.06 * Math.sin(pulse * 8);
          ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(arena.cx, arena.cy, arena.r, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ── Danger arrows (off-screen meteor indicators) ───────────
    drawDangerArrows();

    // ── Particles ──────────────────────────────────────────────
    for (var pi3 = 0; pi3 < particles.length; pi3++) {
      var p2 = particles[pi3];
      var pa = Math.max(0, p2.life / (p2.maxLife || 0.8));
      ctx.globalAlpha = pa * 0.94;
      ctx.fillStyle   = p2.color;
      if (p2.r > 2) {
        ctx.shadowColor = p2.color; ctx.shadowBlur = 4;
      }
      ctx.beginPath(); ctx.arc(p2.x, p2.y, p2.r * Math.max(pa, 0.1), 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // ── Lasers ─────────────────────────────────────────────────
    for (var li = 0; li < lasers.length; li++) {
      var lsr = lasers[li];
      var travelFade = Math.max(0, 1 - lsr.dist / CFG.LASER_RANGE);
      ctx.save();
      ctx.translate(lsr.x, lsr.y);
      ctx.rotate(lsr.angle);
      ctx.globalAlpha = 0.92 * travelFade;
      ctx.shadowColor = lsr.col; ctx.shadowBlur = lsr.charged ? 22 : 12;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lsr.charged ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(-CFG.LASER_LEN, 0); ctx.lineTo(CFG.LASER_LEN * 0.3, 0); ctx.stroke();
      ctx.strokeStyle = lsr.col; ctx.lineWidth = lsr.charged ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(-CFG.LASER_LEN*0.7, 0); ctx.lineTo(CFG.LASER_LEN*0.5, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ── Powerups ───────────────────────────────────────────────
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var pui4 = 0; pui4 < powerups.length; pui4++) {
      var puR = powerups[pui4];
      var puA = Math.min(1, puR.life / 2.2) * (0.7 + 0.3*Math.sin(puR.pulse * 4.5));
      var puColor = PU_COLORS[puR.kind] || '#ffffff';
      ctx.save();
      // Outer glow ring
      ctx.globalAlpha = puA * 0.4;
      ctx.shadowColor = puColor; ctx.shadowBlur = 18;
      ctx.strokeStyle = puColor; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(puR.x, puR.y, CFG.PU_R + 6 + Math.sin(puR.pulse*4)*2.5, 0, Math.PI*2); ctx.stroke();
      // Inner fill
      ctx.globalAlpha = puA * 0.18;
      ctx.fillStyle = puColor;
      ctx.beginPath(); ctx.arc(puR.x, puR.y, CFG.PU_R + 2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = puA;
      ctx.font = '20px serif';
      ctx.fillText(PU_ICONS[puR.kind] || '⭐', puR.x, puR.y);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';

    // ── Meteors ────────────────────────────────────────────────
    for (var mi3 = 0; mi3 < meteors.length; mi3++) {
      var mr = meteors[mi3];
      ctx.save();
      ctx.translate(mr.x, mr.y); ctx.rotate(mr.spin);
      // Trail streak
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = mr.glow || mr.color; ctx.lineWidth = mr.r * 1.0; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-mr.vx*0.062,-mr.vy*0.062); ctx.stroke();
      // Glow
      ctx.globalAlpha = 1;
      ctx.shadowColor = mr.glow || mr.color; ctx.shadowBlur = 8 + mr.r * 0.5;
      ctx.fillStyle   = mr.color;
      ctx.beginPath();
      var pts = 6 + Math.floor(mr.r/4);
      for (var vi2 = 0; vi2 <= pts; vi2++) {
        var va2 = vi2/pts * Math.PI*2;
        var vr2 = mr.r * (0.70 + 0.30*Math.sin(va2*3 + mr.spin*1.5));
        if (vi2===0) ctx.moveTo(Math.cos(va2)*vr2, Math.sin(va2)*vr2);
        else ctx.lineTo(Math.cos(va2)*vr2, Math.sin(va2)*vr2);
      }
      ctx.closePath(); ctx.fill();
      // HP crack lines for multi-hp meteors
      if (mr.maxHp > 1 && mr.hp < mr.maxHp) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffcc88'; ctx.lineWidth = 1;
        var cracks = mr.maxHp - mr.hp;
        for (var ci2 = 0; ci2 < cracks; ci2++) {
          var ca2 = (ci2 / cracks) * Math.PI * 2 + mr.spin;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ca2)*mr.r*0.9, Math.sin(ca2)*mr.r*0.9);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── Black Holes ────────────────────────────────────────────
    for (var bhi = 0; bhi < blackHoles.length; bhi++) {
      var bhR = blackHoles[bhi];
      var bhAlpha = Math.min(1, bhR.life / bhR.maxLife * 2.2);
      ctx.save();
      // Outer event-horizon glow
      var bhG = ctx.createRadialGradient(bhR.x, bhR.y, 0, bhR.x, bhR.y, bhR.r * 2.2);
      bhG.addColorStop(0,   'rgba(80,0,200,' + (bhAlpha*0.55) + ')');
      bhG.addColorStop(0.4, 'rgba(40,0,120,' + (bhAlpha*0.30) + ')');
      bhG.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = bhG;
      ctx.beginPath(); ctx.arc(bhR.x, bhR.y, bhR.r * 2.2, 0, Math.PI*2); ctx.fill();
      // Dark core
      ctx.fillStyle = '#000000';
      ctx.shadowColor = '#8822ff'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(bhR.x, bhR.y, bhR.r * 0.55, 0, Math.PI*2); ctx.fill();
      // Spinning ring
      ctx.globalAlpha = bhAlpha * 0.7;
      ctx.strokeStyle = '#cc44ff'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = 12;
      ctx.save();
      ctx.translate(bhR.x, bhR.y);
      ctx.rotate(gameTime * 3.5);
      ctx.beginPath(); ctx.ellipse(0, 0, bhR.r, bhR.r * 0.30, 0, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    // ── Speed lines (radial blur from ship when going fast) ────
    for (var sli = 0; sli < ships.length; sli++) {
      var slShip = ships[sli];
      if (slShip.dead) continue;
      var slSpd = Math.sqrt(slShip.vx*slShip.vx + slShip.vy*slShip.vy);
      var slThresh = CFG.MAX_SPD * 0.72;
      if (slSpd < slThresh) continue;
      var slIntensity = Math.min((slSpd - slThresh) / (CFG.BOOST_MAX - slThresh), 1.0);
      ctx.save();
      ctx.globalAlpha = slIntensity * 0.55;
      var slAngle = Math.atan2(slShip.vy, slShip.vx);
      var lineCount = slShip.isBoosting ? 18 : 10;
      for (var sln = 0; sln < lineCount; sln++) {
        var slA = slAngle + Math.PI + (Math.random() - 0.5) * 0.9;
        var slLen = (40 + Math.random() * 90) * slIntensity;
        var slOff = (Math.random() - 0.5) * 18;
        ctx.strokeStyle = slShip.isBoosting ? '#ffffff' : slShip.col;
        ctx.lineWidth   = slShip.isBoosting ? 1.8 : 1.0;
        ctx.shadowColor = slShip.col; ctx.shadowBlur = slShip.isBoosting ? 8 : 3;
        ctx.beginPath();
        ctx.moveTo(slShip.x + Math.cos(slA+Math.PI/2)*slOff,
                   slShip.y + Math.sin(slA+Math.PI/2)*slOff);
        ctx.lineTo(slShip.x + Math.cos(slA)*slLen + Math.cos(slA+Math.PI/2)*slOff,
                   slShip.y + Math.sin(slA)*slLen + Math.sin(slA+Math.PI/2)*slOff);
        ctx.stroke();
      }
      // Boost screen-edge flash: colour vignette in ship colour
      if (slShip.isBoosting) {
        var edgeG = ctx.createRadialGradient(slShip.x, slShip.y, 0, slShip.x, slShip.y, CFG.W * 0.85);
        edgeG.addColorStop(0,   'rgba(0,0,0,0)');
        edgeG.addColorStop(0.6, 'rgba(0,0,0,0)');
        edgeG.addColorStop(1,   slShip.col.replace('#','rgba(').replace(/(..)(..)(..)/, function(m,r,g,b){
          return parseInt(r,16)+','+parseInt(g,16)+','+parseInt(b,16);
        })+',0.22)');
        ctx.fillStyle = edgeG;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(0, 0, CFG.W, CFG.H);
      }
      ctx.restore();
    }

    // ── Ships ──────────────────────────────────────────────────
    for (var shiR = 0; shiR < ships.length; shiR++) drawShip(ships[shiR]);

    // ── Floating damage numbers ────────────────────────────────
    for (var dIdx2 = 0; dIdx2 < dmgNums.length; dIdx2++) {
      var dn = dmgNums[dIdx2];
      var da = Math.min(1, dn.life / dn.maxLife);
      ctx.save();
      ctx.globalAlpha   = da * da;
      ctx.fillStyle     = dn.color;
      ctx.shadowColor   = dn.color; ctx.shadowBlur = 6;
      ctx.font          = 'bold 14px "Rajdhani",sans-serif';
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
      ctx.fillText(dn.text, dn.x, dn.y);
      ctx.restore();
    }

    // ── Wave banner ────────────────────────────────────────────
    if (waveBanner.alpha > 0) {
      var ba = Math.min(1, waveBanner.alpha);
      ctx.save();
      // Dim background during wave announcement
      if (ba > 0.4) {
        ctx.globalAlpha = (ba - 0.4) * 0.35;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = ba;
      // Banner background bar
      ctx.fillStyle = 'rgba(255,60,0,0.18)';
      ctx.fillRect(0, H/2 - 60, W, 120);
      ctx.strokeStyle = 'rgba(255,120,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, H/2 - 60, W, 120);
      // Main wave text
      ctx.font = 'bold ' + Math.round(52 * waveBanner.scale) + 'px "Orbitron",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff8800';
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 40;
      ctx.fillText(waveBanner.text, W/2, H/2 - 18);
      ctx.font = 'bold 18px "Rajdhani",sans-serif';
      ctx.fillStyle = '#ffcc88'; ctx.shadowBlur = 10;
      ctx.fillText('⚠  INCOMING ASTEROID FIELD  ⚠', W/2, H/2 + 22);
      ctx.restore();
    }

    ctx.restore(); // end shake

    // ── Countdown overlay ──────────────────────────────────────
    if (inCD) drawCountdown();

    // ── Mobile joysticks overlay ───────────────────────────────
    if (hasTouchScreen()) drawJoysticks();
  }

  // ─────────────────────────────────────────────────────────────
  // DANGER ARROWS
  // Chevrons at arena boundary pointing toward fast incoming rocks
  // ─────────────────────────────────────────────────────────────
  function drawDangerArrows() {
    for (var di = 0; di < meteors.length; di++) {
      var m = meteors[di];
      // Only show arrow for large/medium meteors heading INTO the arena
      if (m.r < 10) continue;
      var inside = (m.x > 0 && m.x < CFG.W && m.y > 0 && m.y < CFG.H);
      if (inside) continue; // meteor is already on screen, no arrow needed

      // direction from arena centre to meteor
      var ax = m.x - arena.cx, ay = m.y - arena.cy;
      var ad = Math.sqrt(ax*ax + ay*ay);
      if (ad < 1) continue;
      var ang = Math.atan2(ay, ax);

      // Place arrow just inside the arena boundary
      var arrowR = arena.r - 18;
      var arx = arena.cx + Math.cos(ang) * arrowR;
      var ary = arena.cy + Math.sin(ang) * arrowR;

      var flashA = 0.55 + 0.35 * Math.sin(pulse * 5 + di);
      ctx.save();
      ctx.translate(arx, ary);
      ctx.rotate(ang);
      ctx.globalAlpha = flashA;
      ctx.fillStyle   = m.r >= 20 ? '#ff3300' : '#ffaa00';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SHIP DRAW
  // ─────────────────────────────────────────────────────────────
  function drawShip(ship) {
    if (ship.dead) return;
    var R = CFG.SHIP_R;
    var hpRatio = ship.hp / CFG.SHIP_HP;

    // Thrust trail — white-hot rainbow during boost
    for (var ti7 = 0; ti7 < ship.trail.length; ti7++) {
      var tr = ship.trail[ti7];
      var tf = tr.life / 0.32;
      ctx.globalAlpha = tr.a * tf * tf;
      // Rainbow shift during boost: hue cycles along trail
      var trailCol = tr.col;
      if (ship.isBoosting || tr.col === '#ffffff') {
        var hue = (gameTime * 200 + ti7 * 22) % 360;
        trailCol = 'hsl(' + hue + ',100%,80%)';
      }
      ctx.fillStyle   = trailCol;
      ctx.shadowColor = trailCol; ctx.shadowBlur = ship.isBoosting ? 14 : 6;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, R * (ship.isBoosting ? 0.62 : 0.42) * tf, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    // Hit flash
    if (ship.flash > 0) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle   = '#ffffff';
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(0, 0, R+6, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // Low HP warning aura
    if (hpRatio < 0.30) {
      ctx.save();
      ctx.globalAlpha = (0.28 + 0.22*Math.sin(pulse * 8)) * (1 - hpRatio/0.30);
      ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 3;
      ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0, 0, R + 10 + 3*Math.sin(pulse*8), 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Shield ring
    if (ship.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.38 + Math.min(1, ship.shield/0.5) * 0.22;
      ctx.strokeStyle = '#44ffff'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#44ffff'; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(0, 0, R+11, 0, Math.PI*2); ctx.stroke();
      // Inner shimmer
      ctx.globalAlpha *= 0.4;
      ctx.fillStyle = '#44ffff';
      ctx.beginPath(); ctx.arc(0, 0, R+11, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Laser charge glow
    if (ship.laserCharge > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3*Math.sin(pulse*12);
      ctx.strokeStyle = '#ff88ff'; ctx.lineWidth = 2;
      ctx.shadowColor = '#ff88ff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, 0, R+7, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Ship body — detailed with cockpit
    var bodyCol = hpRatio < 0.30 ? '#553333' : ship.col2;
    ctx.shadowColor = ship.col;
    ctx.shadowBlur  = ship.isBoosting ? 32 : 14;
    ctx.fillStyle   = bodyCol;
    ctx.strokeStyle = ship.col;
    ctx.lineWidth   = 2.2;

    // Main fuselage
    ctx.beginPath();
    ctx.moveTo( R,       0);
    ctx.lineTo(-R*0.70,  R*0.62);
    ctx.lineTo(-R*0.28,  0);
    ctx.lineTo(-R*0.70, -R*0.62);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cockpit window
    ctx.shadowBlur = 0;
    ctx.fillStyle  = ship.isBoosting ? '#ffffff' : (hpRatio > 0.5 ? '#88eeff' : '#ffaa44');
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(R*0.28, 0, R*0.26, R*0.22, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Wing accent lines
    ctx.strokeStyle = ship.col; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(0, R*0.2); ctx.lineTo(-R*0.5, R*0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -R*0.2); ctx.lineTo(-R*0.5, -R*0.5); ctx.stroke();
    ctx.globalAlpha = 1;

    // Engine nozzle glow
    ctx.shadowColor = ship.isBoosting ? '#ffffff' : ship.col;
    ctx.shadowBlur  = ship.isBoosting ? 24 : 10;
    ctx.fillStyle   = ship.isBoosting ? '#ffffff' : ship.col;
    ctx.globalAlpha = ship.isBoosting ? 1.0 : 0.75;
    ctx.beginPath(); ctx.arc(-R*0.30, 0, R*0.28, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // Speed ring
    if (ship.speedUp > 0) {
      ctx.globalAlpha = 0.5 + 0.28*Math.sin(gameTime*8);
      ctx.strokeStyle = '#ffff44'; ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffff44'; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(0, 0, R+5, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Boost-ready indicator dot
    if (ship.boostCd <= 0) {
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.65;
      ctx.fillStyle  = ship.col;
      ctx.beginPath(); ctx.arc(-R*0.68, 0, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // Label + fire cooldown arc
    ctx.fillStyle    = ship.col;
    ctx.font         = 'bold 10px "Rajdhani",sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ship.label, ship.x, ship.y - R - 5);

    // Laser cooldown arc under ship
    if (ship.fireCd > 0) {
      var cdFrac = 1 - (ship.fireCd / CFG.LASER_RATE);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = ship.col; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, R + 4, -Math.PI/2, -Math.PI/2 + cdFrac * Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // COUNTDOWN DRAW
  // ─────────────────────────────────────────────────────────────
  function drawCountdown() {
    var label = cdNum > 0 ? String(cdNum) : 'GO!';
    var isGo  = cdNum <= 0;

    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    ctx.save();
    ctx.font = 'bold 90px "Orbitron",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle   = isGo ? '#00ff88' : '#b400ff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 50;
    ctx.fillText(label, CFG.W/2, CFG.H/2);
    ctx.restore();

    ctx.font = '13px "Rajdhani",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(150,170,220,0.7)';
    ctx.fillText('W/A/D + F to fire • SPACE boost  |  Arrows + Enter to fire • Shift boost', CFG.W/2, CFG.H/2 + 72);
  }

  // ─────────────────────────────────────────────────────────────
  // MOBILE JOYSTICK DRAW
  // ─────────────────────────────────────────────────────────────
  function drawJoysticks() {
    drawJoyStick(joy1, 95, CFG.H - 95, ships[0].col);
    drawBoostBadge(95,     CFG.H - 27, bst1, ships[0]);
    drawFireBadge(200,     CFG.H - 27, fir1, ships[0]);

    if (isPvP) {
      drawJoyStick(joy2, CFG.W - 95, CFG.H - 95, ships[1].col);
      drawBoostBadge(CFG.W - 95, CFG.H - 27, bst2, ships[1]);
      drawFireBadge(CFG.W - 200,  CFG.H - 27, fir2, ships[1]);
    }
  }

  function drawJoyStick(j, cx3, cy3, color) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx3, cy3, 44, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx3-44,cy3); ctx.lineTo(cx3+44,cy3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx3,cy3-44); ctx.lineTo(cx3,cy3+44); ctx.stroke();
    var kx = cx3 + (j.active ? j.dx * 38 : 0);
    var ky = cy3 + (j.active ? j.dy * 38 : 0);
    ctx.globalAlpha = j.active ? 0.72 : 0.32;
    ctx.fillStyle   = color;
    ctx.shadowColor = color; ctx.shadowBlur = j.active ? 14 : 0;
    ctx.beginPath(); ctx.arc(kx, ky, 20, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawBoostBadge(x, y, active, ship) {
    var ready = ship.boostCd <= 0;
    ctx.save();
    ctx.globalAlpha = active ? 0.9 : (ready ? 0.5 : 0.22);
    ctx.fillStyle   = active ? ship.col : (ready ? ship.col : '#334');
    var rr = 5, bw = 56, bh = 22;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x-bw/2, y-bh/2, bw, bh, rr); }
    else { ctx.rect(x-bw/2, y-bh/2, bw, bh); }
    ctx.fill();
    ctx.globalAlpha = active ? 0.9 : 0.45;
    ctx.strokeStyle = ship.col; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle   = active ? '#000' : '#dde';
    ctx.font        = 'bold 11px "Rajdhani",sans-serif';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ready ? '⚡BOOST' : 'CD', x, y);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function drawFireBadge(x, y, active, ship) {
    ctx.save();
    var ready = ship.fireCd <= 0;
    ctx.globalAlpha = active ? 0.9 : (ready ? 0.55 : 0.28);
    ctx.fillStyle   = active ? ship.col : (ready ? '#332200' : '#221100');
    var rr = 5, bw = 54, bh = 22;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x-bw/2, y-bh/2, bw, bh, rr); }
    else { ctx.rect(x-bw/2, y-bh/2, bw, bh); }
    ctx.fill();
    ctx.globalAlpha = active ? 0.9 : 0.45;
    ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle   = active ? '#000' : '#ffcc88';
    ctx.font        = 'bold 11px "Rajdhani",sans-serif';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔫 FIRE', x, y);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function hasTouchScreen() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // KEYBOARD
  // ─────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') togglePause();
    if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) !== -1) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

  // ─────────────────────────────────────────────────────────────
  // TOUCH
  // ─────────────────────────────────────────────────────────────
  function attachTouch() {
    if (!domCanvas) return;
    domCanvas.addEventListener('touchstart',  tStart,  {passive:false});
    domCanvas.addEventListener('touchmove',   tMove,   {passive:false});
    domCanvas.addEventListener('touchend',    tEnd,    {passive:false});
    domCanvas.addEventListener('touchcancel', tEnd,    {passive:false});
  }
  function detachTouch() {
    if (!domCanvas) return;
    domCanvas.removeEventListener('touchstart',  tStart);
    domCanvas.removeEventListener('touchmove',   tMove);
    domCanvas.removeEventListener('touchend',    tEnd);
    domCanvas.removeEventListener('touchcancel', tEnd);
  }

  function cpToCanvas(touch) {
    var rect = domCanvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (CFG.W / rect.width),
      y: (touch.clientY - rect.top)  * (CFG.H / rect.height)
    };
  }

  function tStart(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t  = e.changedTouches[i];
      var pt = cpToCanvas(t);
      var isP2Side = isPvP && pt.x > CFG.W * 0.5;

      // Bottom strip interaction zones
      if (pt.y > CFG.H - 55) {
        // Fire zone (center-ish of bottom strip)
        if (!isP2Side && pt.x > 150 && pt.x < 260) { fir1 = true; continue; }
        if (isP2Side  && pt.x > CFG.W-260 && pt.x < CFG.W-150) { fir2 = true; continue; }
        // Boost zone (far sides)
        if (!isP2Side) { bst1 = true; continue; }
        else           { bst2 = true; continue; }
      }

      if (!isP2Side && !joy1.active) {
        joy1 = { active:true, id:t.identifier, sx:pt.x, sy:pt.y, dx:0, dy:0 };
      } else if (isP2Side && !joy2.active) {
        joy2 = { active:true, id:t.identifier, sx:pt.x, sy:pt.y, dx:0, dy:0 };
      }
    }
  }

  function tMove(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t  = e.changedTouches[i];
      var pt = cpToCanvas(t);
      if (joy1.active && joy1.id === t.identifier) {
        var dx = (pt.x - joy1.sx) / 55, dy = (pt.y - joy1.sy) / 55;
        var mg = Math.sqrt(dx*dx + dy*dy);
        joy1.dx = mg > 1 ? dx/mg : dx; joy1.dy = mg > 1 ? dy/mg : dy;
      }
      if (joy2.active && joy2.id === t.identifier) {
        var dx2 = (pt.x - joy2.sx) / 55, dy2 = (pt.y - joy2.sy) / 55;
        var mg2 = Math.sqrt(dx2*dx2 + dy2*dy2);
        joy2.dx = mg2 > 1 ? dx2/mg2 : dx2; joy2.dy = mg2 > 1 ? dy2/mg2 : dy2;
      }
    }
  }

  function tEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t  = e.changedTouches[i];
      var pt = cpToCanvas(t);
      if (joy1.active && joy1.id === t.identifier) { joy1.active=false; joy1.dx=0; joy1.dy=0; }
      if (joy2.active && joy2.id === t.identifier) { joy2.active=false; joy2.dx=0; joy2.dy=0; }
      if (pt.y > CFG.H - 55) {
        if (isPvP && pt.x > CFG.W * 0.5) { bst2 = false; fir2 = false; }
        else                              { bst1 = false; fir1 = false; }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
