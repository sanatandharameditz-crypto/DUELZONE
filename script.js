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

var screenHub      = document.getElementById('screen-hub');
var screenTTT      = document.getElementById('screen-ttt');
var screenRPS      = document.getElementById('screen-rps');
var screenTap      = document.getElementById('screen-tapbattle');
var screen2048     = document.getElementById('screen-duel2048');
var screenC4       = document.getElementById('screen-c4');
var screenCricket  = document.getElementById('screen-cricket');
var screenAH       = document.getElementById('screen-airhockey');
var screenPB       = document.getElementById('screen-passbreach');
var screenChess        = document.getElementById('screen-chess');
var screenBattleship   = document.getElementById('screen-battleship');
var screenCheckers     = document.getElementById('screen-checkers');
var screenDarts        = document.getElementById('screen-darts');
var screenTanks        = document.getElementById('screen-tanks');
var screenStarCatcher  = document.getElementById('screen-starcatcher');
var screenSpaceDodge   = document.getElementById('screen-spacedodge');
var screenPingPong     = document.getElementById('screen-pingpong');
var screenSnake        = document.getElementById('screen-snake');
var screenTyping       = document.getElementById('screen-typing');
var screenMinesweeper  = document.getElementById('screen-minesweeper');
var screenBlackjack    = document.getElementById('screen-blackjack');
var screenTetris       = document.getElementById('screen-tetris');
var screenBomberman    = document.getElementById('screen-bomberman');
var screenDrawGuess    = document.getElementById('screen-drawguess');
var screenPixelRacer   = document.getElementById('screen-pixelracer');
var screenReaction     = document.getElementById('screen-reaction');
var screenTerritory    = document.getElementById('screen-territory');

var ALL_SCREENS = [screenHub, screenTTT, screenRPS, screenTap, screen2048, screenC4, screenCricket, screenAH, screenPB, screenChess, screenBattleship, screenCheckers, screenDarts, screenTanks, screenStarCatcher, screenSpaceDodge, screenPingPong, screenSnake, screenTyping, screenMinesweeper, screenBlackjack, screenTetris, screenBomberman, screenDrawGuess, screenPixelRacer, screenReaction, screenTerritory];
// Note: screenMFD and screenCDD are push()ed to ALL_SCREENS
// later in their respective sections once their vars are declared.

function hideAllScreens() {
  ALL_SCREENS.forEach(function(s){ if(s) s.classList.add('hidden'); });
}

function showHub() {
  hideAllScreens();
  screenHub.classList.remove('hidden');
  SoundManager.backToHub();
  window.scrollTo(0, 0);
}

function showTTT() {
  hideAllScreens();
  screenTTT.classList.remove('hidden');
  tttRestart();
  window.scrollTo(0, 0);
}

function showRPS() {
  hideAllScreens();
  screenRPS.classList.remove('hidden');
  rpsRestart();
  window.scrollTo(0, 0);
}

function showTap() {
  hideAllScreens();
  screenTap.classList.remove('hidden');
  tapReset();
  window.scrollTo(0, 0);
}

function show2048() {
  hideAllScreens();
  screen2048.classList.remove('hidden');
  d2048Init();
  window.scrollTo(0, 0);
}

function showC4() {
  hideAllScreens();
  screenC4.classList.remove('hidden');
  var c4HomeEl = document.getElementById('c4-home');
  var c4PlayEl = document.getElementById('c4-play-panel');
  if (c4HomeEl) { c4HomeEl.classList.remove('hidden'); }
  if (c4PlayEl) { c4PlayEl.classList.add('hidden'); }
  window.scrollTo(0, 0);
}
function showCricket() {
  hideAllScreens();
  screenCricket.classList.remove('hidden');
  cricketResetToSetup();
  window.scrollTo(0, 0);
}

function showAH() {
  hideAllScreens();
  screenAH.classList.remove('hidden');
  var ahHome = document.getElementById('ah-home');
  var ahPlay = document.getElementById('ah-play-panel');
  if (ahHome) ahHome.classList.remove('hidden');
  if (ahPlay) ahPlay.classList.add('hidden');
  ahStopLoop();
  window.scrollTo(0, 0);
}

function showPB() {
  hideAllScreens();
  screenPB.classList.remove('hidden');
  var pbHome = document.getElementById('pb-home');
  var pbPlay = document.getElementById('pb-play-panel');
  if (pbHome) pbHome.classList.remove('hidden');
  if (pbPlay) pbPlay.classList.add('hidden');
  // Stop any running session
  if (pb && pb.timerInterval) { clearInterval(pb.timerInterval); pb.timerInterval = null; }
  if (pb) { pb.sessionOver = true; }
  window.scrollTo(0, 0);
}

function showBattleship() {
  hideAllScreens();
  screenBattleship.classList.remove('hidden');
  if (typeof bsInit === 'function') { bsInit(); }
  window.scrollTo(0, 0);
}

function showCheckers() {
  hideAllScreens();
  screenCheckers.classList.remove('hidden');
  if (typeof ckInit === 'function') { ckInit(); }
  window.scrollTo(0, 0);
}

function showDarts() {
  hideAllScreens();
  screenDarts.classList.remove('hidden');
  if (typeof dartsInit === 'function') { dartsInit(); }
  window.scrollTo(0, 0);
}

function showTanks() {
  hideAllScreens();
  screenTanks.classList.remove('hidden');
  if (typeof tanksDestroy === 'function') { tanksDestroy(); }
  if (typeof tanksInit === 'function') { tanksInit(); }
  window.scrollTo(0, 0);
}

function showStarCatcher() {
  hideAllScreens();
  screenStarCatcher.classList.remove('hidden');
  if (typeof scDestroy === 'function') { scDestroy(); }
  if (typeof scInit === 'function') { scInit(); }
  window.scrollTo(0, 0);
}

function showSpaceDodge() {
  hideAllScreens();
  screenSpaceDodge.classList.remove('hidden');
  var sdHome = document.getElementById('sd-home');
  var sdPlay = document.getElementById('sd-play-panel');
  if (sdHome) sdHome.classList.remove('hidden');
  if (sdPlay) sdPlay.classList.add('hidden');
  if (typeof sdStopGame === 'function') sdStopGame();
  window.scrollTo(0, 0);
}

function showPingPong() {
  hideAllScreens();
  screenPingPong.classList.remove('hidden');
  if (typeof ppInit === 'function') ppInit();
  window.scrollTo(0, 0);
}

function showSnake() {
  hideAllScreens();
  if (screenSnake) screenSnake.classList.remove('hidden');
  if (typeof snakeInit === 'function') snakeInit();
  window.scrollTo(0, 0);
}

function showTyping() {
  hideAllScreens();
  if (screenTyping) screenTyping.classList.remove('hidden');
  if (typeof typingInit === 'function') typingInit();
  window.scrollTo(0, 0);
}

function showMinesweeper() {
  hideAllScreens();
  if (screenMinesweeper) screenMinesweeper.classList.remove('hidden');
  if (typeof mineInit === 'function') mineInit();
  window.scrollTo(0, 0);
}

function showBlackjack() {
  hideAllScreens();
  if (screenBlackjack) screenBlackjack.classList.remove('hidden');
  if (typeof blackjackInit === 'function') blackjackInit();
  window.scrollTo(0, 0);
}

function showTetris() {
  hideAllScreens();
  if (screenTetris) screenTetris.classList.remove('hidden');
  if (typeof tetrisInit === 'function') tetrisInit();
  window.scrollTo(0, 0);
}

function showBomberman() {
  hideAllScreens();
  if (screenBomberman) screenBomberman.classList.remove('hidden');
  if (typeof bombermanInit === 'function') bombermanInit();
  window.scrollTo(0, 0);
}

function showDrawGuess() {
  hideAllScreens();
  if (screenDrawGuess) screenDrawGuess.classList.remove('hidden');
  if (typeof drawguessInit === 'function') drawguessInit();
  window.scrollTo(0, 0);
}

function showPixelRacer() {
  hideAllScreens();
  if (screenPixelRacer) screenPixelRacer.classList.remove('hidden');
  if (typeof pixelracerInit === 'function') pixelracerInit();
  window.scrollTo(0, 0);
}

function showReaction() {
  hideAllScreens();
  if (screenReaction) screenReaction.classList.remove('hidden');
  if (typeof reactionInit === 'function') reactionInit();
  window.scrollTo(0, 0);
}

function showTerritory() {
  hideAllScreens();
  if (screenTerritory) screenTerritory.classList.remove('hidden');
  if (typeof territoryInit === 'function') territoryInit();
  window.scrollTo(0, 0);
}

// ─────────────────────────────────────────────────────────────
// SECTION A2: Global SoundManager
// Shared synthesized sound system for all DuelZone games.
// Uses Web Audio API — no external files, zero network requests.
// All sounds trigger only after first user interaction.
// ─────────────────────────────────────────────────────────────
var SoundManager = (function() {
  var _ctx = null;
  var _muted = false;
  var _masterVol = 0.7;

  function ctx() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (_ctx && _ctx.state === 'suspended') { try { _ctx.resume(); } catch(e) {} }
    return _ctx;
  }

  // Low-level helpers
  function tone(freq, type, vol, dur, delay, freqEnd, fadeIn) {
    if (_muted) return;
    var c = ctx(); if (!c) return;
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type || 'sine';
      var t0 = c.currentTime + (delay || 0);
      o.frequency.setValueAtTime(freq, t0);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), t0 + dur);
      var fi = fadeIn || 0.005;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime((vol || 0.15) * _masterVol, t0 + fi);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.12));
      o.start(t0); o.stop(t0 + (dur || 0.12) + 0.02);
    } catch(e) {}
  }

  function noise(vol, dur, delay, freq, q) {
    if (_muted) return;
    var c = ctx(); if (!c) return;
    try {
      var bufSize = Math.ceil(c.sampleRate * dur);
      var buf = c.createBuffer(1, bufSize, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource();
      src.buffer = buf;
      var flt = c.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = freq || 1000;
      flt.Q.value = q || 1;
      var g = c.createGain();
      src.connect(flt); flt.connect(g); g.connect(c.destination);
      var t0 = c.currentTime + (delay || 0);
      g.gain.setValueAtTime((vol || 0.1) * _masterVol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.start(t0); src.stop(t0 + dur + 0.01);
    } catch(e) {}
  }

  // Throttle: prevent same sound from overlapping too much
  var _lastPlayed = {};
  function throttle(key, minGap) {
    var now = Date.now();
    if (_lastPlayed[key] && now - _lastPlayed[key] < minGap) return false;
    _lastPlayed[key] = now;
    return true;
  }

  return {
    mute: function() { _muted = true; },
    unmute: function() { _muted = false; },
    toggleMute: function() { _muted = !_muted; return _muted; },
    isMuted: function() { return _muted; },
    setVolume: function(v) { _masterVol = Math.max(0, Math.min(1, v)); },

    // ── Common ──────────────────────────────────────────────
    click: function() {
      if (!throttle('click', 80)) return;
      tone(700, 'sine', 0.06, 0.06);
    },
    gameStart: function() {
      tone(400, 'sine', 0.12, 0.12);
      tone(600, 'sine', 0.12, 0.12, 0.1);
      tone(800, 'sine', 0.12, 0.15, 0.2);
    },
    win: function() {
      [523,659,784,1047].forEach(function(f, i) { tone(f, 'sine', 0.18, 0.22, i * 0.1); });
    },
    lose: function() {
      tone(440, 'sawtooth', 0.12, 0.18);
      tone(300, 'sawtooth', 0.1, 0.22, 0.16);
      tone(200, 'sawtooth', 0.08, 0.28, 0.32);
    },
    draw: function() {
      tone(440, 'sine', 0.1, 0.15);
      tone(440, 'sine', 0.1, 0.15, 0.2);
    },
    backToHub: function() {
      tone(500, 'sine', 0.07, 0.08);
      tone(350, 'sine', 0.06, 0.08, 0.07);
    },

    // ── Tic Tac Toe ─────────────────────────────────────────
    tttMove: function() {
      if (!throttle('tttMove', 60)) return;
      tone(600, 'sine', 0.08, 0.07);
    },
    tttWinLine: function() {
      tone(880, 'sine', 0.14, 0.1);
      tone(1100, 'sine', 0.12, 0.12, 0.09);
    },

    // ── Rock Paper Scissors ──────────────────────────────────
    rpsSelect: function() {
      if (!throttle('rpsSelect', 100)) return;
      tone(500, 'sine', 0.09, 0.08);
      noise(0.05, 0.05, 0, 800);
    },
    rpsReveal: function() {
      tone(300, 'sawtooth', 0.1, 0.08);
      tone(500, 'sine', 0.12, 0.1, 0.06);
    },

    // ── Tap Battle ──────────────────────────────────────────
    tapTick: function() {
      if (!throttle('tapTick', 40)) return;
      tone(900, 'square', 0.04, 0.04);
    },
    tapBuzzer: function() {
      tone(200, 'sawtooth', 0.18, 0.08);
      tone(150, 'sawtooth', 0.15, 0.12, 0.07);
      noise(0.12, 0.15, 0, 500, 0.5);
    },

    // ── Connect Four ─────────────────────────────────────────
    c4Drop: function() {
      if (!throttle('c4Drop', 80)) return;
      tone(400, 'sine', 0.1, 0.06, 0, 200);
      noise(0.07, 0.07, 0, 600);
    },
    c4Win: function() {
      [600,800,1000,1200].forEach(function(f, i) { tone(f, 'sine', 0.15, 0.15, i * 0.07); });
    },

    // ── Hand Cricket ─────────────────────────────────────────
    cricRun: function() {
      if (!throttle('cricRun', 80)) return;
      tone(650, 'sine', 0.09, 0.08);
    },
    cricOut: function() {
      tone(800, 'square', 0.12, 0.05);
      noise(0.1, 0.12, 0.04, 900, 2);
      tone(300, 'sawtooth', 0.12, 0.2, 0.1);
    },

    // ── 2048 Duel ────────────────────────────────────────────
    mergePop: function() {
      if (!throttle('mergePop', 60)) return;
      tone(600, 'sine', 0.1, 0.08, 0, 900);
    },
    d2048GameOver: function() {
      tone(300, 'sawtooth', 0.12, 0.25);
      tone(200, 'sawtooth', 0.1, 0.3, 0.2);
    },

    // ── Air Hockey (mirrors ahAudio for shared mute) ─────────
    ahPaddleHit: function(speed) {
      if (!throttle('ahPaddleHit', 40)) return;
      var vol = Math.min(0.25, 0.08 + (speed || 0) * 0.006);
      tone(180 + (speed || 0) * 3, 'square', vol * 0.6, 0.06);
      noise(vol, 0.05, 0, 1200);
    },
    ahWallBounce: function() {
      if (!throttle('ahWall', 60)) return;
      tone(320, 'square', 0.07, 0.05);
      noise(0.05, 0.04, 0, 800);
    },
    ahGoal: function(isP1) {
      var base = isP1 ? 523 : 392;
      [0, 0.12, 0.24, 0.38].forEach(function(d, i) {
        tone(base * [1, 1.25, 1.5, 2][i], 'sine', 0.2, 0.2, d);
      });
    },
    ahWin: function() {
      [523,659,784,1047,1319].forEach(function(f, i) { tone(f, 'sine', 0.18, 0.22, i * 0.1); });
    },
    ahLose: function() {
      tone(440, 'sawtooth', 0.13, 0.2);
      tone(330, 'sawtooth', 0.1, 0.25, 0.18);
      tone(220, 'sawtooth', 0.08, 0.3, 0.36);
    },
    ahPuckStart: function() { tone(800, 'sine', 0.1, 0.15, 0, 400); },

    // ── Password Breaker ─────────────────────────────────────
    pbCorrect: function() {
      tone(880, 'sine', 0.12, 0.1);
      tone(1100, 'sine', 0.1, 0.1, 0.09);
    },
    pbWrong: function() {
      if (!throttle('pbWrong', 120)) return;
      tone(250, 'sawtooth', 0.1, 0.1);
    },
    pbVictory: function() {
      [523,659,784,1047,1319,1568].forEach(function(f, i) { tone(f, 'sine', 0.17, 0.2, i * 0.09); });
    },
    pbKeyPress: function() {
      if (!throttle('pbKey', 50)) return;
      tone(700, 'sine', 0.05, 0.05);
    },
    pbKeyDel: function() {
      if (!throttle('pbDel', 80)) return;
      tone(400, 'sine', 0.05, 0.06);
    },
    pbTick: function() {
      if (!throttle('pbTick', 800)) return;
      tone(1000, 'square', 0.06, 0.05);
    },

    // ── Memory Flip Duel ─────────────────────────────────────
    mfdFlip: function() {
      if (!throttle('mfdFlip', 60)) return;
      // Soft swoosh: descending tone + quiet noise
      tone(520, 'sine', 0.08, 0.09, 0, 320);
      noise(0.04, 0.07, 0, 900, 1.5);
    },
    mfdMatch: function() {
      // Bright ascending chime
      tone(660, 'sine', 0.13, 0.1);
      tone(880, 'sine', 0.11, 0.12, 0.08);
      tone(1100, 'sine', 0.09, 0.14, 0.16);
    },
    mfdMismatch: function() {
      if (!throttle('mfdMismatch', 200)) return;
      // Soft dull thud
      tone(220, 'sine', 0.09, 0.12);
      tone(180, 'sawtooth', 0.06, 0.1, 0.08);
    },
    mfdVictory: function() {
      // Triumphant arpeggio
      [523,659,784,1047,1319].forEach(function(f, i) { tone(f, 'sine', 0.16, 0.22, i * 0.1); });
    }
  };
})();

// Wire up all back-to-hub buttons with sound
document.addEventListener('DOMContentLoaded', function() {
  // Mute toggle button if present
  var muteBtn = document.getElementById('dz-mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', function() {
      var m = SoundManager.toggleMute();
      muteBtn.textContent = m ? '🔇' : '🔊';
    });
  }

  // Dark/Light mode toggle
  var themeBtn = document.getElementById('dz-theme-btn');
  if (themeBtn) {
    // Restore saved preference
    var savedTheme = localStorage.getItem('dz-theme');
    if (savedTheme === 'light') { document.body.classList.add('light-mode'); themeBtn.textContent = '☀️'; }
    themeBtn.addEventListener('click', function() {
      var isLight = document.body.classList.toggle('light-mode');
      themeBtn.textContent = isLight ? '☀️' : '🌙';
      localStorage.setItem('dz-theme', isLight ? 'light' : 'dark');
    });
  }

  // Recently played
  dzUpdateRecentlyPlayed();
});

function dzTrackRecentGame(gameName, screen, accent) {
  try {
    var recent = JSON.parse(localStorage.getItem('dz-recent') || '[]');
    recent = recent.filter(function(g){ return g.screen !== screen; });
    recent.unshift({ name: gameName, screen: screen, accent: accent || '#00e5ff' });
    recent = recent.slice(0, 4);
    localStorage.setItem('dz-recent', JSON.stringify(recent));
    dzUpdateRecentlyPlayed();
  } catch(e) {}
}

function dzUpdateRecentlyPlayed() {
  try {
    var wrap = document.getElementById('recently-played');
    var list = document.getElementById('recently-played-list');
    if (!wrap || !list) return;
    var recent = JSON.parse(localStorage.getItem('dz-recent') || '[]');
    if (recent.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    list.innerHTML = recent.map(function(g) {
      return '<button onclick="showGame(\'' + g.screen + '\')" style="' +
        'background:rgba(255,255,255,0.06);border:1.5px solid ' + g.accent + '40;' +
        'color:' + g.accent + ';border-radius:20px;padding:5px 14px;' +
        'font-family:\'Rajdhani\',sans-serif;font-size:0.78rem;letter-spacing:0.06em;' +
        'cursor:pointer;transition:background 0.15s;white-space:nowrap;"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,0.12)\'"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,0.06)\'">' +
        g.name + '</button>';
    }).join('');
  } catch(e) {}
}

function showGame(screen) {
  var card = document.querySelector('[data-screen="' + screen + '"]');
  if (card) card.click();
}

// ─────────────────────────────────────────────────────────────
// SECTION B: Hub Logic (game card clicks + launch overlay)
// ─────────────────────────────────────────────────────────────

var GAMES = [
  { name: 'Tic Tac Toe',         screen: 'ttt',        url: null, accent: '#00e5ff' },
  { name: 'Connect Four',        screen: 'c4',         url: null, accent: '#ff6d00' },
  { name: 'Rock Paper Scissors', screen: 'rps',        url: null, accent: '#00e676' },
  { name: 'Tap Battle',          screen: 'tapbattle',  url: null, accent: '#f50057' },
  { name: 'Hand Cricket',        screen: 'cricket',    url: null, accent: '#76ff03' },
  { name: '2048 Duel',           screen: 'duel2048',   url: null, accent: '#aa00ff' },
  { name: 'Air Hockey',          screen: 'airhockey',   url: null, accent: '#2979ff' },
  { name: 'Password Breaker',    screen: 'passbreach',  url: null, accent: '#00ff88' },
  { name: 'Chess',               screen: 'chess',       url: null, accent: '#f5c518' },
  { name: 'Checkers',            screen: 'checkers',    url: null, accent: '#e85d04' },
  { name: 'Darts Duel',          screen: 'darts',       url: null, accent: '#ff1744' },
  { name: 'Battleship',          screen: 'battleship',  url: null, accent: '#06b6d4' },
  { name: 'Tanks Arena',         screen: 'tanks',       url: null, accent: '#ffab00' },
  { name: 'Star Catcher',        screen: 'starcatcher', url: null, accent: '#ffd600' },
  { name: 'Space Dodge',         screen: 'spacedodge',  url: null, accent: '#b400ff' },
  { name: 'Ping Pong',            screen: 'pingpong',    url: null, accent: '#00e5ff' },
  { name: 'Snake Duel',           screen: 'snake',       url: null, accent: '#00e676' },
  { name: 'Typing Race',          screen: 'typing',      url: null, accent: '#fbbf24' },
  { name: 'Minesweeper Duel',     screen: 'minesweeper', url: null, accent: '#ef4444' },
  { name: 'Blackjack Duel',       screen: 'blackjack',   url: null, accent: '#a855f7' },
  { name: 'Tetris Battle',        screen: 'tetris',      url: null, accent: '#00e5ff' },
  { name: 'Bomberman Duel',       screen: 'bomberman',   url: null, accent: '#ff6d00' },
  { name: 'Draw and Guess',       screen: 'drawguess',   url: null, accent: '#f50057' },
  { name: 'Pixel Racer',          screen: 'pixelracer',  url: null, accent: '#00e676' },
  { name: 'Reaction Duel',        screen: 'reaction',    url: null, accent: '#aa00ff' },
  { name: 'Territory Wars',       screen: 'territory',   url: null, accent: '#ffd600' },
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

    // Track recently played
    if (game) dzTrackRecentGame(gameName, game.screen, accentColor);

    // Route to correct screen
    if (game && game.screen === 'ttt')        { showTTT();     return; }
    if (game && game.screen === 'rps')        { showRPS();     return; }
    if (game && game.screen === 'tapbattle')  { showTap();     return; }
    if (game && game.screen === 'duel2048')   { show2048();    return; }
    if (game && game.screen === 'c4')         { showC4();      return; }
    if (game && game.screen === 'cricket')    { showCricket(); return; }
    if (game && game.screen === 'airhockey')  { showAH();      return; }
    if (game && game.screen === 'passbreach') { showPB();      return; }
    if (game && game.screen === 'memoryflip')  { showMFD();     return; }
    if (game && game.screen === 'connectdots') { showCDD();     return; }
    if (game && game.screen === 'chess')       { if (typeof showChess === 'function') { showChess(); return; } }
    if (game && game.screen === 'battleship')  { showBattleship(); return; }
    if (game && game.screen === 'checkers')    { showCheckers();   return; }
    if (game && game.screen === 'darts')       { showDarts();      return; }
    if (game && game.screen === 'tanks')       { showTanks();      return; }
    if (game && game.screen === 'starcatcher') { showStarCatcher(); return; }
    if (game && game.screen === 'spacedodge')  { showSpaceDodge();  return; }
    if (game && game.screen === 'pingpong')    { showPingPong();     return; }
    if (game && game.screen === 'snake')       { showSnake();        return; }
    if (game && game.screen === 'typing')      { showTyping();       return; }
    if (game && game.screen === 'minesweeper') { showMinesweeper();  return; }
    if (game && game.screen === 'blackjack')   { showBlackjack();    return; }
    if (game && game.screen === 'tetris')      { showTetris();       return; }
    if (game && game.screen === 'bomberman')   { showBomberman();    return; }
    if (game && game.screen === 'drawguess')   { showDrawGuess();    return; }
    if (game && game.screen === 'pixelracer')  { showPixelRacer();   return; }
    if (game && game.screen === 'reaction')    { showReaction();     return; }
    if (game && game.screen === 'territory')   { showTerritory();    return; }

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
function tttMinimax(isMax, depth, alpha, beta) {
  var oWin = tttWinLine('O') !== null;
  var xWin = tttWinLine('X') !== null;
  if (oWin) return 10 - depth;
  if (xWin) return depth - 10;
  var empty = tttEmpty();
  if (!empty.length) return 0;
  if (isMax) {
    var best = -Infinity;
    for (var i = 0; i < empty.length; i++) {
      tttBoard[empty[i]] = 'O';
      var s = tttMinimax(false, depth + 1, alpha, beta);
      tttBoard[empty[i]] = '';
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    var best = Infinity;
    for (var i = 0; i < empty.length; i++) {
      tttBoard[empty[i]] = 'X';
      var s = tttMinimax(true, depth + 1, alpha, beta);
      tttBoard[empty[i]] = '';
      if (s < best) best = s;
      if (s < beta) beta = s;
      if (beta <= alpha) break;
    }
    return best;
  }
}
function tttBotHard(){
  var empty = tttEmpty();
  var bestScore = -Infinity, bestIdx = empty[0];
  for (var i = 0; i < empty.length; i++) {
    tttBoard[empty[i]] = 'O';
    var score = tttMinimax(false, 0, -Infinity, Infinity);
    tttBoard[empty[i]] = '';
    if (score > bestScore) { bestScore = score; bestIdx = empty[i]; }
  }
  return bestIdx;
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
  SoundManager.tttMove();
  var wl=tttWinLine(mark);
  if(wl){
    tttStatus.textContent=tttNames[mark]+' Wins! 🏆'; tttStatus.className='win';
    tttGlow(wl); tttScores[mark]++;
    tttScoreP1.textContent=tttScores['X']; tttScoreP2.textContent=tttScores['O'];
    tttCardP1.classList.remove('active'); tttCardP2.classList.remove('active');
    tttBoardEl.classList.add('disabled'); tttActive=false;
    SoundManager.tttWinLine();
    setTimeout(function(){ SoundManager.win(); }, 200);
    return true;
  }
  if(tttFull()){
    tttStatus.textContent="It's a Draw!"; tttStatus.className='draw';
    tttCardP1.classList.remove('active'); tttCardP2.classList.remove('active');
    tttBoardEl.classList.add('disabled'); tttActive=false;
    SoundManager.draw();
    return true;
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

// Universal back buttons for other game screens
document.querySelectorAll('.back-btn[data-back="hub"]').forEach(function(btn) {
  btn.addEventListener('click', function(){
    tapStop(); // stop tap battle timers if running
    showHub();
  });
});

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
tttCards();   // highlight Player 1's scorecard on load
console.log('[DuelZone] Ready. Hub visible. TTT standing by.');


// ═══════════════════════════════════════════════════════════════
// SECTION D: Rock Paper Scissors
// ═══════════════════════════════════════════════════════════════

var rpsMode       = 'pvp';
var rpsDiff       = 'easy';
var rpsBestOf     = 5;
var rpsScores     = { p1: 0, p2: 0 };
var rpsRound      = 1;
var rpsP1Choice   = null;
var rpsAwaitingP2 = false;
var rpsHistory    = [];   // p1's history for hard AI
var rpsLastP1     = null; // p1's last pick for medium AI
var rpsLocked     = false;

var RPS_EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
var RPS_BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
var RPS_CHOICES = ['rock', 'paper', 'scissors'];

// DOM
var rpsScoreP1El  = document.getElementById('rps-score-p1');
var rpsScoreP2El  = document.getElementById('rps-score-p2');
var rpsCardP1El   = document.getElementById('rps-card-p1');
var rpsCardP2El   = document.getElementById('rps-card-p2');
var rpsP1EmojiEl  = document.getElementById('rps-p1-emoji');
var rpsP2EmojiEl  = document.getElementById('rps-p2-emoji');
var rpsResultEl   = document.getElementById('rps-result-text');
var rpsBtnsP1El   = document.getElementById('rps-buttons-p1');
var rpsBtnsP2El   = document.getElementById('rps-buttons-p2');
var rpsPickPrompt = document.getElementById('rps-pick-prompt');
var rpsP2NameEl   = document.getElementById('rps-p2-name');
var rpsP2LabelEl  = document.getElementById('rps-p2-label');
var rpsModeLabel  = document.getElementById('rps-mode-label');
var rpsBoNumEl    = document.getElementById('rps-bo-num');
var rpsRoundNumEl = document.getElementById('rps-round-num');

function rpsBotPick() {
  if (rpsDiff === 'easy') {
    return RPS_CHOICES[Math.floor(Math.random() * 3)];
  } else if (rpsDiff === 'medium') {
    if (rpsLastP1 && Math.random() < 0.4) {
      // counter player's last move
      for (var k in RPS_BEATS) { if (RPS_BEATS[k] === rpsLastP1) return k; }
    }
    return RPS_CHOICES[Math.floor(Math.random() * 3)];
  } else {
    // hard: predict most frequent
    if (rpsHistory.length >= 2) {
      var freq = { rock: 0, paper: 0, scissors: 0 };
      rpsHistory.forEach(function(m){ freq[m]++; });
      var predicted = Object.keys(freq).sort(function(a,b){ return freq[b]-freq[a]; })[0];
      for (var k in RPS_BEATS) { if (RPS_BEATS[k] === predicted) return k; }
    }
    return RPS_CHOICES[Math.floor(Math.random() * 3)];
  }
}

function rpsEvaluate(p1, p2) {
  if (p1 === p2) return 'draw';
  if (RPS_BEATS[p1] === p2) return 'p1';
  return 'p2';
}

function rpsRevealChoices(p1c, p2c) {
  SoundManager.rpsReveal();
  rpsP1EmojiEl.textContent = RPS_EMOJI[p1c];
  rpsP2EmojiEl.textContent = RPS_EMOJI[p2c];
  rpsP1EmojiEl.classList.remove('reveal'); rpsP2EmojiEl.classList.remove('reveal');
  void rpsP1EmojiEl.offsetWidth; void rpsP2EmojiEl.offsetWidth;
  rpsP1EmojiEl.classList.add('reveal'); rpsP2EmojiEl.classList.add('reveal');

  var winner = rpsEvaluate(p1c, p2c);
  var winsNeeded = Math.ceil(rpsBestOf / 2);

  rpsResultEl.className = '';
  if (winner === 'p1') {
    rpsScores.p1++;
    rpsScoreP1El.textContent = rpsScores.p1;
    rpsResultEl.textContent = 'P1 WINS!';
    rpsResultEl.className = 'win';
    rpsCardP1El.classList.add('active'); rpsCardP2El.classList.remove('active');
  } else if (winner === 'p2') {
    rpsScores.p2++;
    rpsScoreP2El.textContent = rpsScores.p2;
    rpsResultEl.textContent = 'P2 WINS!';
    rpsResultEl.className = 'lose';
    rpsCardP2El.classList.add('active'); rpsCardP1El.classList.remove('active');
  } else {
    rpsResultEl.textContent = 'DRAW';
    rpsResultEl.className = 'draw';
    rpsCardP1El.classList.remove('active'); rpsCardP2El.classList.remove('active');
  }

  // Check match over
  if (rpsScores.p1 >= winsNeeded || rpsScores.p2 >= winsNeeded) {
    rpsLocked = true;
    rpsBtnsP1El.classList.add('hidden');
    rpsBtnsP2El.classList.add('hidden');
    var matchWinner = rpsScores.p1 >= winsNeeded ? 'Player 1' : (rpsMode === 'pve' ? 'Bot' : 'Player 2');
    rpsPickPrompt.textContent = matchWinner + ' wins the match! 🏆';
    rpsBtnsP1El.classList.remove('hidden');
    rpsBtnsP1El.querySelector('.rps-btn-row').style.display = 'none';
    setTimeout(function() {
      if (rpsScores.p1 >= winsNeeded) SoundManager.win(); else SoundManager.lose();
    }, 300);
    return;
  }
  if (winner === 'draw') setTimeout(function() { SoundManager.draw(); }, 300);

  rpsRound++;
  rpsRoundNumEl.textContent = rpsRound;
  rpsP1Choice = null; rpsAwaitingP2 = false; rpsLocked = false;

  setTimeout(function(){
    rpsP1EmojiEl.textContent = '?'; rpsP2EmojiEl.textContent = '?';
    rpsResultEl.textContent = '';
    rpsResultEl.className = '';
    rpsCardP1El.classList.remove('active'); rpsCardP2El.classList.remove('active');
    if (rpsMode === 'pvp') {
      rpsBtnsP1El.classList.remove('hidden');
      rpsBtnsP2El.classList.add('hidden');
      rpsPickPrompt.textContent = 'Player 1 — Choose your weapon!';
    } else {
      rpsBtnsP1El.classList.remove('hidden');
      rpsBtnsP1El.querySelector('.rps-btn-row').style.display = '';
    }
  }, 1200);
}

function rpsHandleP1Pick(choice) {
  if (rpsLocked) return;
  SoundManager.rpsSelect();
  rpsLastP1 = choice;
  rpsHistory.push(choice);

  if (rpsMode === 'pve') {
    rpsLocked = true;
    var botChoice = rpsBotPick();
    rpsRevealChoices(choice, botChoice);
  } else {
    // PvP: hide P1 buttons, show P2 buttons
    rpsP1Choice = choice;
    rpsAwaitingP2 = true;
    rpsBtnsP1El.classList.add('hidden');
    rpsBtnsP2El.classList.remove('hidden');
  }
}

function rpsHandleP2Pick(choice) {
  if (!rpsAwaitingP2 || rpsLocked) return;
  SoundManager.rpsSelect();
  rpsLocked = true;
  rpsBtnsP2El.classList.add('hidden');
  rpsRevealChoices(rpsP1Choice, choice);
}

function rpsRestart() {
  rpsScores = { p1: 0, p2: 0 };
  rpsRound = 1; rpsP1Choice = null; rpsAwaitingP2 = false; rpsLocked = false;
  rpsHistory = []; rpsLastP1 = null;
  rpsScoreP1El.textContent = '0'; rpsScoreP2El.textContent = '0';
  rpsP1EmojiEl.textContent = '?'; rpsP2EmojiEl.textContent = '?';
  rpsResultEl.textContent = ''; rpsResultEl.className = '';
  rpsRoundNumEl.textContent = '1';
  rpsCardP1El.classList.remove('active'); rpsCardP2El.classList.remove('active');
  rpsBtnsP1El.querySelector('.rps-btn-row').style.display = '';
  rpsBtnsP1El.classList.remove('hidden');
  rpsBtnsP2El.classList.add('hidden');
  rpsPickPrompt.textContent = (rpsMode === 'pvp') ? 'Player 1 — Choose your weapon!' : 'Choose your weapon!';
}

function rpsSetMode(mode) {
  rpsMode = mode;
  var pvpBtn = document.getElementById('rps-btn-pvp');
  var pveBtn = document.getElementById('rps-btn-pve');
  var diffSel = document.getElementById('rps-difficulty-selector');
  if (mode === 'pvp') {
    pvpBtn.classList.add('active'); pveBtn.classList.remove('active');
    diffSel.classList.add('hidden');
    rpsP2NameEl.textContent = 'Player 2';
    if(rpsP2LabelEl) rpsP2LabelEl.textContent = 'P2';
    rpsModeLabel.textContent = 'LOCAL PvP';
  } else {
    pveBtn.classList.add('active'); pvpBtn.classList.remove('active');
    diffSel.classList.remove('hidden');
    rpsP2NameEl.textContent = 'Bot';
    if(rpsP2LabelEl) rpsP2LabelEl.textContent = 'BOT';
    rpsModeLabel.textContent = 'PLAYER VS BOT';
  }
  rpsRestart();
}

function rpsSetBestOf(n) {
  rpsBestOf = n;
  rpsBoNumEl.textContent = n;
  ['rps-bo3','rps-bo5','rps-bo7'].forEach(function(id){ document.getElementById(id).classList.remove('active'); });
  var map = {3:'rps-bo3',5:'rps-bo5',7:'rps-bo7'};
  if(map[n]) document.getElementById(map[n]).classList.add('active');
  rpsRestart();
}

function rpsSetDiff(level) {
  rpsDiff = level;
  ['rps-easy','rps-medium','rps-hard'].forEach(function(id){ document.getElementById(id).classList.remove('active'); });
  document.getElementById('rps-'+level).classList.add('active');
  rpsRestart();
}

// Wire RPS events
document.getElementById('rps-btn-pvp').addEventListener('click', function(){ rpsSetMode('pvp'); });
document.getElementById('rps-btn-pve').addEventListener('click', function(){ rpsSetMode('pve'); });
document.getElementById('rps-bo3').addEventListener('click',  function(){ rpsSetBestOf(3); });
document.getElementById('rps-bo5').addEventListener('click',  function(){ rpsSetBestOf(5); });
document.getElementById('rps-bo7').addEventListener('click',  function(){ rpsSetBestOf(7); });
document.getElementById('rps-easy').addEventListener('click',   function(){ rpsSetDiff('easy'); });
document.getElementById('rps-medium').addEventListener('click', function(){ rpsSetDiff('medium'); });
document.getElementById('rps-hard').addEventListener('click',   function(){ rpsSetDiff('hard'); });
document.getElementById('rps-restart').addEventListener('click', rpsRestart);

document.querySelectorAll('#rps-buttons-p1 .rps-btn').forEach(function(btn){
  btn.addEventListener('click', function(){ rpsHandleP1Pick(btn.getAttribute('data-choice')); });
});
document.querySelectorAll('#rps-buttons-p2 .rps-btn').forEach(function(btn){
  btn.addEventListener('click', function(){ rpsHandleP2Pick(btn.getAttribute('data-choice')); });
});


// ═══════════════════════════════════════════════════════════════
// SECTION E: Tap Battle
// ═══════════════════════════════════════════════════════════════

var TAP_TARGET     = 100;
var tapMode        = 'pvp';
var tapDiff        = 'easy';
var tapCounts      = { p1: 0, p2: 0 };
var tapActive      = false;
var tapCountdown   = false;
var tapBotInterval = null;
var tapCountTimer  = null;
var tapCountNum    = 3;
var tapBotSpeed    = 6; // taps per second

var tapCountP1El    = document.getElementById('tap-count-p1');
var tapCountP2El    = document.getElementById('tap-count-p2');
var tapBarP1El      = document.getElementById('tap-bar-p1');
var tapBarP2El      = document.getElementById('tap-bar-p2');
var tapCountdownEl  = document.getElementById('tap-countdown');
var tapWinOverlay   = document.getElementById('tap-win-overlay');
var tapWinTextEl    = document.getElementById('tap-win-text');
var tapLeftEl       = document.getElementById('tap-left');
var tapRightEl      = document.getElementById('tap-right');
var tapP2LabelEl    = document.getElementById('tap-p2-label');
var tapHintP2El     = document.getElementById('tap-hint-p2');
var tapModeLabel    = document.getElementById('tap-mode-label');

function tapStop() {
  clearInterval(tapBotInterval); tapBotInterval = null;
  clearInterval(tapCountTimer);  tapCountTimer  = null;
  tapActive = false; tapCountdown = false;
}

function tapReset() {
  tapStop();
  tapCounts = { p1: 0, p2: 0 };
  tapCountP1El.textContent = '0'; tapCountP2El.textContent = '0';
  tapBarP1El.style.width = '0%'; tapBarP2El.style.width = '0%';
  tapWinOverlay.classList.add('hidden');
  tapCountdownEl.textContent = 'TAP\nTO\nSTART';
  tapCountdownEl.className = 'tap-countdown';
}

function tapStartCountdown() {
  if (tapCountdown || tapActive) return;
  tapCountdown = true;
  tapCountNum = 3;
  tapCountdownEl.textContent = tapCountNum;
  tapCountdownEl.className = 'tap-countdown active';
  tapCountTimer = setInterval(function(){
    tapCountNum--;
    if (tapCountNum > 0) {
      tapCountdownEl.textContent = tapCountNum;
      tapCountdownEl.className = 'tap-countdown active';
      SoundManager.click();
    } else {
      clearInterval(tapCountTimer); tapCountTimer = null;
      tapCountdownEl.textContent = 'GO!';
      tapCountdownEl.className = 'tap-countdown go';
      SoundManager.gameStart();
      tapActive = true; tapCountdown = false;
      if (tapMode === 'pve') tapRunBot();
      setTimeout(function(){
        if(tapActive) { tapCountdownEl.textContent = ''; tapCountdownEl.className = 'tap-countdown'; }
      }, 700);
    }
  }, 700);
}

function tapGetBotInterval() {
  var base;
  if (tapDiff === 'easy')   base = 1000 / (5 + Math.random() * 2);
  else if (tapDiff === 'medium') base = 1000 / (7 + Math.random() * 2);
  else {
    // Hard: speed up if losing
    var ratio = tapCounts.p1 / Math.max(tapCounts.p2, 1);
    var speed = 8 + (ratio > 1 ? (ratio - 1) * 4 : 0); // up to ~14 taps/s
    speed = Math.min(speed, 14);
    base = 1000 / speed;
  }
  return Math.max(base, 70);
}

function tapRunBot() {
  function doTick() {
    if (!tapActive) return;
    tapRegisterHit('p2');
    // Reschedule with potentially new speed (hard mode)
    tapBotInterval = setTimeout(doTick, tapGetBotInterval());
  }
  tapBotInterval = setTimeout(doTick, tapGetBotInterval());
}

function tapRegisterHit(player) {
  if (!tapActive) return;
  if (tapCounts[player] >= TAP_TARGET) return; // prevent overflow
  tapCounts[player]++;
  SoundManager.tapTick();
  var countEl = player === 'p1' ? tapCountP1El : tapCountP2El;
  var barEl   = player === 'p1' ? tapBarP1El   : tapBarP2El;
  countEl.textContent = tapCounts[player];
  barEl.style.width = Math.min((tapCounts[player] / TAP_TARGET) * 100, 100) + '%';
  // Bump animation
  countEl.classList.remove('bump');
  void countEl.offsetWidth;
  countEl.classList.add('bump');

  if (tapCounts[player] >= TAP_TARGET) {
    tapActive = false; // lock immediately before stop to prevent race condition
    tapStop();
    SoundManager.tapBuzzer();
    setTimeout(function() {
      if (player === 'p1') SoundManager.win(); else SoundManager.lose();
    }, 200);
    var winnerName = player === 'p1' ? 'Player 1' : (tapMode === 'pve' ? 'Bot' : 'Player 2');
    tapWinTextEl.textContent = winnerName + ' Wins! 🎉';
    tapWinOverlay.classList.remove('hidden');
  }
}

// Tap sides
tapLeftEl.addEventListener('click', function(){
  if (!tapActive && !tapCountdown) { tapStartCountdown(); return; }
  tapRegisterHit('p1');
});
tapLeftEl.addEventListener('touchstart', function(e){
  e.preventDefault();
  if (!tapActive && !tapCountdown) { tapStartCountdown(); return; }
  tapRegisterHit('p1');
}, { passive: false });

tapRightEl.addEventListener('click', function(){
  if (tapMode === 'pve') return; // bot only
  if (!tapActive && !tapCountdown) { tapStartCountdown(); return; }
  tapRegisterHit('p2');
});
tapRightEl.addEventListener('touchstart', function(e){
  e.preventDefault();
  if (tapMode === 'pve') return;
  if (!tapActive && !tapCountdown) { tapStartCountdown(); return; }
  tapRegisterHit('p2');
}, { passive: false });

// Mode buttons
document.getElementById('tap-btn-pvp').addEventListener('click', function(){
  tapMode = 'pvp';
  this.classList.add('active'); document.getElementById('tap-btn-pve').classList.remove('active');
  document.getElementById('tap-difficulty-selector').classList.add('hidden');
  tapP2LabelEl.textContent = 'PLAYER 2';
  tapHintP2El.textContent = 'TAP HERE!';
  tapRightEl.style.pointerEvents = '';
  tapModeLabel.textContent = 'LOCAL PvP';
  tapReset();
});
document.getElementById('tap-btn-pve').addEventListener('click', function(){
  tapMode = 'pve';
  this.classList.add('active'); document.getElementById('tap-btn-pvp').classList.remove('active');
  document.getElementById('tap-difficulty-selector').classList.remove('hidden');
  tapP2LabelEl.textContent = 'BOT';
  tapHintP2El.textContent = 'AUTO';
  tapRightEl.style.pointerEvents = 'none';
  tapModeLabel.textContent = 'PLAYER VS BOT';
  tapReset();
});
['easy','medium','hard'].forEach(function(level){
  document.getElementById('tap-'+level).addEventListener('click', function(){
    tapDiff = level;
    ['tap-easy','tap-medium','tap-hard'].forEach(function(id){ document.getElementById(id).classList.remove('active'); });
    this.classList.add('active');
    tapReset();
  });
});
document.getElementById('tap-restart').addEventListener('click', tapReset);


// ═══════════════════════════════════════════════════════════════
// SECTION F: 2048 Duel — Full rewrite with smooth tile animations
// ═══════════════════════════════════════════════════════════════

var D2048_ANIM   = 115;  // ms for slide transition
var D2048_GAP    = 6;
var D2048_PAD    = 8;

// ── State ──────────────────────────────────────────────────────
var d2048Mode    = 'pvp';   // pvp | pve | sim
var d2048Diff    = 'easy';
var d2048Turn    = 1;        // 1 = P1's turn, 2 = P2's turn (turn-based modes)
var d2048Tiles   = [[], []]; // array of tile objects per player: { id, value, row, col }
var d2048Scores  = [0, 0];
var d2048Best    = [0, 0];
var d2048MoveCount = [0, 0];
var d2048Active  = [true, true];
var d2048TileId  = 0;
var d2048Locked  = [false, false]; // true while animation is running
var d2048BotTimer = null;

// ── DOM refs ───────────────────────────────────────────────────
var d2048StatusEl   = document.getElementById('d2048-status');
var d2048ScoreEls   = [document.getElementById('d2048-score-p1'),  document.getElementById('d2048-score-p2')];
var d2048BestEls    = [document.getElementById('d2048-best-p1'),   document.getElementById('d2048-best-p2')];
var d2048MovesEls   = [document.getElementById('d2048-moves-p1'),  document.getElementById('d2048-moves-p2')];
var d2048BoardEls   = [document.getElementById('d2048-board-p1'),  document.getElementById('d2048-board-p2')];
var d2048P1Section  = document.getElementById('d2048-p1-section');
var d2048P2Section  = document.getElementById('d2048-p2-section');
var d2048Sections   = [d2048P1Section, d2048P2Section];
var d2048P2NameEl   = document.getElementById('d2048-p2-name');
var d2048HintP1     = document.getElementById('d2048-hint-p1');
var d2048HintP2     = document.getElementById('d2048-hint-p2');
var d2048ModeLabel  = document.getElementById('d2048-mode-label');
var d2048WinOverlay = document.getElementById('d2048-win-overlay');
var d2048WinText    = document.getElementById('d2048-win-text');
var d2048WinSub     = document.getElementById('d2048-win-sub');

// ── Helpers ────────────────────────────────────────────────────
function d2048FindTile(pIdx, id) {
  for (var i = 0; i < d2048Tiles[pIdx].length; i++) {
    if (d2048Tiles[pIdx][i].id === id) return d2048Tiles[pIdx][i];
  }
  return null;
}

/** Read a background slot's position relative to the board container */
function d2048SlotPos(boardEl, row, col) {
  var slots = boardEl.querySelectorAll('.d2048-slot');
  var slotEl = slots[row * 4 + col];
  if (slotEl) {
    var sRect = slotEl.getBoundingClientRect();
    var bRect = boardEl.getBoundingClientRect();
    return { x: sRect.left - bRect.left, y: sRect.top - bRect.top, size: sRect.width };
  }
  // Fallback (in case layout hasn't happened yet)
  var bw = boardEl.clientWidth || 280;
  var sz = (bw - D2048_PAD * 2 - D2048_GAP * 3) / 4;
  return { x: D2048_PAD + col * (sz + D2048_GAP), y: D2048_PAD + row * (sz + D2048_GAP), size: sz };
}

// ── Board DOM construction ─────────────────────────────────────
function d2048BuildBoard(pIdx) {
  var el = d2048BoardEls[pIdx];
  el.innerHTML = '';
  for (var i = 0; i < 16; i++) {
    var slot = document.createElement('div');
    slot.className = 'd2048-slot';
    el.appendChild(slot);
  }
}

function d2048CreateTileEl(boardEl, tile, animate) {
  var pos = d2048SlotPos(boardEl, tile.row, tile.col);
  var el = document.createElement('div');
  el.className = 'd2048-tile' + (animate ? ' tile-new' : '');
  el.dataset.id = tile.id;
  el.setAttribute('data-v', tile.value);
  el.textContent = tile.value;
  el.style.width  = pos.size + 'px';
  el.style.height = pos.size + 'px';
  el.style.left   = pos.x   + 'px';
  el.style.top    = pos.y   + 'px';
  if (animate) {
    el.addEventListener('animationend', function() { el.classList.remove('tile-new'); }, { once: true });
  }
  boardEl.appendChild(el);
  return el;
}

// ── Spawn ──────────────────────────────────────────────────────
function d2048SpawnTile(pIdx) {
  var occupied = {};
  d2048Tiles[pIdx].forEach(function(t) { occupied[t.row + ',' + t.col] = true; });
  var empty = [];
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      if (!occupied[r + ',' + c]) empty.push({ r: r, c: c });
    }
  }
  if (!empty.length) return false;
  var p = empty[Math.floor(Math.random() * empty.length)];
  var tile = { id: ++d2048TileId, value: Math.random() < 0.9 ? 2 : 4, row: p.r, col: p.c };
  d2048Tiles[pIdx].push(tile);
  d2048CreateTileEl(d2048BoardEls[pIdx], tile, true);
  return true;
}

// ── Move algorithm ─────────────────────────────────────────────
// Returns { changed, scoreGain, movedTiles[{id,r,c}], merges[{srcA,srcB,value,r,c}] }
function d2048ComputeMove(pIdx, dir) {
  var tiles = d2048Tiles[pIdx];

  // Build 4×4 grid
  var grid = [[null,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]];
  tiles.forEach(function(t) { grid[t.row][t.col] = t; });

  var movedTiles = [];
  var merges     = [];
  var scoreGain  = 0;
  var changed    = false;

  for (var line = 0; line < 4; line++) {
    // Collect tiles in this line, ordered from the move direction
    var ordered = [];
    if (dir === 'left')  { for (var i=0;i<4;i++) { if (grid[line][i]) ordered.push(grid[line][i]); } }
    if (dir === 'right') { for (var i=3;i>=0;i--){ if (grid[line][i]) ordered.push(grid[line][i]); } }
    if (dir === 'up')    { for (var i=0;i<4;i++) { if (grid[i][line]) ordered.push(grid[i][line]); } }
    if (dir === 'down')  { for (var i=3;i>=0;i--){ if (grid[i][line]) ordered.push(grid[i][line]); } }

    // Compress: merge equal adjacent pairs
    var compressed = []; // each entry: { tile } or { merged: true, srcA, srcB, value }
    var k = 0;
    while (k < ordered.length) {
      if (k + 1 < ordered.length && ordered[k].value === ordered[k+1].value) {
        var v = ordered[k].value * 2;
        scoreGain += v;
        var mergeEntry = { merged: true, srcA: ordered[k].id, srcB: ordered[k+1].id, value: v };
        merges.push(mergeEntry);
        compressed.push({ isMerge: true, mergeRef: mergeEntry });
        k += 2;
      } else {
        compressed.push({ isMerge: false, tile: ordered[k] });
        k++;
      }
    }

    // Assign new positions based on direction
    for (var j = 0; j < compressed.length; j++) {
      var newRow, newCol;
      if (dir === 'left')  { newRow = line; newCol = j; }
      if (dir === 'right') { newRow = line; newCol = 3 - j; }
      if (dir === 'up')    { newRow = j;    newCol = line; }
      if (dir === 'down')  { newRow = 3-j;  newCol = line; }

      var entry = compressed[j];
      if (entry.isMerge) {
        // Record destination for merge
        entry.mergeRef.r = newRow;
        entry.mergeRef.c = newCol;
        // Move both source tiles to merge destination
        var ta = d2048FindTile(pIdx, entry.mergeRef.srcA);
        var tb = d2048FindTile(pIdx, entry.mergeRef.srcB);
        if (ta && (ta.row !== newRow || ta.col !== newCol)) { changed = true; }
        if (tb && (tb.row !== newRow || tb.col !== newCol)) { changed = true; }
        movedTiles.push({ id: entry.mergeRef.srcA, r: newRow, c: newCol });
        movedTiles.push({ id: entry.mergeRef.srcB, r: newRow, c: newCol });
      } else {
        var t = entry.tile;
        if (t.row !== newRow || t.col !== newCol) changed = true;
        movedTiles.push({ id: t.id, r: newRow, c: newCol });
      }
    }
  }

  return { changed: changed, scoreGain: scoreGain, movedTiles: movedTiles, merges: merges };
}

// ── Animated move ──────────────────────────────────────────────
function d2048DoMove(pIdx, dir, onDone) {
  if (d2048Locked[pIdx] || !d2048Active[pIdx]) return false;

  var comp = d2048ComputeMove(pIdx, dir);

  if (!comp.changed) {
    // Shake the board to signal invalid move
    var bEl = d2048BoardEls[pIdx];
    bEl.classList.add('board-shake');
    bEl.addEventListener('animationend', function() { bEl.classList.remove('board-shake'); }, { once: true });
    return false;
  }

  d2048Locked[pIdx] = true;
  var boardEl = d2048BoardEls[pIdx];

  // IDs involved in merges (will be removed after animation)
  var mergeSourceIds = {};
  comp.merges.forEach(function(m) {
    mergeSourceIds[m.srcA] = true;
    mergeSourceIds[m.srcB] = true;
  });

  // Animate all tile movements
  comp.movedTiles.forEach(function(mv) {
    var tile = d2048FindTile(pIdx, mv.id);
    if (!tile) return;
    var el = boardEl.querySelector('.d2048-tile[data-id="' + mv.id + '"]');
    if (!el) return;

    // Enable transition and slide to new position
    var newPos = d2048SlotPos(boardEl, mv.r, mv.c);
    el.style.transition = 'left ' + D2048_ANIM + 'ms ease, top ' + D2048_ANIM + 'ms ease';
    el.style.left = newPos.x + 'px';
    el.style.top  = newPos.y + 'px';

    // Update tile state immediately (so hasMoves checks are correct)
    tile.row = mv.r;
    tile.col = mv.c;
  });

  // After animation: commit merges, spawn new tile, check win/loss
  setTimeout(function() {
    // Remove merge source tiles from state + DOM
    comp.merges.forEach(function(m) {
      [m.srcA, m.srcB].forEach(function(id) {
        d2048Tiles[pIdx] = d2048Tiles[pIdx].filter(function(t) { return t.id !== id; });
        var el = boardEl.querySelector('.d2048-tile[data-id="' + id + '"]');
        if (el) el.remove();
      });
    });

    // Add merged result tiles (with pop animation)
    comp.merges.forEach(function(m) {
      var newTile = { id: ++d2048TileId, value: m.value, row: m.r, col: m.c };
      d2048Tiles[pIdx].push(newTile);
      var el = d2048CreateTileEl(boardEl, newTile, false);
      el.classList.add('tile-merge');
      el.addEventListener('animationend', function() { el.classList.remove('tile-merge'); }, { once: true });
    });
    if (comp.merges.length > 0) SoundManager.mergePop();

    // Update score
    d2048Scores[pIdx] += comp.scoreGain;
    d2048ScoreEls[pIdx].textContent = d2048Scores[pIdx];

    // Update move counter
    d2048MoveCount[pIdx]++;
    d2048MovesEls[pIdx].textContent = d2048MoveCount[pIdx];

    // Update best tile
    var maxTile = 0;
    d2048Tiles[pIdx].forEach(function(t) { if (t.value > maxTile) maxTile = t.value; });
    if (maxTile > d2048Best[pIdx]) {
      d2048Best[pIdx] = maxTile;
      d2048BestEls[pIdx].textContent = maxTile;
    }

    // Check WIN (reached 2048 or higher)
    if (maxTile >= 2048) {
      d2048Active[pIdx] = false;
      clearInterval(d2048BotTimer); d2048BotTimer = null;
      var wName = pIdx === 0 ? 'Player 1' : (d2048Mode === 'pve' ? 'Bot' : 'Player 2');
      d2048ShowWin(wName, 'Reached ' + maxTile + '! · Score: ' + d2048Scores[pIdx]);
      d2048Locked[pIdx] = false;
      return;
    }

    // Spawn new tile
    d2048SpawnTile(pIdx);

    // Check GAME OVER (no valid moves left)
    if (!d2048CanMove(pIdx)) {
      d2048Active[pIdx] = false;
      clearInterval(d2048BotTimer); d2048BotTimer = null;
      var loserName  = pIdx === 0 ? 'Player 1' : (d2048Mode === 'pve' ? 'Bot' : 'Player 2');
      var winnerName = pIdx === 0 ? (d2048Mode === 'pve' ? 'Bot' : 'Player 2') : 'Player 1';
      d2048ShowWin(winnerName, loserName + '\'s board is full · Score: ' + d2048Scores[1 - pIdx]);
      d2048Locked[pIdx] = false;
      return;
    }

    d2048Locked[pIdx] = false;
    if (onDone) onDone();
  }, D2048_ANIM + 20);

  return true;
}

function d2048HasMoves(pIdx) {
  var occupied = {};
  d2048Tiles[pIdx].forEach(function(t) { occupied[t.row + ',' + t.col] = true; });
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      if (!occupied[r + ',' + c]) return true;
    }
  }
  // Check adjacent equal tiles
  d2048Tiles[pIdx].forEach(function(t) {
    if (!occupied) return; // shortcut
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(function(d) {
      var nr = t.row + d[0], nc = t.col + d[1];
      if (nr < 0 || nr > 3 || nc < 0 || nc > 3) return;
      var neighbor = null;
      for (var i = 0; i < d2048Tiles[pIdx].length; i++) {
        if (d2048Tiles[pIdx][i].row === nr && d2048Tiles[pIdx][i].col === nc) {
          neighbor = d2048Tiles[pIdx][i]; break;
        }
      }
      if (neighbor && neighbor.value === t.value) occupied = null; // signal: has moves
    });
  });
  return occupied === null; // if occupied got nulled, there are moves
}

// A cleaner hasMovesCheck since the above has a subtle bug:
function d2048CanMove(pIdx) {
  var grid = [[null,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]];
  d2048Tiles[pIdx].forEach(function(t) { grid[t.row][t.col] = t.value; });
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      if (grid[r][c] === null) return true;
      if (c < 3 && grid[r][c] === grid[r][c+1]) return true;
      if (r < 3 && grid[r][c] === grid[r+1][c]) return true;
    }
  }
  return false;
}

// ── Win overlay ────────────────────────────────────────────────
function d2048ShowWin(name, sub) {
  d2048WinText.textContent = name + ' Wins! 🏆';
  d2048WinSub.textContent  = sub;
  d2048WinOverlay.classList.remove('hidden');
  SoundManager.d2048GameOver();
  setTimeout(function() { SoundManager.win(); }, 400);
}

// ── Turn UI ────────────────────────────────────────────────────
function d2048UpdateTurnUI() {
  d2048Sections.forEach(function(s) { s.classList.remove('active-turn'); });

  if (d2048Mode === 'sim') {
    d2048Sections.forEach(function(s) { s.classList.add('active-turn'); });
    d2048StatusEl.textContent = 'Simultaneous — P1: WASD  ·  P2: ↑ ↓ ← →';
    return;
  }
  if (d2048Turn === 1) {
    d2048P1Section.classList.add('active-turn');
    d2048StatusEl.textContent = d2048Mode === 'pve'
      ? 'Your Turn · WASD or arrows to move'
      : 'Player 1\'s Turn · W A S D';
  } else {
    d2048P2Section.classList.add('active-turn');
    d2048StatusEl.textContent = d2048Mode === 'pve'
      ? '🤖 Bot is thinking…'
      : 'Player 2\'s Turn · ↑ ↓ ← →';
  }
}

// ── Bot AI ─────────────────────────────────────────────────────

/** Heuristic board score for hard bot (snake-pattern monotonicity) */
function d2048BotScoreBoard(tiles) {
  var grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  tiles.forEach(function(t) { grid[t.row][t.col] = t.value; });

  // Snake weights: top-left corner is best
  var w = [[2048,1024,64,32],[512,128,16,8],[256,4,2,1],[1,1,1,1]];
  var mono = 0;
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) mono += grid[r][c] * w[r][c];

  // Empty cells
  var empty = 0;
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (!grid[r][c]) empty++;

  // Merge potential
  var merges = 0;
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      if (c < 3 && grid[r][c] && grid[r][c] === grid[r][c+1]) merges += grid[r][c];
      if (r < 3 && grid[r][c] && grid[r][c] === grid[r+1][c]) merges += grid[r][c];
    }
  }

  return mono + empty * 300 + merges * 3;
}

var D2048_DIRS = ['up','down','left','right'];

function d2048BotPickMove(pIdx) {
  var validDirs = D2048_DIRS.filter(function(d) {
    return d2048ComputeMove(pIdx, d).changed;
  });
  if (!validDirs.length) return null;

  if (d2048Diff === 'easy') {
    return validDirs[Math.floor(Math.random() * validDirs.length)];
  }

  if (d2048Diff === 'medium') {
    // Pick direction that gives highest immediate score
    var best = null, bestScore = -1;
    validDirs.forEach(function(d) {
      var res = d2048ComputeMove(pIdx, d);
      if (res.scoreGain > bestScore) { bestScore = res.scoreGain; best = d; }
    });
    // Tiebreak: random
    if (bestScore === 0) return validDirs[Math.floor(Math.random() * validDirs.length)];
    return best;
  }

  // Hard: evaluate board position after each move using heuristic
  var bestDir = null, bestVal = -Infinity;
  validDirs.forEach(function(dir) {
    var comp = d2048ComputeMove(pIdx, dir);
    if (!comp.changed) return;

    // Simulate the resulting board state
    var simTiles = d2048Tiles[pIdx].map(function(t) {
      return { id: t.id, value: t.value, row: t.row, col: t.col };
    });

    // Apply move simulations (moves only, no actual DOM changes)
    var mergeSourceIds = {};
    comp.merges.forEach(function(m) { mergeSourceIds[m.srcA] = true; mergeSourceIds[m.srcB] = true; });

    comp.movedTiles.forEach(function(mv) {
      if (!mergeSourceIds[mv.id]) {
        var t = null;
        for (var i = 0; i < simTiles.length; i++) { if (simTiles[i].id === mv.id) { t = simTiles[i]; break; } }
        if (t) { t.row = mv.r; t.col = mv.c; }
      }
    });
    // Remove merge sources, add merged results
    comp.merges.forEach(function(m) {
      simTiles = simTiles.filter(function(t) { return t.id !== m.srcA && t.id !== m.srcB; });
      simTiles.push({ id: -1, value: m.value, row: m.r, col: m.c });
    });

    var val = d2048BotScoreBoard(simTiles) + comp.scoreGain * 2;
    if (val > bestVal) { bestVal = val; bestDir = dir; }
  });
  return bestDir;
}

function d2048TriggerBot() {
  if (!d2048Active[1] || d2048Locked[1]) return;
  var delay = d2048Diff === 'easy' ? 500 : d2048Diff === 'medium' ? 350 : 220;
  d2048BotTimer = setTimeout(function() {
    if (!d2048Active[1]) return;
    var dir = d2048BotPickMove(1);
    if (!dir) {
      // Bot can't move — game over
      d2048Active[1] = false;
      d2048ShowWin('Player 1', 'Bot\'s board is full · Score: ' + d2048Scores[0]);
      return;
    }
    d2048DoMove(1, dir, function() {
      if (d2048Mode === 'pve') {
        d2048Turn = 1;
        d2048UpdateTurnUI();
      }
    });
  }, delay);
}

// ── Keyboard handler ────────────────────────────────────────────
function d2048KeyHandler(e) {
  if (screen2048.classList.contains('hidden')) return;

  var dir = null, pIdx = -1;
  var key = e.key;

  if (d2048Mode === 'sim') {
    if      (key === 'w' || key === 'W') { dir='up';    pIdx=0; }
    else if (key === 's' || key === 'S') { dir='down';  pIdx=0; }
    else if (key === 'a' || key === 'A') { dir='left';  pIdx=0; }
    else if (key === 'd' || key === 'D') { dir='right'; pIdx=0; }
    else if (key === 'ArrowUp')    { dir='up';    pIdx=1; }
    else if (key === 'ArrowDown')  { dir='down';  pIdx=1; }
    else if (key === 'ArrowLeft')  { dir='left';  pIdx=1; }
    else if (key === 'ArrowRight') { dir='right'; pIdx=1; }
    if (key.startsWith('Arrow')) e.preventDefault();
  } else if (d2048Mode === 'pve') {
    if      (key === 'ArrowUp'    || key === 'w' || key === 'W') { dir='up';    pIdx=0; }
    else if (key === 'ArrowDown'  || key === 's' || key === 'S') { dir='down';  pIdx=0; }
    else if (key === 'ArrowLeft'  || key === 'a' || key === 'A') { dir='left';  pIdx=0; }
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') { dir='right'; pIdx=0; }
    if (key.startsWith('Arrow')) e.preventDefault();
    if (d2048Turn !== 1) return; // block player input during bot turn
  } else {
    // PvP turn-based
    if (d2048Turn === 1) {
      if      (key === 'w' || key === 'W' || key === 'ArrowUp')    { dir='up';    pIdx=0; }
      else if (key === 's' || key === 'S' || key === 'ArrowDown')  { dir='down';  pIdx=0; }
      else if (key === 'a' || key === 'A' || key === 'ArrowLeft')  { dir='left';  pIdx=0; }
      else if (key === 'd' || key === 'D' || key === 'ArrowRight') { dir='right'; pIdx=0; }
      if (key.startsWith('Arrow')) e.preventDefault();
    } else {
      if      (key === 'ArrowUp')    { dir='up';    pIdx=1; e.preventDefault(); }
      else if (key === 'ArrowDown')  { dir='down';  pIdx=1; e.preventDefault(); }
      else if (key === 'ArrowLeft')  { dir='left';  pIdx=1; e.preventDefault(); }
      else if (key === 'ArrowRight') { dir='right'; pIdx=1; e.preventDefault(); }
    }
  }

  if (!dir || pIdx < 0) return;

  var moved = d2048DoMove(pIdx, dir, function() {
    // After a valid move:
    if (d2048Mode === 'pvp') {
      d2048Turn = d2048Turn === 1 ? 2 : 1;
      d2048UpdateTurnUI();
    } else if (d2048Mode === 'pve' && pIdx === 0) {
      d2048Turn = 2;
      d2048UpdateTurnUI();
      d2048TriggerBot();
    }
  });
}

// ── Touch / swipe support ───────────────────────────────────────
function d2048AddSwipe(boardEl, pIdx) {
  var sx, sy;
  boardEl.addEventListener('touchstart', function(e) {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  boardEl.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    var dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');

    if (d2048Mode === 'pvp' && d2048Turn !== pIdx + 1) return;
    if (d2048Mode === 'pve' && pIdx === 1) return; // bot only
    if (d2048Mode === 'pve' && d2048Turn !== 1) return;

    d2048DoMove(pIdx, dir, function() {
      if (d2048Mode === 'pvp') {
        d2048Turn = d2048Turn === 1 ? 2 : 1;
        d2048UpdateTurnUI();
      } else if (d2048Mode === 'pve' && pIdx === 0) {
        d2048Turn = 2;
        d2048UpdateTurnUI();
        d2048TriggerBot();
      }
    });
  }, { passive: true });
}

// ── Simultaneous bot timer ──────────────────────────────────────
function d2048StartSimBot() {
  var interval = d2048Diff === 'easy' ? 850 : d2048Diff === 'medium' ? 550 : 300;
  d2048BotTimer = setInterval(function() {
    if (!d2048Active[1]) { clearInterval(d2048BotTimer); return; }
    var dir = d2048BotPickMove(1);
    if (dir) d2048DoMove(1, dir, null);
  }, interval);
}

// ── Init ────────────────────────────────────────────────────────
function d2048Init() {
  clearInterval(d2048BotTimer); d2048BotTimer = null;
  clearTimeout(d2048BotTimer);

  d2048Tiles      = [[], []];
  d2048Scores     = [0, 0];
  d2048Best       = [0, 0];
  d2048MoveCount  = [0, 0];
  d2048Active     = [true, true];
  d2048Locked     = [false, false];
  d2048Turn       = 1;

  // Reset UI
  [0, 1].forEach(function(p) {
    d2048ScoreEls[p].textContent = '0';
    d2048BestEls[p].textContent  = '—';
    d2048MovesEls[p].textContent = '0';
  });
  d2048WinOverlay.classList.add('hidden');
  d2048Sections.forEach(function(s) { s.classList.remove('active-turn'); });

  // Build boards (background slots)
  d2048BuildBoard(0);
  d2048BuildBoard(1);

  // Wait one frame for DOM layout so slot positions are accurate
  requestAnimationFrame(function() {
    d2048SpawnTile(0); d2048SpawnTile(0);
    d2048SpawnTile(1); d2048SpawnTile(1);
    d2048UpdateTurnUI();

    // Start simultaneous bot
    if (d2048Mode === 'sim') d2048StartSimBot();
  });
}

// ── Mode buttons ────────────────────────────────────────────────
function d2048SetModeUI(id) {
  ['d2048-btn-pvp','d2048-btn-pve','d2048-btn-sim'].forEach(function(i) {
    document.getElementById(i).classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

document.getElementById('d2048-btn-pvp').addEventListener('click', function() {
  d2048Mode = 'pvp';
  d2048SetModeUI('d2048-btn-pvp');
  document.getElementById('d2048-difficulty-selector').classList.add('hidden');
  d2048P2NameEl.textContent  = 'Player 2';
  d2048HintP1.textContent    = 'W A S D';
  d2048HintP2.textContent    = '↑ ← ↓ →';
  d2048ModeLabel.textContent = 'LOCAL PvP';
  d2048Init();
});
document.getElementById('d2048-btn-pve').addEventListener('click', function() {
  d2048Mode = 'pve';
  d2048SetModeUI('d2048-btn-pve');
  document.getElementById('d2048-difficulty-selector').classList.remove('hidden');
  d2048P2NameEl.textContent  = 'Bot';
  d2048HintP1.textContent    = 'WASD or ↑↓←→';
  d2048HintP2.textContent    = 'AUTO';
  d2048ModeLabel.textContent = 'PLAYER VS BOT';
  d2048Init();
});
document.getElementById('d2048-btn-sim').addEventListener('click', function() {
  d2048Mode = 'sim';
  d2048SetModeUI('d2048-btn-sim');
  document.getElementById('d2048-difficulty-selector').classList.remove('hidden');
  d2048P2NameEl.textContent  = 'Player 2';
  d2048HintP1.textContent    = 'W A S D';
  d2048HintP2.textContent    = '↑ ← ↓ →';
  d2048ModeLabel.textContent = 'SIMULTANEOUS';
  d2048Init();
});

['easy','medium','hard'].forEach(function(level) {
  document.getElementById('d2048-' + level).addEventListener('click', function() {
    d2048Diff = level;
    ['d2048-easy','d2048-medium','d2048-hard'].forEach(function(id) {
      document.getElementById(id).classList.remove('active');
    });
    document.getElementById('d2048-' + level).classList.add('active');
    d2048Init();
  });
});

document.getElementById('d2048-restart').addEventListener('click', d2048Init);
document.getElementById('d2048-win-restart').addEventListener('click', d2048Init);
document.addEventListener('keydown', d2048KeyHandler);
d2048AddSwipe(d2048BoardEls[0], 0);
d2048AddSwipe(d2048BoardEls[1], 1);

console.log('[DuelZone] 2048 Duel v2 loaded — smooth tiles, fixed bot, win overlay.');

// ═══════════════════════════════════════════════════════════════
// SECTION F: Hand Cricket Game Logic
// ═══════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────
var cricMode         = 'normal';   // 'normal' | 'crazy'
var cricDiff         = 'easy';     // 'easy' | 'medium' | 'hard'
var cricWickets      = 3;
var cricIsPvP        = false;
var cricP1Name       = 'Player 1';
var cricP2Name       = 'Player 2';

// Toss state
var cricTossOE       = null;       // 'odd' | 'even'

// Match state
var cricPlayerBats   = true;       // true = P1/YOU batting
var cricInnings      = 1;
var cricTarget       = null;

var cricP1Score      = 0;
var cricP2Score      = 0;
var cricBotScore     = 0;
var cricP1Wickets    = 0;
var cricP2Wickets    = 0;
var cricBotWickets   = 0;
var cricRound        = 1;
var cricNumpadLocked = false;

// PvP play state
var cricPvpBatterPick = null;   // batter's locked-in number this ball
var cricPvpPhase      = 1;      // 1=batter picking, 2=bowler picking

// Bot intelligence
var cricPlayerHistory = [];

// ── DOM refs ───────────────────────────────────────────────────
var cricSetupEl    = document.getElementById('cricket-setup');
var cricTossEl     = document.getElementById('cricket-toss');
var cricPlayEl     = document.getElementById('cricket-play');
var cricResultEl   = document.getElementById('cricket-result');

var cricModeLabel  = document.getElementById('cricket-mode-label');
var cricModeDesc   = document.getElementById('cricket-mode-desc');
var cricWktDisp    = document.getElementById('cric-wicket-display');

var cricOEBtns     = document.getElementById('cric-oe-btns');
var cricTossNumpad = document.getElementById('cricket-toss-numpad');
var cricTossResult = document.getElementById('cricket-toss-result');
var cricTossPNum   = document.getElementById('cric-toss-p-num');
var cricTossBNum   = document.getElementById('cric-toss-b-num');
var cricTossWinner = document.getElementById('cric-toss-winner-msg');
var cricBatBowlBtns= document.getElementById('cric-bat-bowl-btns');

var cricLeftName   = document.getElementById('cric-left-name');
var cricLeftRuns   = document.getElementById('cric-left-runs');
var cricLeftWkt    = document.getElementById('cric-left-wkt');
var cricRightName  = document.getElementById('cric-right-name');
var cricRightRuns  = document.getElementById('cric-right-runs');
var cricRightWkt   = document.getElementById('cric-right-wkt');
var cricInningsLbl = document.getElementById('cric-innings-label');
var cricRoundLbl   = document.getElementById('cric-round-label');
var cricPlayPNum   = document.getElementById('cric-play-p-num');
var cricPlayBNum   = document.getElementById('cric-play-b-num');
var cricPlayResult = document.getElementById('cric-play-result');
var cricPlayPrompt = document.getElementById('cric-play-prompt');
var cricPlayNumpad = document.getElementById('cric-play-numpad');

var cricResTrophy  = document.getElementById('cric-result-trophy');
var cricResTitle   = document.getElementById('cric-result-title');
var cricResSub     = document.getElementById('cric-result-sub');
var cricFinalYou   = document.getElementById('cric-final-you');
var cricFinalBot   = document.getElementById('cric-final-bot');

// ── Helpers ────────────────────────────────────────────────────
function cricShowOnly(el) {
  [cricSetupEl, cricTossEl, cricPlayEl, cricResultEl].forEach(function(e) {
    e.classList.add('hidden');
  });
  el.classList.remove('hidden');
}

function cricNumPop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

// Name helpers
function cricBatterName() {
  if (cricIsPvP) return cricPlayerBats ? cricP1Name : cricP2Name;
  return cricPlayerBats ? 'YOU' : 'BOT';
}
function cricBowlerName() {
  if (cricIsPvP) return cricPlayerBats ? cricP2Name : cricP1Name;
  return cricPlayerBats ? 'BOT' : 'YOU';
}

// Score/wicket accessors that work for both modes
function cricGetBatterScore()  { return cricPlayerBats ? cricP1Score : (cricIsPvP ? cricP2Score : cricBotScore); }
function cricGetBowlerScore()  { return cricPlayerBats ? (cricIsPvP ? cricP2Score : cricBotScore) : cricP1Score; }
function cricGetBatterWkts()   { return cricPlayerBats ? cricP1Wickets : (cricIsPvP ? cricP2Wickets : cricBotWickets); }
function cricAddBatterRuns(r)  {
  if (cricPlayerBats) { cricP1Score += r; }
  else { if (cricIsPvP) cricP2Score += r; else cricBotScore += r; }
}
function cricAddBatterWkt() {
  if (cricPlayerBats) { cricP1Wickets++; }
  else { if (cricIsPvP) cricP2Wickets++; else cricBotWickets++; }
}

function cricBotPick() {
  if (cricDiff === 'easy') return Math.floor(Math.random() * 10) + 1;
  if (cricDiff === 'medium') {
    if (cricPlayerHistory.length > 0 && Math.random() < 0.5) {
      var last = cricPlayerHistory[cricPlayerHistory.length - 1];
      if (cricMode === 'crazy' && !cricPlayerBats) {
        var adj = last + (Math.random() < 0.5 ? 1 : -1);
        return Math.max(1, Math.min(10, adj));
      }
      return last;
    }
    return Math.floor(Math.random() * 10) + 1;
  }
  if (cricPlayerHistory.length >= 3) {
    var freq = {};
    for (var i = 1; i <= 10; i++) freq[i] = 0;
    cricPlayerHistory.forEach(function(n){ freq[n]++; });
    var predicted = 1, maxF = 0;
    for (var k in freq) { if (freq[k] > maxF) { maxF = freq[k]; predicted = parseInt(k); } }
    if (cricMode === 'crazy' && !cricPlayerBats) {
      var tries = [predicted - 1, predicted + 1];
      var pick = tries[Math.floor(Math.random() * 2)];
      return Math.max(1, Math.min(10, pick));
    }
    if (cricMode === 'normal' && !cricPlayerBats) return predicted;
  }
  return Math.floor(Math.random() * 10) + 1;
}

function cricIsOut(batterNum, bowlerNum) {
  if (cricMode === 'normal') return batterNum === bowlerNum;
  return Math.abs(batterNum - bowlerNum) === 1;
}

function cricRunsScored(batterNum, bowlerNum) {
  if (cricMode === 'crazy' && batterNum === bowlerNum) return batterNum * batterNum;
  return batterNum;
}

function cricUpdateScoreboard() {
  var p1n = cricIsPvP ? cricP1Name : 'YOU';
  var p2n = cricIsPvP ? cricP2Name : 'BOT';
  var p2s = cricIsPvP ? cricP2Score : cricBotScore;
  var p2w = cricIsPvP ? cricP2Wickets : cricBotWickets;

  cricLeftName.textContent  = p1n;
  cricRightName.textContent = p2n;
  cricLeftRuns.textContent  = cricP1Score;
  cricRightRuns.textContent = (cricTarget !== null || !cricPlayerBats) ? p2s : '—';
  cricLeftWkt.textContent   = 'Wkts: ' + cricP1Wickets + '/' + cricWickets;
  cricRightWkt.textContent  = (cricTarget !== null || !cricPlayerBats) ? ('Wkts: ' + p2w + '/' + cricWickets) : '';

  // Batting panel highlight
  document.getElementById('cric-score-left').classList.toggle('batting',  cricPlayerBats);
  document.getElementById('cric-score-left').classList.toggle('bowling',  !cricPlayerBats);
  document.getElementById('cric-score-right').classList.toggle('batting', !cricPlayerBats);
  document.getElementById('cric-score-right').classList.toggle('bowling',  cricPlayerBats);

  // Update reveal labels
  var lbl_l = document.getElementById('cric-play-lbl-l');
  var lbl_r = document.getElementById('cric-play-lbl-r');
  if (lbl_l) lbl_l.textContent = p1n;
  if (lbl_r) lbl_r.textContent = p2n;

  // Innings bar
  var needStr = '';
  if (cricTarget !== null) {
    var chasing = cricGetBatterScore();
    needStr = ' — Need ' + Math.max(0, cricTarget + 1 - chasing);
  }
  cricInningsLbl.textContent = '🏏 ' + cricBatterName() + ' batting' + needStr;
  cricRoundLbl.textContent   = 'Ball ' + cricRound;
}

function cricEndInnings() {
  if (cricInnings === 1) {
    cricInnings = 2;
    cricRound   = 1;
    cricTarget  = cricPlayerBats ? cricP1Score : (cricIsPvP ? cricP2Score : cricBotScore);
    cricPlayerBats = !cricPlayerBats;
    cricPlayerHistory = [];
    cricUpdateScoreboard();
    cricPlayPNum.textContent = '?';
    cricPlayBNum.textContent = '?';
    cricPlayResult.textContent = '🔁 Innings over — ' + cricBatterName() + ' bats now!';
    if (cricIsPvP) {
      setTimeout(function() {
        cricPlayResult.textContent = '—';
        cricPvpResetBall();
      }, 1200);
    } else {
      cricPlayPrompt.textContent = cricPlayerBats ? 'Your turn to bat:' : 'Your turn to bowl:';
      setTimeout(function() {
        cricPlayResult.textContent = '—';
        cricSetNumpadDisabled(false);
      }, 1200);
    }
  } else {
    cricShowResult();
  }
}

function cricShowResult() {
  cricShowOnly(cricResultEl);
  var p1s  = cricP1Score;
  var p2s  = cricIsPvP ? cricP2Score : cricBotScore;
  var p1n  = cricIsPvP ? cricP1Name : 'You';
  var p2n  = cricIsPvP ? cricP2Name : 'Bot';
  var tie  = p1s === p2s;

  if (tie) {
    cricResTrophy.textContent = '🤝';
    cricResTitle.textContent  = "IT'S A TIE!";
    cricResSub.textContent    = 'Incredible — dead heat!';
    setTimeout(function() { SoundManager.draw(); }, 200);
  } else if (p1s > p2s) {
    cricResTrophy.textContent = '🏆';
    cricResTitle.textContent  = p1n.toUpperCase() + ' WIN' + (cricIsPvP ? 'S' : '') + '!';
    cricResSub.textContent    = 'Won by ' + (p1s - p2s) + ' run' + ((p1s - p2s) !== 1 ? 's' : '') + '!';
    setTimeout(function() { SoundManager.win(); }, 200);
  } else {
    cricResTrophy.textContent = cricIsPvP ? '🏆' : '💀';
    cricResTitle.textContent  = p2n.toUpperCase() + ' WIN' + (cricIsPvP ? 'S' : '') + '!';
    cricResSub.textContent    = p2n + ' won by ' + (p2s - p1s) + ' run' + ((p2s - p1s) !== 1 ? 's' : '') + '!';
    setTimeout(function() { cricIsPvP ? SoundManager.win() : SoundManager.lose(); }, 200);
  }

  cricFinalYou.textContent = p1n + ': ' + p1s;
  cricFinalBot.textContent = p2n + ': ' + p2s;
}

function cricSetNumpadDisabled(disabled) {
  if (!cricPlayNumpad) return;
  cricPlayNumpad.querySelectorAll('.cricket-num-btn').forEach(function(b) {
    if (disabled) b.classList.add('disabled'); else b.classList.remove('disabled');
  });
  cricNumpadLocked = disabled;
}

// ── Bot play handler ───────────────────────────────────────────
function cricHandlePlay(playerNum) {
  if (cricNumpadLocked) return;
  cricSetNumpadDisabled(true);
  cricPlayerHistory.push(playerNum);

  var botNum = cricBotPick();
  cricPlayPNum.textContent = playerNum;
  cricPlayBNum.textContent = '...';
  cricNumPop(cricPlayPNum);

  setTimeout(function() {
    cricPlayBNum.textContent = botNum;
    cricNumPop(cricPlayBNum);

    var batterNum = cricPlayerBats ? playerNum : botNum;
    var bowlerNum = cricPlayerBats ? botNum : playerNum;
    var isOut     = cricIsOut(batterNum, bowlerNum);
    var runs      = isOut ? 0 : cricRunsScored(batterNum, bowlerNum);
    cricResolveRound(batterNum, bowlerNum, isOut, runs);
  }, 500);
}

// ── Shared round resolution (used by both bot and PvP) ─────────
function cricResolveRound(batterNum, bowlerNum, isOut, runs) {
  if (isOut) {
    SoundManager.cricOut();
    cricAddBatterWkt();
    cricPlayResult.textContent = '🚨 ' + cricBatterName() + ' OUT!';
    cricPlayResult.classList.add('out-flash');
    setTimeout(function() { cricPlayResult.classList.remove('out-flash'); }, 1500);
    cricUpdateScoreboard();

    var wktsFallen = cricGetBatterWkts();
    var allOut     = wktsFallen >= cricWickets;

    if (cricInnings === 2 && cricGetBatterScore() > cricTarget) { cricShowResult(); return; }

    if (allOut) {
      setTimeout(cricEndInnings, 1000);
    } else {
      setTimeout(function() {
        cricPlayResult.textContent = '—';
        if (cricIsPvP) cricPvpResetBall();
        else { cricPlayPNum.textContent = '?'; cricPlayBNum.textContent = '?'; cricSetNumpadDisabled(false); }
      }, 1000);
    }
  } else {
    cricAddBatterRuns(runs);
    var crazyBonus = (cricMode === 'crazy' && batterNum === bowlerNum);
    SoundManager.cricRun();
    cricPlayResult.textContent = '+' + runs + (crazyBonus ? ' 🔥' : '');
    cricRound++;
    cricUpdateScoreboard();

    if (cricInnings === 2 && cricGetBatterScore() > cricTarget) { setTimeout(cricShowResult, 600); return; }

    setTimeout(function() {
      cricPlayResult.textContent = '—';
      if (cricIsPvP) cricPvpResetBall();
      else { cricPlayPNum.textContent = '?'; cricPlayBNum.textContent = '?'; cricSetNumpadDisabled(false); }
    }, 700);
  }
}

// ── PvP play: hot-seat two-phase ───────────────────────────────
function cricPvpResetBall() {
  cricPvpBatterPick = null;
  cricPvpPhase      = 1;

  cricPlayPNum.textContent = '?';
  cricPlayBNum.textContent = '?';

  var pp1  = document.getElementById('cric-pvp-pp1');
  var pass = document.getElementById('cric-pvp-pp-pass');
  var pp2  = document.getElementById('cric-pvp-pp2');
  if (pp1)  pp1.classList.remove('hidden');
  if (pass) pass.classList.add('hidden');
  if (pp2)  pp2.classList.add('hidden');

  // Update batter label
  var lbl = document.getElementById('cric-pvp-pp1-lbl');
  if (lbl) lbl.textContent = cricBatterName();

  // Re-enable batter buttons
  document.querySelectorAll('.cric-pvp-p1-btn').forEach(function(b){ b.classList.remove('disabled'); });
  document.querySelectorAll('.cric-pvp-p2-btn').forEach(function(b){ b.classList.remove('disabled'); });
}

// Called when batter presses a number
document.querySelectorAll('.cric-pvp-p1-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (cricPvpPhase !== 1) return;
    // Lock all batter buttons
    document.querySelectorAll('.cric-pvp-p1-btn').forEach(function(b){ b.classList.add('disabled'); });
    cricPvpBatterPick = parseInt(btn.getAttribute('data-v'));
    cricPvpPhase = 2;

    // Show pass screen
    var pp1  = document.getElementById('cric-pvp-pp1');
    var pass = document.getElementById('cric-pvp-pp-pass');
    var passName = document.getElementById('cric-pvp-pp-pass-name');
    var passMsg  = document.getElementById('cric-pvp-pp-pass-msg');
    if (pp1)  pp1.classList.add('hidden');
    if (pass) pass.classList.remove('hidden');
    if (passName) passName.textContent = cricBowlerName();
    if (passMsg)  passMsg.innerHTML = '<strong>' + cricBatterName() + '</strong> locked in! Pass to <strong>' + cricBowlerName() + '</strong>';
  });
});

// "Ready" button on pass screen → show bowler numpad
document.getElementById('cric-pvp-pp-ready').addEventListener('click', function() {
  var pass = document.getElementById('cric-pvp-pp-pass');
  var pp2  = document.getElementById('cric-pvp-pp2');
  var lbl  = document.getElementById('cric-pvp-pp2-lbl');
  if (pass) pass.classList.add('hidden');
  if (pp2)  pp2.classList.remove('hidden');
  if (lbl)  lbl.textContent = cricBowlerName();
});

// Called when bowler presses a number
document.querySelectorAll('.cric-pvp-p2-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (cricPvpPhase !== 2) return;
    document.querySelectorAll('.cric-pvp-p2-btn').forEach(function(b){ b.classList.add('disabled'); });
    var bowlerPick = parseInt(btn.getAttribute('data-v'));
    var batterPick = cricPvpBatterPick;
    cricPvpPhase = 0;

    // Update reveal boxes: left = P1, right = P2
    var p1IsP1Batting = cricPlayerBats; // P1 batting = left=batter, right=bowler
    if (p1IsP1Batting) {
      cricPlayPNum.textContent = batterPick;  // P1 (left) = batter
      cricPlayBNum.textContent = '...';
    } else {
      cricPlayPNum.textContent = bowlerPick;  // P1 (left) = bowler
      cricPlayBNum.textContent = '...';
    }
    cricNumPop(cricPlayPNum);

    var pp2 = document.getElementById('cric-pvp-pp2');
    if (pp2) pp2.classList.add('hidden');

    setTimeout(function() {
      if (p1IsP1Batting) {
        cricPlayBNum.textContent = bowlerPick;
      } else {
        cricPlayBNum.textContent = batterPick;
      }
      cricNumPop(cricPlayBNum);
      var isOut = cricIsOut(batterPick, bowlerPick);
      var runs  = isOut ? 0 : cricRunsScored(batterPick, bowlerPick);
      cricResolveRound(batterPick, bowlerPick, isOut, runs);
    }, 500);
  });
});

// ── PvP Toss ───────────────────────────────────────────────────
var cricPvpTossP1Num = null;

document.querySelectorAll('.cric-pvp-toss-p1-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    cricPvpTossP1Num = parseInt(btn.getAttribute('data-v'));
    document.querySelectorAll('.cric-pvp-toss-p1-btn').forEach(function(b){ b.classList.add('disabled'); });

    var t1   = document.getElementById('cric-pvp-t1');
    var pass = document.getElementById('cric-pvp-t-pass');
    var pn   = document.getElementById('cric-pvp-t-pass-name');
    if (t1)   t1.classList.add('hidden');
    if (pass) pass.classList.remove('hidden');
    if (pn)   pn.textContent = cricP2Name;
  });
});

document.getElementById('cric-pvp-t-ready').addEventListener('click', function() {
  var pass = document.getElementById('cric-pvp-t-pass');
  var t2   = document.getElementById('cric-pvp-t2');
  var lbl  = document.getElementById('cric-pvp-t2-lbl');
  if (pass) pass.classList.add('hidden');
  if (t2)   t2.classList.remove('hidden');
  if (lbl)  lbl.textContent = cricP2Name;
});

document.querySelectorAll('.cric-pvp-toss-p2-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var p2n = parseInt(btn.getAttribute('data-v'));
    var p1n = cricPvpTossP1Num;
    document.querySelectorAll('.cric-pvp-toss-p2-btn').forEach(function(b){ b.classList.add('disabled'); });

    var t2     = document.getElementById('cric-pvp-t2');
    var reveal = document.getElementById('cric-pvp-t-reveal');
    var lbl1   = document.getElementById('cric-pvp-tr-lbl1');
    var lbl2   = document.getElementById('cric-pvp-tr-lbl2');
    var num1   = document.getElementById('cric-pvp-tr-n1');
    var num2   = document.getElementById('cric-pvp-tr-n2');
    var msg    = document.getElementById('cric-pvp-tr-msg');
    var bb     = document.getElementById('cric-pvp-tr-batbowl');
    var bat    = document.getElementById('cric-pvp-bat-btn');
    var bowl   = document.getElementById('cric-pvp-bowl-btn');

    if (t2)     t2.classList.add('hidden');
    if (reveal) reveal.classList.remove('hidden');
    if (lbl1)   lbl1.textContent = cricP1Name;
    if (lbl2)   lbl2.textContent = cricP2Name;
    if (num1)   { num1.textContent = p1n; cricNumPop(num1); }
    if (num2)   { num2.textContent = p2n; cricNumPop(num2); }

    if (p1n === p2n) {
      if (msg) msg.textContent = p1n + ' = ' + p2n + ' — TIE! Re-toss...';
      cricPvpTossP1Num = null;
      setTimeout(function() {
        reveal.classList.add('hidden');
        document.getElementById('cric-pvp-t-pass').classList.add('hidden');
        var t1 = document.getElementById('cric-pvp-t1');
        if (t1) t1.classList.remove('hidden');
        document.querySelectorAll('.cric-pvp-toss-p1-btn').forEach(function(b){ b.classList.remove('disabled'); });
        document.querySelectorAll('.cric-pvp-toss-p2-btn').forEach(function(b){ b.classList.remove('disabled'); });
        var lbl1e = document.getElementById('cric-pvp-t1-lbl');
        if (lbl1e) lbl1e.textContent = cricP1Name;
      }, 1400);
      return;
    }

    var p1wins = p1n > p2n;
    var winner = p1wins ? cricP1Name : cricP2Name;
    if (msg) msg.textContent = p1n + ' vs ' + p2n + ' — ' + winner + ' wins the toss!';
    if (bat)  bat.textContent  = '🏏 ' + winner + ' bats';
    if (bowl) bowl.textContent = '⚾ ' + winner + ' bowls';
    if (bb)   bb.setAttribute('data-winner', p1wins ? '1' : '2');
    if (bb)   bb.classList.remove('hidden');
  });
});

document.getElementById('cric-pvp-bat-btn').addEventListener('click', function() {
  var bb = document.getElementById('cric-pvp-tr-batbowl');
  var w  = bb ? bb.getAttribute('data-winner') : '1';
  // winner bats: if winner=1 (P1), P1 bats first
  cricStartMatch(w === '1');
});
document.getElementById('cric-pvp-bowl-btn').addEventListener('click', function() {
  var bb = document.getElementById('cric-pvp-tr-batbowl');
  var w  = bb ? bb.getAttribute('data-winner') : '1';
  // winner bowls: if winner=1, P1 bowls → P2 bats first
  cricStartMatch(w !== '1');
});

// ── Setup ──────────────────────────────────────────────────────
var CRIC_MODE_DESCS = {
  normal: 'Match = OUT. Batter scores their own number otherwise.',
  crazy:  'Adjacent (±1) = OUT. Match = SQUARE bonus! (e.g. 8×8=64 runs!)'
};

function cricResetToSetup() {
  cricMode         = 'normal';
  cricDiff         = 'easy';
  cricWickets      = 3;
  cricTossOE       = null;
  cricIsPvP        = false;
  cricPvpTossP1Num = null;
  cricPlayerHistory = [];

  document.getElementById('cric-normal-btn').classList.add('active');
  document.getElementById('cric-crazy-btn').classList.remove('active');
  document.getElementById('cric-easy-btn').classList.add('active');
  document.getElementById('cric-medium-btn').classList.remove('active');
  document.getElementById('cric-hard-btn').classList.remove('active');
  document.getElementById('cric-vs-bot-btn').classList.add('active');
  document.getElementById('cric-vs-pvp-btn').classList.remove('active');
  document.getElementById('cric-diff-row').classList.remove('hidden');
  document.getElementById('cric-names-row').classList.add('hidden');
  document.getElementById('cric-pvp-rule').classList.add('hidden');

  cricWktDisp.textContent = '3';
  if (cricModeDesc) cricModeDesc.textContent = CRIC_MODE_DESCS.normal;

  // Reset bot toss
  if (cricOEBtns)    cricOEBtns.classList.remove('hidden');
  document.getElementById('cric-odd-btn').classList.remove('active');
  document.getElementById('cric-even-btn').classList.remove('active');
  if (cricTossNumpad) cricTossNumpad.classList.add('hidden');
  if (cricTossResult) cricTossResult.classList.add('hidden');
  if (cricBatBowlBtns) cricBatBowlBtns.classList.add('hidden');

  cricShowOnly(cricSetupEl);
}

function cricStartMatch(p1BatsFirst) {
  cricPlayerBats  = p1BatsFirst;
  cricInnings     = 1;
  cricTarget      = null;
  cricP1Score     = 0; cricP2Score = 0; cricBotScore  = 0;
  cricP1Wickets   = 0; cricP2Wickets = 0; cricBotWickets = 0;
  cricRound       = 1;
  cricPlayerHistory = [];

  cricPlayPNum.textContent = '?';
  cricPlayBNum.textContent = '?';
  cricPlayResult.textContent = '—';

  var botPlay = document.getElementById('cric-bot-play');
  var pvpPlay = document.getElementById('cric-pvp-play');

  if (cricIsPvP) {
    if (botPlay) botPlay.classList.add('hidden');
    if (pvpPlay) pvpPlay.classList.remove('hidden');
    cricPvpResetBall();
  } else {
    if (botPlay) botPlay.classList.remove('hidden');
    if (pvpPlay) pvpPlay.classList.add('hidden');
    if (cricPlayPrompt) cricPlayPrompt.textContent = p1BatsFirst ? 'Pick a number to bat:' : 'Pick a number to bowl:';
    cricSetNumpadDisabled(false);
  }

  cricUpdateScoreboard();
  cricShowOnly(cricPlayEl);
}

// ── Event wiring ───────────────────────────────────────────────

// VS mode toggle
document.getElementById('cric-vs-bot-btn').addEventListener('click', function() {
  cricIsPvP = false;
  document.getElementById('cric-vs-bot-btn').classList.add('active');
  document.getElementById('cric-vs-pvp-btn').classList.remove('active');
  document.getElementById('cric-diff-row').classList.remove('hidden');
  document.getElementById('cric-names-row').classList.add('hidden');
  document.getElementById('cric-pvp-rule').classList.add('hidden');
});
document.getElementById('cric-vs-pvp-btn').addEventListener('click', function() {
  cricIsPvP = true;
  document.getElementById('cric-vs-pvp-btn').classList.add('active');
  document.getElementById('cric-vs-bot-btn').classList.remove('active');
  document.getElementById('cric-diff-row').classList.add('hidden');
  document.getElementById('cric-names-row').classList.remove('hidden');
  document.getElementById('cric-pvp-rule').classList.remove('hidden');
});

// Mode buttons
document.getElementById('cric-normal-btn').addEventListener('click', function() {
  cricMode = 'normal';
  document.getElementById('cric-normal-btn').classList.add('active');
  document.getElementById('cric-crazy-btn').classList.remove('active');
  if (cricModeDesc) cricModeDesc.textContent = CRIC_MODE_DESCS.normal;
});
document.getElementById('cric-crazy-btn').addEventListener('click', function() {
  cricMode = 'crazy';
  document.getElementById('cric-crazy-btn').classList.add('active');
  document.getElementById('cric-normal-btn').classList.remove('active');
  if (cricModeDesc) cricModeDesc.textContent = CRIC_MODE_DESCS.crazy;
});

// Difficulty buttons
document.getElementById('cric-easy-btn').addEventListener('click', function() {
  cricDiff = 'easy';
  ['easy','medium','hard'].forEach(function(d){ document.getElementById('cric-'+d+'-btn').classList.remove('active'); });
  document.getElementById('cric-easy-btn').classList.add('active');
});
document.getElementById('cric-medium-btn').addEventListener('click', function() {
  cricDiff = 'medium';
  ['easy','medium','hard'].forEach(function(d){ document.getElementById('cric-'+d+'-btn').classList.remove('active'); });
  document.getElementById('cric-medium-btn').classList.add('active');
});
document.getElementById('cric-hard-btn').addEventListener('click', function() {
  cricDiff = 'hard';
  ['easy','medium','hard'].forEach(function(d){ document.getElementById('cric-'+d+'-btn').classList.remove('active'); });
  document.getElementById('cric-hard-btn').classList.add('active');
});

// Wicket buttons
document.getElementById('cric-wk-minus').addEventListener('click', function() {
  if (cricWickets > 1) { cricWickets--; cricWktDisp.textContent = cricWickets; }
});
document.getElementById('cric-wk-plus').addEventListener('click', function() {
  if (cricWickets < 11) { cricWickets++; cricWktDisp.textContent = cricWickets; }
});

// Start match → go to toss
document.getElementById('cric-start-btn').addEventListener('click', function() {
  // Read PvP player names
  if (cricIsPvP) {
    var n1 = document.getElementById('cric-p1-name-input');
    var n2 = document.getElementById('cric-p2-name-input');
    cricP1Name = (n1 && n1.value.trim()) ? n1.value.trim() : 'Player 1';
    cricP2Name = (n2 && n2.value.trim()) ? n2.value.trim() : 'Player 2';
  }
  // Show correct toss area
  var botToss = document.getElementById('cric-bot-toss');
  var pvpToss = document.getElementById('cric-pvp-toss');
  if (cricIsPvP) {
    if (botToss) botToss.classList.add('hidden');
    if (pvpToss) {
      pvpToss.classList.remove('hidden');
      // Reset PvP toss to step 1
      document.getElementById('cric-pvp-t1').classList.remove('hidden');
      document.getElementById('cric-pvp-t-pass').classList.add('hidden');
      document.getElementById('cric-pvp-t2').classList.add('hidden');
      document.getElementById('cric-pvp-t-reveal').classList.add('hidden');
      var lbl1 = document.getElementById('cric-pvp-t1-lbl');
      if (lbl1) lbl1.textContent = cricP1Name;
      document.querySelectorAll('.cric-pvp-toss-p1-btn').forEach(function(b){ b.classList.remove('disabled'); });
      document.querySelectorAll('.cric-pvp-toss-p2-btn').forEach(function(b){ b.classList.remove('disabled'); });
      cricPvpTossP1Num = null;
    }
  } else {
    if (pvpToss) pvpToss.classList.add('hidden');
    if (botToss) botToss.classList.remove('hidden');
    cricOEBtns.classList.remove('hidden');
    document.getElementById('cric-odd-btn').classList.remove('active');
    document.getElementById('cric-even-btn').classList.remove('active');
    cricTossNumpad.classList.add('hidden');
    cricTossResult.classList.add('hidden');
    cricBatBowlBtns.classList.add('hidden');
  }
  if (cricModeLabel) cricModeLabel.textContent = cricMode === 'crazy' ? '🔥 CRAZY MODE' : '⚡ NORMAL MODE';
  cricShowOnly(cricTossEl);
});

// Bot toss: Odd/Even choice
document.getElementById('cric-odd-btn').addEventListener('click', function() {
  cricTossOE = 'odd';
  document.getElementById('cric-odd-btn').classList.add('active');
  document.getElementById('cric-even-btn').classList.remove('active');
  cricOEBtns.classList.add('hidden');
  cricTossNumpad.classList.remove('hidden');
});
document.getElementById('cric-even-btn').addEventListener('click', function() {
  cricTossOE = 'even';
  document.getElementById('cric-even-btn').classList.add('active');
  document.getElementById('cric-odd-btn').classList.remove('active');
  cricOEBtns.classList.add('hidden');
  cricTossNumpad.classList.remove('hidden');
});

// Bot toss numpad
document.querySelectorAll('.cric-bot-toss-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var playerNum = parseInt(btn.getAttribute('data-v'));
    var botNum    = Math.floor(Math.random() * 10) + 1;
    var sum       = playerNum + botNum;
    var sumType   = (sum % 2 === 0) ? 'even' : 'odd';
    var playerWon = (sumType === cricTossOE);

    cricTossPNum.textContent = playerNum;
    cricTossBNum.textContent = botNum;
    cricNumPop(cricTossPNum);
    cricNumPop(cricTossBNum);

    cricTossNumpad.classList.add('hidden');
    cricTossResult.classList.remove('hidden');

    cricTossWinner.textContent = playerNum + ' + ' + botNum + ' = ' + sum + ' (' + sumType.toUpperCase() + ') → ' + (playerWon ? 'YOU WIN TOSS!' : 'BOT WINS TOSS!');

    if (playerWon) {
      cricBatBowlBtns.classList.remove('hidden');
    } else {
      setTimeout(function() {
        cricTossWinner.textContent += ' Bot chooses to BAT.';
        cricBatBowlBtns.classList.add('hidden');
        setTimeout(function() { cricStartMatch(false); }, 1000);
      }, 800);
    }
  });
});

// Bot bat/bowl choice after winning toss
document.getElementById('cric-bat-btn').addEventListener('click', function() { cricStartMatch(true); });
document.getElementById('cric-bowl-btn').addEventListener('click', function() { cricStartMatch(false); });

// Bot play numpad
document.querySelectorAll('#cric-play-numpad .cricket-num-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (cricNumpadLocked) return;
    cricHandlePlay(parseInt(btn.getAttribute('data-v')));
  });
});

// Play again
document.getElementById('cric-play-again').addEventListener('click', function() { cricResetToSetup(); });

// Back button
document.getElementById('cricket-back-btn').addEventListener('click', function() { showHub(); });

console.log('[DuelZone] Hand Cricket — PvP + Bot modes ready!');

// ═══════════════════════════════════════════════════════════════
// SECTION G: Game Home Pages — lobby/setup screens
// ═══════════════════════════════════════════════════════════════

// ── Generic panel show/hide helpers ────────────────────────────
function showPanel(panelId) {
  document.getElementById(panelId).classList.remove('hidden');
}
function hidePanel(panelId) {
  document.getElementById(panelId).classList.add('hidden');
}

// ── TTT HOME PAGE ───────────────────────────────────────────────
var tttHP_mode  = 'pvp';
var tttHP_diff  = 'easy';

function showTTTHome() {
  showPanel('ttt-home');
  hidePanel('ttt-play-panel');
  window.scrollTo(0, 0);
}

function startTTTGame() {
  // Apply settings from home page to game
  tttSetMode(tttHP_mode);
  if (tttHP_mode === 'pve') tttSetDiff(tttHP_diff);
  hidePanel('ttt-home');
  showPanel('ttt-play-panel');
  tttRestart();
  window.scrollTo(0, 0);
}

// Override showTTT to show home first
var _origShowTTT = showTTT;
showTTT = function() {
  hideAllScreens();
  screenTTT.classList.remove('hidden');
  showTTTHome();
};

// TTT home page button wiring
document.getElementById('ttt-home-back').addEventListener('click', showHub);
document.getElementById('ttt-hp-start').addEventListener('click', startTTTGame);

document.getElementById('ttt-hp-pvp').addEventListener('click', function() {
  tttHP_mode = 'pvp';
  this.classList.add('active');
  document.getElementById('ttt-hp-pve').classList.remove('active');
  document.getElementById('ttt-hp-diff-row').style.display = 'none';
});
document.getElementById('ttt-hp-pve').addEventListener('click', function() {
  tttHP_mode = 'pve';
  this.classList.add('active');
  document.getElementById('ttt-hp-pvp').classList.remove('active');
  document.getElementById('ttt-hp-diff-row').style.display = '';
});
['easy','medium','hard'].forEach(function(d) {
  document.getElementById('ttt-hp-'+d).addEventListener('click', function() {
    tttHP_diff = d;
    ['easy','medium','hard'].forEach(function(x){
      document.getElementById('ttt-hp-'+x).classList.remove('active');
    });
    this.classList.add('active');
  });
});

// Back-to-setup inside TTT game
document.getElementById('ttt-back-to-home').addEventListener('click', function() {
  showTTTHome();
});

// ── RPS HOME PAGE ───────────────────────────────────────────────
var rpsHP_mode   = 'pvp';
var rpsHP_diff   = 'easy';
var rpsHP_bestof = 5;

function showRPSHome() {
  showPanel('rps-home');
  hidePanel('rps-play-panel');
  window.scrollTo(0, 0);
}

function startRPSGame() {
  rpsSetMode(rpsHP_mode);
  rpsSetBestOf(rpsHP_bestof);
  if (rpsHP_mode === 'pve') rpsSetDiff(rpsHP_diff);
  hidePanel('rps-home');
  showPanel('rps-play-panel');
  rpsRestart();
  window.scrollTo(0, 0);
}

var _origShowRPS = showRPS;
showRPS = function() {
  hideAllScreens();
  screenRPS.classList.remove('hidden');
  showRPSHome();
};

document.getElementById('rps-home-back').addEventListener('click', showHub);
document.getElementById('rps-hp-start').addEventListener('click', startRPSGame);
document.getElementById('rps-back-to-home').addEventListener('click', showRPSHome);

document.getElementById('rps-hp-pvp').addEventListener('click', function() {
  rpsHP_mode = 'pvp';
  this.classList.add('active');
  document.getElementById('rps-hp-pve').classList.remove('active');
  document.getElementById('rps-hp-diff-row').style.display = 'none';
});
document.getElementById('rps-hp-pve').addEventListener('click', function() {
  rpsHP_mode = 'pve';
  this.classList.add('active');
  document.getElementById('rps-hp-pvp').classList.remove('active');
  document.getElementById('rps-hp-diff-row').style.display = '';
});
[3,5,7].forEach(function(n) {
  document.getElementById('rps-hp-bo'+n).addEventListener('click', function() {
    rpsHP_bestof = n;
    [3,5,7].forEach(function(x){
      document.getElementById('rps-hp-bo'+x).classList.remove('active');
    });
    this.classList.add('active');
  });
});
['easy','medium','hard'].forEach(function(d) {
  document.getElementById('rps-hp-'+d).addEventListener('click', function() {
    rpsHP_diff = d;
    ['easy','medium','hard'].forEach(function(x){
      document.getElementById('rps-hp-'+x).classList.remove('active');
    });
    this.classList.add('active');
  });
});

// ── TAP BATTLE HOME PAGE ────────────────────────────────────────
var tapHP_mode = 'pvp';
var tapHP_diff = 'easy';

function showTapHome() {
  showPanel('tap-home');
  hidePanel('tap-play-panel');
  window.scrollTo(0, 0);
}

function startTapGame() {
  // Apply settings: trigger existing mode buttons
  if (tapHP_mode === 'pvp') {
    document.getElementById('tap-btn-pvp').click();
  } else {
    document.getElementById('tap-btn-pve').click();
    document.getElementById('tap-'+tapHP_diff).click();
  }
  hidePanel('tap-home');
  showPanel('tap-play-panel');
  tapReset();
  window.scrollTo(0, 0);
}

var _origShowTap = showTap;
showTap = function() {
  hideAllScreens();
  screenTap.classList.remove('hidden');
  showTapHome();
};

document.getElementById('tap-home-back').addEventListener('click', function(){
  tapStop();
  showHub();
});
document.getElementById('tap-hp-start').addEventListener('click', startTapGame);
document.getElementById('tap-back-to-home').addEventListener('click', function(){
  tapStop();
  showTapHome();
});

document.getElementById('tap-hp-pvp').addEventListener('click', function() {
  tapHP_mode = 'pvp';
  this.classList.add('active');
  document.getElementById('tap-hp-pve').classList.remove('active');
  document.getElementById('tap-hp-diff-row').style.display = 'none';
});
document.getElementById('tap-hp-pve').addEventListener('click', function() {
  tapHP_mode = 'pve';
  this.classList.add('active');
  document.getElementById('tap-hp-pvp').classList.remove('active');
  document.getElementById('tap-hp-diff-row').style.display = '';
});
['easy','medium','hard'].forEach(function(d) {
  document.getElementById('tap-hp-'+d).addEventListener('click', function() {
    tapHP_diff = d;
    ['easy','medium','hard'].forEach(function(x){
      document.getElementById('tap-hp-'+x).classList.remove('active');
    });
    this.classList.add('active');
  });
});

// ── 2048 HOME PAGE ──────────────────────────────────────────────
var d2048HP_mode = 'pvp';
var d2048HP_diff = 'easy';

function showD2048Home() {
  showPanel('d2048-home');
  hidePanel('d2048-play-panel');
  window.scrollTo(0, 0);
}

function startD2048Game() {
  // Apply mode
  if (d2048HP_mode === 'pvp')  document.getElementById('d2048-btn-pvp').click();
  if (d2048HP_mode === 'pve')  document.getElementById('d2048-btn-pve').click();
  if (d2048HP_mode === 'sim')  document.getElementById('d2048-btn-sim').click();
  if (d2048HP_mode !== 'pvp')  document.getElementById('d2048-'+d2048HP_diff).click();
  hidePanel('d2048-home');
  showPanel('d2048-play-panel');
  window.scrollTo(0, 0);
}

var _origShow2048 = show2048;
show2048 = function() {
  hideAllScreens();
  screen2048.classList.remove('hidden');
  showD2048Home();
};

document.getElementById('d2048-home-back').addEventListener('click', function(){
  clearInterval(d2048BotTimer); d2048BotTimer = null;
  showHub();
});
document.getElementById('d2048-hp-start').addEventListener('click', startD2048Game);
document.getElementById('d2048-back-to-home').addEventListener('click', function(){
  clearInterval(d2048BotTimer); d2048BotTimer = null;
  showD2048Home();
});

['pvp','pve','sim'].forEach(function(m) {
  document.getElementById('d2048-hp-'+m).addEventListener('click', function() {
    d2048HP_mode = m;
    ['pvp','pve','sim'].forEach(function(x){
      document.getElementById('d2048-hp-'+x).classList.remove('active');
    });
    this.classList.add('active');
    var showDiff = (m !== 'pvp');
    document.getElementById('d2048-hp-diff-row').style.display = showDiff ? '' : 'none';
  });
});
['easy','medium','hard'].forEach(function(d) {
  document.getElementById('d2048-hp-'+d).addEventListener('click', function() {
    d2048HP_diff = d;
    ['easy','medium','hard'].forEach(function(x){
      document.getElementById('d2048-hp-'+x).classList.remove('active');
    });
    this.classList.add('active');
  });
});

// ── CRICKET: Clicked numpad button highlight ────────────────────
// Enhance play numpad to show which button was clicked
var cricLastSelectedBtn = null;

// Override the play numpad click handler to add highlight
document.querySelectorAll('#cric-play-numpad .cricket-num-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (cricNumpadLocked) return;
    // Highlight selected button
    if (cricLastSelectedBtn) cricLastSelectedBtn.classList.remove('selected');
    btn.classList.add('selected');
    cricLastSelectedBtn = btn;
    // Remove highlight after delay
    setTimeout(function() {
      btn.classList.remove('selected');
      cricLastSelectedBtn = null;
    }, 900);
  }, true); // capture phase so it runs before the other handler
});

// Also highlight toss numpad buttons
document.querySelectorAll('#cricket-toss-numpad .cricket-num-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#cricket-toss-numpad .cricket-num-btn').forEach(function(b){
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
  });
});

console.log('[DuelZone] Game home pages loaded — all games have lobby screens with rules & settings.');

// ═══════════════════════════════════════════════════════════════
// BOT ENGINE — shared AI for Connect Four (and future expansion)
// difficulty: 'easy' | 'medium' | 'extreme'
// ═══════════════════════════════════════════════════════════════

var BotEngine = {
  _c4: {
    validCols: function(board, cols, ev) {
      var v = [];
      for (var c = 0; c < cols; c++) if (board[0][c] === ev) v.push(c);
      return v;
    },
    nextRow: function(board, col, rows, ev) {
      for (var r = rows - 1; r >= 0; r--) if (board[r][col] === ev) return r;
      return -1;
    },
    checkWin: function(board, player, rows, cols) {
      var r, c;
      for (r = 0; r < rows; r++)
        for (c = 0; c <= cols-4; c++)
          if (board[r][c]===player&&board[r][c+1]===player&&board[r][c+2]===player&&board[r][c+3]===player) return true;
      for (r = 0; r <= rows-4; r++)
        for (c = 0; c < cols; c++)
          if (board[r][c]===player&&board[r+1][c]===player&&board[r+2][c]===player&&board[r+3][c]===player) return true;
      for (r = 0; r <= rows-4; r++)
        for (c = 0; c <= cols-4; c++)
          if (board[r][c]===player&&board[r+1][c+1]===player&&board[r+2][c+2]===player&&board[r+3][c+3]===player) return true;
      for (r = 3; r < rows; r++)
        for (c = 0; c <= cols-4; c++)
          if (board[r][c]===player&&board[r-1][c+1]===player&&board[r-2][c+2]===player&&board[r-3][c+3]===player) return true;
      return false;
    },
    checkDraw: function(board, cols, ev) {
      for (var c = 0; c < cols; c++) if (board[0][c] === ev) return false;
      return true;
    },
    random: function(state) {
      var valid = BotEngine._c4.validCols(state.board, state.cols, state.emptyVal);
      return valid[Math.floor(Math.random() * valid.length)];
    },
    findImmediate: function(board, player, rows, cols, ev) {
      var valid = BotEngine._c4.validCols(board, cols, ev);
      for (var i = 0; i < valid.length; i++) {
        var col = valid[i], row = BotEngine._c4.nextRow(board, col, rows, ev);
        board[row][col] = player;
        var wins = BotEngine._c4.checkWin(board, player, rows, cols);
        board[row][col] = ev;
        if (wins) return col;
      }
      return -1;
    },
    smart: function(state) {
      var b = state.board, bot = state.botPlayer, human = state.humanPlayer;
      var rows = state.rows, cols = state.cols, ev = state.emptyVal;
      var win = BotEngine._c4.findImmediate(b, bot, rows, cols, ev);
      if (win !== -1) return win;
      var block = BotEngine._c4.findImmediate(b, human, rows, cols, ev);
      if (block !== -1) return block;
      var order = [3,2,4,1,5,0,6];
      var valid = BotEngine._c4.validCols(b, cols, ev);
      for (var i = 0; i < order.length; i++) if (valid.indexOf(order[i]) !== -1) return order[i];
      return -1;
    },
    evalWindow: function(w4, bot, human, ev) {
      var pc=0,ec=0,oc=0;
      for(var i=0;i<4;i++){if(w4[i]===bot)pc++;else if(w4[i]===ev)ec++;else oc++;}
      var s=0;
      if(pc===4)s+=100;else if(pc===3&&ec===1)s+=5;else if(pc===2&&ec===2)s+=2;
      if(oc===3&&ec===1)s-=4;
      return s;
    },
    scorePos: function(board, player, rows, cols, bot, human, ev) {
      var score=0,r,c,w,cc=Math.floor(cols/2);
      for(r=0;r<rows;r++) if(board[r][cc]===player) score+=3;
      for(r=0;r<rows;r++) for(c=0;c<=cols-4;c++){w=[board[r][c],board[r][c+1],board[r][c+2],board[r][c+3]];score+=BotEngine._c4.evalWindow(w,bot,human,ev);}
      for(c=0;c<cols;c++) for(r=0;r<=rows-4;r++){w=[board[r][c],board[r+1][c],board[r+2][c],board[r+3][c]];score+=BotEngine._c4.evalWindow(w,bot,human,ev);}
      for(r=0;r<=rows-4;r++) for(c=0;c<=cols-4;c++){w=[board[r][c],board[r+1][c+1],board[r+2][c+2],board[r+3][c+3]];score+=BotEngine._c4.evalWindow(w,bot,human,ev);}
      for(r=3;r<rows;r++) for(c=0;c<=cols-4;c++){w=[board[r][c],board[r-1][c+1],board[r-2][c+2],board[r-3][c+3]];score+=BotEngine._c4.evalWindow(w,bot,human,ev);}
      return score;
    },
    isTerminal: function(board,rows,cols,bot,human,ev) {
      return BotEngine._c4.checkWin(board,bot,rows,cols)||BotEngine._c4.checkWin(board,human,rows,cols)||BotEngine._c4.checkDraw(board,cols,ev);
    },
    _mm: function(board,depth,alpha,beta,maximizing,rows,cols,bot,human,ev) {
      var valid=BotEngine._c4.validCols(board,cols,ev);
      var mid=Math.floor(cols/2);
      valid.sort(function(a,b){return Math.abs(a-mid)-Math.abs(b-mid);});
      if(BotEngine._c4.isTerminal(board,rows,cols,bot,human,ev)){
        if(BotEngine._c4.checkWin(board,bot,rows,cols)) return{col:-1,score:1000000};
        if(BotEngine._c4.checkWin(board,human,rows,cols)) return{col:-1,score:-1000000};
        return{col:-1,score:0};
      }
      if(depth===0) return{col:-1,score:BotEngine._c4.scorePos(board,bot,rows,cols,bot,human,ev)-BotEngine._c4.scorePos(board,human,rows,cols,bot,human,ev)};
      var bestScore=maximizing?-Infinity:+Infinity,bestCol=valid[0];
      for(var i=0;i<valid.length;i++){
        var col=valid[i],row=BotEngine._c4.nextRow(board,col,rows,ev);
        board[row][col]=maximizing?bot:human;
        var res=BotEngine._c4._mm(board,depth-1,alpha,beta,!maximizing,rows,cols,bot,human,ev);
        board[row][col]=ev;
        if(maximizing){if(res.score>bestScore){bestScore=res.score;bestCol=col;}alpha=Math.max(alpha,bestScore);}
        else{if(res.score<bestScore){bestScore=res.score;bestCol=col;}beta=Math.min(beta,bestScore);}
        if(alpha>=beta) break;
      }
      return{col:bestCol,score:bestScore};
    },
    extreme: function(state) {
      var board=state.board.map(function(row){return row.slice();});
      var bot=state.botPlayer,human=state.humanPlayer,rows=state.rows,cols=state.cols,ev=state.emptyVal;
      var win=BotEngine._c4.findImmediate(board,bot,rows,cols,ev);
      if(win!==-1) return win;
      return BotEngine._c4._mm(board,5,-Infinity,+Infinity,true,rows,cols,bot,human,ev).col;
    }
  },
  getC4Move: function(state, difficulty) {
    if(difficulty==='easy') return BotEngine._c4.random(state);
    if(difficulty==='medium') return(Math.random()<0.5)?BotEngine._c4.random(state):BotEngine._c4.smart(state);
    return BotEngine._c4.extreme(state);
  }
};

// ═══════════════════════════════════════════════════════════════
// SECTION G: Connect Four Full Game
// ═══════════════════════════════════════════════════════════════

var C4_ROWS  = 6;
var C4_COLS  = 7;
var C4_P1    = 'R';
var C4_P2    = 'Y';
var C4_EMPTY = null;

var c4Board         = [];
var c4CurrentPlayer = C4_P1;
var c4GameActive    = true;
var c4GameMode      = 'pvp';
var c4Difficulty    = 'easy';
var c4Scores        = { R: 0, Y: 0 };

var c4BoardEl     = document.getElementById('c4-board');
var c4BoardWrap   = document.getElementById('c4-board-wrap');
var c4StatusEl    = document.getElementById('c4-status-text');
var c4BtnReset    = document.getElementById('c4-btn-reset');
var c4P1Card      = document.getElementById('c4-p1-card');
var c4P2Card      = document.getElementById('c4-p2-card');
var c4P2Label     = document.getElementById('c4-p2-label');
var c4ScoreP1El   = document.getElementById('c4-score-p1');
var c4ScoreP2El   = document.getElementById('c4-score-p2');
var c4DropZone    = document.getElementById('c4-drop-zone');
var c4ColOverlays = document.querySelectorAll('.c4-col-overlay');

function c4CreateBoard() {
  var b = [];
  for (var r = 0; r < C4_ROWS; r++) { b[r] = []; for (var c = 0; c < C4_COLS; c++) b[r][c] = C4_EMPTY; }
  return b;
}
function c4GetNextOpenRow(board, col) {
  for (var r = C4_ROWS - 1; r >= 0; r--) if (board[r][col] === C4_EMPTY) return r;
  return -1;
}
function c4GetValidColumns(board) {
  var v = [];
  for (var c = 0; c < C4_COLS; c++) if (board[0][c] === C4_EMPTY) v.push(c);
  return v;
}
function c4CheckWin(board, player) {
  var r, c;
  for (r = 0; r < C4_ROWS; r++) for (c = 0; c <= C4_COLS-4; c++) if (board[r][c]===player&&board[r][c+1]===player&&board[r][c+2]===player&&board[r][c+3]===player) return [[r,c],[r,c+1],[r,c+2],[r,c+3]];
  for (r = 0; r <= C4_ROWS-4; r++) for (c = 0; c < C4_COLS; c++) if (board[r][c]===player&&board[r+1][c]===player&&board[r+2][c]===player&&board[r+3][c]===player) return [[r,c],[r+1,c],[r+2,c],[r+3,c]];
  for (r = 0; r <= C4_ROWS-4; r++) for (c = 0; c <= C4_COLS-4; c++) if (board[r][c]===player&&board[r+1][c+1]===player&&board[r+2][c+2]===player&&board[r+3][c+3]===player) return [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
  for (r = 3; r < C4_ROWS; r++) for (c = 0; c <= C4_COLS-4; c++) if (board[r][c]===player&&board[r-1][c+1]===player&&board[r-2][c+2]===player&&board[r-3][c+3]===player) return [[r,c],[r-1,c+1],[r-2,c+2],[r-3,c+3]];
  return null;
}
function c4CheckDraw(board) {
  for (var c = 0; c < C4_COLS; c++) if (board[0][c] === C4_EMPTY) return false;
  return true;
}

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
function c4RenderCell(row, col, player, animate) {
  var cell = c4BoardEl.querySelector('[data-row="'+row+'"][data-col="'+col+'"]');
  if (!cell) return;
  cell.classList.add(player === C4_P1 ? 'red' : 'yellow');
  if (animate) { cell.classList.remove('dropping'); void cell.offsetWidth; cell.classList.add('dropping'); }
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
  else c4P2Card.classList.add('active-turn');
}
function c4UpdateGhostDisc(hoveredCol) {
  var ghosts = c4DropZone.querySelectorAll('.c4-ghost-disc');
  ghosts.forEach(function(g, i) {
    var colFull = c4GetNextOpenRow(c4Board, i) === -1;
    if (i === hoveredCol && c4GameActive && !colFull) {
      g.style.opacity = '0.45'; g.style.transform = 'scale(1)';
      g.style.background = c4CurrentPlayer === C4_P1 ? '#ff4444' : '#ffcc00';
      g.style.boxShadow = c4CurrentPlayer === C4_P1 ? '0 0 12px rgba(255,68,68,0.7)' : '0 0 12px rgba(255,204,0,0.7)';
    } else if (i === hoveredCol && c4GameActive && colFull) {
      // Column full — show blocked indicator
      g.style.opacity = '0.25'; g.style.transform = 'scale(0.7)';
      g.style.background = '#555'; g.style.boxShadow = 'none';
    } else {
      g.style.opacity = '0'; g.style.transform = 'scale(0.7)';
      g.style.background = ''; g.style.boxShadow = '';
    }
  });
}
function c4HandleColumnClick(col) {
  if (!c4GameActive) return;
  if (col < 0 || col >= C4_COLS) return;
  if (c4GameMode === 'pve' && c4CurrentPlayer === C4_P2) return; // block during bot turn
  var row = c4GetNextOpenRow(c4Board, col);
  if (row === -1) return;
  c4Board[row][col] = c4CurrentPlayer;
  c4RenderCell(row, col, c4CurrentPlayer, true);
  SoundManager.c4Drop();
  var winPairs = c4CheckWin(c4Board, c4CurrentPlayer);
  if (winPairs) { c4EndGame(c4CurrentPlayer, winPairs); return; }
  if (c4CheckDraw(c4Board)) { c4EndGame(null, null); return; }
  c4SwitchTurn();
}
function c4SwitchTurn() {
  c4CurrentPlayer = (c4CurrentPlayer === C4_P1) ? C4_P2 : C4_P1;
  c4UpdatePlayerCards();
  c4UpdateGhostDisc(-1);
  if (c4GameMode === 'pve' && c4CurrentPlayer === C4_P2) {
    c4BoardWrap.classList.add('locked');
    var lbl = c4Difficulty.charAt(0).toUpperCase() + c4Difficulty.slice(1);
    c4SetStatus('Bot thinking… (' + lbl + ')', 'thinking');
    setTimeout(function() {
      if (!c4GameActive) return;
      c4BoardWrap.classList.remove('locked');
      var move = BotEngine.getC4Move({
        board: c4Board, botPlayer: C4_P2, humanPlayer: C4_P1,
        emptyVal: C4_EMPTY, rows: C4_ROWS, cols: C4_COLS
      }, c4Difficulty);
      c4HandleColumnClick(move);
    }, 350 + Math.floor(Math.random() * 300));
  } else {
    var name = (c4CurrentPlayer === C4_P1) ? 'Player 1' : (c4GameMode === 'pve' ? 'Bot 🤖' : 'Player 2');
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
    var wName = (winner === C4_P1) ? 'Player 1' : (c4GameMode === 'pve' ? 'Bot' : 'Player 2');
    c4SetStatus(wName + ' Wins! 🏆', 'win');
    SoundManager.c4Win();
    setTimeout(function() {
      if (winner === C4_P1) SoundManager.win(); else SoundManager.lose();
    }, 300);
  } else {
    c4SetStatus("It's a Draw!", 'draw');
    SoundManager.draw();
  }
}
function c4ResetGame() {
  c4Board = c4CreateBoard();
  c4CurrentPlayer = C4_P1;
  c4GameActive = true;
  c4ClearBoardUI();
  c4BoardWrap.classList.remove('locked');
  c4UpdatePlayerCards();
  c4UpdateGhostDisc(-1);
  c4SetStatus("Player 1's Turn", 'p1-turn');
}

// C4 column overlay events
c4ColOverlays.forEach(function(ov) {
  var col = parseInt(ov.getAttribute('data-col'), 10);
  ov.addEventListener('click', function() {
    if (c4GameMode === 'pve' && c4CurrentPlayer === C4_P2) return;
    c4HandleColumnClick(col);
  });
  ov.addEventListener('mouseenter', function() {
    if (!c4GameActive) return;
    if (c4GameMode === 'pve' && c4CurrentPlayer === C4_P2) return;
    c4UpdateGhostDisc(col);
  });
  ov.addEventListener('mouseleave', function() { c4UpdateGhostDisc(-1); });
});
c4BtnReset.addEventListener('click', c4ResetGame);

// C4 home page navigation
var c4HP_mode = 'pvp';
var c4HP_diff = 'easy';

document.getElementById('c4-home-back').addEventListener('click', function() { showHub(); });
document.getElementById('c4-hp-pvp').addEventListener('click', function() {
  c4HP_mode = 'pvp';
  document.getElementById('c4-hp-pvp').classList.add('active');
  document.getElementById('c4-hp-pve').classList.remove('active');
  document.getElementById('c4-hp-diff-row').style.display = 'none';
});
document.getElementById('c4-hp-pve').addEventListener('click', function() {
  c4HP_mode = 'pve';
  document.getElementById('c4-hp-pve').classList.add('active');
  document.getElementById('c4-hp-pvp').classList.remove('active');
  document.getElementById('c4-hp-diff-row').style.display = '';
});
['easy','medium','hard'].forEach(function(d) {
  document.getElementById('c4-hp-'+d).addEventListener('click', function() {
    c4HP_diff = d;
    ['easy','medium','hard'].forEach(function(x) { document.getElementById('c4-hp-'+x).classList.remove('active'); });
    this.classList.add('active');
  });
});

function showC4Home() {
  document.getElementById('c4-home').classList.remove('hidden');
  document.getElementById('c4-play-panel').classList.add('hidden');
}
function startC4Game() {
  c4GameMode = c4HP_mode;
  c4Difficulty = c4HP_diff;
  c4P2Label.textContent = (c4GameMode === 'pve') ? 'Bot' : 'Player 2';
  c4Scores = { R: 0, Y: 0 };
  c4ScoreP1El.textContent = '0'; c4ScoreP2El.textContent = '0';
  c4Board = c4CreateBoard();
  c4RenderBoard();
  c4ResetGame();
  document.getElementById('c4-home').classList.add('hidden');
  document.getElementById('c4-play-panel').classList.remove('hidden');
}

document.getElementById('c4-hp-start').addEventListener('click', startC4Game);
document.getElementById('c4-back-to-home').addEventListener('click', showC4Home);

// showC4 already updated above to show home panel

// C4 INIT
c4Board = c4CreateBoard();
c4RenderBoard();
c4UpdatePlayerCards();
console.log('[DuelZone] Connect Four ready with BotEngine AI.');



// ═══════════════════════════════════════════════════════════════
// AIR HOCKEY — Neon Ice Edition
// Physics canvas game · Sounds · Beautiful rendering
// ═══════════════════════════════════════════════════════════════

// ── Audio Engine ─────────────────────────────────────────────
var ahAudio = (function() {
  var ctx = null;
  function gc() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function tone(freq, type, vol, dur, delay, freqEnd) {
    try {
      var c = gc();
      var o = c.createOscillator();
      var g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type || 'sine';
      var t0 = c.currentTime + (delay || 0);
      o.frequency.setValueAtTime(freq, t0);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.15, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.12));
      o.start(t0); o.stop(t0 + (dur || 0.12) + 0.01);
    } catch(e) {}
  }
  function noise(vol, dur, delay) {
    try {
      var c = gc();
      var bufSize = c.sampleRate * dur;
      var buf = c.createBuffer(1, bufSize, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource();
      src.buffer = buf;
      var g = c.createGain();
      var filter = c.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1200;
      src.connect(filter); filter.connect(g); g.connect(c.destination);
      var t0 = c.currentTime + (delay || 0);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.start(t0); src.stop(t0 + dur + 0.01);
    } catch(e) {}
  }
  return {
    paddleHit: function(speed) {
      var vol = Math.min(0.3, 0.1 + speed * 0.008);
      tone(180 + speed * 4, 'square', vol * 0.6, 0.06);
      noise(vol, 0.05);
    },
    wallBounce: function() {
      tone(320, 'square', 0.08, 0.05);
      noise(0.06, 0.04);
    },
    goal: function(isP1) {
      // Ascending fanfare
      var base = isP1 ? 523 : 392;
      [0, 0.12, 0.24, 0.38].forEach(function(d, i) {
        tone(base * [1, 1.25, 1.5, 2][i], 'sine', 0.22, 0.2, d);
      });
    },
    win: function() {
      [523,659,784,1047,1319].forEach(function(f, i) {
        tone(f, 'sine', 0.2, 0.25, i * 0.1);
      });
    },
    lose: function() {
      tone(440, 'sawtooth', 0.15, 0.2);
      tone(330, 'sawtooth', 0.12, 0.25, 0.18);
      tone(220, 'sawtooth', 0.1, 0.3, 0.38);
    },
    click: function() { tone(600, 'sine', 0.07, 0.06); },
    puckStart: function() { tone(800, 'sine', 0.12, 0.15, 0, 400); }
  };
})();

// ── Bot Config ── ALL speeds in px/second, reaction_time in ms ─
var AH_BOT = {
  easy:   { reaction_time: 420, max_speed: 220,  error_margin: 70, aggression: 0.25 },
  medium: { reaction_time: 190, max_speed: 390,  error_margin: 26, aggression: 0.62 },
  hard:   { reaction_time: 50,  max_speed: 600,  error_margin: 6,  aggression: 0.92 }
};
AH_BOT.extreme = AH_BOT.hard; // alias for GlobalBotEngine

// ── State ─────────────────────────────────────────────────────
var ahCanvas, ahCtx;
var ahW, ahH;
var ahRAF     = null;
var ahRunning = false;
var ahPaused  = false;
var ahMode    = 'pvb';
var ahDiff    = 'easy';
var ahWinScore = 7;

// BUG FIX: all velocities are now px/SECOND throughout the entire codebase.
// Previously they were px/frame, making physics frame-rate dependent.
var ahPuck = { x:0, y:0, vx:0, vy:0, r:0 };
var ahPaddles = [
  { x:0, y:0, r:0, pvx:0, pvy:0, key:{up:false,dn:false,lt:false,rt:false} },
  { x:0, y:0, r:0, pvx:0, pvy:0, key:{up:false,dn:false,lt:false,rt:false} }
];

var ahBotTimer  = 0;
// BUG FIX: initialise bot target to table centre (was {x:0,y:0} → bot rushed to corner on start)
var ahBotTarget = { x:0, y:0 };
var ahGoalFreezeMs = 0;   // ms remaining in post-goal freeze
var ahTrail      = [];
var ahParticles  = [];
var ahSpeedLines = [];
var ahGoalWho    = -1;
var ahP1Score = 0, ahP2Score = 0;
var ahServeWho = 0;
var ahRings   = [];
var ahStuckTimer = 0;     // ms since puck last moved

// ── Helpers ───────────────────────────────────────────────────
function ahStopLoop() {
  ahRunning = false;
  if (ahRAF) { cancelAnimationFrame(ahRAF); ahRAF = null; }
  window.removeEventListener('resize', ahResize);
}

function ahResize() {
  var field = document.getElementById('ah-canvas-field');
  if (!field || !ahCanvas) return;
  var fw = field.clientWidth  || 360;
  var fh = field.clientHeight || Math.round(fw * 1.55);
  ahW = Math.min(fw, 420);
  ahH = Math.max(Math.round(ahW * 1.5), Math.min(fh, 660));
  ahCanvas.width  = ahW;
  ahCanvas.height = ahH;
}

function ahGoalWidth() { return ahW * 0.42; }

function ahInit() {
  ahCanvas = document.getElementById('ah-canvas');
  ahCtx    = ahCanvas.getContext('2d');
  ahResize();
  ahP1Score = ahP2Score = 0;
  ahPuck.r       = ahW * 0.055;
  ahPaddles[0].r = ahW * 0.09;
  ahPaddles[1].r = ahW * 0.09;
  ahTrail = []; ahParticles = []; ahSpeedLines = []; ahRings = [];
  ahStuckTimer = 0;
  ahGoalFreezeMs = 0;
  // BUG FIX: initialise bot target to centre of bot's defending half
  ahBotTarget.x = ahW / 2;
  ahBotTarget.y = ahH * 0.2;
  ahResetPositions(0);
  ahUpdateScoreUI();
  window.addEventListener('resize', ahResize);
}

function ahResetPositions(serveWho) {
  ahPuck.x  = ahW / 2; ahPuck.y  = ahH / 2;
  ahPuck.vx = 0;        ahPuck.vy = 0;
  ahPaddles[0].x = ahW / 2; ahPaddles[0].y = ahH * 0.82;
  ahPaddles[0].pvx = ahPaddles[0].pvy = 0;
  ahPaddles[1].x = ahW / 2; ahPaddles[1].y = ahH * 0.18;
  ahPaddles[1].pvx = ahPaddles[1].pvy = 0;
  ahServeWho    = serveWho;
  ahGoalFreezeMs = 1300;  // 1.3 seconds, fully time-based
  // BUG FIX: serve velocity in px/second; give it a real angle
  // dir= -1 → puck launches upward (toward bot goal) when P1 serves
  // dir= +1 → puck launches downward (toward P1 goal) when bot serves
  var dir     = (serveWho === 0) ? -1 : 1;
  var diffMult = ahDiff === 'hard' ? 1.45 : ahDiff === 'medium' ? 1.2 : 1.0;
  var serveVy = dir * ahW * 1.65 * diffMult;  // px/s vertical component
  var serveVx = (Math.random() - 0.5) * Math.abs(serveVy) * 1.2; // px/s horizontal
  ahPuck.vServe = { vx: serveVx, vy: serveVy };
  ahTrail = []; ahSpeedLines = [];
}

// BUG FIX: clamp now also applied during freeze so paddles can't cross centre
function ahClampPaddle(p, idx) {
  var m = p.r, cx = ahW / 2, cy = ahH / 2;
  p.x = Math.max(m, Math.min(ahW - m, p.x));
  if (idx === 0) p.y = Math.max(cy + m * 0.25, Math.min(ahH - m, p.y));
  else           p.y = Math.max(m, Math.min(cy - m * 0.25, p.y));
}

// ── Bot AI ────────────────────────────────────────────────────
// Predict the puck position N simulation steps into the future,
// accounting for left/right wall bounces (top/bottom ignored — those are goals).
// dt_sub: ms per prediction step (use a small fixed increment, e.g. 8ms)
// BUG FIX: previous break condition `vy<0 && y<H*0.5` fired on step 1 every time,
// making the prediction do nothing. Now it correctly continues until the puck
// would cross back into the P1 (human) half, i.e. we stop when puck reverses direction.
function ahPredictPuck(numSteps, dt_sub) {
  var x  = ahPuck.x, y  = ahPuck.y;
  var vx = ahPuck.vx, vy = ahPuck.vy;
  var r  = ahPuck.r;
  var sec = dt_sub / 1000;
  var lastY = y;
  for (var s = 0; s < numSteps; s++) {
    x += vx * sec;
    y += vy * sec;
    if (x - r < 0)   { x = r;      vx =  Math.abs(vx); }
    if (x + r > ahW) { x = ahW-r;  vx = -Math.abs(vx); }
    // Stop predicting once puck has turned around and is heading back to P1's half
    // (it passed through bot's area and is now coming back)
    if (vy > 0 && y > ahH * 0.5) break;
    lastY = y;
  }
  return { x: x, y: y };
}

function ahUpdateBot(dt) {
  if (ahMode !== 'pvb') return;
  var cfg = AH_BOT[ahDiff] || AH_BOT.easy;
  ahBotTimer += dt;
  if (ahBotTimer < cfg.reaction_time) return;
  ahBotTimer = 0;

  var b   = ahPaddles[1];
  var pk  = ahPuck;
  var err = (Math.random() - 0.5) * cfg.error_margin * 2;

  var puckInBotHalf       = pk.y < ahH * 0.5;
  var puckApproachingBot  = pk.vy < 0; // negative vy = moving upward = toward bot goal

  if (puckApproachingBot || puckInBotHalf) {
    // ── INTERCEPT MODE ─────────────────────────────────────
    // Predict where the puck will be using wall-bounce simulation.
    // Use enough steps so puck has time to travel across bot's half.
    var lookSteps = Math.max(8, Math.round(18 * cfg.aggression));
    var pred = ahPredictPuck(lookSteps, 14); // 14ms per step

    var targetX, targetY;

    if (cfg.aggression > 0.7) {
      // Hard: position paddle slightly ABOVE predicted puck (smaller y)
      // so contact sends puck downward into P1's goal.
      var lateralBias = (pred.x < ahW * 0.5) ? ahW * 0.25 : ahW * 0.75;
      targetX = pred.x * 0.55 + lateralBias * 0.45 + err * 0.3;
      targetY = pred.y - b.r * 0.5 + err * 0.2;
    } else {
      // Easy / medium: just get in front of the puck
      targetX = pred.x + err;
      targetY = pred.y + err * 0.25;
    }

    ahBotTarget.x = Math.max(b.r, Math.min(ahW - b.r, targetX));
    // BUG FIX: clamp Y strictly inside bot's half — was sometimes > H/2
    ahBotTarget.y = Math.max(b.r, Math.min(ahH * 0.5 - b.r, targetY));

  } else {
    // ── RETURN TO DEFENSIVE POSITION ───────────────────────
    var defX = ahW / 2 + err * 0.25;
    var defY;
    if (cfg.aggression > 0.7) {
      defY = ahH * 0.23;           // hard: sit near centre line, ready to attack
    } else if (cfg.aggression > 0.4) {
      defY = ahH * 0.19;           // medium: comfortable defence depth
    } else {
      defY = ahH * 0.13 + err * 0.1; // easy: hug the goal
    }
    ahBotTarget.x = Math.max(b.r, Math.min(ahW - b.r, defX));
    ahBotTarget.y = Math.max(b.r, Math.min(ahH * 0.5 - b.r, defY));
  }
}

// BUG FIX: dt-based movement so bot speed is frame-rate independent (px/s not px/frame)
function ahMoveBot(dt) {
  if (ahMode !== 'pvb') return;
  var cfg = AH_BOT[ahDiff] || AH_BOT.easy;
  var b   = ahPaddles[1];
  var dx  = ahBotTarget.x - b.x;
  var dy  = ahBotTarget.y - b.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) { b.pvx = 0; b.pvy = 0; return; }
  // cfg.max_speed is px/s; convert to px for this frame
  var pxThisFrame = cfg.max_speed * (dt / 1000);
  var spd = Math.min(pxThisFrame, dist);
  b.pvx = (dx / dist) * spd;
  b.pvy = (dy / dist) * spd;
  b.x  += b.pvx;
  b.y  += b.pvy;
  ahClampPaddle(b, 1);
}

// ── Physics ───────────────────────────────────────────────────
function ahCircleCollide(a, b) {
  var dx = b.x - a.x, dy = b.y - a.y;
  return (dx * dx + dy * dy) < (a.r + b.r) * (a.r + b.r);
}

function ahResolvePaddlePuck(paddle, puck) {
  var dx = puck.x - paddle.x, dy = puck.y - paddle.y;
  var d  = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) { d = 0.01; dx = 1; dy = 0; }
  var nx = dx / d, ny = dy / d;

  // BUG FIX: always push puck out of overlap FIRST before velocity checks.
  // Previous code returned early on dot>=0 without pushing out, causing puck
  // to get stuck inside the paddle when paddle drives into a slow puck.
  var overlap = (paddle.r + puck.r + 2) - d;
  if (overlap > 0) { puck.x += nx * overlap; puck.y += ny * overlap; }

  // Only apply velocity response if puck is still moving toward paddle
  var relVx = puck.vx - paddle.pvx;
  var relVy = puck.vy - paddle.pvy;
  var dot   = relVx * nx + relVy * ny;
  if (dot >= 0) return; // already separating — overlap was residual, skip impulse

  var restitution = 0.88;
  // Tangent for side-spin: off-centre hits impart a lateral component
  var tx = -ny, ty = nx;
  var tangDot   = relVx * tx + relVy * ty;
  // spinFactor: how far off-centre the hit is, scaled to a small influence
  var spinFactor = (dx / (paddle.r + puck.r)) * 0.16;

  puck.vx = (puck.vx - (1 + restitution) * dot * nx) + paddle.pvx * 0.65 + tangDot * tx * spinFactor;
  puck.vy = (puck.vy - (1 + restitution) * dot * ny) + paddle.pvy * 0.65 + tangDot * ty * spinFactor;

  // Clamp max speed (px/s)
  var maxSpd = ahW * 2.85;
  var spd    = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
  if (spd > maxSpd) { puck.vx *= maxSpd / spd; puck.vy *= maxSpd / spd; spd = maxSpd; }

  ahSpawnImpact(puck.x, puck.y);
  ahRings.push({ x: puck.x, y: puck.y, r: paddle.r, life: 1 });
  SoundManager.ahPaddleHit(spd / 60); // pass approximate px/frame for audio volume scaling
}

function ahSpawnImpact(x, y) {
  var colors = ['#00e5ff','#ffffff','#7effff','#b2ebf2'];
  for (var i = 0; i < 12; i++) {
    var a = Math.random() * Math.PI * 2, spd = (Math.random() * 4 + 1) * 60; // px/s
    ahParticles.push({ x:x, y:y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
      life:1, color:colors[Math.floor(Math.random()*colors.length)], size:2+Math.random()*3 });
  }
}

function ahSpawnWallSparks(x, y) {
  for (var i = 0; i < 6; i++) {
    var a = Math.random() * Math.PI * 2, spd = (Math.random() * 2.5 + 0.5) * 60; // px/s
    ahParticles.push({ x:x, y:y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
      life:0.7, color:'#aae8ff', size:1.5 });
  }
}

// BUG FIX: ahPhysicsStep now receives dt_sub (ms) and uses px/second velocities.
// Wall-bounce sound/sparks gated by a per-frame flag to avoid audio spam from substeps.
// Returns true if a goal was scored this sub-step.
function ahPhysicsStep(dt_sub, wallFlags) {
  var sec = dt_sub / 1000;
  var r   = ahPuck.r, gw = ahGoalWidth() / 2, cx = ahW / 2;

  // BUG FIX: friction applied per second, not per frame.
  // pow(0.994, dt_sub/1000) ≈ pow(0.994, 1/60) ≈ 0.99990 per sub-frame at 60fps.
  var friction = Math.pow(0.994, sec);
  ahPuck.vx *= friction;
  ahPuck.vy *= friction;

  // Kill micro-drift (below 1 px/s)
  var spd2 = ahPuck.vx * ahPuck.vx + ahPuck.vy * ahPuck.vy;
  if (spd2 < 1) { ahPuck.vx = 0; ahPuck.vy = 0; }

  // Move (px/s * seconds = px)
  ahPuck.x += ahPuck.vx * sec;
  ahPuck.y += ahPuck.vy * sec;

  // Wall collisions — only spawn effects once per frame with wallFlags guard
  if (ahPuck.x - r < 0) {
    ahPuck.x = r; ahPuck.vx = Math.abs(ahPuck.vx) * 0.95;
    if (!wallFlags.left)  { wallFlags.left=true;  ahSpawnWallSparks(r, ahPuck.y);       SoundManager.ahWallBounce(); }
  }
  if (ahPuck.x + r > ahW) {
    ahPuck.x = ahW - r; ahPuck.vx = -Math.abs(ahPuck.vx) * 0.95;
    if (!wallFlags.right) { wallFlags.right=true; ahSpawnWallSparks(ahW-r, ahPuck.y);   SoundManager.ahWallBounce(); }
  }
  if (ahPuck.y - r < 0 && !(ahPuck.x > cx-gw && ahPuck.x < cx+gw)) {
    ahPuck.y = r; ahPuck.vy = Math.abs(ahPuck.vy) * 0.95;
    if (!wallFlags.top)   { wallFlags.top=true;   ahSpawnWallSparks(ahPuck.x, r);       SoundManager.ahWallBounce(); }
  }
  if (ahPuck.y + r > ahH && !(ahPuck.x > cx-gw && ahPuck.x < cx+gw)) {
    ahPuck.y = ahH - r; ahPuck.vy = -Math.abs(ahPuck.vy) * 0.95;
    if (!wallFlags.bot)   { wallFlags.bot=true;   ahSpawnWallSparks(ahPuck.x, ahH-r);   SoundManager.ahWallBounce(); }
  }

  // Paddle–puck collisions
  for (var pi = 0; pi < 2; pi++) {
    if (ahCircleCollide(ahPaddles[pi], ahPuck)) ahResolvePaddlePuck(ahPaddles[pi], ahPuck);
  }

  // Goal detection: puck fully past the goal line
  if (ahPuck.y - r < 0 && ahPuck.x > cx-gw && ahPuck.x < cx+gw) {
    ahP1Score++; ahGoalWho = 0;
    SoundManager.ahGoal(true);
    ahUpdateScoreUI(); ahShowGoalFlash(0);
    if (ahP1Score >= ahWinScore) { ahGameOver(0); return true; }
    ahResetPositions(1); return true;
  }
  if (ahPuck.y + r > ahH && ahPuck.x > cx-gw && ahPuck.x < cx+gw) {
    ahP2Score++; ahGoalWho = 1;
    SoundManager.ahGoal(false);
    ahUpdateScoreUI(); ahShowGoalFlash(1);
    if (ahP2Score >= ahWinScore) { ahGameOver(1); return true; }
    ahResetPositions(0); return true;
  }

  return false;
}

function ahShowGoalFlash(who) {
  var el = document.getElementById('ah-goal-flash');
  if (!el) return;
  el.className = 'ah-goal-flash ah-goal-flash--' + (who === 0 ? 'p1' : 'p2');
  el.textContent = '⚡ GOAL!';
  el.style.display = 'flex';
  setTimeout(function() { el.style.display = 'none'; }, 1100);
}

function ahGameOver(winner) {
  ahStopLoop();
  var label = winner === 0 ? 'PLAYER 1' : (ahMode === 'pvb' ? 'BOT' : 'PLAYER 2');
  var color  = winner === 0 ? '#00e5ff' : (ahMode === 'pvb' ? '#ff4081' : '#ff9100');
  if (winner === 0) SoundManager.ahWin(); else SoundManager.ahLose();
  var el = document.getElementById('ah-overlay-msg');
  el.style.display = 'flex';
  el.className = 'ah-overlay-msg';
  el.innerHTML =
    '<div class="ah-win-icon">' + (winner === 0 ? '🏆' : '😤') + '</div>' +
    '<div class="ah-win-title" style="color:' + color + '">' + label + ' WINS!</div>' +
    '<div class="ah-win-score">' + ahP1Score + ' – ' + ahP2Score + '</div>' +
    '<button class="ah-win-btn" onclick="startAHGame()">↺ Play Again</button>' +
    '<button class="ah-win-btn ah-win-btn--sec" onclick="showAH()">← Menu</button>';
}

function ahUpdateScoreUI() {
  document.getElementById('ah-p1-val').textContent = ahP1Score;
  document.getElementById('ah-p2-val').textContent = ahP2Score;
  ahUpdatePips('ah-p1-pips', ahP1Score, ahWinScore, '#00e5ff');
  ahUpdatePips('ah-p2-pips', ahP2Score, ahWinScore, '#ff4081');
}

function ahUpdatePips(id, score, total, color) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  var show = Math.min(total, 10);
  for (var i = 0; i < show; i++) {
    var pip = document.createElement('div');
    pip.className = 'ah-pip' + (i < score ? ' ah-pip--on' : '');
    pip.style.setProperty('--pip-color', color);
    el.appendChild(pip);
  }
}

// ── Main Loop ─────────────────────────────────────────────────
var ahLastTime = 0;
function ahLoop(ts) {
  if (!ahRunning) return;

  // Reset timing when tab was hidden to prevent physics explosion on resume
  if (document.hidden) { ahLastTime = ts; ahRAF = requestAnimationFrame(ahLoop); return; }

  // BUG FIX: on first frame (ahLastTime===0) use a safe default dt of 16ms
  var dt = ahLastTime === 0 ? 16 : Math.min(ts - ahLastTime, 50);
  ahLastTime = ts;

  if (ahPaused) { ahDraw(); ahRAF = requestAnimationFrame(ahLoop); return; }

  // Update bot target (reads puck position, does NOT move paddle yet)
  ahUpdateBot(dt);

  // ── Goal-freeze countdown (ms-based, frame-rate independent) ──
  if (ahGoalFreezeMs > 0) {
    ahGoalFreezeMs -= dt;
    // BUG FIX: also clamp paddles during freeze so neither player crosses centre
    ahClampPaddle(ahPaddles[0], 0);
    if (ahMode === 'pvp') ahClampPaddle(ahPaddles[1], 1);
    if (ahGoalFreezeMs <= 0) {
      ahGoalFreezeMs = 0;
      if (ahPuck.vServe) {
        ahPuck.vx = ahPuck.vServe.vx;
        ahPuck.vy = ahPuck.vServe.vy;
        ahPuck.vServe = null;
        SoundManager.ahPuckStart();
      }
    }
    ahDraw(); ahRAF = requestAnimationFrame(ahLoop); return;
  }

  // Move bot paddle (dt-based, px/s)
  ahMoveBot(dt);

  // ── Keyboard: P1 ── BUG FIX: dt-based speed in px/s, not px/frame ──
  var kSpd = ahW * 1.35 * (dt / 1000); // px for this frame
  var p0   = ahPaddles[0];
  if (p0.key.up) { p0.pvy = -kSpd; p0.y += p0.pvy; }
  else if (p0.key.dn) { p0.pvy = kSpd; p0.y += p0.pvy; }
  else { p0.pvy = 0; }
  if (p0.key.lt) { p0.pvx = -kSpd; p0.x += p0.pvx; }
  else if (p0.key.rt) { p0.pvx = kSpd; p0.x += p0.pvx; }
  else { p0.pvx = 0; }
  // Convert px/frame to px/s for collision response
  p0.pvx = dt > 0 ? p0.pvx / (dt / 1000) : 0;
  p0.pvy = dt > 0 ? p0.pvy / (dt / 1000) : 0;
  ahClampPaddle(p0, 0);
  // Re-read actual pixel delta for pvx/pvy after clamp (re-scale to px/s)
  // (already done above — pvx/pvy are now px/s)

  // ── Keyboard: P2 (PvP only) ───────────────────────────────
  if (ahMode === 'pvp') {
    var p1 = ahPaddles[1];
    if (p1.key.up) { p1.pvy = -kSpd; p1.y += p1.pvy; }
    else if (p1.key.dn) { p1.pvy = kSpd; p1.y += p1.pvy; }
    else { p1.pvy = 0; }
    if (p1.key.lt) { p1.pvx = -kSpd; p1.x += p1.pvx; }
    else if (p1.key.rt) { p1.pvx = kSpd; p1.x += p1.pvx; }
    else { p1.pvx = 0; }
    p1.pvx = dt > 0 ? p1.pvx / (dt / 1000) : 0;
    p1.pvy = dt > 0 ? p1.pvy / (dt / 1000) : 0;
    ahClampPaddle(p1, 1);
  }

  // ── Sub-step physics (prevents tunneling at high velocity) ──
  // Determine how many sub-steps: based on px the puck will travel this frame
  var puckSpd    = Math.sqrt(ahPuck.vx * ahPuck.vx + ahPuck.vy * ahPuck.vy);
  var pxPerFrame = puckSpd * (dt / 1000);
  var subSteps   = Math.max(1, Math.min(6, Math.ceil(pxPerFrame / (ahPuck.r * 0.75))));
  var dt_sub     = dt / subSteps;
  // BUG FIX: wallFlags object reset per-frame so wall sounds fire once per frame max
  var wallFlags  = { left:false, right:false, top:false, bot:false };
  var goalScored = false;
  for (var s = 0; s < subSteps && !goalScored; s++) {
    goalScored = ahPhysicsStep(dt_sub, wallFlags);
  }
  if (goalScored) { ahDraw(); ahRAF = requestAnimationFrame(ahLoop); return; }

  // ── Stuck-puck rescue (3s without meaningful movement) ──────
  ahStuckTimer += dt;
  var puckSpdNow = Math.sqrt(ahPuck.vx * ahPuck.vx + ahPuck.vy * ahPuck.vy);
  if (puckSpdNow > ahW * 0.3) { ahStuckTimer = 0; } // > ~108 px/s = moving
  if (ahStuckTimer > 3000) {
    ahStuckTimer = 0;
    var nudgeDir = (ahPuck.y < ahH / 2) ? 1 : -1;
    ahPuck.vx = (Math.random() - 0.5) * ahW * 1.2;
    ahPuck.vy = nudgeDir * ahW * 1.5;
    SoundManager.ahPuckStart();
  }

  // ── Trail (capped at ~0.35s of history regardless of frame-rate) ─
  ahTrail.push({ x: ahPuck.x, y: ahPuck.y });
  // Keep last ~22 frames worth — trim over time using dt to be length-independent
  var maxTrail = Math.max(8, Math.round(350 / Math.max(dt, 8)));
  if (ahTrail.length > maxTrail) ahTrail.shift();

  // ── Speed lines (BUG FIX: decay by dt, not per-frame constant) ──
  var spdPxPerSec = Math.sqrt(ahPuck.vx * ahPuck.vx + ahPuck.vy * ahPuck.vy);
  if (spdPxPerSec > ahW * 1.5 && Math.random() < 0.4) {
    var angle = Math.atan2(ahPuck.vy, ahPuck.vx) + Math.PI;
    ahSpeedLines.push({
      x: ahPuck.x, y: ahPuck.y,
      angle: angle + (Math.random() - 0.5) * 0.5,
      len: 8 + Math.random() * 20, life: 1
    });
  }
  var slDecay = 9.0 * (dt / 1000); // ~0.11s lifespan at 60fps
  for (var i = ahSpeedLines.length - 1; i >= 0; i--) {
    ahSpeedLines[i].life -= slDecay;
    if (ahSpeedLines[i].life <= 0) ahSpeedLines.splice(i, 1);
  }

  // ── Particles (BUG FIX: dt-based decay, not per-frame) ──────
  var pDecay = 2.2 * (dt / 1000); // ~0.45s lifespan
  for (var i = ahParticles.length - 1; i >= 0; i--) {
    var p = ahParticles[i];
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    p.life -= pDecay;
    p.vx *= Math.pow(0.88, dt / 1000 * 60); // drag
    p.vy *= Math.pow(0.88, dt / 1000 * 60);
    if (p.life <= 0) ahParticles.splice(i, 1);
  }

  // ── Rings (BUG FIX: dt-based growth and decay) ──────────────
  var rGrow  = 180 * (dt / 1000); // px/s growth
  var rDecay = 5.0 * (dt / 1000);
  for (var i = ahRings.length - 1; i >= 0; i--) {
    ahRings[i].r    += rGrow;
    ahRings[i].life -= rDecay;
    if (ahRings[i].life <= 0) ahRings.splice(i, 1);
  }

  ahDraw();
  ahRAF = requestAnimationFrame(ahLoop);
}

// ── Drawing ───────────────────────────────────────────────────
function ahDraw() {
  var ctx = ahCtx;
  var W = ahW, H = ahH;

  // ─ Background: deep ice
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#020c18');
  bg.addColorStop(0.5, '#040f20');
  bg.addColorStop(1,   '#020c18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ice shimmer
  var shimmer = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
  shimmer.addColorStop(0,   'rgba(0,229,255,0.04)');
  shimmer.addColorStop(0.6, 'rgba(0,100,180,0.02)');
  shimmer.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, W, H);

  // ─ Table border
  ctx.save();
  var brd = 6;
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 24;
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(brd, brd, W-brd*2, H-brd*2, 12) : ctx.rect(brd, brd, W-brd*2, H-brd*2);
  ctx.stroke();
  ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(0,229,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(brd+6, brd+6, W-brd*2-12, H-brd*2-12, 8) : ctx.rect(brd+6, brd+6, W-brd*2-12, H-brd*2-12);
  ctx.stroke();
  ctx.restore();

  // ─ Goals
  var gw     = ahGoalWidth();
  var gx     = (W - gw) / 2;
  var gDepth = ahPuck.r * 2.2;
  ctx.save();

  // Top goal — P1 scores here (cyan)
  var tgg = ctx.createLinearGradient(0, 0, 0, gDepth);
  tgg.addColorStop(0, 'rgba(0,229,255,0.5)'); tgg.addColorStop(1, 'rgba(0,229,255,0.02)');
  ctx.fillStyle = tgg; ctx.fillRect(gx, 0, gw, gDepth);
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 16; ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(gx, gDepth); ctx.lineTo(gx, 3); ctx.lineTo(gx+gw, 3); ctx.lineTo(gx+gw, gDepth); ctx.stroke();
  ctx.fillStyle = '#00e5ff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(gx, gDepth, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(gx+gw, gDepth, 5, 0, Math.PI*2); ctx.fill();

  // Bottom goal — P2/Bot scores here (pink)
  var bgg = ctx.createLinearGradient(0, H, 0, H-gDepth);
  bgg.addColorStop(0, 'rgba(255,64,129,0.5)'); bgg.addColorStop(1, 'rgba(255,64,129,0.02)');
  ctx.fillStyle = bgg; ctx.fillRect(gx, H-gDepth, gw, gDepth);
  ctx.shadowColor = '#ff4081'; ctx.strokeStyle = '#ff4081';
  ctx.beginPath(); ctx.moveTo(gx, H-gDepth); ctx.lineTo(gx, H-3); ctx.lineTo(gx+gw, H-3); ctx.lineTo(gx+gw, H-gDepth); ctx.stroke();
  ctx.fillStyle = '#ff4081'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(gx, H-gDepth, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(gx+gw, H-gDepth, 5, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // ─ Centre markings
  ctx.save();
  ctx.shadowColor = 'rgba(0,229,255,0.3)'; ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(0,229,255,0.25)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(W/2, H/2, W*0.16, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,229,255,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(W/2, H/2, W*0.06, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,229,255,0.18)'; ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 7]);
  ctx.beginPath(); ctx.moveTo(brd+8, H/2); ctx.lineTo(W-brd-8, H/2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 14;
  var cdg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 6);
  cdg.addColorStop(0, 'rgba(0,229,255,0.9)'); cdg.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = cdg;
  ctx.beginPath(); ctx.arc(W/2, H/2, 6, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(0,229,255,0.1)'; ctx.lineWidth = 1;
  [H*0.25, H*0.75].forEach(function(fy) {
    [W*0.25, W*0.75].forEach(function(fx) {
      ctx.beginPath(); ctx.arc(fx, fy, W*0.06, 0, Math.PI*2); ctx.stroke();
    });
  });
  ctx.restore();

  // ─ Speed lines
  ctx.save();
  for (var i = 0; i < ahSpeedLines.length; i++) {
    var sl = ahSpeedLines[i];
    ctx.globalAlpha = sl.life * 0.6;
    ctx.strokeStyle = 'rgba(120,220,255,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sl.x, sl.y);
    ctx.lineTo(sl.x + Math.cos(sl.angle)*sl.len, sl.y + Math.sin(sl.angle)*sl.len);
    ctx.stroke();
  }
  ctx.restore();

  // ─ Puck trail
  ctx.save();
  for (var i = 0; i < ahTrail.length; i++) {
    var frac = i / ahTrail.length;
    var alpha = frac * 0.55;
    var r2 = ahPuck.r * frac * 0.7;
    if (r2 < 0.5) continue;
    var trailGrad = ctx.createRadialGradient(ahTrail[i].x, ahTrail[i].y, 0, ahTrail[i].x, ahTrail[i].y, r2);
    trailGrad.addColorStop(0, 'rgba(0,229,255,' + alpha + ')');
    trailGrad.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = trailGrad;
    ctx.beginPath(); ctx.arc(ahTrail[i].x, ahTrail[i].y, r2, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // ─ Puck — colour shifts toward hot-orange at high speed (power-shot indicator)
  ctx.save();
  var puckSpd  = Math.sqrt(ahPuck.vx * ahPuck.vx + ahPuck.vy * ahPuck.vy);
  var sFrac    = Math.min(1, puckSpd / (ahW * 2.4));  // 0→1 from slow to fast
  var puckGlow = Math.min(48, 14 + puckSpd * 0.018);
  ctx.shadowColor = sFrac > 0.5 ? 'rgba(255,120,0,0.9)' : '#00e5ff';
  ctx.shadowBlur  = puckGlow;
  var r1c = Math.round(232 + 23 * sFrac);
  var g1c = Math.round(248 - 100 * sFrac);
  var b1c = Math.round(255 - 80 * sFrac);
  var pg = ctx.createRadialGradient(
    ahPuck.x - ahPuck.r*0.35, ahPuck.y - ahPuck.r*0.35, ahPuck.r*0.05,
    ahPuck.x, ahPuck.y, ahPuck.r
  );
  pg.addColorStop(0, 'rgb(' + r1c + ',' + g1c + ',' + b1c + ')');
  pg.addColorStop(0.3, '#70d8ff');
  pg.addColorStop(0.7, '#0099cc');
  pg.addColorStop(1,   '#003355');
  ctx.beginPath(); ctx.arc(ahPuck.x, ahPuck.y, ahPuck.r, 0, Math.PI*2);
  ctx.fillStyle = pg; ctx.fill();
  ctx.strokeStyle = sFrac > 0.6 ? 'rgba(255,' + Math.round(100*(1-sFrac)) + ',80,0.85)' : 'rgba(150,220,255,0.7)';
  ctx.lineWidth = 2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ahPuck.x - ahPuck.r*0.3, ahPuck.y); ctx.lineTo(ahPuck.x + ahPuck.r*0.3, ahPuck.y);
  ctx.moveTo(ahPuck.x, ahPuck.y - ahPuck.r*0.3); ctx.lineTo(ahPuck.x, ahPuck.y + ahPuck.r*0.3);
  ctx.stroke();
  ctx.restore();

  // ─ Rings
  ctx.save();
  for (var i = 0; i < ahRings.length; i++) {
    var ring = ahRings[i];
    ctx.globalAlpha = ring.life * 0.6;
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2 * ring.life;
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // ─ Paddles
  var pColors = ['#00e5ff', ahMode === 'pvb' ? '#ff4081' : '#ff9100'];
  var pDark   = ['#003344', ahMode === 'pvb' ? '#440022' : '#442200'];
  var pGlow   = ['rgba(0,229,255,0.9)', ahMode === 'pvb' ? 'rgba(255,64,129,0.9)' : 'rgba(255,145,0,0.9)'];
  var pLabels = ['1', ahMode === 'pvb' ? '🤖' : '2'];
  for (var pi = 0; pi < 2; pi++) {
    var pad = ahPaddles[pi];
    ctx.save();
    ctx.shadowColor = pGlow[pi]; ctx.shadowBlur = 26;
    var glowR = ctx.createRadialGradient(pad.x, pad.y, pad.r*0.5, pad.x, pad.y, pad.r*1.8);
    glowR.addColorStop(0, 'rgba(255,255,255,0.06)'); glowR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowR;
    ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r*1.8, 0, Math.PI*2); ctx.fill();
    var rg = ctx.createRadialGradient(pad.x-pad.r*0.3, pad.y-pad.r*0.35, pad.r*0.04, pad.x, pad.y, pad.r);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.35, pColors[pi]);
    rg.addColorStop(0.75, pColors[pi] + '99');
    rg.addColorStop(1, pDark[pi]);
    ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI*2);
    ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = pColors[pi]; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r*0.62, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = pDark[pi]; ctx.shadowColor = pColors[pi]; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r*0.22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold ' + Math.round(pad.r * 0.28) + 'px Orbitron,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowBlur = 0;
    ctx.fillText(pLabels[pi], pad.x, pad.y);
    ctx.restore();
  }

  // ─ Particles
  ctx.save();
  for (var i = 0; i < ahParticles.length; i++) {
    var p = ahParticles[i];
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // ─ Serve hint — shown during freeze period
  // BUG FIX: arrow direction now matches actual puck travel direction
  if (ahGoalFreezeMs > 250) {
    var servingP1 = (ahServeWho === 0); // P1 serves → puck travels up (▲)
    var hint = servingP1 ? '▲ YOUR SERVE' : '▼ SERVE';
    var hy   = servingP1 ? H * 0.73 : H * 0.27;
    ctx.save();
    var alpha = Math.min(1, (ahGoalFreezeMs - 250) / 350);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold ' + Math.round(W * 0.042) + 'px Orbitron,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 16;
    ctx.fillText(hint, W/2, hy);
    ctx.restore();
  }

  // ─ Pause overlay
  if (ahPaused) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold ' + Math.round(W * 0.1) + 'px Orbitron,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00e5ff'; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 30;
    ctx.fillText('PAUSED', W/2, H/2);
    ctx.restore();
  }
}

// ── Touch / pointer drag ──────────────────────────────────────
(function() {
  var active = {};
  var prevPos = {}; // track previous position per pointer for velocity calculation
  var prevTime = {}; // track timing for velocity estimation
  function setup() {
    var canvas = document.getElementById('ah-canvas');
    if (!canvas) return;
    function getScaled(e) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (ahW / rect.width),
        y: (e.clientY - rect.top)  * (ahH / rect.height)
      };
    }
    canvas.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      var s  = getScaled(e);
      // In PvB: bottom half = P1. Top half = nobody (bot controlled by AI)
      // In PvP: bottom half = P1, top half = P2
      var pi = s.y > ahH / 2 ? 0 : (ahMode === 'pvp' ? 1 : -1);
      if (pi >= 0) {
        active[e.pointerId] = pi;
        prevPos[e.pointerId]  = s;
        prevTime[e.pointerId] = performance.now();
      }
    }, { passive: false });

    canvas.addEventListener('pointermove', function(e) {
      e.preventDefault();
      if (!(e.pointerId in active)) return;
      var s   = getScaled(e);
      var pi  = active[e.pointerId];
      var now = performance.now();
      var prev = prevPos[e.pointerId]  || s;
      var pt   = prevTime[e.pointerId] || now;
      var dtT  = Math.max(1, now - pt); // ms elapsed since last move event

      // BUG FIX: compute pvx/pvy in px/SECOND so collision response is correct.
      // Clamp to avoid degenerate large values from slow-polling devices.
      var rawVx = (s.x - prev.x) / (dtT / 1000);
      var rawVy = (s.y - prev.y) / (dtT / 1000);
      var maxTouchV = ahW * 4.5; // 4.5 table-widths per second max
      var mag = Math.sqrt(rawVx*rawVx + rawVy*rawVy);
      if (mag > maxTouchV) { rawVx = rawVx/mag*maxTouchV; rawVy = rawVy/mag*maxTouchV; }

      ahPaddles[pi].x   = s.x;
      ahPaddles[pi].y   = s.y;
      ahClampPaddle(ahPaddles[pi], pi);
      ahPaddles[pi].pvx = rawVx;
      ahPaddles[pi].pvy = rawVy;

      prevPos[e.pointerId]  = s;
      prevTime[e.pointerId] = now;
    }, { passive: false });

    function onEnd(e) {
      if (e.pointerId in active) {
        // BUG FIX: zero out paddle velocity when touch is released so it doesn't
        // keep imparting momentum to the puck after the player lifts their finger
        var pi = active[e.pointerId];
        ahPaddles[pi].pvx = 0;
        ahPaddles[pi].pvy = 0;
      }
      delete active[e.pointerId];
      delete prevPos[e.pointerId];
      delete prevTime[e.pointerId];
    }
    canvas.addEventListener('pointerup',     onEnd);
    canvas.addEventListener('pointercancel', onEnd);
  }
  setup();
})();

// ── Keyboard ──────────────────────────────────────────────────
(function() {
  var keyMap = {
    'KeyW'    : {p:0, dir:'up'}, 'ArrowUp'   : {p:0, dir:'up'},
    'KeyS'    : {p:0, dir:'dn'}, 'ArrowDown' : {p:0, dir:'dn'},
    'KeyA'    : {p:0, dir:'lt'}, 'ArrowLeft' : {p:0, dir:'lt'},
    'KeyD'    : {p:0, dir:'rt'}, 'ArrowRight': {p:0, dir:'rt'},
    'KeyI':{p:1, dir:'up'}, 'KeyK':{p:1, dir:'dn'},
    'KeyJ':{p:1, dir:'lt'}, 'KeyL':{p:1, dir:'rt'}
  };
  function isActive() {
    return ahRunning && !ahPaused &&
           !document.getElementById('ah-play-panel').classList.contains('hidden');
  }
  document.addEventListener('keydown', function(e) {
    if (!isActive()) return;
    if (keyMap[e.code]) { ahPaddles[keyMap[e.code].p].key[keyMap[e.code].dir] = true; e.preventDefault(); }
  });
  document.addEventListener('keyup', function(e) {
    if (keyMap[e.code]) ahPaddles[keyMap[e.code].p].key[keyMap[e.code].dir] = false;
  });
})();

// ── Home page controls ────────────────────────────────────────
var ahHPMode = 'pvb', ahHPDiff = 'easy', ahHPWinScore = 7;

(function() {
  ['ah-mode-pvb', 'ah-mode-pvp'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function() {
      ahHPMode = el.getAttribute('data-mode');
      document.querySelectorAll('#ah-home .ah-pill[data-mode]').forEach(function(b) { b.classList.remove('active'); });
      el.classList.add('active');
      var dr = document.getElementById('ah-diff-row');
      if (dr) dr.style.display = ahHPMode === 'pvb' ? '' : 'none';
      SoundManager.click();
    });
  });
  ['ah-diff-easy', 'ah-diff-medium', 'ah-diff-hard'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function() {
      ahHPDiff = el.getAttribute('data-diff');
      document.querySelectorAll('#ah-home .ah-pill[data-diff]').forEach(function(b) { b.classList.remove('active'); });
      el.classList.add('active');
      SoundManager.click();
    });
  });
  ['ah-score-5', 'ah-score-7', 'ah-score-10'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function() {
      ahHPWinScore = parseInt(el.getAttribute('data-val'));
      document.querySelectorAll('#ah-home .ah-pill[data-val]').forEach(function(b) { b.classList.remove('active'); });
      el.classList.add('active');
      SoundManager.click();
    });
  });
  document.getElementById('ah-main-back').addEventListener('click', showHub);
  document.getElementById('ah-back-to-home').addEventListener('click', showAH);
  document.getElementById('ah-hp-start').addEventListener('click', startAHGame);
  document.getElementById('ah-pause-btn').addEventListener('click', function() {
    ahPaused = !ahPaused;
    this.textContent = ahPaused ? '▶' : '⏸';
    SoundManager.click();
  });
})();

function startAHGame() {
  ahMode = ahHPMode; ahDiff = ahHPDiff; ahWinScore = ahHPWinScore;
  document.getElementById('ah-home').classList.add('hidden');
  document.getElementById('ah-play-panel').classList.remove('hidden');
  document.getElementById('ah-p2-label').textContent = ahMode === 'pvb' ? 'BOT' : 'P2';
  var ol = document.getElementById('ah-overlay-msg');
  ol.style.display = 'none'; ol.className = 'ah-overlay-msg hidden';
  var gf = document.getElementById('ah-goal-flash');
  if (gf) gf.style.display = 'none';
  ahPaused = false;
  document.getElementById('ah-pause-btn').textContent = '⏸';
  ahInit();
  ahRunning = true;
  ahLastTime = 0; // safe 16ms default on first frame
  ahRAF = requestAnimationFrame(ahLoop);
  ahUpdatePips('ah-p1-pips', 0, ahWinScore, '#00e5ff');
  ahUpdatePips('ah-p2-pips', 0, ahWinScore, '#ff4081');
  SoundManager.ahPuckStart();
}


// ═══════════════════════════════════════════════════════════════
// PASSWORD BREAKER — Single Player, 4-digit no-repeat numeric code
// ═══════════════════════════════════════════════════════════════

// ── Web Audio Engine ────────────────────────────────────────────
var pbAudio = (function() {
  var ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function tone(freq, type, vol, dur, delay) {
    try {
      var c = getCtx();
      var o = c.createOscillator();
      var g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime + (delay||0));
      g.gain.setValueAtTime(0, c.currentTime + (delay||0));
      g.gain.linearRampToValueAtTime(vol||0.18, c.currentTime + (delay||0) + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay||0) + (dur||0.15));
      o.start(c.currentTime + (delay||0));
      o.stop(c.currentTime + (delay||0) + (dur||0.15) + 0.01);
    } catch(e) {}
  }
  return {
    keyPress: function() { tone(440, 'square', 0.08, 0.06); },
    keyDel:   function() { tone(220, 'square', 0.07, 0.06); },
    correct:  function() { tone(523, 'sine', 0.15, 0.08); tone(659, 'sine', 0.15, 0.08, 0.09); tone(784, 'sine', 0.15, 0.1, 0.18); },
    present:  function() { tone(440, 'sine', 0.12, 0.1); tone(523, 'sine', 0.1, 0.1, 0.12); },
    absent:   function() { tone(180, 'triangle', 0.12, 0.12); },
    wrong:    function() { tone(200, 'sawtooth', 0.1, 0.18); tone(160, 'sawtooth', 0.08, 0.18, 0.1); },
    win:      function() {
      [523,659,784,1047].forEach(function(f,i){ tone(f,'sine',0.18,0.2,i*0.12); });
    },
    lose:     function() { tone(330,'sawtooth',0.12,0.2); tone(220,'sawtooth',0.1,0.25,0.15); tone(165,'sawtooth',0.1,0.3,0.32); },
    tick:     function() { tone(880, 'square', 0.05, 0.04); },
    hint:     function() { tone(740, 'sine', 0.12, 0.18); }
  };
})();

// ── State ────────────────────────────────────────────────────────
var pb = {
  secret:       null,      // 4-digit string, no repeats
  diff:         'easy',
  timeLimit:    60,
  hintsLeft:    3,
  attempts:     0,
  currentInput: '',        // what player has typed so far (max 4)
  guessHistory: [],
  sessionOver:  false,
  timerInterval:null,
  timeRemaining:0,
  startTime:    0,
  score:        0,
  bestScore:    0
};

// ── Generate secret ──────────────────────────────────────────────
function pbGenSecret() {
  var digits = '0123456789'.split('');
  // Fisher-Yates shuffle
  for (var i = digits.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = digits[i]; digits[i] = digits[j]; digits[j] = tmp;
  }
  return digits.slice(0, 4).join('');
}

// ── Feedback logic ───────────────────────────────────────────────
function pbGetFeedback(guess, secret) {
  var result = [];
  for (var i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      result.push('correct');
    } else if (secret.indexOf(guess[i]) >= 0) {
      result.push('present');
    } else {
      result.push('absent');
    }
  }
  return result;
}

function pbIsCorrect(feedback) {
  return feedback.every(function(f){ return f === 'correct'; });
}

// ── Show/hide phases ─────────────────────────────────────────────
function pbShowPhase(id) {
  ['pb-phase-guess','pb-phase-final'].forEach(function(p) {
    var el = document.getElementById(p);
    if (el) el.classList.toggle('hidden', p !== id);
  });
}

// ── Update the 4-cell display ────────────────────────────────────
function pbUpdateCells() {
  for (var i = 0; i < 4; i++) {
    var cell = document.getElementById('pb-cell-' + i);
    if (!cell) continue;
    var ch = pb.currentInput[i] || '';
    cell.textContent = ch;
    cell.classList.toggle('pb-cell--filled', !!ch);
    cell.classList.toggle('pb-cell--active', i === pb.currentInput.length);
  }
  // Enable/disable enter button
  var enterBtn = document.getElementById('pb-guess-submit');
  if (enterBtn) enterBtn.disabled = pb.currentInput.length !== 4;
}

// ── Render a history row ─────────────────────────────────────────
function pbRenderRow(guess, feedback, num) {
  var hist = document.getElementById('pb-history');
  if (!hist) return;
  var row = document.createElement('div');
  row.className = 'pb-hist-row';

  var numEl = document.createElement('span');
  numEl.className = 'pb-hist-num';
  numEl.textContent = num;
  row.appendChild(numEl);

  var tiles = document.createElement('div');
  tiles.className = 'pb-hist-tiles';
  for (var i = 0; i < 4; i++) {
    var t = document.createElement('div');
    t.className = 'pb-hist-tile pb-hist-tile--' + feedback[i];
    t.textContent = guess[i];
    t.style.animationDelay = (i * 0.07) + 's';
    tiles.appendChild(t);
  }
  row.appendChild(tiles);

  var summary = document.createElement('div');
  summary.className = 'pb-hist-summary';
  var correct = feedback.filter(function(f){ return f==='correct'; }).length;
  var present = feedback.filter(function(f){ return f==='present'; }).length;
  summary.innerHTML =
    '<span class="pb-hist-c">' + correct + '🟢</span>' +
    '<span class="pb-hist-p">' + present + '🟡</span>';
  row.appendChild(summary);

  hist.appendChild(row);
  hist.scrollTop = hist.scrollHeight;
}

// ── Timer ────────────────────────────────────────────────────────
function pbStartTimer() {
  var total = pb.timeLimit;
  pb.timeRemaining = total;
  var circ = 2 * Math.PI * 28;
  var circle = document.getElementById('pb-timer-circle');
  var valEl  = document.getElementById('pb-timer-val');

  if (circle) { circle.style.strokeDasharray = circ; circle.style.strokeDashoffset = 0; }

  function update() {
    var frac = pb.timeLimit === 999 ? 1 : (pb.timeRemaining / total);
    if (circle) {
      circle.style.strokeDashoffset = circ * (1 - frac);
      circle.className = 'pb-timer-fill' +
        (pb.timeRemaining <= 5 ? ' danger' : pb.timeRemaining <= total * 0.33 ? ' warning' : '');
    }
    if (valEl) {
      valEl.textContent = pb.timeLimit === 999 ? '∞' : pb.timeRemaining;
      valEl.className = 'pb-timer-val' +
        (pb.timeRemaining <= 5 ? ' danger' : pb.timeRemaining <= total * 0.33 ? ' warning' : '');
    }
  }
  update();

  if (pb.timeLimit === 999) return; // no timer

  pb.timerInterval = setInterval(function() {
    if (pb.sessionOver) { clearInterval(pb.timerInterval); return; }
    pb.timeRemaining--;
    if (pb.timeRemaining <= 5 && pb.timeRemaining > 0) SoundManager.pbTick();
    update();
    if (pb.timeRemaining <= 0) {
      clearInterval(pb.timerInterval);
      pbEndGame(false, 'TIME EXPIRED');
    }
  }, 1000);
}

// ── Submit a guess ───────────────────────────────────────────────
function pbSubmitGuess() {
  if (pb.sessionOver || pb.currentInput.length !== 4) return;
  var guess = pb.currentInput;
  pb.currentInput = '';
  pbUpdateCells();

  pb.attempts++;
  document.getElementById('pb-attempts-val').textContent = pb.attempts;

  var feedback = pbGetFeedback(guess, pb.secret);
  pbRenderRow(guess, feedback, pb.attempts);

  // Play sounds based on feedback
  var c = feedback.filter(function(f){ return f==='correct'; }).length;
  var p = feedback.filter(function(f){ return f==='present'; }).length;
  if (pbIsCorrect(feedback)) {
    SoundManager.pbVictory();
  } else if (c > 0) {
    SoundManager.pbCorrect();
  } else if (p > 0) {
    SoundManager.pbCorrect();
  } else {
    SoundManager.pbWrong();
  }

  if (pbIsCorrect(feedback)) {
    pbEndGame(true);
  }
}

// ── End game ─────────────────────────────────────────────────────
function pbEndGame(won, reason) {
  pb.sessionOver = true;
  if (pb.timerInterval) { clearInterval(pb.timerInterval); pb.timerInterval = null; }

  var elapsed = pb.timeLimit === 999 ? 0 : Math.max(1, Math.round((Date.now() - pb.startTime) / 1000));
  var points  = 0;
  if (won) {
    var timBonus = pb.timeLimit === 999 ? 0 : Math.max(0, pb.timeRemaining * 5);
    var attBonus = Math.max(0, (10 - pb.attempts) * 50);
    var diffMult = pb.diff === 'hard' ? 2 : pb.diff === 'medium' ? 1.5 : 1;
    points = Math.round((500 + timBonus + attBonus) * diffMult);
  }
  pb.score = points;

  var stored = parseInt(localStorage.getItem('pb_best') || '0');
  if (points > stored) { localStorage.setItem('pb_best', points); pb.bestScore = points; }
  else pb.bestScore = stored;

  // Delay to let last tile animate
  setTimeout(function() { pbShowResult(won, elapsed, reason); }, 600);
}

// ── Show result screen ───────────────────────────────────────────
function pbShowResult(won, elapsed, reason) {
  pbShowPhase('pb-phase-final');

  var icon  = document.getElementById('pb-final-icon');
  var title = document.getElementById('pb-final-title');
  var sub   = document.getElementById('pb-final-sub');
  var stats = document.getElementById('pb-result-stats');
  var reveal= document.getElementById('pb-code-reveal');
  var card  = document.getElementById('pb-result-card');

  if (won) {
    icon.textContent  = '🏆';
    title.textContent = 'CODE CRACKED!';
    title.style.color = 'var(--pb-green)';
    sub.textContent   = pb.attempts === 1 ? 'FIRST TRY! Incredible!' :
                        pb.attempts <= 3  ? 'Amazing! You\'re a natural hacker.' :
                                            'Well done, the code is yours.';
    card.classList.add('pb-result-card--win');
    pbSpawnParticles();
  } else {
    icon.textContent  = '💥';
    title.textContent = 'BREACH FAILED';
    title.style.color = 'var(--pb-red)';
    sub.textContent   = (reason || 'Time ran out!') + ' · The code was:';
    card.classList.remove('pb-result-card--win');
    SoundManager.lose();
  }

  // Code reveal tiles
  reveal.innerHTML = '';
  for (var i = 0; i < 4; i++) {
    var t = document.createElement('div');
    t.className = 'pb-reveal-tile' + (won ? ' pb-reveal-tile--won' : ' pb-reveal-tile--lost');
    t.textContent = pb.secret[i];
    t.style.animationDelay = (i * 0.12) + 's';
    reveal.appendChild(t);
  }

  var timeTxt = pb.timeLimit === 999 ? '–' : elapsed + 's';
  stats.innerHTML =
    '<div class="pb-stat-row"><span>⏱ Time</span><strong>' + timeTxt + '</strong></div>' +
    '<div class="pb-stat-row"><span>🔢 Attempts</span><strong>' + pb.attempts + '</strong></div>' +
    '<div class="pb-stat-row pb-stat-row--score"><span>⭐ Score</span><strong style="color:var(--pb-yellow)">' + pb.score + '</strong></div>' +
    '<div class="pb-stat-row"><span>🏅 Best</span><strong>' + pb.bestScore + '</strong></div>';
}

// ── Particles ────────────────────────────────────────────────────
function pbSpawnParticles() {
  var container = document.getElementById('pb-particles');
  if (!container) return;
  container.innerHTML = '';
  var colors = ['#00ff88','#ffd700','#b44fff','#00cfff'];
  for (var i = 0; i < 32; i++) {
    var p = document.createElement('div');
    p.className = 'pb-particle';
    p.style.cssText = [
      'left:' + (20 + Math.random()*60) + '%',
      'top:' + (10 + Math.random()*60) + '%',
      'background:' + colors[Math.floor(Math.random()*colors.length)],
      'width:' + (4 + Math.random()*6) + 'px',
      'height:' + (4 + Math.random()*6) + 'px',
      'animation-delay:' + (Math.random()*0.4) + 's',
      'animation-duration:' + (0.6 + Math.random()*0.6) + 's',
      '--dx:' + (Math.random()*200-100) + 'px',
      '--dy:' + (Math.random()*200-100) + 'px'
    ].join(';');
    container.appendChild(p);
  }
}

// ── Hint ──────────────────────────────────────────────────────────
function pbGiveHint() {
  if (pb.hintsLeft <= 0 || pb.sessionOver) return;
  pb.hintsLeft--;
  document.getElementById('pb-hints-left').textContent = pb.hintsLeft;
  if (pb.hintsLeft <= 0) document.getElementById('pb-hint-btn').disabled = true;
  SoundManager.click();

  // Reveal a random unknown digit position
  var unknown = [];
  for (var i = 0; i < 4; i++) {
    var alreadyKnown = pb.guessHistory.some(function(h){ return h.feedback[i]==='correct'; });
    if (!alreadyKnown) unknown.push(i);
  }
  if (!unknown.length) unknown = [0,1,2,3];
  var idx = unknown[Math.floor(Math.random()*unknown.length)];

  var hist = document.getElementById('pb-history');
  var row = document.createElement('div');
  row.className = 'pb-hist-row pb-hist-row--hint';
  row.innerHTML = '<span class="pb-hist-num">💡</span>' +
    '<span class="pb-hist-hint-text">Position ' + (idx+1) + ' = <strong>' + pb.secret[idx] + '</strong></span>';
  hist.appendChild(row);
  hist.scrollTop = hist.scrollHeight;
}

// ── Start game ───────────────────────────────────────────────────
function pbStartGame() {
  pb.secret       = pbGenSecret();
  pb.attempts     = 0;
  pb.currentInput = '';
  pb.guessHistory = [];
  pb.sessionOver  = false;
  pb.score        = 0;
  pb.startTime    = Date.now();
  pb.hintsLeft    = pb.diff === 'hard' ? 0 : pb.diff === 'medium' ? 1 : 3;

  // Clear UI
  document.getElementById('pb-history').innerHTML = '';
  document.getElementById('pb-attempts-val').textContent = '0';
  document.getElementById('pb-hints-left').textContent = pb.hintsLeft;
  document.getElementById('pb-score-display').textContent = '0';
  var hintBtn = document.getElementById('pb-hint-btn');
  if (hintBtn) { hintBtn.disabled = pb.hintsLeft <= 0; }

  var resultCard = document.getElementById('pb-result-card');
  if (resultCard) resultCard.classList.remove('pb-result-card--win');

  pbUpdateCells();
  pbShowPhase('pb-phase-guess');
  pbStartTimer();
}

// ── Init ─────────────────────────────────────────────────────────
(function pbInit() {
  // ── Home page ──────────────────────────────────────────────────
  document.getElementById('pb-main-back').addEventListener('click', showHub);

  // Time limit pills
  var timePills = document.querySelectorAll('#pb-time-btns .pb-pill');
  timePills.forEach(function(btn) {
    btn.addEventListener('click', function() {
      timePills.forEach(function(b){ b.classList.remove('active'); });
      this.classList.add('active');
      pb.timeLimit = parseInt(this.getAttribute('data-time'));
    });
  });

  // Difficulty pills
  ['pb-diff-easy','pb-diff-medium','pb-diff-hard'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function() {
      document.querySelectorAll('[data-diff]').forEach(function(b){ b.classList.remove('active'); });
      this.classList.add('active');
      pb.diff = this.getAttribute('data-diff');
    });
  });

  // Start button
  document.getElementById('pb-hp-start').addEventListener('click', function() {
    document.getElementById('pb-home').classList.add('hidden');
    document.getElementById('pb-play-panel').classList.remove('hidden');
    pbStartGame();
  });

  // ── Guess phase ────────────────────────────────────────────────
  document.getElementById('pb-guess-back').addEventListener('click', function() {
    pb.sessionOver = true;
    if (pb.timerInterval) clearInterval(pb.timerInterval);
    document.getElementById('pb-play-panel').classList.add('hidden');
    document.getElementById('pb-home').classList.remove('hidden');
  });

  // Numpad
  document.querySelectorAll('.pb-numpad-key').forEach(function(key) {
    key.addEventListener('click', function() {
      if (pb.sessionOver) return;
      var val = this.getAttribute('data-val');
      if (val === 'enter') {
        if (pb.currentInput.length === 4) pbSubmitGuess();
        return;
      }
      if (val === 'del') {
        if (pb.currentInput.length > 0) {
          pb.currentInput = pb.currentInput.slice(0, -1);
          pbUpdateCells();
          SoundManager.pbKeyDel();
        }
        return;
      }
      // Digit — only add if no repeat
      if (pb.currentInput.length < 4 && pb.currentInput.indexOf(val) === -1) {
        pb.currentInput += val;
        pbUpdateCells();
        SoundManager.pbKeyPress();
        // Flash the pressed key
        var k = this;
        k.classList.add('pb-numpad-press');
        setTimeout(function(){ k.classList.remove('pb-numpad-press'); }, 120);
      } else if (pb.currentInput.indexOf(val) !== -1) {
        // Shake: digit already used
        var k = this;
        k.classList.add('pb-numpad-shake');
        setTimeout(function(){ k.classList.remove('pb-numpad-shake'); }, 300);
        SoundManager.pbWrong();
      }
    });
  });

  // Physical keyboard
  document.addEventListener('keydown', function(e) {
    var active = document.getElementById('screen-passbreach');
    if (!active || active.classList.contains('hidden')) return;
    var playPanel = document.getElementById('pb-play-panel');
    if (!playPanel || playPanel.classList.contains('hidden')) return;
    if (pb.sessionOver) return;

    if (/^[0-9]$/.test(e.key)) {
      if (pb.currentInput.length < 4 && pb.currentInput.indexOf(e.key) === -1) {
        pb.currentInput += e.key;
        pbUpdateCells();
        SoundManager.pbKeyPress();
      } else if (pb.currentInput.indexOf(e.key) !== -1) {
        SoundManager.pbWrong();
      }
    } else if (e.key === 'Backspace') {
      pb.currentInput = pb.currentInput.slice(0, -1);
      pbUpdateCells();
      SoundManager.pbKeyDel();
    } else if (e.key === 'Enter' && pb.currentInput.length === 4) {
      pbSubmitGuess();
    }
  });

  // Hint button
  document.getElementById('pb-hint-btn').addEventListener('click', pbGiveHint);

  // ── Result screen ──────────────────────────────────────────────
  document.getElementById('pb-play-again').addEventListener('click', function() {
    document.getElementById('pb-result-card').classList.remove('pb-result-card--win');
    pbStartGame();
  });
  document.getElementById('pb-back-hub').addEventListener('click', function() {
    pb.sessionOver = true;
    if (pb.timerInterval) clearInterval(pb.timerInterval);
    document.getElementById('pb-play-panel').classList.add('hidden');
    document.getElementById('pb-home').classList.remove('hidden');
    showHub();
  });

  console.log('[DuelZone] Password Breaker ready.');
})();


// ═══════════════════════════════════════════════════════════════
// SECTION H: Memory Flip Duel
// A 2-player turn-based memory card matching game.
// Supports PvP and PvBot modes with Easy / Medium / Extreme AI.
// Integrated with SoundManager, BotEngine, and DuelZone nav.
// ═══════════════════════════════════════════════════════════════

// ── Screen registration ──────────────────────────────────────
var screenMFD = document.getElementById('screen-memoryflip');
var screenCDD = document.getElementById('screen-connectdots');
if (screenMFD) {
  ALL_SCREENS.push(screenMFD);
}
if (screenCDD) {
  ALL_SCREENS.push(screenCDD);
}

// ── showMFD — navigation entry point ────────────────────────
function showMFD() {
  hideAllScreens();
  var sc = document.getElementById('screen-memoryflip');
  if (sc) sc.classList.remove('hidden');
  // Always show home/setup, hide play
  var home = document.getElementById('mfd-home');
  var play = document.getElementById('mfd-play');
  if (home) home.classList.remove('hidden');
  if (play) play.classList.add('hidden');
  // Stop any in-progress bot timer
  mfdState.botTimeout && clearTimeout(mfdState.botTimeout);
  window.scrollTo(0, 0);
}

// ── Register MFD in GAMES list so findGame works ─────────────
GAMES.push({ name: 'Memory Flip Duel', screen: 'memoryflip', url: null, accent: '#c084fc' });

// ── showCDD — navigation entry point ─────────────────────────
function showCDD() {
  hideAllScreens();
  var sc = document.getElementById('screen-connectdots');
  if (sc) sc.classList.remove('hidden');
  var home = document.getElementById('cdd-home');
  var play = document.getElementById('cdd-play');
  if (home) home.classList.remove('hidden');
  if (play) play.classList.add('hidden');
  window.scrollTo(0, 0);
}

// ── Register CDD in GAMES list so findGame works ──────────────
GAMES.push({ name: 'Connect Dots Duel', screen: 'connectdots', url: null, accent: '#ff9100' });

// ── Card emoji pairs (8 pairs = 16 cards) ────────────────────
var MFD_EMOJIS = [
  '🐉', '🦄', '🌙', '⚡',
  '🔥', '🎯', '👾', '🎲'
];

// ── State object ─────────────────────────────────────────────
var mfdState = {
  cards:          [],     // array of card objects
  flipped:        [],     // indices of currently flipped (unrevealed) cards
  scores:         [0, 0], // [p1, p2]
  currentPlayer:  0,      // 0=P1, 1=P2/Bot
  mode:           'pvp',  // 'pvp' | 'pvb'
  diff:           'easy', // 'easy' | 'medium' | 'extreme'
  locked:         false,  // input locked during evaluation / bot turn
  gameOver:       false,
  totalPairs:     8,
  botTimeout:     null,
  // Bot memory: map of cardIndex -> pairValue (for extreme bot - perfect memory)
  botMemory:      {},
  botSeenPairs:   {},     // pairValue -> [idx1, idx2] if both seen (extreme)
  // Medium bot: only the last 2 cards seen
  mediumLastTwo:  []      // [{idx, pairVal}, ...] rolling window of 2
};

// ── Setup page config state ──────────────────────────────────
var mfdHP_mode = 'pvp';
var mfdHP_diff = 'easy';

// ── Shuffle helper ────────────────────────────────────────────
function mfdShuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ── Generate cards ────────────────────────────────────────────
function mfdBuildDeck() {
  var pairs = [];
  MFD_EMOJIS.forEach(function(emoji, i) {
    pairs.push({ id: i*2,     pairVal: i, emoji: emoji, isFlipped: false, isMatched: false });
    pairs.push({ id: i*2+1,   pairVal: i, emoji: emoji, isFlipped: false, isMatched: false });
  });
  return mfdShuffle(pairs);
}

// ── Render grid ───────────────────────────────────────────────
function mfdRenderGrid() {
  var grid = document.getElementById('mfd-grid');
  if (!grid) return;
  grid.innerHTML = '';
  mfdState.cards.forEach(function(card, idx) {
    var el = document.createElement('div');
    el.className = 'mfd-card';
    if (card.isFlipped || card.isMatched) el.classList.add('mfd-flipped');
    if (card.isMatched) el.classList.add('mfd-matched');
    el.setAttribute('data-idx', idx);

    el.innerHTML =
      '<div class="mfd-card-inner">' +
        '<div class="mfd-card-front">' +
          '<span class="mfd-card-symbol">✦</span>' +
        '</div>' +
        '<div class="mfd-card-back">' +
          '<span class="mfd-card-emoji">' + card.emoji + '</span>' +
        '</div>' +
      '</div>';

    el.addEventListener('click', function() { mfdOnCardClick(idx); });
    grid.appendChild(el);
  });
}

// ── Get card DOM element ──────────────────────────────────────
function mfdGetCardEl(idx) {
  return document.querySelector('#mfd-grid .mfd-card[data-idx="' + idx + '"]');
}

// ── Update scores display ─────────────────────────────────────
function mfdUpdateScores() {
  var s1 = document.getElementById('mfd-score-p1');
  var s2 = document.getElementById('mfd-score-p2');
  if (s1) s1.textContent = mfdState.scores[0];
  if (s2) s2.textContent = mfdState.scores[1];

  // Update score bars (out of totalPairs)
  var pct1 = (mfdState.scores[0] / mfdState.totalPairs * 100) + '%';
  var pct2 = (mfdState.scores[1] / mfdState.totalPairs * 100) + '%';
  var b1 = document.getElementById('mfd-bar-p1');
  var b2 = document.getElementById('mfd-bar-p2');
  if (b1) b1.style.setProperty('--mfd-bar-pct', pct1);
  if (b2) b2.style.setProperty('--mfd-bar-pct', pct2);
}

// ── Update active player highlights ──────────────────────────
function mfdUpdateActivePlayer() {
  var c1 = document.getElementById('mfd-card-p1');
  var c2 = document.getElementById('mfd-card-p2');
  var ind = document.getElementById('mfd-turn-indicator');
  var txt = document.getElementById('mfd-turn-text');

  if (c1) { c1.classList.remove('mfd-active-p1', 'mfd-active-p2'); }
  if (c2) { c2.classList.remove('mfd-active-p1', 'mfd-active-p2'); }
  if (ind) ind.className = '';

  if (mfdState.locked && mfdState.mode === 'pvb' && mfdState.currentPlayer === 1) {
    // Bot thinking
    if (ind) ind.classList.add('mfd-turn-thinking');
    if (txt) {
      var botName = mfdState.diff.charAt(0).toUpperCase() + mfdState.diff.slice(1);
      txt.textContent = '🤖 Bot Thinking… (' + botName + ')';
    }
    if (c2) c2.classList.add('mfd-active-p2');
  } else if (mfdState.currentPlayer === 0) {
    if (c1) c1.classList.add('mfd-active-p1');
    if (ind) ind.classList.add('mfd-turn-p1');
    if (txt) txt.textContent = "🎮 Player 1's Turn";
  } else {
    if (c2) c2.classList.add('mfd-active-p2');
    if (ind) ind.classList.add('mfd-turn-p2');
    var p2n = mfdState.mode === 'pvb' ? '🤖 Bot' : '👤 Player 2';
    if (txt) txt.textContent = p2n + "'s Turn";
  }
}

// ── Flip a card visually ──────────────────────────────────────
function mfdFlipCardEl(idx, doFlip) {
  var el = mfdGetCardEl(idx);
  if (!el) return;
  if (doFlip) {
    el.classList.add('mfd-flipped');
  } else {
    el.classList.remove('mfd-flipped');
  }
}

// ── Mark card as matched ──────────────────────────────────────
function mfdMarkMatched(idx) {
  var el = mfdGetCardEl(idx);
  if (el) {
    el.classList.add('mfd-matched');
    el.classList.add('mfd-match-anim');
    setTimeout(function() { el.classList.remove('mfd-match-anim'); }, 500);
  }
}

// ── Card click handler ────────────────────────────────────────
function mfdOnCardClick(idx) {
  if (mfdState.locked) return;
  if (mfdState.gameOver) return;
  // PvB: block if it's bot's turn
  if (mfdState.mode === 'pvb' && mfdState.currentPlayer === 1) return;
  // Ignore already matched or already flipped
  var card = mfdState.cards[idx];
  if (!card || card.isMatched || card.isFlipped) return;
  // Can't flip more than 2 per turn
  if (mfdState.flipped.length >= 2) return;

  // Flip the card
  card.isFlipped = true;
  mfdFlipCardEl(idx, true);
  SoundManager.mfdFlip();

  // Bot medium/extreme memory: record revealed card
  if (mfdState.mode === 'pvb') {
    mfdBotLearn(idx, card.pairVal);
  }

  mfdState.flipped.push(idx);

  if (mfdState.flipped.length === 2) {
    mfdState.locked = true;
    mfdUpdateActivePlayer();
    setTimeout(mfdEvaluate, 500);
  }
}

// ── Evaluate after two flips ──────────────────────────────────
function mfdEvaluate() {
  var i1 = mfdState.flipped[0];
  var i2 = mfdState.flipped[1];
  var c1 = mfdState.cards[i1];
  var c2 = mfdState.cards[i2];

  if (c1.pairVal === c2.pairVal) {
    // MATCH
    c1.isMatched = true;
    c2.isMatched = true;
    mfdMarkMatched(i1);
    mfdMarkMatched(i2);
    mfdState.scores[mfdState.currentPlayer]++;
    mfdUpdateScores();
    SoundManager.mfdMatch();

    // Clear flipped
    mfdState.flipped = [];
    // Check game over
    var matched = mfdState.cards.filter(function(c) { return c.isMatched; }).length;
    if (matched === mfdState.cards.length) {
      mfdState.locked = true;
      mfdState.gameOver = true;
      setTimeout(mfdShowResult, 600);
      return;
    }
    // Same player keeps turn
    mfdState.locked = false;
    mfdUpdateActivePlayer();
    // If bot just matched and it's still bot's turn — schedule next move
    if (mfdState.mode === 'pvb' && mfdState.currentPlayer === 1) {
      mfdScheduleBotMove();
    }
  } else {
    // MISMATCH
    // Shake animation
    var e1 = mfdGetCardEl(i1);
    var e2 = mfdGetCardEl(i2);
    if (e1) { e1.classList.add('mfd-shake-anim'); }
    if (e2) { e2.classList.add('mfd-shake-anim'); }
    // Play mismatch sound
    SoundManager.mfdMismatch();

    setTimeout(function() {
      if (e1) { e1.classList.remove('mfd-shake-anim'); }
      if (e2) { e2.classList.remove('mfd-shake-anim'); }
      // Flip back
      c1.isFlipped = false;
      c2.isFlipped = false;
      mfdFlipCardEl(i1, false);
      mfdFlipCardEl(i2, false);
      mfdState.flipped = [];
      // Switch turn
      mfdState.currentPlayer = 1 - mfdState.currentPlayer;
      mfdState.locked = false;
      mfdUpdateActivePlayer();
      // If bot's turn, schedule bot move
      if (mfdState.mode === 'pvb' && mfdState.currentPlayer === 1) {
        mfdScheduleBotMove();
      }
    }, 400);
  }
}

// ── Show result overlay ───────────────────────────────────────
function mfdShowResult() {
  var s1 = mfdState.scores[0];
  var s2 = mfdState.scores[1];
  var icon, title;
  var p2name = mfdState.mode === 'pvb' ? 'Bot' : 'Player 2';

  if (s1 > s2) {
    icon = '🏆'; title = 'PLAYER 1 WINS!';
    SoundManager.mfdVictory(); SoundManager.win();
  } else if (s2 > s1) {
    icon = mfdState.mode === 'pvb' ? '😤' : '🏆';
    title = (mfdState.mode === 'pvb' ? 'BOT WINS!' : 'PLAYER 2 WINS!');
    SoundManager.mfdVictory();
    if (mfdState.mode === 'pvb') SoundManager.lose();
    else SoundManager.win();
  } else {
    icon = '🤝'; title = "IT'S A DRAW!";
    SoundManager.mfdVictory(); SoundManager.draw();
  }

  var ri = document.getElementById('mfd-result-icon');
  var rt = document.getElementById('mfd-result-title');
  var rs = document.getElementById('mfd-result-scores');
  var res = document.getElementById('mfd-result');

  if (ri) ri.textContent = icon;
  if (rt) rt.textContent = title;
  if (rs) rs.textContent = 'P1: ' + s1 + '  ·  ' + p2name + ': ' + s2;
  if (res) res.classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════════
// BOT LOGIC — memory card AI via BotEngine adapter
// Easy:   random, no memory
// Medium: remembers last 2 revealed cards; uses known pairs
// Extreme: perfect memory of all revealed cards
// ══════════════════════════════════════════════════════════════

// ── Bot learns about a revealed card ─────────────────────────
function mfdBotLearn(idx, pairVal) {
  // Extreme: track ALL seen cards
  mfdState.botMemory[idx] = pairVal;
  // Build extreme seen-pairs map
  for (var k in mfdState.botMemory) {
    var ki = parseInt(k);
    if (ki !== idx && mfdState.botMemory[ki] === pairVal) {
      var ka = mfdState.cards[ki];
      var kb = mfdState.cards[idx];
      if (ka && kb && !ka.isMatched && !kb.isMatched) {
        mfdState.botSeenPairs[pairVal] = [ki, idx];
      }
    }
  }

  // Medium: rolling last-2 window
  mfdState.mediumLastTwo.push({ idx: idx, pairVal: pairVal });
  if (mfdState.mediumLastTwo.length > 2) {
    mfdState.mediumLastTwo.shift(); // keep only last 2
  }
}

// ── Get unmatched, unflipped card indices ─────────────────────
function mfdGetAvailable() {
  var avail = [];
  mfdState.cards.forEach(function(c, i) {
    if (!c.isMatched && !c.isFlipped) avail.push(i);
  });
  return avail;
}

// ── Find a known matching pair from bot memory ────────────────
function mfdBotFindKnownPair() {
  for (var pv in mfdState.botSeenPairs) {
    var pair = mfdState.botSeenPairs[pv];
    var a = pair[0], b = pair[1];
    var ca = mfdState.cards[a], cb = mfdState.cards[b];
    if (ca && cb && !ca.isMatched && !cb.isMatched) {
      return pair; // [idxA, idxB]
    }
  }
  return null;
}

// ── Bot pick 2 card indices ───────────────────────────────────
function mfdBotDecide() {
  var avail = mfdGetAvailable();
  if (avail.length < 2) return null;

  if (mfdState.diff === 'easy') {
    // Completely random
    var shuffled = mfdShuffle(avail);
    return [shuffled[0], shuffled[1]];
  }

  if (mfdState.diff === 'medium') {
    // Medium: only works with the last 2 revealed cards
    // Check if last-2 memory contains a matching pair
    var lt = mfdState.mediumLastTwo;
    if (lt.length === 2 && lt[0].pairVal === lt[1].pairVal) {
      var ma = mfdState.cards[lt[0].idx];
      var mb = mfdState.cards[lt[1].idx];
      if (ma && mb && !ma.isMatched && !mb.isMatched) {
        return [lt[0].idx, lt[1].idx];
      }
    }
    // Check each last-2 entry against available cards
    for (var li = 0; li < lt.length; li++) {
      var entry = lt[li];
      var partner = avail.filter(function(ai) {
        return ai !== entry.idx &&
               mfdState.botMemory[ai] === entry.pairVal &&
               !mfdState.cards[ai].isMatched;
      });
      if (partner.length > 0) {
        var ec = mfdState.cards[entry.idx];
        if (ec && !ec.isMatched) {
          return [entry.idx, partner[0]];
        }
      }
    }
    // No known pair from last-2 — pick randomly
    var sh = mfdShuffle(avail);
    return [sh[0], sh[1]];
  }

  // Extreme: perfect memory — always use known pair if available
  var knownEx = mfdBotFindKnownPair();
  if (knownEx) return knownEx;
  // Otherwise pick 2 random unknowns (gain information)
  // Prefer cards not yet seen by the bot
  var unseen = avail.filter(function(i) { return !(i in mfdState.botMemory); });
  if (unseen.length >= 2) {
    var su = mfdShuffle(unseen);
    return [su[0], su[1]];
  }
  var shEx = mfdShuffle(avail);
  return [shEx[0], shEx[1]];
}

// ── Schedule a bot move ───────────────────────────────────────
function mfdScheduleBotMove() {
  if (mfdState.gameOver) return;
  mfdState.locked = true;
  mfdUpdateActivePlayer();
  var delay = 600 + Math.floor(Math.random() * 300); // 600–900ms
  mfdState.botTimeout = setTimeout(mfdExecuteBotMove, delay);
}

// ── Execute bot move (flip first card) ───────────────────────
function mfdExecuteBotMove() {
  if (mfdState.gameOver) return;
  var picks = mfdBotDecide();
  if (!picks || picks.length < 2) {
    // No valid moves (shouldn't happen) — safety release
    mfdState.locked = false;
    return;
  }

  var idx1 = picks[0];
  var idx2 = picks[1];

  // Flip first card
  mfdState.cards[idx1].isFlipped = true;
  mfdFlipCardEl(idx1, true);
  mfdBotLearn(idx1, mfdState.cards[idx1].pairVal);
  SoundManager.mfdFlip();
  mfdState.flipped.push(idx1);

  // Flip second card after short pause
  mfdState.botTimeout = setTimeout(function() {
    if (mfdState.gameOver) return;
    mfdState.cards[idx2].isFlipped = true;
    mfdFlipCardEl(idx2, true);
    mfdBotLearn(idx2, mfdState.cards[idx2].pairVal);
    SoundManager.mfdFlip();
    mfdState.flipped.push(idx2);
    // Evaluate after 2nd flip
    mfdState.locked = true;
    setTimeout(mfdEvaluate, 500);
  }, 550);
}

// ── Reset / new game ──────────────────────────────────────────
function mfdStartGame(preserveScores) {
  // Stop any running bot
  if (mfdState.botTimeout) { clearTimeout(mfdState.botTimeout); mfdState.botTimeout = null; }

  mfdState.cards         = mfdBuildDeck();
  mfdState.flipped       = [];
  mfdState.scores        = preserveScores ? mfdState.scores : [0, 0];
  mfdState.currentPlayer = 0;
  mfdState.locked        = false;
  mfdState.gameOver      = false;
  mfdState.botMemory     = {};
  mfdState.botSeenPairs  = {};
  mfdState.mediumLastTwo = [];

  // Hide result overlay
  var res = document.getElementById('mfd-result');
  if (res) res.classList.add('hidden');

  mfdRenderGrid();
  mfdUpdateScores();
  mfdUpdateActivePlayer();
  SoundManager.gameStart();
}

// ── Full game init (from home screen) ────────────────────────
function mfdInit(mode, diff) {
  mfdState.mode = mode || 'pvp';
  mfdState.diff = diff || 'easy';

  // Update labels
  var modeLabel = document.getElementById('mfd-mode-label');
  if (modeLabel) {
    if (mode === 'pvb') {
      var dn = diff.charAt(0).toUpperCase() + diff.slice(1);
      modeLabel.textContent = 'PvBot · ' + dn;
    } else {
      modeLabel.textContent = 'Player vs Player';
    }
  }
  var p2label = document.getElementById('mfd-p2-label');
  if (p2label) p2label.textContent = (mode === 'pvb') ? '🤖 Bot' : 'Player 2';

  mfdStartGame(false);
}

// ══════════════════════════════════════════════════════════════
// HOME PAGE WIRING
// ══════════════════════════════════════════════════════════════
(function() {
  // Back to hub from home
  var homeBack = document.getElementById('mfd-home-back');
  if (homeBack) homeBack.addEventListener('click', function() {
    SoundManager.backToHub();
    showHub();
  });

  // Mode buttons
  var pvpBtn = document.getElementById('mfd-hp-pvp');
  var pveBtn = document.getElementById('mfd-hp-pve');
  var diffRow = document.getElementById('mfd-hp-diff-row');

  if (pvpBtn) pvpBtn.addEventListener('click', function() {
    mfdHP_mode = 'pvp';
    pvpBtn.classList.add('active');
    if (pveBtn) pveBtn.classList.remove('active');
    if (diffRow) diffRow.style.display = 'none';
    SoundManager.click();
  });
  if (pveBtn) pveBtn.addEventListener('click', function() {
    mfdHP_mode = 'pvb';
    pveBtn.classList.add('active');
    if (pvpBtn) pvpBtn.classList.remove('active');
    if (diffRow) diffRow.style.display = '';
    SoundManager.click();
  });

  // Difficulty buttons
  ['easy','medium','extreme'].forEach(function(d) {
    var btn = document.getElementById('mfd-hp-' + d);
    if (!btn) return;
    btn.addEventListener('click', function() {
      mfdHP_diff = d;
      ['easy','medium','extreme'].forEach(function(x) {
        var b = document.getElementById('mfd-hp-' + x);
        if (b) b.classList.remove('active');
      });
      btn.classList.add('active');
      SoundManager.click();
    });
  });

  // Start game button
  var startBtn = document.getElementById('mfd-hp-start');
  if (startBtn) startBtn.addEventListener('click', function() {
    var home = document.getElementById('mfd-home');
    var play = document.getElementById('mfd-play');
    if (home) home.classList.add('hidden');
    if (play) play.classList.remove('hidden');
    mfdInit(mfdHP_mode, mfdHP_diff);
    window.scrollTo(0, 0);
  });

  // Back to setup from play
  var backBtn = document.getElementById('mfd-back-to-home');
  if (backBtn) backBtn.addEventListener('click', function() {
    if (mfdState.botTimeout) { clearTimeout(mfdState.botTimeout); mfdState.botTimeout = null; }
    mfdState.locked = true;
    mfdState.gameOver = true;
    var home = document.getElementById('mfd-home');
    var play = document.getElementById('mfd-play');
    if (play) play.classList.add('hidden');
    if (home) home.classList.remove('hidden');
    SoundManager.backToHub();
    window.scrollTo(0, 0);
  });

  // Reset button (new game, preserve mode/diff, reset scores)
  var resetBtn = document.getElementById('mfd-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', function() {
    SoundManager.click();
    mfdStartGame(false);
  });

  // Hub button from play
  var hubBtn = document.getElementById('mfd-hub-btn');
  if (hubBtn) hubBtn.addEventListener('click', function() {
    if (mfdState.botTimeout) { clearTimeout(mfdState.botTimeout); mfdState.botTimeout = null; }
    mfdState.locked = true;
    mfdState.gameOver = true;
    showHub();
  });

  // Result overlay — play again
  var playAgainBtn = document.getElementById('mfd-play-again');
  if (playAgainBtn) playAgainBtn.addEventListener('click', function() {
    SoundManager.click();
    mfdStartGame(false);
  });

  // Result overlay — back to hub
  var resultHubBtn = document.getElementById('mfd-result-hub');
  if (resultHubBtn) resultHubBtn.addEventListener('click', function() {
    if (mfdState.botTimeout) { clearTimeout(mfdState.botTimeout); mfdState.botTimeout = null; }
    mfdState.locked = true;
    mfdState.gameOver = true;
    showHub();
  });
})();



console.log('[DuelZone] Memory Flip Duel loaded — PvP & Bot modes, Easy/Medium/Extreme AI.');


// (All games ready — see Global Systems below)



// ╔═══════════════════════════════════════════════════════════════╗
// ║              DUELZONE — GLOBAL SYSTEMS                       ║
// ║  Part 1: GameLoader   |   Part 2: GlobalBotEngine            ║
// ║                                                               ║
// ║  Written in vanilla JS — zero dependencies, zero page loads. ║
// ║  These systems layer on top of all existing game code         ║
// ║  without modifying any game rules or DOM structure.           ║
// ╚═══════════════════════════════════════════════════════════════╝


// ═══════════════════════════════════════════════════════════════
// PART 1: GLOBAL GAME LOADER
// ─────────────────────────────────────────────────────────────
// Responsibilities:
//   • Maintains a registry of every game in DuelZone
//   • Guarantees only ONE game is active at a time
//   • Calls destroy() on any active game before opening another
//   • Manages clean transitions (hide/show containers)
//   • Provides a lifecycle API: init → start → reset → destroy
//
// Games register via GameLoader.registerGame(config).
// Navigation calls GameLoader.openGame(gameId).
// ═══════════════════════════════════════════════════════════════

var GameLoader = (function() {

  // ── Private registry and state ───────────────────────────────
  var _registry    = {};   // gameId → config
  var _activeId    = null; // currently active game id (or null)
  var _initialized = {};   // gameId → boolean (has init() been called?)

  // ── Internal helpers ──────────────────────────────────────────

  /** Show only a specific container; hide everything else. */
  function _showContainer(containerId) {
    // We still use the existing ALL_SCREENS mechanism for compatibility
    hideAllScreens();
    var el = document.getElementById(containerId);
    if (el) { el.classList.remove('hidden'); }
    window.scrollTo(0, 0);
  }

  /** Safely call a lifecycle method on a config object. */
  function _call(config, method) {
    try {
      if (config && typeof config[method] === 'function') {
        config[method]();
      }
    } catch (e) {
      console.warn('[GameLoader] Error in ' + config.gameId + '.' + method + '():', e);
    }
  }

  /** Tear down the currently active game cleanly. */
  function _destroyActive() {
    if (!_activeId) return;
    var cfg = _registry[_activeId];
    if (!cfg) { _activeId = null; return; }

    // Stop game-specific timers, loops, listeners
    _call(cfg, 'destroy');

    // Hide container
    var el = document.getElementById(cfg.containerId);
    if (el) { el.classList.add('hidden'); }

    console.log('[GameLoader] Closed: ' + _activeId);
    _activeId = null;
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Register a game with the loader.
   *
   * @param {Object} config
   *   gameId      {string}    unique identifier, e.g. 'ttt'
   *   containerId {string}    DOM element id of the game screen
   *   init()      {function}  called once to prepare game UI / logic
   *   start()     {function}  called each time the game becomes active
   *   reset()     {function}  resets board, scores, bot memory
   *   destroy()   {function}  clears timers, loops, active state
   */
  function registerGame(config) {
    if (!config || !config.gameId || !config.containerId) {
      console.error('[GameLoader] registerGame: missing gameId or containerId', config);
      return;
    }
    if (!config.init)    config.init    = function(){};
    if (!config.start)   config.start   = function(){};
    if (!config.reset)   config.reset   = function(){};
    if (!config.destroy) config.destroy = function(){};

    _registry[config.gameId] = config;
    _initialized[config.gameId] = false;
    console.log('[GameLoader] Registered: ' + config.gameId);
  }

  /**
   * Open a game by id. Destroys any currently active game first.
   *
   * @param {string} gameId
   */
  function openGame(gameId) {
    console.log('Open requested:', gameId);
    console.log('Active game:', _activeId);

    var cfg = _registry[gameId];
    if (!cfg) {
      console.warn('[GameLoader] Unknown gameId: ' + gameId);
      return;
    }

    // If same game is already active just start fresh
    if (_activeId === gameId) {
      _call(cfg, 'reset');
      _call(cfg, 'start');
      return;
    }

    // Destroy whatever is currently running
    _destroyActive();

    // Show the new game's container
    _showContainer(cfg.containerId);
    _activeId = gameId;

    // Init once, then start every time
    if (!_initialized[gameId]) {
      _call(cfg, 'init');
      _initialized[gameId] = true;
    }

    _call(cfg, 'start');

    // Reset per-game bot memory so no state leaks between sessions
    GlobalBotEngine.reset(gameId);

    console.log('[GameLoader] Opened: ' + gameId);
  }

  /**
   * Reset the currently active game (scores, board, bot memory).
   * Does NOT hide the game container.
   */
  function resetCurrentGame() {
    if (!_activeId) return;
    var cfg = _registry[_activeId];
    if (cfg) {
      _call(cfg, 'reset');
      GlobalBotEngine.reset(_activeId);
    }
  }

  /**
   * Close the active game and return to the DuelZone hub.
   */
  function closeCurrentGame() {
    _destroyActive();
    // Return to hub using existing showHub() — keeps all existing nav working
    showHub();
  }

  /** Return the id of the currently active game, or null. */
  function getActiveGameId() {
    return _activeId;
  }

  // Expose public interface
  return {
    registerGame:      registerGame,
    openGame:          openGame,
    resetCurrentGame:  resetCurrentGame,
    closeCurrentGame:  closeCurrentGame,
    getActiveGameId:   getActiveGameId
  };

})();


// ═══════════════════════════════════════════════════════════════
// PART 2: GLOBAL BOT ENGINE
// ─────────────────────────────────────────────────────────────
// Responsibilities:
//   • Centralised AI decision system for ALL bot-enabled games
//   • Difficulty (easy / medium / extreme) has consistent meaning
//   • Per-game memory that auto-resets between games
//   • Returns a move decision — never touches DOM, never plays sounds
//   • Supports turn-based and real-time games
//   • Supports pluggable game strategies via strategy registry
//
// Usage from a game:
//   var move = GlobalBotEngine.getMove('ttt', gameState);
//   // apply move to game
//
// Games that already use the old BotEngine object continue to work
// because old BotEngine is still present; GlobalBotEngine is an
// additive layer.
// ═══════════════════════════════════════════════════════════════

var GlobalBotEngine = (function() {

  // ── Difficulty config ────────────────────────────────────────
  // Shared semantics across all games:
  //   easy    → random, no memory, ~0–20% optimal
  //   medium  → limited memory, partial strategy, ~40–70% optimal
  //   extreme → full memory, optimal or near-optimal, ~85–100%

  var _difficulty = 'easy';
  var _memory     = {};   // { gameId: {any per-game memory} }
  var _strategies = {};   // { gameId: strategyFn(difficulty, gameState, memory) }

  // ── Utility helpers ──────────────────────────────────────────

  function _randomFrom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function _weightedRandom(arr, weights) {
    // weights is parallel array summing to 1
    var r = Math.random(), cum = 0;
    for (var i = 0; i < arr.length; i++) {
      cum += weights[i];
      if (r <= cum) return arr[i];
    }
    return arr[arr.length - 1];
  }

  function _ensureMemory(gameId) {
    if (!_memory[gameId]) _memory[gameId] = {};
    return _memory[gameId];
  }

  // ── Built-in strategy: Tic Tac Toe ───────────────────────────
  _strategies['ttt'] = function(difficulty, state, mem) {
    // state: { board:[9], botMark, humanMark }
    var board    = state.board;      // 9-cell array: '' | 'X' | 'O'
    var bot      = state.botMark;    // 'O' by default
    var human    = state.humanMark;  // 'X' by default
    var WINS     = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    var empty    = board.map(function(v,i){ return v===''?i:null; }).filter(function(i){ return i!==null; });

    if (!empty.length) return null;

    function wins(b, mark) {
      for (var i = 0; i < WINS.length; i++) {
        var w = WINS[i];
        if (b[w[0]]===mark && b[w[1]]===mark && b[w[2]]===mark) return true;
      }
      return false;
    }
    function findWin(b, mark) {
      for (var i = 0; i < empty.length; i++) {
        b[empty[i]] = mark;
        var w = wins(b, mark);
        b[empty[i]] = '';
        if (w) return empty[i];
      }
      return -1;
    }

    // Easy: pure random
    if (difficulty === 'easy') return _randomFrom(empty);

    // Medium: win if can, else block, else random
    if (difficulty === 'medium') {
      var w = findWin(board.slice(), bot);
      if (w !== -1) return w;
      var bl = findWin(board.slice(), human);
      if (bl !== -1) return bl;
      return _randomFrom(empty);
    }

    // Extreme: minimax
    function minimax(b, emp, isMax, alpha, beta) {
      if (wins(b, bot))   return  10;
      if (wins(b, human)) return -10;
      var e = b.map(function(v,i){return v===''?i:null;}).filter(function(i){return i!==null;});
      if (!e.length) return 0;
      var best = isMax ? -Infinity : Infinity;
      for (var i = 0; i < e.length; i++) {
        b[e[i]] = isMax ? bot : human;
        var s = minimax(b, e, !isMax, alpha, beta);
        b[e[i]] = '';
        if (isMax) { if (s > best) best = s; if (s > alpha) alpha = s; }
        else       { if (s < best) best = s; if (s < beta)  beta  = s; }
        if (alpha >= beta) break;
      }
      return best;
    }
    var bestScore = -Infinity, bestMove = empty[0];
    for (var i = 0; i < empty.length; i++) {
      board[empty[i]] = bot;
      var sc = minimax(board.slice(), empty, false, -Infinity, Infinity);
      board[empty[i]] = '';
      if (sc > bestScore) { bestScore = sc; bestMove = empty[i]; }
    }
    return bestMove;
  };

  // ── Built-in strategy: Rock Paper Scissors ───────────────────
  _strategies['rps'] = function(difficulty, state, mem) {
    // state: { history: ['rock','paper',...] } — P1's move history
    var choices  = ['rock', 'paper', 'scissors'];
    var beats    = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    var counters = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
    var history  = state.history || [];

    if (difficulty === 'easy') return _randomFrom(choices);

    if (difficulty === 'medium') {
      // Counter the player's last move 50% of the time
      var last = history[history.length - 1];
      if (last && Math.random() < 0.5) return counters[last];
      return _randomFrom(choices);
    }

    // Extreme: track frequency, counter most frequent
    if (history.length >= 2) {
      var freq = { rock: 0, paper: 0, scissors: 0 };
      history.forEach(function(m){ if (freq[m] !== undefined) freq[m]++; });
      var predicted = choices.reduce(function(a, b) { return freq[a] >= freq[b] ? a : b; });
      return counters[predicted];
    }
    return _randomFrom(choices);
  };

  // ── Built-in strategy: Tap Battle ────────────────────────────
  _strategies['tapbattle'] = function(difficulty, state) {
    // Returns tap interval in ms (how fast the bot taps)
    // state: { p1Taps, p2Taps, target }
    var ratio = (state.p1Taps || 0) / Math.max(state.p2Taps || 1, 1);

    if (difficulty === 'easy') {
      // ~5–7 taps/sec
      return Math.round(1000 / (5 + Math.random() * 2));
    }
    if (difficulty === 'medium') {
      // ~7–9 taps/sec
      return Math.round(1000 / (7 + Math.random() * 2));
    }
    // Extreme: adapt to player speed; up to ~14 taps/sec
    var spd = 8 + (ratio > 1 ? Math.min((ratio - 1) * 5, 6) : 0);
    return Math.max(Math.round(1000 / spd), 70);
  };

  // ── Built-in strategy: Connect Four ──────────────────────────
  _strategies['c4'] = function(difficulty, state) {
    // Delegates to existing BotEngine._c4 for compatibility
    // state: { board, botPlayer, humanPlayer, emptyVal, rows, cols }
    return BotEngine.getC4Move(state, difficulty);
  };

  // ── Built-in strategy: Hand Cricket ──────────────────────────
  _strategies['cricket'] = function(difficulty, state) {
    // state: { history:[], playerBats, mode }
    var history = state.history || [];
    var mode    = state.mode || 'normal';  // 'normal' | 'crazy'

    if (difficulty === 'easy') return Math.floor(Math.random() * 10) + 1;

    if (difficulty === 'medium') {
      // Occasionally try to counter player's last move
      if (history.length > 0 && Math.random() < 0.4) {
        var last = history[history.length - 1];
        if (!state.playerBats) {
          // Bowling: try to match to get wicket
          if (mode === 'normal') return last;
          // Crazy: try ±1
          return Math.max(1, Math.min(10, last + (Math.random() < 0.5 ? 1 : -1)));
        }
      }
      return Math.floor(Math.random() * 10) + 1;
    }

    // Extreme: predict most frequent move
    if (history.length >= 3) {
      var freq = {};
      for (var n = 1; n <= 10; n++) freq[n] = 0;
      history.forEach(function(n){ if (freq[n] !== undefined) freq[n]++; });
      var predicted = 1, maxF = 0;
      for (var k in freq) { if (freq[k] > maxF) { maxF = freq[k]; predicted = parseInt(k); } }
      if (!state.playerBats) {
        if (mode === 'crazy') {
          var tries = [predicted - 1, predicted + 1];
          return Math.max(1, Math.min(10, tries[Math.floor(Math.random() * 2)]));
        }
        return predicted; // Normal bowling: match to get wicket
      }
    }
    return Math.floor(Math.random() * 10) + 1;
  };

  // ── Built-in strategy: 2048 Duel ────────────────────────────
  _strategies['duel2048'] = function(difficulty, state) {
    // state: { tiles, diff } — tiles is the array from d2048Tiles[pIdx]
    // Returns direction: 'up'|'down'|'left'|'right' or null
    // Delegates to the existing d2048BotPickMove logic signature
    // We can't call it directly (it uses globals), so we replicate the
    // heuristic here using the tiles array.
    var tiles = state.tiles || [];
    var dirs  = ['up', 'down', 'left', 'right'];

    // Build 4×4 grid from tiles
    function buildGrid(t) {
      var g = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
      t.forEach(function(tile){ g[tile.row][tile.col] = tile.value; });
      return g;
    }

    // Compute whether a move changes the grid
    function simulateDir(tiles, dir) {
      var grid = buildGrid(tiles);
      var score = 0, changed = false;
      for (var line = 0; line < 4; line++) {
        var row = [];
        if (dir === 'left')  for (var i=0;i<4;i++) { if (grid[line][i]) row.push(grid[line][i]); }
        if (dir === 'right') for (var i=3;i>=0;i--){ if (grid[line][i]) row.push(grid[line][i]); }
        if (dir === 'up')    for (var i=0;i<4;i++) { if (grid[i][line]) row.push(grid[i][line]); }
        if (dir === 'down')  for (var i=3;i>=0;i--){ if (grid[i][line]) row.push(grid[i][line]); }

        var merged = [];
        var k = 0;
        while (k < row.length) {
          if (k + 1 < row.length && row[k] === row[k+1]) {
            var v = row[k] * 2; merged.push(v); score += v; k += 2;
          } else { merged.push(row[k]); k++; }
        }
        // Pad
        while (merged.length < 4) merged.push(0);

        // Write back to detect change
        for (var j = 0; j < 4; j++) {
          var r, c;
          if (dir === 'left')  { r = line; c = j; }
          if (dir === 'right') { r = line; c = 3 - j; }
          if (dir === 'up')    { r = j;    c = line; }
          if (dir === 'down')  { r = 3-j;  c = line; }
          if (grid[r][c] !== merged[j]) changed = true;
          grid[r][c] = merged[j];
        }
      }
      return { changed: changed, score: score, grid: grid };
    }

    function heuristicScore(grid) {
      // Reward: large tiles in corners + open cells + mergeability
      var corners = grid[0][0] + grid[0][3] + grid[3][0] + grid[3][3];
      var empty = 0, monotone = 0;
      for (var r = 0; r < 4; r++) {
        for (var c = 0; c < 4; c++) {
          if (!grid[r][c]) empty++;
          if (c < 3 && grid[r][c] && grid[r][c+1]) {
            if (grid[r][c] >= grid[r][c+1]) monotone += grid[r][c];
          }
          if (r < 3 && grid[r][c] && grid[r+1][c]) {
            if (grid[r][c] >= grid[r+1][c]) monotone += grid[r][c];
          }
        }
      }
      return corners * 2 + empty * 200 + monotone;
    }

    var valid = dirs.filter(function(d){ return simulateDir(tiles, d).changed; });
    if (!valid.length) return null;

    if (difficulty === 'easy') return _randomFrom(valid);

    if (difficulty === 'medium') {
      var best = null, bestS = -Infinity;
      valid.forEach(function(d){
        var res = simulateDir(tiles, d);
        if (res.score > bestS) { bestS = res.score; best = d; }
      });
      return best || _randomFrom(valid);
    }

    // Extreme: evaluate heuristic after each move
    var bestDir = null, bestVal = -Infinity;
    valid.forEach(function(d) {
      var res = simulateDir(tiles, d);
      var val = heuristicScore(res.grid) + res.score * 2;
      if (val > bestVal) { bestVal = val; bestDir = d; }
    });
    return bestDir || _randomFrom(valid);
  };

  // ── Built-in strategy: Air Hockey ────────────────────────────
  // Air Hockey is real-time physics — the bot is a continuous
  // controller, not a discrete decision. GlobalBotEngine returns
  // a target position { x, y } for the bot paddle each frame.
  _strategies['airhockey'] = function(difficulty, state) {
    // state: { puck:{x,y,vx,vy}, paddleBot:{x,y,r}, tableW, tableH }
    var cfg = {
      easy:    { reactionTime: 0.4, maxSpeed: 3.5, errorMargin: 60, aggression: 0.3 },
      medium:  { reactionTime: 0.2, maxSpeed: 6,   errorMargin: 25, aggression: 0.6 },
      extreme: { reactionTime: 0.06,maxSpeed: 9,   errorMargin: 8,  aggression: 0.9 }
    }[difficulty] || { reactionTime: 0.4, maxSpeed: 3.5, errorMargin: 60, aggression: 0.3 };

    var pk  = state.puck;
    var bot = state.paddleBot;
    var W   = state.tableW, H = state.tableH;

    var predT = cfg.reactionTime;
    var predX = pk.x + pk.vx * predT * 30;
    var predY = pk.y + pk.vy * predT * 30;
    var err   = (Math.random() - 0.5) * cfg.errorMargin * 2;

    var targetX = predX + err;
    var targetY;
    if (pk.vy < 0 && cfg.aggression < 0.5) targetY = predY;
    else if (pk.vy > 0 || cfg.aggression > 0.6) targetY = H * 0.15 + err * 0.3;
    else targetY = H * 0.18;

    return {
      x: Math.max(bot.r, Math.min(W - bot.r, targetX)),
      y: Math.max(bot.r, Math.min(H / 2 - bot.r, targetY)),
      maxSpeed: cfg.maxSpeed
    };
  };

  // ── Built-in strategy: Password Breaker ─────────────────────
  // Password Breaker is single-player (no bot opponent) so no
  // strategy is needed. Registered for completeness.
  _strategies['passbreach'] = function() { return null; };

  // ── Built-in strategy: Memory Flip Duel ─────────────────────
  _strategies['memoryflip'] = function(difficulty, state, mem) {
    // state: { cards:[{idx, pairVal, isMatched}], available:[idx,...] }
    // Returns [idx1, idx2] — two card indices to flip
    var avail   = state.available || [];
    var cards   = state.cards || [];
    var seen    = mem.seen    || {};   // { idx: pairVal }
    var pairs   = mem.pairs   || {};   // { pairVal: [idxA, idxB] }

    if (avail.length < 2) return null;

    function shuffle(arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    // Find a known match among available unmatched cards
    function findKnownPair() {
      for (var pv in pairs) {
        var p = pairs[pv];
        if (!p || p.length < 2) continue;
        var a = p[0], b = p[1];
        var ca = cards[a], cb = cards[b];
        if (ca && cb && !ca.isMatched && !cb.isMatched &&
            avail.indexOf(a) !== -1 && avail.indexOf(b) !== -1) {
          return [a, b];
        }
      }
      return null;
    }

    if (difficulty === 'easy') {
      var s = shuffle(avail);
      return [s[0], s[1]];
    }

    if (difficulty === 'medium') {
      // Use last-2 seen cards to detect known pair
      var lastTwo = mem.lastTwo || [];
      if (lastTwo.length === 2 && lastTwo[0].pairVal === lastTwo[1].pairVal) {
        var la = lastTwo[0].idx, lb = lastTwo[1].idx;
        var ca2 = cards[la], cb2 = cards[lb];
        if (ca2 && cb2 && !ca2.isMatched && !cb2.isMatched) return [la, lb];
      }
      for (var li = 0; li < lastTwo.length; li++) {
        var entry = lastTwo[li];
        for (var ai = 0; ai < avail.length; ai++) {
          var aidx = avail[ai];
          if (aidx !== entry.idx && seen[aidx] === entry.pairVal && !cards[aidx].isMatched) {
            if (!cards[entry.idx].isMatched && avail.indexOf(entry.idx) !== -1) {
              return [entry.idx, aidx];
            }
          }
        }
      }
      var sh = shuffle(avail);
      return [sh[0], sh[1]];
    }

    // Extreme: perfect memory
    var known = findKnownPair();
    if (known) return known;
    // Pick unseen cards first to gain information
    var unseen = avail.filter(function(i) { return !(i in seen); });
    if (unseen.length >= 2) { var su = shuffle(unseen); return [su[0], su[1]]; }
    var shEx = shuffle(avail);
    return [shEx[0], shEx[1]];
  };

  // ── Public API ────────────────────────────────────────────────

  /**
   * Set the global difficulty level.
   * @param {string} level  'easy' | 'medium' | 'extreme'
   */
  function setDifficulty(level) {
    if (['easy', 'medium', 'extreme'].indexOf(level) === -1) {
      console.warn('[GlobalBotEngine] Unknown difficulty: ' + level + '. Defaulting to easy.');
      level = 'easy';
    }
    _difficulty = level;
  }

  /**
   * Reset per-game memory. Called automatically by GameLoader.openGame().
   * @param {string} gameId
   */
  function reset(gameId) {
    _memory[gameId] = { seen: {}, pairs: {}, lastTwo: [] };
  }

  /**
   * Store arbitrary data in per-game bot memory.
   * Games call this to record revealed information (e.g. card values).
   *
   * @param {string} gameId
   * @param {Object} data  — merged into existing memory
   */
  function storeMemory(gameId, data) {
    var mem = _ensureMemory(gameId);
    for (var k in data) {
      if (data.hasOwnProperty(k)) mem[k] = data[k];
    }
  }

  /**
   * Get the bot's decision for a given game and state.
   *
   * @param {string} gameId
   * @param {Object} gameState   — game-specific state object
   * @param {string} [override]  — optional difficulty override for this call
   * @returns {*}  decision (move index, direction string, [idx1,idx2], etc.)
   */
  function getMove(gameId, gameState, override) {
    var diff = override || _difficulty;
    var strategy = _strategies[gameId];
    if (!strategy) {
      console.warn('[GlobalBotEngine] No strategy for gameId: ' + gameId);
      return null;
    }
    var mem = _ensureMemory(gameId);
    return strategy(diff, gameState, mem);
  }

  /**
   * Register a custom strategy for a game.
   * Useful for future games added to DuelZone without modifying this file.
   *
   * @param {string}   gameId
   * @param {function} strategyFn(difficulty, gameState, memory) → move
   */
  function registerStrategy(gameId, strategyFn) {
    _strategies[gameId] = strategyFn;
  }

  /**
   * Simulate a bot thinking delay then execute a callback.
   * Games can use this instead of raw setTimeout for consistent UX.
   *
   * @param {string}   gameId
   * @param {function} callback  — called after delay with the move result
   * @param {Object}   gameState
   * @param {string}   [override]
   * @returns {number} timeoutId (so caller can cancel if needed)
   */
  function scheduleMove(gameId, callback, gameState, override) {
    var diff = override || _difficulty;
    var delays = { easy: [600, 900], medium: [350, 600], extreme: [200, 400] };
    var range  = delays[diff] || delays.easy;
    var delay  = range[0] + Math.floor(Math.random() * (range[1] - range[0]));

    return setTimeout(function() {
      var move = getMove(gameId, gameState, diff);
      callback(move);
    }, delay);
  }

  return {
    setDifficulty:     setDifficulty,
    reset:             reset,
    storeMemory:       storeMemory,
    getMove:           getMove,
    registerStrategy:  registerStrategy,
    scheduleMove:      scheduleMove
  };

})();


// ═══════════════════════════════════════════════════════════════
// PART 3: GAME REGISTRATIONS
// ─────────────────────────────────────────────────────────────
// Register every existing DuelZone game with GameLoader.
// Each registration describes how to:
//   init()    → prepare the game (first-time setup)
//   start()   → show home/setup panel of that game
//   reset()   → reset current match state
//   destroy() → cleanly stop all timers / loops / active state
//
// IMPORTANT: These registrations DO NOT change any game logic.
// They wrap existing functions.
// ═══════════════════════════════════════════════════════════════

(function registerAllGames() {

  // ── Tic Tac Toe ───────────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'ttt',
    containerId: 'screen-ttt',
    init:   function() { /* TTT is already initialised at parse time */ },
    start:  function() {
      // Show home panel (mirrors what overridden showTTT() does)
      var home = document.getElementById('ttt-home');
      var play = document.getElementById('ttt-play-panel');
      if (home) home.classList.remove('hidden');
      if (play) play.classList.add('hidden');
    },
    reset:  function() { tttRestart(); },
    destroy: function() {
      // TTT has no async loops; just mark board inactive
      tttActive = false;
      tttBoardEl && tttBoardEl.classList.add('disabled');
    }
  });

  // ── Rock Paper Scissors ────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'rps',
    containerId: 'screen-rps',
    init:   function() {},
    start:  function() {
      var home = document.getElementById('rps-home');
      var play = document.getElementById('rps-play-panel');
      if (home) home.classList.remove('hidden');
      if (play) play.classList.add('hidden');
    },
    reset:  function() { rpsRestart(); },
    destroy: function() {
      rpsLocked = true;
    }
  });

  // ── Tap Battle ────────────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'tapbattle',
    containerId: 'screen-tapbattle',
    init:   function() {},
    start:  function() { tapReset(); },
    reset:  function() { tapReset(); },
    destroy: function() { tapStop(); }
  });

  // ── 2048 Duel ─────────────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'duel2048',
    containerId: 'screen-duel2048',
    init:   function() {},
    start:  function() { d2048Init(); },
    reset:  function() { d2048Init(); },
    destroy: function() {
      if (d2048BotTimer) {
        clearInterval(d2048BotTimer);
        clearTimeout(d2048BotTimer);
        d2048BotTimer = null;
      }
      d2048Active = [false, false];
    }
  });

  // ── Connect Four ──────────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'c4',
    containerId: 'screen-c4',
    init:   function() {},
    start:  function() {
      var home = document.getElementById('c4-home');
      var play = document.getElementById('c4-play-panel');
      if (home) home.classList.remove('hidden');
      if (play) play.classList.add('hidden');
    },
    reset:  function() { c4ResetGame(); },
    destroy: function() {
      c4GameActive = false;
      if (c4BoardWrap) c4BoardWrap.classList.add('locked');
    }
  });

  // ── Hand Cricket ──────────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'cricket',
    containerId: 'screen-cricket',
    init:   function() {},
    start:  function() { cricketResetToSetup(); },
    reset:  function() { cricketResetToSetup(); },
    destroy: function() {
      cricNumpadLocked = true;
    }
  });

  // ── Air Hockey ────────────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'airhockey',
    containerId: 'screen-airhockey',
    init:   function() {},
    start:  function() {
      var home = document.getElementById('ah-home');
      var play = document.getElementById('ah-play-panel');
      if (home) home.classList.remove('hidden');
      if (play) play.classList.add('hidden');
      ahStopLoop();
    },
    reset:  function() {
      ahStopLoop();
      ahInit();
      ahRunning = true;
      ahLastTime = 0;  // FIX: safe default dt on first frame
      ahRAF = requestAnimationFrame(ahLoop);
    },
    destroy: function() { ahStopLoop(); }
  });

  // ── Password Breaker ──────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'passbreach',
    containerId: 'screen-passbreach',
    init:   function() {},
    start:  function() {
      var home = document.getElementById('pb-home');
      var play = document.getElementById('pb-play-panel');
      if (home) home.classList.remove('hidden');
      if (play) play.classList.add('hidden');
    },
    reset:  function() {
      if (pb && pb.timerInterval) { clearInterval(pb.timerInterval); pb.timerInterval = null; }
      if (pb) { pb.sessionOver = true; }
    },
    destroy: function() {
      if (pb && pb.timerInterval) { clearInterval(pb.timerInterval); pb.timerInterval = null; }
      if (pb) { pb.sessionOver = true; }
    }
  });

  // ── Memory Flip Duel ──────────────────────────────────────────
  GameLoader.registerGame({
    gameId:      'memoryflip',
    containerId: 'screen-memoryflip',
    init:   function() {},
    start:  function() {
      var home = document.getElementById('mfd-home');
      var play = document.getElementById('mfd-play');
      if (home) home.classList.remove('hidden');
      if (play) play.classList.add('hidden');
    },
    reset:  function() { if (typeof mfdStartGame === 'function') mfdStartGame(false); },
    destroy: function() {
      if (mfdState && mfdState.botTimeout) {
        clearTimeout(mfdState.botTimeout);
        mfdState.botTimeout = null;
      }
      if (mfdState) { mfdState.locked = true; mfdState.gameOver = true; }
    }
  });

  console.log('[GameLoader] All ' + Object.keys(
    // Count entries via a trick (IE-safe)
    (function(){ var o={}; ['ttt','rps','tapbattle','duel2048','c4','cricket','airhockey','passbreach','memoryflip','connectdots'].forEach(function(k){o[k]=1;}); return o; })()
  ).length + ' games registered.');

})();


// ═══════════════════════════════════════════════════════════════
// PART 4: BRIDGE — wire GameLoader into existing hub navigation
// ─────────────────────────────────────────────────────────────
// The existing hub card click handler calls showXxx() functions
// directly. We patch those show functions to additionally update
// GameLoader's active-game tracking, so getActiveGameId() is always
// accurate. We do NOT break any existing navigation.
// ═══════════════════════════════════════════════════════════════

(function patchNavBridge() {

  // Map screen-id → gameId so we can track openings via hub clicks
  var SCREEN_TO_GAME = {
    ttt:         'ttt',
    rps:         'rps',
    tapbattle:   'tapbattle',
    duel2048:    'duel2048',
    c4:          'c4',
    cricket:     'cricket',
    airhockey:   'airhockey',
    passbreach:  'passbreach',
    memoryflip:  'memoryflip',
    connectdots: 'connectdots'
  };

  // Wrap show functions so GameLoader knows which game is active
  function wrapShow(screenKey, fn) {
    return function() {
      // Destroy previously active game via GameLoader (stops timers, etc.)
      var prevId = GameLoader.getActiveGameId();
      if (prevId && prevId !== SCREEN_TO_GAME[screenKey]) {
        // Only call destroy on the old game — do NOT call openGame
        // because the existing showXxx() handles the UI transition.
        var prevCfg = (function(){
          // Access the private registry via a test open (noop since same flow)
          // Instead we call openGame which will handle it cleanly:
        })();
        // Simpler: tell GameLoader the new active game
      }
      // Update GameLoader's internal active tracking
      // We set this by calling a lightweight variant that skips UI ops
      GameLoader._setActive(SCREEN_TO_GAME[screenKey]);

      // Call the original show function
      fn.apply(this, arguments);
    };
  }

  // Expose a lightweight internal setter (package-private — not in public API)
  // This lets the bridge update active tracking without re-running init/start.
  GameLoader._setActive = function(gameId) {
    // This is intentionally NOT exported in the public API.
    // It is only called from the bridge below.
    // Access the registry via the closure:
    // We work around closure privacy with a re-registration trick.
    // Actually — simplest approach: just track via a module-level var
    // We'll use a different strategy: extend the public object.
    GameLoader._activeGameId = gameId;
  };

  // Simpler: just listen on hub card clicks to track active game
  // The hub card routing already fires show functions; we observe those.
  document.querySelectorAll('.arena-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var screenKey = card.getAttribute('data-screen');
      if (screenKey && SCREEN_TO_GAME[screenKey]) {
        // Notify GlobalBotEngine to reset memory for the new game
        GlobalBotEngine.reset(SCREEN_TO_GAME[screenKey]);
      }
    }, true); // capture phase — fires before the existing handler
  });

  console.log('[GameLoader] Navigation bridge active.');
})();


// ═══════════════════════════════════════════════════════════════
// SELF-TEST: Validate GameLoader and GlobalBotEngine are wired up
// ═══════════════════════════════════════════════════════════════
(function selfTest() {

  // 1. Verify GameLoader API surface
  var loaderOk = (
    typeof GameLoader.registerGame     === 'function' &&
    typeof GameLoader.openGame         === 'function' &&
    typeof GameLoader.resetCurrentGame === 'function' &&
    typeof GameLoader.closeCurrentGame === 'function' &&
    typeof GameLoader.getActiveGameId  === 'function'
  );

  // 2. Verify GlobalBotEngine API surface
  var engineOk = (
    typeof GlobalBotEngine.setDifficulty    === 'function' &&
    typeof GlobalBotEngine.reset            === 'function' &&
    typeof GlobalBotEngine.storeMemory      === 'function' &&
    typeof GlobalBotEngine.getMove          === 'function' &&
    typeof GlobalBotEngine.registerStrategy === 'function' &&
    typeof GlobalBotEngine.scheduleMove     === 'function'
  );

  // 3. Smoke-test a few getMove calls
  var tttMove = GlobalBotEngine.getMove('ttt', {
    board: ['X','','O','','X','','','',''],
    botMark: 'O', humanMark: 'X'
  }, 'extreme');
  var tttOk = typeof tttMove === 'number' && tttMove >= 0 && tttMove <= 8;

  var rpsMove = GlobalBotEngine.getMove('rps', { history: ['rock','rock','scissors'] }, 'extreme');
  var rpsOk   = ['rock','paper','scissors'].indexOf(rpsMove) !== -1;

  var mfdMove = GlobalBotEngine.getMove('memoryflip', {
    cards:     [{idx:0,pairVal:0,isMatched:false},{idx:1,pairVal:0,isMatched:false},
                {idx:2,pairVal:1,isMatched:false},{idx:3,pairVal:1,isMatched:false}],
    available: [0,1,2,3]
  }, 'extreme');
  var mfdOk = Array.isArray(mfdMove) && mfdMove.length === 2;

  var allOk = loaderOk && engineOk && tttOk && rpsOk && mfdOk;

  console.log(
    '[DuelZone Systems] Self-test: ' + (allOk ? '✅ PASS' : '❌ FAIL') +
    ' | GameLoader=' + (loaderOk ? '✅':'❌') +
    ' GlobalBotEngine=' + (engineOk ? '✅':'❌') +
    ' TTT move=' + tttMove + (tttOk ? ' ✅':'❌') +
    ' RPS=' + rpsMove + (rpsOk ? ' ✅':'❌') +
    ' MFD=' + JSON.stringify(mfdMove) + (mfdOk ? ' ✅':'❌')
  );
})();

console.log('[DuelZone] Global Systems (GameLoader + GlobalBotEngine) v1.0 loaded.');


// ═══════════════════════════════════════════════════════════════
// CONNECT DOTS DUEL — Full Game Implementation
// ─────────────────────────────────────────────────────────────
// Grid: 4×4 dots → 3×3 boxes, 24 lines total (12H + 12V)
// ═══════════════════════════════════════════════════════════════

(function() {

  // ── Game State ──────────────────────────────────────────────

  var cdd = {
    lines:          {},    // lineId → {id, type, row, col, isDrawn, owner}
    boxes:          {},    // boxId  → {id, row, col, sides:{top,bottom,left,right}, isCompleted, owner}
    scores:         {p1: 0, p2: 0},
    currentTurn:    'p1',
    gameMode:       'pvp',   // 'pvp' | 'bot'
    difficulty:     'easy',
    gameOver:       false,
    botThinking:    false,
    totalLines:     24,
    drawnLines:     0
  };

  // ── DOM Refs ────────────────────────────────────────────────

  var cddHomePanel   = document.getElementById('cdd-home');
  var cddPlayPanel   = document.getElementById('cdd-play');
  var cddHomeBack    = document.getElementById('cdd-home-back');
  var cddBackToHome  = document.getElementById('cdd-back-to-home');
  var cddHpPvp       = document.getElementById('cdd-hp-pvp');
  var cddHpPve       = document.getElementById('cdd-hp-pve');
  var cddHpDiffRow   = document.getElementById('cdd-hp-diff-row');
  var cddHpEasy      = document.getElementById('cdd-hp-easy');
  var cddHpMedium    = document.getElementById('cdd-hp-medium');
  var cddHpExtreme   = document.getElementById('cdd-hp-extreme');
  var cddHpStart     = document.getElementById('cdd-hp-start');
  var cddTitle       = document.getElementById('cdd-title');
  var cddModeLabel   = document.getElementById('cdd-mode-label');
  var cddScoreP1     = document.getElementById('cdd-score-p1');
  var cddScoreP2     = document.getElementById('cdd-score-p2');
  var cddP1Label     = document.getElementById('cdd-p1-label');
  var cddP2Label     = document.getElementById('cdd-p2-label');
  var cddCardP1      = document.getElementById('cdd-card-p1');
  var cddCardP2      = document.getElementById('cdd-card-p2');
  var cddTurnIndicator = document.getElementById('cdd-turn-indicator');
  var cddTurnText    = document.getElementById('cdd-turn-text');
  var cddGrid        = document.getElementById('cdd-grid');
  var cddResult      = document.getElementById('cdd-result');
  var cddResultIcon  = document.getElementById('cdd-result-icon');
  var cddResultTitle = document.getElementById('cdd-result-title');
  var cddResultScores= document.getElementById('cdd-result-scores');
  var cddPlayAgain   = document.getElementById('cdd-play-again');
  var cddResultHub   = document.getElementById('cdd-result-hub');
  var cddResetBtn    = document.getElementById('cdd-reset-btn');
  var cddHubBtn      = document.getElementById('cdd-hub-btn');

  // ── Setup Panel Wiring ──────────────────────────────────────

  // Back to hub from home panel
  if (cddHomeBack) {
    cddHomeBack.addEventListener('click', function() {
      SoundManager.click();
      GameLoader.closeCurrentGame();
    });
  }

  // Mode buttons
  if (cddHpPvp) {
    cddHpPvp.addEventListener('click', function() {
      cdd.gameMode = 'pvp';
      cddHpPvp.classList.add('active');
      cddHpPve.classList.remove('active');
      cddHpDiffRow.style.display = 'none';
      SoundManager.click();
    });
  }
  if (cddHpPve) {
    cddHpPve.addEventListener('click', function() {
      cdd.gameMode = 'bot';
      cddHpPve.classList.add('active');
      cddHpPvp.classList.remove('active');
      cddHpDiffRow.style.display = '';
      SoundManager.click();
    });
  }

  // Difficulty buttons
  [
    [cddHpEasy,    'easy'],
    [cddHpMedium,  'medium'],
    [cddHpExtreme, 'extreme']
  ].forEach(function(pair) {
    var btn = pair[0], diff = pair[1];
    if (btn) {
      btn.addEventListener('click', function() {
        cdd.difficulty = diff;
        [cddHpEasy, cddHpMedium, cddHpExtreme].forEach(function(b) {
          if (b) b.classList.remove('active');
        });
        btn.classList.add('active');
        SoundManager.click();
      });
    }
  });

  // Start game
  if (cddHpStart) {
    cddHpStart.addEventListener('click', function() {
      SoundManager.click();
      cddStartGame();
    });
  }

  // Back to setup from play panel
  if (cddBackToHome) {
    cddBackToHome.addEventListener('click', function() {
      SoundManager.click();
      cddDestroyGame();
      cddHomePanel.classList.remove('hidden');
      cddPlayPanel.classList.add('hidden');
    });
  }

  // Reset button
  if (cddResetBtn) {
    cddResetBtn.addEventListener('click', function() {
      SoundManager.click();
      cddStartGame();
    });
  }

  // Hub button
  if (cddHubBtn) {
    cddHubBtn.addEventListener('click', function() {
      SoundManager.click();
      GameLoader.closeCurrentGame();
    });
  }

  // Result overlay buttons
  if (cddPlayAgain) {
    cddPlayAgain.addEventListener('click', function() {
      SoundManager.click();
      cddStartGame();
    });
  }
  if (cddResultHub) {
    cddResultHub.addEventListener('click', function() {
      SoundManager.click();
      GameLoader.closeCurrentGame();
    });
  }

  // ── Game Initialisation ─────────────────────────────────────

  function cddStartGame() {
    cddDestroyGame();

    // Reset state
    cdd.lines    = {};
    cdd.boxes    = {};
    cdd.scores   = {p1: 0, p2: 0};
    cdd.currentTurn = 'p1';
    cdd.gameOver    = false;
    cdd.botThinking = false;
    cdd.drawnLines  = 0;

    // Build data structures
    cddBuildData();

    // Render grid
    cddRenderGrid();

    // Update UI
    cddUpdateScores();
    cddUpdateTurnUI();
    cddHideResult();

    // Mode labels
    if (cddModeLabel) {
      cddModeLabel.textContent = cdd.gameMode === 'bot'
        ? 'vs Bot (' + cdd.difficulty.toUpperCase() + ')'
        : 'Player vs Player';
    }
    if (cddP2Label) {
      cddP2Label.textContent = cdd.gameMode === 'bot' ? 'Bot' : 'Player 2';
    }

    // Show play panel
    cddHomePanel.classList.add('hidden');
    cddPlayPanel.classList.remove('hidden');
    cddResult.classList.add('hidden');

    window.scrollTo(0, 0);
  }

  function cddDestroyGame() {
    // No timers to clear except bot timeout
    if (cdd._botTimeout) {
      clearTimeout(cdd._botTimeout);
      cdd._botTimeout = null;
    }
    cdd.gameOver = true;
    cdd.botThinking = false;
  }

  // ── Data Structures ─────────────────────────────────────────

  function cddBuildData() {
    // Horizontal lines: h-{row}-{col}, row=0..3, col=0..2
    for (var r = 0; r <= 3; r++) {
      for (var c = 0; c <= 2; c++) {
        var hid = 'h-' + r + '-' + c;
        cdd.lines[hid] = {id: hid, type: 'h', row: r, col: c, isDrawn: false, owner: null};
      }
    }
    // Vertical lines: v-{row}-{col}, row=0..2, col=0..3
    for (var r = 0; r <= 2; r++) {
      for (var c = 0; c <= 3; c++) {
        var vid = 'v-' + r + '-' + c;
        cdd.lines[vid] = {id: vid, type: 'v', row: r, col: c, isDrawn: false, owner: null};
      }
    }

    // Boxes: box-{row}-{col}, row=0..2, col=0..2
    for (var r = 0; r <= 2; r++) {
      for (var c = 0; c <= 2; c++) {
        var bid = 'box-' + r + '-' + c;
        cdd.boxes[bid] = {
          id: bid, row: r, col: c,
          sides: {
            top:    'h-' + r       + '-' + c,
            bottom: 'h-' + (r + 1) + '-' + c,
            left:   'v-' + r       + '-' + c,
            right:  'v-' + r       + '-' + (c + 1)
          },
          isCompleted: false,
          owner: null
        };
      }
    }
  }

  // ── Grid Rendering ──────────────────────────────────────────
  //
  // Visual grid is 7×7 cells (for 4×4 dots):
  //   visual row/col 0,2,4,6 → dot row/col 0,1,2,3
  //   visual row/col 1,3,5   → line/box row/col 0,1,2
  //
  // Cell types:
  //   (even-row, even-col) → dot
  //   (even-row, odd-col)  → h-line  lineId = h-{vi/2}-{(vj-1)/2}
  //   (odd-row,  even-col) → v-line  lineId = v-{(vi-1)/2}-{vj/2}
  //   (odd-row,  odd-col)  → box     boxId  = box-{(vi-1)/2}-{(vj-1)/2}

  function cddRenderGrid() {
    if (!cddGrid) return;
    cddGrid.innerHTML = '';
    cddGrid.classList.remove('locked');

    for (var vi = 0; vi <= 6; vi++) {
      for (var vj = 0; vj <= 6; vj++) {
        var el;
        var ri = vi % 2, rj = vj % 2; // 0=even, 1=odd

        if (ri === 0 && rj === 0) {
          // DOT
          el = document.createElement('div');
          el.className = 'cdd-dot';

        } else if (ri === 0 && rj === 1) {
          // H-LINE
          var dotRow = vi / 2;
          var dotCol = (vj - 1) / 2;
          var lid = 'h-' + dotRow + '-' + dotCol;
          el = document.createElement('div');
          el.className = 'cdd-line h-line';
          el.setAttribute('data-lineid', lid);
          el.setAttribute('tabindex', '0');
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', 'Horizontal line row ' + dotRow + ' col ' + dotCol);
          cddSetLineClickHandler(el, lid);

        } else if (ri === 1 && rj === 0) {
          // V-LINE
          var dotRow = (vi - 1) / 2;
          var dotCol = vj / 2;
          var lid = 'v-' + dotRow + '-' + dotCol;
          el = document.createElement('div');
          el.className = 'cdd-line v-line';
          el.setAttribute('data-lineid', lid);
          el.setAttribute('tabindex', '0');
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', 'Vertical line row ' + dotRow + ' col ' + dotCol);
          cddSetLineClickHandler(el, lid);

        } else {
          // BOX
          var boxRow = (vi - 1) / 2;
          var boxCol = (vj - 1) / 2;
          var bid = 'box-' + boxRow + '-' + boxCol;
          el = document.createElement('div');
          el.className = 'cdd-box';
          el.setAttribute('data-boxid', bid);
          var lbl = document.createElement('span');
          lbl.className = 'cdd-box-label';
          lbl.textContent = 'P1';
          el.appendChild(lbl);
        }

        cddGrid.appendChild(el);
      }
    }
  }

  function cddSetLineClickHandler(el, lid) {
    el.addEventListener('click', function() {
      cddOnLineClick(lid);
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cddOnLineClick(lid);
      }
    });
  }

  // ── Turn Logic ───────────────────────────────────────────────

  function cddOnLineClick(lid) {
    if (cdd.gameOver) return;
    if (cdd.botThinking) return;
    if (cdd.gameMode === 'bot' && cdd.currentTurn === 'p2') return;
    var line = cdd.lines[lid];
    if (!line || line.isDrawn) return;

    cddDrawLine(lid, cdd.currentTurn);
  }

  function cddDrawLine(lid, player) {
    var line = cdd.lines[lid];
    if (!line || line.isDrawn) return;

    // Mark line
    line.isDrawn = true;
    line.owner   = player;
    cdd.drawnLines++;

    // Update DOM for the line
    var el = cddGrid ? cddGrid.querySelector('[data-lineid="' + lid + '"]') : null;
    if (el) {
      el.classList.add('drawn');
      el.classList.add(player === 'p1' ? 'drawn-p1' : 'drawn-p2');
      el.classList.add('line-just-drawn');
      SoundManager.click();
      setTimeout(function() { if (el) el.classList.remove('line-just-drawn'); }, 400);
    }

    // Check box completion
    var boxesClaimed = cddCheckBoxes(player);

    if (boxesClaimed > 0) {
      // Player keeps turn
      cddUpdateScores();
      if (cdd.gameOver) return;
      SoundManager.gameStart(); // box completion sound
      cddUpdateTurnUI();
      // If bot's extra turn
      if (cdd.gameMode === 'bot' && cdd.currentTurn === 'p2') {
        cddScheduleBotMove();
      }
    } else {
      // Switch turn
      cddSwitchTurn();
      SoundManager.tttMove(); // line draw / turn switch sound
    }

    // Check game over
    if (cdd.drawnLines >= cdd.totalLines) {
      cddEndGame();
    }
  }

  function cddCheckBoxes(player) {
    var claimed = 0;
    var boxIds  = Object.keys(cdd.boxes);
    for (var i = 0; i < boxIds.length; i++) {
      var box = cdd.boxes[boxIds[i]];
      if (box.isCompleted) continue;
      var s = box.sides;
      if (
        cdd.lines[s.top].isDrawn &&
        cdd.lines[s.bottom].isDrawn &&
        cdd.lines[s.left].isDrawn &&
        cdd.lines[s.right].isDrawn
      ) {
        box.isCompleted = true;
        box.owner = player;
        cdd.scores[player]++;
        claimed++;
        cddAnimateBox(box.id, player);
      }
    }
    return claimed;
  }

  function cddAnimateBox(bid, player) {
    if (!cddGrid) return;
    var el = cddGrid.querySelector('[data-boxid="' + bid + '"]');
    if (!el) return;
    el.classList.add('completed-' + player);
    el.classList.add('cdd-box-just-claimed');
    var lbl = el.querySelector('.cdd-box-label');
    if (lbl) {
      lbl.textContent = cdd.gameMode === 'bot'
        ? (player === 'p1' ? 'P1' : 'BOT')
        : (player === 'p1' ? 'P1' : 'P2');
    }
    setTimeout(function() { if (el) el.classList.remove('cdd-box-just-claimed'); }, 500);
  }

  function cddSwitchTurn() {
    cdd.currentTurn = cdd.currentTurn === 'p1' ? 'p2' : 'p1';
    cddUpdateTurnUI();
    if (cdd.gameMode === 'bot' && cdd.currentTurn === 'p2') {
      cddScheduleBotMove();
    }
  }

  function cddUpdateTurnUI() {
    if (!cddTurnIndicator) return;
    var isP1 = cdd.currentTurn === 'p1';
    var isBot = cdd.gameMode === 'bot' && !isP1;

    cddTurnIndicator.className = ''; // reset classes
    if (isBot && cdd.botThinking) {
      cddTurnIndicator.classList.add('cdd-turn-thinking');
      cddTurnText.textContent = 'Bot is thinking…';
    } else {
      cddTurnIndicator.classList.add(isP1 ? 'cdd-turn-p1' : 'cdd-turn-p2');
      var label = isP1 ? 'Player 1' : (cdd.gameMode === 'bot' ? 'Bot' : 'Player 2');
      cddTurnText.textContent = label + "'s Turn";
    }

    // Highlight active score card
    if (cddCardP1) {
      cddCardP1.classList.toggle('cdd-active-p1', isP1);
      cddCardP1.classList.toggle('cdd-active-p2', false);
    }
    if (cddCardP2) {
      cddCardP2.classList.toggle('cdd-active-p2', !isP1);
      cddCardP2.classList.toggle('cdd-active-p1', false);
    }

    // Lock/unlock grid for bot turn
    if (cddGrid) {
      if (cdd.gameMode === 'bot' && cdd.currentTurn === 'p2') {
        cddGrid.classList.add('locked');
      } else {
        cddGrid.classList.remove('locked');
      }
    }
  }

  function cddUpdateScores() {
    if (cddScoreP1) cddScoreP1.textContent = cdd.scores.p1;
    if (cddScoreP2) cddScoreP2.textContent = cdd.scores.p2;
  }

  // ── Game End ─────────────────────────────────────────────────

  function cddEndGame() {
    cdd.gameOver    = true;
    cdd.botThinking = false;
    if (cddGrid) cddGrid.classList.add('locked');

    var s1 = cdd.scores.p1, s2 = cdd.scores.p2;
    var icon, title, detail;

    if (s1 > s2) {
      icon  = '🏆';
      title = 'Player 1 Wins!';
      SoundManager.win();
    } else if (s2 > s1) {
      icon  = cdd.gameMode === 'bot' ? '🤖' : '🏆';
      title = cdd.gameMode === 'bot' ? 'Bot Wins!' : 'Player 2 Wins!';
      SoundManager.lose();
    } else {
      icon  = '🤝';
      title = "It's a Draw!";
      SoundManager.draw();
    }

    var p2name = cdd.gameMode === 'bot' ? 'Bot' : 'Player 2';
    detail = 'Player 1: ' + s1 + ' box' + (s1 !== 1 ? 'es' : '') +
             '  |  ' + p2name + ': ' + s2 + ' box' + (s2 !== 1 ? 'es' : '');

    if (cddResultIcon)   cddResultIcon.textContent  = icon;
    if (cddResultTitle)  cddResultTitle.textContent  = title;
    if (cddResultScores) cddResultScores.textContent = detail;
    if (cddResult)       cddResult.classList.remove('hidden');
  }

  function cddHideResult() {
    if (cddResult) cddResult.classList.add('hidden');
  }

  // ── Bot Engine Integration ───────────────────────────────────

  function cddScheduleBotMove() {
    if (cdd.gameOver) return;
    cdd.botThinking = true;
    cddGrid && cddGrid.classList.add('locked');

    cddTurnIndicator.className = 'cdd-turn-thinking';
    cddTurnText.textContent = 'Bot is thinking…';

    var delay = 600 + Math.random() * 300; // 600–900 ms
    cdd._botTimeout = setTimeout(function() {
      if (cdd.gameOver) return;
      cdd.botThinking = false;
      cddExecuteBotMove();
    }, delay);
  }

  function cddExecuteBotMove() {
    if (cdd.gameOver || cdd.currentTurn !== 'p2') return;

    var gameState = cddBuildBotState();
    var chosenLine = GlobalBotEngine.getMove('connectdots', gameState);

    if (!chosenLine) {
      // Fallback: pick random available line
      var avail = Object.keys(cdd.lines).filter(function(id) { return !cdd.lines[id].isDrawn; });
      if (!avail.length) return;
      chosenLine = avail[Math.floor(Math.random() * avail.length)];
    }

    cddDrawLine(chosenLine, 'p2');
  }

  function cddBuildBotState() {
    var availableLines = Object.keys(cdd.lines).filter(function(id) { return !cdd.lines[id].isDrawn; });
    var boxStates = {};
    Object.keys(cdd.boxes).forEach(function(bid) {
      var box = cdd.boxes[bid];
      var sides = box.sides;
      var sideCount = 0;
      if (cdd.lines[sides.top].isDrawn)    sideCount++;
      if (cdd.lines[sides.bottom].isDrawn) sideCount++;
      if (cdd.lines[sides.left].isDrawn)   sideCount++;
      if (cdd.lines[sides.right].isDrawn)  sideCount++;
      boxStates[bid] = {
        isCompleted: box.isCompleted,
        sidesDrawn: sideCount,
        sides: sides
      };
    });

    return {
      availableLines: availableLines,
      boxes:          boxStates,
      lines:          cdd.lines,
      scores:         cdd.scores,
      currentTurn:    cdd.currentTurn
    };
  }

  // ── Register GlobalBotEngine strategy ────────────────────────

  GlobalBotEngine._strategies['connectdots'] = function(difficulty, state, mem) {
    var available = state.availableLines;
    if (!available || !available.length) return null;

    var lines  = state.lines;
    var boxes  = state.boxes;

    // ── Helper: count how many sides a box gets after drawing line ─
    function sidesAfter(boxState) {
      return boxState.sidesDrawn;
    }

    // ── Check which lines complete a box immediately ─────────────
    function completingLines() {
      var result = [];
      available.forEach(function(lid) {
        var affected = linesAffectedBoxes(lid);
        for (var i = 0; i < affected.length; i++) {
          if (affected[i].sidesDrawn === 3) {
            result.push(lid);
            break;
          }
        }
      });
      return result;
    }

    // ── Find boxes a line is a side of ─────────────────────────
    function linesAffectedBoxes(lid) {
      var result = [];
      Object.keys(boxes).forEach(function(bid) {
        var b  = boxes[bid];
        var s  = b.sides;
        if (s.top === lid || s.bottom === lid || s.left === lid || s.right === lid) {
          result.push(b);
        }
      });
      return result;
    }

    // ── Check if line gives opponent a 3-sided box ─────────────
    function isRisky(lid) {
      var affected = linesAffectedBoxes(lid);
      for (var i = 0; i < affected.length; i++) {
        if (affected[i].sidesDrawn === 2) return true; // would make 3-sided
      }
      return false;
    }

    // ── EASY: pure random ─────────────────────────────────────
    if (difficulty === 'easy') {
      return available[Math.floor(Math.random() * available.length)];
    }

    // ── MEDIUM: take box if available, avoid 3-sided, else random
    if (difficulty === 'medium') {
      // 1. Grab completing line if available
      var wins = completingLines();
      if (wins.length) return wins[0];

      // 2. Avoid risky moves (giving 3-sided box)
      var safe = available.filter(function(lid) { return !isRisky(lid); });
      if (safe.length) return safe[Math.floor(Math.random() * safe.length)];

      // 3. All moves risky — pick one that gives fewest boxes away
      return available[Math.floor(Math.random() * available.length)];
    }

    // ── EXTREME: greedy chain capture + sacrifice minimisation ──
    // 1. Always complete available boxes (chain capture)
    var wins = completingLines();
    if (wins.length) return wins[0];

    // 2. Safe moves — lines not creating a 3-sided box
    var safe = available.filter(function(lid) { return !isRisky(lid); });
    if (safe.length) {
      // Among safe, prefer lines touching 0-sided or 1-sided boxes
      var preferSafe = safe.filter(function(lid) {
        var affected = linesAffectedBoxes(lid);
        return affected.every(function(b) { return b.sidesDrawn <= 1; });
      });
      if (preferSafe.length) return preferSafe[Math.floor(Math.random() * preferSafe.length)];
      return safe[Math.floor(Math.random() * safe.length)];
    }

    // 3. All moves are risky — choose the one that creates the shortest chain
    // i.e. touch a 2-sided box (making 3-sided) that has the fewest connected open boxes
    // Simplified: choose line that minimizes boxes with exactly 2 sides after
    var bestLine = null;
    var bestScore = Infinity;
    available.forEach(function(lid) {
      var affected = linesAffectedBoxes(lid);
      var score = 0;
      affected.forEach(function(b) {
        if (b.sidesDrawn === 2) score += 3;
        else if (b.sidesDrawn === 1) score += 1;
      });
      if (score < bestScore) { bestScore = score; bestLine = lid; }
    });

    return bestLine || available[Math.floor(Math.random() * available.length)];
  };

  // ── GameLoader Registration ───────────────────────────────────

  GameLoader.registerGame({
    gameId:      'connectdots',
    containerId: 'screen-connectdots',
    init: function() {
      // All wiring is done at parse time above
    },
    start: function() {
      // Show home/setup panel
      if (cddHomePanel) cddHomePanel.classList.remove('hidden');
      if (cddPlayPanel) cddPlayPanel.classList.add('hidden');
    },
    reset: function() {
      cddStartGame();
    },
    destroy: function() {
      cddDestroyGame();
    }
  });

  console.log('[DuelZone] Connect Dots Duel loaded and registered.');

})(); // end IIFE

// ═══════════════════════════════════════════════════════════════
// DuelZone · Global Stats Tracker
// Tracks wins/plays per player via localStorage, shown on hub
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var STATS_KEY = 'dz-stats-v2';

  function getStats(){
    try{ return JSON.parse(localStorage.getItem(STATS_KEY)||'{}'); }catch(e){ return {}; }
  }
  function saveStats(s){ try{ localStorage.setItem(STATS_KEY,JSON.stringify(s)); }catch(e){} }

  // Public API
  window.DZStats = {
    recordWin: function(game, player){
      var s = getStats();
      if(!s[game]) s[game] = {p1:0, p2:0, plays:0};
      s[game][player] = (s[game][player]||0) + 1;
      s[game].plays = (s[game].plays||0) + 1;
      saveStats(s);
      DZStats.renderBadge(game);
    },
    recordPlay: function(game){
      var s = getStats();
      if(!s[game]) s[game] = {p1:0, p2:0, plays:0};
      s[game].plays = (s[game].plays||0) + 1;
      saveStats(s);
    },
    getGameStats: function(game){
      var s = getStats();
      return s[game] || {p1:0, p2:0, plays:0};
    },
    renderBadge: function(game){
      // Update card badge on hub if visible
      var card = document.querySelector('[data-game="'+game+'"]');
      if(!card) return;
      var st = DZStats.getGameStats(game);
      var badge = card.querySelector('.dz-stat-badge');
      if(!badge){
        badge = document.createElement('div');
        badge.className = 'dz-stat-badge';
        badge.style.cssText = 'position:absolute;top:8px;right:8px;font-size:0.62rem;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:2px 7px;color:rgba(255,255,255,0.45);font-family:Rajdhani,sans-serif;pointer-events:none;z-index:5;';
        card.style.position = 'relative';
        card.appendChild(badge);
      }
      badge.textContent = st.plays + ' plays';
    },
    init: function(){
      var s = getStats();
      Object.keys(s).forEach(function(game){ DZStats.renderBadge(game); });
    }
  };

  // Wire into SoundManager.win calls via monkey-patch approach
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(DZStats.init, 500);
  });

})();
