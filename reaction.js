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
    waitTimer: null, resultTimer: null,
    roundResult: null,
    _wired: false,
  };

  window.reactionInit = function () {
    if (!RD._wired) { rdWireUI(); RD._wired = true; }
    rdShowHome();
  };
  window.reactionDestroy = function () { rdStop(); };

  function el(id) { return document.getElementById(id); }
  function on(id, fn) { var e = el(id); if (e) e.addEventListener('click', fn); }
  function setText(id, v) { var e = el(id); if (e) e.textContent = v; }

  function rdShowHome() {
    rdStop();
    el('rd-home').classList.remove('hidden');
    el('rd-play').classList.add('hidden');
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
  }

  // ── Start game ────────────────────────────────────────────────
  function rdStartGame() {
    rdStop();
    RD.over = false;
    RD.roundsWon = [0, 0];
    RD.phase = 'wait';

    el('rd-home').classList.add('hidden');
    el('rd-play').classList.remove('hidden');
    el('rd-result').classList.add('hidden');

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
      var botDelay = { easy: 600, medium: 280, hard: 55 }[RD.diff] || 280;
      botDelay += Math.random() * (RD.diff === 'hard' ? 20 : 150);
      RD.waitTimer = setTimeout(function () {
        if (RD.phase === 'signal') rdBotTap();
      }, botDelay);
    }

    // Auto-expire after 3 seconds
    RD.waitTimer = setTimeout(function () {
      if (RD.phase === 'signal') rdRoundResult(-1, -1, 3000);
    }, 3000);
  }

  function rdPlayerTap(pid) {
    if (RD.over || el('rd-play').classList.contains('hidden')) return;

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
      RD.resultTimer = setTimeout(function () {
        rdAfterRound();
      }, 2500);
      return;
    }

    if (RD.phase === 'signal') {
      var rt = Math.round(performance.now() - RD.signalTime);
      if (RD.waitTimer) { clearTimeout(RD.waitTimer); RD.waitTimer = null; }
      rdRoundResult(pid, 1 - pid, rt);
    }
  }

  function rdBotTap() {
    if (RD.phase === 'signal') {
      var rt = Math.round(performance.now() - RD.signalTime);
      if (RD.waitTimer) { clearTimeout(RD.waitTimer); RD.waitTimer = null; }
      rdRoundResult(1, 0, rt);
    }
  }

  function rdRoundResult(winner, loser, reactionMs) {
    RD.phase = 'result';
    rdSetSignal('result');

    if (winner === -1) {
      setText('rd-status', '⏰ Nobody tapped — draw!');
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
    RD.over = true;
    var winner = RD.roundsWon[0] > RD.roundsWon[1] ? 0 : 1;
    var names = ['Player 1', RD.mode === 'bot' ? 'Bot' : 'Player 2'];
    el('rd-result-title').textContent = '🏆 ' + names[winner] + ' Wins!';
    el('rd-result-detail').textContent = RD.roundsWon[0] + ' – ' + RD.roundsWon[1] + ' rounds';
    el('rd-result').classList.remove('hidden');
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
