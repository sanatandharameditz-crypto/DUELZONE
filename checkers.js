// ═══════════════════════════════════════════════════════════════
// DuelZone · Checkers (American Draughts)
// Fully self-contained. All logic inside `ck` namespace.
// No global variable pollution. Does not touch other games.
// ═══════════════════════════════════════════════════════════════

var ck = (function () {

  // ─────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────
  var EMPTY = 0;
  var P1    = 1;   // Player 1 piece (moves up  → decreasing row)
  var P2    = 2;   // Player 2 piece (moves down → increasing row)
  var K1    = 3;   // Player 1 king
  var K2    = 4;   // Player 2 king
  var SIZE  = 8;

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  var state = {};

  function ckResetState() {
    state = {
      board:          ckInitBoard(),
      currentTurn:    1,
      selected:       null,
      validMoves:     [],
      forcedCaptures: [],
      multiJumpPiece: null,
      gameMode:       null,
      difficulty:     'medium',
      gameOver:       false,
      winner:         null,
      aiThinking:     false,
      gamePhase:      'modeselect',
      moveHistory:    []   // { player, from, to, captures }
    };
  }

  function ckInitBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) {
      b.push([]);
      for (var c = 0; c < SIZE; c++) {
        b[r].push(EMPTY);
      }
    }
    // Player 2 pieces: rows 0-2, dark squares
    for (var r2 = 0; r2 <= 2; r2++) {
      for (var c2 = 0; c2 < SIZE; c2++) {
        if ((r2 + c2) % 2 === 1) b[r2][c2] = P2;
      }
    }
    // Player 1 pieces: rows 5-7, dark squares
    for (var r1 = 5; r1 <= 7; r1++) {
      for (var c1 = 0; c1 < SIZE; c1++) {
        if ((r1 + c1) % 2 === 1) b[r1][c1] = P1;
      }
    }
    return b;
  }

  // ─────────────────────────────────────────────────────────────
  // MOVE GENERATION
  // ─────────────────────────────────────────────────────────────
  // A move object: { from:[r,c], to:[r,c], captures:[[r,c],...], isKing:bool }

  function ckOwns(player, val) {
    if (player === 1) return val === P1 || val === K1;
    return val === P2 || val === K2;
  }

  function ckIsKing(val) { return val === K1 || val === K2; }

  function ckOpponent(player) { return player === 1 ? 2 : 1; }

  function ckForwardDirs(player, isKing) {
    // Player 1 moves up (row decreases), Player 2 moves down (row increases)
    var fwd = player === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    var back = player === 1 ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
    return isKing ? fwd.concat(back) : fwd;
  }

  // Get all legal moves for a given player on a given board
  // Returns { captures: [...], moves: [...] }
  function ckGetAllMoves(board, player) {
    var captures = [];
    var moves    = [];
    var opp      = ckOpponent(player);

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var val = board[r][c];
        if (!ckOwns(player, val)) continue;
        var isKing = ckIsKing(val);
        var dirs   = ckForwardDirs(player, isKing);

        // Simple moves
        dirs.forEach(function(d) {
          var nr = r + d[0], nc = c + d[1];
          if (ckInBounds(nr, nc) && board[nr][nc] === EMPTY) {
            moves.push({ from: [r, c], to: [nr, nc], captures: [] });
          }
        });

        // Capture chains (depth-first multi-jump)
        var chains = ckGetCaptureChains(board, r, c, player, isKing, [], []);
        chains.forEach(function(chain) {
          if (chain.captures.length > 0) captures.push(chain);
        });
      }
    }
    return { captures: captures, moves: moves };
  }

  // Recursively find all capture sequences from [r,c]
  function ckGetCaptureChains(board, r, c, player, isKing, capturedSoFar, visitedSoFar) {
    var opp  = ckOpponent(player);
    var dirs = ckForwardDirs(player, isKing);
    var found = false;
    var chains = [];

    dirs.forEach(function(d) {
      var mr = r + d[0], mc = c + d[1];   // middle (opponent)
      var lr = r + d[0]*2, lc = c + d[1]*2; // landing

      if (!ckInBounds(mr, mc) || !ckInBounds(lr, lc)) return;
      if (!ckOwns(opp, board[mr][mc])) return;

      // Don't re-capture same piece in one chain
      var alreadyCaptured = capturedSoFar.some(function(cap) {
        return cap[0] === mr && cap[1] === mc;
      });
      if (alreadyCaptured) return;

      // Landing must be empty (or the original starting square in a loop — not needed in standard checkers)
      if (board[lr][lc] !== EMPTY) return;

      found = true;

      // Simulate board after this capture
      var nb = ckCloneBoard(board);
      nb[r][c] = EMPTY;
      nb[mr][mc] = EMPTY;
      // Promote if needed before continuing (kings can capture backward in continuation)
      var newIsKing = isKing || ckShouldPromote(player, lr);
      nb[lr][lc] = newIsKing ? (player === 1 ? K1 : K2) : (player === 1 ? P1 : P2);

      var newCaptured = capturedSoFar.concat([[mr, mc]]);

      // Try further captures from landing
      var further = ckGetCaptureChains(nb, lr, lc, player, newIsKing, newCaptured, []);
      if (further.length === 0) {
        // Terminal: return this chain
        chains.push({ from: [r, c], to: [lr, lc], captures: newCaptured, finalBoard: nb });
      } else {
        // Extend all further chains
        further.forEach(function(f) {
          chains.push({ from: [r, c], to: f.to, captures: f.captures, finalBoard: f.finalBoard });
        });
      }
    });

    // If no captures found at all (top-level call with no jumps, or continuation exhausted), return empty.
    if (!found) return [];
    return chains;
  }

  function ckShouldPromote(player, row) {
    return (player === 1 && row === 0) || (player === 2 && row === 7);
  }

  function ckInBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function ckCloneBoard(board) {
    return board.map(function(row) { return row.slice(); });
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckGetValidMoves — for selected piece
  // ─────────────────────────────────────────────────────────────
  function ckGetValidMoves(r, c, board, player) {
    var all = ckGetAllMoves(board, player);
    var hasCap = all.captures.length > 0;
    var source = hasCap ? all.captures : all.moves;
    return source.filter(function(m) { return m.from[0] === r && m.from[1] === c; });
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckCheckForcedCaptures — returns all forced moves
  // ─────────────────────────────────────────────────────────────
  function ckCheckForcedCaptures(board, player) {
    return ckGetAllMoves(board, player).captures;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckPromoteToKing
  // ─────────────────────────────────────────────────────────────
  function ckPromoteToKing(board, r, c) {
    var val = board[r][c];
    var promoted = false;
    if (val === P1 && r === 0) { board[r][c] = K1; promoted = true; }
    if (val === P2 && r === 7) { board[r][c] = K2; promoted = true; }
    if (promoted) {
      // Trigger crown animation on the destination cell
      setTimeout(function() {
        var el = ckCellEl(r, c);
        if (!el) return;
        el.classList.add('ck-anim-king-promote');
        // Crown burst particles
        ckSpawnCrownParticles(r, c, val === P1 ? '#ef4444' : '#475569');
        setTimeout(function() { if (el) el.classList.remove('ck-anim-king-promote'); }, 700);
        // Show "KING!" toast
        ckShowKingToast(r, c);
      }, 100);
    }
  }

  function ckSpawnCrownParticles(r, c, color) {
    var boardEl = ckDom('ck-board');
    if (!boardEl) return;
    var sq = ckCellEl(r, c);
    if (!sq) return;
    var rect = sq.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top  + rect.height / 2;
    for (var i = 0; i < 14; i++) {
      (function(i) {
        var p = document.createElement('div');
        p.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;' +
          'left:' + cx + 'px;top:' + cy + 'px;' +
          'width:' + (5 + Math.random()*5) + 'px;height:' + (5 + Math.random()*5) + 'px;' +
          'background:' + (i % 2 === 0 ? color : '#fbbf24') + ';' +
          'border-radius:50%;transform:translate(-50%,-50%);opacity:1;' +
          'transition:all 0.6s cubic-bezier(.17,.84,.44,1)';
        document.body.appendChild(p);
        var angle = (Math.PI * 2 * i) / 14;
        var speed = 30 + Math.random() * 40;
        setTimeout(function() {
          p.style.left = (cx + Math.cos(angle) * speed) + 'px';
          p.style.top  = (cy + Math.sin(angle) * speed) + 'px';
          p.style.opacity = '0';
        }, 20);
        setTimeout(function() { p.remove(); }, 680);
      })(i);
    }
  }

  function ckShowKingToast(r, c) {
    var sq = ckCellEl(r, c);
    if (!sq) return;
    var toast = document.createElement('div');
    toast.className = 'ck-king-toast';
    toast.textContent = '♛ KING!';
    sq.style.position = 'relative';
    sq.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 1400);
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckMovePiece — apply a move object to state
  // ─────────────────────────────────────────────────────────────
  function ckMovePiece(move) {
    var fr = move.from[0], fc = move.from[1];
    var tr = move.to[0],   tc = move.to[1];
    var piece = state.board[fr][fc];

    // FIX: If the chain pre-computed a finalBoard (from ckGetCaptureChains), use the
    // piece value from it at the landing square. This correctly handles mid-chain
    // promotions where a pawn passes through the king row and continues capturing —
    // without this the piece would arrive as a pawn instead of a king.
    if (move.finalBoard) {
      var finalPiece = move.finalBoard[tr][tc];
      if (finalPiece !== EMPTY) piece = finalPiece;
    }

    state.board[fr][fc] = EMPTY;
    state.board[tr][tc] = piece;

    // Remove captured pieces
    move.captures.forEach(function(cap) {
      state.board[cap[0]][cap[1]] = EMPTY;
    });

    // Record move in history
    var cols = 'abcdefgh';
    var notation = cols[fc] + (SIZE - fr) + '-' + cols[tc] + (SIZE - tr);
    if (move.captures.length > 0) notation += ' x' + move.captures.length;
    state.moveHistory.push({
      player:   state.currentTurn,
      from:     [fr, fc],
      to:       [tr, tc],
      captures: move.captures.length,
      notation: notation
    });
    ckUpdateMoveHistory();

    // Promote
    ckPromoteToKing(state.board, tr, tc);
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckHandleCapture — alias for animation hooks
  // ─────────────────────────────────────────────────────────────
  function ckHandleCapture(move) {
    move.captures.forEach(function(cap) {
      state.board[cap[0]][cap[1]] = EMPTY;
      var el = ckCellEl(cap[0], cap[1]);
      if (el) {
        el.classList.add('ck-anim-capture');
        setTimeout(function() { el && el.classList.remove('ck-anim-capture'); }, 500);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckSwitchTurn
  // ─────────────────────────────────────────────────────────────
  function ckSwitchTurn() {
    state.currentTurn = ckOpponent(state.currentTurn);
    state.selected    = null;
    state.validMoves  = [];
    state.forcedCaptures = ckCheckForcedCaptures(state.board, state.currentTurn);
    ckUpdateTurnUI();

    if (state.gameMode === 'bot' && state.currentTurn === 2) {
      state.aiThinking = true;
      ckRender();
      var delay = 350 + Math.random() * 300;
      setTimeout(ckAIMove, delay);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckCheckWin
  // ─────────────────────────────────────────────────────────────
  function ckCheckWin() {
    // Count pieces
    var p1 = 0, p2 = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = state.board[r][c];
        if (v === P1 || v === K1) p1++;
        if (v === P2 || v === K2) p2++;
      }
    }
    if (p1 === 0) return 2;
    if (p2 === 0) return 1;

    // No legal moves check
    var all1 = ckGetAllMoves(state.board, state.currentTurn);
    var totalMoves = all1.captures.length + all1.moves.length;
    if (totalMoves === 0) {
      return ckOpponent(state.currentTurn); // current player can't move → opponent wins
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckHandleClick — main interaction handler
  // ─────────────────────────────────────────────────────────────
  function ckHandleClick(r, c) {
    if (state.gameOver) return;
    if (state.gamePhase === 'modeselect') return;
    if (state.aiThinking) return;

    // In bot mode, P2 is AI — ignore clicks
    if (state.gameMode === 'bot' && state.currentTurn === 2) return;

    var val = state.board[r][c];

    // Multi-jump locked to one piece
    if (state.multiJumpPiece) {
      var mjr = state.multiJumpPiece[0], mjc = state.multiJumpPiece[1];
      if (r === mjr && c === mjc) return; // clicked same piece
      // Try to apply a move from the multi-jump piece to [r,c]
      var mjMoves = ckGetValidMoves(mjr, mjc, state.board, state.currentTurn);
      var chosen = null;
      mjMoves.forEach(function(m) { if (m.to[0] === r && m.to[1] === c) chosen = m; });
      if (chosen) {
        ckApplyMove(chosen);
        return;
      }
      // Invalid click during multi-jump — ignore
      return;
    }

    // Clicking own piece → select it
    if (ckOwns(state.currentTurn, val)) {
      state.selected = [r, c];
      state.validMoves = ckGetValidMoves(r, c, state.board, state.currentTurn);
      ckRender();
      return;
    }

    // Clicking a destination
    if (state.selected) {
      // Find matching move
      var move = null;
      state.validMoves.forEach(function(m) {
        if (m.to[0] === r && m.to[1] === c) move = m;
      });
      if (move) {
        ckApplyMove(move);
        return;
      }
      // Deselect if clicking empty non-valid cell
      state.selected = null;
      state.validMoves = [];
      ckRender();
    }
  }

  function ckApplyMove(move) {
    var fr = move.from[0], fc = move.from[1];
    var tr = move.to[0],   tc = move.to[1];

    // Animate move
    ckAnimateMove(fr, fc, tr, tc, move.captures.length > 0);

    // Apply to board
    ckMovePiece(move);

    // Sound
    if (move.captures.length > 0) {
      if (typeof SoundManager !== 'undefined' && SoundManager.c4Drop) SoundManager.c4Drop();
    } else {
      if (typeof SoundManager !== 'undefined' && SoundManager.click) SoundManager.click();
    }

    // The full capture chain is already encoded in move.captures / move.finalBoard
    // from ckGetCaptureChains — no mid-move continuation check needed.

    // End of move / turn
    state.multiJumpPiece = null;
    state.selected = null;
    state.validMoves = [];

    // Check win
    var winner = ckCheckWin();
    if (winner) {
      ckEndGame(winner);
      return;
    }

    ckSwitchTurn();
    ckRender();
  }

  // ─────────────────────────────────────────────────────────────
  // AI ENTRY POINT
  // ─────────────────────────────────────────────────────────────
  function ckAIMove() {
    if (state.gameOver || !state.aiThinking) return;

    var move = null;
    if (state.difficulty === 'easy')   move = ckAIMoveEasy();
    if (state.difficulty === 'medium') move = ckAIMoveMedium();
    if (state.difficulty === 'hard')   move = ckAIMoveHard();

    if (!move) { state.aiThinking = false; ckRender(); return; }

    state.aiThinking = false;
    ckApplyMove(move);
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckAIMoveEasy — random legal move
  // ─────────────────────────────────────────────────────────────
  function ckAIMoveEasy() {
    var all = ckGetAllMoves(state.board, 2);
    var pool = all.captures.length > 0 ? all.captures : all.moves;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckAIMoveMedium — prefer captures, king promotions, avoid exposure
  // ─────────────────────────────────────────────────────────────
  function ckAIMoveMedium() {
    var all = ckGetAllMoves(state.board, 2);
    var pool = all.captures.length > 0 ? all.captures : all.moves;
    if (!pool.length) return null;

    // Score each move
    var best = null, bestScore = -Infinity;
    pool.forEach(function(m) {
      var score = 0;

      // Prefer more captures
      score += m.captures.length * 10;

      // Prefer king promotion
      if (ckShouldPromote(2, m.to[0])) score += 8;

      // Avoid landing where opponent can immediately capture
      var nb = ckCloneBoard(state.board);
      ckApplyMoveToBoard(nb, m);
      var oppCaptures = ckGetAllMoves(nb, 1).captures;
      var exposing = oppCaptures.some(function(om) {
        return om.captures.some(function(cap) {
          return cap[0] === m.to[0] && cap[1] === m.to[1];
        });
      });
      if (exposing) score -= 6;

      // Prefer advancing toward king row (row 7 for P2)
      score += m.to[0] * 0.5;

      if (score > bestScore) { bestScore = score; best = m; }
    });
    return best || pool[0];
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckAIMoveHard — full minimax with alpha-beta pruning (depth 7, strong & fast)
  // ─────────────────────────────────────────────────────────────
  function ckAIMoveHard() {
    var all = ckGetAllMoves(state.board, 2);
    var pool = all.captures.length > 0 ? all.captures : all.moves;
    if (!pool.length) return null;
    // Depth 7 with alpha-beta — strong play, runs in <1s
    var result = ckMinimax(state.board, 7, -Infinity, Infinity, true, 2); // FIX: 12 was browser-freezing; 7 is strong & fast
    return result.move || pool[0];
  }

  function ckMinimax(board, depth, alpha, beta, maximizing, player) {
    var currentPlayer = maximizing ? player : ckOpponent(player);
    var all = ckGetAllMoves(board, currentPlayer);
    var pool = all.captures.length > 0 ? all.captures : all.moves;

    if (depth === 0 || pool.length === 0) {
      return { score: ckEvalBoard(board), move: null };
    }

    var bestMove = null;
    if (maximizing) {
      var best = -Infinity;
      for (var i = 0; i < pool.length; i++) {
        var m = pool[i];
        var nb = ckCloneBoard(board);
        ckApplyMoveToBoard(nb, m);
        var child = ckMinimax(nb, depth - 1, alpha, beta, false, player);
        if (child.score > best) { best = child.score; bestMove = m; }
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return { score: best, move: bestMove };
    } else {
      var best2 = Infinity;
      for (var j = 0; j < pool.length; j++) {
        var m2 = pool[j];
        var nb2 = ckCloneBoard(board);
        ckApplyMoveToBoard(nb2, m2);
        var child2 = ckMinimax(nb2, depth - 1, alpha, beta, true, player);
        if (child2.score < best2) { best2 = child2.score; bestMove = m2; }
        beta = Math.min(beta, best2);
        if (beta <= alpha) break;
      }
      return { score: best2, move: bestMove };
    }
  }

  // Deep positional + material evaluation for minimax
  function ckEvalBoard(board) {
    var score = 0;
    var p2pieces=0, p1pieces=0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = board[r][c];
        if (v === P2) {
          score += 100;
          // FIX: P2 moves toward higher rows (row 7 = king row). Higher row = more advanced = better.
          score += r * 5;
          // Center control
          if (c >= 2 && c <= 5 && r >= 3 && r <= 4) score += 15;
          // Edge penalty (both players penalized for edges)
          if (c === 0 || c === 7) score -= 8;
          p2pieces++;
        } else if (v === K2) {
          score += 300;
          // Kings prefer center
          score += (3 - Math.abs(r-3.5)) * 10;
          score += (3 - Math.abs(c-3.5)) * 10;
          p2pieces++;
        } else if (v === P1) {
          score -= 100;
          // P1 moves toward lower rows (row 0 = king row). Lower row = more advanced.
          score -= (7 - r) * 5;
          if (c >= 2 && c <= 5 && r >= 3 && r <= 4) score -= 15;
          if (c === 0 || c === 7) score -= 8; // FIX: was += 8 (wrong sign — edge is bad for all)
          p1pieces++;
        } else if (v === K1) {
          score -= 300;
          score -= (3 - Math.abs(r-3.5)) * 10;
          score -= (3 - Math.abs(c-3.5)) * 10;
          p1pieces++;
        }
      }
    }
    // Strong bonus for piece advantage (endgame weight)
    score += (p2pieces - p1pieces) * 50;
    // Win/loss detection
    if (p1pieces === 0) score += 10000;
    if (p2pieces === 0) score -= 10000;
    return score;
  }

  function ckEvaluateBoard(board, player, move) {
    var score = 0;
    var opp   = ckOpponent(player);

    // Material count
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = board[r][c];
        if (v === P2) score += 5;
        if (v === K2) score += 8;
        if (v === P1) score -= 5;
        if (v === K1) score -= 8;

        // Center control bonus for P2
        if ((v === P2 || v === K2) && r >= 3 && r <= 4 && c >= 2 && c <= 5) score += 1;
        // Back-row defense bonus
        if (v === P2 && r === 7) score += 1;
        if (v === P1 && r === 0) score -= 1;
      }
    }

    // Captures scored highly
    score += move.captures.length * 10;

    // King promotion
    if (ckShouldPromote(2, move.to[0])) score += 9;

    // Penalise if opponent has many captures after this move
    var oppAll = ckGetAllMoves(board, 1);
    score -= oppAll.captures.length * 3;

    // Avoid pieces that can immediately be captured
    var oppCaps = oppAll.captures;
    for (var r2 = 0; r2 < SIZE; r2++) {
      for (var c2 = 0; c2 < SIZE; c2++) {
        var v2 = board[r2][c2];
        if (v2 !== P2 && v2 !== K2) continue;
        var exposed = oppCaps.some(function(oc) {
          return oc.captures.some(function(cap) { return cap[0] === r2 && cap[1] === c2; });
        });
        if (exposed) score -= 4;
      }
    }

    return score;
  }

  // Apply a move to a cloned board (without touching state)
  function ckApplyMoveToBoard(board, move) {
    var fr = move.from[0], fc = move.from[1];
    var tr = move.to[0],   tc = move.to[1];
    // Use pre-computed finalBoard when available — it correctly handles mid-chain promotions
    if (move.finalBoard) {
      var fb = move.finalBoard;
      for (var r = 0; r < SIZE; r++)
        for (var c = 0; c < SIZE; c++)
          board[r][c] = fb[r][c];
      return;
    }
    var piece = board[fr][fc];
    board[fr][fc] = EMPTY;
    board[tr][tc] = piece;
    move.captures.forEach(function(cap) { board[cap[0]][cap[1]] = EMPTY; });
    // Promote
    if (piece === P1 && tr === 0) board[tr][tc] = K1;
    if (piece === P2 && tr === 7) board[tr][tc] = K2;
  }

  // ─────────────────────────────────────────────────────────────
  // GAME END
  // ─────────────────────────────────────────────────────────────
  function ckEndGame(winner) {
    state.gameOver = true;
    state.winner   = winner;
    state.selected = null;
    state.validMoves = [];

    ckRender();

    var panel  = ckDom('ck-result-panel');
    var title  = ckDom('ck-result-title');
    var detail = ckDom('ck-result-detail');
    if (!panel || !title || !detail) return;

    var isP1Win = winner === 1;
    // FIX: determine if win was by captures or by blocking (no legal moves)
    var p1Count = 0, p2Count = 0;
    for (var wr = 0; wr < SIZE; wr++) for (var wc = 0; wc < SIZE; wc++) {
      var wv = state.board[wr][wc];
      if (wv === P1 || wv === K1) p1Count++;
      if (wv === P2 || wv === K2) p2Count++;
    }
    var winByCapture = isP1Win ? (p2Count === 0) : (p1Count === 0);
    var winReason = winByCapture ? 'captured all opponent pieces!' : 'blocked all opponent moves!';
    if (state.gameMode === 'pvp') {
      title.textContent  = isP1Win ? '🏆 Player 1 Wins!' : '🏆 Player 2 Wins!';
      detail.textContent = (isP1Win ? 'Player 1 ' : 'Player 2 ') + winReason;
    } else {
      if (isP1Win) {
        title.textContent  = '🏆 Victory!';
        detail.textContent = 'You ' + winReason;
      } else {
        title.textContent  = '💀 Defeated!';
        detail.textContent = 'The AI ' + winReason;
      }
    }

    if (typeof SoundManager !== 'undefined') {
      if ((state.gameMode === 'bot' && isP1Win) || state.gameMode === 'pvp') {
        SoundManager.win && SoundManager.win();
      } else {
        SoundManager.lose && SoundManager.lose();
      }
    }
    if (window.DZShare) DZShare.setResult({ game:'Checkers', slug:'checkers', winner:title.textContent, detail:detail.textContent, accent:'#e85d04', icon:'⚫' });

    panel.classList.remove('ck-hidden');
    ckAnimateResult(isP1Win || state.gameMode === 'pvp');

  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckResetGame
  // ─────────────────────────────────────────────────────────────
  function ckResetGame() {
    ckResetState();
    ckHideAllPanels();
    var modePanel = ckDom('ck-mode-panel');
    if (modePanel) modePanel.classList.remove('ck-hidden');
    ckSetMsg('');
    ckUpdateTurnUI();
    ckRender();
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckSelectMode
  // ─────────────────────────────────────────────────────────────
  function ckSelectMode(mode) {
    state.gameMode = mode;
    var selModePanel = ckDom('ck-mode-panel');
    if (selModePanel) selModePanel.classList.add('ck-hidden');
    if (mode === 'bot') {
      var diffPanelSel = ckDom('ck-diff-panel');
      if (diffPanelSel) diffPanelSel.classList.remove('ck-hidden');
    } else {
      ckBeginGame();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckSetDifficulty
  // ─────────────────────────────────────────────────────────────
  function ckSetDifficulty(diff) {
    state.difficulty = diff;
    var diffPanel = ckDom('ck-diff-panel');
    if (diffPanel) diffPanel.classList.add('ck-hidden');
    ckBeginGame();
  }

  function ckBeginGame() {
    state.gamePhase = 'battle';
    state.currentTurn = 1;
    state.forcedCaptures = ckCheckForcedCaptures(state.board, 1);
    ckHideAllPanels();
    ckUpdateTurnUI();
    ckSetMsg('Player 1 goes first. Select a piece to move.');
    ckRender();
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: ckInit — entry point called by showCheckers()
  // ─────────────────────────────────────────────────────────────
  function ckInit() {
    ckEnsureWired();
    ckResetGame();
  }

  // ─────────────────────────────────────────────────────────────
  // RENDERING
  // ─────────────────────────────────────────────────────────────
  function ckRender() {
    var boardEl = ckDom('ck-board');
    if (!boardEl) return;
    boardEl.innerHTML = '';

    var forced = state.forcedCaptures.map(function(m) {
      return m.from[0] + ',' + m.from[1];
    });
    var validDests = state.validMoves.map(function(m) {
      return m.to[0] + ',' + m.to[1];
    });

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        (function(row, col) {
          var sq = document.createElement('div');
          var isDark = (row + col) % 2 === 1;
          sq.className = 'ck-square ' + (isDark ? 'ck-dark' : 'ck-light');

          var val = state.board[row][col];

          // Piece
          if (val !== EMPTY) {
            var piece = document.createElement('div');
            var isP1piece = val === P1 || val === K1;
            piece.className = 'ck-piece ' + (isP1piece ? 'ck-p1' : 'ck-p2');
            if (ckIsKing(val)) piece.classList.add('ck-king');

            if (ckIsKing(val)) {
              var crown = document.createElement('span');
              crown.className = 'ck-crown';
              crown.textContent = '♛';
              piece.appendChild(crown);
            }

            sq.appendChild(piece);
          }

          // Highlights
          var key = row + ',' + col;

          // Selected piece
          if (state.selected && state.selected[0] === row && state.selected[1] === col) {
            sq.classList.add('ck-selected');
          }

          // Multi-jump locked piece
          if (state.multiJumpPiece && state.multiJumpPiece[0] === row && state.multiJumpPiece[1] === col) {
            sq.classList.add('ck-multijump');
          }

          // Forced capture from this square
          if (forced.indexOf(key) !== -1 && !state.gameOver) {
            sq.classList.add('ck-forced');
          }

          // Valid destination
          if (validDests.indexOf(key) !== -1 && !state.gameOver) {
            sq.classList.add('ck-valid-dest');
            var dot = document.createElement('div');
            dot.className = 'ck-dest-dot';
            sq.appendChild(dot);
          }

          // Click handler (only dark squares)
          if (isDark) {
            sq.addEventListener('click', function() { ckHandleClick(row, col); });
          }

          boardEl.appendChild(sq);
        })(r, c);
      }
    }

    // Update piece counts
    ckUpdateCounts();
  }

  function ckUpdateCounts() {
    var p1 = 0, p2 = 0, k1 = 0, k2 = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = state.board[r][c];
        if (v === P1) p1++;
        if (v === P2) p2++;
        if (v === K1) { p1++; k1++; }
        if (v === K2) { p2++; k2++; }
      }
    }
    var el1 = ckDom('ck-p1-count');
    var el2 = ckDom('ck-p2-count');
    if (el1) el1.textContent = p1 + ' pieces' + (k1 ? ' (' + k1 + ' kings)' : '');
    if (el2) el2.textContent = p2 + ' pieces' + (k2 ? ' (' + k2 + ' kings)' : '');
  }

  function ckUpdateMoveHistory() {
    var el = ckDom('ck-move-history');
    if (!el) return;
    var history = state.moveHistory;
    // Show last 8 moves
    var shown = history.slice(-8);
    el.innerHTML = shown.map(function(m) {
      var pClass = m.player === 1 ? 'ck-hist-p1' : 'ck-hist-p2';
      var capIcon = m.captures > 0 ? ' <span class="ck-hist-cap">×' + m.captures + '</span>' : '';
      return '<span class="ck-hist-entry ' + pClass + '">P' + m.player + ': ' + m.notation + capIcon + '</span>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  // ─────────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────────
  function ckDom(id) { return document.getElementById(id); }

  function ckCellEl(r, c) {
    var board = ckDom('ck-board');
    if (!board) return null;
    var idx = r * SIZE + c;
    return board.children[idx] || null;
  }

  function ckSetMsg(html, cls) {
    var el = ckDom('ck-message');
    if (!el) return;
    el.innerHTML = html || '';
    el.className = 'ck-message' + (cls ? ' ck-msg-' + cls : '');
  }

  function ckUpdateTurnUI() {
    var ind = ckDom('ck-turn-indicator');
    if (!ind) return;
    if (state.gameOver) {
      ind.textContent = '🏁 Game Over';
      ind.className = 'ck-turn-indicator ck-turn-gameover';
      return;
    }
    if (state.gameMode === 'bot' && state.currentTurn === 2) {
      var diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[state.difficulty] || '';
      ind.textContent = '🤖 AI (' + diffLabel + ') Thinking…';
      ind.className = 'ck-turn-indicator ck-turn-ai';
    } else if (state.currentTurn === 1) {
      ind.textContent = state.gameMode === 'pvp' ? '🔴 Player 1\'s Turn' : '🔴 Your Turn';
      ind.className = 'ck-turn-indicator ck-turn-p1';
    } else {
      ind.textContent = '⚫ Player 2\'s Turn';
      ind.className = 'ck-turn-indicator ck-turn-p2';
    }

    // Forced capture warning
    if (state.forcedCaptures.length > 0 && !state.gameOver) {
      ckSetMsg('⚠️ Forced capture available — you must jump!', 'warn');
    } else if (!state.gameOver && state.gamePhase === 'battle') {
      var who = (state.gameMode === 'pvp') ? 'Player ' + state.currentTurn : (state.currentTurn === 1 ? 'You' : 'AI');
      ckSetMsg(who + ': Select a piece to move.');
    }
  }

  function ckHideAllPanels() {
    ['ck-mode-panel','ck-diff-panel','ck-result-panel'].forEach(function(id) {
      var el = ckDom(id);
      if (el) el.classList.add('ck-hidden');
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ANIMATIONS
  // ─────────────────────────────────────────────────────────────
  function ckAnimateMove(fr, fc, tr, tc, isCapture) {
    var sq = ckCellEl(fr, fc);
    if (!sq) return;
    sq.classList.add('ck-anim-move');
    setTimeout(function() { if (sq) sq.classList.remove('ck-anim-move'); }, 300);
    if (isCapture) {
      var dest = ckCellEl(tr, tc);
      if (dest) {
        dest.classList.add('ck-anim-land');
        setTimeout(function() { if (dest) dest.classList.remove('ck-anim-land'); }, 400);
      }
    }
  }

  function ckAnimateResult(isWin) {
    var inner = ckDom('ck-result-inner');
    if (!inner) return;
    inner.classList.add(isWin ? 'ck-anim-win-enter' : 'ck-anim-lose-enter');
    setTimeout(function() {
      if (inner) inner.classList.remove('ck-anim-win-enter', 'ck-anim-lose-enter');
    }, 800);
  }

  // ─────────────────────────────────────────────────────────────
  // BUTTON WIRING
  // ─────────────────────────────────────────────────────────────
  function ckWireButtons() {
    // Mode
    var pvpBtn = ckDom('ck-mode-pvp-btn');
    var botBtn = ckDom('ck-mode-bot-btn');
    if (pvpBtn) pvpBtn.addEventListener('click', function() { ckSelectMode('pvp'); });
    if (botBtn) botBtn.addEventListener('click', function() { ckSelectMode('bot'); });

    // Difficulty
    ['easy','medium','hard'].forEach(function(d) {
      var btn = ckDom('ck-diff-' + d + '-btn');
      if (btn) btn.addEventListener('click', function() { ckSetDifficulty(d); });
    });

    // Reset / play again
    var resetBtn  = ckDom('ck-reset-btn');
    var againBtn  = ckDom('ck-play-again-btn');
    if (resetBtn)  resetBtn.addEventListener('click',  ckResetGame);
    if (againBtn)  againBtn.addEventListener('click',  ckResetGame);

    // Hub buttons
    ['ck-hub-btn','ck-hub-btn2'].forEach(function(id) {
      var btn = ckDom(id);
      if (btn) btn.addEventListener('click', function() {
        if (typeof showHub === 'function') showHub();
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ONE-TIME WIRING
  // ─────────────────────────────────────────────────────────────
  var _wired = false;
  function ckEnsureWired() {
    if (_wired) return;
    _wired = true;
    ckWireButtons();
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  return {
    init:               ckInit,
    selectMode:         ckSelectMode,
    setDifficulty:      ckSetDifficulty,
    handleClick:        ckHandleClick,
    getValidMoves:      ckGetValidMoves,
    checkForcedCaptures:ckCheckForcedCaptures,
    movePiece:          ckMovePiece,
    handleCapture:      ckHandleCapture,
    promoteToKing:      ckPromoteToKing,
    switchTurn:         ckSwitchTurn,
    checkWin:           ckCheckWin,
    aiMoveEasy:         ckAIMoveEasy,
    aiMoveMedium:       ckAIMoveMedium,
    aiMoveHard:         ckAIMoveHard,
    resetGame:          ckResetGame,
    ensureWired:        ckEnsureWired
  };

})();

// ─────────────────────────────────────────────────────────────
// ENTRY POINT — called by showCheckers() in script.js
// ─────────────────────────────────────────────────────────────
function ckInit() {
  ck.ensureWired && ck.ensureWired();
  ck.init();
}
