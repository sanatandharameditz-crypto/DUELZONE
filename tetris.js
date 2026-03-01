// ═══════════════════════════════════════════════════════════════
// DuelZone · Tetris Battle  (tetris.js)
// Two side-by-side Tetris boards. Clearing lines sends garbage
// rows to your opponent. First to top out loses.
// PvP: Both humans | PvBot: P2 is AI
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var COLS = 10, ROWS = 20;
  var CELL = 28; // px per cell

  var PIECES = [
    { shape: [[1,1,1,1]],                         color: '#00e5ff' }, // I
    { shape: [[1,1],[1,1]],                        color: '#ffd600' }, // O
    { shape: [[0,1,0],[1,1,1]],                    color: '#aa00ff' }, // T
    { shape: [[0,1,1],[1,1,0]],                    color: '#00e676' }, // S
    { shape: [[1,1,0],[0,1,1]],                    color: '#ff1744' }, // Z
    { shape: [[1,0,0],[1,1,1]],                    color: '#ff6d00' }, // J
    { shape: [[0,0,1],[1,1,1]],                    color: '#2979ff' }, // L
  ];

  var TB = {
    mode: 'pvp', diff: 'medium', over: false,
    players: [
      { board: null, piece: null, next: null, score: 0, lines: 0, level: 1, lost: false, garbage: 0, interval: null, canvas: null, ctx: null, nextCanvas: null, nextCtx: null },
      { board: null, piece: null, next: null, score: 0, lines: 0, level: 1, lost: false, garbage: 0, interval: null, canvas: null, ctx: null, nextCanvas: null, nextCtx: null },
    ],
    botTimer: null,
    _wired: false,
  };

  window.tetrisInit = function () {
    if (!TB._wired) { tbWireUI(); TB._wired = true; }
    tbShowHome();
  };
  window.tetrisDestroy = function () { tbStop(); };

  function el(id) { return document.getElementById(id); }
  function on(id, fn) { var e = el(id); if (e) e.addEventListener('click', fn); }

  function tbShowHome() {
    tbStop();
    el('tetris-home').classList.remove('hidden');
    el('tetris-play').classList.add('hidden');
  }

  function tbWireUI() {
    on('tetris-back-hub', function () { tbStop(); showHub(); });
    on('tetris-back-play', function () { tbStop(); tbShowHome(); });
    on('tetris-again', function () { tbStartGame(); });
    on('tetris-result-hub', function () { tbStop(); showHub(); });
    on('tetris-start-btn', function () { tbStartGame(); });

    on('tetris-mode-pvp', function () {
      TB.mode = 'pvp';
      el('tetris-mode-pvp').classList.add('active');
      el('tetris-mode-bot').classList.remove('active');
      var bs = el('tetris-bot-settings'); if (bs) bs.classList.add('hidden');
    });
    on('tetris-mode-bot', function () {
      TB.mode = 'bot';
      el('tetris-mode-bot').classList.add('active');
      el('tetris-mode-pvp').classList.remove('active');
      var bs = el('tetris-bot-settings'); if (bs) bs.classList.remove('hidden');
    });

    document.querySelectorAll('.tetris-diff').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.tetris-diff').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); TB.diff = b.dataset.diff;
      });
    });

    // Keyboard controls
    document.addEventListener('keydown', tbKeyDown);
  }

  var KEY_MAP = {
    ArrowLeft:  function () { tbMove(0, -1, 0); },
    ArrowRight: function () { tbMove(0, 1, 0); },
    ArrowDown:  function () { tbMove(0, 0, 1); },
    ArrowUp:    function () { tbRotate(0); },
    ' ':        function () { tbHardDrop(0); },
    'a':        function () { tbMove(1, -1, 0); },
    'd':        function () { tbMove(1, 1, 0); },
    's':        function () { tbMove(1, 0, 1); },
    'w':        function () { tbRotate(1); },
    'q':        function () { tbHardDrop(1); },
  };

  function tbKeyDown(e) {
    if (TB.over) return;
    if (!el('tetris-play') || el('tetris-play').classList.contains('hidden')) return;
    var fn = KEY_MAP[e.key];
    if (fn) { e.preventDefault(); fn(); }
    // P2 keys only if PvP
    if (TB.mode === 'bot' && (e.key === 'a' || e.key === 'd' || e.key === 's' || e.key === 'w' || e.key === 'q')) return;
  }

  function tbStop() {
    TB.over = true;
    TB.players.forEach(function (p) {
      if (p.interval) { clearInterval(p.interval); p.interval = null; }
    });
    if (TB.botTimer) { clearTimeout(TB.botTimer); TB.botTimer = null; }
  }

  // ── Board helpers ─────────────────────────────────────────────
  function makeBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) { b[r] = []; for (var c = 0; c < COLS; c++) b[r][c] = 0; }
    return b;
  }

  function randomPiece() {
    var t = PIECES[Math.floor(Math.random() * PIECES.length)];
    return { shape: t.shape, color: t.color, x: Math.floor(COLS / 2) - Math.floor(t.shape[0].length / 2), y: 0 };
  }

  function collides(board, piece, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var r = 0; r < piece.shape.length; r++) {
      for (var c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        var nr = piece.y + r + oy, nc = piece.x + c + ox;
        if (nr >= ROWS || nc < 0 || nc >= COLS) return true;
        if (nr >= 0 && board[nr][nc]) return true;
      }
    }
    return false;
  }

  function rotate(shape) {
    return shape[0].map(function (_, ci) {
      return shape.map(function (row) { return row[ci]; }).reverse();
    });
  }

  function lock(pid) {
    var p = TB.players[pid];
    var b = p.board;
    p.piece.shape.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (v) {
          var nr = p.piece.y + r, nc = p.piece.x + c;
          if (nr < 0) { p.lost = true; return; }
          b[nr][nc] = p.piece.color;
        }
      });
    });

    // Clear lines
    var cleared = 0;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (b[r].every(function (cell) { return !!cell; })) {
        b.splice(r, 1);
        b.unshift(new Array(COLS).fill(0));
        cleared++; r++;
      }
    }
    if (cleared > 0) {
      p.lines += cleared;
      p.score += [0, 100, 300, 500, 800][cleared] * p.level;
      p.level = Math.floor(p.lines / 10) + 1;
      // Send garbage to opponent
      var garbage = cleared > 1 ? cleared - 1 : 0;
      if (garbage > 0) {
        var opp = TB.players[1 - pid];
        opp.garbage += garbage;
        tbAddGarbage(1 - pid, garbage);
      }
    }

    // Apply pending garbage received
    if (p.garbage > 0) {
      tbAddGarbage(pid, p.garbage);
      p.garbage = 0;
    }

    // Next piece
    p.piece = p.next;
    p.next = randomPiece();
    if (collides(p.board, p.piece, 0, 0)) { p.lost = true; }
    tbUpdateUI(pid);
    tbDrawNext(pid);
  }

  function tbAddGarbage(pid, count) {
    var b = TB.players[pid].board;
    for (var i = 0; i < count; i++) {
      b.shift();
      var hole = Math.floor(Math.random() * COLS);
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(c === hole ? 0 : '#555');
      b.push(row);
    }
  }

  // ── Actions ───────────────────────────────────────────────────
  function tbMove(pid, dx, dy) {
    var p = TB.players[pid];
    if (!p.piece || p.lost || TB.over) return;
    if (!collides(p.board, p.piece, dx, dy)) {
      p.piece.x += dx; p.piece.y += dy;
      tbDraw(pid);
    } else if (dy > 0) {
      lock(pid);
      if (p.lost) { tbEndGame(1 - pid); }
    }
  }

  function tbRotate(pid) {
    var p = TB.players[pid];
    if (!p.piece || p.lost || TB.over) return;
    var rotated = rotate(p.piece.shape);
    var old = p.piece.shape;
    p.piece.shape = rotated;
    // Wall kick
    if (collides(p.board, p.piece, 0, 0)) {
      if (!collides(p.board, p.piece, 1, 0)) p.piece.x += 1;
      else if (!collides(p.board, p.piece, -1, 0)) p.piece.x -= 1;
      else p.piece.shape = old;
    }
    tbDraw(pid);
  }

  function tbHardDrop(pid) {
    var p = TB.players[pid];
    if (!p.piece || p.lost || TB.over) return;
    while (!collides(p.board, p.piece, 0, 1)) { p.piece.y++; p.score += 2; }
    lock(pid);
    if (p.lost) tbEndGame(1 - pid);
  }

  // ── Start game ────────────────────────────────────────────────
  function tbStartGame() {
    tbStop();
    TB.over = false;

    el('tetris-home').classList.add('hidden');
    el('tetris-play').classList.remove('hidden');
    el('tetris-result').classList.add('hidden');

    var p2name = TB.mode === 'bot' ? '🤖 Bot' : 'Player 2';
    var p2label = el('tetris-p2-label');
    if (p2label) p2label.textContent = p2name;

    // Init canvases
    TB.players.forEach(function (p, i) {
      p.board = makeBoard();
      p.piece = randomPiece();
      p.next = randomPiece();
      p.score = 0; p.lines = 0; p.level = 1; p.lost = false; p.garbage = 0;

      var canvas = el('tetris-canvas-p' + (i + 1));
      if (canvas) {
        canvas.width = COLS * CELL;
        canvas.height = ROWS * CELL;
        p.canvas = canvas;
        p.ctx = canvas.getContext('2d');
      }
      var nc = el('tetris-next-p' + (i + 1));
      if (nc) {
        nc.width = 4 * CELL; nc.height = 4 * CELL;
        p.nextCanvas = nc; p.nextCtx = nc.getContext('2d');
      }
      tbDraw(i); tbDrawNext(i); tbUpdateUI(i);
    });

    // P2 controls visibility
    var p2ctrl = el('tetris-p2-keys');
    if (p2ctrl) p2ctrl.style.display = TB.mode === 'bot' ? 'none' : '';

    // Game loops
    TB.players.forEach(function (p, i) {
      var delay = Math.max(100, 800 - (p.level - 1) * 70);
      p.interval = setInterval(function () {
        if (TB.over || p.lost) return;
        tbMove(i, 0, 1);
      }, delay);
    });

    if (TB.mode === 'bot') tbBotLoop();
  }

  // ── Bot ───────────────────────────────────────────────────────
  function tbBotLoop() {
    if (TB.over || TB.players[1].lost) return;
    var delay = { easy: 600, medium: 300, hard: 0 }[TB.diff] || 300;
    TB.botTimer = setTimeout(function () {
      if (TB.over || TB.players[1].lost) return;
      tbBotMove();
      tbBotLoop();
    }, delay + Math.random() * 200);
  }

  function tbBotMove() {
    var p = TB.players[1];
    if (!p.piece) return;
    // Simple: find best column to drop current piece
    var best = { score: -Infinity, x: p.piece.x, rotations: 0 };
    var testPiece = { shape: p.piece.shape.map(function (r) { return r.slice(); }), x: p.piece.x, y: p.piece.y, color: p.piece.color };

    for (var rot = 0; rot < 4; rot++) {
      for (var col = -2; col < COLS; col++) {
        var tp = { shape: testPiece.shape, x: col, y: 0, color: testPiece.color };
        if (collides(p.board, tp, 0, 0)) continue;
        // Drop
        while (!collides(p.board, tp, 0, 1)) tp.y++;
        var sc = evalBoard(p.board, tp);
        if (sc > best.score) { best = { score: sc, x: col, rotations: rot }; }
      }
      testPiece.shape = rotate(testPiece.shape);
    }

    // Apply best rotations and x
    for (var r = 0; r < best.rotations; r++) tbRotate(1);
    if (p.piece.x < best.x) tbMove(1, 1, 0);
    else if (p.piece.x > best.x) tbMove(1, -1, 0);
    else tbMove(1, 0, 1);
  }

  function evalBoard(board, piece) {
    // Clone board and place piece
    var b = board.map(function (r) { return r.slice(); });
    piece.shape.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (v) { var nr = piece.y + r, nc = piece.x + c; if (nr >= 0 && nr < ROWS) b[nr][nc] = 1; }
      });
    });
    // Heuristics: lines cleared - holes - bumpiness - height
    var cleared = 0, holes = 0, heights = [], bumpiness = 0;
    for (var c = 0; c < COLS; c++) {
      var h = 0, found = false;
      for (var rr = 0; rr < ROWS; rr++) {
        if (b[rr][c] && !found) { h = ROWS - rr; found = true; }
        if (found && !b[rr][c]) holes++;
      }
      heights.push(h);
    }
    for (var i = 1; i < heights.length; i++) bumpiness += Math.abs(heights[i] - heights[i - 1]);
    var maxH = Math.max.apply(null, heights);
    // Count complete lines for scoring
    for (var rr2 = 0; rr2 < ROWS; rr2++) {
      if (b[rr2].every(function(v){ return v; })) cleared++;
    }
    if (TB.diff === 'hard') {
      // Near-perfect weights derived from academic research
      return -0.510066 * maxH - 0.760666 * holes - 0.184483 * bumpiness + 0.260000 * cleared * cleared;
    }
    return -0.51 * maxH - 0.36 * holes - 0.18 * bumpiness + 0.76 * cleared;
  }

  // ── Draw ──────────────────────────────────────────────────────
  function tbDraw(pid) {
    var p = TB.players[pid];
    if (!p.ctx) return;
    var ctx = p.ctx;
    ctx.fillStyle = '#07080f';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (var r = 0; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke(); }
    for (var c = 0; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke(); }

    // Board cells
    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        if (p.board[row][col]) drawCell(ctx, col, row, p.board[row][col]);
      }
    }

    // Ghost piece
    if (p.piece) {
      var ghost = { shape: p.piece.shape, x: p.piece.x, y: p.piece.y, color: p.piece.color };
      while (!collides(p.board, ghost, 0, 1)) ghost.y++;
      ghost.shape.forEach(function (row, r) {
        row.forEach(function (v, c) {
          if (v) {
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect((ghost.x + c) * CELL + 1, (ghost.y + r) * CELL + 1, CELL - 2, CELL - 2);
          }
        });
      });

      // Active piece
      p.piece.shape.forEach(function (row, r) {
        row.forEach(function (v, c) { if (v) drawCell(ctx, p.piece.x + c, p.piece.y + r, p.piece.color); });
      });
    }
  }

  function tbDrawNext(pid) {
    var p = TB.players[pid];
    if (!p.nextCtx || !p.next) return;
    var ctx = p.nextCtx;
    ctx.fillStyle = '#0a0c18';
    ctx.fillRect(0, 0, 4 * CELL, 4 * CELL);
    var offX = Math.floor((4 - p.next.shape[0].length) / 2);
    var offY = Math.floor((4 - p.next.shape.length) / 2);
    p.next.shape.forEach(function (row, r) {
      row.forEach(function (v, c) { if (v) drawCell(ctx, offX + c, offY + r, p.next.color); });
    });
  }

  function drawCell(ctx, c, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 3);
    ctx.fillRect(c * CELL + 1, r * CELL + 1, 3, CELL - 2);
  }

  function tbUpdateUI(pid) {
    var p = TB.players[pid];
    var suf = pid + 1;
    var se = el('tetris-score-p' + suf);
    var le = el('tetris-lines-p' + suf);
    var lve = el('tetris-level-p' + suf);
    if (se) se.textContent = p.score;
    if (le) le.textContent = p.lines;
    if (lve) lve.textContent = p.level;
  }

  // ── End game ──────────────────────────────────────────────────
  function tbEndGame(winner) {
    if (TB.over) return;
    tbStop();
    var names = ['Player 1', TB.mode === 'bot' ? 'Bot' : 'Player 2'];
    el('tetris-result-title').textContent = '🏆 ' + names[winner] + ' Wins!';
    el('tetris-result-detail').textContent = 'Scores: P1 ' + TB.players[0].score + ' | ' + names[1] + ' ' + TB.players[1].score;
    el('tetris-result').classList.remove('hidden');
    if (typeof SoundManager !== 'undefined' && SoundManager.win) SoundManager.win();
  }

})();
