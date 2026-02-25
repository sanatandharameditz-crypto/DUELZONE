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
  { name: 'Connect Four',        screen: null,  url: 'games/connectfour/index.html', accent: '#ff6d00' },
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

    // TTT has its own screen — switch directly, no overlay
    if (game && game.screen === 'ttt') {
      showTTT();
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
console.log('[DuelZone] Ready. Hub visible. TTT standing by.');
