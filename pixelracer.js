// ═══════════════════════════════════════════════════════════════
// DuelZone · Pixel Racer  (pixelracer.js)
// Two pixel cars race on a circuit track.
// P1: Arrow keys | P2: WASD | First to 3 laps wins.
// PvBot: AI opponent with configurable difficulty.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var W = 600, H = 400; // canvas size
  var TRACK_WIDTH = 72;
  var CAR_W = 16, CAR_H = 26;
  var LAPS_TO_WIN = 3;

  // Waypoints defining the race track center path
  var WAYPOINTS = [
    {x:300,y:60},{x:520,y:60},{x:560,y:100},{x:560,y:180},
    {x:520,y:220},{x:420,y:220},{x:380,y:260},{x:380,y:340},
    {x:340,y:370},{x:80,y:370},{x:40,y:340},{x:40,y:100},
    {x:80,y:60},{x:300,y:60},
  ];

  var PR = {
    mode: 'pvp', diff: 'medium', over: false,
    players: [
      { x: 290, y: 60, angle: 0, speed: 0, maxSpeed: 4.2, accel: 0.18, friction: 0.92, steer: 0.045,
        laps: 0, checkpoint: 0, color: '#00e5ff', name: 'Player 1', finished: false },
      { x: 310, y: 60, angle: 0, speed: 0, maxSpeed: 4.0, accel: 0.17, friction: 0.92, steer: 0.045,
        laps: 0, checkpoint: 0, color: '#f50057', name: 'Player 2', finished: false },
    ],
    canvas: null, ctx: null,
    animFrame: null, keys: {},
    _wired: false,
  };

  window.pixelracerInit = function () {
    if (!PR._wired) { prWireUI(); PR._wired = true; }
    prShowHome();
  };
  window.pixelracerDestroy = function () { prStop(); };

  function el(id) { return document.getElementById(id); }
  function on(id, fn) { var e = el(id); if (e) e.addEventListener('click', fn); }
  function setText(id, v) { var e = el(id); if (e) e.textContent = v; }

  function prShowHome() {
    prStop();
    el('pr-home').classList.remove('hidden');
    el('pr-play').classList.add('hidden');
  }

  function prWireUI() {
    on('pr-back-hub', function () { prStop(); showHub(); });
    on('pr-back-play', function () { prStop(); prShowHome(); });
    on('pr-again', function () { prStartGame(); });
    on('pr-result-hub', function () { prStop(); showHub(); });
    on('pr-start-btn', function () { prStartGame(); });

    on('pr-mode-pvp', function () {
      PR.mode = 'pvp';
      el('pr-mode-pvp').classList.add('active');
      el('pr-mode-bot').classList.remove('active');
      var bs = el('pr-bot-settings'); if (bs) bs.classList.add('hidden');
    });
    on('pr-mode-bot', function () {
      PR.mode = 'bot';
      el('pr-mode-bot').classList.add('active');
      el('pr-mode-pvp').classList.remove('active');
      var bs = el('pr-bot-settings'); if (bs) bs.classList.remove('hidden');
    });

    document.querySelectorAll('.pr-diff').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.pr-diff').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); PR.diff = b.dataset.diff;
      });
    });

    document.addEventListener('keydown', function (e) { PR.keys[e.key] = true; });
    document.addEventListener('keyup', function (e) { PR.keys[e.key] = false; });
  }

  function prStop() {
    PR.over = true;
    if (PR.animFrame) { cancelAnimationFrame(PR.animFrame); PR.animFrame = null; }
  }

  // ── Start game ────────────────────────────────────────────────
  function prStartGame() {
    prStop();
    PR.over = false;

    PR.players[0] = Object.assign(PR.players[0], { x: 290, y: 72, angle: 0, speed: 0, laps: 0, checkpoint: 0, finished: false });
    PR.players[1] = Object.assign(PR.players[1], { x: 310, y: 72, angle: 0, speed: 0, laps: 0, checkpoint: 0, finished: false });
    PR.players[1].name = PR.mode === 'bot' ? '🤖 Bot' : 'Player 2';

    // Adjust bot speed
    var botSpeeds = { easy: 2.8, medium: 3.6, hard: 5.5 };
    PR.players[1].maxSpeed = PR.mode === 'bot' ? (botSpeeds[PR.diff] || 3.6) : 4.0;

    el('pr-home').classList.add('hidden');
    el('pr-play').classList.remove('hidden');
    el('pr-result').classList.add('hidden');
    setText('pr-p2-label', PR.players[1].name);

    var canvas = el('pr-canvas');
    if (canvas) {
      canvas.width = W; canvas.height = H;
      PR.canvas = canvas; PR.ctx = canvas.getContext('2d');
    }

    prUpdateHUD();
    PR.animFrame = requestAnimationFrame(prLoop);
  }

  // ── Main loop ─────────────────────────────────────────────────
  var lastTime = 0;
  function prLoop(now) {
    if (PR.over) return;
    var dt = Math.min((now - lastTime) / 16.67, 3); lastTime = now; // normalized to 60fps

    prHandleInput(dt);
    if (PR.mode === 'bot') prBotUpdate(dt);
    PR.players.forEach(function (p, i) { prPhysics(p, dt); prCheckCheckpoints(p, i); });
    prDraw();
    prUpdateHUD();

    PR.animFrame = requestAnimationFrame(prLoop);
  }

  function prHandleInput(dt) {
    var p = PR.players[0];
    if (p.finished) return;
    if (PR.keys['ArrowUp'])    p.speed = Math.min(p.speed + p.accel * dt, p.maxSpeed);
    if (PR.keys['ArrowDown'])  p.speed = Math.max(p.speed - p.accel * 2 * dt, -p.maxSpeed * 0.4);
    if (PR.keys['ArrowLeft'])  p.angle -= p.steer * dt * (p.speed / p.maxSpeed);
    if (PR.keys['ArrowRight']) p.angle += p.steer * dt * (p.speed / p.maxSpeed);
    // P2 PvP
    if (PR.mode === 'pvp') {
      var p2 = PR.players[1];
      if (!p2.finished) {
        if (PR.keys['w'] || PR.keys['W']) p2.speed = Math.min(p2.speed + p2.accel * dt, p2.maxSpeed);
        if (PR.keys['s'] || PR.keys['S']) p2.speed = Math.max(p2.speed - p2.accel * 2 * dt, -p2.maxSpeed * 0.4);
        if (PR.keys['a'] || PR.keys['A']) p2.angle -= p2.steer * dt * (p2.speed / p2.maxSpeed);
        if (PR.keys['d'] || PR.keys['D']) p2.angle += p2.steer * dt * (p2.speed / p2.maxSpeed);
      }
    }
  }

  function prPhysics(p, dt) {
    p.speed *= Math.pow(p.friction, dt);
    p.x += Math.sin(p.angle) * p.speed * dt;
    p.y -= Math.cos(p.angle) * p.speed * dt;
    // Track boundary (simple - keep on canvas)
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }

  // ── Bot AI ────────────────────────────────────────────────────
  function prBotUpdate(dt) {
    var bot = PR.players[1];
    if (bot.finished) return;

    // Look ahead: aim for waypoint after next for smoother lines on hard
    var lookAhead = PR.diff === 'hard' ? 2 : 1;
    var wpIdx = (bot.checkpoint + lookAhead) % WAYPOINTS.length;
    var nextWP = WAYPOINTS[(bot.checkpoint + 1) % WAYPOINTS.length];
    var aimWP = WAYPOINTS[wpIdx];
    var dx = aimWP.x - bot.x, dy = aimWP.y - bot.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var targetAngle = Math.atan2(dx, -dy);

    var steerFactor = PR.diff === 'hard' ? 3.0 : 1.5;
    var diff = targetAngle - bot.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.angle += Math.sign(diff) * Math.min(Math.abs(diff), bot.steer * dt * steerFactor);

    // Hard: never brake, full speed always
    bot.speed = Math.min(bot.speed + bot.accel * dt * (PR.diff === 'hard' ? 2 : 1), bot.maxSpeed);

    var triggerDist = PR.diff === 'hard' ? 50 : 40;
    var distToNext = Math.sqrt(Math.pow(bot.x-nextWP.x,2)+Math.pow(bot.y-nextWP.y,2));
    if (distToNext < triggerDist) bot.checkpoint = (bot.checkpoint + 1) % WAYPOINTS.length;
  }

  // ── Checkpoint tracking ───────────────────────────────────────
  function prCheckCheckpoints(p, pid) {
    if (p.finished) return;
    var nextIdx = (p.checkpoint + 1) % WAYPOINTS.length;
    var wp = WAYPOINTS[nextIdx];
    var dist = Math.sqrt(Math.pow(p.x - wp.x, 2) + Math.pow(p.y - wp.y, 2));
    if (dist < 45) {
      p.checkpoint = nextIdx;
      if (nextIdx === 0) {
        p.laps++;
        if (p.laps >= LAPS_TO_WIN) { p.finished = true; prEndGame(pid); }
      }
    }
  }

  function prEndGame(winner) {
    if (PR.over) return;
    prStop();
    var names = [PR.players[0].name, PR.players[1].name];
    el('pr-result-title').textContent = '🏆 ' + names[winner] + ' Wins!';
    el('pr-result-detail').textContent = 'P1: ' + PR.players[0].laps + ' laps | ' + names[1] + ': ' + PR.players[1].laps + ' laps';
    el('pr-result').classList.remove('hidden');
    if (typeof SoundManager !== 'undefined' && SoundManager.win) SoundManager.win();
  }

  // ── HUD ───────────────────────────────────────────────────────
  function prUpdateHUD() {
    setText('pr-laps-p1', 'Lap ' + PR.players[0].laps + '/' + LAPS_TO_WIN);
    setText('pr-laps-p2', 'Lap ' + PR.players[1].laps + '/' + LAPS_TO_WIN);
  }

  // ── Draw ──────────────────────────────────────────────────────
  function prDraw() {
    var ctx = PR.ctx; if (!ctx) return;

    // Background
    ctx.fillStyle = '#0a0c18';
    ctx.fillRect(0, 0, W, H);

    // Draw track
    drawTrack(ctx);

    // Draw waypoint markers (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    WAYPOINTS.forEach(function (wp, i) {
      ctx.beginPath(); ctx.arc(wp.x, wp.y, 5, 0, Math.PI * 2); ctx.fill();
    });

    // Start/finish line
    var wp0 = WAYPOINTS[0];
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(wp0.x - 40, wp0.y - 3, 80, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('START', wp0.x, wp0.y - 8);

    // Draw cars
    PR.players.forEach(function (p) { drawCar(ctx, p); });
  }

  function drawTrack(ctx) {
    // Outer track
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (var i = 1; i < WAYPOINTS.length; i++) {
      var wp = WAYPOINTS[i];
      ctx.lineTo(wp.x, wp.y);
    }
    ctx.strokeStyle = '#2a2d4a';
    ctx.lineWidth = TRACK_WIDTH + 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner track (asphalt)
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (var j = 1; j < WAYPOINTS.length; j++) ctx.lineTo(WAYPOINTS[j].x, WAYPOINTS[j].y);
    ctx.strokeStyle = '#1a1c2e';
    ctx.lineWidth = TRACK_WIDTH;
    ctx.stroke();

    // Track edge lines
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (var k = 1; k < WAYPOINTS.length; k++) ctx.lineTo(WAYPOINTS[k].x, WAYPOINTS[k].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCar(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    // Car body
    ctx.fillStyle = p.color;
    ctx.fillRect(-CAR_W/2, -CAR_H/2, CAR_W, CAR_H);

    // Windshield
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-CAR_W/2+2, -CAR_H/2+4, CAR_W-4, CAR_H/3);

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-CAR_W/2+1, -CAR_H/2+1, CAR_W-2, 3);

    ctx.restore();
  }

})();
