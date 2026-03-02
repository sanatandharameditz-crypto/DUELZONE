// ═══════════════════════════════════════════════════════════════
// DuelZone · Mobile Optimization System  (mobile.js)
// Universal wrapper, fullscreen manager, joystick, touch controls
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var GAME_META = {
    'screen-ttt':          { name: 'Tic Tac Toe'         },
    'screen-rps':          { name: 'Rock Paper Scissors'  },
    'screen-tapbattle':    { name: 'Tap Battle'           },
    'screen-duel2048':     { name: '2048 Duel'            },
    'screen-c4':           { name: 'Connect Four'         },
    'screen-cricket':      { name: 'Hand Cricket'         },
    'screen-airhockey':    { name: 'Air Hockey'           },
    'screen-passbreach':   { name: 'Password Breaker'     },
    'screen-chess':        { name: 'Chess'                },
    'screen-battleship':   { name: 'Battleship'           },
    'screen-checkers':     { name: 'Checkers'             },
    'screen-darts':        { name: 'Darts Duel'           },
    'screen-tanks':        { name: 'Tanks Arena'          },
    'screen-starcatcher':  { name: 'Star Catcher'         },
    'screen-spacedodge':   { name: 'Space Dodge'          },
    'screen-pingpong':     { name: 'Ping Pong'            },
    'screen-minesweeper':  { name: 'Minesweeper Duel'     },
    'screen-tetris':       { name: 'Tetris Battle'        },
    'screen-bomberman':    { name: 'Bomberman Duel'       },
    'screen-drawguess':    { name: 'Draw & Guess'         },
    'screen-reaction':     { name: 'Reaction Duel'        },
    'screen-territory':    { name: 'Territory Wars'       },
    'screen-memoryflip':   { name: 'Memory Flip'          },
    'screen-connectdots':  { name: 'Connect Dots'         },
    'screen-snake':        { name: 'Snake Duel'           },
    'screen-typing':       { name: 'Typing Race'          },
    'screen-blackjack':    { name: 'Blackjack Duel'       },
    'screen-pixelracer':   { name: 'Pixel Racer'          },
  };

  // DOM references
  var wrapper   = document.getElementById('dz-universal-wrapper');
  var backBtn   = document.getElementById('dz-univ-back');
  var titleEl   = document.getElementById('dz-univ-game-title');
  var fsBtn     = document.getElementById('dz-univ-fs');
  var gameArea  = document.getElementById('dz-game-area');
  var ctrlZone  = document.getElementById('dz-universal-controls');

  var _activeScreen    = null;
  var _activeScreenId  = null;
  var _screenPlaceholder = null; // where screen lived before we moved it

  // ── Fullscreen ─────────────────────────────────────────────────
  function requestFS(el) {
    try {
      if (el.requestFullscreen)            el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen)    el.mozRequestFullScreen();
      else if (el.msRequestFullscreen)     el.msRequestFullscreen();
    } catch(e) {}
  }

  function exitFS() {
    try {
      if (document.exitFullscreen)            document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen)  document.mozCancelFullScreen();
      else if (document.msExitFullscreen)     document.msExitFullscreen();
    } catch(e) {}
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

  ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(function(ev) {
    document.addEventListener(ev, function() {
      updateFSBtn();
      setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 120);
    });
  });

  if (fsBtn) {
    fsBtn.addEventListener('click', function() {
      if (isFS()) { exitFS(); } else { requestFS(wrapper); }
    });
  }

  // ── Hide internal duplicate buttons ───────────────────────────
  // These classes/elements duplicate what our universal topbar already does
  // We hide them to prevent overlap and visual clutter
  var INTERNAL_BTN_SELECTORS = [
    '.ghp-back-hub',      // "← Hub" buttons inside game home panels
    '.ghp-back-v2',       // v2 style hub buttons
    '.dz-topbar',         // internal topbars that have their own FS + back buttons
  ];

  function hideInternalButtons(screenEl) {
    if (!screenEl) return;
    INTERNAL_BTN_SELECTORS.forEach(function(sel) {
      screenEl.querySelectorAll(sel).forEach(function(el) {
        el.style.display = 'none';
      });
    });
  }

  function restoreInternalButtons(screenEl) {
    if (!screenEl) return;
    INTERNAL_BTN_SELECTORS.forEach(function(sel) {
      screenEl.querySelectorAll(sel).forEach(function(el) {
        el.style.display = '';
      });
    });
  }

  // ── Move screen INTO #dz-game-area ────────────────────────────
  function moveScreenIntoWrapper(screenEl) {
    if (!screenEl || !gameArea) return;
    // Remember original parent so we can restore later
    _screenPlaceholder = document.createComment('dz-placeholder:' + screenEl.id);
    screenEl.parentNode.insertBefore(_screenPlaceholder, screenEl);
    gameArea.appendChild(screenEl);
    // Make it visible and fill the area
    screenEl.classList.remove('hidden');
    screenEl.style.width    = '100%';
    screenEl.style.minHeight = '0';
    screenEl.style.flex     = '1';
  }

  function restoreScreenFromWrapper(screenEl) {
    if (!screenEl) return;
    // Put it back where it was
    if (_screenPlaceholder && _screenPlaceholder.parentNode) {
      _screenPlaceholder.parentNode.insertBefore(screenEl, _screenPlaceholder);
      _screenPlaceholder.parentNode.removeChild(_screenPlaceholder);
    }
    _screenPlaceholder = null;
    // Reset inline styles we added
    screenEl.style.width     = '';
    screenEl.style.minHeight = '';
    screenEl.style.flex      = '';
  }

  // ── Show wrapper ──────────────────────────────────────────────
  function showWrapper(screenId) {
    // Restore previous screen first if switching games
    if (_activeScreen && _activeScreen !== document.getElementById(screenId)) {
      restoreInternalButtons(_activeScreen);
      restoreScreenFromWrapper(_activeScreen);
      _activeScreen.classList.add('hidden');
    }

    _activeScreenId = screenId;
    _activeScreen   = document.getElementById(screenId);

    var meta = GAME_META[screenId] || { name: screenId.replace('screen-','') };
    if (titleEl) titleEl.textContent = meta.name.toUpperCase();

    // Clear controls zone
    if (ctrlZone) { ctrlZone.innerHTML = ''; ctrlZone.style.display = 'none'; }

    // Move screen into our game area
    moveScreenIntoWrapper(_activeScreen);

    // Hide internal duplicate hub/topbar buttons
    hideInternalButtons(_activeScreen);

    // Show wrapper
    if (wrapper) wrapper.classList.add('dz-active');

    updateFSBtn();
    window.scrollTo(0, 0);
  }

  // ── Hide wrapper ──────────────────────────────────────────────
  function hideWrapper() {
    if (_activeScreen) {
      restoreInternalButtons(_activeScreen);
      restoreScreenFromWrapper(_activeScreen);
      _activeScreen.classList.add('hidden');
    }
    if (wrapper) wrapper.classList.remove('dz-active');
    if (ctrlZone) { ctrlZone.innerHTML = ''; ctrlZone.style.display = 'none'; }
    _activeScreen   = null;
    _activeScreenId = null;
  }

  // ── Intercept showHub ─────────────────────────────────────────
  var _origShowHub = window.showHub;
  window.showHub = function() {
    if (isFS()) exitFS();
    hideWrapper();
    if (_origShowHub) _origShowHub.apply(this, arguments);
  };

  if (backBtn) {
    backBtn.addEventListener('click', function() {
      window.showHub();
    });
  }

  // ── Intercept all show*() functions ──────────────────────────
  var SCREEN_MAP = {
    showTTT:         'screen-ttt',
    showRPS:         'screen-rps',
    showTap:         'screen-tapbattle',
    show2048:        'screen-duel2048',
    showC4:          'screen-c4',
    showCricket:     'screen-cricket',
    showAH:          'screen-airhockey',
    showPB:          'screen-passbreach',
    showChess:       'screen-chess',
    showBattleship:  'screen-battleship',
    showCheckers:    'screen-checkers',
    showDarts:       'screen-darts',
    showTanks:       'screen-tanks',
    showStarCatcher: 'screen-starcatcher',
    showSpaceDodge:  'screen-spacedodge',
    showPingPong:    'screen-pingpong',
    showSnake:       'screen-snake',
    showTyping:      'screen-typing',
    showMinesweeper: 'screen-minesweeper',
    showBlackjack:   'screen-blackjack',
    showTetris:      'screen-tetris',
    showBomberman:   'screen-bomberman',
    showDrawGuess:   'screen-drawguess',
    showPixelRacer:  'screen-pixelracer',
    showReaction:    'screen-reaction',
    showTerritory:   'screen-territory',
    showMFD:         'screen-memoryflip',
    showCDD:         'screen-connectdots',
  };

  Object.keys(SCREEN_MAP).forEach(function(fnName) {
    var screenId = SCREEN_MAP[fnName];
    var original = window[fnName];
    window[fnName] = function() {
      if (original) original.apply(this, arguments);
      showWrapper(screenId);
    };
  });

  // ── Joystick relocation ───────────────────────────────────────
  var JOYSTICK_SELECTORS = {
    'screen-tanks':      '#tanks-mobile-controls',
    'screen-spacedodge': '#sd-joystick-wrap',
    'screen-bomberman':  '#bm-mobile-controls',
    'screen-pingpong':   '#pp-mobile-controls',
    'screen-tetris':     '#tetris-mobile-controls',
    'screen-snake':      '#snake-mobile-controls',
  };

  function relocateControls(screenId) {
    if (!ctrlZone) return;
    var sel = JOYSTICK_SELECTORS[screenId];
    if (!sel) { ctrlZone.style.display = 'none'; return; }

    function tryMove() {
      var el = document.querySelector(sel);
      if (el && el.parentNode !== ctrlZone) {
        ctrlZone.innerHTML = '';
        ctrlZone.appendChild(el);
        ctrlZone.style.display = '';
        return true;
      }
      return !!el;
    }

    if (!tryMove()) {
      var retries = 0;
      var iv = setInterval(function() {
        if (tryMove() || ++retries > 40) clearInterval(iv);
      }, 100);
    }
  }

  // Games with joysticks get extra relocation call after init
  ['showTanks','showSpaceDodge','showBomberman','showPingPong','showTetris','showSnake'].forEach(function(fnName) {
    var screenId = SCREEN_MAP[fnName];
    var current = window[fnName];
    window[fnName] = function() {
      if (current) current.apply(this, arguments);
      setTimeout(function() { relocateControls(screenId); }, 250);
    };
  });

  // ── Mobile canvas scaling ─────────────────────────────────────
  function scaleCanvases() {
    document.querySelectorAll('canvas').forEach(function(c) {
      c.style.maxWidth   = '100%';
      c.style.touchAction = 'none';
    });
  }

  // ── D-pad auto scaling ────────────────────────────────────────
  function scaleDpad() {
    var size = Math.max(48, Math.min(68, Math.floor(window.innerWidth * 0.14)));
    document.querySelectorAll('.dz-dpad-btn').forEach(function(b) {
      b.style.width     = size + 'px';
      b.style.height    = size + 'px';
      b.style.fontSize  = Math.floor(size * 0.44) + 'px';
    });
    document.querySelectorAll('.dz-action-btn').forEach(function(b) {
      b.style.height    = size + 'px';
      b.style.minWidth  = Math.floor(size * 1.2) + 'px';
    });
  }

  window.addEventListener('resize', function() { scaleCanvases(); scaleDpad(); });
  window.addEventListener('orientationchange', function() {
    setTimeout(function() {
      scaleCanvases();
      scaleDpad();
      window.dispatchEvent(new Event('resize'));
    }, 300);
  });

  // ── Prevent pinch zoom ────────────────────────────────────────
  document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // ── Swipe right from left edge → hub ─────────────────────────
  var _sx = 0, _sy = 0;
  document.addEventListener('touchstart', function(e) {
    _sx = e.touches[0].clientX;
    _sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (!_activeScreen) return;
    var dx = e.changedTouches[0].clientX - _sx;
    var dy = Math.abs(e.changedTouches[0].clientY - _sy);
    if (_sx < 30 && dx > 70 && dy < 60) window.showHub();
  }, { passive: true });

  // ── Observe new canvases / dpad ───────────────────────────────
  if (window.MutationObserver) {
    new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'CANVAS') { n.style.maxWidth = '100%'; n.style.touchAction = 'none'; }
          if (n.querySelector && n.querySelector('.dz-dpad-btn')) setTimeout(scaleDpad, 50);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Init ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    scaleCanvases();
    scaleDpad();
  });
  scaleCanvases();
  scaleDpad();

  window.DZMobile = { showWrapper, hideWrapper, relocateControls, requestFS, exitFS, isFS };

})();
