// ═══════════════════════════════════════════════════════════════════════════
// DuelZone · Chess Engine  —  chess.js
// Full FIDE-compliant chess engine with:
//   • Board representation (8×8, 0-indexed row/col, row 0 = rank 1)
//   • Complete piece movement: pawn, rook, knight, bishop, queen, king
//   • En passant, castling (both sides), promotion
//   • Check / checkmate / stalemate detection
//   • Draw: 50-move rule, threefold repetition, insufficient material
//   • FEN import / export
//   • generateAllLegalMoves(color)
//   • AI: minimax + alpha-beta pruning, adjustable depth, material + positional eval
//   • Game state management (turn, history, captured pieces, game-over reason)
//   • UI layer wired into DuelZone's screen-switching & SoundManager
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────────────────

  var PIECE  = { PAWN:'p', ROOK:'r', KNIGHT:'n', BISHOP:'b', QUEEN:'q', KING:'k' };
  var COLOR  = { WHITE:'w', BLACK:'b' };

  var MATERIAL = { p:100, n:320, b:330, r:500, q:900, k:20000 };

  // Piece-square tables (from White's perspective; flipped for Black)
  // Values in centipawns, index = row*8+col, row0=rank1 (White back rank)
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

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 1: BOARD REPRESENTATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a square object.
   * @param {string|null} type  - Piece type ('p','r','n','b','q','k') or null
   * @param {string|null} color - 'w' or 'b' or null
   * @param {boolean}     moved - Has this piece moved from its start square?
   */
  function makeSquare(type, color, moved) {
    return { type: type || null, color: color || null, moved: !!moved };
  }

  /**
   * Creates a fresh 8×8 board array (index: board[row][col]).
   * Row 0 = rank 1 (White's back rank), Row 7 = rank 8 (Black's back rank).
   */
  function createEmptyBoard() {
    var board = [];
    for (var r = 0; r < 8; r++) {
      board[r] = [];
      for (var c = 0; c < 8; c++) {
        board[r][c] = makeSquare(null, null, false);
      }
    }
    return board;
  }

  /** Sets up the standard chess starting position on a board array. */
  function setupStartPosition(board) {
    var backRank = [PIECE.ROOK, PIECE.KNIGHT, PIECE.BISHOP, PIECE.QUEEN,
                    PIECE.KING, PIECE.BISHOP, PIECE.KNIGHT, PIECE.ROOK];

    // White back rank (row 0)
    for (var c = 0; c < 8; c++) {
      board[0][c] = makeSquare(backRank[c], COLOR.WHITE, false);
    }
    // White pawns (row 1)
    for (var c = 0; c < 8; c++) {
      board[1][c] = makeSquare(PIECE.PAWN, COLOR.WHITE, false);
    }
    // Black pawns (row 6)
    for (var c = 0; c < 8; c++) {
      board[6][c] = makeSquare(PIECE.PAWN, COLOR.BLACK, false);
    }
    // Black back rank (row 7)
    for (var c = 0; c < 8; c++) {
      board[7][c] = makeSquare(backRank[c], COLOR.BLACK, false);
    }
  }

  /**
   * Deep-copies a board (only the parts we need for move simulation).
   */
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

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 2: GAME STATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Master game state object.
   */
  function ChessState() {
    this.board          = createEmptyBoard();
    this.turn           = COLOR.WHITE;   // Whose turn it is
    this.moveHistory    = [];            // Array of move objects
    this.capturedPieces = { w: [], b: [] };  // Pieces captured by each color
    this.castlingRights = {
      wK: true, wQ: true,   // White kingside / queenside
      bK: true, bQ: true    // Black kingside / queenside
    };
    this.enPassantTarget = null;  // {row, col} or null
    this.halfMoveClock   = 0;     // Moves since last pawn move or capture
    this.fullMoveNumber  = 1;     // Increments after Black's move
    this.positionHistory = [];    // FEN strings (without move clocks) for 3-fold
    this.gameOver        = false;
    this.winner          = null;  // 'w', 'b', or 'draw'
    this.gameOverReason  = null;  // 'checkmate', 'stalemate', '50-move', 'repetition', 'insufficient'
    setupStartPosition(this.board);
    this.positionHistory.push(this._positionKey());
  }

  /** Returns a position key (FEN-like, excluding clocks) for repetition detection. */
  ChessState.prototype._positionKey = function () {
    var parts = [];
    for (var r = 7; r >= 0; r--) {
      var emptyRun = 0;
      var rankStr  = '';
      for (var c = 0; c < 8; c++) {
        var sq = this.board[r][c];
        if (!sq.type) {
          emptyRun++;
        } else {
          if (emptyRun) { rankStr += emptyRun; emptyRun = 0; }
          var ch = sq.type;
          rankStr += (sq.color === COLOR.WHITE) ? ch.toUpperCase() : ch;
        }
      }
      if (emptyRun) rankStr += emptyRun;
      parts.push(rankStr);
    }
    var cr = (this.castlingRights.wK ? 'K' : '') +
             (this.castlingRights.wQ ? 'Q' : '') +
             (this.castlingRights.bK ? 'k' : '') +
             (this.castlingRights.bQ ? 'q' : '') || '-';
    var ep = this.enPassantTarget
      ? String.fromCharCode(97 + this.enPassantTarget.col) + (this.enPassantTarget.row + 1)
      : '-';
    return parts.join('/') + ' ' + this.turn + ' ' + cr + ' ' + ep;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 3: MOVE LOGIC (pseudo-legal generation)
  // ─────────────────────────────────────────────────────────────────────────

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  /** Generates all pseudo-legal moves for a piece at (r, c). */
  function pseudoLegalMovesForPiece(state, r, c) {
    var sq     = state.board[r][c];
    var moves  = [];
    if (!sq.type) return moves;

    var type   = sq.type;
    var color  = sq.color;
    var opp    = (color === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;

    switch (type) {
      case PIECE.PAWN:   return _pawnMoves(state, r, c, color, opp);
      case PIECE.ROOK:   return _slidingMoves(state, r, c, color, [[1,0],[-1,0],[0,1],[0,-1]]);
      case PIECE.BISHOP: return _slidingMoves(state, r, c, color, [[1,1],[1,-1],[-1,1],[-1,-1]]);
      case PIECE.QUEEN:  return _slidingMoves(state, r, c, color, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
      case PIECE.KNIGHT: return _knightMoves(state, r, c, color);
      case PIECE.KING:   return _kingMoves(state, r, c, color, opp);
    }
    return moves;
  }

  function _pawnMoves(state, r, c, color, opp) {
    var moves = [];
    var dir   = (color === COLOR.WHITE) ? 1 : -1;  // forward direction
    var startRow = (color === COLOR.WHITE) ? 1 : 6;
    var promRow  = (color === COLOR.WHITE) ? 7 : 0;

    // Single push
    var nr = r + dir;
    if (inBounds(nr, c) && !state.board[nr][c].type) {
      _addPawnMove(moves, r, c, nr, c, (nr === promRow));
      // Double push from start row
      if (r === startRow) {
        var nr2 = r + 2 * dir;
        if (!state.board[nr2][c].type) {
          moves.push(_makeMove(r, c, nr2, c, null, false, true, false));
        }
      }
    }

    // Diagonal captures
    for (var dc = -1; dc <= 1; dc += 2) {
      var nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      var target = state.board[nr][nc];
      if (target.type && target.color === opp) {
        _addPawnMove(moves, r, c, nr, nc, (nr === promRow));
      }
      // En passant
      if (state.enPassantTarget &&
          state.enPassantTarget.row === nr &&
          state.enPassantTarget.col === nc) {
        moves.push(_makeMove(r, c, nr, nc, null, true, false, false));
      }
    }
    return moves;
  }

  function _addPawnMove(moves, fr, fc, tr, tc, isPromo) {
    if (isPromo) {
      ['q', 'r', 'b', 'n'].forEach(function (p) {
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
        if (!sq.type) {
          moves.push(_makeMove(r, c, nr, nc, null, false, false, false));
        } else {
          if (sq.color !== color) {
            moves.push(_makeMove(r, c, nr, nc, null, false, false, false));
          }
          break;
        }
        nr += dr; nc += dc;
      }
    }
    return moves;
  }

  function _knightMoves(state, r, c, color) {
    var moves  = [];
    var leaps  = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    for (var i = 0; i < leaps.length; i++) {
      var nr = r + leaps[i][0];
      var nc = c + leaps[i][1];
      if (inBounds(nr, nc)) {
        var sq = state.board[nr][nc];
        if (!sq.type || sq.color !== color) {
          moves.push(_makeMove(r, c, nr, nc, null, false, false, false));
        }
      }
    }
    return moves;
  }

  function _kingMoves(state, r, c, color, opp) {
    var moves = [];
    var dirs  = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var i = 0; i < dirs.length; i++) {
      var nr = r + dirs[i][0];
      var nc = c + dirs[i][1];
      if (inBounds(nr, nc)) {
        var sq = state.board[nr][nc];
        if (!sq.type || sq.color !== color) {
          moves.push(_makeMove(r, c, nr, nc, null, false, false, false));
        }
      }
    }
    // Castling pseudo-legal (legality checked in full legal move filter)
    var rights = state.castlingRights;
    var backRow = (color === COLOR.WHITE) ? 0 : 7;
    if (r === backRow && c === 4) {  // King on its starting square
      // Kingside
      var ksKey = (color === COLOR.WHITE) ? 'wK' : 'bK';
      if (rights[ksKey]) {
        if (!state.board[backRow][5].type && !state.board[backRow][6].type) {
          moves.push(_makeMove(r, c, backRow, 6, null, false, false, true));
        }
      }
      // Queenside
      var qsKey = (color === COLOR.WHITE) ? 'wQ' : 'bQ';
      if (rights[qsKey]) {
        if (!state.board[backRow][3].type &&
            !state.board[backRow][2].type &&
            !state.board[backRow][1].type) {
          moves.push(_makeMove(r, c, backRow, 2, null, false, false, true));
        }
      }
    }
    return moves;
  }

  /** Move factory. */
  function _makeMove(fr, fc, tr, tc, promo, isEP, isDblPush, isCastle) {
    return {
      fr: fr, fc: fc,
      tr: tr, tc: tc,
      promo:    promo    || null,  // promotion piece type if any
      isEP:     !!isEP,            // en passant capture
      isDblPush:!!isDblPush,       // double pawn push
      isCastle: !!isCastle         // castling
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 4: MOVE EXECUTION (on a board + state, reversible via clone)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Applies a move to a *cloned* board and partial state fields.
   * Returns a result object with the modified board and updated state fields.
   * Does NOT modify the original state.
   *
   * Used for: legality check (does move leave own king in check?)
   *           and for the actual game commit.
   */
  function applyMoveToBoard(board, move, color, castlingRights) {
    var b    = cloneBoard(board);
    var opp  = (color === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;
    var newEP = null;
    var newCR = { wK: castlingRights.wK, wQ: castlingRights.wQ,
                  bK: castlingRights.bK, bQ: castlingRights.bQ };
    var captured = null;

    var piece = b[move.fr][move.fc];

    if (move.isCastle) {
      // Move king
      b[move.tr][move.tc]   = { type: piece.type, color: piece.color, moved: true };
      b[move.fr][move.fc]   = makeSquare(null, null, false);
      // Move rook
      var backRow = move.fr;
      if (move.tc === 6) { // Kingside
        b[backRow][5] = { type: PIECE.ROOK, color: color, moved: true };
        b[backRow][7] = makeSquare(null, null, false);
      } else {             // Queenside
        b[backRow][3] = { type: PIECE.ROOK, color: color, moved: true };
        b[backRow][0] = makeSquare(null, null, false);
      }
    } else if (move.isEP) {
      // En passant: capture pawn on same rank as moving pawn's from-row
      b[move.tr][move.tc]   = { type: piece.type, color: piece.color, moved: true };
      b[move.fr][move.fc]   = makeSquare(null, null, false);
      var capturedRow       = move.fr; // The captured pawn is on the same row as moving pawn started
      captured = { type: b[capturedRow][move.tc].type, color: b[capturedRow][move.tc].color };
      b[capturedRow][move.tc] = makeSquare(null, null, false);
    } else {
      // Normal move / capture / promotion
      var dest = b[move.tr][move.tc];
      if (dest.type) {
        captured = { type: dest.type, color: dest.color };
      }
      var newType = move.promo ? move.promo : piece.type;
      b[move.tr][move.tc] = { type: newType, color: piece.color, moved: true };
      b[move.fr][move.fc] = makeSquare(null, null, false);
    }

    // Update en passant target
    if (move.isDblPush) {
      var epRow = (color === COLOR.WHITE) ? move.fr + 1 : move.fr - 1;
      newEP = { row: epRow, col: move.fc };
    }

    // Update castling rights
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
    // If a rook on its home square is captured, revoke that castling right
    if (captured && captured.type === PIECE.ROOK) {
      if (move.tr === 0 && move.tc === 7) newCR.wK = false;
      if (move.tr === 0 && move.tc === 0) newCR.wQ = false;
      if (move.tr === 7 && move.tc === 7) newCR.bK = false;
      if (move.tr === 7 && move.tc === 0) newCR.bQ = false;
    }

    return {
      board:           b,
      enPassantTarget: newEP,
      castlingRights:  newCR,
      captured:        captured
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 5: CHECK DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns true if the given color's king is under attack on the board. */
  function isInCheck(board, color) {
    // Find king position
    var kr = -1, kc = -1;
    outer:
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = board[r][c];
        if (sq.type === PIECE.KING && sq.color === color) {
          kr = r; kc = c;
          break outer;
        }
      }
    }
    if (kr === -1) return false;  // No king found (shouldn't happen)
    return isSquareAttackedBy(board, kr, kc, (color === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE);
  }

  /** Returns true if (r,c) is attacked by any piece of the given `byColor`. */
  function isSquareAttackedBy(board, r, c, byColor) {
    // Check knight attacks
    var knightLeaps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    for (var i = 0; i < knightLeaps.length; i++) {
      var nr = r + knightLeaps[i][0];
      var nc = c + knightLeaps[i][1];
      if (inBounds(nr, nc)) {
        var sq = board[nr][nc];
        if (sq.type === PIECE.KNIGHT && sq.color === byColor) return true;
      }
    }

    // Check sliding (rook/queen) attacks
    var straightDirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (var i = 0; i < straightDirs.length; i++) {
      var dr = straightDirs[i][0], dc = straightDirs[i][1];
      var nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        var sq = board[nr][nc];
        if (sq.type) {
          if (sq.color === byColor && (sq.type === PIECE.ROOK || sq.type === PIECE.QUEEN)) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }

    // Check diagonal (bishop/queen) attacks
    var diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var i = 0; i < diagDirs.length; i++) {
      var dr = diagDirs[i][0], dc = diagDirs[i][1];
      var nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        var sq = board[nr][nc];
        if (sq.type) {
          if (sq.color === byColor && (sq.type === PIECE.BISHOP || sq.type === PIECE.QUEEN)) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }

    // Check pawn attacks
    var pawnDir = (byColor === COLOR.WHITE) ? -1 : 1; // White pawns attack upward (toward higher rows)
    var pawnRow = r + pawnDir;
    if (inBounds(pawnRow, c - 1)) {
      var sq = board[pawnRow][c - 1];
      if (sq.type === PIECE.PAWN && sq.color === byColor) return true;
    }
    if (inBounds(pawnRow, c + 1)) {
      var sq = board[pawnRow][c + 1];
      if (sq.type === PIECE.PAWN && sq.color === byColor) return true;
    }

    // Check king attacks (to avoid king walking next to king)
    var kingDirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var i = 0; i < kingDirs.length; i++) {
      var nr = r + kingDirs[i][0];
      var nc = c + kingDirs[i][1];
      if (inBounds(nr, nc)) {
        var sq = board[nr][nc];
        if (sq.type === PIECE.KING && sq.color === byColor) return true;
      }
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 6: FULL LEGAL MOVE GENERATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generates all legal moves for `color`.
   * Filters out moves that leave own king in check.
   * Additionally validates castling pass-through squares.
   */
  function generateAllLegalMoves(state, color) {
    var legal = [];
    var opp   = (color === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;

    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (state.board[r][c].color !== color) continue;
        var pseudos = pseudoLegalMovesForPiece(state, r, c);
        for (var i = 0; i < pseudos.length; i++) {
          var mv = pseudos[i];

          if (mv.isCastle) {
            // Castling extra validation:
            // King must not be in check currently, must not pass through check
            var backRow = r;
            var kc = c;  // always 4
            if (isInCheck(state.board, color)) continue;  // in check → can't castle

            // Check pass-through and destination squares
            var passCol = (mv.tc === 6) ? [5, 6] : [3, 2];
            var passOk  = true;
            for (var p = 0; p < passCol.length; p++) {
              if (isSquareAttackedBy(state.board, backRow, passCol[p], opp)) {
                passOk = false;
                break;
              }
            }
            if (!passOk) continue;

            // Simulate castling and check king destination
            var result = applyMoveToBoard(state.board, mv, color, state.castlingRights);
            if (isInCheck(result.board, color)) continue;
            legal.push(mv);
          } else {
            // Normal / EP move: simulate and check
            var result = applyMoveToBoard(state.board, mv, color, state.castlingRights);
            if (!isInCheck(result.board, color)) {
              legal.push(mv);
            }
          }
        }
      }
    }
    return legal;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 7: DRAW CONDITIONS
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns true if the position has insufficient material to force checkmate. */
  function isInsufficientMaterial(board) {
    var pieces = { w: [], b: [] };
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = board[r][c];
        if (sq.type && sq.type !== PIECE.KING) {
          pieces[sq.color].push({ type: sq.type, col: (r + c) % 2 });
        }
      }
    }
    var wl = pieces.w.length, bl = pieces.b.length;

    // King vs King
    if (wl === 0 && bl === 0) return true;

    // King + Bishop/Knight vs King
    if (wl === 0 && bl === 1 && (pieces.b[0].type === PIECE.BISHOP || pieces.b[0].type === PIECE.KNIGHT)) return true;
    if (bl === 0 && wl === 1 && (pieces.w[0].type === PIECE.BISHOP || pieces.w[0].type === PIECE.KNIGHT)) return true;

    // King + Bishop vs King + Bishop (same color squares)
    if (wl === 1 && bl === 1 &&
        pieces.w[0].type === PIECE.BISHOP &&
        pieces.b[0].type === PIECE.BISHOP &&
        pieces.w[0].col  === pieces.b[0].col) return true;

    return false;
  }

  /** Returns true if threefold repetition has occurred. */
  function isThreefoldRepetition(positionHistory) {
    var counts = {};
    for (var i = 0; i < positionHistory.length; i++) {
      var key = positionHistory[i];
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] >= 3) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 8: COMMITTING A MOVE TO THE REAL GAME STATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Attempts to make a move on the real game state.
   * Validates legality, commits it, updates all state.
   * Returns: { ok: true, move: ..., san: ..., ... } or { ok: false, error: '...' }
   */
  ChessState.prototype.makeMove = function (fromRow, fromCol, toRow, toCol, promotionPiece) {
    if (this.gameOver) return { ok: false, error: 'Game is over' };

    var sq = this.board[fromRow][fromCol];
    if (!sq.type)              return { ok: false, error: 'No piece at source' };
    if (sq.color !== this.turn) return { ok: false, error: 'Not your turn' };

    // Default promotion to queen
    if (!promotionPiece) promotionPiece = PIECE.QUEEN;

    // Find matching legal move
    var legal = generateAllLegalMoves(this, this.turn);
    var chosen = null;
    for (var i = 0; i < legal.length; i++) {
      var mv = legal[i];
      if (mv.fr === fromRow && mv.fc === fromCol &&
          mv.tr === toRow   && mv.tc === toCol) {
        // For promotion moves, match the promotion piece
        if (mv.promo) {
          if (mv.promo === promotionPiece) { chosen = mv; break; }
        } else {
          chosen = mv; break;
        }
      }
    }

    if (!chosen) return { ok: false, error: 'Illegal move' };

    // Apply to board
    var result = applyMoveToBoard(this.board, chosen, this.turn, this.castlingRights);

    // Build move record before updating state
    var captured = result.captured;
    var san = buildSAN(this, chosen, captured, legal);

    // Commit state
    this.board           = result.board;
    this.enPassantTarget = result.enPassantTarget;
    this.castlingRights  = result.castlingRights;

    // Update half-move clock (reset on capture or pawn move)
    if (captured || sq.type === PIECE.PAWN) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // Update captured pieces list
    if (captured) {
      this.capturedPieces[this.turn].push(captured.type);
    }

    // Advance full-move counter
    if (this.turn === COLOR.BLACK) this.fullMoveNumber++;

    // Switch turn
    var prevTurn = this.turn;
    this.turn = (this.turn === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;

    // Record position for repetition detection
    var posKey = this._positionKey();
    this.positionHistory.push(posKey);

    // Enrich SAN with check/mate/stalemate suffix
    var oppMoves = generateAllLegalMoves(this, this.turn);
    var inCheck  = isInCheck(this.board, this.turn);
    var isCheckmate  = inCheck && oppMoves.length === 0;
    var isStalemate  = !inCheck && oppMoves.length === 0;

    if (isCheckmate) san += '#';
    else if (inCheck) san += '+';

    // Record move
    var moveRecord = {
      fr: chosen.fr, fc: chosen.fc,
      tr: chosen.tr, tc: chosen.tc,
      promo:    chosen.promo,
      isCastle: chosen.isCastle,
      isEP:     chosen.isEP,
      isDblPush:chosen.isDblPush,
      piece:    sq.type,
      color:    prevTurn,
      captured: captured,
      san:      san,
      fen:      this.toFEN()
    };
    this.moveHistory.push(moveRecord);

    // Check game-over conditions
    if (isCheckmate) {
      this.gameOver  = true;
      this.winner    = prevTurn;
      this.gameOverReason = 'checkmate';
    } else if (isStalemate) {
      this.gameOver  = true;
      this.winner    = 'draw';
      this.gameOverReason = 'stalemate';
    } else if (this.halfMoveClock >= 100) {
      this.gameOver  = true;
      this.winner    = 'draw';
      this.gameOverReason = '50-move';
    } else if (isThreefoldRepetition(this.positionHistory)) {
      this.gameOver  = true;
      this.winner    = 'draw';
      this.gameOverReason = 'repetition';
    } else if (isInsufficientMaterial(this.board)) {
      this.gameOver  = true;
      this.winner    = 'draw';
      this.gameOverReason = 'insufficient';
    }

    return {
      ok:       true,
      move:     moveRecord,
      san:      san,
      inCheck:  inCheck && !isCheckmate,
      isCheckmate: isCheckmate,
      isStalemate: isStalemate,
      gameOver: this.gameOver,
      winner:   this.winner,
      reason:   this.gameOverReason
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 9: SAN (Standard Algebraic Notation) BUILDER
  // ─────────────────────────────────────────────────────────────────────────

  function colToFile(c) { return String.fromCharCode(97 + c); }
  function rowToRank(r) { return '' + (r + 1); }
  function squareName(r, c) { return colToFile(c) + rowToRank(r); }

  function buildSAN(state, move, captured, allLegalMoves) {
    if (move.isCastle) {
      return (move.tc === 6) ? 'O-O' : 'O-O-O';
    }

    var piece = state.board[move.fr][move.fc];
    var san   = '';
    var pt    = piece.type;

    if (pt !== PIECE.PAWN) {
      san += pt.toUpperCase();
      // Disambiguation
      var ambig = allLegalMoves.filter(function (m) {
        return m.tr === move.tr && m.tc === move.tc &&
               m.fr !== move.fr && m.fc !== move.fc &&
               state.board[m.fr][m.fc].type === pt &&
               state.board[m.fr][m.fc].color === piece.color;
      });
      // Also include same-col or same-row movers
      var sameType = allLegalMoves.filter(function (m) {
        return m.tr === move.tr && m.tc === move.tc &&
               !(m.fr === move.fr && m.fc === move.fc) &&
               state.board[m.fr][m.fc].type === pt &&
               state.board[m.fr][m.fc].color === piece.color;
      });
      if (sameType.length > 0) {
        var sameFile = sameType.filter(function (m) { return m.fc === move.fc; });
        var sameRank = sameType.filter(function (m) { return m.fr === move.fr; });
        if (sameFile.length > 0 && sameRank.length > 0) {
          san += colToFile(move.fc) + rowToRank(move.fr);
        } else if (sameFile.length > 0) {
          san += rowToRank(move.fr);
        } else {
          san += colToFile(move.fc);
        }
      }
    } else if (captured || move.isEP) {
      san += colToFile(move.fc);
    }

    if (captured || move.isEP) san += 'x';
    san += squareName(move.tr, move.tc);

    if (move.isEP) san += ' e.p.';
    if (move.promo) san += '=' + move.promo.toUpperCase();

    return san;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 10: FEN IMPORT / EXPORT
  // ─────────────────────────────────────────────────────────────────────────

  ChessState.prototype.toFEN = function () {
    var rows = [];
    for (var r = 7; r >= 0; r--) {
      var emptyRun = 0, rowStr = '';
      for (var c = 0; c < 8; c++) {
        var sq = this.board[r][c];
        if (!sq.type) {
          emptyRun++;
        } else {
          if (emptyRun) { rowStr += emptyRun; emptyRun = 0; }
          var ch = sq.type;
          rowStr += (sq.color === COLOR.WHITE) ? ch.toUpperCase() : ch;
        }
      }
      if (emptyRun) rowStr += emptyRun;
      rows.push(rowStr);
    }

    var cr = (this.castlingRights.wK ? 'K' : '') +
             (this.castlingRights.wQ ? 'Q' : '') +
             (this.castlingRights.bK ? 'k' : '') +
             (this.castlingRights.bQ ? 'q' : '') || '-';

    var ep = this.enPassantTarget
      ? squareName(this.enPassantTarget.row, this.enPassantTarget.col)
      : '-';

    return rows.join('/') + ' ' +
           this.turn + ' ' +
           cr + ' ' +
           ep + ' ' +
           this.halfMoveClock + ' ' +
           this.fullMoveNumber;
  };

  /** Loads a FEN string into this state. */
  ChessState.prototype.loadFEN = function (fen) {
    var parts = fen.trim().split(/\s+/);
    var ranks  = parts[0].split('/');

    this.board = createEmptyBoard();

    for (var r = 0; r < 8; r++) {
      var rank = ranks[7 - r];  // FEN rank 8 = row 7
      var c    = 0;
      for (var i = 0; i < rank.length; i++) {
        var ch = rank[i];
        var num = parseInt(ch, 10);
        if (!isNaN(num)) {
          c += num;
        } else {
          var color = (ch === ch.toUpperCase()) ? COLOR.WHITE : COLOR.BLACK;
          var type  = ch.toLowerCase();
          this.board[r][c] = makeSquare(type, color, true); // assume moved for FEN
          c++;
        }
      }
    }

    this.turn = (parts[1] === 'b') ? COLOR.BLACK : COLOR.WHITE;

    var crStr = parts[2] || '-';
    this.castlingRights = {
      wK: crStr.indexOf('K') !== -1,
      wQ: crStr.indexOf('Q') !== -1,
      bK: crStr.indexOf('k') !== -1,
      bQ: crStr.indexOf('q') !== -1
    };

    // Restore moved=false for rooks/kings that still have castling rights
    if (this.castlingRights.wK || this.castlingRights.wQ) {
      if (this.board[0][4].type === PIECE.KING) this.board[0][4].moved = false;
      if (this.castlingRights.wK && this.board[0][7].type === PIECE.ROOK) this.board[0][7].moved = false;
      if (this.castlingRights.wQ && this.board[0][0].type === PIECE.ROOK) this.board[0][0].moved = false;
    }
    if (this.castlingRights.bK || this.castlingRights.bQ) {
      if (this.board[7][4].type === PIECE.KING) this.board[7][4].moved = false;
      if (this.castlingRights.bK && this.board[7][7].type === PIECE.ROOK) this.board[7][7].moved = false;
      if (this.castlingRights.bQ && this.board[7][0].type === PIECE.ROOK) this.board[7][0].moved = false;
    }

    if (parts[3] && parts[3] !== '-') {
      var epFile = parts[3].charCodeAt(0) - 97;
      var epRank = parseInt(parts[3][1], 10) - 1;
      this.enPassantTarget = { row: epRank, col: epFile };
    } else {
      this.enPassantTarget = null;
    }

    this.halfMoveClock  = parseInt(parts[4], 10) || 0;
    this.fullMoveNumber = parseInt(parts[5], 10) || 1;

    this.moveHistory    = [];
    this.positionHistory = [this._positionKey()];
    this.gameOver       = false;
    this.winner         = null;
    this.gameOverReason = null;
    this.capturedPieces = { w: [], b: [] };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 11: AI ENGINE (Minimax + Alpha-Beta Pruning)
  // ─────────────────────────────────────────────────────────────────────────

  /** Static evaluation of board position from White's perspective. */
  function evaluate(board) {
    var score = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = board[r][c];
        if (!sq.type) continue;
        var mat = MATERIAL[sq.type];

        // PST index: white uses row as-is (row0=rank1), black mirrors
        var pstRow = (sq.color === COLOR.WHITE) ? r : (7 - r);
        var pst    = (PST[sq.type][pstRow * 8 + c]) || 0;
        var val    = mat + pst;

        score += (sq.color === COLOR.WHITE) ? val : -val;
      }
    }
    return score;
  }

  /**
   * Minimax with alpha-beta pruning.
   * Returns { score, move }.
   * isMaximizing: true = White tries to maximize, false = Black tries to minimize.
   */
  function minimax(state, depth, alpha, beta, isMaximizing) {
    // Terminal / depth-0 check
    var color    = isMaximizing ? COLOR.WHITE : COLOR.BLACK;
    var oppColor = isMaximizing ? COLOR.BLACK : COLOR.WHITE;
    var moves    = generateAllLegalMoves(state, color);

    if (moves.length === 0) {
      if (isInCheck(state.board, color)) {
        // Checkmate — worst outcome for moving side (prefer faster mates with depth bonus)
        return { score: isMaximizing ? -100000 - depth : 100000 + depth, move: null };
      }
      return { score: 0, move: null }; // Stalemate
    }

    if (depth === 0) {
      return { score: evaluate(state.board), move: null };
    }

    // Move ordering: captures first (heuristic for better pruning)
    moves.sort(function (a, b) {
      var aCapture = state.board[a.tr][a.tc].type ? MATERIAL[state.board[a.tr][a.tc].type] : 0;
      var bCapture = state.board[b.tr][b.tc].type ? MATERIAL[state.board[b.tr][b.tc].type] : 0;
      return bCapture - aCapture;
    });

    var bestMove  = moves[0];
    var bestScore = isMaximizing ? -Infinity : Infinity;

    for (var i = 0; i < moves.length; i++) {
      var mv     = moves[i];
      var result = applyMoveToBoard(state.board, mv, color, state.castlingRights);

      // Build a lightweight state for the recursive call
      var childState = {
        board:           result.board,
        turn:            oppColor,
        castlingRights:  result.castlingRights,
        enPassantTarget: result.enPassantTarget,
        halfMoveClock:   state.halfMoveClock,
        positionHistory: state.positionHistory,
        // Expose needed methods via prototype chain
        _positionKey:    ChessState.prototype._positionKey
      };

      var child = minimax(childState, depth - 1, alpha, beta, !isMaximizing);

      if (isMaximizing) {
        if (child.score > bestScore) {
          bestScore = child.score;
          bestMove  = mv;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (child.score < bestScore) {
          bestScore = child.score;
          bestMove  = mv;
        }
        beta = Math.min(beta, bestScore);
      }

      if (beta <= alpha) break;  // Alpha-beta cutoff
    }

    return { score: bestScore, move: bestMove };
  }

  /**
   * Public AI entry point.
   * @param {ChessState} state     - Current game state
   * @param {number}     depth     - Search depth (3 = medium, 4 = hard, 5 = very hard)
   * @returns {object|null}        - Best move object or null if no moves
   */
  function getBestMove(state, depth) {
    var isMax  = (state.turn === COLOR.WHITE);
    var result = minimax(state, depth || 3, -Infinity, Infinity, isMax);
    return result.move || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 12: HELPER UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns all legal moves for a piece at (r,c) in the current state. */
  ChessState.prototype.legalMovesFrom = function (r, c) {
    if (this.board[r][c].color !== this.turn) return [];
    var all = generateAllLegalMoves(this, this.turn);
    return all.filter(function (mv) { return mv.fr === r && mv.fc === c; });
  };

  /** Undo the last move. Returns true if successful. */
  ChessState.prototype.undoMove = function () {
    if (this.moveHistory.length === 0) return false;
    // We stored FEN in each move record — reload from previous FEN
    var prevFenIdx = this.moveHistory.length - 1;
    var prevFen = prevFenIdx > 0 ? this.moveHistory[prevFenIdx - 1].fen : null;
    this.moveHistory.pop();
    this.positionHistory.pop();
    this.gameOver = false;
    this.winner = null;
    this.gameOverReason = null;
    if (prevFen) {
      this.loadFEN(prevFen);
      // Restore move history pointer (loadFEN resets it)
      var savedHistory = this.moveHistory.slice();
      this.moveHistory = savedHistory;
    } else {
      // Undo to start position
      this.board = createEmptyBoard();
      setupStartPosition(this.board);
      this.turn = COLOR.WHITE;
      this.castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
      this.enPassantTarget = null;
      this.halfMoveClock = 0;
      this.fullMoveNumber = 1;
      this.capturedPieces = { w:[], b:[] };
      this.positionHistory = [this._positionKey()];
      this.moveHistory = [];
    }
    return true;
  };

  /** Returns true if the current player is in check. */
  ChessState.prototype.isInCheck = function () {
    return isInCheck(this.board, this.turn);
  };

  /** Returns true if the game is in checkmate. */
  ChessState.prototype.isCheckmate = function () {
    return isInCheck(this.board, this.turn) &&
           generateAllLegalMoves(this, this.turn).length === 0;
  };

  /** Returns true if stalemate. */
  ChessState.prototype.isStalemate = function () {
    return !isInCheck(this.board, this.turn) &&
           generateAllLegalMoves(this, this.turn).length === 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 13: UI LAYER — Enhanced Chess Screen (DuelZone integration)
  // Features: board flip, Web Audio sounds, particles, glow effects, 6 levels
  // ─────────────────────────────────────────────────────────────────────────

  var chess = {
    state:           null,
    mode:            'pvp',
    botColor:        COLOR.BLACK,
    playerColor:     COLOR.WHITE,
    botDepth:        3,
    selectedSq:      null,
    legalTargets:    [],
    animating:       false,
    botThinking:     false,
    _botTimeout:     null,
    promotionPending: null,
    flipped:         false,
    hintMove:        null,   // { fr,fc,tr,tc } highlighted when player asks for hint
    hintTimeout:     null,
  };

  // ── DOM references ───────────────────────────────────────────────────────

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

  // Piece notation symbols
  var PIECE_UNICODE = {
    w: { k:'♔', q:'♕', r:'♖', b:'♗', n:'♘', p:'♙' },
    b: { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' }
  };

  // ── Chess Audio Engine (Web Audio API — no external files) ───────────────

  var ChessAudio = (function () {
    var ctx = null;

    function getCtx() {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { return null; }
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function playTone(freq, type, duration, volume, fadeOut) {
      var c = getCtx(); if (!c) return;
      var osc  = c.createOscillator();
      var gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type      = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(volume || 0.18, c.currentTime);
      if (fadeOut !== false) gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration + 0.05);
    }

    function playNoise(duration, volume) {
      var c = getCtx(); if (!c) return;
      var bufSize = c.sampleRate * duration;
      var buf     = c.createBuffer(1, bufSize, c.sampleRate);
      var data    = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      var src    = c.createBufferSource();
      var gain   = c.createGain();
      var filter = c.createBiquadFilter();
      src.buffer = buf;
      filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
      src.connect(filter); filter.connect(gain); gain.connect(c.destination);
      gain.gain.setValueAtTime(volume || 0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      src.start(); src.stop(c.currentTime + duration + 0.05);
    }

    return {
      move: function () {
        // Soft wooden click
        playNoise(0.08, 0.18);
        playTone(520, 'sine', 0.07, 0.08);
      },
      capture: function () {
        // Harder thunk + impact
        playNoise(0.15, 0.32);
        playTone(280, 'sawtooth', 0.12, 0.12);
        playTone(140, 'sine', 0.18, 0.10);
      },
      select: function () {
        // Light click
        playTone(880, 'sine', 0.06, 0.06);
      },
      check: function () {
        // Alert — two rising tones
        var c = getCtx(); if (!c) return;
        playTone(660, 'square', 0.12, 0.10);
        setTimeout(function () { playTone(880, 'square', 0.15, 0.12); }, 130);
      },
      castle: function () {
        playNoise(0.10, 0.20);
        playTone(400, 'sine', 0.08, 0.09);
        setTimeout(function () { playTone(600, 'sine', 0.08, 0.07); }, 80);
      },
      gameStart: function () {
        // Chess clock wind-up
        playTone(440, 'sine', 0.12, 0.10);
        setTimeout(function () { playTone(550, 'sine', 0.12, 0.10); }, 130);
        setTimeout(function () { playTone(660, 'sine', 0.18, 0.14); }, 260);
      },
      win: function () {
        [0, 150, 300, 500].forEach(function (t, i) {
          setTimeout(function () {
            playTone([523, 659, 784, 1047][i], 'sine', 0.28, 0.14);
          }, t);
        });
      },
      lose: function () {
        playTone(392, 'sawtooth', 0.20, 0.10);
        setTimeout(function () { playTone(349, 'sawtooth', 0.20, 0.10); }, 200);
        setTimeout(function () { playTone(294, 'sawtooth', 0.40, 0.12); }, 400);
      },
      draw: function () {
        playTone(440, 'sine', 0.15, 0.09);
        setTimeout(function () { playTone(440, 'sine', 0.15, 0.09); }, 200);
      },
      promote: function () {
        playTone(784, 'sine', 0.12, 0.12);
        setTimeout(function () { playTone(1047, 'sine', 0.20, 0.16); }, 120);
      }
    };
  })();

  // ── Particle Effects ─────────────────────────────────────────────────────

  function chessSpawnParticles(cellEl, color) {
    if (!cellEl) return;
    var rect = cellEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top  + rect.height / 2;
    var colors = color === COLOR.WHITE
      ? ['#fff', '#f5c518', '#fffde0', '#ffd700']
      : ['#1a0a3a', '#7c3aed', '#4f46e5', '#a78bfa'];

    for (var i = 0; i < 18; i++) {
      (function (i) {
        var p = document.createElement('div');
        p.className = 'chess-particle';
        var angle  = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.7;
        var speed  = 40 + Math.random() * 60;
        var size   = 4 + Math.random() * 6;
        var c      = colors[Math.floor(Math.random() * colors.length)];
        p.style.cssText = [
          'position:fixed',
          'left:' + cx + 'px',
          'top:'  + cy + 'px',
          'width:' + size + 'px',
          'height:' + size + 'px',
          'background:' + c,
          'border-radius:50%',
          'pointer-events:none',
          'z-index:9999',
          'transform:translate(-50%,-50%)',
          'opacity:1',
          'transition:all 0.55s cubic-bezier(.17,.84,.44,1)'
        ].join(';');
        document.body.appendChild(p);
        setTimeout(function () {
          p.style.left    = (cx + Math.cos(angle) * speed) + 'px';
          p.style.top     = (cy + Math.sin(angle) * speed) + 'px';
          p.style.opacity = '0';
          p.style.transform = 'translate(-50%,-50%) scale(0.2)';
        }, 20);
        setTimeout(function () { p.remove(); }, 620);
      })(i);
    }
  }

  function chessBoardFlash(color) {
    if (!chessBoardEl) return;
    var flash = document.createElement('div');
    flash.className = 'chess-board-flash';
    flash.style.cssText = [
      'position:absolute','inset:0','pointer-events:none','z-index:50','border-radius:4px',
      'background:' + (color === 'check' ? 'rgba(255,50,50,0.18)' : 'rgba(245,197,24,0.12)'),
      'opacity:1','transition:opacity 0.5s'
    ].join(';');
    var wrap = chessBoardEl.parentElement;
    if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(flash); }
    setTimeout(function () { flash.style.opacity = '0'; }, 50);
    setTimeout(function () { flash.remove(); }, 600);
  }

  // ── Board Rendering ──────────────────────────────────────────────────────

  function chessRenderBoard() {
    if (!chessBoardEl) return;
    chessBoardEl.innerHTML = '';
    var state = chess.state;

    // Board orientation: flipped if player is Black
    var rowOrder = chess.flipped
      ? [0,1,2,3,4,5,6,7]
      : [7,6,5,4,3,2,1,0];
    var colOrder = chess.flipped
      ? [7,6,5,4,3,2,1,0]
      : [0,1,2,3,4,5,6,7];

    for (var ri = 0; ri < 8; ri++) {
      for (var ci = 0; ci < 8; ci++) {
        var r = rowOrder[ri];
        var c = colOrder[ci];

        var cell = document.createElement('div');
        cell.className = 'chess-cell ' + ((r + c) % 2 === 0 ? 'chess-dark' : 'chess-light');
        cell.dataset.r = r;
        cell.dataset.c = c;

        // Rank / file labels (left col and bottom row relative to orientation)
        if (ci === 0) {
          var rankLabel = document.createElement('span');
          rankLabel.className = 'chess-rank-label';
          rankLabel.textContent = (r + 1);
          cell.appendChild(rankLabel);
        }
        if (ri === 7) {
          var fileLabel = document.createElement('span');
          fileLabel.className = 'chess-file-label';
          fileLabel.textContent = colToFile(c);
          cell.appendChild(fileLabel);
        }

        var sq = state.board[r][c];

        // Selected highlight
        if (chess.selectedSq && chess.selectedSq.r === r && chess.selectedSq.c === c) {
          cell.classList.add('chess-selected');
        }

        // Last move highlight
        if (state.moveHistory.length > 0) {
          var last = state.moveHistory[state.moveHistory.length - 1];
          if ((last.fr === r && last.fc === c) || (last.tr === r && last.tc === c)) {
            cell.classList.add('chess-last-move');
          }
        }

        // Legal move targets
        var isLegalTarget = false;
        for (var i = 0; i < chess.legalTargets.length; i++) {
          if (chess.legalTargets[i].tr === r && chess.legalTargets[i].tc === c) {
            isLegalTarget = true;
            break;
          }
        }
        if (isLegalTarget) {
          cell.classList.add(sq.type ? 'chess-capture-target' : 'chess-move-target');
        }

        // Check highlight on king in check — strong red flash
        if (sq.type === PIECE.KING && isInCheck(state.board, sq.color) && !state.gameOver) {
          cell.classList.add('chess-in-check');
          // Add pulsing ring element
          var checkRing = document.createElement('div');
          checkRing.className = 'chess-check-ring';
          cell.appendChild(checkRing);
        }

        // Hint highlight
        if (chess.hintMove) {
          if ((chess.hintMove.fr === r && chess.hintMove.fc === c) ||
              (chess.hintMove.tr === r && chess.hintMove.tc === c)) {
            cell.classList.add('chess-hint-highlight');
          }
        }

        // Piece element
        if (sq.type) {
          var pieceEl = document.createElement('span');
          pieceEl.className = 'chess-piece ' + (sq.color === COLOR.WHITE ? 'chess-piece-w' : 'chess-piece-b');
          pieceEl.textContent = PIECE_UNICODE[sq.color][sq.type];
          cell.appendChild(pieceEl);
        }

        cell.addEventListener('click', chessCellClick);
        chessBoardEl.appendChild(cell);
      }
    }

    chessUpdateCaptured();
    if (chessFenEl) chessFenEl.textContent = state.toFEN();
    chessUpdateMoveList();
  }

  function chessUpdateCaptured() {
    if (!chess.state) return;
    var wIcons = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
    var bIcons = { k:'♔', q:'♕', r:'♖', b:'♗', n:'♘', p:'♙' };

    // capturedPieces.w = pieces captured by White (Black pieces removed)
    if (chessCapturedW) {
      chessCapturedW.innerHTML = chess.state.capturedPieces.w
        .map(function(t){ return '<span class="chess-cap-piece chess-cap-b">' + (wIcons[t]||t) + '</span>'; })
        .join('');
    }
    if (chessCapturedB) {
      chessCapturedB.innerHTML = chess.state.capturedPieces.b
        .map(function(t){ return '<span class="chess-cap-piece chess-cap-w">' + (bIcons[t]||t) + '</span>'; })
        .join('');
    }
  }

  function chessUpdateMoveList() {
    if (!chessMoveListEl || !chess.state) return;
    var history = chess.state.moveHistory;
    var html = '';
    for (var i = 0; i < history.length; i += 2) {
      var moveNum = Math.floor(i / 2) + 1;
      var w = history[i]     ? history[i].san     : '';
      var b = history[i + 1] ? history[i + 1].san : '';
      var isLatest = (i + 1 >= history.length - 1);
      html += '<span class="chess-move-num">' + moveNum + '.</span>' +
              '<span class="chess-move-san chess-san-w' + (isLatest && history[i] ? ' chess-san-latest' : '') + '">' + w + '</span>' +
              (b ? '<span class="chess-move-san chess-san-b' + (isLatest && history[i+1] ? ' chess-san-latest' : '') + '">' + b + '</span>' : '') + ' ';
    }
    chessMoveListEl.innerHTML = html;
    chessMoveListEl.scrollTop = chessMoveListEl.scrollHeight;
  }

  function chessUpdateStatus() {
    if (!chessTurnEl || !chess.state) return;
    var state = chess.state;
    if (state.gameOver) {
      chessTurnEl.textContent = 'Game Over';
      chessTurnEl.classList.remove('chess-turn-check');
      return;
    }
    var turnName = state.turn === COLOR.WHITE ? 'White' : 'Black';
    var inCheck  = state.isInCheck();
    if (chess.mode === 'bot' && state.turn === chess.botColor) {
      chessTurnEl.textContent = '⚙ Bot thinking…';
    } else {
      chessTurnEl.textContent = (state.turn === COLOR.WHITE ? '⬜ ' : '⬛ ') +
                                 turnName + "'s turn" + (inCheck ? ' · CHECK!' : '');
    }
    if (inCheck) chessTurnEl.classList.add('chess-turn-check');
    else         chessTurnEl.classList.remove('chess-turn-check');
  }

  // ── Cell Click Handler ───────────────────────────────────────────────────

  function chessCellClick(evt) {
    var cell = evt.currentTarget;
    var r    = parseInt(cell.dataset.r, 10);
    var c    = parseInt(cell.dataset.c, 10);
    var state = chess.state;

    if (!state || state.gameOver || chess.animating || chess.botThinking) return;
    if (chess.mode === 'bot' && state.turn === chess.botColor) return;
    if (chess.promotionPending) return;

    var sq = state.board[r][c];

    if (chess.selectedSq) {
      var found = null;
      for (var i = 0; i < chess.legalTargets.length; i++) {
        if (chess.legalTargets[i].tr === r && chess.legalTargets[i].tc === c) {
          found = chess.legalTargets[i];
          break;
        }
      }

      if (found) {
        if (found.promo) {
          chess.promotionPending = { fr: found.fr, fc: found.fc, tr: found.tr, tc: found.tc };
          chessShowPromoModal(state.turn);
          chess.selectedSq   = null;
          chess.legalTargets = [];
          chessRenderBoard();
          return;
        }
        chessExecuteMove(found.fr, found.fc, found.tr, found.tc, null);
        return;
      }

      // Reselect own piece
      if (sq.type && sq.color === state.turn) {
        chessSelectPiece(r, c);
        return;
      }

      // Deselect
      chess.selectedSq   = null;
      chess.legalTargets = [];
      chessRenderBoard();
      return;
    }

    if (sq.type && sq.color === state.turn) {
      chessSelectPiece(r, c);
    }
  }

  function chessSelectPiece(r, c) {
    chess.selectedSq   = { r: r, c: c };
    chess.legalTargets = chess.state.legalMovesFrom(r, c);
    ChessAudio.select();
    chessRenderBoard();
  }

  function chessExecuteMove(fr, fc, tr, tc, promo) {
    var result = chess.state.makeMove(fr, fc, tr, tc, promo);
    if (!result.ok) { console.warn('[Chess] Illegal move attempt:', result.error); return; }

    chess.selectedSq   = null;
    chess.legalTargets = [];

    var mv = result.move;

    // Sound effects
    if (mv.isCastle) {
      ChessAudio.castle();
    } else if (mv.captured) {
      ChessAudio.capture();
      // Particles on capture cell
      var captureCell = chessBoardEl
        ? chessBoardEl.querySelector('[data-r="' + tr + '"][data-c="' + tc + '"]')
        : null;
      chessSpawnParticles(captureCell, mv.color === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE);
      chessBoardFlash('capture');
    } else if (promo) {
      ChessAudio.promote();
    } else {
      ChessAudio.move();
    }

    chessRenderBoard();
    chessUpdateStatus();

    // Check sound / flash after render
    if (!result.gameOver && result.inCheck) {
      ChessAudio.check();
      chessBoardFlash('check');
    }

    if (result.gameOver) {
      chessHandleGameOver();
      return;
    }

    if (chess.mode === 'bot' && chess.state.turn === chess.botColor) {
      chessScheduleBotMove();
    }
  }

  // ── Promotion Modal ──────────────────────────────────────────────────────

  function chessShowPromoModal(color) {
    if (!chessPromoModal) return;
    chessPromoModal.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'chess-promo-title';
    title.textContent = 'Promote Pawn';
    chessPromoModal.appendChild(title);

    var grid = document.createElement('div');
    grid.className = 'chess-promo-grid';
    var pieces = ['q', 'r', 'b', 'n'];
    var labels = { q:'Queen', r:'Rook', b:'Bishop', n:'Knight' };
    pieces.forEach(function (p) {
      var btn = document.createElement('button');
      btn.className = 'chess-promo-btn';
      var icon = document.createElement('span');
      icon.className = 'chess-promo-icon ' + (color === COLOR.WHITE ? 'chess-piece-w' : 'chess-piece-b');
      icon.textContent = PIECE_UNICODE[color][p];
      var lbl = document.createElement('span');
      lbl.className = 'chess-promo-label';
      lbl.textContent = labels[p];
      btn.appendChild(icon);
      btn.appendChild(lbl);
      btn.onclick = function () {
        var pend = chess.promotionPending;
        if (pend) {
          chess.promotionPending = null;
          chessPromoModal.classList.add('hidden');
          chessExecuteMove(pend.fr, pend.fc, pend.tr, pend.tc, p);
        }
      };
      grid.appendChild(btn);
    });
    chessPromoModal.appendChild(grid);
    chessPromoModal.classList.remove('hidden');
  }

  // ── Bot ──────────────────────────────────────────────────────────────────

  function chessScheduleBotMove() {
    chess.botThinking = true;
    chessUpdateStatus();
    var delay = 350 + Math.random() * 350;
    chess._botTimeout = setTimeout(function () {
      chess.botThinking = false;
      if (!chess.state || chess.state.gameOver) return;
      var mv = getBestMove(chess.state, chess.botDepth);
      if (mv) {
        chessExecuteMove(mv.fr, mv.fc, mv.tr, mv.tc, mv.promo);
      }
    }, delay);
  }

  // ── Game Over ────────────────────────────────────────────────────────────

  function chessHandleGameOver() {
    var state = chess.state;
    var icon, title, detail;
    var reason = state.gameOverReason;

    if (reason === 'checkmate') {
      if (state.winner === COLOR.WHITE) {
        icon  = '♔'; title = 'White Wins!';
        ChessAudio.win();
      } else {
        icon  = '♚'; title = 'Black Wins!';
        ChessAudio.win();
      }
      detail = 'Checkmate';
    } else {
      icon   = '🤝'; title = "It's a Draw!";
      detail = reason === 'stalemate'    ? 'Stalemate' :
               reason === '50-move'      ? '50-Move Rule' :
               reason === 'repetition'   ? 'Threefold Repetition' :
               reason === 'insufficient' ? 'Insufficient Material' : 'Draw';
      ChessAudio.draw();
    }

    setTimeout(function () {
      if (chessResultIcon)   chessResultIcon.textContent  = icon;
      if (chessResultTitle)  chessResultTitle.textContent  = title;
      if (chessResultDetail) chessResultDetail.textContent = detail;
      if (chessResultEl)     chessResultEl.classList.remove('hidden');
    }, 400);
  }

  // ── Game Start / Reset ───────────────────────────────────────────────────

  function chessStartGame() {
    if (chess._botTimeout) { clearTimeout(chess._botTimeout); chess._botTimeout = null; }
    chess.state            = new ChessState();
    chess.selectedSq       = null;
    chess.legalTargets     = [];
    chess.animating        = false;
    chess.botThinking      = false;
    chess.promotionPending = null;

    // Flip board if player chose Black
    chess.flipped = (chess.mode === 'bot' && chess.playerColor === COLOR.BLACK);

    if (chessResultEl)   chessResultEl.classList.add('hidden');
    if (chessPromoModal) chessPromoModal.classList.add('hidden');
    if (chessHomePanel)  chessHomePanel.classList.add('hidden');
    if (chessPlayPanel)  chessPlayPanel.classList.remove('hidden');

    chessRenderBoard();
    chessUpdateStatus();
    ChessAudio.gameStart();

    // In bot mode the bot is the opposite of the player color
    if (chess.mode === 'bot') {
      chess.botColor = (chess.playerColor === COLOR.WHITE) ? COLOR.BLACK : COLOR.WHITE;
    }

    if (chess.mode === 'bot' && chess.botColor === COLOR.WHITE) {
      chessScheduleBotMove();
    }
  }

  function chessResetGame() {
    if (chess._botTimeout) { clearTimeout(chess._botTimeout); chess._botTimeout = null; }
    chess.botThinking      = false;
    chess.promotionPending = null;
    chess.state            = new ChessState();
    chess.selectedSq       = null;
    chess.legalTargets     = [];
    chess.flipped          = (chess.mode === 'bot' && chess.playerColor === COLOR.BLACK);

    if (chessResultEl)   chessResultEl.classList.add('hidden');
    if (chessPromoModal) chessPromoModal.classList.add('hidden');

    chessRenderBoard();
    chessUpdateStatus();

    if (chess.mode === 'bot' && chess.botColor === COLOR.WHITE) {
      chessScheduleBotMove();
    }
  }

  // ── Hub-screen show/hide ─────────────────────────────────────────────────

  function showChess() {
    if (typeof hideAllScreens === 'function') hideAllScreens();
    if (chessScreen)    chessScreen.classList.remove('hidden');
    if (chessHomePanel) chessHomePanel.classList.remove('hidden');
    if (chessPlayPanel) chessPlayPanel.classList.add('hidden');
    if (chess._botTimeout) { clearTimeout(chess._botTimeout); chess._botTimeout = null; }
    window.scrollTo(0, 0);
  }

  window.showChess = showChess;

  // ── Event Wiring ─────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    var startPvpBtn   = document.getElementById('chess-start-pvp');
    var startBotBtn   = document.getElementById('chess-start-bot');
    var chessDiffBtns = document.querySelectorAll('.chess-diff-btn');
    var chessColorBtns= document.querySelectorAll('.chess-color-btn');
    var chessBackHub  = document.getElementById('chess-back-hub');
    var chessBackHub2 = document.getElementById('chess-back-hub-play');
    var chessResetBtn = document.getElementById('chess-reset-btn');
    var chessPlayAgain= document.getElementById('chess-play-again');
    var chessResultHub= document.getElementById('chess-result-hub');

    if (startPvpBtn) startPvpBtn.addEventListener('click', function () {
      chess.mode   = 'pvp';
      chess.flipped = false;
      chessStartGame();
    });

    if (startBotBtn) startBotBtn.addEventListener('click', function () {
      chess.mode = 'bot';
      chessStartGame();
    });

    if (chessDiffBtns) chessDiffBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        chessDiffBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        chess.botDepth = parseInt(btn.dataset.depth, 10) || 3;
      });
    });

    if (chessColorBtns) chessColorBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        chessColorBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        chess.playerColor = (btn.dataset.color === 'w') ? COLOR.WHITE : COLOR.BLACK;
        // In original code botColor is set from color btn; keep that too
        chess.botColor = (btn.dataset.color === 'w') ? COLOR.BLACK : COLOR.WHITE;
      });
    });

    if (chessBackHub) chessBackHub.addEventListener('click', function () {
      if (typeof showHub === 'function') showHub();
    });

    if (chessBackHub2) chessBackHub2.addEventListener('click', function () {
      if (chess._botTimeout) clearTimeout(chess._botTimeout);
      chess.botThinking = false;
      if (chessHomePanel) chessHomePanel.classList.remove('hidden');
      if (chessPlayPanel) chessPlayPanel.classList.add('hidden');
      if (SoundManager) SoundManager.backToHub();
    });

    if (chessResetBtn) chessResetBtn.addEventListener('click', function () {
      chessResetGame();
    });

    if (chessPlayAgain) chessPlayAgain.addEventListener('click', function () {
      chessResetGame();
    });

    if (chessResultHub) chessResultHub.addEventListener('click', function () {
      if (typeof showHub === 'function') showHub();
    });

    // ── Undo button ──────────────────────────────────────────────────────
    var chessUndoBtn = document.getElementById('chess-undo-btn');
    if (chessUndoBtn) {
      chessUndoBtn.addEventListener('click', function () {
        if (!chess.state || chess.state.gameOver) return;
        if (chess.botThinking) return;
        if (chess._botTimeout) { clearTimeout(chess._botTimeout); chess._botTimeout = null; }
        chess.botThinking = false;
        // In bot mode undo two half-moves (player + bot)
        var undoCount = chess.mode === 'bot' ? 2 : 1;
        for (var u = 0; u < undoCount; u++) {
          if (chess.state.moveHistory.length === 0) break;
          chess.state.undoMove();
        }
        chess.selectedSq   = null;
        chess.legalTargets = [];
        chess.hintMove     = null;
        if (chess.hintTimeout) { clearTimeout(chess.hintTimeout); chess.hintTimeout = null; }
        if (chessResultEl) chessResultEl.classList.add('hidden');
        chessRenderBoard();
        chessUpdateStatus();
        ChessAudio.select();
      });
    }

    // ── Hint button ──────────────────────────────────────────────────────
    var chessHintBtn = document.getElementById('chess-hint-btn');
    if (chessHintBtn) {
      chessHintBtn.addEventListener('click', function () {
        if (!chess.state || chess.state.gameOver || chess.botThinking) return;
        if (chess.mode === 'bot' && chess.state.turn === chess.botColor) return;
        // Clear previous hint
        if (chess.hintTimeout) { clearTimeout(chess.hintTimeout); chess.hintTimeout = null; }
        chess.hintMove = null;
        // Get best move at depth 2 (quick)
        var hintMv = getBestMove(chess.state, 2);
        if (hintMv) {
          chess.hintMove = { fr: hintMv.fr, fc: hintMv.fc, tr: hintMv.tr, tc: hintMv.tc };
          chessRenderBoard();
          ChessAudio.select();
          chess.hintTimeout = setTimeout(function () {
            chess.hintMove = null;
            chessRenderBoard();
          }, 3000);
        }
      });
    }
  });

  // ── GameLoader registration ──────────────────────────────────────────────

  if (typeof GameLoader !== 'undefined' && GameLoader.registerGame) {
    GameLoader.registerGame({
      gameId:      'chess',
      containerId: 'screen-chess',
      init:        function () {},
      start:       function () { if (chessHomePanel) chessHomePanel.classList.remove('hidden'); },
      reset:       function () { chessResetGame(); },
      destroy:     function () {
        if (chess._botTimeout) clearTimeout(chess._botTimeout);
        chess.botThinking = false;
      }
    });
  }

  console.log('[DuelZone] Chess engine loaded — enhanced UI, 6 levels, board flip, audio, particles.');

})(); // end IIFE
