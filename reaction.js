// ═══════════════════════════════════════════════════════════════
// DuelZone · Reaction Duel  (reaction.js)
// A signal appears — tap your button first. Best of 7 rounds.
// Penalty for jumping the gun (false start).
// PvP: Both humans tap | PvBot: Bot reacts with configurable delay
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var ROUNDS = 7;
  var FALSE_START_PENALTY = 2; // lose N rounds

  var RD = {
    mode: 'pvp', diff: 'medium', over: false,
    roundsWon: [0, 0],
    phase: 'wait', // wait | ready | signal | result | done
    signalTime: 0,
    waitTimer: null, resultTimer: null, botTimer: null,
    roundResult: null,
    _wired: false,
  };

  window.reactionInit    = function () {
    if (!RD._wired) { rdWireUI(); RD._wired = true; }
    rdShowHome();
  };
  window.reactionDestroy = function () { rdStop(); };
  window.rdStop          = function () { rdStop(); };  // called by dzPauseAllGames
  window.reactionStop    = function () { rdStop(); };  // alias

  // Pause: freeze all timers, remember what phase we were in
  window.reactionPause = function () {
    if (RD.over) return;
    RD._pausedPhase = RD.phase;
    if (RD.waitTimer)   { clearTimeout(RD.waitTimer);   RD.waitTimer   = null; }
    if (RD.resultTimer) { clearTimeout(RD.resultTimer); RD.resultTimer = null; }
    if (RD.botTimer)    { clearTimeout(RD.botTimer);    RD.botTimer    = null; }
    // Note the time elapsed so we can resume the signal timer correctly
    if (RD.phase === 'signal') RD._pauseSignalMs = performance.now() - RD.signalTime;
  };
  // Resume: restart whichever timer was running
  window.reactionResume = function () {
    if (RD.over) return;
    var phase = RD._pausedPhase;
    if (!phase || phase === 'wait' || phase === 'result' || phase === 'done') return;
    if (phase === 'ready') {
      // Still waiting for signal — fire a new random delay
      var delay = 800 + Math.random() * 2200;
      RD.waitTimer = setTimeout(function () {
        if (RD.over || RD.phase !== 'ready') return;
        rdShowSignal();
      }, delay);
    } else if (phase === 'signal') {
      // Signal was showing — adjust signalTime for time spent paused
      var elapsed = RD._pauseSignalMs || 0;
      RD.signalTime = performance.now() - elapsed;
      // Restart bot timer with remaining time
      if (RD.mode === 'bot') {
        var botDelay = { easy: 700, medium: 300, hard: 10 }[RD.diff] || 300;
        botDelay += Math.random() * (RD.diff === 'hard' ? 8 : 180);
        var remaining = Math.max(50, botDelay - elapsed);
        RD.botTimer = setTimeout(function () {
          if (RD.phase === 'signal') rdBotTap();
        }, remaining);
      }
      // Restart auto-expire
      var expireRemaining = Math.max(200, 3000 - elapsed);
      RD.waitTimer = setTimeout(function () {
        if (RD.phase === 'signal') rdRoundResult(-1, 3000);
      }, expireRemaining);
    }
  };

  function el(id) { return document.getElementById(id); }
  function on(id, fn) { var e = el(id); if (e) e.addEventListener('click', fn); }
  function setText(id, v) { var e = el(id); if (e) e.textContent = v; }

  function rdShowHome() {
    rdStop();
    window.scrollTo(0, 0);
    var home = el('rd-home');
    if (home) {
      home.classList.remove('hidden');
      home.style.removeProperty('display');
      home.style.removeProperty('visibility');
    }
    var play = el('rd-play');
    if (play) {
      play.classList.add('hidden');
      play.style.setProperty('display','none','important');
    }
    var backBtn = el('rd-back-play');
    if (backBtn) backBtn.style.display = 'none';
  }

  function rdWireUI() {
    on('rd-back-hub',   function () { rdStop(); showHub(); });
    on('rd-back-play',  function () { rdStop(); rdShowHome(); });
    on('rd-again',      function () { rdStartGame(); });
    on('rd-result-hub', function () { rdStop(); showHub(); });
    on('rd-start-btn',  function () { rdStartGame(); });

    on('rd-mode-pvp', function () {
      RD.mode = 'pvp';
      el('rd-mode-pvp').classList.add('active');
      el('rd-mode-bot').classList.remove('active');
      var bs = el('rd-bot-settings'); if (bs) bs.classList.add('hidden');
    });
    on('rd-mode-bot', function () {
      RD.mode = 'bot';
      el('rd-mode-bot').classList.add('active');
      el('rd-mode-pvp').classList.remove('active');
      var bs = el('rd-bot-settings'); if (bs) bs.classList.remove('hidden');
    });

    document.querySelectorAll('.rd-diff').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.rd-diff').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); RD.diff = b.dataset.diff;
      });
    });

    /* ── Auto-apply difficulty from challenge link ─────────── */
    (function() {
      if (!window.DZShare || typeof DZShare.getChallenge !== 'function') return;
      var _ch = DZShare.getChallenge();
      if (!_ch || _ch.slug !== 'reaction-duel' || !_ch.diff) return;
      var target = _ch.diff.toLowerCase();
      document.querySelectorAll('.rd-diff').forEach(function (b) {
        if ((b.dataset.diff || '').toLowerCase() === target) {
          document.querySelectorAll('.rd-diff').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active'); RD.diff = target;
        }
      });
    })();

    on('rd-tap-p1', function () { rdPlayerTap(0); });
    on('rd-tap-p2', function () { rdPlayerTap(1); });

    // Keyboard shortcuts: Space = P1, Enter = P2
    document.addEventListener('keydown', function (e) {
      if (el('rd-play') && !el('rd-play').classList.contains('hidden')) {
        if (e.key === ' ') { e.preventDefault(); rdPlayerTap(0); }
        if (e.key === 'Enter') { e.preventDefault(); rdPlayerTap(1); }
      }
    });
  }

  function rdStop() {
    RD.over = true;
    if (RD.waitTimer) { clearTimeout(RD.waitTimer); RD.waitTimer = null; }
    if (RD.resultTimer) { clearTimeout(RD.resultTimer); RD.resultTimer = null; }
    if (RD.botTimer) { clearTimeout(RD.botTimer); RD.botTimer = null; }
  }

  // ── Start game ────────────────────────────────────────────────
  function rdStartGame() {
    rdStop();
    RD.over = false;
    RD.roundsWon = [0, 0];
    RD.phase = 'wait';
    window.scrollTo(0, 0);

    var homeEl = el('rd-home');
    if (homeEl) { homeEl.classList.add('hidden'); homeEl.style.display = 'none'; }
    var playEl = el('rd-play');
    if (playEl) { playEl.classList.remove('hidden'); playEl.style.setProperty('display','flex','important'); playEl.scrollTop = 0; }
    var rdResultEl = el('rd-result'); // FIX BUG-1: null-guard missing — every other el() call in this function is guarded but this one wasn't; crashes game-start with TypeError if element is absent
    if (rdResultEl) rdResultEl.classList.add('hidden');
    var backBtn = el('rd-back-play'); if (backBtn) backBtn.style.display = 'block';

    var p2name = RD.mode === 'bot' ? '🤖 Bot' : 'Player 2';
    setText('rd-p2-name', p2name);

    // Hide P2 tap button in bot mode
    var p2btn = el('rd-tap-p2');
    if (p2btn) p2btn.style.display = RD.mode === 'bot' ? 'none' : '';

    rdUpdateScores();
    rdNewRound();
  }

  function rdNewRound() {
    if (RD.roundsWon[0] >= ROUNDS || RD.roundsWon[1] >= ROUNDS) {
      rdShowFinal(); return;
    }
    if (RD.over) return;

    RD.phase = 'ready';
    rdSetSignal('wait');
    setText('rd-status', '⏳ Get ready...');

    // Random delay 1.5-4 seconds
    var delay = 1500 + Math.random() * 2500;
    RD.waitTimer = setTimeout(function () {
      if (RD.over || RD.phase !== 'ready') return;
      rdShowSignal();
    }, delay);
  }

  function rdShowSignal() {
    RD.phase = 'signal';
    RD.signalTime = performance.now();
    rdSetSignal('go');
    setText('rd-status', '🟢 TAP NOW!');

    // Bot reaction
    if (RD.mode === 'bot') {
      var botDelay = { easy: 700, medium: 300, hard: 10 }[RD.diff] || 300;
      botDelay += Math.random() * (RD.diff === 'hard' ? 8 : 180);
      RD.botTimer = setTimeout(function () {
        if (RD.phase === 'signal') rdBotTap();
      }, botDelay);
    }

    // Auto-expire after 3 seconds
    RD.waitTimer = setTimeout(function () {
      if (RD.phase === 'signal') rdRoundResult(-1, 3000);
    }, 3000);
  }

  function rdPlayerTap(pid) {
    var _play = el('rd-play');
    if (RD.over || !_play || _play.classList.contains('hidden')) return; // FIX BUG-2: el('rd-play') can be null; direct .classList access throws TypeError — mirrors the null-safe pattern used in the keydown handler above
    if (RD.mode === 'bot' && pid === 1) return; // FIX RD-1: block P2 keyboard tap in bot mode

    if (RD.phase === 'ready') {
      // False start!
      RD.phase = 'result';
      rdSetSignal('false');
      setText('rd-status', '❌ False start! ' + (pid === 0 ? 'Player 1' : (RD.mode === 'bot' ? 'Bot' : 'Player 2')) + ' loses ' + FALSE_START_PENALTY + ' rounds!');
      // Penalty
      var winner = 1 - pid;
      for (var i = 0; i < FALSE_START_PENALTY; i++) {
        if (RD.roundsWon[winner] < ROUNDS) RD.roundsWon[winner]++;
      }
      rdUpdateScores();
      if (RD.waitTimer) { clearTimeout(RD.waitTimer); RD.waitTimer = null; }
      if (RD.botTimer) { clearTimeout(RD.botTimer); RD.botTimer = null; }
      RD.resultTimer = setTimeout(function () {
        rdAfterRound();
      }, 2500);
      return;
    }

    if (RD.phase === 'signal') {
      var rt = Math.round(performance.now() - RD.signalTime);
      if (RD.waitTimer) { clearTimeout(RD.waitTimer); RD.waitTimer = null; }
      if (RD.botTimer) { clearTimeout(RD.botTimer); RD.botTimer = null; }
      rdRoundResult(pid, rt);
    }
  }

  function rdBotTap() {
    if (RD.phase === 'signal') {
      var rt = Math.round(performance.now() - RD.signalTime);
      if (RD.waitTimer) { clearTimeout(RD.waitTimer); RD.waitTimer = null; }
      rdRoundResult(1, rt);
    }
  }

  // FIX BUG-4: removed unused 'loser' parameter. It was passed at every call site
  // (as '1-pid' or '-1') but never read inside the function — a dead parameter that
  // implies it does something. Call sites are unchanged; JS silently ignores extras.
  function rdRoundResult(winner, reactionMs) {
    RD.phase = 'result';
    rdSetSignal('result');

    if (winner === -1 || winner === null || winner === undefined) {
      setText('rd-status', '⏰ Nobody tapped — draw!');
      // FIX RD-2: winner==-1 means nobody tapped; do NOT touch roundsWon[-1]
    } else {
      var names = ['Player 1', RD.mode === 'bot' ? 'Bot' : 'Player 2'];
      RD.roundsWon[winner]++;
      setText('rd-status', '🏆 ' + names[winner] + ' wins! (' + reactionMs + 'ms)');
    }

    rdUpdateScores();
    RD.resultTimer = setTimeout(rdAfterRound, 1800);
  }

  function rdAfterRound() {
    if (RD.roundsWon[0] >= ROUNDS || RD.roundsWon[1] >= ROUNDS) {
      rdShowFinal(); return;
    }
    rdNewRound();
  }

  function rdShowFinal() {
    rdStop(); // FIX BUG-3: was only setting RD.over=true; rdStop() is the single source of
             // truth for clearing all three timers and nulling their handles. Without this,
             // timer handles remain non-null after the game ends (especially in the
             // auto-expire path where botTimer/waitTimer are not cleared before reaching here).
    var names    = ['Player 1', RD.mode === 'bot' ? 'Bot' : 'Player 2'];
    var rdTitle  = el('rd-result-title');
    var rdDetail = el('rd-result-detail');
    var rdResult = el('rd-result');
    if (RD.roundsWon[0] === RD.roundsWon[1]) {
      if (rdTitle)  rdTitle.textContent  = '🤝 Draw!';
      if (rdDetail) rdDetail.textContent = RD.roundsWon[0] + ' – ' + RD.roundsWon[1] + ' rounds (tied)';
      if (window.DZShare) DZShare.setResult({ game:'Reaction Duel', slug:'reaction-duel', winner:"It's a Draw!", detail:RD.roundsWon[0]+' – '+RD.roundsWon[1]+' rounds (tied)', accent:'#aa00ff', icon:'⚡', score:0, diff:'', isWin:false });
    } else {
      var winner = RD.roundsWon[0] > RD.roundsWon[1] ? 0 : 1;
      if (rdTitle)  rdTitle.textContent  = '🏆 ' + names[winner] + ' Wins!';
      if (rdDetail) rdDetail.textContent = RD.roundsWon[0] + ' – ' + RD.roundsWon[1] + ' rounds';
      if (window.DZShare) DZShare.setResult({ game:'Reaction Duel', slug:'reaction-duel', winner:names[winner]+' Wins! 🏆', detail:RD.roundsWon[0]+' – '+RD.roundsWon[1]+' rounds', accent:'#aa00ff', icon:'⚡', score:RD.roundsWon[winner], diff:'', isWin:winner===0 });
    }
    if (rdResult) rdResult.classList.remove('hidden');
    if (typeof SoundManager !== 'undefined' && SoundManager.win) SoundManager.win();
  }

  function rdUpdateScores() {
    setText('rd-wins-p1', '★ ' + RD.roundsWon[0]);
    setText('rd-wins-p2', '★ ' + RD.roundsWon[1]);
    setText('rd-round-info', 'First to ' + ROUNDS + ' wins!');
  }

  function rdSetSignal(state) {
    var bg = el('rd-signal-bg');
    if (!bg) return;
    var states = {
      wait:   { bg: '#1a1c2e', emoji: '⌛', text: 'Wait for it...' },
      go:     { bg: '#00c853', emoji: '🟢', text: 'NOW!' },
      false:  { bg: '#d50000', emoji: '🔴', text: 'FALSE START!' },
      result: { bg: '#1a1c2e', emoji: '✅', text: '' },
    };
    var s = states[state] || states.wait;
    bg.style.background = s.bg;
    bg.style.transition = 'background 0.15s';
    setText('rd-signal-emoji', s.emoji);
    setText('rd-signal-text', s.text);
  }

})();
