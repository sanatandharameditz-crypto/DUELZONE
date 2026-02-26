// ═══════════════════════════════════════════════════════════════
// DuelZone · Unified script
// Handles:  1) Hub screen  2) Screen switching  3) TTT game logic
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// SECTION A: Screen Switching
//
// How it works:
//   Two divs exist in the DOM at all times: #screen-hub and #screen-ttt.
//   Only one is visible at a time. JS toggles .hidden (display:none)
//   on each div to swap between them — no page reload needed.
//
//   showHub()  → adds    .hidden to #screen-ttt
//              → removes .hidden from #screen-hub
//
//   showTTT()  → adds    .hidden to #screen-hub
//              → removes .hidden from #screen-ttt
//              → calls tttRestart() so board is always clean on entry
// ─────────────────────────────────────────────────────────────

var screenHub = document.getElementById('screen-hub');
var screenTTT = document.getElementById('screen-ttt');

function showHub() {
  screenTTT.classList.add('hidden');
  screenC4.classList.add('hidden');
  screenHub.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function showTTT() {
  screenHub.classList.add('hidden');
  screenTTT.classList.remove('hidden');
  tttRestart();        // always start fresh
  window.scrollTo(0, 0);
}

// ─────────────────────────────────────────────────────────────
// SECTION B: Hub Logic (game card clicks + launch overlay)
// ─────────────────────────────────────────────────────────────

var GAMES = [
  { name: 'Tic Tac Toe',         screen: 'ttt', url: null,                           accent: '#00e5ff' },
  { name: 'Connect Four',        screen: 'c4',  url: null,                           accent: '#ff6d00' },
  { name: 'Rock Paper Scissors', screen: null,  url: 'games/rps/index.html',         accent: '#00e676' },
  { name: 'Tap Battle',          screen: null,  url: 'games/tapbattle/index.html',   accent: '#f50057' },
];

var overlay    = document.getElementById('launch-overlay');
var launchGame = document.getElementById('launch-game');

function findGame(name) {
  for (var i = 0; i < GAMES.length; i++) {
    if (GAMES[i].name === name) return GAMES[i];
  }
  return null;
}

function launchWithOverlay(gameName, accentColor) {
  overlay.style.setProperty('--launch-color', accentColor);
  launchGame.textContent = gameName.toUpperCase();
  overlay.classList.add('active');
  overlay.removeAttribute('aria-hidden');
  console.log('%c[DuelZone] Launching: ' + gameName, 'color:' + accentColor + '; font-weight:bold;');
  setTimeout(function() {
    var game = findGame(gameName);
    if (game && game.url) {
      // window.location.href = game.url;  // uncomment when pages exist
      console.log('[DuelZone] Would navigate to:', game.url);
    }
    dismissOverlay();
  }, 1800);
}

function dismissOverlay() {
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

function spawnRipple(card, evt) {
  var rect   = card.getBoundingClientRect();
  var accent = getComputedStyle(card).getPropertyValue('--accent').trim();
  var ripple = document.createElement('span');
  ripple.style.cssText = [
    'position:absolute','border-radius:50%','pointer-events:none',
    'transform:scale(0)','animation:ripple-expand 0.55s ease-out forwards',
    'width:200px','height:200px',
    'left:'+(evt.clientX-rect.left-100)+'px',
    'top:' +(evt.clientY-rect.top -100)+'px',
    'background:'+accent,'opacity:0.18','z-index:20',
  ].join(';');
  card.appendChild(ripple);
  ripple.addEventListener('animationend', function(){ ripple.remove(); });
}
(function(){
  var s=document.createElement('style');
  s.textContent='@keyframes ripple-expand{to{transform:scale(3);opacity:0}}';
  document.head.appendChild(s);
})();

// Wire up every hub card
var hubCards = document.querySelectorAll('.arena-card');

hubCards.forEach(function(card) {
  card.setAttribute('tabindex','0');
  card.setAttribute('role','button');
  card.setAttribute('aria-label','Play '+card.getAttribute('data-game'));

  card.addEventListener('click', function(evt) {
    if (overlay.classList.contains('active')) return;

    var gameName    = card.getAttribute('data-game');
    var accentColor = getComputedStyle(card).getPropertyValue('--accent').trim();
    var game        = findGame(gameName);

    spawnRipple(card, evt);

    // Games with built-in screens — switch directly, no overlay
    if (game && game.screen === 'ttt') {
      showTTT();
      console.log('%c[DuelZone] Switching screen -> ' + gameName, 'color:'+accentColor+'; font-weight:bold;');
      return;
    }
    if (game && game.screen === 'c4') {
      showC4();
      console.log('%c[DuelZone] Switching screen -> ' + gameName, 'color:'+accentColor+'; font-weight:bold;');
      return;
    }

    // Other games use the launch overlay placeholder
    launchWithOverlay(gameName, accentColor);
  });

  card.addEventListener('keydown', function(evt) {
    if (evt.key==='Enter'||evt.key===' '){ evt.preventDefault(); card.click(); }
  });
});

overlay.addEventListener('click', function(evt){ if(evt.target===overlay) dismissOverlay(); });
document.addEventListener('keydown', function(evt){
  if(evt.key==='Escape'&&overlay.classList.contains('active')) dismissOverlay();
});


// ─────────────────────────────────────────────────────────────
// SECTION C: Tic Tac Toe Game Logic
//
// Identical logic to the standalone game, with these adjustments:
//   - All variables prefixed ttt* to avoid global name conflicts
//   - DOM refs use IDs inside #screen-ttt
//   - Scorecard element classes renamed to .ttt-scorecard/.ttt-mark
//     etc. to prevent CSS collisions with hub's .scorecard/.card-mark
// ─────────────────────────────────────────────────────────────

// TTT State
var tttGameMode    = 'pvp';
var tttDifficulty  = 'easy';
var tttBoard       = ['','','','','','','','',''];
var tttMark        = 'X';
var tttActive      = true;
var tttScores      = { X:0, O:0 };
var tttNames       = { X:'Player 1', O:'Player 2' };

var tttWinPatterns = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// TTT DOM refs
var tttBoardEl   = document.getElementById('board');
var tttCells     = document.querySelectorAll('.cell');
var tttStatus    = document.getElementById('status');
var tttRestart_  = document.getElementById('restart');   // note trailing _ to not shadow tttRestart()
var tttModeLabel = document.getElementById('mode-label');
var tttBtnPvp    = document.getElementById('btn-pvp');
var tttBtnPve    = document.getElementById('btn-pve');
var tttDiffSel   = document.getElementById('difficulty-selector');
var tttBtnEasy   = document.getElementById('btn-easy');
var tttBtnMed    = document.getElementById('btn-medium');
var tttBtnHard   = document.getElementById('btn-hard');
var tttCardP1    = document.getElementById('card-p1');
var tttCardP2    = document.getElementById('card-p2');
var tttScoreP1   = document.getElementById('score-p1');
var tttScoreP2   = document.getElementById('score-p2');
var tttP2Mark    = document.getElementById('p2-mark');
var tttP2Name    = document.getElementById('p2-name');
var backBtn      = document.getElementById('back-to-hub');

// Mode
function tttSetMode(mode) {
  tttGameMode = mode;
  if (mode === 'pvp') {
    tttBtnPvp.classList.add('active');
    tttBtnPve.classList.remove('active');
    tttDiffSel.classList.add('hidden');
    tttNames['O']         = 'Player 2';
    tttP2Mark.className   = 'ttt-mark o';
    tttP2Mark.textContent = 'O';
    tttP2Name.textContent = 'Player 2';
    tttBoardEl.classList.remove('bot-mode');
    tttModeLabel.textContent = 'LOCAL PvP';
  } else {
    tttBtnPve.classList.add('active');
    tttBtnPvp.classList.remove('active');
    tttDiffSel.classList.remove('hidden');
    tttNames['O']         = 'Bot';
    tttP2Mark.className   = 'ttt-mark bot';
    tttP2Mark.textContent = '🤖';
    tttP2Name.textContent = 'Bot';
    tttBoardEl.classList.add('bot-mode');
    tttModeLabel.textContent = 'PLAYER VS BOT';
  }
  tttScores = { X:0, O:0 };
  tttScoreP1.textContent = '0';
  tttScoreP2.textContent = '0';
  tttRestart();
}

// Difficulty
function tttSetDiff(level) {
  tttDifficulty = level;
  tttBtnEasy.classList.remove('active');
  tttBtnMed.classList.remove('active');
  tttBtnHard.classList.remove('active');
  if(level==='easy')   tttBtnEasy.classList.add('active');
  if(level==='medium') tttBtnMed.classList.add('active');
  if(level==='hard')   tttBtnHard.classList.add('active');
  tttRestart();
}

// Win helpers
function tttWinLine(mark) {
  for(var i=0;i<tttWinPatterns.length;i++){
    var a=tttWinPatterns[i][0],b=tttWinPatterns[i][1],c=tttWinPatterns[i][2];
    if(tttBoard[a]===mark&&tttBoard[b]===mark&&tttBoard[c]===mark) return tttWinPatterns[i];
  }
  return null;
}
function tttFull(){ for(var i=0;i<tttBoard.length;i++){if(tttBoard[i]==='')return false;}return true; }
function tttGlow(line){ line.forEach(function(i){tttCells[i].classList.add('winner');}); }

// Bot
function tttEmpty(){ var e=[];for(var i=0;i<tttBoard.length;i++){if(tttBoard[i]==='')e.push(i);}return e; }
function ttFindWin(mark){
  for(var i=0;i<tttBoard.length;i++){
    if(tttBoard[i]!=='')continue;
    tttBoard[i]=mark; var w=tttWinLine(mark)!==null; tttBoard[i]='';
    if(w)return i;
  } return -1;
}
function tttBotEasy(){var e=tttEmpty();return e[Math.floor(Math.random()*e.length)];}
function tttBotMed(){var w=ttFindWin('O');return w!==-1?w:tttBotEasy();}
function tttBotHard(){
  var w=ttFindWin('O');if(w!==-1)return w;
  var b=ttFindWin('X');if(b!==-1)return b;
  if(tttBoard[4]==='')return 4;
  var c=[0,2,6,8].filter(function(x){return tttBoard[x]==='';});
  if(c.length)return c[Math.floor(Math.random()*c.length)];
  return tttBotEasy();
}
function tttBotMove(){
  if(tttDifficulty==='easy')return tttBotEasy();
  if(tttDifficulty==='medium')return tttBotMed();
  return tttBotHard();
}

// Place mark
function tttPlace(idx, mark){
  tttBoard[idx]=mark;
  tttCells[idx].textContent=mark;
  tttCells[idx].classList.add(mark.toLowerCase(),'taken');
  var wl=tttWinLine(mark);
  if(wl){
    tttStatus.textContent=tttNames[mark]+' Wins! 🏆'; tttStatus.className='win';
    tttGlow(wl); tttScores[mark]++;
    tttScoreP1.textContent=tttScores['X']; tttScoreP2.textContent=tttScores['O'];
    tttCardP1.classList.remove('active'); tttCardP2.classList.remove('active');
    tttBoardEl.classList.add('disabled'); tttActive=false; return true;
  }
  if(tttFull()){
    tttStatus.textContent="It's a Draw!"; tttStatus.className='draw';
    tttCardP1.classList.remove('active'); tttCardP2.classList.remove('active');
    tttBoardEl.classList.add('disabled'); tttActive=false; return true;
  }
  return false;
}

// Active card
function tttCards(){
  if(tttMark==='X'){tttCardP1.classList.add('active');tttCardP2.classList.remove('active');}
  else{tttCardP2.classList.add('active');tttCardP1.classList.remove('active');}
}

// Bot trigger
function tttTriggerBot(){
  if(!tttActive)return;
  tttBoardEl.classList.add('disabled');
  var lbl=tttDifficulty.charAt(0).toUpperCase()+tttDifficulty.slice(1);
  tttStatus.textContent='Bot is thinking… ('+lbl+')'; tttStatus.className='thinking';
  setTimeout(function(){
    if(!tttActive)return;
    var idx=tttBotMove(); if(idx===undefined||idx===-1)return;
    tttBoardEl.classList.remove('disabled');
    var ended=tttPlace(idx,'O');
    if(!ended){tttMark='X';tttStatus.textContent=tttNames['X']+"'s Turn";tttStatus.className='';tttCards();}
  }, 400+Math.floor(Math.random()*200));
}

// Human click
function tttClick(e){
  var idx=parseInt(e.target.getAttribute('data-index'),10);
  if(!tttActive||tttBoard[idx]!=='')return;
  if(tttGameMode==='pve'&&tttMark!=='X')return;
  var ended=tttPlace(idx,tttMark);
  if(!ended){
    tttMark=tttMark==='X'?'O':'X';
    if(tttGameMode==='pve'&&tttMark==='O'){tttTriggerBot();}
    else{tttStatus.textContent=tttNames[tttMark]+"'s Turn";tttStatus.className='';tttCards();}
  }
}

// Restart  ← also called by showTTT() on each entry from hub
function tttRestart(){
  tttBoard=['','','','','','','','',''];
  tttMark='X'; tttActive=true;
  tttStatus.textContent=tttNames['X']+"'s Turn"; tttStatus.className='';
  tttBoardEl.classList.remove('disabled');
  tttCells.forEach(function(c){c.textContent='';c.className='cell';});
  tttCards();
}

// TTT Event listeners
tttCells.forEach(function(c){c.addEventListener('click',tttClick);});
tttRestart_.addEventListener('click', tttRestart);
tttBtnPvp.addEventListener('click', function(){if(tttGameMode!=='pvp')tttSetMode('pvp');});
tttBtnPve.addEventListener('click', function(){if(tttGameMode!=='pve')tttSetMode('pve');});
tttBtnEasy.addEventListener('click',function(){if(tttDifficulty!=='easy')  tttSetDiff('easy');});
tttBtnMed.addEventListener('click', function(){if(tttDifficulty!=='medium')tttSetDiff('medium');});
tttBtnHard.addEventListener('click',function(){if(tttDifficulty!=='hard')  tttSetDiff('hard');});

// Back to Hub button — resets board and returns to hub
backBtn.addEventListener('click', function(){
  tttRestart();
  showHub();
});

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
tttCards();   // highlight Player 1's scorecard on load
console.log('[DuelZone] Ready. Hub visible. TTT + C4 standing by.');


// ═══════════════════════════════════════════════════════════════
// SECTION D: Connect Four
//
// All variables and functions are prefixed c4 to guarantee zero
// collision with Tic Tac Toe or hub globals.
//
// DOM IDs in HTML are also prefixed c4- (e.g. #c4-board, #c4-p1-card)
// so getElementById calls here are unambiguous.
//
// Screen switching:
//   showC4()   — called by hub card click → hides hub, shows #screen-c4,
//                calls c4ResetGame() to always enter a clean board
//   showHub()  — already updated above to also hide #screen-c4
//   #c4-back-to-hub click → c4ResetGame(), showHub()
// ═══════════════════════════════════════════════════════════════

// ── Screen ref (added alongside screenHub + screenTTT) ────────
var screenC4 = document.getElementById('screen-c4');

// ── showC4 / back button ──────────────────────────────────────
function showC4() {
  screenHub.classList.add('hidden');
  screenTTT.classList.add('hidden');
  screenC4.classList.remove('hidden');
  c4ResetGame();          // always enter with a fresh board
  window.scrollTo(0, 0);
}

document.getElementById('c4-back-to-hub').addEventListener('click', function() {
  c4ResetGame();
  showHub();
});

// ─── C4 Constants ─────────────────────────────────────────────
var C4_ROWS  = 6;
var C4_COLS  = 7;
var C4_P1    = 'R';    // Red
var C4_P2    = 'Y';    // Yellow
var C4_EMPTY = null;

// ─── C4 State ─────────────────────────────────────────────────
var c4Board         = [];       // 2D array [row][col]
var c4CurrentPlayer = C4_P1;
var c4GameActive    = true;
var c4GameMode      = 'pvp';    // 'pvp' | 'bot'
var c4BotDifficulty = 'easy';   // 'easy' | 'medium' | 'hard'
var c4Scores        = { R: 0, Y: 0 };

// ─── C4 DOM refs ──────────────────────────────────────────────
var c4BoardEl      = document.getElementById('c4-board');
var c4BoardWrap    = document.getElementById('c4-board-wrap');
var c4StatusEl     = document.getElementById('c4-status-text');
var c4BtnPvp       = document.getElementById('c4-btn-pvp');
var c4BtnBot       = document.getElementById('c4-btn-bot');
var c4DiffGroup    = document.getElementById('c4-diff-group');
var c4BtnEasy      = document.getElementById('c4-diff-easy');
var c4BtnMed       = document.getElementById('c4-diff-med');
var c4BtnHard      = document.getElementById('c4-diff-hard');
var c4BtnReset     = document.getElementById('c4-btn-reset');
var c4P1Card       = document.getElementById('c4-p1-card');
var c4P2Card       = document.getElementById('c4-p2-card');
var c4P2Label      = document.getElementById('c4-p2-label');
var c4ScoreP1El    = document.getElementById('c4-score-p1');
var c4ScoreP2El    = document.getElementById('c4-score-p2');
var c4DropZone     = document.getElementById('c4-drop-zone');
var c4ColOverlays  = document.querySelectorAll('.c4-col-overlay');

// ══════════════════════════════════════════════════════════════
// C4 BOARD OPERATIONS
// ══════════════════════════════════════════════════════════════

/* createBoard() — returns fresh 6×7 array of null */
function c4CreateBoard() {
  var b = [];
  for (var r = 0; r < C4_ROWS; r++) {
    b[r] = [];
    for (var c = 0; c < C4_COLS; c++) b[r][c] = C4_EMPTY;
  }
  return b;
}

/* getNextOpenRow(col) — lowest empty row in a column, or -1 if full */
function c4GetNextOpenRow(board, col) {
  for (var r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === C4_EMPTY) return r;
  }
  return -1;
}

/* getValidColumns(board) — columns that still have an empty top cell */
function c4GetValidColumns(board) {
  var v = [];
  for (var c = 0; c < C4_COLS; c++) {
    if (board[0][c] === C4_EMPTY) v.push(c);
  }
  return v;
}

function c4DropDisc(board, row, col, player) {
  board[row][col] = player;
}

// ══════════════════════════════════════════════════════════════
// C4 WIN & DRAW DETECTION
// ══════════════════════════════════════════════════════════════

/*
 * c4CheckWin(board, player)
 * Scans all 4 directions for a run of 4.
 * Returns array of [row,col] pairs for the winning 4, or null.
 *
 * Directions:
 *   Horizontal →   row fixed,      col += 1
 *   Vertical   ↓   col fixed,      row += 1
 *   Diagonal   ↘   row += 1,       col += 1
 *   Diagonal   ↗   row -= 1,       col += 1
 */
function c4CheckWin(board, player) {
  var r, c;
  // Horizontal
  for (r = 0; r < C4_ROWS; r++) {
    for (c = 0; c <= C4_COLS - 4; c++) {
      if (board[r][c]===player && board[r][c+1]===player &&
          board[r][c+2]===player && board[r][c+3]===player) {
        return [[r,c],[r,c+1],[r,c+2],[r,c+3]];
      }
    }
  }
  // Vertical
  for (r = 0; r <= C4_ROWS - 4; r++) {
    for (c = 0; c < C4_COLS; c++) {
      if (board[r][c]===player && board[r+1][c]===player &&
          board[r+2][c]===player && board[r+3][c]===player) {
        return [[r,c],[r+1,c],[r+2,c],[r+3,c]];
      }
    }
  }
  // Diagonal ↘
  for (r = 0; r <= C4_ROWS - 4; r++) {
    for (c = 0; c <= C4_COLS - 4; c++) {
      if (board[r][c]===player && board[r+1][c+1]===player &&
          board[r+2][c+2]===player && board[r+3][c+3]===player) {
        return [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
      }
    }
  }
  // Diagonal ↗
  for (r = 3; r < C4_ROWS; r++) {
    for (c = 0; c <= C4_COLS - 4; c++) {
      if (board[r][c]===player && board[r-1][c+1]===player &&
          board[r-2][c+2]===player && board[r-3][c+3]===player) {
        return [[r,c],[r-1,c+1],[r-2,c+2],[r-3,c+3]];
      }
    }
  }
  return null;
}

/* c4CheckDraw — true when top row is fully occupied */
function c4CheckDraw(board) {
  for (var c = 0; c < C4_COLS; c++) {
    if (board[0][c] === C4_EMPTY) return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
// C4 RENDERING
// ══════════════════════════════════════════════════════════════

/* c4RenderBoard() — inject 42 .c4-board-cell divs into #c4-board */
function c4RenderBoard() {
  c4BoardEl.innerHTML = '';
  for (var r = 0; r < C4_ROWS; r++) {
    for (var c = 0; c < C4_COLS; c++) {
      var cell = document.createElement('div');
      cell.className = 'c4-board-cell';
      cell.setAttribute('data-row', r);
      cell.setAttribute('data-col', c);
      c4BoardEl.appendChild(cell);
    }
  }
}

/* c4RenderCell() — colour one cell and animate the drop */
function c4RenderCell(row, col, player, animate) {
  var cell = c4BoardEl.querySelector('[data-row="'+row+'"][data-col="'+col+'"]');
  if (!cell) return;

  // How far does the disc fall visually?
  var cs  = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--c4-cell-size')) ||
            parseInt(getComputedStyle(document.getElementById('screen-c4')).getPropertyValue('--c4-cell-size')) || 60;
  var gap = parseInt(getComputedStyle(document.getElementById('screen-c4')).getPropertyValue('--c4-board-gap')) || 10;
  cell.style.setProperty('--c4-drop-from', (row + 1) * (cs + gap) + 'px');
  cell.classList.add(player === C4_P1 ? 'red' : 'yellow');
  if (animate) {
    cell.classList.remove('dropping');
    void cell.offsetWidth;   // force reflow to restart animation
    cell.classList.add('dropping');
  }
}

function c4ClearBoardUI() {
  c4BoardEl.querySelectorAll('.c4-board-cell').forEach(function(c) {
    c.className = 'c4-board-cell';
    c.style.removeProperty('--c4-drop-from');
  });
}

function c4HighlightWinners(pairs) {
  pairs.forEach(function(pair) {
    var cell = c4BoardEl.querySelector('[data-row="'+pair[0]+'"][data-col="'+pair[1]+'"]');
    if (cell) cell.classList.add('winner-cell');
  });
}

function c4SetStatus(text, cssClass) {
  c4StatusEl.textContent = text;
  c4StatusEl.className = cssClass || '';
}

function c4UpdatePlayerCards() {
  c4P1Card.classList.remove('active-turn');
  c4P2Card.classList.remove('active-turn');
  if (!c4GameActive) return;
  if (c4CurrentPlayer === C4_P1) c4P1Card.classList.add('active-turn');
  else                            c4P2Card.classList.add('active-turn');
}

/* c4UpdateGhostDisc() — show coloured preview disc above hovered column */
function c4UpdateGhostDisc(hoveredCol) {
  var ghosts = c4DropZone.querySelectorAll('.c4-ghost-disc');
  ghosts.forEach(function(g, i) {
    if (i === hoveredCol && c4GameActive) {
      g.style.opacity    = '0.45';
      g.style.transform  = 'scale(1)';
      g.style.background = c4CurrentPlayer === C4_P1
        ? 'var(--c4-red)' : 'var(--c4-yellow)';
      g.style.boxShadow  = c4CurrentPlayer === C4_P1
        ? '0 0 12px var(--c4-red-glow)' : '0 0 12px var(--c4-yellow-glow)';
    } else {
      g.style.opacity   = '0';
      g.style.transform = 'scale(0.7)';
    }
  });
}

// ══════════════════════════════════════════════════════════════
// C4 GAME FLOW
// ══════════════════════════════════════════════════════════════

/*
 * c4HandleColumnClick(col)
 * Main entry point for every move (human + bot).
 * 1. Validate → 2. Drop → 3. Render → 4. Win/Draw? → 5. Switch turn
 */
function c4HandleColumnClick(col) {
  if (!c4GameActive) return;
  if (col < 0 || col >= C4_COLS) return;

  var row = c4GetNextOpenRow(c4Board, col);
  if (row === -1) return;   // full column

  c4DropDisc(c4Board, row, col, c4CurrentPlayer);
  c4RenderCell(row, col, c4CurrentPlayer, true);

  var winPairs = c4CheckWin(c4Board, c4CurrentPlayer);
  if (winPairs) { c4EndGame(c4CurrentPlayer, winPairs); return; }
  if (c4CheckDraw(c4Board)) { c4EndGame(null, null); return; }

  c4SwitchTurn();
}

function c4SwitchTurn() {
  c4CurrentPlayer = (c4CurrentPlayer === C4_P1) ? C4_P2 : C4_P1;
  c4UpdatePlayerCards();
  c4UpdateGhostDisc(-1);

  if (c4GameMode === 'bot' && c4CurrentPlayer === C4_P2) {
    c4BoardWrap.classList.add('locked');
    var lbl = c4BotDifficulty.charAt(0).toUpperCase() + c4BotDifficulty.slice(1);
    c4SetStatus('Bot is thinking… (' + lbl + ')', 'thinking');
    var delay = 300 + Math.floor(Math.random() * 300);
    setTimeout(function() {
      if (!c4GameActive) return;
      c4BoardWrap.classList.remove('locked');
      c4HandleColumnClick(c4GetBotMove());
    }, delay);
  } else {
    var name = (c4CurrentPlayer === C4_P1)
      ? 'Player 1'
      : (c4GameMode === 'bot' ? 'Bot' : 'Player 2');
    c4SetStatus(name + "'s Turn", c4CurrentPlayer === C4_P1 ? 'p1-turn' : 'p2-turn');
  }
}

function c4EndGame(winner, winPairs) {
  c4GameActive = false;
  c4BoardWrap.classList.add('locked');
  c4UpdatePlayerCards();
  if (winner) {
    if (winPairs) c4HighlightWinners(winPairs);
    c4Scores[winner]++;
    c4ScoreP1El.textContent = c4Scores[C4_P1];
    c4ScoreP2El.textContent = c4Scores[C4_P2];
    var wName = (winner === C4_P1) ? 'Player 1' : (c4GameMode === 'bot' ? 'Bot' : 'Player 2');
    c4SetStatus(wName + ' Wins! 🏆', 'win');
  } else {
    c4SetStatus("It's a Draw!", 'draw');
  }
}

/* c4ResetGame() — also called by showC4() on every hub entry */
function c4ResetGame() {
  c4Board         = c4CreateBoard();
  c4CurrentPlayer = C4_P1;
  c4GameActive    = true;
  c4ClearBoardUI();
  c4BoardWrap.classList.remove('locked');
  c4UpdatePlayerCards();
  c4UpdateGhostDisc(-1);
  c4SetStatus("Player 1's Turn", 'p1-turn');
}

// ══════════════════════════════════════════════════════════════
// C4 BOT — EASY
// ══════════════════════════════════════════════════════════════

/* c4GetRandomMove() — random valid column, never a full one */
function c4GetRandomMove() {
  var v = c4GetValidColumns(c4Board);
  return v[Math.floor(Math.random() * v.length)];
}

// ══════════════════════════════════════════════════════════════
// C4 BOT — MEDIUM
// ══════════════════════════════════════════════════════════════

/*
 * c4FindImmediateWin(player)
 * Tries every valid column to find an instant win for player.
 * Returns column index or -1.
 */
function c4FindImmediateWin(player) {
  var v = c4GetValidColumns(c4Board);
  for (var i = 0; i < v.length; i++) {
    var col = v[i];
    var row = c4GetNextOpenRow(c4Board, col);
    c4Board[row][col] = player;
    var wins = c4CheckWin(c4Board, player) !== null;
    c4Board[row][col] = C4_EMPTY;
    if (wins) return col;
  }
  return -1;
}

/*
 * c4GetMediumMove()
 * Priority: win → block → center preference → random
 */
function c4GetMediumMove() {
  var win   = c4FindImmediateWin(C4_P2); if (win   !== -1) return win;
  var block = c4FindImmediateWin(C4_P1); if (block !== -1) return block;
  var centerOrder = [3, 2, 4, 1, 5, 0, 6];
  var valid = c4GetValidColumns(c4Board);
  for (var i = 0; i < centerOrder.length; i++) {
    if (valid.indexOf(centerOrder[i]) !== -1) return centerOrder[i];
  }
  return c4GetRandomMove();
}

// ══════════════════════════════════════════════════════════════
// C4 BOT — HARD (Minimax with Alpha-Beta Pruning)
// ══════════════════════════════════════════════════════════════

/*
 * c4EvaluateWindow(window4, player)
 * Scores a 4-cell window for `player`:
 *   4 in a row            → +100
 *   3 + 1 empty           → +5
 *   2 + 2 empty           → +2
 *   Opponent 3 + 1 empty  → -4
 */
function c4EvaluateWindow(window4, player) {
  var opp = (player === C4_P1) ? C4_P2 : C4_P1;
  var pc = 0, ec = 0, oc = 0;
  for (var i = 0; i < 4; i++) {
    if      (window4[i] === player)   pc++;
    else if (window4[i] === C4_EMPTY) ec++;
    else                              oc++;
  }
  var s = 0;
  if (pc === 4)              s += 100;
  else if (pc === 3 && ec === 1) s += 5;
  else if (pc === 2 && ec === 2) s += 2;
  if (oc === 3 && ec === 1)  s -= 4;
  return s;
}

/*
 * c4ScorePosition(board, player)
 * Full board heuristic:
 *   - Center column control (+3 per disc in col 3)
 *   - All horizontal, vertical, both diagonal windows
 */
function c4ScorePosition(board, player) {
  var score = 0;
  // Center column bonus
  var cc = Math.floor(C4_COLS / 2);
  for (var r = 0; r < C4_ROWS; r++) {
    if (board[r][cc] === player) score += 3;
  }
  // Windows
  var r, c, w;
  for (r = 0; r < C4_ROWS; r++)
    for (c = 0; c <= C4_COLS-4; c++) {
      w = [board[r][c],board[r][c+1],board[r][c+2],board[r][c+3]];
      score += c4EvaluateWindow(w, player);
    }
  for (c = 0; c < C4_COLS; c++)
    for (r = 0; r <= C4_ROWS-4; r++) {
      w = [board[r][c],board[r+1][c],board[r+2][c],board[r+3][c]];
      score += c4EvaluateWindow(w, player);
    }
  for (r = 0; r <= C4_ROWS-4; r++)
    for (c = 0; c <= C4_COLS-4; c++) {
      w = [board[r][c],board[r+1][c+1],board[r+2][c+2],board[r+3][c+3]];
      score += c4EvaluateWindow(w, player);
    }
  for (r = 3; r < C4_ROWS; r++)
    for (c = 0; c <= C4_COLS-4; c++) {
      w = [board[r][c],board[r-1][c+1],board[r-2][c+2],board[r-3][c+3]];
      score += c4EvaluateWindow(w, player);
    }
  return score;
}

function c4IsTerminal(board) {
  return c4CheckWin(board, C4_P1) !== null ||
         c4CheckWin(board, C4_P2) !== null ||
         c4CheckDraw(board);
}

/*
 * c4Minimax(board, depth, alpha, beta, maximizing)
 * Standard minimax with alpha-beta pruning.
 * maximizing=true  → bot (C4_P2) chooses the best move
 * maximizing=false → human (C4_P1) is assumed to play optimally
 *
 * Move ordering: columns closest to center are tried first,
 * which maximises alpha-beta efficiency in Connect Four.
 *
 * Returns { col, score }
 */
function c4Minimax(board, depth, alpha, beta, maximizing) {
  var valid = c4GetValidColumns(board);
  valid.sort(function(a, b) { return Math.abs(a-3) - Math.abs(b-3); });

  if (c4IsTerminal(board)) {
    if      (c4CheckWin(board, C4_P2) !== null) return { col: -1, score:  1000000 };
    else if (c4CheckWin(board, C4_P1) !== null) return { col: -1, score: -1000000 };
    else                                         return { col: -1, score: 0 };
  }
  if (depth === 0)
    return { col: -1, score: c4ScorePosition(board, C4_P2) - c4ScorePosition(board, C4_P1) };

  var bestScore = maximizing ? -Infinity : +Infinity;
  var bestCol   = valid[0];

  for (var i = 0; i < valid.length; i++) {
    var col = valid[i];
    var row = c4GetNextOpenRow(board, col);
    board[row][col] = maximizing ? C4_P2 : C4_P1;
    var res = c4Minimax(board, depth-1, alpha, beta, !maximizing);
    board[row][col] = C4_EMPTY;

    if (maximizing) {
      if (res.score > bestScore) { bestScore = res.score; bestCol = col; }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (res.score < bestScore) { bestScore = res.score; bestCol = col; }
      beta = Math.min(beta, bestScore);
    }
    if (alpha >= beta) break;
  }
  return { col: bestCol, score: bestScore };
}

/* c4GetBestMoveMinimax() — depth-5 search, fast-path for immediate wins */
function c4GetBestMoveMinimax() {
  var win = c4FindImmediateWin(C4_P2);
  if (win !== -1) return win;
  return c4Minimax(c4Board, 5, -Infinity, +Infinity, true).col;
}

/* c4GetBotMove() — dispatcher */
function c4GetBotMove() {
  if (c4BotDifficulty === 'easy')   return c4GetRandomMove();
  if (c4BotDifficulty === 'medium') return c4GetMediumMove();
  return c4GetBestMoveMinimax();
}

// ══════════════════════════════════════════════════════════════
// C4 MODE & DIFFICULTY SWITCHING
// ══════════════════════════════════════════════════════════════

function c4SetMode(mode) {
  c4GameMode = mode;
  c4BtnPvp.classList.toggle('active', mode === 'pvp');
  c4BtnBot.classList.toggle('active', mode === 'bot');
  if (mode === 'pvp') {
    c4DiffGroup.classList.add('hidden');
    c4P2Label.textContent = 'Player 2';
  } else {
    c4DiffGroup.classList.remove('hidden');
    c4P2Label.textContent = 'Bot';
  }
  c4Scores = { R: 0, Y: 0 };
  c4ScoreP1El.textContent = '0';
  c4ScoreP2El.textContent = '0';
  c4ResetGame();
}

function c4SetDifficulty(level) {
  c4BotDifficulty = level;
  c4BtnEasy.classList.toggle('active', level === 'easy');
  c4BtnMed.classList.toggle('active',  level === 'medium');
  c4BtnHard.classList.toggle('active', level === 'hard');
  c4ResetGame();
}

// ══════════════════════════════════════════════════════════════
// C4 EVENT LISTENERS
// ══════════════════════════════════════════════════════════════

c4ColOverlays.forEach(function(overlay) {
  var col = parseInt(overlay.getAttribute('data-col'), 10);

  overlay.addEventListener('click', function() {
    if (c4GameMode === 'bot' && c4CurrentPlayer === C4_P2) return;
    c4HandleColumnClick(col);
  });

  overlay.addEventListener('mouseenter', function() {
    if (!c4GameActive) return;
    if (c4GameMode === 'bot' && c4CurrentPlayer === C4_P2) return;
    c4UpdateGhostDisc(col);
  });

  overlay.addEventListener('mouseleave', function() {
    c4UpdateGhostDisc(-1);
  });
});

c4BtnPvp.addEventListener('click', function()  { if (c4GameMode !== 'pvp')           c4SetMode('pvp'); });
c4BtnBot.addEventListener('click', function()  { if (c4GameMode !== 'bot')           c4SetMode('bot'); });
c4BtnEasy.addEventListener('click', function() { if (c4BotDifficulty !== 'easy')   c4SetDifficulty('easy'); });
c4BtnMed.addEventListener('click',  function() { if (c4BotDifficulty !== 'medium') c4SetDifficulty('medium'); });
c4BtnHard.addEventListener('click', function() { if (c4BotDifficulty !== 'hard')   c4SetDifficulty('hard'); });
c4BtnReset.addEventListener('click', c4ResetGame);

// ══════════════════════════════════════════════════════════════
// C4 INITIALISATION
// ══════════════════════════════════════════════════════════════
c4Board = c4CreateBoard();
c4RenderBoard();          // inject the 42 cell divs
c4UpdatePlayerCards();
c4SetStatus("Player 1's Turn", 'p1-turn');
// Difficulty selector hidden until Bot mode is selected
c4DiffGroup.classList.add('hidden');
console.log('[DuelZone] Connect Four ready. Board: ' + C4_ROWS + '×' + C4_COLS);
