// ═══════════════════════════════════════════════════════════════
// DuelZone · Battleship (Sea Battle) — UPGRADED
// Fully self-contained. All logic lives inside the `bs` namespace.
// No global variable pollution. Does not touch other games.
// ═══════════════════════════════════════════════════════════════

var bs = (function () {

  // ─────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────
  var GRID_SIZE = 10;

  var SHIP_DEFS = [
    { name: 'Carrier',    length: 5 },
    { name: 'Battleship', length: 4 },
    { name: 'Cruiser',    length: 3 },
    { name: 'Submarine',  length: 3 },
    { name: 'Destroyer',  length: 2 }
  ];

  var EMPTY = 0;
  var SHIP  = 1;
  var HIT   = 2;
  var MISS  = 3;

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  var state = {};

  function bsResetState() {
    state = {
      // Mode & difficulty
      mode:          null,       // 'pvp' | 'bot'
      difficulty:    'medium',   // 'easy' | 'medium' | 'hard'

      // Grids
      player1Grid:   makeGrid(),
      player2Grid:   makeGrid(),

      // Ships
      player1Ships:  [],
      player2Ships:  [],

      // Shots  (flat "r,c" strings)
      player1Shots:  [],
      player2Shots:  [],

      // Turn / phase
      currentPlayer: 1,           // 1 | 2  (in pvp)  or 'player'|'ai' (bot)
      currentTurn:   'player',    // legacy compat for bot mode
      gamePhase:     'modeselect',// 'modeselect'|'placement'|'passturn'|'battle'|'gameover'
      placementTurn: 1,           // whose placement turn: 1 | 2
      gameOver:      false,

      // Placement state
      currentShipIdx:  0,
      placementOrient: 'horizontal',
      previewCells:    [],

      // AI targeting state (all difficulties share, logic differs)
      aiMode:         'random',   // 'random' | 'target'
      aiTargetQ:      [],         // queue [r,c] for medium/hard
      aiHitStack:     [],         // hits on current ship
      aiDirection:    null,       // locked direction for hard: 'h' | 'v'
      aiDirStart:     null,       // first-hit cell [r,c] for hard
      aiDirPositive:  true        // direction we're currently extending
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GRID / SHIP HELPERS
  // ─────────────────────────────────────────────────────────────
  function makeGrid() {
    var g = [];
    for (var r = 0; r < GRID_SIZE; r++) {
      g.push([]);
      for (var c = 0; c < GRID_SIZE; c++) { g[r].push(EMPTY); }
    }
    return g;
  }

  function inBounds(r, c) {
    return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
  }

  function cellKey(r, c) { return r + ',' + c; }

  function wasShot(shots, r, c) {
    return shots.indexOf(cellKey(r, c)) !== -1;
  }

  function shipCells(r, c, length, orient) {
    var cells = [];
    for (var i = 0; i < length; i++) {
      if (orient === 'horizontal') cells.push([r, c + i]);
      else                         cells.push([r + i, c]);
    }
    return cells;
  }

  function canPlace(grid, r, c, length, orient) {
    var cells = shipCells(r, c, length, orient);
    for (var i = 0; i < cells.length; i++) {
      var cr = cells[i][0], cc = cells[i][1];
      if (!inBounds(cr, cc)) return false;
      if (grid[cr][cc] !== EMPTY) return false;
    }
    return true;
  }

  function placeOnGrid(grid, ships, r, c, length, orient, name) {
    var cells = shipCells(r, c, length, orient);
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

  function bsCheckShipSunk(ship) { return ship.sunk; }

  function bsIsSunkCell(ships, r, c) {
    for (var i = 0; i < ships.length; i++) {
      var ship = ships[i];
      if (!ship.sunk) continue;
      for (var j = 0; j < ship.cells.length; j++) {
        if (ship.cells[j][0] === r && ship.cells[j][1] === c) return true;
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: bsInit — entry point called by showBattleship
  // ─────────────────────────────────────────────────────────────
  function bsInit() {
    bsEnsureWired();
    bsShowModeSelect();
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 0: MODE SELECTION
  // ─────────────────────────────────────────────────────────────
  function bsShowModeSelect() {
    bsResetState();
    bsHideAllPanels();
    dom('bs-mode-panel').classList.remove('bs-hidden');
    bsSetBoardTitles('Your Fleet', 'Enemy Waters');
    bsSetMsg('');
    bsUpdateTurnUI();
    dom('bs-turn-indicator').textContent = '';
  }

  function bsSelectMode(mode) {
    state.mode = mode;
    if (mode === 'bot') {
      dom('bs-mode-panel').classList.add('bs-hidden');
      dom('bs-diff-panel').classList.remove('bs-hidden');
    } else {
      // PvP
      dom('bs-mode-panel').classList.add('bs-hidden');
      bsStartPlacementPhase();
    }
  }

  function bsSetDifficulty(diff) {
    state.difficulty = diff;
    dom('bs-diff-panel').classList.add('bs-hidden');
    bsStartPlacementPhase();
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: PLACEMENT
  // ─────────────────────────────────────────────────────────────
  function bsStartPlacementPhase() {
    state.gamePhase      = 'placement';
    state.placementTurn  = 1;
    state.currentShipIdx = 0;
    state.placementOrient= 'horizontal';

    // Reset grids
    state.player1Grid  = makeGrid();
    state.player1Ships = [];
    state.player2Grid  = makeGrid();
    state.player2Ships = [];

    bsHideAllPanels();
    dom('bs-placement-bar').classList.remove('bs-hidden');

    bsUpdateBoardsForPlacement();
    bsRenderPlayerGrid(state.player1Grid, state.player1Ships, 'bs-player-grid', true);
    bsClearRightBoard();
    bsUpdatePlacementUI();
    bsUpdateTurnUI();

    var def = SHIP_DEFS[0];
    bsSetMsg('Player 1: Place your <strong>' + def.name + '</strong> (length ' + def.length + '). Hover to preview, click to place.');
    dom('bs-orient-btn').textContent = '↔ Horizontal';
  }

  function bsUpdateBoardsForPlacement() {
    if (state.mode === 'pvp') {
      if (state.placementTurn === 1) {
        bsSetBoardTitles('Player 1 Fleet', 'Hidden');
      } else {
        bsSetBoardTitles('Player 2 Fleet', 'Hidden');
      }
    } else {
      bsSetBoardTitles('Your Fleet', 'Enemy Waters');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: bsAutoDeploy — randomly place all remaining ships
  // ─────────────────────────────────────────────────────────────
  function bsAutoDeploy() {
    if (state.gamePhase !== 'placement') return;

    var grid  = state.placementTurn === 1 ? state.player1Grid : state.player2Grid;
    var ships = state.placementTurn === 1 ? state.player1Ships : state.player2Ships;

    // Clear any ships already placed this turn and re-randomize all
    grid.forEach(function(row) { for (var c = 0; c < GRID_SIZE; c++) row[c] = EMPTY; });
    ships.length = 0;
    state.currentShipIdx = 0;

    randomPlaceAllShips(grid, ships);
    state.currentShipIdx = SHIP_DEFS.length; // mark all placed

    bsRenderPlayerGrid(grid, ships, 'bs-player-grid', true);
    bsUpdatePlacementUI();

    var who = (state.mode === 'pvp') ? 'Player ' + state.placementTurn : 'You';
    bsSetMsg(who + ': Auto-deployed! Click <strong>Confirm Placement</strong> or <strong>Re-roll</strong>.');
    bsShowConfirmPlacementBtn(true);
  }

  function bsShowConfirmPlacementBtn(show) {
    var btn = dom('bs-confirm-placement-btn');
    var reroll = dom('bs-reroll-btn');
    if (btn)   { if (show) btn.classList.remove('bs-hidden');   else btn.classList.add('bs-hidden'); }
    if (reroll){ if (show) reroll.classList.remove('bs-hidden'); else reroll.classList.add('bs-hidden'); }
  }

  function bsConfirmPlacement() {
    if (state.currentShipIdx < SHIP_DEFS.length) {
      bsSetMsg('❌ You must place all ships first!', 'error');
      return;
    }
    bsShowConfirmPlacementBtn(false);
    bsAdvancePlacement();
  }

  function bsAdvancePlacement() {
    if (state.mode === 'pvp' && state.placementTurn === 1) {
      // Transition to pass-device then Player 2 placement
      bsShowPassTurnScreen(2, 'placement');
    } else {
      // Bot mode P1 done, or PvP P2 done → battle
      if (state.mode === 'bot') {
        randomPlaceAllShips(state.player2Grid, state.player2Ships);
      }
      bsStartBattle();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PASS-DEVICE SCREEN
  // ─────────────────────────────────────────────────────────────
  function bsShowPassTurnScreen(nextPlayer, nextPhase) {
    bsHideAllPanels();
    dom('bs-placement-bar').classList.add('bs-hidden');

    var panel = dom('bs-passturn-panel');
    var msg   = dom('bs-passturn-msg');
    var btn   = dom('bs-passturn-btn');

    if (nextPhase === 'placement') {
      msg.innerHTML = '📱 Pass device to <strong>Player ' + nextPlayer + '</strong><br><span style="font-size:0.9rem;color:#64748b">Player ' + (nextPlayer - 1) + '\'s placement is hidden</span>';
      btn.textContent = 'Player ' + nextPlayer + ' — Start Placement';
    } else {
      msg.innerHTML = '📱 Pass device to <strong>Player ' + nextPlayer + '</strong><br><span style="font-size:0.9rem;color:#64748b">It\'s your turn to fire!</span>';
      btn.textContent = 'Player ' + nextPlayer + ' — Take Your Shot';
    }

    // Store what to do next
    btn.dataset.nextPlayer = nextPlayer;
    btn.dataset.nextPhase  = nextPhase;

    panel.classList.remove('bs-hidden');
    state.gamePhase = 'passturn';
    bsSetMsg('');
    dom('bs-turn-indicator').textContent = '';
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

      bsHideAllPanels();
      dom('bs-placement-bar').classList.remove('bs-hidden');

      var grid  = state.player2Grid;
      var ships = state.player2Ships;
      bsRenderPlayerGrid(grid, ships, 'bs-player-grid', true);
      bsClearRightBoard();
      bsUpdateBoardsForPlacement();
      bsUpdatePlacementUI();
      bsUpdateTurnUI();
      var def = SHIP_DEFS[0];
      bsSetMsg('Player 2: Place your <strong>' + def.name + '</strong> (length ' + def.length + ').');
      dom('bs-orient-btn').textContent = '↔ Horizontal';
      state.gamePhase = 'placement';
    } else {
      // Battle turn
      state.currentPlayer = nextPlayer;
      state.gamePhase = 'battle';
      bsSetupBattleTurn();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: BATTLE
  // ─────────────────────────────────────────────────────────────
  function bsStartBattle() {
    state.gamePhase    = 'battle';
    state.currentPlayer= 1;
    state.currentTurn  = 'player';

    bsHideAllPanels();
    bsSetupBattleTurn();
  }

  function bsSetupBattleTurn() {
    if (state.mode === 'pvp') {
      var attacker = state.currentPlayer;
      var defender = attacker === 1 ? 2 : 1;

      var attackerShots = attacker === 1 ? state.player1Shots : state.player2Shots;
      var defenderGrid  = attacker === 1 ? state.player2Grid  : state.player1Grid;
      var defenderShips = attacker === 1 ? state.player2Ships : state.player1Ships;
      var attackerGrid  = attacker === 1 ? state.player1Grid  : state.player2Grid;
      var attackerShips = attacker === 1 ? state.player1Ships : state.player2Ships;

      bsSetBoardTitles('Player ' + attacker + ' Fleet', 'Player ' + defender + ' Waters');
      bsRenderPlayerGrid(attackerGrid, attackerShips, 'bs-player-grid', false);
      bsRenderAttackGrid(defenderGrid, defenderShips, attackerShots, 'bs-ai-grid', true);

      bsSetMsg('Player ' + attacker + ': Click the enemy grid to fire!');
      bsUpdateTurnUI();
    } else {
      // Bot mode
      bsSetBoardTitles('Your Fleet', 'Enemy Waters');
      bsRenderPlayerGrid(state.player1Grid, state.player1Ships, 'bs-player-grid', false);
      bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', true);
      bsSetMsg('Battle! Click a cell on the <strong>Enemy Board</strong> to fire.');
      bsUpdateTurnUI();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: bsHandleShot — unified shot handler
  // ─────────────────────────────────────────────────────────────
  function bsHandleShot(r, c) {
    if (state.gamePhase !== 'battle') return;
    if (state.gameOver) return;

    if (state.mode === 'pvp') {
      bsHandlePvPShot(r, c);
    } else {
      bsHandlePlayerShotBot(r, c);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PvP SHOT HANDLING
  // ─────────────────────────────────────────────────────────────
  function bsHandlePvPShot(r, c) {
    var attacker      = state.currentPlayer;
    var defender      = attacker === 1 ? 2 : 1;
    var attackerShots = attacker === 1 ? state.player1Shots : state.player2Shots;
    var defenderGrid  = attacker === 1 ? state.player2Grid  : state.player1Grid;
    var defenderShips = attacker === 1 ? state.player2Ships : state.player1Ships;

    if (wasShot(attackerShots, r, c)) return;

    attackerShots.push(cellKey(r, c));
    var hit = defenderGrid[r][c] === SHIP;
    defenderGrid[r][c] = hit ? HIT : MISS;

    var msg = '';
    var sunkShipPvP = null;
    if (hit) {
      sunkShipPvP = bsRegisterHit(defenderShips, r, c);
      if (sunkShipPvP) {
        msg = '💥 Player ' + attacker + ' sunk Player ' + defender + '\'s <strong>' + sunkShipPvP.name + '</strong>!';
      } else {
        msg = '🔥 Player ' + attacker + ' hit!';
      }
    } else {
      msg = '💧 Miss!';
    }

    // Re-render attack grid first so cells exist for animation
    bsRenderAttackGrid(defenderGrid, defenderShips, attackerShots, 'bs-ai-grid', true);

    // Animate & sound
    if (hit) {
      bsAnimateHit('bs-ai-grid', r, c);
      bsPlayHitSound();
      if (sunkShipPvP) {
        bsAnimateSunk('bs-ai-grid', defenderShips, sunkShipPvP);
        bsScreenShake();
        bsPlaySunkSound();
      }
    } else {
      bsAnimateMiss('bs-ai-grid', r, c);
      bsPlayMissSound();
    }

    if (bsCheckWin(defenderShips)) {
      bsEndGame('player' + attacker);
      return;
    }

    bsSetMsg(msg);

    // Switch turn
    var nextPlayer = defender;
    setTimeout(function() {
      bsShowPassTurnScreen(nextPlayer, 'battle');
    }, 900);
  }

  // ─────────────────────────────────────────────────────────────
  // BOT SHOT HANDLING
  // ─────────────────────────────────────────────────────────────
  function bsHandlePlayerShotBot(r, c) {
    if (state.currentTurn !== 'player') return;
    if (wasShot(state.player1Shots, r, c)) return;

    state.player1Shots.push(cellKey(r, c));

    var hit = state.player2Grid[r][c] === SHIP;
    state.player2Grid[r][c] = hit ? HIT : MISS;

    var msg = '';
    var sunkShipBot = null;
    if (hit) {
      sunkShipBot = bsRegisterHit(state.player2Ships, r, c);
      if (sunkShipBot) {
        msg = '💥 You sunk the enemy <strong>' + sunkShipBot.name + '</strong>!';
      } else {
        msg = '🔥 Hit!';
      }
    } else {
      msg = '💧 Miss. AI\'s turn.';
    }

    bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', !state.gameOver);

    // Animate & sound
    if (hit) {
      bsAnimateHit('bs-ai-grid', r, c);
      bsPlayHitSound();
      if (sunkShipBot) {
        bsAnimateSunk('bs-ai-grid', state.player2Ships, sunkShipBot);
        bsScreenShake();
        bsPlaySunkSound();
      }
    } else {
      bsAnimateMiss('bs-ai-grid', r, c);
      bsPlayMissSound();
    }

    if (bsCheckWin(state.player2Ships)) {
      bsEndGame('player1');
      return;
    }

    bsSetMsg(msg);
    state.currentTurn = 'ai';
    bsUpdateTurnUI();

    setTimeout(function() { bsAIShot(); }, 900);
  }

  // ─────────────────────────────────────────────────────────────
  // AI SHOTS — EASY
  // ─────────────────────────────────────────────────────────────
  function bsAIShotEasy() {
    var available = [];
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        if (!wasShot(state.player2Shots, r, c)) available.push([r, c]);
      }
    }
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  // ─────────────────────────────────────────────────────────────
  // AI SHOTS — MEDIUM  (random + target adjacent on hit)
  // ─────────────────────────────────────────────────────────────
  function bsAIShotMedium() {
    // Drain target queue
    while (state.aiTargetQ.length > 0) {
      var cand = state.aiTargetQ.shift();
      if (inBounds(cand[0], cand[1]) && !wasShot(state.player2Shots, cand[0], cand[1])) return cand;
    }
    // Random
    var available = [];
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        if (!wasShot(state.player2Shots, r, c)) available.push([r, c]);
      }
    }
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  function bsAIQueueAdjacent(r, c) {
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    dirs.forEach(function(d) {
      var nr = r + d[0], nc = c + d[1];
      if (inBounds(nr, nc) && !wasShot(state.player2Shots, nr, nc)) {
        var already = state.aiTargetQ.some(function(t) { return t[0]===nr && t[1]===nc; });
        if (!already) state.aiTargetQ.push([nr, nc]);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // AI SHOTS — HARD  (probability density + direction lock)
  // ─────────────────────────────────────────────────────────────
  function bsAIShotHard() {
    // 1. If we have a locked direction, continue in that direction
    if (state.aiDirection && state.aiDirStart && state.aiHitStack.length > 0) {
      var shot = bsHardDirectionShot();
      if (shot) return shot;
    }

    // 2. Drain target queue (adjacent to known hits)
    while (state.aiTargetQ.length > 0) {
      var cand = state.aiTargetQ.shift();
      if (inBounds(cand[0], cand[1]) && !wasShot(state.player2Shots, cand[0], cand[1])) return cand;
    }

    // 3. Probability density map — checkerboard + ship-size weighting
    return bsHardProbabilityShot();
  }

  function bsHardDirectionShot() {
    var dir = state.aiDirection;  // 'h' | 'v'
    var hits = state.aiHitStack;
    if (!hits.length) return null;

    // Find extent in current direction
    var minR = hits[0][0], maxR = hits[0][0];
    var minC = hits[0][1], maxC = hits[0][1];
    hits.forEach(function(h) {
      if (h[0] < minR) minR = h[0];
      if (h[0] > maxR) maxR = h[0];
      if (h[1] < minC) minC = h[1];
      if (h[1] > maxC) maxC = h[1];
    });

    if (dir === 'h') {
      // Try extending right, then left
      var candidates = [[minR, maxC + 1], [minR, minC - 1]];
      for (var i = 0; i < candidates.length; i++) {
        var nr = candidates[i][0], nc = candidates[i][1];
        if (inBounds(nr, nc) && !wasShot(state.player2Shots, nr, nc)) return [nr, nc];
      }
    } else {
      // Try extending down, then up
      var candidates2 = [[maxR + 1, minC], [minR - 1, minC]];
      for (var j = 0; j < candidates2.length; j++) {
        var nr2 = candidates2[j][0], nc2 = candidates2[j][1];
        if (inBounds(nr2, nc2) && !wasShot(state.player2Shots, nr2, nc2)) return [nr2, nc2];
      }
    }
    // Direction exhausted, clear it so we fall through
    state.aiDirection = null;
    return null;
  }

  function bsHardProbabilityShot() {
    // Compute remaining (unsunk) ship sizes
    var remaining = state.player1Ships
      .filter(function(s) { return !s.sunk; })
      .map(function(s) { return s.cells.length; });

    if (!remaining.length) {
      // Fallback: pure random
      var avail = [];
      for (var r = 0; r < GRID_SIZE; r++)
        for (var c = 0; c < GRID_SIZE; c++)
          if (!wasShot(state.player2Shots, r, c)) avail.push([r, c]);
      return avail.length ? avail[Math.floor(Math.random() * avail.length)] : null;
    }

    // Build density grid
    var density = [];
    for (var i = 0; i < GRID_SIZE; i++) { density.push([]); for (var j = 0; j < GRID_SIZE; j++) density[i].push(0); }

    remaining.forEach(function(len) {
      // Horizontal placements
      for (var r = 0; r < GRID_SIZE; r++) {
        for (var c = 0; c <= GRID_SIZE - len; c++) {
          var valid = true;
          for (var k = 0; k < len; k++) {
            if (wasShot(state.player2Shots, r, c + k) && state.player1Grid[r][c + k] !== HIT) { valid = false; break; }
            if (state.player1Grid[r][c + k] === MISS) { valid = false; break; }
          }
          if (valid) for (var k2 = 0; k2 < len; k2++) density[r][c + k2]++;
        }
      }
      // Vertical placements
      for (var r2 = 0; r2 <= GRID_SIZE - len; r2++) {
        for (var c2 = 0; c2 < GRID_SIZE; c2++) {
          var valid2 = true;
          for (var k3 = 0; k3 < len; k3++) {
            if (wasShot(state.player2Shots, r2 + k3, c2) && state.player1Grid[r2 + k3][c2] !== HIT) { valid2 = false; break; }
            if (state.player1Grid[r2 + k3][c2] === MISS) { valid2 = false; break; }
          }
          if (valid2) for (var k4 = 0; k4 < len; k4++) density[r2 + k4][c2]++;
        }
      }
    });

    // Zero out already-shot cells and apply checkerboard weighting
    var best = [], bestScore = -1;
    for (var r3 = 0; r3 < GRID_SIZE; r3++) {
      for (var c3 = 0; c3 < GRID_SIZE; c3++) {
        if (wasShot(state.player2Shots, r3, c3)) continue;
        // Checkerboard: prefer cells where (r+c) % 2 === 0 in pure random mode
        var score = density[r3][c3];
        if (state.aiHitStack.length === 0 && (r3 + c3) % 2 !== 0) score *= 0.6;
        if (score > bestScore) { bestScore = score; best = [[r3, c3]]; }
        else if (score === bestScore) best.push([r3, c3]);
      }
    }
    if (!best.length) return null;
    return best[Math.floor(Math.random() * best.length)];
  }

  // ─────────────────────────────────────────────────────────────
  // AI MAIN SHOT DISPATCHER
  // ─────────────────────────────────────────────────────────────
  function bsAIShot() {
    if (state.gamePhase !== 'battle' || state.gameOver) return;

    var target;
    if (state.difficulty === 'easy')   target = bsAIShotEasy();
    if (state.difficulty === 'medium') target = bsAIShotMedium();
    if (state.difficulty === 'hard')   target = bsAIShotHard();

    if (!target) return;

    var r = target[0], c = target[1];
    state.player2Shots.push(cellKey(r, c));

    var hit = state.player1Grid[r][c] === SHIP;
    state.player1Grid[r][c] = hit ? HIT : MISS;

    var msg = '';
    var sunkShipAI = null;
    if (hit) {
      // Update AI state based on difficulty
      if (state.difficulty === 'medium') {
        state.aiTargetQ = [];  // clear old queue
        bsAIQueueAdjacent(r, c);
      }
      if (state.difficulty === 'hard') {
        state.aiHitStack.push([r, c]);
        if (state.aiHitStack.length >= 2 && !state.aiDirection) {
          // Determine direction from first two hits
          var h0 = state.aiHitStack[0], h1 = state.aiHitStack[1];
          state.aiDirection = (h0[0] === h1[0]) ? 'h' : 'v';
        } else if (!state.aiDirection && state.aiHitStack.length === 1) {
          // Queue adjacents for next turn
          state.aiTargetQ = [];
          bsAIQueueAdjacent(r, c);
        }
      }

      sunkShipAI = bsRegisterHit(state.player1Ships, r, c);
      if (sunkShipAI) {
        // Clear targeting state — ship sunk
        state.aiMode      = 'random';
        state.aiTargetQ   = [];
        state.aiHitStack  = [];
        state.aiDirection = null;
        msg = '☠️ AI sunk your <strong>' + sunkShipAI.name + '</strong>!';
      } else {
        msg = '💥 AI hit your ship!';
      }
    } else {
      if (state.difficulty === 'hard' && state.aiDirection && state.aiHitStack.length > 0) {
        // Miss in locked direction — don't clear hits, let bsHardDirectionShot try other end
      }
      msg = '💧 AI missed. Your turn!';
    }

    bsRenderPlayerGrid(state.player1Grid, state.player1Ships, 'bs-player-grid', false);

    // Animate & sound AI shot on player grid
    if (hit) {
      bsAnimateHit('bs-player-grid', r, c);
      bsPlayHitSound();
      if (sunkShipAI) {
        bsAnimateSunk('bs-player-grid', state.player1Ships, sunkShipAI);
        bsScreenShake();
        bsPlaySunkSound();
      }
    } else {
      bsAnimateMiss('bs-player-grid', r, c);
      bsPlayMissSound();
    }

    if (bsCheckWin(state.player1Ships)) {
      bsEndGame('ai');
      return;
    }

    bsSetMsg(msg);
    state.currentTurn = 'player';
    bsUpdateTurnUI();
    // Re-render attack grid so it remains clickable
    bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', true);
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: bsPlaceShip — player grid click during placement
  // ─────────────────────────────────────────────────────────────
  function bsPlaceShip(r, c) {
    if (state.gamePhase !== 'placement') return;

    var grid  = state.placementTurn === 1 ? state.player1Grid : state.player2Grid;
    var ships = state.placementTurn === 1 ? state.player1Ships : state.player2Ships;
    var def   = SHIP_DEFS[state.currentShipIdx];

    if (state.currentShipIdx >= SHIP_DEFS.length) return; // all placed

    if (!canPlace(grid, r, c, def.length, state.placementOrient)) {
      bsSetMsg('❌ Cannot place here! Ships must stay in bounds and not overlap.', 'error');
      return;
    }

    placeOnGrid(grid, ships, r, c, def.length, state.placementOrient, def.name);
    state.currentShipIdx++;
    bsRenderPlayerGrid(grid, ships, 'bs-player-grid', true);
    bsClearPreview();

    if (state.currentShipIdx >= SHIP_DEFS.length) {
      // All ships placed
      bsUpdatePlacementUI();
      var who = (state.mode === 'pvp') ? 'Player ' + state.placementTurn : 'You';
      bsSetMsg(who + ': All ships placed! Click <strong>Confirm Placement</strong>.');
      bsShowConfirmPlacementBtn(true);
    } else {
      var next = SHIP_DEFS[state.currentShipIdx];
      var who2 = (state.mode === 'pvp') ? 'Player ' + state.placementTurn : 'You';
      bsSetMsg(who2 + ': Place your <strong>' + next.name + '</strong> (length ' + next.length + ').');
      bsUpdatePlacementUI();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GAME END
  // ─────────────────────────────────────────────────────────────
  function bsEndGame(winner) {
    state.gameOver  = true;
    state.gamePhase = 'gameover';

    var panel  = dom('bs-result-panel');
    var title  = dom('bs-result-title');
    var detail = dom('bs-result-detail');

    var isWin;
    if (winner === 'player1') {
      isWin = true;
      title.textContent  = state.mode === 'pvp' ? '🏆 Player 1 Wins!' : '🏆 Victory!';
      detail.textContent = state.mode === 'pvp' ? 'Player 1 sunk all of Player 2\'s ships!' : 'You sunk all enemy ships!';
    } else if (winner === 'player2') {
      isWin = true;
      title.textContent  = '🏆 Player 2 Wins!';
      detail.textContent = 'Player 2 sunk all of Player 1\'s ships!';
    } else {
      isWin = false;
      title.textContent  = '💀 Defeated!';
      detail.textContent = 'The AI sunk all your ships.';
    }

    panel.classList.remove('bs-hidden');
    bsSetMsg('');
    bsUpdateTurnUI();

    // Reveal remaining enemy ships
    if (state.mode === 'bot') {
      bsRenderAttackGrid(state.player2Grid, state.player2Ships, state.player1Shots, 'bs-ai-grid', false, true);
    }

    // Play sound and trigger victory/defeat animations
    if (isWin) {
      bsPlayVictorySound();
    } else {
      bsPlayDefeatSound();
    }
    // Slight delay so the panel renders before animation runs
    setTimeout(function() { bsAnimateVictory(isWin); }, 50);
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: bsResetGame
  // ─────────────────────────────────────────────────────────────
  function bsResetGame() {
    bsShowModeSelect();
  }

  // ─────────────────────────────────────────────────────────────
  // RENDERING
  // ─────────────────────────────────────────────────────────────

  // Render a grid where ships are always visible (player's own fleet)
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

          // Placement hover during placement phase
          if (state.gamePhase === 'placement') {
            cell.addEventListener('mouseover', function() { bsShowPreview(row, col, containerId, grid); });
            cell.addEventListener('click', function() { bsPlaceShip(row, col); });
          }
          container.appendChild(cell);
        })(r, c);
      }
    }
  }

  // Render the attack grid (enemy/opponent board — ships hidden unless revealed)
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

  function bsClearRightBoard() {
    var container = dom('bs-ai-grid');
    if (!container) return;
    container.innerHTML = '';
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'bs-cell bs-cell-ai';
        container.appendChild(cell);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PLACEMENT PREVIEW
  // ─────────────────────────────────────────────────────────────
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
      var idx = cr * GRID_SIZE + cc;
      var el  = allCells[idx];
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

  // ─────────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────────
  function dom(id) { return document.getElementById(id); }

  function bsSetMsg(html, cls) {
    var el = dom('bs-message');
    if (!el) return;
    el.innerHTML = html || '';
    el.className = 'bs-message' + (cls ? ' bs-msg-' + cls : '');
  }

  function bsSetBoardTitles(left, right) {
    var l = dom('bs-board-title-left');
    var r = dom('bs-board-title-right');
    if (l) l.textContent = left;
    if (r) r.textContent = right;
  }

  function bsUpdateTurnUI() {
    var ind = dom('bs-turn-indicator');
    if (!ind) return;
    if (state.gameOver || state.gamePhase === 'gameover') {
      ind.textContent = '';
      ind.className   = 'bs-turn-indicator';
      return;
    }
    if (state.gamePhase === 'placement') {
      var who = state.mode === 'pvp' ? 'Player ' + state.placementTurn : 'You';
      ind.textContent = '📦 ' + who + ' — Placement Phase';
      ind.className   = 'bs-turn-indicator bs-turn-placement';
    } else if (state.gamePhase === 'battle') {
      if (state.mode === 'pvp') {
        ind.textContent = '🎯 Player ' + state.currentPlayer + '\'s Turn';
        ind.className   = 'bs-turn-indicator bs-turn-player';
      } else {
        if (state.currentTurn === 'player') {
          ind.textContent = '🎯 Your Turn';
          ind.className   = 'bs-turn-indicator bs-turn-player';
        } else {
          var diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[state.difficulty] || '';
          ind.textContent = '🤖 AI (' + diffLabel + ') Thinking…';
          ind.className   = 'bs-turn-indicator bs-turn-ai';
        }
      }
    } else {
      ind.textContent = '';
      ind.className   = 'bs-turn-indicator';
    }
  }

  function bsUpdatePlacementUI() {
    var bar = dom('bs-placement-bar');
    if (!bar) return;
    if (state.gamePhase !== 'placement') { bar.classList.add('bs-hidden'); return; }
    bar.classList.remove('bs-hidden');

    var list = dom('bs-ship-list');
    if (!list) return;
    list.innerHTML = '';
    SHIP_DEFS.forEach(function(def, idx) {
      var li = document.createElement('li');
      li.className = 'bs-ship-item';
      if (idx < state.currentShipIdx)        li.classList.add('bs-ship-placed');
      else if (idx === state.currentShipIdx) li.classList.add('bs-ship-active');
      li.innerHTML = '<span class="bs-ship-name">' + def.name + '</span>' +
                     '<span class="bs-ship-len">' + bsShipBlocks(def.length, idx < state.currentShipIdx) + '</span>';
      list.appendChild(li);
    });
  }

  function bsShipBlocks(len, placed) {
    var html = '';
    for (var i = 0; i < len; i++) {
      html += '<span class="bs-block' + (placed ? ' bs-block-placed' : '') + '"></span>';
    }
    return html;
  }

  // ─────────────────────────────────────────────────────────────
  // SOUND WRAPPERS  (use existing SoundManager — never create AudioContext)
  // ─────────────────────────────────────────────────────────────

  function bsPlayMissSound() {
    // Soft water drop — two descending sine tones
    if (typeof SoundManager === 'undefined') return;
    try {
      SoundManager.click && SoundManager.click();
    } catch(e) {}
  }

  function bsPlayHitSound() {
    // Sharp impact — use SoundManager's built-in tttWinLine if available, else click x2
    if (typeof SoundManager === 'undefined') return;
    try {
      if (SoundManager.c4Drop) { SoundManager.c4Drop(); }
      else if (SoundManager.click) { SoundManager.click(); }
    } catch(e) {}
  }

  function bsPlaySunkSound() {
    // Dramatic multi-tone loss cue
    if (typeof SoundManager === 'undefined') return;
    try {
      if (SoundManager.lose) SoundManager.lose();
    } catch(e) {}
  }

  function bsPlayVictorySound() {
    if (typeof SoundManager === 'undefined') return;
    try {
      if (SoundManager.win) SoundManager.win();
    } catch(e) {}
  }

  function bsPlayDefeatSound() {
    if (typeof SoundManager === 'undefined') return;
    try {
      if (SoundManager.lose) SoundManager.lose();
    } catch(e) {}
  }

  // ─────────────────────────────────────────────────────────────
  // ANIMATION ENGINE
  // All animations use class-toggling and CSS keyframes only.
  // No external libs, no layout thrashing, GPU-friendly.
  // ─────────────────────────────────────────────────────────────

  // Find a rendered cell element by grid-id, row, col
  function bsFindCellEl(gridId, row, col) {
    var container = dom(gridId);
    if (!container) return null;
    var idx  = row * GRID_SIZE + col;
    return container.children[idx] || null;
  }

  // Apply an animation class, auto-remove after duration ms
  function bsAnimateCell(el, cls, duration) {
    if (!el) return;
    el.classList.add(cls);
    setTimeout(function() {
      if (el) el.classList.remove(cls);
    }, duration || 800);
  }

  // MISS animation — splash ripple
  function bsAnimateMiss(gridId, row, col) {
    var el = bsFindCellEl(gridId, row, col);
    if (!el) return;
    el.classList.add('bs-anim-splash');
    setTimeout(function() { if (el) el.classList.remove('bs-anim-splash'); }, 900);
  }

  // HIT animation — explosion flash + shake
  function bsAnimateHit(gridId, row, col) {
    var el = bsFindCellEl(gridId, row, col);
    if (!el) return;
    el.classList.add('bs-anim-explode');
    setTimeout(function() { if (el) el.classList.remove('bs-anim-explode'); }, 700);
  }

  // SUNK animation — flash entire ship, add smoke burn
  function bsAnimateSunk(gridId, ships, sunkShip) {
    if (!sunkShip) return;
    var container = dom(gridId);
    if (!container) return;

    sunkShip.cells.forEach(function(cell, idx) {
      var el = bsFindCellEl(gridId, cell[0], cell[1]);
      if (!el) return;
      // Staggered flash
      setTimeout(function() {
        if (!el) return;
        el.classList.add('bs-anim-sunk-flash');
        setTimeout(function() {
          if (el) {
            el.classList.remove('bs-anim-sunk-flash');
            el.classList.add('bs-anim-smoke');
          }
        }, 500);
      }, idx * 80);
    });

    // Show floating "Ship Sunk!" text
    bsShowSunkText(gridId, sunkShip);
  }

  // Floating "Ship Sunk!" text overlay
  function bsShowSunkText(gridId, sunkShip) {
    var container = dom(gridId);
    if (!container) return;
    var parent = container.closest('.bs-board-wrap') || container.parentElement;
    if (!parent) return;

    var tag = document.createElement('div');
    tag.className = 'bs-sunk-label';
    tag.textContent = '☠ ' + sunkShip.name + ' Sunk!';
    // Position relative to board wrap
    parent.style.position = 'relative';
    parent.appendChild(tag);

    setTimeout(function() {
      if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
    }, 1800);
  }

  // SCREEN SHAKE — brief vibration of the whole bs-app div
  function bsScreenShake() {
    var app = dom('bs-app');
    if (!app) return;
    app.classList.add('bs-anim-shake');
    setTimeout(function() { if (app) app.classList.remove('bs-anim-shake'); }, 500);
  }

  // BOARD GLOW — pulse glow on a grid after victory/defeat
  function bsBoardGlow(gridId, type) {
    var container = dom(gridId);
    if (!container) return;
    var cls = type === 'win' ? 'bs-anim-glow-win' : 'bs-anim-glow-lose';
    container.classList.add(cls);
    setTimeout(function() { if (container) container.classList.remove(cls); }, 1500);
  }

  // CONFETTI — inject CSS confetti particles into result panel
  function bsSpawnConfetti() {
    var panel = dom('bs-result-inner');
    if (!panel) return;

    // Remove old confetti if any
    var old = panel.querySelectorAll('.bs-confetti-piece');
    old.forEach(function(el) { el.parentNode && el.parentNode.removeChild(el); });

    var colors = ['#06b6d4','#22c55e','#f59e0b','#ec4899','#a855f7','#3b82f6'];
    for (var i = 0; i < 30; i++) {
      (function(i) {
        var piece = document.createElement('div');
        piece.className = 'bs-confetti-piece';
        piece.style.cssText = [
          'left:' + (Math.random() * 100) + '%',
          'background:' + colors[Math.floor(Math.random() * colors.length)],
          'animation-duration:' + (0.9 + Math.random() * 0.9) + 's',
          'animation-delay:' + (Math.random() * 0.4) + 's',
          'transform:rotate(' + (Math.random() * 360) + 'deg)',
          'width:' + (6 + Math.random() * 6) + 'px',
          'height:' + (6 + Math.random() * 6) + 'px',
        ].join(';');
        panel.appendChild(piece);
        setTimeout(function() {
          if (piece && piece.parentNode) piece.parentNode.removeChild(piece);
        }, 2500);
      })(i);
    }
  }

  // VICTORY BANNER glow entrance
  function bsAnimateVictory(won) {
    var panel = dom('bs-result-panel');
    var inner = dom('bs-result-inner');
    if (!panel || !inner) return;
    inner.classList.add(won ? 'bs-anim-victory-enter' : 'bs-anim-defeat-enter');
    setTimeout(function() {
      if (inner) {
        inner.classList.remove('bs-anim-victory-enter', 'bs-anim-defeat-enter');
      }
    }, 900);
    if (won) {
      bsSpawnConfetti();
      bsBoardGlow('bs-ai-grid', 'win');
    } else {
      bsScreenShake();
      bsBoardGlow('bs-player-grid', 'lose');
    }
  }

  function bsHideAllPanels() {
    var ids = ['bs-mode-panel','bs-diff-panel','bs-passturn-panel','bs-result-panel'];
    ids.forEach(function(id) {
      var el = dom(id);
      if (el) el.classList.add('bs-hidden');
    });
    bsShowConfirmPlacementBtn(false);
  }

  // ─────────────────────────────────────────────────────────────
  // BUTTON WIRING
  // ─────────────────────────────────────────────────────────────
  function bsWireButtons() {
    // Mode selection
    var pvpBtn = dom('bs-mode-pvp-btn');
    var botBtn = dom('bs-mode-bot-btn');
    if (pvpBtn) pvpBtn.addEventListener('click', function() { bsSelectMode('pvp'); });
    if (botBtn) botBtn.addEventListener('click', function() { bsSelectMode('bot'); });

    // Difficulty
    ['easy','medium','hard'].forEach(function(d) {
      var btn = dom('bs-diff-' + d + '-btn');
      if (btn) btn.addEventListener('click', function() { bsSetDifficulty(d); });
    });

    // Orientation
    var orientBtn = dom('bs-orient-btn');
    if (orientBtn) {
      orientBtn.addEventListener('click', function() {
        state.placementOrient = state.placementOrient === 'horizontal' ? 'vertical' : 'horizontal';
        orientBtn.textContent = state.placementOrient === 'horizontal' ? '↔ Horizontal' : '↕ Vertical';
      });
    }

    // Auto deploy
    var autoBtn = dom('bs-auto-deploy-btn');
    if (autoBtn) autoBtn.addEventListener('click', bsAutoDeploy);

    // Confirm placement
    var confirmBtn = dom('bs-confirm-placement-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', bsConfirmPlacement);

    // Re-roll auto placement
    var rerollBtn = dom('bs-reroll-btn');
    if (rerollBtn) rerollBtn.addEventListener('click', function() {
      // Reset current placement turn's grid and re-randomize
      bsAutoDeploy();
    });

    // Pass turn continue
    var passTurnBtn = dom('bs-passturn-btn');
    if (passTurnBtn) passTurnBtn.addEventListener('click', bsPassTurnContinue);

    // Reset / play again
    var resetBtn   = dom('bs-reset-btn');
    var playAgain  = dom('bs-play-again-btn');
    if (resetBtn)  resetBtn.addEventListener('click',  function() { dom('bs-result-panel').classList.add('bs-hidden'); bsResetGame(); });
    if (playAgain) playAgain.addEventListener('click', function() { dom('bs-result-panel').classList.add('bs-hidden'); bsResetGame(); });

    // Hub buttons
    var hubBtn  = dom('bs-hub-btn');
    var hubBtn2 = dom('bs-hub-btn2');
    if (hubBtn)  hubBtn.addEventListener('click',  function() { if (typeof showHub === 'function') showHub(); });
    if (hubBtn2) hubBtn2.addEventListener('click', function() { if (typeof showHub === 'function') showHub(); });
  }

  // ─────────────────────────────────────────────────────────────
  // ONE-TIME WIRING
  // ─────────────────────────────────────────────────────────────
  var _wired = false;
  function bsEnsureWired() {
    if (_wired) return;
    _wired = true;
    bsWireButtons();
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  return {
    init:             bsInit,
    selectMode:       bsSelectMode,
    setDifficulty:    bsSetDifficulty,
    autoDeploy:       bsAutoDeploy,
    placeShip:        bsPlaceShip,
    startBattle:      bsStartBattle,
    handleShot:       bsHandleShot,
    aiShotEasy:       bsAIShotEasy,
    aiShotMedium:     bsAIShotMedium,
    aiShotHard:       bsAIShotHard,
    switchTurn:       bsPassTurnContinue,
    checkShipSunk:    bsCheckShipSunk,
    checkWin:         bsCheckWin,
    resetGame:        bsResetGame,
    ensureWired:      bsEnsureWired
  };

})();

// ─────────────────────────────────────────────────────────────
// ENTRY POINT (called by showBattleship in script.js)
// ─────────────────────────────────────────────────────────────
function bsInit() {
  bs.ensureWired();
  bs.init();
}
