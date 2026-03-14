// ═══════════════════════════════════════════════════════
//  MINESWEEPER — Mobile-First Edition
//  Solo classic minesweeper, touch-optimised
// ═══════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Config ───────────────────────────────────────────
  var DIFFS = {
    easy:   { rows: 9,  cols: 9,  mines: 10 },
    medium: { rows: 16, cols: 12, mines: 25 },
    hard:   { rows: 20, cols: 14, mines: 50 }
  };

  // ── State ────────────────────────────────────────────
  var ms = {
    diff:      'easy',
    rows:      0,
    cols:      0,
    mines:     0,
    board:     [],   // flat array of cell objects
    revealed:  0,
    flagged:   0,
    safeTotal: 0,
    started:   false,
    over:      false,
    won:       false,
    flagMode:  false,
    timerVal:  0,
    timerID:   null
  };

  // ── DOM helpers ──────────────────────────────────────
  function q(id)  { return document.getElementById(id); }

  // ── Init / wiring ────────────────────────────────────
  (function wire() {
    // Difficulty pills
    document.querySelectorAll('.mine-diff').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mine-diff').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        ms.diff = btn.getAttribute('data-diff');
      });
    });

    // Start
    var startBtn = q('mine-start-btn');
    if (startBtn) startBtn.addEventListener('click', mineStartGame);

    // Back from home to hub
    var backHub = q('mine-back-hub');
    if (backHub) backHub.addEventListener('click', function () {
      if (typeof showHub === 'function') showHub();
    });

    // Back during play → home panel
    var backPlay = q('mine-back-play');
    if (backPlay) backPlay.addEventListener('click', mineBackToHome);

    // Result hub
    var resHub = q('mine-result-hub');
    if (resHub) resHub.addEventListener('click', function () {
      if (typeof showHub === 'function') showHub();
    });
  })();

  // ── Public API (called from HTML) ───────────────────
  window.mineToggleFlag = function () { msFlagToggle(); };
  window.mineNewGame    = function () { mineStartGame(); };

  // ── Start / reset game ───────────────────────────────
  function mineStartGame() {
    var cfg = DIFFS[ms.diff] || DIFFS.easy;
    ms.rows      = cfg.rows;
    ms.cols      = cfg.cols;
    ms.mines     = cfg.mines;
    ms.board     = [];
    ms.revealed  = 0;
    ms.flagged   = 0;
    ms.safeTotal = ms.rows * ms.cols - ms.mines;
    ms.started   = false;
    ms.over      = false;
    ms.won       = false;
    ms.flagMode  = false;

    msStopTimer();
    ms.timerVal  = 0;

    // Show play panel
    var home = q('mine-home'), play = q('mine-play');
    if (home) home.classList.add('hidden');
    if (play) play.classList.remove('hidden');
    var bp = q('mine-back-play'); if (bp) bp.style.display = 'block';

    // Hide result
    var res = q('mine-result'); if (res) res.classList.add('hidden');

    // Reset flag toggle UI
    var ft = q('mine-flag-toggle');
    if (ft) { ft.textContent = '🚩 Flag Mode: OFF'; ft.style.borderColor = 'rgba(255,255,255,0.2)'; ft.style.color = 'rgba(255,255,255,0.7)'; }

    // Build blank board (no mines yet — placed on first tap)
    for (var i = 0; i < ms.rows * ms.cols; i++) {
      ms.board.push({ mine: false, revealed: false, flagged: false, adj: 0 });
    }

    msUpdateHUD();
    msRenderGrid();
  }

  function mineBackToHome() {
    msStopTimer();
    var home = q('mine-home'), play = q('mine-play');
    if (play) play.classList.add('hidden');
    if (home) home.classList.remove('hidden');
    var bp = q('mine-back-play'); if (bp) bp.style.display = 'none';
  }

  // ── Mine placement (deferred to first tap) ───────────
  function msPlaceMines(safeIdx) {
    var total = ms.rows * ms.cols;
    var placed = 0;
    // Exclude safe cell + all its neighbours from mine placement
    var safe = {};
    safe[safeIdx] = true;
    var sr = Math.floor(safeIdx / ms.cols), sc = safeIdx % ms.cols;
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var rr = sr + dr, cc = sc + dc;
        if (rr >= 0 && rr < ms.rows && cc >= 0 && cc < ms.cols) {
          safe[rr * ms.cols + cc] = true;
        }
      }
    }
    var candidates = [];
    for (var i = 0; i < total; i++) { if (!safe[i]) candidates.push(i); }
    // Fisher-Yates shuffle, take first ms.mines
    for (var j = candidates.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = candidates[j]; candidates[j] = candidates[k]; candidates[k] = tmp;
    }
    for (var m = 0; m < ms.mines; m++) ms.board[candidates[m]].mine = true;
    // Compute adjacency numbers
    for (var idx = 0; idx < total; idx++) {
      if (ms.board[idx].mine) continue;
      var adj = 0;
      var row = Math.floor(idx / ms.cols), col = idx % ms.cols;
      for (var dr2 = -1; dr2 <= 1; dr2++) {
        for (var dc2 = -1; dc2 <= 1; dc2++) {
          if (dr2 === 0 && dc2 === 0) continue;
          var nr = row + dr2, nc = col + dc2;
          if (nr >= 0 && nr < ms.rows && nc >= 0 && nc < ms.cols) {
            if (ms.board[nr * ms.cols + nc].mine) adj++;
          }
        }
      }
      ms.board[idx].adj = adj;
    }
  }

  // ── Reveal logic ─────────────────────────────────────
  function msReveal(idx) {
    var cell = ms.board[idx];
    if (cell.revealed || cell.flagged) return;

    // First tap — place mines now so first click is safe
    if (!ms.started) {
      ms.started = true;
      msPlaceMines(idx);
      msStartTimer();
      // Recalculate adj for this cell after mines placed
      var row = Math.floor(idx / ms.cols), col = idx % ms.cols;
      var adj = 0;
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          var nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < ms.rows && nc >= 0 && nc < ms.cols) {
            if (ms.board[nr * ms.cols + nc].mine) adj++;
          }
        }
      }
      ms.board[idx].adj = adj;
    }

    cell.revealed = true;
    ms.revealed++;

    if (cell.mine) {
      msGameOver(false);
      return;
    }

    // Flood-fill on empty cells
    if (cell.adj === 0) {
      var row2 = Math.floor(idx / ms.cols), col2 = idx % ms.cols;
      for (var dr2 = -1; dr2 <= 1; dr2++) {
        for (var dc2 = -1; dc2 <= 1; dc2++) {
          if (dr2 === 0 && dc2 === 0) continue;
          var nr2 = row2 + dr2, nc2 = col2 + dc2;
          if (nr2 >= 0 && nr2 < ms.rows && nc2 >= 0 && nc2 < ms.cols) {
            var ni = nr2 * ms.cols + nc2;
            if (!ms.board[ni].revealed && !ms.board[ni].flagged) msReveal(ni);
          }
        }
      }
    }

    if (ms.revealed >= ms.safeTotal) msGameOver(true);
  }

  // ── Flag logic ───────────────────────────────────────
  function msFlag(idx) {
    var cell = ms.board[idx];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    ms.flagged += cell.flagged ? 1 : -1;
    msUpdateHUD();
    msRenderCell(idx);
  }

  function msFlagToggle() {
    ms.flagMode = !ms.flagMode;
    var ft = q('mine-flag-toggle');
    if (ft) {
      if (ms.flagMode) {
        ft.textContent = '🚩 Flag Mode: ON';
        ft.style.borderColor = '#ef4444';
        ft.style.color = '#ef4444';
      } else {
        ft.textContent = '🚩 Flag Mode: OFF';
        ft.style.borderColor = 'rgba(255,255,255,0.2)';
        ft.style.color = 'rgba(255,255,255,0.7)';
      }
    }
  }

  // ── Chord: reveal neighbours of a revealed numbered cell ─
  function msChord(idx) {
    var cell = ms.board[idx];
    if (!cell.revealed || cell.adj === 0) return;
    var row = Math.floor(idx / ms.cols), col = idx % ms.cols;
    // Count flags around
    var flags = 0;
    var neighbours = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < ms.rows && nc >= 0 && nc < ms.cols) {
          var ni = nr * ms.cols + nc;
          neighbours.push(ni);
          if (ms.board[ni].flagged) flags++;
        }
      }
    }
    if (flags === cell.adj) {
      neighbours.forEach(function(ni) {
        if (!ms.board[ni].flagged && !ms.board[ni].revealed) msReveal(ni);
      });
    }
  }

  // ── Game over ────────────────────────────────────────
  function msGameOver(won) {
    ms.over = true;
    ms.won  = won;
    msStopTimer();

    // Reveal all mines on loss
    if (!won) {
      for (var i = 0; i < ms.board.length; i++) {
        if (ms.board[i].mine) ms.board[i].revealed = true;
      }
    }

    msRenderGrid();
    msUpdateHUD();

    var icon   = q('mine-result-icon');
    var title  = q('mine-result-title');
    var detail = q('mine-result-detail');
    var res    = q('mine-result');

    if (icon)   icon.textContent   = won ? '🏆' : '💥';
    if (title)  title.textContent  = won ? 'YOU WIN!' : 'BOOM!';
    if (detail) detail.textContent = won
      ? 'Cleared in ' + ms.timerVal + 's — nice work!'
      : 'Better luck next time. Watch those mines!';

    if (res) {
      res.classList.remove('hidden');
      res.style.display = 'flex';
    }
  }

  // ── Timer ────────────────────────────────────────────
  function msStartTimer() {
    ms.timerVal = 0;
    msStopTimer();
    ms.timerID = setInterval(function () {
      ms.timerVal++;
      var el = q('mine-timer'); if (el) el.textContent = ms.timerVal;
    }, 1000);
  }

  function msStopTimer() {
    if (ms.timerID) { clearInterval(ms.timerID); ms.timerID = null; }
  }

  // ── HUD update ───────────────────────────────────────
  function msUpdateHUD() {
    var remaining = ms.mines - ms.flagged;
    var cntEl = q('mine-count'); if (cntEl) cntEl.textContent = remaining;
    var prog = q('mine-progress');
    if (prog) prog.style.width = (ms.safeTotal > 0 ? (ms.revealed / ms.safeTotal * 100) : 0) + '%';
    var timerEl = q('mine-timer'); if (timerEl) timerEl.textContent = ms.timerVal;
  }

  // ── Rendering ────────────────────────────────────────
  var NUM_COLORS = ['','#4fc3f7','#81c784','#e57373','#7986cb','#ef9a9a','#4dd0e1','#000','#546e7a'];

  function msCellSize() {
    // Dynamically compute cell size so the full grid fits the viewport
    var vw = window.innerWidth  || 360;
    var vh = window.innerHeight || 640;
    // Available area minus HUD (~130px top) and padding
    var availW = vw - 16;
    var availH = vh - 140;
    var byWidth  = Math.floor((availW - (ms.cols - 1) * 2) / ms.cols);
    var byHeight = Math.floor((availH - (ms.rows - 1) * 2) / ms.rows);
    // Clamp between 22 and 42 px — comfortable touch target
    return Math.max(22, Math.min(42, Math.min(byWidth, byHeight)));
  }

  function msRenderGrid() {
    var grid = q('mine-grid');
    if (!grid) return;
    var sz = msCellSize();
    grid.style.gridTemplateColumns = 'repeat(' + ms.cols + ', ' + sz + 'px)';
    grid.innerHTML = '';

    for (var i = 0; i < ms.board.length; i++) {
      var el = msBuildCell(i, sz);
      grid.appendChild(el);
    }
  }

  function msRenderCell(idx) {
    var grid = q('mine-grid');
    if (!grid) return;
    var sz = msCellSize();
    var old = grid.children[idx];
    if (!old) return;
    var el = msBuildCell(idx, sz);
    grid.replaceChild(el, old);
  }

  function msBuildCell(idx, sz) {
    var cell  = ms.board[idx];
    var el    = document.createElement('div');
    el.style.cssText = [
      'width:' + sz + 'px',
      'height:' + sz + 'px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'border-radius:4px',
      'cursor:pointer',
      'font-family:Orbitron,sans-serif',
      'font-weight:700',
      'font-size:' + Math.round(sz * 0.48) + 'px',
      'transition:background 0.08s',
      'box-sizing:border-box',
      '-webkit-tap-highlight-color:transparent',
      'touch-action:none'
    ].join(';');

    if (cell.revealed) {
      if (cell.mine) {
        el.style.background = '#7f1d1d';
        el.style.border = '1px solid #ef4444';
        el.textContent = '💣';
        el.style.fontSize = Math.round(sz * 0.52) + 'px';
      } else {
        el.style.background = 'rgba(255,255,255,0.06)';
        el.style.border = '1px solid rgba(255,255,255,0.08)';
        if (cell.adj > 0) {
          el.textContent = cell.adj;
          el.style.color = NUM_COLORS[cell.adj] || '#fff';
        }
      }
    } else if (cell.flagged) {
      el.style.background = 'rgba(239,68,68,0.18)';
      el.style.border = '1.5px solid rgba(239,68,68,0.6)';
      el.textContent = '🚩';
      el.style.fontSize = Math.round(sz * 0.52) + 'px';
    } else {
      el.style.background = 'rgba(255,255,255,0.09)';
      el.style.border = '1px solid rgba(255,255,255,0.14)';
    }

    if (!ms.over) {
      // ── Touch: long-press = flag, tap = reveal ──
      var pressTimer = null;
      var didLong    = false;

      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        didLong = false;
        pressTimer = setTimeout(function () {
          didLong = true;
          msFlag(idx);
        }, 420);
      });

      el.addEventListener('pointerup', function (e) {
        e.preventDefault();
        clearTimeout(pressTimer);
        if (didLong) return;
        if (ms.flagMode) {
          msFlag(idx);
        } else if (cell.revealed && cell.adj > 0) {
          msChord(idx);
          msRenderGrid();
          msUpdateHUD();
        } else {
          msReveal(idx);
          msRenderGrid();
          msUpdateHUD();
        }
      });

      el.addEventListener('pointercancel', function () { clearTimeout(pressTimer); });

      // Prevent context menu on long-press (mobile)
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    return el;
  }

  // ── Expose showAH-style navigation if needed ─────────
  // (screen switching handled by dzShowScreen in main script)

})();
