// ═══════════════════════════════════════════════════════════════
// DuelZone · Battleship (Sea Battle) — FIXED & PvP COMPLETE
// ═══════════════════════════════════════════════════════════════

var bs = (function () {

  var GRID_SIZE = 10;

  var SHIP_DEFS = [
    { name: 'Carrier',    length: 5 },
    { name: 'Battleship', length: 4 },
    { name: 'Cruiser',    length: 3 },
    { name: 'Submarine',  length: 3 },
    { name: 'Destroyer',  length: 2 }
  ];

  var EMPTY = 0, SHIP = 1, HIT = 2, MISS = 3;

  // ─── STATE ────────────────────────────────────────────────────
  var state = {};

  function bsResetState() {
    state = {
      mode:         null,       // 'pvp' | 'bot'
      difficulty:   'medium',

      player1Grid:  makeGrid(),
      player2Grid:  makeGrid(),
      player1Ships: [],
      player2Ships: [],

      // shots as "r,c" strings
      player1Shots: [],  // P1's shots (at P2's grid)
      player2Shots: [],  // P2/AI shots (at P1's grid)

      currentPlayer:  1,        // 1 or 2
      gamePhase:      'modeselect',
      placementTurn:  1,
      gameOver:       false,

      currentShipIdx:  0,
      placementOrient: 'horizontal',
      previewCells:    [],

      // Bot AI state
      aiHitStack:    [],   // cells hit on current unfinished ship
      aiTargetQ:     [],   // adjacent cells queued to try
      aiDirection:   null, // 'h' | 'v' once two consecutive hits reveal direction
    };
  }

  // ─── GRID / SHIP HELPERS ──────────────────────────────────────
  function makeGrid() {
    var g = [];
    for (var r = 0; r < GRID_SIZE; r++) {
      g.push([]);
      for (var c = 0; c < GRID_SIZE; c++) g[r].push(EMPTY);
    }
    return g;
  }

  function inBounds(r, c) {
    return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
  }

  function cellKey(r, c) { return r + ',' + c; }
  function wasShot(shots, r, c) { return shots.indexOf(cellKey(r, c)) !== -1; }

  function shipCells(r, c, len, orient) {
    var cells = [];
    for (var i = 0; i < len; i++)
      cells.push(orient === 'horizontal' ? [r, c + i] : [r + i, c]);
    return cells;
  }

  function canPlace(grid, r, c, len, orient) {
    var cells = shipCells(r, c, len, orient);
    for (var i = 0; i < cells.length; i++) {
      if (!inBounds(cells[i][0], cells[i][1])) return false;
      if (grid[cells[i][0]][cells[i][1]] !== EMPTY) return false;
    }
    return true;
  }

  function placeOnGrid(grid, ships, r, c, len, orient, name) {
    var cells = shipCells(r, c, len, orient);
    cells.forEach(function(cell) { grid[cell[0]][cell[1]] = SHIP; });
    ships.push({ name: name, cells: cells, hits: 0, sunk: false });
  }

  function randomPlaceAllShips(grid, shipsArr) {
    grid.forEach(function(row) { for (var c = 0; c < GRID_SIZE; c++) row[c] = EMPTY; });
    shipsArr.length = 0;
    SHIP_DEFS.forEach(function(def) {
      var placed = false, tries = 0;
      while (!placed && tries < 2000) {
        tries++;
        var orient = Math.random() < 0.5 ? 'horizontal' : 'vertical';
        var r = Math.floor(Math.random() * GRID_SIZE);
        var c = Math.floor(Math.random() * GRID_SIZE);
        if (canPlace(grid, r, c, def.length, orient)) {
          placeOnGrid(grid, shipsArr, r, c, def.length, orient, def.name);
          placed = true;
        }
      }
    });
  }

  function bsRegisterHit(ships, r, c) {
    for (var i = 0; i < ships.length; i++) {
      var ship = ships[i];
      if (ship.sunk) continue;
      for (var j = 0; j < ship.cells.length; j++) {
        if (ship.cells[j][0] === r && ship.cells[j][1] === c) {
          ship.hits++;
          if (ship.hits >= ship.cells.length) { ship.sunk = true; return ship; }
          return null;
        }
      }
    }
    return null;
  }

  function bsCheckWin(ships) {
    return ships.length > 0 && ships.every(function(s) { return s.sunk; });
  }

  function bsIsSunkCell(ships, r, c) {
    for (var i = 0; i < ships.length; i++) {
      if (!ships[i].sunk) continue;
      for (var j = 0; j < ships[i].cells.length; j++) {
        if (ships[i].cells[j][0] === r && ships[i].cells[j][1] === c) return true;
      }
    }
    return false;
  }

  // ─── ENTRY POINT ──────────────────────────────────────────────
  function bsInit() {
    bsEnsureWired();
    bsShowModeSelect();
  }

  // ─── PHASE 0: MODE SELECTION ──────────────────────────────────
  function bsShowModeSelect() {
    bsResetState();
    bsHideAllPanels();
    dom('bs-mode-panel').classList.remove('bs-hidden');
    bsSetBoardTitles('Your Fleet', 'Enemy Waters');
    bsSetMsg('');
    dom('bs-turn-indicator').textContent = '';
    // Clear both grids visually
    bsClearGrid('bs-player-grid');
    bsClearGrid('bs-ai-grid');
  }

  function bsSelectMode(mode) {
    state.mode = mode;
    dom('bs-mode-panel').classList.add('bs-hidden');
    if (mode === 'bot') {
      dom('bs-diff-panel').classList.remove('bs-hidden');
    } else {
      bsStartPlacementPhase();
    }
  }

  function bsSetDifficulty(diff) {
    state.difficulty = diff;
    dom('bs-diff-panel').classList.add('bs-hidden');
    bsStartPlacementPhase();
  }

  // ─── PHASE 1: PLACEMENT ───────────────────────────────────────
  function bsStartPlacementPhase() {
    state.gamePhase      = 'placement';
    state.placementTurn  = 1;
    state.currentShipIdx = 0;
    state.placementOrient= 'horizontal';

    state.player1Grid  = makeGrid();
    state.player1Ships = [];
    state.player2Grid  = makeGrid();
    state.player2Ships = [];

    bsHideAllPanels();
    dom('bs-placement-bar').classList.remove('bs-hidden');

    bsRenderPlayerGrid(state.player1Grid, state.player1Ships, 'bs-player-grid', true);
    bsClearGrid('bs-ai-grid');
    bsSetBoardTitles('Player 1 Fleet', '— Hidden —');
    bsUpdatePlacementUI();
    bsUpdateTurnUI();
    bsSetMsg('Player 1: Place your <strong>' + SHIP_DEFS[0].name + '</strong> (length ' + SHIP_DEFS[0].length + '). Hover to preview, click to place.');
    dom('bs-orient-btn').textContent = '↔ Horizontal';
    bsShowConfirmBtn(false);
  }

  function bsAutoDeploy() {
    if (state.gamePhase !== 'placement') return;
    var grid  = state.placementTurn === 1 ? state.player1Grid : state.player2Grid;
    var ships = state.placementTurn === 1 ? state.player1Ships : state.player2Ships;

    grid.forEach(function(row) { for (var c = 0; c < GRID_SIZE; c++) row[c] = EMPTY; });
    ships.length = 0;
    state.currentShipIdx = 0;

    randomPlaceAllShips(grid, ships);
    state.currentShipIdx = SHIP_DEFS.length;

    bsRenderPlayerGrid(grid, ships, 'bs-player-grid', true);
    bsUpdatePlacementUI();
    var who = state.mode === 'pvp' ? 'Player ' + state.placementTurn : 'You';
    bsSetMsg(who + ': Fleet auto-deployed! Click <strong>Confirm Placement</strong> or <strong>Re-roll</strong>.');
    bsShowConfirmBtn(true);
  }

  function bsShowConfirmBtn(show) {
    var btn    = dom('bs-confirm-placement-btn');
    var reroll = dom('bs-reroll-btn');
    if (btn)   btn.classList[show ? 'remove' : 'add']('bs-hidden');
    if (reroll) reroll.classList[show ? 'remove' : 'add']('bs-hidden');
  }

  function bsConfirmPlacement() {
    if (state.currentShipIdx < SHIP_DEFS.length) {
      bsSetMsg('❌ You must place all ships first!', 'error');
      return;
    }
    bsShowConfirmBtn(false);

    if (state.mode === 'pvp' && state.placementTurn === 1) {
      bsShowPassTurnScreen(2, 'placement');
    } else if (state.mode === 'bot') {
      randomPlaceAllShips(state.player2Grid, state.player2Ships);
      bsStartBattle();
    } else {
      // PvP P2 done
      bsStartBattle();
    }
  }

  function bsPlaceShip(r, c) {
    if (state.gamePhase !== 'placement') return;
    var grid  = state.placementTurn === 1 ? state.player1Grid : state.player2Grid;
    var ships = state.placementTurn === 1 ? state.player1Ships : state.player2Ships;
    var def   = SHIP_DEFS[state.currentShipIdx];

    if (state.currentShipIdx >= SHIP_DEFS.length) return;

    if (!canPlace(grid, r, c, def.length, state.placementOrient)) {
      bsSetMsg('❌ Cannot place here — out of bounds or overlapping.', 'error');
      return;
    }

    placeOnGrid(grid, ships, r, c, def.length, state.placementOrient, def.name);
    state.currentShipIdx++;
    bsRenderPlayerGrid(grid, ships, 'bs-player-grid', true);
    bsClearPreview();

    if (state.currentShipIdx >= SHIP_DEFS.length) {
      var who = state.mode === 'pvp' ? 'Player ' + state.placementTurn : 'You';
      bsSetMsg(who + ': All ships placed! Click <strong>Confirm Placement</strong>.');
      bsUpdatePlacementUI();
      bsShowConfirmBtn(true);
    } else {
      var next = SHIP_DEFS[state.currentShipIdx];
      var who2 = state.mode === 'pvp' ? 'Player ' + state.placementTurn : 'You';
      bsSetMsg(who2 + ': Place your <strong>' + next.name + '</strong> (length ' + next.length + ').');
      bsUpdatePlacementUI();
    }
  }

  // ─── PASS-DEVICE SCREEN ───────────────────────────────────────
  function bsShowPassTurnScreen(nextPlayer, nextPhase) {
    bsHideAllPanels();
    dom('bs-placement-bar').classList.add('bs-hidden');

    // IMPORTANT: blank both boards so the next player can't see anything
    bsClearGrid('bs-player-grid');
    bsClearGrid('bs-ai-grid');
    bsSetMsg('');
    dom('bs-turn-indicator').textContent = '';

    var panel = dom('bs-passturn-panel');
    var msg   = dom('bs-passturn-msg');
    var btn   = dom('bs-passturn-btn');

    if (nextPhase === 'placement') {
      msg.innerHTML = '📱 Pass device to <strong>Player ' + nextPlayer + '</strong><br><span style="font-size:0.85rem;color:#94a3b8;">Player ' + (nextPlayer - 1) + '\'s fleet is now hidden</span>';
      btn.textContent = '✔ I\'m Player ' + nextPlayer + ' — Start Placement';
    } else {
      msg.innerHTML = '📱 Pass device to <strong>Player ' + nextPlayer + '</strong><br><span style="font-size:0.85rem;color:#94a3b8;">Ready to fire a shot?</span>';
      btn.textContent = '✔ I\'m Player ' + nextPlayer + ' — Take Shot';
    }

    btn.dataset.nextPlayer = nextPlayer;
    btn.dataset.nextPhase  = nextPhase;
    panel.classList.remove('bs-hidden');
    state.gamePhase = 'passturn';
  }

  function bsPassTurnContinue() {
    var btn        = dom('bs-passturn-btn');
    var nextPlayer = parseInt(btn.dataset.nextPlayer, 10);
    var nextPhase  = btn.dataset.nextPhase;

    dom('bs-passturn-panel').classList.add('bs-hidden');

    if (nextPhase === 'placement') {
      state.placementTurn  = nextPlayer;
      state.currentShipIdx = 0;
      state.placementOrient= 'horizontal';
      state.gamePhase      = 'placement';

      bsHideAllPanels();
      dom('bs-placement-bar').classList.remove('bs-hidden');

      var grid  = state.player2Grid;
      var ships = state.player2Ships;
      bsRenderPlayerGrid(grid, ships, 'bs-player-grid', true);
      bsClearGrid('bs-ai-grid');
      bsSetBoardTitles('Player 2 Fleet', '— Hidden —');
      bsUpdatePlacementUI();
      bsUpdateTurnUI();
      var def = SHIP_DEFS[0];
      bsSetMsg('Player 2: Place your <strong>' + def.name + '</strong> (length ' + def.length + ').');
      dom('bs-orient-btn').textContent = '↔ Horizontal';
      bsShowConfirmBtn(false);
    } else {
      // Battle turn
      state.currentPlayer = nextPlayer;
      state.gamePhase     = 'battle';
      bsSetupBattleTurn();
    }
  }

  // ─── PHASE 2: BATTLE ──────────────────────────────────────────
  function bsStartBattle() {
    state.gamePhase    = 'battle';
    state.currentPlayer= 1;
    state.player1Shots = [];
    state.player2Shots = [];

    bsHideAllPanels();
    bsSetupBattleTurn();
  }

  function bsSetupBattleTurn() {
    bsHideAllPanels();

    if (state.mode === 'pvp') {
      var attacker      = state.currentPlayer;
      var defender      = attacker === 1 ? 2 : 1;
      var attackerShots = attacker === 1 ? state.player1Shots : state.player2Shots;
      var defenderGrid  = attacker === 1 ? state.player2Grid  : state.player1Grid;
      var defenderShips = attacker === 1 ? state.player2Ships : state.player1Ships;
      var attackerGrid  = attacker === 1 ? state.player1Grid  : state.player2Grid;
      var attackerShips = attacker === 1 ? state.player1Ships : state.player2Ships;

      bsSetBoardTitles('Player ' + attacker + '\'s Fleet', 'Player ' + defender + '\'s Waters');
      // FIX: showShips = true so attacker can see their own fleet
      bsRenderPlayerGrid(attackerGrid, attackerShips, 'bs-player-grid', true);
      bsRenderAttackGrid(defenderGrid, defenderShips, attackerShots, 'bs-ai-grid', true);
      bsSetMsg('🎯 <strong>Player ' + attacker + '</strong>: Click the enemy grid to fire!');
      bsUpdateTurnUI();

    } else {
      // Bot mode
      bsSetBoardTitles('Your Fleet', 'Enemy Waters');
      // FIX: showShips = true so player can always see their own fleet
      bsRenderPlayerGrid(state.player1Grid, state.player1Ships, 'bs-player-grid', true);
      bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', true);
      bsSetMsg('🎯 Click a cell on the <strong>Enemy Board</strong> to fire.');
      bsUpdateTurnUI();
    }
  }

  // ─── SHOT HANDLER ────────────────────────────────────────────
  function bsHandleShot(r, c) {
    if (state.gamePhase !== 'battle' || state.gameOver) return;
    if (state.mode === 'pvp') bsHandlePvPShot(r, c);
    else                      bsHandlePlayerShotBot(r, c);
  }

  // ─── PVP SHOT ────────────────────────────────────────────────
  function bsHandlePvPShot(r, c) {
    var attacker      = state.currentPlayer;
    var defender      = attacker === 1 ? 2 : 1;
    var attackerShots = attacker === 1 ? state.player1Shots : state.player2Shots;
    var defenderGrid  = attacker === 1 ? state.player2Grid  : state.player1Grid;
    var defenderShips = attacker === 1 ? state.player2Ships : state.player1Ships;

    if (wasShot(attackerShots, r, c)) return;

    attackerShots.push(cellKey(r, c));

    var hit  = defenderGrid[r][c] === SHIP;
    defenderGrid[r][c] = hit ? HIT : MISS;

    var sunk = null;
    var msg  = '';
    if (hit) {
      sunk = bsRegisterHit(defenderShips, r, c);
      msg  = sunk
        ? '💥 Player ' + attacker + ' sunk Player ' + defender + '\'s <strong>' + sunk.name + '</strong>!'
        : '🔥 Player ' + attacker + ' hit!';
    } else {
      msg = '💧 Miss!';
    }

    // Re-render attack grid
    bsRenderAttackGrid(defenderGrid, defenderShips, attackerShots, 'bs-ai-grid', false);

    if (hit) {
      bsAnimateHit('bs-ai-grid', r, c);
      bsPlayHitSound();
      if (sunk) { bsAnimateSunk('bs-ai-grid', defenderShips, sunk); bsScreenShake(); bsPlaySunkSound(); }
    } else {
      bsAnimateMiss('bs-ai-grid', r, c);
      bsPlayMissSound();
    }

    if (bsCheckWin(defenderShips)) {
      setTimeout(function() { bsEndGame('player' + attacker); }, 800);
      return;
    }

    bsSetMsg(msg);

    // Pass turn to other player
    setTimeout(function() {
      bsShowPassTurnScreen(defender, 'battle');
    }, 1000);
  }

  // ─── BOT SHOT ────────────────────────────────────────────────
  function bsHandlePlayerShotBot(r, c) {
    if (wasShot(state.player1Shots, r, c)) return;

    state.player1Shots.push(cellKey(r, c));

    var hit  = state.player2Grid[r][c] === SHIP;
    state.player2Grid[r][c] = hit ? HIT : MISS;

    var sunk = null;
    var msg  = '';
    if (hit) {
      sunk = bsRegisterHit(state.player2Ships, r, c);
      msg  = sunk
        ? '💥 You sunk the enemy <strong>' + sunk.name + '</strong>!'
        : '🔥 Hit!';
    } else {
      msg = '💧 Miss — AI\'s turn.';
    }

    // Re-render attack grid (disable clicks during AI turn)
    bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', false);

    if (hit) {
      bsAnimateHit('bs-ai-grid', r, c);
      bsPlayHitSound();
      if (sunk) { bsAnimateSunk('bs-ai-grid', state.player2Ships, sunk); bsScreenShake(); bsPlaySunkSound(); }
    } else {
      bsAnimateMiss('bs-ai-grid', r, c);
      bsPlayMissSound();
    }

    if (bsCheckWin(state.player2Ships)) {
      setTimeout(function() { bsEndGame('player1'); }, 800);
      return;
    }

    bsSetMsg(msg);
    bsUpdateTurnUI('ai');

    setTimeout(function() { bsAIShot(); }, 1000);
  }

  // ─── AI EASY ─────────────────────────────────────────────────
  function bsPickRandom() {
    var avail = [];
    for (var r = 0; r < GRID_SIZE; r++)
      for (var c = 0; c < GRID_SIZE; c++)
        if (!wasShot(state.player2Shots, r, c)) avail.push([r, c]);
    return avail.length ? avail[Math.floor(Math.random() * avail.length)] : null;
  }

  // ─── AI MEDIUM — hunt/target ─────────────────────────────────
  // FIX: Only clear the queue when a ship is sunk, not on every hit.
  // The queue accumulates adjacent cells from all hits on the current ship.
  function bsAIShotMedium() {
    // Drain target queue first (cells adjacent to previous hits)
    while (state.aiTargetQ.length > 0) {
      var cand = state.aiTargetQ.shift();
      if (inBounds(cand[0], cand[1]) && !wasShot(state.player2Shots, cand[0], cand[1]))
        return cand;
    }
    return bsPickRandom();
  }

  function bsQueueAdjacent(r, c, shotsArr) {
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    dirs.forEach(function(d) {
      var nr = r + d[0], nc = c + d[1];
      if (!inBounds(nr, nc) || wasShot(shotsArr, nr, nc)) return;
      var already = state.aiTargetQ.some(function(t) { return t[0]===nr && t[1]===nc; });
      if (!already) state.aiTargetQ.push([nr, nc]);
    });
  }

  // ─── AI HARD — probability density + direction locking ────────
  // FIX: aiDirStart was never assigned. Fixed by tracking it in aiHitStack[0].
  // FIX: After direction locked, filter queue to only in-direction cells.
  function bsAIShotHard() {
    // 1. If we have a locked direction, continue along it
    if (state.aiDirection && state.aiHitStack.length > 0) {
      var directional = bsHardDirectionShot();
      if (directional) return directional;
      // Direction exhausted both ways — ship must be done (shouldn't happen but safety)
      state.aiDirection = null;
    }

    // 2. If we have hits but no direction yet, try queued adjacent cells
    if (state.aiHitStack.length > 0) {
      while (state.aiTargetQ.length > 0) {
        var cand = state.aiTargetQ.shift();
        if (inBounds(cand[0], cand[1]) && !wasShot(state.player2Shots, cand[0], cand[1]))
          return cand;
      }
    }

    // 3. Probability density map with checkerboard pruning
    return bsHardProbabilityShot();
  }

  function bsHardDirectionShot() {
    // Find extent of hit run in locked direction
    var hits = state.aiHitStack;
    var minR = hits[0][0], maxR = hits[0][0];
    var minC = hits[0][1], maxC = hits[0][1];
    hits.forEach(function(h) {
      if (h[0] < minR) minR = h[0];
      if (h[0] > maxR) maxR = h[0];
      if (h[1] < minC) minC = h[1];
      if (h[1] > maxC) maxC = h[1];
    });

    var candidates;
    if (state.aiDirection === 'h') {
      candidates = [[minR, maxC + 1], [minR, minC - 1]];
    } else {
      candidates = [[maxR + 1, minC], [minR - 1, minC]];
    }

    for (var i = 0; i < candidates.length; i++) {
      var nr = candidates[i][0], nc = candidates[i][1];
      if (inBounds(nr, nc) && !wasShot(state.player2Shots, nr, nc)) return [nr, nc];
    }
    return null; // both ends exhausted
  }

  function bsHardProbabilityShot() {
    // Build list of unsunk ship sizes
    var remaining = state.player1Ships
      .filter(function(s) { return !s.sunk; })
      .map(function(s) { return s.cells.length; });

    if (!remaining.length) return bsPickRandom();

    var density = [];
    for (var i = 0; i < GRID_SIZE; i++) {
      density.push([]);
      for (var j = 0; j < GRID_SIZE; j++) density[i].push(0);
    }

    remaining.forEach(function(len) {
      // Horizontal
      for (var r = 0; r < GRID_SIZE; r++) {
        for (var c = 0; c <= GRID_SIZE - len; c++) {
          var ok = true;
          for (var k = 0; k < len; k++) {
            // A cell blocks placement if it was shot and missed
            if (state.player1Grid[r][c+k] === MISS) { ok = false; break; }
          }
          if (ok) for (var k2 = 0; k2 < len; k2++) density[r][c+k2]++;
        }
      }
      // Vertical
      for (var r2 = 0; r2 <= GRID_SIZE - len; r2++) {
        for (var c2 = 0; c2 < GRID_SIZE; c2++) {
          var ok2 = true;
          for (var k3 = 0; k3 < len; k3++) {
            if (state.player1Grid[r2+k3][c2] === MISS) { ok2 = false; break; }
          }
          if (ok2) for (var k4 = 0; k4 < len; k4++) density[r2+k4][c2]++;
        }
      }
    });

    // Find max density cell (not yet shot); apply checkerboard when no active hits
    var best = [], bestScore = -1;
    for (var r3 = 0; r3 < GRID_SIZE; r3++) {
      for (var c3 = 0; c3 < GRID_SIZE; c3++) {
        if (wasShot(state.player2Shots, r3, c3)) continue;
        var score = density[r3][c3];
        // Checkerboard: skip odd-sum cells in pure random phase to cut search space
        if (state.aiHitStack.length === 0 && (r3 + c3) % 2 !== 0) score *= 0.5;
        if (score > bestScore) { bestScore = score; best = [[r3, c3]]; }
        else if (score === bestScore) best.push([r3, c3]);
      }
    }
    return best.length ? best[Math.floor(Math.random() * best.length)] : bsPickRandom();
  }

  // ─── AI MAIN DISPATCHER ───────────────────────────────────────
  function bsAIShot() {
    if (state.gamePhase !== 'battle' || state.gameOver) return;

    var target;
    if (state.difficulty === 'easy')   target = bsPickRandom();
    if (state.difficulty === 'medium') target = bsAIShotMedium();
    if (state.difficulty === 'hard')   target = bsAIShotHard();

    if (!target) return;
    var r = target[0], c = target[1];

    state.player2Shots.push(cellKey(r, c));

    var hit  = state.player1Grid[r][c] === SHIP;
    state.player1Grid[r][c] = hit ? HIT : MISS;

    var sunk = null;
    var msg  = '';

    if (hit) {
      sunk = bsRegisterHit(state.player1Ships, r, c);

      if (sunk) {
        // Ship sunk — reset ALL targeting state
        state.aiHitStack  = [];
        state.aiTargetQ   = [];
        state.aiDirection = null;
        msg = '☠️ AI sunk your <strong>' + sunk.name + '</strong>!';
      } else {
        // Hit but not sunk — update targeting state
        state.aiHitStack.push([r, c]);

        if (state.aiHitStack.length === 2 && !state.aiDirection) {
          // FIX: Determine and lock direction from first two hits
          var h0 = state.aiHitStack[0], h1 = state.aiHitStack[1];
          state.aiDirection = (h0[0] === h1[0]) ? 'h' : 'v';
          // FIX: Clear the non-directional queue entries (perpendicular cells)
          var dir = state.aiDirection;
          state.aiTargetQ = state.aiTargetQ.filter(function(t) {
            if (dir === 'h') return t[0] === r; // keep same row only
            else              return t[1] === c; // keep same col only
          });
        } else if (state.aiHitStack.length === 1) {
          // First hit — queue all 4 adjacent for medium/hard
          if (state.difficulty !== 'easy') bsQueueAdjacent(r, c, state.player2Shots);
        } else if (state.aiDirection) {
          // Additional hit in locked direction — don't queue, bsHardDirectionShot handles extension
        } else {
          // Second hit but medium mode (no direction locking) — queue adjacent
          if (state.difficulty === 'medium') bsQueueAdjacent(r, c, state.player2Shots);
        }

        msg = '💥 AI hit your ship!';
      }
    } else {
      // Miss
      if (state.difficulty === 'medium') {
        // Medium: on miss, keep queue (don't clear). Queue is already filtered above.
      }
      if (state.difficulty === 'hard' && state.aiDirection) {
        // Hard: on miss in locked direction, bsHardDirectionShot will try the other end next turn
      }
      msg = '💧 AI missed. Your turn!';
    }

    // FIX: showShips=true so player can see their own fleet after AI shoots
    bsRenderPlayerGrid(state.player1Grid, state.player1Ships, 'bs-player-grid', true);

    if (hit) {
      bsAnimateHit('bs-player-grid', r, c);
      bsPlayHitSound();
      if (sunk) { bsAnimateSunk('bs-player-grid', state.player1Ships, sunk); bsScreenShake(); bsPlaySunkSound(); }
    } else {
      bsAnimateMiss('bs-player-grid', r, c);
      bsPlayMissSound();
    }

    if (bsCheckWin(state.player1Ships)) {
      setTimeout(function() { bsEndGame('ai'); }, 800);
      return;
    }

    bsSetMsg(msg);
    bsUpdateTurnUI('player');
    // Re-enable attack grid for player
    bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', true);
  }

  // ─── PLACEMENT PREVIEW ────────────────────────────────────────
  function bsShowPreview(r, c, containerId, grid) {
    if (state.gamePhase !== 'placement') return;
    if (state.currentShipIdx >= SHIP_DEFS.length) return;
    bsClearPreview();
    var def   = SHIP_DEFS[state.currentShipIdx];
    var cells = shipCells(r, c, def.length, state.placementOrient);
    var valid = canPlace(grid, r, c, def.length, state.placementOrient);
    state.previewCells = cells;

    var container = dom(containerId);
    if (!container) return;
    var allCells = container.querySelectorAll('.bs-cell-player');

    cells.forEach(function(cell) {
      var cr = cell[0], cc = cell[1];
      if (!inBounds(cr, cc)) return;
      var el = allCells[cr * GRID_SIZE + cc];
      if (!el) return;
      el.classList.add(valid ? 'bs-preview-valid' : 'bs-preview-invalid');
    });
  }

  function bsClearPreview() {
    var container = dom('bs-player-grid');
    if (!container) return;
    container.querySelectorAll('.bs-preview-valid, .bs-preview-invalid').forEach(function(el) {
      el.classList.remove('bs-preview-valid', 'bs-preview-invalid');
    });
    state.previewCells = [];
  }

  // ─── GAME END ─────────────────────────────────────────────────
  function bsEndGame(winner) {
    state.gameOver  = true;
    state.gamePhase = 'gameover';

    var title  = dom('bs-result-title');
    var detail = dom('bs-result-detail');

    if (winner === 'player1') {
      title.textContent  = state.mode === 'pvp' ? '🏆 Player 1 Wins!' : '🏆 Victory!';
      detail.textContent = state.mode === 'pvp' ? 'Player 1 sunk all of Player 2\'s fleet!' : 'You sunk all enemy ships!';
    } else if (winner === 'player2') {
      title.textContent  = '🏆 Player 2 Wins!';
      detail.textContent = 'Player 2 sunk all of Player 1\'s fleet!';
    } else {
      title.textContent  = '💀 Defeated!';
      detail.textContent = 'The AI sunk all your ships.';
    }

    dom('bs-result-panel').classList.remove('bs-hidden');
    bsSetMsg('');
    dom('bs-turn-indicator').textContent = '';

    // Reveal all enemy ships on the attack board
    if (state.mode === 'bot') {
      bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', false, true);
    } else {
      // PvP — show both complete boards
      var atkGrid  = winner === 'player2' ? state.player2Grid  : state.player1Grid;
      var atkShips = winner === 'player2' ? state.player2Ships : state.player1Ships;
      var defGrid  = winner === 'player2' ? state.player1Grid  : state.player2Grid;
      var defShips = winner === 'player2' ? state.player1Ships : state.player2Ships;
      var atkShots = winner === 'player2' ? state.player2Shots : state.player1Shots;
      bsRenderPlayerGrid(atkGrid, atkShips, 'bs-player-grid', true);
      bsRenderAttackGrid(defGrid, defShips, atkShots, 'bs-ai-grid', false, true);
    }

    var isWin = winner !== 'ai';
    if (isWin) bsPlayVictorySound(); else bsPlayDefeatSound();
    setTimeout(function() { bsAnimateVictory(isWin); }, 50);
  }

  function bsResetGame() { bsShowModeSelect(); }

  // ─── RENDERING ───────────────────────────────────────────────
  function bsRenderPlayerGrid(grid, ships, containerId, showShips) {
    var container = dom(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        (function(row, col) {
          var cell = document.createElement('div');
          cell.className = 'bs-cell bs-cell-player';
          var val = grid[row][col];

          if (val === SHIP && showShips) cell.classList.add('bs-ship-cell');
          if (val === HIT) {
            cell.classList.add('bs-hit');
            if (bsIsSunkCell(ships, row, col)) cell.classList.add('bs-sunk');
            cell.textContent = '💥';
          }
          if (val === MISS) { cell.classList.add('bs-miss'); cell.textContent = '·'; }

          if (state.gamePhase === 'placement') {
            var capturedGrid = grid;
            cell.addEventListener('mouseover', function() {
              bsShowPreview(row, col, containerId, capturedGrid);
            });
            cell.addEventListener('click', function() { bsPlaceShip(row, col); });
          }
          container.appendChild(cell);
        })(r, c);
      }
    }
  }

  function bsRenderAttackGrid(grid, ships, shots, containerId, clickable, revealAll) {
    var container = dom(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        (function(row, col) {
          var cell = document.createElement('div');
          cell.className = 'bs-cell bs-cell-ai';
          var val = grid[row][col];

          if (val === HIT) {
            cell.classList.add('bs-hit');
            if (bsIsSunkCell(ships, row, col)) cell.classList.add('bs-sunk');
            cell.textContent = '💥';
          } else if (val === MISS) {
            cell.classList.add('bs-miss');
            cell.textContent = '·';
          } else if (revealAll && val === SHIP) {
            cell.classList.add('bs-reveal');
            cell.textContent = '🚢';
          } else if (clickable && !state.gameOver) {
            cell.classList.add('bs-clickable');
            cell.addEventListener('click', function() { bsHandleShot(row, col); });
          }
          container.appendChild(cell);
        })(r, c);
      }
    }
  }

  function bsClearGrid(containerId) {
    var container = dom(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'bs-cell';
        container.appendChild(cell);
      }
    }
  }

  // ─── UI HELPERS ───────────────────────────────────────────────
  function dom(id) { return document.getElementById(id); }

  function bsSetMsg(html, cls) {
    var el = dom('bs-message');
    if (!el) return;
    el.innerHTML = html || '';
    el.className = 'bs-message' + (cls ? ' bs-msg-' + cls : '');
  }

  function bsSetBoardTitles(left, right) {
    var l = dom('bs-board-title-left'), r = dom('bs-board-title-right');
    if (l) l.textContent = left;
    if (r) r.textContent = right;
  }

  function bsUpdateTurnUI(forceTurn) {
    var ind = dom('bs-turn-indicator');
    if (!ind) return;
    if (state.gameOver || state.gamePhase === 'gameover') {
      ind.textContent = ''; ind.className = 'bs-turn-indicator'; return;
    }
    if (state.gamePhase === 'placement') {
      var who = state.mode === 'pvp' ? 'Player ' + state.placementTurn : 'You';
      ind.textContent = '📦 ' + who + ' — Placement Phase';
      ind.className   = 'bs-turn-indicator bs-turn-placement';
      return;
    }
    if (state.gamePhase === 'battle') {
      var turn = forceTurn;
      if (state.mode === 'pvp') {
        ind.textContent = '🎯 Player ' + state.currentPlayer + '\'s Turn';
        ind.className   = 'bs-turn-indicator bs-turn-player';
      } else if (turn === 'ai') {
        var diffLabel = { easy:'Easy', medium:'Medium', hard:'Hard' }[state.difficulty] || '';
        ind.textContent = '🤖 AI (' + diffLabel + ') Thinking…';
        ind.className   = 'bs-turn-indicator bs-turn-ai';
      } else {
        ind.textContent = '🎯 Your Turn';
        ind.className   = 'bs-turn-indicator bs-turn-player';
      }
    }
  }

  function bsUpdatePlacementUI() {
    var list = dom('bs-ship-list');
    if (!list) return;
    list.innerHTML = '';
    SHIP_DEFS.forEach(function(def, idx) {
      var li = document.createElement('li');
      li.className = 'bs-ship-item';
      if (idx < state.currentShipIdx) li.classList.add('bs-ship-placed');
      else if (idx === state.currentShipIdx) li.classList.add('bs-ship-active');
      li.innerHTML = '<span class="bs-ship-name">' + def.name + '</span>' +
                     '<span class="bs-ship-len">' + bsShipBlocks(def.length, idx < state.currentShipIdx) + '</span>';
      list.appendChild(li);
    });
  }

  function bsShipBlocks(len, placed) {
    var html = '';
    for (var i = 0; i < len; i++)
      html += '<span class="bs-block' + (placed ? ' bs-block-placed' : '') + '"></span>';
    return html;
  }

  // ─── SOUNDS ───────────────────────────────────────────────────
  function bsPlayMissSound()    { try { SoundManager && SoundManager.click && SoundManager.click(); } catch(e) {} }
  function bsPlayHitSound()     { try { SoundManager && SoundManager.c4Drop && SoundManager.c4Drop(); } catch(e) {} }
  function bsPlaySunkSound()    { try { SoundManager && SoundManager.lose && SoundManager.lose(); } catch(e) {} }
  function bsPlayVictorySound() { try { SoundManager && SoundManager.win && SoundManager.win(); } catch(e) {} }
  function bsPlayDefeatSound()  { try { SoundManager && SoundManager.lose && SoundManager.lose(); } catch(e) {} }

  // ─── ANIMATIONS ───────────────────────────────────────────────
  function bsFindCellEl(gridId, row, col) {
    var container = dom(gridId);
    if (!container) return null;
    return container.children[row * GRID_SIZE + col] || null;
  }

  function bsAnimateMiss(gridId, row, col) {
    var el = bsFindCellEl(gridId, row, col);
    if (!el) return;
    el.classList.add('bs-anim-splash');
    // Radar ping rings emanating from miss cell
    var parent = el.parentElement;
    if (parent) {
      var elRect = el.getBoundingClientRect();
      var parentRect = parent.getBoundingClientRect();
      for (var ri = 0; ri < 2; ri++) {
        (function(delay) {
          var ring = document.createElement('div');
          ring.className = 'bs-radar-ping';
          ring.style.cssText = 'position:absolute;pointer-events:none;z-index:20;' +
            'left:' + (el.offsetLeft + el.offsetWidth/2) + 'px;' +
            'top:'  + (el.offsetTop  + el.offsetHeight/2) + 'px;' +
            'animation-delay:' + delay + 's;';
          parent.style.position = 'relative';
          parent.appendChild(ring);
          setTimeout(function() { ring.remove(); }, 900 + delay * 1000);
        })(ri * 0.28);
      }
    }
    setTimeout(function() { if (el) el.classList.remove('bs-anim-splash'); }, 900);
  }

  function bsAnimateHit(gridId, row, col) {
    var el = bsFindCellEl(gridId, row, col);
    if (!el) return;
    el.classList.add('bs-anim-explode');
    setTimeout(function() { if (el) el.classList.remove('bs-anim-explode'); }, 700);
  }

  function bsAnimateSunk(gridId, ships, sunkShip) {
    if (!sunkShip) return;
    sunkShip.cells.forEach(function(cell, idx) {
      var el = bsFindCellEl(gridId, cell[0], cell[1]);
      if (!el) return;
      setTimeout(function() {
        if (!el) return;
        el.classList.add('bs-anim-sunk-flash');
        setTimeout(function() {
          if (el) {
            el.classList.remove('bs-anim-sunk-flash');
            el.classList.add('bs-anim-smoke');
            // Mark as sunk with ship icon overlay
            el.classList.add('bs-sunk');
          }
        }, 500);
      }, idx * 80);
    });

    // After all cells animate, draw outline around whole ship
    setTimeout(function() {
      var container = document.getElementById(gridId);
      if (!container) return;
      sunkShip.cells.forEach(function(cell) {
        var el2 = container.children[cell[0] * GRID_SIZE + cell[1]];
        if (el2) el2.setAttribute('data-sunk-ship', sunkShip.name);
      });
    }, sunkShip.cells.length * 80 + 600);

    bsShowSunkText(gridId, sunkShip);
  }

  function bsShowSunkText(gridId, sunkShip) {
    var container = dom(gridId);
    if (!container) return;
    var parent = container.closest('.bs-board-wrap') || container.parentElement;
    if (!parent) return;
    var tag = document.createElement('div');
    tag.className = 'bs-sunk-label';
    tag.textContent = '☠ ' + sunkShip.name + ' Sunk!';
    parent.style.position = 'relative';
    parent.appendChild(tag);
    setTimeout(function() { if (tag && tag.parentNode) tag.parentNode.removeChild(tag); }, 1800);
  }

  function bsScreenShake() {
    var app = dom('bs-app');
    if (!app) return;
    app.classList.add('bs-anim-shake');
    setTimeout(function() { if (app) app.classList.remove('bs-anim-shake'); }, 500);
  }

  function bsBoardGlow(gridId, type) {
    var container = dom(gridId);
    if (!container) return;
    var cls = type === 'win' ? 'bs-anim-glow-win' : 'bs-anim-glow-lose';
    container.classList.add(cls);
    setTimeout(function() { if (container) container.classList.remove(cls); }, 1500);
  }

  function bsSpawnConfetti() {
    var panel = dom('bs-result-inner');
    if (!panel) return;
    panel.querySelectorAll('.bs-confetti-piece').forEach(function(el) { el.parentNode && el.parentNode.removeChild(el); });
    var colors = ['#06b6d4','#22c55e','#f59e0b','#ec4899','#a855f7','#3b82f6'];
    for (var i = 0; i < 30; i++) {
      (function(i) {
        var p = document.createElement('div');
        p.className = 'bs-confetti-piece';
        p.style.cssText = 'left:'+Math.random()*100+'%;background:'+colors[i%colors.length]+';animation-duration:'+(0.9+Math.random()*0.9)+'s;animation-delay:'+(Math.random()*0.4)+'s;transform:rotate('+(Math.random()*360)+'deg);width:'+(6+Math.random()*6)+'px;height:'+(6+Math.random()*6)+'px;';
        panel.appendChild(p);
        setTimeout(function() { if (p.parentNode) p.parentNode.removeChild(p); }, 2500);
      })(i);
    }
  }

  function bsAnimateVictory(won) {
    var inner = dom('bs-result-inner');
    if (!inner) return;
    inner.classList.add(won ? 'bs-anim-victory-enter' : 'bs-anim-defeat-enter');
    setTimeout(function() {
      if (inner) inner.classList.remove('bs-anim-victory-enter', 'bs-anim-defeat-enter');
    }, 900);
    if (won) { bsSpawnConfetti(); bsBoardGlow('bs-ai-grid', 'win'); }
    else     { bsScreenShake();  bsBoardGlow('bs-player-grid', 'lose'); }
  }

  function bsHideAllPanels() {
    ['bs-mode-panel','bs-diff-panel','bs-passturn-panel','bs-result-panel'].forEach(function(id) {
      var el = dom(id);
      if (el) el.classList.add('bs-hidden');
    });
    bsShowConfirmBtn(false);
  }

  // ─── BUTTON WIRING ────────────────────────────────────────────
  function bsWireButtons() {
    var pvpBtn = dom('bs-mode-pvp-btn');
    var botBtn = dom('bs-mode-bot-btn');
    if (pvpBtn) pvpBtn.addEventListener('click', function() { bsSelectMode('pvp'); });
    if (botBtn) botBtn.addEventListener('click', function() { bsSelectMode('bot'); });

    ['easy','medium','hard'].forEach(function(d) {
      var btn = dom('bs-diff-' + d + '-btn');
      if (btn) btn.addEventListener('click', function() { bsSetDifficulty(d); });
    });

    var orientBtn = dom('bs-orient-btn');
    if (orientBtn) {
      orientBtn.addEventListener('click', function() {
        state.placementOrient = state.placementOrient === 'horizontal' ? 'vertical' : 'horizontal';
        orientBtn.textContent = state.placementOrient === 'horizontal' ? '↔ Horizontal' : '↕ Vertical';
        bsClearPreview();
      });
    }

    var autoBtn = dom('bs-auto-deploy-btn');
    if (autoBtn) autoBtn.addEventListener('click', bsAutoDeploy);

    var confirmBtn = dom('bs-confirm-placement-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', bsConfirmPlacement);

    var rerollBtn = dom('bs-reroll-btn');
    if (rerollBtn) rerollBtn.addEventListener('click', bsAutoDeploy);

    var passTurnBtn = dom('bs-passturn-btn');
    if (passTurnBtn) passTurnBtn.addEventListener('click', bsPassTurnContinue);

    var resetBtn  = dom('bs-reset-btn');
    var playAgain = dom('bs-play-again-btn');
    if (resetBtn)  resetBtn.addEventListener('click',  function() { dom('bs-result-panel').classList.add('bs-hidden'); bsResetGame(); });
    if (playAgain) playAgain.addEventListener('click', function() { dom('bs-result-panel').classList.add('bs-hidden'); bsResetGame(); });

    var hubBtn  = dom('bs-hub-btn');
    var hubBtn2 = dom('bs-hub-btn2');
    if (hubBtn)  hubBtn.addEventListener('click',  function() { if (typeof showHub === 'function') showHub(); });
    if (hubBtn2) hubBtn2.addEventListener('click', function() { if (typeof showHub === 'function') showHub(); });
  }

  var _wired = false;
  function bsEnsureWired() {
    if (_wired) return;
    _wired = true;
    bsWireButtons();
  }

  return {
    init:          bsInit,
    selectMode:    bsSelectMode,
    setDifficulty: bsSetDifficulty,
    autoDeploy:    bsAutoDeploy,
    placeShip:     bsPlaceShip,
    handleShot:    bsHandleShot,
    resetGame:     bsResetGame,
    ensureWired:   bsEnsureWired
  };

})();

function bsInit() {
  bs.ensureWired();
  bs.init();
}
