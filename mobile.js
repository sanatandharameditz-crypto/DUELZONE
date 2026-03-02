// ═══════════════════════════════════════════════════════════════
// DuelZone · Mobile Optimization System  (mobile.js)
// Universal wrapper, fullscreen manager, joystick, touch controls
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Game metadata: screen name → display name ──────────────────
  var GAME_META = {
    'screen-ttt':          { name: 'Tic Tac Toe',         hasJoystick: false },
    'screen-rps':          { name: 'Rock Paper Scissors',  hasJoystick: false },
    'screen-tapbattle':    { name: 'Tap Battle',           hasJoystick: false },
    'screen-duel2048':     { name: '2048 Duel',            hasJoystick: false },
    'screen-c4':           { name: 'Connect Four',         hasJoystick: false },
    'screen-cricket':      { name: 'Hand Cricket',         hasJoystick: false },
    'screen-airhockey':    { name: 'Air Hockey',           hasJoystick: false },
    'screen-passbreach':   { name: 'Password Breaker',     hasJoystick: false },
    'screen-chess':        { name: 'Chess',                hasJoystick: false },
    'screen-battleship':   { name: 'Battleship',           hasJoystick: false },
    'screen-checkers':     { name: 'Checkers',             hasJoystick: false },
    'screen-darts':        { name: 'Darts Duel',           hasJoystick: false },
    'screen-tanks':        { name: 'Tanks Arena',          hasJoystick: true  },
    'screen-starcatcher':  { name: 'Star Catcher',         hasJoystick: false },
    'screen-spacedodge':   { name: 'Space Dodge',          hasJoystick: true  },
    'screen-pingpong':     { name: 'Ping Pong',            hasJoystick: false },
    'screen-minesweeper':  { name: 'Minesweeper Duel',     hasJoystick: false },
    'screen-tetris':       { name: 'Tetris Battle',        hasJoystick: false },
    'screen-bomberman':    { name: 'Bomberman Duel',       hasJoystick: true  },
    'screen-drawguess':    { name: 'Draw & Guess',         hasJoystick: false },
    'screen-reaction':     { name: 'Reaction Duel',        hasJoystick: false },
    'screen-territory':    { name: 'Territory Wars',       hasJoystick: false },
    'screen-memoryflip':   { name: 'Memory Flip',          hasJoystick: false },
    'screen-connectdots':  { name: 'Connect Dots',         hasJoystick: false },
    'screen-snake':        { name: 'Snake Duel',           hasJoystick: true  },
    'screen-typing':       { name: 'Typing Race',          hasJoystick: false },
    'screen-blackjack':    { name: 'Blackjack Duel',       hasJoystick: false },
    'screen-pixelracer':   { name: 'Pixel Racer',          hasJoystick: false },
  };

  // ── DOM references ─────────────────────────────────────────────
  var wrapper    = document.getElementById('dz-universal-wrapper');
  var topbar     = document.getElementById('dz-universal-topbar');
  var backBtn    = document.getElementById('dz-univ-back');
  var titleEl    = document.getElementById('dz-univ-game-title');
  var fsBtn      = document.getElementById('dz-univ-fs');
  var gameArea   = document.getElementById('dz-game-area');
  var ctrlZone   = document.getElementById('dz-universal-controls');
  var screenHub  = document.getElementById('screen-hub');

  var _activeScreen  = null;
  var _activeScreenId = null;

  // ── Fullscreen ─────────────────────────────────────────────────
  function requestFS(el) {
    if (el.requestFullscreen)          el.requestFullscreen().catch(function(){});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen)    el.mozRequestFullScreen();
    else if (el.msRequestFullscreen)     el.msRequestFullscreen();
  }

  function exitFS() {
    if (document.exitFullscreen)          document.exitFullscreen().catch(function(){});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen)  document.mozCancelFullScreen();
    else if (document.msExitFullscreen)     document.msExitFullscreen();
  }

  function isFS() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
              document.mozFullScreenElement || document.msFullscreenElement);
  }

  function updateFSBtn() {
    if (!fsBtn) return;
    if (isFS()) {
      fsBtn.textContent = '✕';
      fsBtn.title = 'Exit Fullscreen';
      fsBtn.classList.add('fs-active');
    } else {
      fsBtn.textContent = '⛶';
      fsBtn.title = 'Fullscreen';
      fsBtn.classList.remove('fs-active');
    }
  }

  // Listen for fullscreen changes
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      updateFSBtn();
      // Dispatch resize so canvas-based games can resize
      setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 120);
    });
  });

  if (fsBtn) {
    fsBtn.addEventListener('click', function () {
      if (isFS()) { exitFS(); }
      else { requestFS(wrapper); }
    });
  }

  // ── Wrapper activation ─────────────────────────────────────────
  function showWrapper(screenId) {
    _activeScreenId = screenId;
    _activeScreen   = document.getElementById(screenId);

    var meta = GAME_META[screenId] || { name: screenId.replace('screen-', ''), hasJoystick: false };

    // Set title
    if (titleEl) titleEl.textContent = meta.name.toUpperCase();

    // Show wrapper
    if (wrapper) wrapper.classList.add('dz-active');

    // Clear controls zone
    if (ctrlZone) {
      ctrlZone.innerHTML = '';
      ctrlZone.style.display = '';
    }

    // Update FS button state
    updateFSBtn();
  }

  function hideWrapper() {
    if (wrapper) wrapper.classList.remove('dz-active');
    _activeScreen   = null;
    _activeScreenId = null;
    if (ctrlZone) ctrlZone.innerHTML = '';
  }

  // ── Intercept showHub to hide wrapper ─────────────────────────
  var _origShowHub = window.showHub;
  window.showHub = function () {
    hideWrapper();
    if (_origShowHub) _origShowHub();
  };

  // Back button → hub
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (isFS()) exitFS();
      window.showHub();
    });
  }

  // ── Intercept all show*() functions ───────────────────────────
  var SCREEN_MAP = {
    showTTT:          'screen-ttt',
    showRPS:          'screen-rps',
    showTap:          'screen-tapbattle',
    show2048:         'screen-duel2048',
    showC4:           'screen-c4',
    showCricket:      'screen-cricket',
    showAH:           'screen-airhockey',
    showPB:           'screen-passbreach',
    showChess:        'screen-chess',
    showBattleship:   'screen-battleship',
    showCheckers:     'screen-checkers',
    showDarts:        'screen-darts',
    showTanks:        'screen-tanks',
    showStarCatcher:  'screen-starcatcher',
    showSpaceDodge:   'screen-spacedodge',
    showPingPong:     'screen-pingpong',
    showSnake:        'screen-snake',
    showTyping:       'screen-typing',
    showMinesweeper:  'screen-minesweeper',
    showBlackjack:    'screen-blackjack',
    showTetris:       'screen-tetris',
    showBomberman:    'screen-bomberman',
    showDrawGuess:    'screen-drawguess',
    showPixelRacer:   'screen-pixelracer',
    showReaction:     'screen-reaction',
    showTerritory:    'screen-territory',
    showMFD:          'screen-memoryflip',
    showCDD:          'screen-connectdots',
  };

  Object.keys(SCREEN_MAP).forEach(function (fnName) {
    var screenId = SCREEN_MAP[fnName];
    var original = window[fnName];
    window[fnName] = function () {
      if (original) original.apply(this, arguments);
      showWrapper(screenId);
    };
  });

  // ── Joystick / D-pad relocation into universal controls ────────
  // We observe DOM mutations so we can move joystick elements
  // after the game's init populates them.

  function relocateControls(screenId) {
    if (!ctrlZone) return;
    ctrlZone.innerHTML = '';

    // Per-game control selectors
    var controlSelectors = {
      'screen-tanks':       '#tanks-mobile-controls',
      'screen-spacedodge':  '#sd-joystick-wrap',
      'screen-bomberman':   '#bm-mobile-controls',
      'screen-pingpong':    '#pp-mobile-controls',
      'screen-tetris':      '#tetris-mobile-controls',
      'screen-snake':       '#snake-mobile-controls',
    };

    var sel = controlSelectors[screenId];
    if (!sel) {
      ctrlZone.style.display = 'none';
      return;
    }

    ctrlZone.style.display = '';

    function tryMove() {
      var el = document.querySelector(sel);
      if (el && el !== ctrlZone.firstChild) {
        // Clone into ctrl zone so original element refs remain intact
        ctrlZone.innerHTML = '';
        ctrlZone.appendChild(el);
        return true;
      }
      return false;
    }

    if (!tryMove()) {
      // Retry with observer if not populated yet
      var retries = 0;
      var interval = setInterval(function () {
        retries++;
        if (tryMove() || retries > 40) clearInterval(interval);
      }, 100);
    }
  }

  // ── Patch showTanks to move mobile controls after init ─────────
  var origShowTanks = window.showTanks;
  window.showTanks = function () {
    if (origShowTanks) origShowTanks.apply(this, arguments);
    showWrapper('screen-tanks');
    setTimeout(function () { relocateControls('screen-tanks'); }, 200);
  };

  var origShowSpaceDodge = window.showSpaceDodge;
  window.showSpaceDodge = function () {
    if (origShowSpaceDodge) origShowSpaceDodge.apply(this, arguments);
    showWrapper('screen-spacedodge');
    setTimeout(function () { relocateControls('screen-spacedodge'); }, 200);
  };

  var origShowBomberman = window.showBomberman;
  window.showBomberman = function () {
    if (origShowBomberman) origShowBomberman.apply(this, arguments);
    showWrapper('screen-bomberman');
    setTimeout(function () { relocateControls('screen-bomberman'); }, 200);
  };

  var origShowPingPong = window.showPingPong;
  window.showPingPong = function () {
    if (origShowPingPong) origShowPingPong.apply(this, arguments);
    showWrapper('screen-pingpong');
    setTimeout(function () { relocateControls('screen-pingpong'); }, 200);
  };

  var origShowTetris = window.showTetris;
  window.showTetris = function () {
    if (origShowTetris) origShowTetris.apply(this, arguments);
    showWrapper('screen-tetris');
    setTimeout(function () { relocateControls('screen-tetris'); }, 200);
  };

  // ── Mobile canvas scaling ──────────────────────────────────────
  function scaleCanvasForMobile() {
    document.querySelectorAll('canvas').forEach(function (canvas) {
      if (!canvas.style.maxWidth) canvas.style.maxWidth = '100%';
      canvas.style.touchAction = 'none';
    });
  }

  window.addEventListener('resize', scaleCanvasForMobile);
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      scaleCanvasForMobile();
      window.dispatchEvent(new Event('resize'));
    }, 300);
  });

  // ── Prevent pinch-zoom & double-tap zoom ──────────────────────
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  var lastTap = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTap < 300) {
      // double tap — only prevent on game screens (not hub)
      if (_activeScreen) e.preventDefault();
    }
    lastTap = now;
  }, { passive: false });

  // ── Swipe-to-hub gesture (swipe right from edge) ───────────────
  var swipeStartX = 0;
  var swipeStartY = 0;

  document.addEventListener('touchstart', function (e) {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_activeScreen) return;
    var dx = e.changedTouches[0].clientX - swipeStartX;
    var dy = Math.abs(e.changedTouches[0].clientY - swipeStartY);
    // Right swipe from left edge → back to hub
    if (swipeStartX < 30 && dx > 70 && dy < 60) {
      if (isFS()) exitFS();
      window.showHub();
    }
  }, { passive: true });

  // ── Touch-friendly D-pad size auto-scaling ────────────────────
  function scaleDpadButtons() {
    var vw = window.innerWidth;
    var size = Math.max(48, Math.min(68, Math.floor(vw * 0.14)));
    document.querySelectorAll('.dz-dpad-btn').forEach(function (btn) {
      btn.style.width  = size + 'px';
      btn.style.height = size + 'px';
      btn.style.fontSize = Math.floor(size * 0.45) + 'px';
    });
    document.querySelectorAll('.dz-action-btn').forEach(function (btn) {
      btn.style.height = size + 'px';
      btn.style.minWidth = Math.floor(size * 1.2) + 'px';
    });
  }

  window.addEventListener('resize', scaleDpadButtons);

  // ── Observe when controls are added (for dynamic game controls) ─
  if (window.MutationObserver) {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          // Scale any new canvas elements
          if (node.tagName === 'CANVAS') {
            node.style.maxWidth = '100%';
            node.style.touchAction = 'none';
          }
          // Scale dpad buttons when they appear
          if (node.classList && (node.classList.contains('dz-dpad-wrap') ||
              node.querySelector && node.querySelector('.dz-dpad-btn'))) {
            setTimeout(scaleDpadButtons, 50);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Hub card mobile optimization ───────────────────────────────
  // Make hub card buttons larger on mobile (≤ 600px)
  function optimizeHubCards() {
    if (window.innerWidth > 600) return;
    document.querySelectorAll('.card-btn').forEach(function (btn) {
      btn.style.minHeight = '40px';
      btn.style.padding   = '10px 14px';
    });
  }

  // ── Orientation change: re-layout and resize ───────────────────
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      optimizeHubCards();
      scaleDpadButtons();
    }, 350);
  });

  // ── Apply meta viewport to prevent zoom issues on iOS ─────────
  var viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute('content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }

  // ── Keep existing per-game dz-fs-btn buttons working too ──────
  // (so per-screen fullscreen buttons still work)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.dz-fs-btn');
    if (!btn || btn === fsBtn) return;
    if (isFS()) { exitFS(); }
    else {
      var screenId = btn.dataset.screen;
      var targetEl = screenId ? document.getElementById(screenId) : (wrapper || document.documentElement);
      requestFS(targetEl || document.documentElement);
    }
    setTimeout(updateFSBtn, 100);
  });

  // ── Init ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    scaleCanvasForMobile();
    scaleDpadButtons();
    optimizeHubCards();
  });

  // Run immediately too
  scaleCanvasForMobile();
  scaleDpadButtons();

  // ── Expose API ─────────────────────────────────────────────────
  window.DZMobile = {
    showWrapper:       showWrapper,
    hideWrapper:       hideWrapper,
    relocateControls:  relocateControls,
    requestFS:         requestFS,
    exitFS:            exitFS,
    isFS:              isFS,
    updateFSBtn:       updateFSBtn,
  };

})();
