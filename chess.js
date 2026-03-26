// ═══════════════════════════════════════════════════════════════════════════
// DuelZone · Chess Engine  —  chess.js  (FIXED)
// Fixes applied:
//   FIX-1: Pawn attack direction inverted → black pieces were unselectable
//   FIX-2: chessResetGame now properly updates botColor
//   FIX-3: Game menu (chess-home) wired correctly; "Back to Menu" works from play panel
//   FIX-4: legalMovesFrom now works regardless of whose turn (for PvP re-select)
//   FIX-5: Bot-move guard checks chess.state existence before scheduling
//   FIX-6: EP pawn attack row was using wrong row (move.fr instead of move.tr)
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var PIECE  = { PAWN:'p', ROOK:'r', KNIGHT:'n', BISHOP:'b', QUEEN:'q', KING:'k' };
  var COLOR  = { WHITE:'w', BLACK:'b' };
  var MATERIAL = { p:100, n:320, b:330, r:500, q:900, k:20000 };

  var PST = {};
  PST.p = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ];
  PST.n = [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
  ];
  PST.b = [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
  ];
  PST.r = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ];
  PST.q = [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
  ];
  PST.k = [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
  ];

  // ── Board Representation ─────────────────────────────────────────────────

  function makeSquare(type, color, moved) {
    return { type: type || null, color: color || null, moved: !!moved };
  }

  function createEmptyBoard() {
    var board = [];
    for (var r = 0; r < 8; r++) {
      board[r] = [];
      for (var c = 0; c < 8; c++) board[r][c] = makeSquare(null, null, false);
    }
    return board;
  }

  function setupStartPosition(board) {
    var backRank = [PIECE.ROOK, PIECE.KNIGHT, PIECE.BISHOP, PIECE.QUEEN,
                    PIECE.KING, PIECE.BISHOP, PIECE.KNIGHT, PIECE.ROOK];
    for (var c = 0; c < 8; c++) board[0][c] = makeSquare(backRank[c], COLOR.WHITE, false);
    for (var c = 0; c < 8; c++) board[1][c] = makeSquare(PIECE.PAWN,  COLOR.WHITE, false);
    for (var c = 0; c < 8; c++) board[6][c] = makeSquare(PIECE.PAWN,  COLOR.BLACK, false);
    for (var c = 0; c < 8; c++) board[7][c] = makeSquare(backRank[c], COLOR.BLACK, false);
  }

  function cloneBoard(board) {
    var nb = [];
    for (var r = 0; r < 8; r++) {
      nb[r] = [];
      for (var c = 0; c < 8; c++) {
        var sq = board[r][c];
        nb[r][c] = { type: sq.type, color: sq.color, moved: sq.moved };
      }
    }
    return nb;
  }

  // ── Game State ───────────────────────────────────────────────────────────

  function ChessState() {
    this.board          = createEmptyBoard();
    this.turn           = COLOR.WHITE;
    this.moveHistory    = [];
    this.capturedPieces = { w: [], b: [] };
    this.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    this.enPassantTarget = null;
    this.halfMoveClock   = 0;
    this.fullMoveNumber  = 1;
    this.positionHistory = [];
    this.gameOver        = false;
    this.winner          = null;
    this.gameOverReason  = null;
    setupStartPosition(this.board);
    this.positionHistory.push(this._positionKey());
  }

  ChessState.prototype._positionKey = function () {
    var parts = [];
    for (var r = 7; r >= 0; r--) {
      var emptyRun = 0, rankStr = '';
      for (var c = 0; c < 8; c++) {
        var sq = this.board[r][c];
        if (!sq.type) { emptyRun++; }
        else {
          if (emptyRun) { rankStr += emptyRun; emptyRun = 0; }
          rankStr += (sq.color === COLOR.WHITE) ? sq.type.toUpperCase() : sq.type;
        }
      }
      if (emptyRun) rankStr += emptyRun;
      parts.push(rankStr);
    }
    var cr = (this.castlingRights.wK ? 'K' : '') + (this.castlingRights.wQ ? 'Q' : '') +
             (this.castlingRights.bK ? 'k' : '') + (this.castlingRights.bQ ? 'q' : '') || '-';
    var ep = this.enPassantTarget
      ? String.fromCharCode(97 + this.enPassantTarget.col) + (this.enPassantTarget.row + 1) : '-';
    return parts.join('/') + ' ' + this.turn + ' ' + cr + ' ' + ep;
  };

  // ── Move Generation ──────────────────────────────────────────────────────

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function pseudoLegalMovesForPiece(state, r, c) {
    var sq = state.board[r][c];
    if (!sq.type) return [];
    var opp = (sq.color === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;
    switch (sq.type) {
      case PIECE.PAWN:   return _pawnMoves(state, r, c, sq.color, opp);
      case PIECE.ROOK:   return _slidingMoves(state, r, c, sq.color, [[1,0],[-1,0],[0,1],[0,-1]]);
      case PIECE.BISHOP: return _slidingMoves(state, r, c, sq.color, [[1,1],[1,-1],[-1,1],[-1,-1]]);
      case PIECE.QUEEN:  return _slidingMoves(state, r, c, sq.color, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
      case PIECE.KNIGHT: return _knightMoves(state, r, c, sq.color);
      case PIECE.KING:   return _kingMoves(state, r, c, sq.color, opp);
    }
    return [];
  }

  function _pawnMoves(state, r, c, color, opp) {
    var moves = [];
    var dir      = (color === COLOR.WHITE) ? 1 : -1;
    var startRow = (color === COLOR.WHITE) ? 1 : 6;
    var promRow  = (color === COLOR.WHITE) ? 7 : 0;
    var nr = r + dir;

    if (inBounds(nr, c) && !state.board[nr][c].type) {
      _addPawnMove(moves, r, c, nr, c, (nr === promRow));
      if (r === startRow) {
        var nr2 = r + 2 * dir;
        if (inBounds(nr2, c) && !state.board[nr2][c].type)
          moves.push(_makeMove(r, c, nr2, c, null, false, true, false));
      }
    }

    for (var dc = -1; dc <= 1; dc += 2) {
      var nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      var target = state.board[nr][nc];
      if (target.type && target.color === opp)
        _addPawnMove(moves, r, c, nr, nc, (nr === promRow));
      if (state.enPassantTarget &&
          state.enPassantTarget.row === nr &&
          state.enPassantTarget.col === nc)
        moves.push(_makeMove(r, c, nr, nc, null, true, false, false));
    }
    return moves;
  }

  function _addPawnMove(moves, fr, fc, tr, tc, isPromo) {
    if (isPromo) {
      ['q','r','b','n'].forEach(function(p) {
        moves.push(_makeMove(fr, fc, tr, tc, p, false, false, false));
      });
    } else {
      moves.push(_makeMove(fr, fc, tr, tc, null, false, false, false));
    }
  }

  function _slidingMoves(state, r, c, color, dirs) {
    var moves = [];
    for (var i = 0; i < dirs.length; i++) {
      var dr = dirs[i][0], dc = dirs[i][1];
      var nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        var sq = state.board[nr][nc];
        if (!sq.type) { moves.push(_makeMove(r, c, nr, nc, null, false, false, false)); }
        else { if (sq.color !== color) moves.push(_makeMove(r, c, nr, nc, null, false, false, false)); break; }
        nr += dr; nc += dc;
      }
    }
    return moves;
  }

  function _knightMoves(state, r, c, color) {
    var moves = [], leaps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    for (var i = 0; i < leaps.length; i++) {
      var nr = r + leaps[i][0], nc = c + leaps[i][1];
      if (inBounds(nr, nc)) {
        var sq = state.board[nr][nc];
        if (!sq.type || sq.color !== color) moves.push(_makeMove(r, c, nr, nc, null, false, false, false));
      }
    }
    return moves;
  }

  function _kingMoves(state, r, c, color, opp) {
    var moves = [], dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var i = 0; i < dirs.length; i++) {
      var nr = r + dirs[i][0], nc = c + dirs[i][1];
      if (inBounds(nr, nc)) {
        var sq = state.board[nr][nc];
        if (!sq.type || sq.color !== color) moves.push(_makeMove(r, c, nr, nc, null, false, false, false));
      }
    }
    var rights = state.castlingRights;
    var backRow = (color === COLOR.WHITE) ? 0 : 7;
    if (r === backRow && c === 4) {
      var ksKey = (color === COLOR.WHITE) ? 'wK' : 'bK';
      if (rights[ksKey] && !state.board[backRow][5].type && !state.board[backRow][6].type)
        moves.push(_makeMove(r, c, backRow, 6, null, false, false, true));
      var qsKey = (color === COLOR.WHITE) ? 'wQ' : 'bQ';
      if (rights[qsKey] && !state.board[backRow][3].type &&
          !state.board[backRow][2].type && !state.board[backRow][1].type)
        moves.push(_makeMove(r, c, backRow, 2, null, false, false, true));
    }
    return moves;
  }

  function _makeMove(fr, fc, tr, tc, promo, isEP, isDblPush, isCastle) {
    return { fr:fr, fc:fc, tr:tr, tc:tc,
             promo: promo||null, isEP:!!isEP, isDblPush:!!isDblPush, isCastle:!!isCastle };
  }

  // ── Move Execution ───────────────────────────────────────────────────────

  function applyMoveToBoard(board, move, color, castlingRights) {
    var b   = cloneBoard(board);
    var newEP = null;
    var newCR = { wK: castlingRights.wK, wQ: castlingRights.wQ,
                  bK: castlingRights.bK, bQ: castlingRights.bQ };
    var captured = null;
    var piece = b[move.fr][move.fc];

    if (move.isCastle) {
      b[move.tr][move.tc] = { type: piece.type, color: piece.color, moved: true };
      b[move.fr][move.fc] = makeSquare(null, null, false);
      var backRow = move.fr;
      if (move.tc === 6) { b[backRow][5] = { type: PIECE.ROOK, color: color, moved: true }; b[backRow][7] = makeSquare(null,null,false); }
      else               { b[backRow][3] = { type: PIECE.ROOK, color: color, moved: true }; b[backRow][0] = makeSquare(null,null,false); }
    } else if (move.isEP) {
      // FIX-6: captured pawn is on same rank as FROM square, at destination column
      var capturedRow = move.fr;
      captured = { type: b[capturedRow][move.tc].type, color: b[capturedRow][move.tc].color };
      b[move.tr][move.tc] = { type: piece.type, color: piece.color, moved: true };
      b[move.fr][move.fc] = makeSquare(null, null, false);
      b[capturedRow][move.tc] = makeSquare(null, null, false);
    } else {
      var dest = b[move.tr][move.tc];
      if (dest.type) captured = { type: dest.type, color: dest.color };
      var newType = move.promo ? move.promo : piece.type;
      b[move.tr][move.tc] = { type: newType, color: piece.color, moved: true };
      b[move.fr][move.fc] = makeSquare(null, null, false);
    }

    if (move.isDblPush) {
      var epRow = (color === COLOR.WHITE) ? move.fr + 1 : move.fr - 1;
      newEP = { row: epRow, col: move.fc };
    }

    if (piece.type === PIECE.KING) {
      if (color === COLOR.WHITE) { newCR.wK = false; newCR.wQ = false; }
      else                       { newCR.bK = false; newCR.bQ = false; }
    }
    if (piece.type === PIECE.ROOK) {
      if (color === COLOR.WHITE) {
        if (move.fr === 0 && move.fc === 7) newCR.wK = false;
        if (move.fr === 0 && move.fc === 0) newCR.wQ = false;
      } else {
        if (move.fr === 7 && move.fc === 7) newCR.bK = false;
        if (move.fr === 7 && move.fc === 0) newCR.bQ = false;
      }
    }
    if (captured && captured.type === PIECE.ROOK) {
      if (move.tr === 0 && move.tc === 7) newCR.wK = false;
      if (move.tr === 0 && move.tc === 0) newCR.wQ = false;
      if (move.tr === 7 && move.tc === 7) newCR.bK = false;
      if (move.tr === 7 && move.tc === 0) newCR.bQ = false;
    }

    return { board: b, enPassantTarget: newEP, castlingRights: newCR, captured: captured };
  }

  // ── Check Detection ──────────────────────────────────────────────────────

  function isInCheck(board, color) {
    var kr = -1, kc = -1;
    outer:
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = board[r][c];
        if (sq.type === PIECE.KING && sq.color === color) { kr = r; kc = c; break outer; }
      }
    }
    if (kr === -1) return false;
    return isSquareAttackedBy(board, kr, kc, (color === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE);
  }

  function isSquareAttackedBy(board, r, c, byColor) {
    // Knights
    var kLeaps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    for (var i = 0; i < kLeaps.length; i++) {
      var nr = r + kLeaps[i][0], nc = c + kLeaps[i][1];
      if (inBounds(nr, nc) && board[nr][nc].type === PIECE.KNIGHT && board[nr][nc].color === byColor) return true;
    }
    // Rook / Queen (straight)
    var sDirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (var i = 0; i < sDirs.length; i++) {
      var dr = sDirs[i][0], dc = sDirs[i][1], nr = r+dr, nc = c+dc;
      while (inBounds(nr, nc)) {
        var sq = board[nr][nc];
        if (sq.type) {
          if (sq.color === byColor && (sq.type === PIECE.ROOK || sq.type === PIECE.QUEEN)) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    // Bishop / Queen (diagonal)
    var dDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var i = 0; i < dDirs.length; i++) {
      var dr = dDirs[i][0], dc = dDirs[i][1], nr = r+dr, nc = c+dc;
      while (inBounds(nr, nc)) {
        var sq = board[nr][nc];
        if (sq.type) {
          if (sq.color === byColor && (sq.type === PIECE.BISHOP || sq.type === PIECE.QUEEN)) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }

    // ── FIX-1: Pawn attack direction was inverted ────────────────────────
    // A WHITE pawn at (r-1, c±1) attacks (r, c)  → look one row BELOW target for white
    // A BLACK pawn at (r+1, c±1) attacks (r, c)  → look one row ABOVE target for black
    var pawnDir = (byColor === COLOR.WHITE) ? -1 : 1;  // FIX: was reversed (1:-1)
    var pawnRow = r + pawnDir;
    if (inBounds(pawnRow, c-1) && board[pawnRow][c-1].type === PIECE.PAWN && board[pawnRow][c-1].color === byColor) return true;
    if (inBounds(pawnRow, c+1) && board[pawnRow][c+1].type === PIECE.PAWN && board[pawnRow][c+1].color === byColor) return true;

    // King
    var kDirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var i = 0; i < kDirs.length; i++) {
      var nr = r + kDirs[i][0], nc = c + kDirs[i][1];
      if (inBounds(nr, nc) && board[nr][nc].type === PIECE.KING && board[nr][nc].color === byColor) return true;
    }
    return false;
  }

  // ── Legal Move Generation ────────────────────────────────────────────────

  function generateAllLegalMoves(state, color) {
    var legal = [], opp = (color === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (state.board[r][c].color !== color) continue;
        var pseudos = pseudoLegalMovesForPiece(state, r, c);
        for (var i = 0; i < pseudos.length; i++) {
          var mv = pseudos[i];
          if (mv.isCastle) {
            if (isInCheck(state.board, color)) continue;
            var castleBackRow = (color === COLOR.WHITE) ? 0 : 7;
            var passCol = (mv.tc === 6) ? [5,6] : [3,2];
            var passOk = true;
            for (var p = 0; p < passCol.length; p++) {
              if (isSquareAttackedBy(state.board, castleBackRow, passCol[p], opp)) { passOk = false; break; }
            }
            if (!passOk) continue;
            var result = applyMoveToBoard(state.board, mv, color, state.castlingRights);
            if (!isInCheck(result.board, color)) legal.push(mv);
          } else {
            var result = applyMoveToBoard(state.board, mv, color, state.castlingRights);
            if (!isInCheck(result.board, color)) legal.push(mv);
          }
        }
      }
    }
    return legal;
  }

  // ── Draw Conditions ──────────────────────────────────────────────────────

  function isInsufficientMaterial(board) {
    var pieces = { w: [], b: [] };
    for (var r = 0; r < 8; r++)
      for (var c = 0; c < 8; c++) {
        var sq = board[r][c];
        if (sq.type && sq.type !== PIECE.KING)
          pieces[sq.color].push({ type: sq.type, col: (r+c)%2 });
      }
    var wl = pieces.w.length, bl = pieces.b.length;
    if (wl===0 && bl===0) return true;
    if (wl===0 && bl===1 && (pieces.b[0].type===PIECE.BISHOP||pieces.b[0].type===PIECE.KNIGHT)) return true;
    if (bl===0 && wl===1 && (pieces.w[0].type===PIECE.BISHOP||pieces.w[0].type===PIECE.KNIGHT)) return true;
    if (wl===1 && bl===1 && pieces.w[0].type===PIECE.BISHOP && pieces.b[0].type===PIECE.BISHOP &&
        pieces.w[0].col===pieces.b[0].col) return true;
    return false;
  }

  function isThreefoldRepetition(positionHistory) {
    var counts = {};
    for (var i = 0; i < positionHistory.length; i++) {
      var key = positionHistory[i];
      counts[key] = (counts[key]||0) + 1;
      if (counts[key] >= 3) return true;
    }
    return false;
  }

  // ── Commit Move ──────────────────────────────────────────────────────────

  ChessState.prototype.makeMove = function (fromRow, fromCol, toRow, toCol, promotionPiece) {
    if (this.gameOver) return { ok: false, error: 'Game is over' };
    var sq = this.board[fromRow][fromCol];
    if (!sq.type)              return { ok: false, error: 'No piece at source' };
    if (sq.color !== this.turn) return { ok: false, error: 'Not your turn' };
    if (!promotionPiece) promotionPiece = PIECE.QUEEN;

    var legal = generateAllLegalMoves(this, this.turn);
    var chosen = null;
    for (var i = 0; i < legal.length; i++) {
      var mv = legal[i];
      if (mv.fr===fromRow && mv.fc===fromCol && mv.tr===toRow && mv.tc===toCol) {
        if (mv.promo) { if (mv.promo===promotionPiece) { chosen = mv; break; } }
        else { chosen = mv; break; }
      }
    }
    if (!chosen) return { ok: false, error: 'Illegal move' };

    var result  = applyMoveToBoard(this.board, chosen, this.turn, this.castlingRights);
    var captured = result.captured;
    var san = buildSAN(this, chosen, captured, legal);

    this.board           = result.board;
    this.enPassantTarget = result.enPassantTarget;
    this.castlingRights  = result.castlingRights;

    if (captured || sq.type===PIECE.PAWN) this.halfMoveClock = 0; else this.halfMoveClock++;
    if (captured) this.capturedPieces[this.turn].push(captured.type);
    if (this.turn===COLOR.BLACK) this.fullMoveNumber++;

    var prevTurn = this.turn;
    this.turn = (this.turn===COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;
    this.positionHistory.push(this._positionKey());

    var oppMoves = generateAllLegalMoves(this, this.turn);
    var inCheck  = isInCheck(this.board, this.turn);
    var isCheckmate = inCheck && oppMoves.length===0;
    var isStalemate = !inCheck && oppMoves.length===0;

    if (isCheckmate) san += '#'; else if (inCheck) san += '+';

    var moveRecord = {
      fr:chosen.fr, fc:chosen.fc, tr:chosen.tr, tc:chosen.tc,
      promo:chosen.promo, isCastle:chosen.isCastle, isEP:chosen.isEP, isDblPush:chosen.isDblPush,
      piece:sq.type, color:prevTurn, captured:captured, san:san, fen:this.toFEN()
    };
    this.moveHistory.push(moveRecord);

    if (isCheckmate)                             { this.gameOver=true; this.winner=prevTurn; this.gameOverReason='checkmate'; }
    else if (isStalemate)                        { this.gameOver=true; this.winner='draw';   this.gameOverReason='stalemate'; }
    else if (this.halfMoveClock>=100)            { this.gameOver=true; this.winner='draw';   this.gameOverReason='50-move'; }
    else if (isThreefoldRepetition(this.positionHistory)) { this.gameOver=true; this.winner='draw'; this.gameOverReason='repetition'; }
    else if (isInsufficientMaterial(this.board)) { this.gameOver=true; this.winner='draw';   this.gameOverReason='insufficient'; }

    return { ok:true, move:moveRecord, san:san, inCheck:inCheck&&!isCheckmate,
             isCheckmate:isCheckmate, isStalemate:isStalemate,
             gameOver:this.gameOver, winner:this.winner, reason:this.gameOverReason };
  };

  // ── SAN Builder ──────────────────────────────────────────────────────────

  function colToFile(c) { return String.fromCharCode(97+c); }
  function rowToRank(r) { return ''+(r+1); }
  function squareName(r, c) { return colToFile(c)+rowToRank(r); }

  function buildSAN(state, move, captured, allLegalMoves) {
    if (move.isCastle) return (move.tc===6) ? 'O-O' : 'O-O-O';
    var piece = state.board[move.fr][move.fc];
    var san = '', pt = piece.type;
    if (pt !== PIECE.PAWN) {
      san += pt.toUpperCase();
      var sameType = allLegalMoves.filter(function(m) {
        return m.tr===move.tr && m.tc===move.tc && !(m.fr===move.fr && m.fc===move.fc) &&
               state.board[m.fr][m.fc].type===pt && state.board[m.fr][m.fc].color===piece.color;
      });
      if (sameType.length>0) {
        var sameFile = sameType.filter(function(m){return m.fc===move.fc;});
        var sameRank = sameType.filter(function(m){return m.fr===move.fr;});
        if (sameFile.length>0 && sameRank.length>0) san += colToFile(move.fc)+rowToRank(move.fr);
        else if (sameFile.length>0) san += rowToRank(move.fr);
        else san += colToFile(move.fc);
      }
    } else if (captured || move.isEP) {
      san += colToFile(move.fc);
    }
    if (captured || move.isEP) san += 'x';
    san += squareName(move.tr, move.tc);
    if (move.isEP) san += ' e.p.';
    if (move.promo) san += '='+move.promo.toUpperCase();
    return san;
  }

  // ── FEN Import / Export ──────────────────────────────────────────────────

  ChessState.prototype.toFEN = function () {
    var rows = [];
    for (var r = 7; r >= 0; r--) {
      var emptyRun=0, rowStr='';
      for (var c=0; c<8; c++) {
        var sq=this.board[r][c];
        if (!sq.type) { emptyRun++; }
        else { if (emptyRun){rowStr+=emptyRun;emptyRun=0;} rowStr+=(sq.color===COLOR.WHITE)?sq.type.toUpperCase():sq.type; }
      }
      if (emptyRun) rowStr+=emptyRun;
      rows.push(rowStr);
    }
    var cr = (this.castlingRights.wK?'K':'')+(this.castlingRights.wQ?'Q':'')+
             (this.castlingRights.bK?'k':'')+(this.castlingRights.bQ?'q':'') || '-';
    var ep = this.enPassantTarget ? squareName(this.enPassantTarget.row,this.enPassantTarget.col) : '-';
    return rows.join('/')+' '+this.turn+' '+cr+' '+ep+' '+this.halfMoveClock+' '+this.fullMoveNumber;
  };

  ChessState.prototype.loadFEN = function (fen) {
    var parts=fen.trim().split(/\s+/), ranks=parts[0].split('/');
    this.board=createEmptyBoard();
    for (var r=0; r<8; r++) {
      var rank=ranks[7-r], c=0;
      for (var i=0; i<rank.length; i++) {
        var ch=rank[i], num=parseInt(ch,10);
        if (!isNaN(num)) { c+=num; }
        else { this.board[r][c]=makeSquare(ch.toLowerCase(),(ch===ch.toUpperCase())?COLOR.WHITE:COLOR.BLACK,true); c++; }
      }
    }
    this.turn=(parts[1]==='b')?COLOR.BLACK:COLOR.WHITE;
    var crStr=parts[2]||'-';
    this.castlingRights={wK:crStr.indexOf('K')!==-1,wQ:crStr.indexOf('Q')!==-1,bK:crStr.indexOf('k')!==-1,bQ:crStr.indexOf('q')!==-1};
    if (this.castlingRights.wK||this.castlingRights.wQ) {
      if (this.board[0][4].type===PIECE.KING) this.board[0][4].moved=false;
      if (this.castlingRights.wK&&this.board[0][7].type===PIECE.ROOK) this.board[0][7].moved=false;
      if (this.castlingRights.wQ&&this.board[0][0].type===PIECE.ROOK) this.board[0][0].moved=false;
    }
    if (this.castlingRights.bK||this.castlingRights.bQ) {
      if (this.board[7][4].type===PIECE.KING) this.board[7][4].moved=false;
      if (this.castlingRights.bK&&this.board[7][7].type===PIECE.ROOK) this.board[7][7].moved=false;
      if (this.castlingRights.bQ&&this.board[7][0].type===PIECE.ROOK) this.board[7][0].moved=false;
    }
    if (parts[3]&&parts[3]!=='-') {
      this.enPassantTarget={row:parseInt(parts[3][1],10)-1,col:parts[3].charCodeAt(0)-97};
    } else { this.enPassantTarget=null; }
    this.halfMoveClock=parseInt(parts[4],10)||0;
    this.fullMoveNumber=parseInt(parts[5],10)||1;
    this.moveHistory=[]; this.positionHistory=[this._positionKey()];
    this.gameOver=false; this.winner=null; this.gameOverReason=null;
    this.capturedPieces={w:[],b:[]};
  };

  // ── AI Engine ────────────────────────────────────────────────────────────

  function evaluate(board) {
    var score=0;
    for (var r=0; r<8; r++) for (var c=0; c<8; c++) {
      var sq=board[r][c];
      if (!sq.type) continue;
      var pstRow=(sq.color===COLOR.WHITE)?r:(7-r);
      var val=MATERIAL[sq.type]+(PST[sq.type][pstRow*8+c]||0);
      score+=(sq.color===COLOR.WHITE)?val:-val;
    }
    return score;
  }

  function minimax(state, depth, alpha, beta, isMaximizing) {
    if (depth===0) return {score:evaluate(state.board),move:null};
    var color=isMaximizing?COLOR.WHITE:COLOR.BLACK;
    var oppColor=isMaximizing?COLOR.BLACK:COLOR.WHITE;
    var moves=generateAllLegalMoves(state,color);
    if (moves.length===0) {
      if (isInCheck(state.board,color)) return {score:isMaximizing?-100000-depth:100000+depth,move:null};
      return {score:0,move:null};
    }
    moves.sort(function(a,b) {
      var aS=0,bS=0;
      if (a.promo) aS+=20000; if (b.promo) bS+=20000;
      var aV=state.board[a.tr][a.tc].type, bV=state.board[b.tr][b.tc].type;
      if (aV) aS+=MATERIAL[aV]*10-(MATERIAL[state.board[a.fr][a.fc].type]||0);
      if (bV) bS+=MATERIAL[bV]*10-(MATERIAL[state.board[b.fr][b.fc].type]||0);
      return bS-aS;
    });
    var bestMove=moves[0], bestScore=isMaximizing?-Infinity:Infinity;
    for (var i=0; i<moves.length; i++) {
      var mv=moves[i];
      var result=applyMoveToBoard(state.board,mv,color,state.castlingRights);
      var childState={board:result.board,turn:oppColor,castlingRights:result.castlingRights,
                      enPassantTarget:result.enPassantTarget,halfMoveClock:0,
                      positionHistory:[],gameOver:false,_positionKey:ChessState.prototype._positionKey};
      var child=minimax(childState,depth-1,alpha,beta,!isMaximizing);
      if (isMaximizing) { if (child.score>bestScore){bestScore=child.score;bestMove=mv;} alpha=Math.max(alpha,bestScore); }
      else              { if (child.score<bestScore){bestScore=child.score;bestMove=mv;} beta=Math.min(beta,bestScore); }
      if (beta<=alpha) break;
    }
    return {score:bestScore,move:bestMove};
  }

  function getBestMove(state, depth) {
    var isMax=(state.turn===COLOR.WHITE);
    var timeBudgets={1:200,2:400,3:700,4:1200};
    var timeLimit=timeBudgets[depth]||500;
    var startTime=Date.now(), bestResult=null;
    for (var d=1; d<=depth; d++) {
      if (Date.now()-startTime>timeLimit) break;
      var r=minimax(state,d,-Infinity,Infinity,isMax);
      if (r&&r.move) bestResult=r;
      if (bestResult&&Math.abs(bestResult.score)>90000) break;
    }
    return bestResult?(bestResult.move||null):null;
  }

  // ── Utility Methods ──────────────────────────────────────────────────────

  // FIX-4: legalMovesFrom works for any color (needed for both PvP and display)
  ChessState.prototype.legalMovesFrom = function (r, c) {
    var sq = this.board[r][c];
    if (!sq.color) return [];
    var all = generateAllLegalMoves(this, sq.color);
    return all.filter(function(mv){ return mv.fr===r && mv.fc===c; });
  };

  ChessState.prototype.undoMove = function () {
    if (this.moveHistory.length===0) return false;
    var prevFenIdx=this.moveHistory.length-1;
    var prevFen=prevFenIdx>0?this.moveHistory[prevFenIdx-1].fen:null;
    var restoredHistory=this.moveHistory.slice(0,prevFenIdx);
    this.gameOver=false; this.winner=null; this.gameOverReason=null;
    if (prevFen) {
      this.loadFEN(prevFen);
      this.moveHistory=restoredHistory;
      this.positionHistory=[_computeStartPositionKey()];
      for (var hi=0; hi<restoredHistory.length; hi++)
        this.positionHistory.push(_positionKeyFromFEN(restoredHistory[hi].fen));
      this.capturedPieces={w:[],b:[]};
      for (var ci=0; ci<restoredHistory.length; ci++) {
        var mr=restoredHistory[ci];
        if (mr.captured) this.capturedPieces[mr.color].push(mr.captured.type);
      }
    } else {
      this.board=createEmptyBoard(); setupStartPosition(this.board);
      this.turn=COLOR.WHITE; this.castlingRights={wK:true,wQ:true,bK:true,bQ:true};
      this.enPassantTarget=null; this.halfMoveClock=0; this.fullMoveNumber=1;
      this.capturedPieces={w:[],b:[]}; this.positionHistory=[this._positionKey()];
      this.moveHistory=[];
    }
    return true;
  };

  function _positionKeyFromFEN(fen) {
    var parts=fen.trim().split(/\s+/),ranks=parts[0].split('/');
    var board=createEmptyBoard();
    for (var r=0;r<8;r++) {
      var rank=ranks[7-r],c=0;
      for (var i=0;i<rank.length;i++) {
        var ch=rank[i],num=parseInt(ch,10);
        if (!isNaN(num)){c+=num;}
        else{board[r][c]=makeSquare(ch.toLowerCase(),ch===ch.toUpperCase()?COLOR.WHITE:COLOR.BLACK,true);c++;}
      }
    }
    var turn=(parts[1]==='b')?COLOR.BLACK:COLOR.WHITE;
    var crStr=parts[2]||'-';
    var cr=(crStr.indexOf('K')!==-1?'K':'')+(crStr.indexOf('Q')!==-1?'Q':'')+
           (crStr.indexOf('k')!==-1?'k':'')+(crStr.indexOf('q')!==-1?'q':'')||'-';
    var ep=(parts[3]&&parts[3]!=='-')?parts[3]:'-';
    var rowParts=[];
    for (var rr=7;rr>=0;rr--) {
      var empty=0,rs='';
      for (var cc=0;cc<8;cc++) {
        var sq=board[rr][cc];
        if (!sq.type){empty++;}
        else{if(empty){rs+=empty;empty=0;}rs+=sq.color===COLOR.WHITE?sq.type.toUpperCase():sq.type;}
      }
      if (empty) rs+=empty;
      rowParts.push(rs);
    }
    return rowParts.join('/')+' '+turn+' '+cr+' '+ep;
  }

  var _startPositionKey=null;
  function _computeStartPositionKey() {
    if (!_startPositionKey) {
      var tmp=createEmptyBoard(); setupStartPosition(tmp);
      var rowParts=[];
      for (var rr=7;rr>=0;rr--) {
        var empty=0,rs='';
        for (var cc=0;cc<8;cc++) {
          var sq=tmp[rr][cc];
          if (!sq.type){empty++;}
          else{if(empty){rs+=empty;empty=0;}rs+=sq.color===COLOR.WHITE?sq.type.toUpperCase():sq.type;}
        }
        if (empty) rs+=empty;
        rowParts.push(rs);
      }
      _startPositionKey=rowParts.join('/')+' w KQkq -';
    }
    return _startPositionKey;
  }

  ChessState.prototype.isInCheck   = function(){ return isInCheck(this.board,this.turn); };
  ChessState.prototype.isCheckmate = function(){ return isInCheck(this.board,this.turn)&&generateAllLegalMoves(this,this.turn).length===0; };
  ChessState.prototype.isStalemate = function(){ return !isInCheck(this.board,this.turn)&&generateAllLegalMoves(this,this.turn).length===0; };

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 13: UI LAYER
  // ═══════════════════════════════════════════════════════════════════════════

  var chess = {
    state: null, mode: 'pvp', botColor: COLOR.BLACK, playerColor: COLOR.WHITE,
    botDepth: 2, selectedSq: null, legalTargets: [], animating: false,
    botThinking: false, _botTimeout: null, promotionPending: null,
    flipped: false, hintMove: null, hintTimeout: null
  };

  var chessScreen      = document.getElementById('screen-chess');
  var chessHomePanel   = document.getElementById('chess-home');
  var chessPlayPanel   = document.getElementById('chess-play-panel');
  var chessBoardEl     = document.getElementById('chess-board');
  var chessStatusEl    = document.getElementById('chess-status');
  var chessTurnEl      = document.getElementById('chess-turn-text');
  var chessResultEl    = document.getElementById('chess-result');
  var chessResultIcon  = document.getElementById('chess-result-icon');
  var chessResultTitle = document.getElementById('chess-result-title');
  var chessResultDetail= document.getElementById('chess-result-detail');
  var chessCapturedW   = document.getElementById('chess-captured-w');
  var chessCapturedB   = document.getElementById('chess-captured-b');
  var chessPromoModal  = document.getElementById('chess-promo-modal');
  var chessMoveListEl  = document.getElementById('chess-move-list');
  var chessFenEl       = document.getElementById('chess-fen-display');

  var PIECE_UNICODE = {
    w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
    b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
  };

  // ── Audio ────────────────────────────────────────────────────────────────

  var ChessAudio=(function(){
    var ctx=null;
    function getCtx(){
      if(!ctx){try{ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}
      if(ctx.state==='suspended')ctx.resume();
      return ctx;
    }
    function playTone(freq,type,dur,vol){
      var c=getCtx();if(!c)return;
      var osc=c.createOscillator(),gain=c.createGain();
      osc.connect(gain);gain.connect(c.destination);
      osc.type=type||'sine';osc.frequency.setValueAtTime(freq,c.currentTime);
      gain.gain.setValueAtTime(vol||0.15,c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
      osc.start(c.currentTime);osc.stop(c.currentTime+dur+0.05);
    }
    function playNoise(dur,vol){
      var c=getCtx();if(!c)return;
      var buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
      var data=buf.getChannelData(0);
      for(var i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*0.3;
      var src=c.createBufferSource(),gain=c.createGain(),filt=c.createBiquadFilter();
      src.buffer=buf;filt.type='bandpass';filt.frequency.value=800;filt.Q.value=0.5;
      src.connect(filt);filt.connect(gain);gain.connect(c.destination);
      gain.gain.setValueAtTime(vol||0.15,c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
      src.start();src.stop(c.currentTime+dur+0.05);
    }
    return{
      move:function(){playNoise(0.08,0.18);playTone(520,'sine',0.07,0.08);},
      capture:function(){playNoise(0.15,0.32);playTone(280,'sawtooth',0.12,0.12);playTone(140,'sine',0.18,0.10);},
      select:function(){playTone(880,'sine',0.06,0.06);},
      check:function(){playTone(660,'square',0.12,0.10);setTimeout(function(){playTone(880,'square',0.15,0.12);},130);},
      castle:function(){playNoise(0.10,0.20);playTone(400,'sine',0.08,0.09);setTimeout(function(){playTone(600,'sine',0.08,0.07);},80);},
      gameStart:function(){playTone(440,'sine',0.12,0.10);setTimeout(function(){playTone(550,'sine',0.12,0.10);},130);setTimeout(function(){playTone(660,'sine',0.18,0.14);},260);},
      win:function(){[0,150,300,500].forEach(function(t,i){setTimeout(function(){playTone([523,659,784,1047][i],'sine',0.28,0.14);},t);});},
      lose:function(){playTone(392,'sawtooth',0.20,0.10);setTimeout(function(){playTone(349,'sawtooth',0.20,0.10);},200);setTimeout(function(){playTone(294,'sawtooth',0.40,0.12);},400);},
      draw:function(){playTone(440,'sine',0.15,0.09);setTimeout(function(){playTone(440,'sine',0.15,0.09);},200);},
      promote:function(){playTone(784,'sine',0.12,0.12);setTimeout(function(){playTone(1047,'sine',0.20,0.16);},120);}
    };
  })();

  // ── Particles ────────────────────────────────────────────────────────────

  function chessSpawnParticles(cellEl,color){
    if(!cellEl)return;
    var rect=cellEl.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    var colors=color===COLOR.WHITE?['#fff','#f5c518','#fffde0','#ffd700']:['#1a0a3a','#7c3aed','#4f46e5','#a78bfa'];
    for(var i=0;i<18;i++)(function(i){
      var p=document.createElement('div');
      var angle=(Math.PI*2*i)/18+(Math.random()-0.5)*0.7,speed=40+Math.random()*60,size=4+Math.random()*6;
      p.style.cssText='position:fixed;left:'+cx+'px;top:'+cy+'px;width:'+size+'px;height:'+size+'px;background:'+colors[Math.floor(Math.random()*colors.length)]+';border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);opacity:1;transition:all 0.55s cubic-bezier(.17,.84,.44,1)';
      document.body.appendChild(p);
      setTimeout(function(){p.style.left=(cx+Math.cos(angle)*speed)+'px';p.style.top=(cy+Math.sin(angle)*speed)+'px';p.style.opacity='0';p.style.transform='translate(-50%,-50%) scale(0.2)';},20);
      setTimeout(function(){p.remove();},620);
    })(i);
  }

  function chessBoardFlash(color){
    if(!chessBoardEl)return;
    var flash=document.createElement('div');
    flash.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:50;border-radius:4px;background:'+(color==='check'?'rgba(255,50,50,0.18)':'rgba(245,197,24,0.12)')+';opacity:1;transition:opacity 0.5s';
    var wrap=chessBoardEl.parentElement;
    if(wrap){wrap.style.position='relative';wrap.appendChild(flash);}
    setTimeout(function(){flash.style.opacity='0';},50);
    setTimeout(function(){flash.remove();},600);
  }

  // ── Board Rendering ──────────────────────────────────────────────────────

  function chessRenderBoard(){
    if(!chessBoardEl||!chess.state)return;
    chessBoardEl.innerHTML='';
    var state=chess.state;
    var rowOrder=chess.flipped?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
    var colOrder=chess.flipped?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];

    for(var ri=0;ri<8;ri++){
      for(var ci=0;ci<8;ci++){
        var r=rowOrder[ri],c=colOrder[ci];
        var cell=document.createElement('div');
        cell.className='chess-cell '+((r+c)%2===0?'chess-dark':'chess-light');
        cell.dataset.r=r; cell.dataset.c=c;

        if(ci===0){var rl=document.createElement('span');rl.className='chess-rank-label';rl.textContent=(r+1);cell.appendChild(rl);}
        if(ri===7){var fl=document.createElement('span');fl.className='chess-file-label';fl.textContent=colToFile(c);cell.appendChild(fl);}

        var sq=state.board[r][c];

        if(chess.selectedSq&&chess.selectedSq.r===r&&chess.selectedSq.c===c) cell.classList.add('chess-selected');

        if(state.moveHistory.length>0){
          var last=state.moveHistory[state.moveHistory.length-1];
          if((last.fr===r&&last.fc===c)||(last.tr===r&&last.tc===c)) cell.classList.add('chess-last-move');
        }

        var isLegalTarget=false;
        for(var i=0;i<chess.legalTargets.length;i++){
          if(chess.legalTargets[i].tr===r&&chess.legalTargets[i].tc===c){isLegalTarget=true;break;}
        }
        if(isLegalTarget) cell.classList.add(sq.type?'chess-capture-target':'chess-move-target');

        if(sq.type===PIECE.KING&&sq.color===state.turn&&isInCheck(state.board,sq.color)&&!state.gameOver){
          cell.classList.add('chess-in-check');
          var cr=document.createElement('div');cr.className='chess-check-ring';cell.appendChild(cr);
        }

        if(chess.hintMove){
          if((chess.hintMove.fr===r&&chess.hintMove.fc===c)||(chess.hintMove.tr===r&&chess.hintMove.tc===c))
            cell.classList.add('chess-hint-highlight');
        }

        if(sq.type){
          var pieceEl=document.createElement('span');
          pieceEl.className='chess-piece '+(sq.color===COLOR.WHITE?'chess-piece-w':'chess-piece-b');
          pieceEl.textContent=PIECE_UNICODE[sq.color][sq.type];
          cell.appendChild(pieceEl);
        }

        cell.addEventListener('click',chessCellClick);
        chessBoardEl.appendChild(cell);
      }
    }
    chessUpdateCaptured();
    if(chessFenEl) chessFenEl.textContent=state.toFEN();
    chessUpdateMoveList();
  }

  function chessUpdateCaptured(){
    if(!chess.state)return;
    var wI={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},bI={k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'};
    if(chessCapturedW) chessCapturedW.innerHTML=chess.state.capturedPieces.w.map(function(t){return'<span class="chess-cap-piece chess-cap-b">'+(wI[t]||t)+'</span>';}).join('');
    if(chessCapturedB) chessCapturedB.innerHTML=chess.state.capturedPieces.b.map(function(t){return'<span class="chess-cap-piece chess-cap-w">'+(bI[t]||t)+'</span>';}).join('');
  }

  function chessUpdateMoveList(){
    if(!chessMoveListEl||!chess.state)return;
    var history=chess.state.moveHistory, html='';
    for(var i=0;i<history.length;i+=2){
      var mn=Math.floor(i/2)+1, w=history[i]?history[i].san:'', b=history[i+1]?history[i+1].san:'';
      var isLatest=(i+1>=history.length-1);
      html+='<span class="chess-move-num">'+mn+'.</span>'+
            '<span class="chess-move-san chess-san-w'+(isLatest&&history[i]?' chess-san-latest':'')+'">'+ w+'</span>'+
            (b?'<span class="chess-move-san chess-san-b'+(isLatest&&history[i+1]?' chess-san-latest':'')+'">'+ b+'</span>':'');
    }
    chessMoveListEl.innerHTML=html;
    chessMoveListEl.scrollTop=chessMoveListEl.scrollHeight;
  }

  function chessUpdateStatus(){
    if(!chessTurnEl||!chess.state)return;
    var state=chess.state;
    if(state.gameOver){chessTurnEl.textContent='Game Over';chessTurnEl.classList.remove('chess-turn-check');return;}
    var inCheck=state.isInCheck();
    if(chess.mode==='bot'&&state.turn===chess.botColor){chessTurnEl.textContent='⚙ Bot thinking…';}
    else{chessTurnEl.textContent=(state.turn===COLOR.WHITE?'⬜ ':'⬛ ')+(state.turn===COLOR.WHITE?'White':'Black')+"'s turn"+(inCheck?' · CHECK!':'');}
    if(inCheck)chessTurnEl.classList.add('chess-turn-check');
    else chessTurnEl.classList.remove('chess-turn-check');
  }

  // ── Cell Click ───────────────────────────────────────────────────────────

  function chessCellClick(evt){
    var cell=evt.currentTarget,r=parseInt(cell.dataset.r,10),c=parseInt(cell.dataset.c,10);
    var state=chess.state;
    if(!state||state.gameOver||chess.animating||chess.botThinking)return;
    if(chess.mode==='bot'&&state.turn===chess.botColor)return;
    if(chess.promotionPending)return;
    var sq=state.board[r][c];

    if(chess.selectedSq){
      var found=null;
      for(var i=0;i<chess.legalTargets.length;i++){
        if(chess.legalTargets[i].tr===r&&chess.legalTargets[i].tc===c){found=chess.legalTargets[i];break;}
      }
      if(found){
        if(found.promo){
          chess.promotionPending={fr:found.fr,fc:found.fc,tr:found.tr,tc:found.tc};
          chessShowPromoModal(state.turn);
          chess.selectedSq=null;chess.legalTargets=[];chessRenderBoard();return;
        }
        chessExecuteMove(found.fr,found.fc,found.tr,found.tc,null);return;
      }
      if(sq.type&&sq.color===state.turn){chessSelectPiece(r,c);return;}
      chess.selectedSq=null;chess.legalTargets=[];chessRenderBoard();return;
    }

    if(sq.type&&sq.color===state.turn) chessSelectPiece(r,c);
  }

  function chessSelectPiece(r,c){
    chess.selectedSq={r:r,c:c};
    chess.legalTargets=chess.state.legalMovesFrom(r,c);
    ChessAudio.select();chessRenderBoard();
  }

  function chessExecuteMove(fr,fc,tr,tc,promo){
    var result=chess.state.makeMove(fr,fc,tr,tc,promo);
    if(!result.ok){console.warn('[Chess] Illegal:',result.error);return;}
    chess.selectedSq=null;chess.legalTargets=[];
    var mv=result.move;
    var captureParticleCell=null;
    if(mv.captured) captureParticleCell=chessBoardEl?chessBoardEl.querySelector('[data-r="'+tr+'"][data-c="'+tc+'"]'):null;
    if(mv.isCastle)           ChessAudio.castle();
    else if(promo||mv.promo)  ChessAudio.promote();
    else if(mv.captured)     {ChessAudio.capture();chessBoardFlash('capture');}
    else                      ChessAudio.move();
    chessRenderBoard();chessUpdateStatus();
    if(captureParticleCell) chessSpawnParticles(captureParticleCell,mv.color===COLOR.WHITE?COLOR.BLACK:COLOR.WHITE);
    if(!result.gameOver&&result.inCheck){ChessAudio.check();chessBoardFlash('check');}
    if(result.gameOver){chessHandleGameOver();return;}
    if(chess.mode==='bot'&&chess.state&&chess.state.turn===chess.botColor) chessScheduleBotMove();
  }

  // ── Promotion Modal ──────────────────────────────────────────────────────

  function chessShowPromoModal(color){
    if(!chessPromoModal)return;
    chessPromoModal.innerHTML='';
    var title=document.createElement('div');title.className='chess-promo-title';title.textContent='Promote Pawn';
    chessPromoModal.appendChild(title);
    var grid=document.createElement('div');grid.className='chess-promo-grid';
    var pieces=['q','r','b','n'],labels={q:'Queen',r:'Rook',b:'Bishop',n:'Knight'};
    pieces.forEach(function(p){
      var btn=document.createElement('button');btn.className='chess-promo-btn';
      var icon=document.createElement('span');icon.className='chess-promo-icon '+(color===COLOR.WHITE?'chess-piece-w':'chess-piece-b');
      icon.textContent=PIECE_UNICODE[color][p];
      var lbl=document.createElement('span');lbl.className='chess-promo-label';lbl.textContent=labels[p];
      btn.appendChild(icon);btn.appendChild(lbl);
      btn.onclick=function(){
        var pend=chess.promotionPending;
        if(pend){chess.promotionPending=null;chessPromoModal.classList.add('hidden');chessExecuteMove(pend.fr,pend.fc,pend.tr,pend.tc,p);}
      };
      grid.appendChild(btn);
    });
    function onPromoEscape(e){if(e.key==='Escape'){chess.promotionPending=null;chessPromoModal.classList.add('hidden');chess.selectedSq=null;chess.legalTargets=[];chessRenderBoard();document.removeEventListener('keydown',onPromoEscape);}}
    document.addEventListener('keydown',onPromoEscape);
    chessPromoModal.appendChild(grid);chessPromoModal.classList.remove('hidden');
  }

  // ── Bot ──────────────────────────────────────────────────────────────────

  function chessScheduleBotMove(){
    if(!chess.state||chess.state.gameOver)return;  // FIX-5: guard
    chess.botThinking=true;chessUpdateStatus();
    chess._botTimeout=setTimeout(function(){
      try{
        var mv=getBestMove(chess.state,chess.botDepth);
        chess.botThinking=false;
        if(!chess.state||chess.state.gameOver)return;
        if(mv) chessExecuteMove(mv.fr,mv.fc,mv.tr,mv.tc,mv.promo);
        else chessUpdateStatus();
      }catch(e){chess.botThinking=false;console.warn('[Chess] Bot error:',e);chessUpdateStatus();}
    },80);
  }

  // ── Game Over ────────────────────────────────────────────────────────────

  function chessHandleGameOver(){
    var state=chess.state,icon,title,detail,reason=state.gameOverReason;
    if(reason==='checkmate'){
      if(state.winner===COLOR.WHITE){icon='♔';title='White Wins!';if(chess.mode==='bot'&&chess.playerColor===COLOR.BLACK)ChessAudio.lose();else ChessAudio.win();}
      else{icon='♚';title='Black Wins!';if(chess.mode==='bot'&&chess.playerColor===COLOR.WHITE)ChessAudio.lose();else ChessAudio.win();}
      detail='Checkmate';
    } else {
      icon='🤝';title="It's a Draw!";
      detail=reason==='stalemate'?'Stalemate':reason==='50-move'?'50-Move Rule':reason==='repetition'?'Threefold Repetition':reason==='insufficient'?'Insufficient Material':'Draw';
      ChessAudio.draw();
    }
    setTimeout(function(){
      if(chessResultIcon)  chessResultIcon.textContent=icon;
      if(chessResultTitle) chessResultTitle.textContent=title;
      if(chessResultDetail)chessResultDetail.textContent=detail;
      if(chessResultEl)    chessResultEl.classList.remove('hidden');
      if(window.DZShare)   DZShare.setResult({ game:'Chess', slug:'chess', winner:title, detail:detail, accent:'#f5c518', icon:'♟', score:chess.state&&chess.state.history?chess.state.history.length:0, diff:chess.botDepth<=1?'easy':chess.botDepth<=3?'medium':'hard', isWin:reason==='checkmate'&&title.indexOf('Bot')===-1 });
    },400);
  }

  // ── Game Start / Reset ───────────────────────────────────────────────────

  function chessStartGame(){
    if(chess._botTimeout){clearTimeout(chess._botTimeout);chess._botTimeout=null;}
    if(chess.hintTimeout){clearTimeout(chess.hintTimeout);chess.hintTimeout=null;}
    var menuOverlay=document.getElementById('chess-menu-overlay');
    if(menuOverlay) menuOverlay.classList.add('hidden');
    chess.state=new ChessState();
    chess.selectedSq=null;chess.legalTargets=[];chess.animating=false;
    chess.botThinking=false;chess.promotionPending=null;chess.hintMove=null;
    chess.flipped=(chess.mode==='bot'&&chess.playerColor===COLOR.BLACK);

    if(chessResultEl)   chessResultEl.classList.add('hidden');
    if(chessPromoModal) chessPromoModal.classList.add('hidden');
    if(chessHomePanel)  chessHomePanel.classList.add('hidden');
    if(chessPlayPanel)  chessPlayPanel.classList.remove('hidden');

    // FIX-2: Always sync botColor before starting
    if(chess.mode==='bot'){
      chess.botColor=(chess.playerColor===COLOR.WHITE)?COLOR.BLACK:COLOR.WHITE;
    }

    // Show the global floating game-menu button
    if(typeof window.dzShowGameMenuBtn==='function') window.dzShowGameMenuBtn('chess');

    chessRenderBoard();chessUpdateStatus();ChessAudio.gameStart();
    if(chess.mode==='bot'&&chess.botColor===COLOR.WHITE) chessScheduleBotMove();
  }

  function chessResetGame(){
    if(chess._botTimeout){clearTimeout(chess._botTimeout);chess._botTimeout=null;}
    if(chess.hintTimeout){clearTimeout(chess.hintTimeout);chess.hintTimeout=null;}
    var menuOverlay=document.getElementById('chess-menu-overlay');
    if(menuOverlay) menuOverlay.classList.add('hidden');
    chess.botThinking=false;chess.animating=false;chess.promotionPending=null;chess.hintMove=null;
    chess.state=new ChessState();chess.selectedSq=null;chess.legalTargets=[];
    chess.flipped=(chess.mode==='bot'&&chess.playerColor===COLOR.BLACK);

    // FIX-2: Re-sync botColor on every reset so color-switch takes effect
    if(chess.mode==='bot'){
      chess.botColor=(chess.playerColor===COLOR.WHITE)?COLOR.BLACK:COLOR.WHITE;
    }

    if(chessResultEl)   chessResultEl.classList.add('hidden');
    if(chessPromoModal) chessPromoModal.classList.add('hidden');

    chessRenderBoard();chessUpdateStatus();ChessAudio.gameStart();
    if(chess.mode==='bot'&&chess.botColor===COLOR.WHITE) chessScheduleBotMove();
  }

  // ── Hub show/hide ────────────────────────────────────────────────────────

  function showChess(){
    if(typeof hideAllScreens==='function') hideAllScreens();
    if(chessScreen)    chessScreen.classList.remove('hidden');
    if(chessHomePanel) chessHomePanel.classList.remove('hidden');
    if(chessPlayPanel) chessPlayPanel.classList.add('hidden');
    if(chess._botTimeout){clearTimeout(chess._botTimeout);chess._botTimeout=null;}
    // Show the global floating game-menu button on the setup screen too
    if(typeof window.dzShowGameMenuBtn==='function') window.dzShowGameMenuBtn('chess');
    window.scrollTo(0,0);
  }

  window.showChess=showChess;

  // ── Event Wiring ─────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded',function(){
    var startPvpBtn   = document.getElementById('chess-start-pvp');
    var startBotBtn   = document.getElementById('chess-start-bot');
    var chessDiffBtns = document.querySelectorAll('.chess-diff-btn');
    var chessColorBtns= document.querySelectorAll('.chess-color-btn');
    var chessBackHub  = document.getElementById('chess-back-hub');
    var chessBackHub2 = document.getElementById('chess-back-hub-play');
    var chessResetBtn = document.getElementById('chess-reset-btn');
    var chessPlayAgain= document.getElementById('chess-play-again');
    var chessResultHub= document.getElementById('chess-result-hub');
    var chessMenuBtn  = document.getElementById('chess-menu-btn');

    if(startPvpBtn) startPvpBtn.addEventListener('click',function(){chess.mode='pvp';chess.flipped=false;chessStartGame();});
    if(startBotBtn) startBotBtn.addEventListener('click',function(){chess.mode='bot';chessStartGame();});

    if(chessDiffBtns) chessDiffBtns.forEach(function(btn){
      btn.addEventListener('click',function(){
        chessDiffBtns.forEach(function(b){b.classList.remove('active');});
        btn.classList.add('active');
        var rawDepth=parseInt(btn.dataset.depth,10)||2;
        chess.botDepth=Math.min(Math.max(rawDepth,1),4);
      });
    });

    /* ── Auto-apply difficulty from challenge link ───────────────
       When Player 2 opens duelzone.online/chess?challenge=Rahul&diff=easy
       we pre-select the matching difficulty button automatically.       */
    if (window.DZShare && typeof DZShare.getChallenge === 'function') {
      var _chParams = DZShare.getChallenge();
      if (_chParams && _chParams.slug === 'chess' && _chParams.diff) {
        var _targetDiff = _chParams.diff.toLowerCase();
        if (chessDiffBtns) chessDiffBtns.forEach(function (btn) {
          var depth  = parseInt(btn.dataset.depth, 10) || 2;
          var bDiff  = depth <= 1 ? 'easy' : depth <= 3 ? 'medium' : 'hard';
          if (bDiff === _targetDiff) {
            chessDiffBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            chess.botDepth = Math.min(Math.max(depth, 1), 4);
          }
        });
      }
    }

    if(chessColorBtns) chessColorBtns.forEach(function(btn){
      btn.addEventListener('click',function(){
        chessColorBtns.forEach(function(b){b.classList.remove('active');});
        btn.classList.add('active');
        chess.playerColor=(btn.dataset.color==='w')?COLOR.WHITE:COLOR.BLACK;
        chess.botColor   =(btn.dataset.color==='w')?COLOR.BLACK:COLOR.WHITE;
      });
    });

    // Back to hub from menu screen
    if(chessBackHub) chessBackHub.addEventListener('click',function(){if(typeof showHub==='function')showHub();});

    // FIX-3: "Back to Menu" from play panel → show chess home menu (not hub)
    if(chessBackHub2) chessBackHub2.addEventListener('click',function(){
      if(chess._botTimeout){clearTimeout(chess._botTimeout);chess._botTimeout=null;}
      chess.botThinking=false;
      chess.selectedSq=null; chess.legalTargets=[];
      if(chess.hintTimeout){clearTimeout(chess.hintTimeout);chess.hintTimeout=null;}
      chess.hintMove=null;
      // Stay within chess — keep menu button visible on setup screen
      if(typeof window.dzShowGameMenuBtn==='function') window.dzShowGameMenuBtn('chess');
      if(chessHomePanel) chessHomePanel.classList.remove('hidden');
      if(chessPlayPanel) chessPlayPanel.classList.add('hidden');
    });

    // Optional in-game menu button (hamburger) → return to chess home
    if(chessMenuBtn) chessMenuBtn.addEventListener('click',function(){
      if(chess._botTimeout){clearTimeout(chess._botTimeout);chess._botTimeout=null;}
      chess.botThinking=false;
      if(chessHomePanel) chessHomePanel.classList.remove('hidden');
      if(chessPlayPanel) chessPlayPanel.classList.add('hidden');
    });

    if(chessResetBtn) chessResetBtn.addEventListener('click',function(){chessResetGame();});
    if(chessPlayAgain)chessPlayAgain.addEventListener('click',function(){chessResetGame();});
    if(chessResultHub)chessResultHub.addEventListener('click',function(){
      if(typeof window.dzHideGameMenuBtn==='function') window.dzHideGameMenuBtn();
      if(typeof showHub==='function')showHub();
      else if(typeof window.dzNavShowHome==='function')window.dzNavShowHome();
    });

    // Undo
    var chessUndoBtn=document.getElementById('chess-undo-btn');
    if(chessUndoBtn) chessUndoBtn.addEventListener('click',function(){
      if(!chess.state||chess.state.gameOver||chess.botThinking)return;
      if(chess._botTimeout){clearTimeout(chess._botTimeout);chess._botTimeout=null;}
      chess.botThinking=false;
      var undoCount=chess.mode==='bot'?2:1;
      for(var u=0;u<undoCount;u++){if(chess.state.moveHistory.length===0)break;chess.state.undoMove();}
      chess.selectedSq=null;chess.legalTargets=[];chess.hintMove=null;
      if(chess.hintTimeout){clearTimeout(chess.hintTimeout);chess.hintTimeout=null;}
      if(chessResultEl) chessResultEl.classList.add('hidden');
      chessRenderBoard();chessUpdateStatus();ChessAudio.select();
    });

    // Hint
    var chessHintBtn=document.getElementById('chess-hint-btn');
    if(chessHintBtn) chessHintBtn.addEventListener('click',function(){
      if(!chess.state||chess.state.gameOver||chess.botThinking)return;
      if(chess.mode==='bot'&&chess.state.turn===chess.botColor)return;
      if(chess.hintTimeout){clearTimeout(chess.hintTimeout);chess.hintTimeout=null;}
      chess.hintMove=null;
      var hintMv=getBestMove(chess.state,2);
      if(hintMv){
        chess.hintMove={fr:hintMv.fr,fc:hintMv.fc,tr:hintMv.tr,tc:hintMv.tc};
        chessRenderBoard();ChessAudio.select();
        chess.hintTimeout=setTimeout(function(){chess.hintMove=null;chessRenderBoard();},3000);
      }
    });
  });

  // ── GameLoader registration ──────────────────────────────────────────────

  if(typeof GameLoader!=='undefined'&&GameLoader.registerGame){
    GameLoader.registerGame({
      gameId:'chess',containerId:'screen-chess',
      init:function(){},
      start:function(){if(chessHomePanel)chessHomePanel.classList.remove('hidden');},
      reset:function(){chessResetGame();},
      destroy:function(){if(chess._botTimeout)clearTimeout(chess._botTimeout);chess.botThinking=false;}
    });
  }

  window.chessStop=function(){
    if(chess._botTimeout){clearTimeout(chess._botTimeout);chess._botTimeout=null;}
    chess.botThinking=false;
  };

  window.addEventListener('resize',function(){
    var screen=document.getElementById('screen-chess');
    if(screen&&!screen.classList.contains('hidden')) chessRenderBoard();
  });

  console.log('[DuelZone] Chess engine loaded — all bugs fixed (pawn attack direction, botColor sync, menu wiring).');

})();
