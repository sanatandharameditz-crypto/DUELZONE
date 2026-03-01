// ═══════════════════════════════════════════════════════════════
// DuelZone · Bomberman Duel  (bomberman.js)
// Two players on a 13×11 grid. Place bombs to blast walls and
// each other. First to eliminate the opponent wins.
// PvP: WASD + arrow keys | PvBot: AI opponent
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var COLS = 13, ROWS = 11;
  var CELL = 36; // canvas cell size
  var BOMB_TIMER = 2200; // ms fuse
  var FLAME_DUR = 700;   // ms flame visible

  // Tile types
  var EMPTY = 0, WALL = 1, BLOCK = 2; // WALL=indestructible, BLOCK=soft

  var BM = {
    mode: 'pvp', diff: 'medium', over: false,
    grid: [], bombs: [], flames: [],
    players: [
      { x: 1, y: 1, alive: true, bombs: 1, range: 2, color: '#00e5ff', emoji: '🔵', wins: 0, name: 'Player 1' },
      { x: COLS-2, y: ROWS-2, alive: true, bombs: 1, range: 2, color: '#f50057', emoji: '🔴', wins: 0, name: 'Player 2' },
    ],
    canvas: null, ctx: null,
    animFrame: null, botTimer: null,
    lastTime: 0,
    _wired: false,
    scores: [0, 0],
    TARGET: 3,
  };

  window.bombermanInit = function () {
    if (!BM._wired) { bmWireUI(); BM._wired = true; }
    bmShowHome();
  };
  window.bombermanDestroy = function () { bmStop(); };

  function el(id) { return document.getElementById(id); }
  function on(id, fn) { var e = el(id); if (e) e.addEventListener('click', fn); }

  function bmShowHome() {
    bmStop();
    el('bm-home').classList.remove('hidden');
    el('bm-play').classList.add('hidden');
  }

  function bmWireUI() {
    on('bm-back-hub',   function () { bmStop(); showHub(); });
    on('bm-back-play',  function () { bmStop(); bmShowHome(); });
    on('bm-again',      function () { bmNewRound(); });
    on('bm-result-hub', function () { bmStop(); showHub(); });
    on('bm-start-btn',  function () { bmStartGame(); });

    on('bm-mode-pvp', function () {
      BM.mode = 'pvp';
      el('bm-mode-pvp').classList.add('active');
      el('bm-mode-bot').classList.remove('active');
      var bs = el('bm-bot-settings'); if (bs) bs.classList.add('hidden');
    });
    on('bm-mode-bot', function () {
      BM.mode = 'bot';
      el('bm-mode-bot').classList.add('active');
      el('bm-mode-pvp').classList.remove('active');
      var bs = el('bm-bot-settings'); if (bs) bs.classList.remove('hidden');
    });

    document.querySelectorAll('.bm-diff').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.bm-diff').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); BM.diff = b.dataset.diff;
      });
    });

    document.addEventListener('keydown', bmKeyDown);
    document.addEventListener('keyup', bmKeyUp);
  }

  var keysDown = {};
  function bmKeyDown(e) {
    if (BM.over || !el('bm-play') || el('bm-play').classList.contains('hidden')) return;
    keysDown[e.key] = true;

    // P1: WASD + Space bomb
    if (e.key === ' ') { e.preventDefault(); bmPlaceBomb(0); }
    // P2: Arrows + Enter bomb
    if (e.key === 'Enter') { e.preventDefault(); bmPlaceBomb(1); }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key) !== -1) e.preventDefault();
  }
  function bmKeyUp(e) { keysDown[e.key] = false; }

  var moveAccum = [0, 0];
  var MOVE_DELAY = 160; // ms between moves

  function bmStop() {
    BM.over = true;
    if (BM.animFrame) { cancelAnimationFrame(BM.animFrame); BM.animFrame = null; }
    if (BM.botTimer) { clearTimeout(BM.botTimer); BM.botTimer = null; }
    BM.bombs.forEach(function (b) { if (b.timer) clearTimeout(b.timer); });
  }

  // ── Grid generation ───────────────────────────────────────────
  function makeGrid() {
    var g = [];
    for (var r = 0; r < ROWS; r++) {
      g[r] = [];
      for (var c = 0; c < COLS; c++) {
        // Border
        if (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1) { g[r][c] = WALL; }
        // Pillar walls (every 2)
        else if (r % 2 === 0 && c % 2 === 0) { g[r][c] = WALL; }
        // Spawn zones clear
        else if ((r <= 2 && c <= 2) || (r >= ROWS-3 && c >= COLS-3)) { g[r][c] = EMPTY; }
        // Random soft blocks
        else { g[r][c] = Math.random() < 0.55 ? BLOCK : EMPTY; }
      }
    }
    return g;
  }

  // ── Start game ────────────────────────────────────────────────
  function bmStartGame() {
    BM.scores = [0, 0];
    BM.players[0].wins = 0; BM.players[1].wins = 0;
    BM.players[1].name = BM.mode === 'bot' ? '🤖 Bot' : 'Player 2';

    el('bm-home').classList.add('hidden');
    el('bm-play').classList.remove('hidden');
    el('bm-result').classList.add('hidden');

    var canvas = el('bm-canvas');
    if (canvas) {
      canvas.width = COLS * CELL;
      canvas.height = ROWS * CELL;
      BM.canvas = canvas; BM.ctx = canvas.getContext('2d');
    }
    bmNewRound();
  }

  function bmNewRound() {
    bmStop();
    BM.over = false;
    BM.grid = makeGrid();
    BM.bombs = []; BM.flames = [];

    BM.players[0] = Object.assign(BM.players[0], { x: 1, y: 1, alive: true, bombs: 1, range: 2 });
    BM.players[1] = Object.assign(BM.players[1], { x: COLS-2, y: ROWS-2, alive: true, bombs: 1, range: 2 });

    moveAccum = [0, 0];
    el('bm-result').classList.add('hidden');
    bmUpdateScores();
    BM.lastTime = performance.now();
    BM.animFrame = requestAnimationFrame(bmLoop);
    if (BM.mode === 'bot') bmBotSchedule();
  }

  // ── Main loop ─────────────────────────────────────────────────
  function bmLoop(now) {
    if (BM.over) return;
    var dt = now - BM.lastTime; BM.lastTime = now;

    // Player 1 movement
    moveAccum[0] += dt;
    if (moveAccum[0] >= MOVE_DELAY) {
      moveAccum[0] = 0;
      if (keysDown['w'] || keysDown['W']) bmMovePlayer(0, 0, -1);
      else if (keysDown['s'] || keysDown['S']) bmMovePlayer(0, 0, 1);
      else if (keysDown['a'] || keysDown['A']) bmMovePlayer(0, -1, 0);
      else if (keysDown['d'] || keysDown['D']) bmMovePlayer(0, 1, 0);
    }

    // Player 2 movement (PvP)
    if (BM.mode === 'pvp') {
      moveAccum[1] += dt;
      if (moveAccum[1] >= MOVE_DELAY) {
        moveAccum[1] = 0;
        if (keysDown['ArrowUp'])    bmMovePlayer(1, 0, -1);
        else if (keysDown['ArrowDown'])  bmMovePlayer(1, 0, 1);
        else if (keysDown['ArrowLeft'])  bmMovePlayer(1, -1, 0);
        else if (keysDown['ArrowRight']) bmMovePlayer(1, 1, 0);
      }
    }

    bmDraw();
    BM.animFrame = requestAnimationFrame(bmLoop);
  }

  function bmMovePlayer(pid, dx, dy) {
    var p = BM.players[pid];
    if (!p.alive) return;
    var nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
    if (BM.grid[ny][nx] !== EMPTY) return;
    // Check bomb collision
    var onBomb = BM.bombs.some(function (b) { return b.x === nx && b.y === ny; });
    if (onBomb) return;
    p.x = nx; p.y = ny;
  }

  // ── Bombs ─────────────────────────────────────────────────────
  function bmPlaceBomb(pid) {
    var p = BM.players[pid];
    if (!p.alive || BM.over) return;
    // Max 1 bomb at a time per player (upgradeable later)
    var hasBomb = BM.bombs.some(function (b) { return b.owner === pid; });
    if (hasBomb) return;
    var bomb = { x: p.x, y: p.y, owner: pid, range: p.range, timer: null };
    BM.bombs.push(bomb);
    bomb.timer = setTimeout(function () { bmExplode(bomb); }, BOMB_TIMER);
  }

  function bmExplode(bomb) {
    // Remove bomb
    BM.bombs = BM.bombs.filter(function (b) { return b !== bomb; });
    var cx = bomb.x, cy = bomb.y;
    var newFlames = [{ x: cx, y: cy, t: Date.now() }];

    // 4 directions
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(function (dir) {
      for (var i = 1; i <= bomb.range; i++) {
        var nx = cx + dir[0] * i, ny = cy + dir[1] * i;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) break;
        if (BM.grid[ny][nx] === WALL) break;
        newFlames.push({ x: nx, y: ny, t: Date.now() });
        if (BM.grid[ny][nx] === BLOCK) { BM.grid[ny][nx] = EMPTY; break; }
        // Chain bombs
        BM.bombs.forEach(function (b) { if (b.x === nx && b.y === ny) { clearTimeout(b.timer); setTimeout(function(){bmExplode(b);},1); }});
      }
    });

    BM.flames = BM.flames.concat(newFlames);

    // Check player kills
    newFlames.forEach(function (f) {
      BM.players.forEach(function (p, i) {
        if (p.alive && p.x === f.x && p.y === f.y) {
          p.alive = false;
          setTimeout(function () { bmCheckRoundEnd(); }, 100);
        }
      });
    });

    // Clean up flames after duration
    setTimeout(function () {
      var now = Date.now();
      BM.flames = BM.flames.filter(function (f) { return now - f.t < FLAME_DUR; });
    }, FLAME_DUR + 50);
  }

  function bmCheckRoundEnd() {
    var alive0 = BM.players[0].alive, alive1 = BM.players[1].alive;
    if (alive0 && !alive1) { BM.scores[0]++; bmRoundOver(0); }
    else if (!alive0 && alive1) { BM.scores[1]++; bmRoundOver(1); }
    else if (!alive0 && !alive1) { bmRoundOver(-1); } // draw
  }

  function bmRoundOver(winner) {
    BM.over = true;
    bmUpdateScores();
    if (winner >= 0 && BM.scores[winner] >= BM.TARGET) {
      bmShowFinalResult(winner);
    } else {
      // Next round after delay
      setTimeout(bmNewRound, 1800);
    }
  }

  function bmShowFinalResult(winner) {
    var names = [BM.players[0].name, BM.players[1].name];
    el('bm-result-title').textContent = winner >= 0 ? '🏆 ' + names[winner] + ' Wins the Match!' : '🤝 Draw!';
    el('bm-result-detail').textContent = BM.scores[0] + ' – ' + BM.scores[1] + ' rounds';
    el('bm-result').classList.remove('hidden');
    if (typeof SoundManager !== 'undefined' && SoundManager.win) SoundManager.win();
  }

  function bmUpdateScores() {
    var s0 = el('bm-score-p1'), s1 = el('bm-score-p2');
    if (s0) s0.textContent = '⭐ ' + BM.scores[0];
    if (s1) s1.textContent = '⭐ ' + BM.scores[1];
    var n1 = el('bm-p2-name');
    if (n1) n1.textContent = BM.players[1].name;
  }

  // ── Draw ──────────────────────────────────────────────────────
  var COLORS = { wall: '#2a2d4a', block: '#4a3d2a', empty: '#0a0c18', flame: '#ff6d00' };

  function bmDraw() {
    var ctx = BM.ctx;
    if (!ctx) return;
    ctx.fillStyle = '#07080f';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Grid
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var t = BM.grid[r][c];
        if (t === WALL) {
          ctx.fillStyle = '#1e2038';
          ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(c*CELL+1, r*CELL+1, CELL-2, 4);
        } else if (t === BLOCK) {
          ctx.fillStyle = '#3d2e0e';
          ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
          ctx.strokeStyle = '#5a4420'; ctx.lineWidth = 1.5;
          ctx.strokeRect(c*CELL+2, r*CELL+2, CELL-4, CELL-4);
        } else {
          ctx.fillStyle = '#0e1020';
          ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
          ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.5;
          ctx.strokeRect(c*CELL, r*CELL, CELL, CELL);
        }
      }
    }

    // Flames
    var now = Date.now();
    BM.flames.forEach(function (f) {
      var age = now - f.t;
      if (age < FLAME_DUR) {
        var alpha = 1 - age / FLAME_DUR;
        ctx.fillStyle = 'rgba(255,110,0,' + alpha + ')';
        ctx.fillRect(f.x*CELL+2, f.y*CELL+2, CELL-4, CELL-4);
        ctx.fillStyle = 'rgba(255,220,0,' + (alpha*0.7) + ')';
        ctx.fillRect(f.x*CELL+8, f.y*CELL+8, CELL-16, CELL-16);
      }
    });

    // Bombs
    BM.bombs.forEach(function (b) {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(b.x*CELL+CELL/2, b.y*CELL+CELL/2, CELL/2-4, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ff6d00';
      ctx.font = Math.floor(CELL*0.6)+'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💣', b.x*CELL+CELL/2, b.y*CELL+CELL/2+2);
    });

    // Players
    BM.players.forEach(function (p) {
      if (!p.alive) return;
      ctx.font = Math.floor(CELL*0.72)+'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.x*CELL+CELL/2, p.y*CELL+CELL/2+2);
    });
  }

  // ── Bot AI ────────────────────────────────────────────────────
  function bmBotSchedule() {
    if (BM.over || !BM.players[1].alive) return;
    var delay = { easy: 600, medium: 350, hard: 80 }[BM.diff] || 350;
    BM.botTimer = setTimeout(function () {
      if (BM.over || !BM.players[1].alive) return;
      bmBotAct();
      bmBotSchedule();
    }, delay + Math.random() * (BM.diff === 'hard' ? 40 : 200));
  }

  // Check if a cell is dangerous (flame or bomb blast radius)
  function bmCellDangerous(cx, cy) {
    var now = Date.now();
    if (BM.flames.some(function(f){ return f.x===cx&&f.y===cy&&(now-f.t)<FLAME_DUR; })) return true;
    // Check if in blast radius of any bomb
    for (var bi=0; bi<BM.bombs.length; bi++) {
      var b=BM.bombs[bi];
      if (b.x===cx&&b.y===cy) return true;
      var dirs2=[[-1,0],[1,0],[0,-1],[0,1]];
      for (var di=0; di<dirs2.length; di++) {
        for (var ri=1; ri<=b.range; ri++) {
          var bx=b.x+dirs2[di][0]*ri, by=b.y+dirs2[di][1]*ri;
          if (bx<0||by<0||bx>=COLS||by>=ROWS||BM.grid[by][bx]===WALL) break;
          if (bx===cx&&by===cy) return true;
          if (BM.grid[by][bx]===BLOCK) break;
        }
      }
    }
    return false;
  }

  function bmBotAct() {
    var bot = BM.players[1];
    var p1 = BM.players[0];
    var dx = p1.x - bot.x, dy = p1.y - bot.y;
    var inDanger = bmCellDangerous(bot.x, bot.y);

    if (inDanger) {
      bmBotFleeSafely(bot); return;
    }

    if (BM.diff === 'hard') {
      // Hard: predict, trap, and always flee after bombing
      var distToP1 = Math.abs(dx) + Math.abs(dy);
      var hasBomb = BM.bombs.some(function(b){ return b.owner===1; });

      // If very close and no bomb active, place bomb then flee
      if (!hasBomb && distToP1 <= 2) {
        bmPlaceBomb(1);
        bmBotFleeSafely(bot);
        return;
      }
      // If bomb placed, flee to safety
      if (hasBomb) {
        bmBotFleeSafely(bot);
        return;
      }
      // Move toward player using BFS
      bmBotBFSMove(bot, p1.x, p1.y);
    } else {
      // Easy/Medium: simple approach
      if (Math.abs(dx) + Math.abs(dy) <= 2) {
        bmPlaceBomb(1);
        bmBotMoveRandom(bot);
        return;
      }
      var dirs = [];
      if (Math.abs(dx) > Math.abs(dy)) {
        dirs.push([dx > 0 ? 1 : -1, 0]);
        dirs.push([0, dy > 0 ? 1 : -1]);
      } else {
        dirs.push([0, dy > 0 ? 1 : -1]);
        dirs.push([dx > 0 ? 1 : -1, 0]);
      }
      dirs.push([-1, 0]); dirs.push([1, 0]); dirs.push([0, -1]); dirs.push([0, 1]);
      for (var i = 0; i < dirs.length; i++) {
        var nx = bot.x + dirs[i][0], ny = bot.y + dirs[i][1];
        if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && BM.grid[ny][nx] === EMPTY &&
            !BM.bombs.some(function(b){return b.x===nx&&b.y===ny;})) {
          bot.x = nx; bot.y = ny; return;
        }
      }
    }
  }

  // BFS to move one step toward target, avoiding danger
  function bmBotBFSMove(bot, tx, ty) {
    var queue = [{x:bot.x,y:bot.y,path:[]}];
    var visited = {};
    visited[bot.x+','+bot.y] = true;
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    while (queue.length) {
      var cur = queue.shift();
      for (var i=0; i<dirs.length; i++) {
        var nx=cur.x+dirs[i][0], ny=cur.y+dirs[i][1];
        if (nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
        if (BM.grid[ny][nx]!==EMPTY) continue;
        if (BM.bombs.some(function(b){return b.x===nx&&b.y===ny;})) continue;
        if (visited[nx+','+ny]) continue;
        visited[nx+','+ny]=true;
        var newPath = cur.path.concat([[nx,ny]]);
        if (nx===tx&&ny===ty) {
          if (newPath.length>0&&!bmCellDangerous(newPath[0][0],newPath[0][1])) {
            bot.x=newPath[0][0]; bot.y=newPath[0][1];
          } else if (newPath.length>0) {
            bmBotFleeSafely(bot);
          }
          return;
        }
        queue.push({x:nx,y:ny,path:newPath});
      }
    }
    bmBotMoveRandom(bot);
  }

  // Flee to the nearest safe cell
  function bmBotFleeSafely(bot) {
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    dirs.sort(function(){return Math.random()-0.5;});
    // Prefer non-dangerous cells
    var safeDirs = dirs.filter(function(d){
      var nx=bot.x+d[0], ny=bot.y+d[1];
      return nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&BM.grid[ny][nx]===EMPTY&&
             !BM.bombs.some(function(b){return b.x===nx&&b.y===ny;})&&
             !bmCellDangerous(nx,ny);
    });
    if (safeDirs.length>0) { bot.x+=safeDirs[0][0]; bot.y+=safeDirs[0][1]; return; }
    // Fallback: any walkable cell
    for (var i=0; i<dirs.length; i++) {
      var nx=bot.x+dirs[i][0], ny=bot.y+dirs[i][1];
      if (nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&BM.grid[ny][nx]===EMPTY&&
          !BM.bombs.some(function(b){return b.x===nx&&b.y===ny;})) {
        bot.x=nx; bot.y=ny; return;
      }
    }
  }

  function bmBotMoveRandom(bot) {
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    dirs.sort(function(){return Math.random()-0.5;});
    for (var i = 0; i < dirs.length; i++) {
      var nx = bot.x+dirs[i][0], ny = bot.y+dirs[i][1];
      if (nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&BM.grid[ny][nx]===EMPTY&&
          !bmCellDangerous(nx,ny)) {
        bot.x=nx; bot.y=ny; return;
      }
    }
  }

})();
