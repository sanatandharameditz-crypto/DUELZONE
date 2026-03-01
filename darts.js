// ═══════════════════════════════════════════════════════════════
// DuelZone · Darts Duel  (darts.js)
// Full darts game: 301/501/Best-of-5/Timed · PvP · PvBot
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── Dartboard geometry ────────────────────────────────────────
  var SEGMENTS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

  var RFRACS = {
    bullseye:    0.045,
    outerBull:   0.095,
    tripleIn:    0.330,
    tripleOut:   0.390,
    doubleIn:    0.600,
    doubleOut:   0.660,
  };

  var C = {
    black:   '#1a1a1a',
    cream:   '#f5e6c8',
    red:     '#c0392b',
    green:   '#1a7a3a',
    wire:    '#888',
    numbers: '#e8e8e8',
    dartBody:'#b0b0c0',
    dartTip: '#e8e8e8',
    aimLine: 'rgba(255,23,68,0.55)',
  };

  // ─── State ────────────────────────────────────────────────────
  var DS = {
    inited: false,
    mode: '301', timeSec: 60, doubleOut: false,
    vsBot: false, botDiff: 'medium',
    startScore: 301,
    scores: [301, 301],
    wins: [0, 0],
    currentPlayer: 0, dartsLeft: 3,
    turnScores: [], turnStartScores: [301, 301],
    gameOver: false,
    timerInterval: null, timerLeft: 60,
    canvas: null, ctx: null,
    boardR: 0, cx: 0, cy: 0,
    darts: [],
    animFrame: null, animFrom: null, animTo: null, animProgress: 0, animDart: null,
    isDragging: false, dragStart: null, dragCurrent: null,
    inputLocked: false,
    _popTimer: null,
  };

  var $ = function(id){ return document.getElementById(id); };

  window.dartsInit = function () {
    if (!DS.inited) { dartsSetupUI(); DS.inited = true; }
    var home = $('darts-home'), play = $('darts-play-panel');
    if (home) home.classList.remove('hidden');
    if (play) play.classList.add('hidden');
    dartsStopTimer();
  };

  // ─── UI Setup ─────────────────────────────────────────────────
  function dartsSetupUI() {
    $('darts-back-hub').addEventListener('click', function(){ showHub(); dartsStopTimer(); });

    document.querySelectorAll('.darts-mode-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.darts-mode-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        DS.mode = btn.getAttribute('data-mode');
        $('darts-timed-row').style.display    = DS.mode === 'timed' ? '' : 'none';
        $('darts-doubleout-row').style.display = DS.mode === 'timed' ? 'none' : '';
      });
    });

    document.querySelectorAll('.darts-time-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.darts-time-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        DS.timeSec = parseInt(btn.getAttribute('data-sec'));
      });
    });

    document.querySelectorAll('.darts-dout-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.darts-dout-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        DS.doubleOut = btn.getAttribute('data-dout') === '1';
      });
    });

    document.querySelectorAll('.darts-diff-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.darts-diff-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        DS.botDiff = btn.getAttribute('data-diff');
      });
    });

    $('darts-start-pvp').addEventListener('click', function(){ DS.vsBot = false; dartsStartGame(); });
    $('darts-start-bot').addEventListener('click', function(){ DS.vsBot = true;  dartsStartGame(); });

    $('darts-back-setup').addEventListener('click', function(){
      dartsStopTimer();
      cancelAnimationFrame(DS.animFrame);
      $('darts-play-panel').classList.add('hidden');
      $('darts-home').classList.remove('hidden');
    });

    $('darts-play-again').addEventListener('click', dartsStartGame);
    $('darts-result-hub').addEventListener('click', function(){ showHub(); dartsStopTimer(); });

    DS.canvas = $('darts-board');
    DS.ctx    = DS.canvas.getContext('2d');
    dartsResizeCanvas();
    window.addEventListener('resize', dartsResizeCanvas);

    DS.canvas.addEventListener('mousedown',  dartsOnMouseDown);
    DS.canvas.addEventListener('mousemove',  dartsOnMouseMove);
    DS.canvas.addEventListener('mouseup',    dartsOnMouseUp);
    DS.canvas.addEventListener('mouseleave', dartsOnMouseLeave);
    DS.canvas.addEventListener('touchstart', dartsOnTouchStart, {passive:false});
    DS.canvas.addEventListener('touchmove',  dartsOnTouchMove,  {passive:false});
    DS.canvas.addEventListener('touchend',   dartsOnTouchEnd,   {passive:false});
  }

  function dartsResizeCanvas() {
    var wrap = $('darts-canvas-wrap');
    if (!wrap || !DS.canvas) return;
    var w = Math.min(wrap.clientWidth || 400, 460);
    DS.canvas.width = w; DS.canvas.height = w;
    DS.cx = w/2; DS.cy = w/2; DS.boardR = w * 0.47;
    if (DS.ctx) dartsDraw();
  }

  // ─── Start Game ───────────────────────────────────────────────
  function dartsStartGame() {
    dartsStopTimer();
    cancelAnimationFrame(DS.animFrame);
    DS.startScore = DS.mode === '501' || DS.mode === 'bo5' ? 501 : DS.mode === 'timed' ? 999 : 301;
    DS.scores = [DS.startScore, DS.startScore];
    DS.wins   = [0, 0];
    DS.currentPlayer = 0; DS.dartsLeft = 3;
    DS.turnScores = []; DS.turnStartScores = [DS.startScore, DS.startScore];
    DS.gameOver = false; DS.darts = [];
    DS.isDragging = false; DS.dragStart = null; DS.dragCurrent = null;
    DS.inputLocked = false; DS.animDart = null;

    $('darts-home').classList.add('hidden');
    $('darts-play-panel').classList.remove('hidden');
    $('darts-result').classList.add('hidden');
    $('darts-p1-name').textContent = 'Player 1';
    $('darts-p2-name').textContent = DS.vsBot ? 'Bot' : 'Player 2';

    dartsResizeCanvas();
    dartsUpdateUI();
    dartsDraw();
    $('darts-aim-hint').style.display = '';

    if (DS.mode === 'timed') {
      DS.timerLeft = DS.timeSec;
      $('darts-timer-display').classList.remove('hidden');
      $('darts-timer-display').textContent = DS.timerLeft + 's';
      DS.timerInterval = setInterval(function(){
        DS.timerLeft--;
        $('darts-timer-display').textContent = DS.timerLeft + 's';
        if (DS.timerLeft <= 0) { dartsStopTimer(); dartsTimedEnd(); }
      }, 1000);
    } else {
      $('darts-timer-display').classList.add('hidden');
    }

    if (DS.vsBot && DS.currentPlayer === 1) {
      DS.inputLocked = true;
      setTimeout(dartsBotThrow, 800);
    }
  }

  function dartsStopTimer() {
    if (DS.timerInterval) { clearInterval(DS.timerInterval); DS.timerInterval = null; }
  }

  // ─── UI Update ────────────────────────────────────────────────
  function dartsUpdateUI() {
    var s0 = DS.mode === 'timed' ? (DS.startScore - DS.scores[0]) : DS.scores[0];
    var s1 = DS.mode === 'timed' ? (DS.startScore - DS.scores[1]) : DS.scores[1];
    $('darts-p1-score').textContent = DS.mode === 'timed' ? s0 : DS.scores[0];
    $('darts-p2-score').textContent = DS.mode === 'timed' ? s1 : DS.scores[1];
    $('darts-p1-panel').classList.toggle('darts-active-player', DS.currentPlayer === 0);
    $('darts-p2-panel').classList.toggle('darts-active-player', DS.currentPlayer === 1);
    var names = ['Player 1', DS.vsBot ? 'Bot' : 'Player 2'];
    $('darts-turn-text').textContent = names[DS.currentPlayer] + '\'s Turn';

    var pips = $('darts-dart-pips');
    pips.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var pip = document.createElement('span');
      pip.className = 'darts-pip' + (i < DS.dartsLeft ? ' darts-pip-active' : '');
      pips.appendChild(pip);
    }

    var t1 = $('darts-p1-throws'), t2 = $('darts-p2-throws');
    var chips = DS.turnScores.map(function(s){ return '<span class="darts-throw-chip">'+s+'</span>'; }).join('');
    if (DS.currentPlayer === 0) { t1.innerHTML = chips; t2.innerHTML = ''; }
    else                        { t2.innerHTML = chips; t1.innerHTML = ''; }

    if (DS.mode === 'bo5') {
      $('darts-p1-name').textContent = 'P1 ['+DS.wins[0]+']';
      $('darts-p2-name').textContent = (DS.vsBot?'Bot':'P2')+' ['+DS.wins[1]+']';
    }
  }

  // ─── Input ────────────────────────────────────────────────────
  function canvasPos(evt) {
    var r = DS.canvas.getBoundingClientRect();
    var sx = DS.canvas.width / r.width, sy = DS.canvas.height / r.height;
    return { x:(evt.clientX-r.left)*sx, y:(evt.clientY-r.top)*sy };
  }

  function dartsOnMouseDown(e) {
    if (DS.inputLocked || DS.gameOver) return;
    if (DS.vsBot && DS.currentPlayer === 1) return;
    DS.isDragging = true; DS.dragStart = canvasPos(e); DS.dragCurrent = DS.dragStart;
    $('darts-aim-hint').style.display = 'none'; dartsDraw();
  }
  function dartsOnMouseMove(e) { if(!DS.isDragging) return; DS.dragCurrent = canvasPos(e); dartsDraw(); }
  function dartsOnMouseUp()     { if(!DS.isDragging) return; DS.isDragging = false; dartsThrowFromDrag(); }
  function dartsOnMouseLeave()  { if(!DS.isDragging) return; DS.isDragging = false; dartsThrowFromDrag(); }

  function dartsOnTouchStart(e) {
    e.preventDefault();
    if (DS.inputLocked || DS.gameOver) return;
    if (DS.vsBot && DS.currentPlayer === 1) return;
    DS.isDragging = true; DS.dragStart = canvasPos(e.changedTouches[0]); DS.dragCurrent = DS.dragStart;
    $('darts-aim-hint').style.display = 'none'; dartsDraw();
  }
  function dartsOnTouchMove(e) { e.preventDefault(); if(!DS.isDragging) return; DS.dragCurrent = canvasPos(e.changedTouches[0]); dartsDraw(); }
  function dartsOnTouchEnd(e)  { e.preventDefault(); if(!DS.isDragging) return; DS.isDragging = false; dartsThrowFromDrag(); }

  function dartsThrowFromDrag() {
    if (!DS.dragStart || !DS.dragCurrent) return;
    var dx = DS.dragStart.x - DS.dragCurrent.x;
    var dy = DS.dragStart.y - DS.dragCurrent.y;
    var dist = Math.sqrt(dx*dx+dy*dy);
    if (dist < 4) { DS.inputLocked = false; return; } // Too small = cancelled
    var maxDrag = DS.boardR * 0.5;
    var power = Math.min(dist, maxDrag) / maxDrag;
    var normX = dx/dist, normY = dy/dist;
    var aimX = DS.cx + normX * DS.boardR * 0.6 * power;
    var aimY = DS.cy + normY * DS.boardR * 0.6 * power;
    // Human inaccuracy
    var inac = DS.boardR * 0.06;
    aimX += (Math.random()-0.5)*inac;
    aimY += (Math.random()-0.5)*inac;
    DS.dragStart = null; DS.dragCurrent = null;
    dartsThrowAt(aimX, aimY);
  }

  // ─── Core throw ───────────────────────────────────────────────
  function dartsThrowAt(tx, ty) {
    if (DS.inputLocked && !( DS.vsBot && DS.currentPlayer===1 )) return;
    DS.inputLocked = true;
    var hit = dartsScoreHit(tx, ty);
    var fromX = DS.cx + (tx - DS.cx)*3.5, fromY = DS.cy + (ty - DS.cy)*3.5;
    DS.animFrom = {x:fromX, y:fromY}; DS.animTo = {x:tx, y:ty}; DS.animProgress = 0;
    dartsFlyAnimate(hit);
  }

  function dartsFlyAnimate(hit) {
    DS.animProgress += 0.14;
    if (DS.animProgress >= 1) {
      DS.darts.push({x:DS.animTo.x, y:DS.animTo.y, alpha:1, score:hit.score});
      DS.animDart = null; DS.animFrom = null; DS.animTo = null;
      dartsDraw();
      dartsLandEffect(hit);
      return;
    }
    var t = 1 - Math.pow(1-DS.animProgress,3);
    DS.animDart = {
      x: DS.animFrom.x + (DS.animTo.x - DS.animFrom.x)*t,
      y: DS.animFrom.y + (DS.animTo.y - DS.animFrom.y)*t
    };
    dartsDraw();
    DS.animFrame = requestAnimationFrame(function(){ dartsFlyAnimate(hit); });
  }

  function dartsLandEffect(hit) {
    DS.animDart = null;
    var p = DS.currentPlayer;
    var newScore = DS.scores[p] - hit.score;
    var bust = false;

    if (DS.mode !== 'timed') {
      if (newScore < 0) bust = true;
      if (newScore === 0 && DS.doubleOut && !hit.isDouble && hit.score !== 50) bust = true;
      if (newScore === 1 && DS.doubleOut) bust = true;
    }

    var displayed = bust ? 0 : hit.score;
    DS.turnScores.push(displayed);
    DS.dartsLeft--;

    if (!bust) {
      if (DS.mode === 'timed') DS.scores[p] = Math.max(0, newScore);
      else DS.scores[p] = newScore;
    }

    dartsUpdateUI();

    if (bust) {
      // Dramatic BUST flash
      dartsBustFlash();
      dartsShowPopup('💥 BUST!', '#ff1744');
    } else {
      dartsShowPopup(hit.label + (hit.score > 0 ? '  +' + hit.score : ''), '#ffd600');
      // Show checkout suggestion if close to winning
      if (DS.mode !== 'timed' && DS.scores[p] <= 170 && DS.scores[p] > 0) {
        var co = dartsCheckoutSuggestion(DS.scores[p]);
        if (co) dartsShowCheckout(co);
      }
    }

    // Win check
    if (!bust && DS.mode !== 'timed' && DS.mode !== 'bo5' && DS.scores[p] === 0) {
      setTimeout(function(){ dartsEndGame(p); }, 700);
      return;
    }

    if (!bust && DS.mode === 'bo5' && DS.scores[p] === 0) {
      DS.wins[p]++;
      setTimeout(function(){
        if (DS.wins[p] >= 3) { dartsEndGame(p); }
        else {
          DS.scores = [DS.startScore, DS.startScore];
          DS.darts = []; DS.dartsLeft = 3; DS.turnScores = [];
          DS.turnStartScores = [DS.startScore, DS.startScore];
          DS.currentPlayer = p === 0 ? 1 : 0;
          DS.inputLocked = false; dartsUpdateUI(); dartsDraw();
          if (DS.vsBot && DS.currentPlayer === 1) { DS.inputLocked = true; setTimeout(dartsBotThrow, 800); }
        }
      }, 800);
      return;
    }

    if (DS.dartsLeft <= 0) {
      setTimeout(function(){ dartsNextTurn(bust); }, 800);
    } else {
      DS.inputLocked = false;
      if (DS.vsBot && DS.currentPlayer === 1) {
        DS.inputLocked = true;
        setTimeout(dartsBotThrow, 600 + Math.random()*500);
      }
    }
  }

  function dartsBustFlash() {
    var overlay = $('darts-bust-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'darts-bust-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;' +
        'background:rgba(255,23,68,0);transition:background 0.08s;border-radius:12px;';
      var wrap = $('darts-canvas-wrap') || $('darts-app');
      if (wrap) { wrap.style.position='relative'; wrap.appendChild(overlay); }
    }
    overlay.style.background = 'rgba(255,23,68,0.38)';
    setTimeout(function() { overlay.style.background = 'rgba(255,23,68,0)'; }, 350);
  }

  function dartsCheckoutSuggestion(score) {
    // Common checkout routes (simplified)
    var checkouts = {
      170:['T20','T20','Bull'], 167:['T20','T19','Bull'], 164:['T20','T18','Bull'],
      161:['T20','T17','Bull'], 160:['T20','T20','D20'], 158:['T20','T20','D19'],
      157:['T20','T19','D20'], 156:['T20','T20','D18'], 155:['T20','T19','D19'],
      154:['T20','T18','D20'], 153:['T20','T19','D18'], 152:['T20','T20','D16'],
      151:['T20','T17','D20'], 150:['T20','T18','D18'], 149:['T20','T19','D16'],
      148:['T20','T20','D14'], 147:['T20','T17','D18'], 146:['T20','T18','D16'],
      145:['T20','T15','D20'], 144:['T20','T20','D12'], 143:['T20','T17','D16'],
      142:['T20','T14','D20'], 141:['T20','T19','D12'], 140:['T20','T20','D10'],
      100:['T20','D20'], 99:['T19','D21'], 98:['T20','D19'], 97:['T19','D20'],
      96:['T20','D18'], 95:['T19','D19'], 94:['T18','D20'], 93:['T19','D18'],
      92:['T20','D16'], 91:['T17','D20'], 90:['T20','D15'], 89:['T19','D16'],
      88:['T20','D14'], 87:['T17','D18'], 86:['T18','D16'], 85:['T15','D20'],
      84:['T20','D12'], 83:['T17','D16'], 82:['T14','D20'], 81:['T19','D12'],
      80:['T20','D10'], 50:['Bull'], 40:['D20'], 36:['D18'], 32:['D16'],
      24:['D12'], 20:['D10'], 16:['D8'], 8:['D4'], 4:['D2']
    };
    return checkouts[score] || null;
  }

  var _checkoutTimer = null;
  function dartsShowCheckout(route) {
    var el = $('darts-checkout-hint');
    if (!el) return;
    el.textContent = '💡 Checkout: ' + route.join(' → ');
    el.classList.remove('hidden');
    clearTimeout(_checkoutTimer);
    _checkoutTimer = setTimeout(function() { el.classList.add('hidden'); }, 3000);
  }

  function dartsNextTurn(bust) {
    var p = DS.currentPlayer;
    if (bust) DS.scores[p] = DS.turnStartScores[p];
    DS.currentPlayer = p === 0 ? 1 : 0;
    DS.dartsLeft = 3; DS.turnScores = [];
    DS.turnStartScores = [DS.scores[0], DS.scores[1]];
    DS.darts = []; DS.inputLocked = false;
    dartsUpdateUI(); dartsDraw();
    if (DS.vsBot && DS.currentPlayer === 1) { DS.inputLocked = true; setTimeout(dartsBotThrow, 900); }
  }

  function dartsTimedEnd() {
    var p;
    if (DS.mode === 'timed') {
      // Higher scored (lower remaining)
      if (DS.scores[0] < DS.scores[1]) p = 0;
      else if (DS.scores[1] < DS.scores[0]) p = 1;
      else p = -1;
    }
    dartsEndGame(p);
  }

  function dartsEndGame(winner) {
    DS.gameOver = true; dartsStopTimer();
    var names = ['Player 1', DS.vsBot ? 'Bot' : 'Player 2'];
    var title = '', detail = '';
    if (winner === -1 || winner === undefined) {
      title  = "🤝 Draw!";
      detail = 'Exactly equal scores!';
    } else {
      title  = '🎯 ' + names[winner] + ' Wins!';
      detail = DS.mode === 'bo5' ? 'Series: '+DS.wins[0]+' – '+DS.wins[1] : 'Reached zero!';
    }
    $('darts-result-title').textContent  = title;
    $('darts-result-detail').textContent = detail;
    $('darts-result').classList.remove('hidden');
    dartsConfetti();
    if (typeof SoundManager !== 'undefined' && SoundManager.win) SoundManager.win();
  }

  // ─── Bot ──────────────────────────────────────────────────────
  function dartsBotThrow() {
    if (DS.gameOver) return;
    var tgt = dartsBotTarget(DS.scores[1]);
    var inac = DS.boardR * ({easy:0.40, medium:0.20, hard:0.018}[DS.botDiff]||0.20);
    var tx = tgt.x + (Math.random()-0.5)*inac;
    var ty = tgt.y + (Math.random()-0.5)*inac;
    dartsThrowAt(tx, ty);
  }

  function dartsBotTarget(rem) {
    var r = DS.boardR, cx = DS.cx, cy = DS.cy;
    var diff = DS.botDiff;
    if (diff === 'easy') {
      var a = Math.random()*Math.PI*2, d = Math.random()*r*0.7;
      return {x: cx+Math.cos(a)*d, y: cy+Math.sin(a)*d};
    }
    if (rem === 50 || rem === 25) return {x:cx, y:cy}; // bullseye

    if (DS.doubleOut && rem <= 40 && rem % 2 === 0) {
      // Aim for the exact double needed
      var si = SEGMENTS.indexOf(rem/2);
      if (si >= 0) {
        var sa = dartsSegAngle(si);
        var dr = (RFRACS.doubleIn+RFRACS.doubleOut)/2*r;
        return {x:cx+Math.cos(sa)*dr, y:cy+Math.sin(sa)*dr};
      }
    }

    if (diff === 'hard') {
      // Hard: optimal target strategy
      // If rem > 60 aim triple 20, if rem > 40 aim triple 20 or triple best
      if (rem > 60) {
        var t20 = (RFRACS.tripleIn+RFRACS.tripleOut)/2*r;
        return {x:cx+Math.cos(-Math.PI/2)*t20, y:cy+Math.sin(-Math.PI/2)*t20};
      }
      // For awkward numbers, aim at the segment directly
      var bestSeg = Math.min(20, rem > 20 ? 20 : rem);
      var si2 = SEGMENTS.indexOf(bestSeg);
      if (si2 >= 0) {
        var sa2 = dartsSegAngle(si2);
        var ts = (RFRACS.tripleIn+RFRACS.tripleOut)/2*r;
        return {x:cx+Math.cos(sa2)*ts, y:cy+Math.sin(sa2)*ts};
      }
    }
    // Default: Aim triple 20
    var t20b = (RFRACS.tripleIn+RFRACS.tripleOut)/2*r;
    return {x:cx+Math.cos(-Math.PI/2)*t20b, y:cy+Math.sin(-Math.PI/2)*t20b};
  }

  // ─── Score calculation ────────────────────────────────────────
  function dartsScoreHit(px, py) {
    var dx = px-DS.cx, dy = py-DS.cy;
    var dist = Math.sqrt(dx*dx+dy*dy);
    var r = DS.boardR;
    if (dist <= RFRACS.bullseye*r)  return {score:50, label:'BULLSEYE 🎯', isDouble:true};
    if (dist <= RFRACS.outerBull*r) return {score:25, label:'OUTER BULL', isDouble:false};
    if (dist > RFRACS.doubleOut*r)  return {score:0,  label:'MISS', isDouble:false};

    var angle = Math.atan2(dy, dx) + Math.PI/2;
    if (angle < 0) angle += Math.PI*2;
    var segIdx = Math.floor(angle / (Math.PI*2/20)) % 20;
    var sv = SEGMENTS[segIdx];

    if (dist >= RFRACS.doubleIn*r && dist <= RFRACS.doubleOut*r)
      return {score:sv*2, label:'D'+sv, isDouble:true};
    if (dist >= RFRACS.tripleIn*r && dist <= RFRACS.tripleOut*r)
      return {score:sv*3, label:'T'+sv, isDouble:false};
    return {score:sv, label:''+sv, isDouble:false};
  }

  function dartsSegAngle(segIdx) {
    return -Math.PI/2 + (segIdx+0.5)/20*Math.PI*2;
  }

  // ─── Popup ───────────────────────────────────────────────────
  function dartsShowPopup(text, color) {
    var pop = $('darts-score-popup');
    pop.textContent = text;
    pop.style.color = color || '#fff';
    pop.classList.remove('hidden', 'darts-pop-anim');
    void pop.offsetWidth; // reflow
    pop.classList.add('darts-pop-anim');
    clearTimeout(DS._popTimer);
    DS._popTimer = setTimeout(function(){
      pop.classList.add('hidden');
    }, 1500);
  }

  // ─── Confetti ────────────────────────────────────────────────
  function dartsConfetti() {
    var wrap = $('darts-app');
    if (!wrap) return;
    for (var i = 0; i < 60; i++) {
      (function(idx){
        setTimeout(function(){
          var c = document.createElement('div');
          c.className = 'darts-confetti-piece';
          c.style.cssText = 'left:'+Math.random()*100+'%;background:'+['#ff1744','#ffd600','#00e676','#2979ff','#aa00ff'][Math.floor(Math.random()*5)]+';animation-duration:'+(0.8+Math.random()*1.2)+'s;width:'+(6+Math.random()*8)+'px;height:'+(6+Math.random()*8)+'px;border-radius:2px;';
          wrap.appendChild(c);
          setTimeout(function(){ if (c.parentNode) c.parentNode.removeChild(c); }, 2500);
        }, idx*30);
      })(i);
    }
  }

  // ─── Drawing ─────────────────────────────────────────────────
  function dartsDraw() {
    var c = DS.ctx, W = DS.canvas.width;
    c.clearRect(0,0,W,W);
    dartsDrawBoard(c);
    DS.darts.forEach(function(d){ dartsDrawDartAt(c,d.x,d.y); });
    if (DS.animDart) dartsDrawDartAt(c, DS.animDart.x, DS.animDart.y);
    if (DS.isDragging) dartsDrawAimLine(c);
  }

  function dartsDrawBoard(c) {
    var cx=DS.cx, cy=DS.cy, r=DS.boardR;
    // Board background shadow
    c.save();
    c.shadowColor='rgba(0,0,0,0.8)'; c.shadowBlur=24;
    c.beginPath(); c.arc(cx,cy,r*1.04,0,Math.PI*2);
    c.fillStyle='#111'; c.fill();
    c.restore();

    var step = Math.PI*2/20, base = -Math.PI/2 - step/2;
    for (var i=0; i<20; i++) {
      var a1=base+i*step, a2=a1+step, even=(i%2===0);
      var sc = even ? C.black : C.cream;
      var kc = even ? C.red   : C.green;
      // inner single
      fillSector(c,cx,cy,RFRACS.outerBull*r, RFRACS.tripleIn*r, a1,a2,sc);
      // triple
      fillSector(c,cx,cy,RFRACS.tripleIn*r,  RFRACS.tripleOut*r,a1,a2,kc);
      // outer single
      fillSector(c,cx,cy,RFRACS.tripleOut*r, RFRACS.doubleIn*r, a1,a2,sc);
      // double
      fillSector(c,cx,cy,RFRACS.doubleIn*r,  RFRACS.doubleOut*r,a1,a2,kc);
    }

    // Outer bull
    c.beginPath(); c.arc(cx,cy,RFRACS.outerBull*r,0,Math.PI*2);
    c.fillStyle='#1a7a3a'; c.fill();
    // Bullseye
    c.beginPath(); c.arc(cx,cy,RFRACS.bullseye*r,0,Math.PI*2);
    c.fillStyle='#c0392b'; c.fill();

    // Wire lines
    c.strokeStyle=C.wire; c.lineWidth=1.2;
    for (var j=0;j<20;j++){
      var wa=base+j*step;
      c.beginPath();
      c.moveTo(cx+Math.cos(wa)*RFRACS.outerBull*r, cy+Math.sin(wa)*RFRACS.outerBull*r);
      c.lineTo(cx+Math.cos(wa)*r, cy+Math.sin(wa)*r);
      c.stroke();
    }
    [RFRACS.outerBull,RFRACS.tripleIn,RFRACS.tripleOut,RFRACS.doubleIn,RFRACS.doubleOut,RFRACS.bullseye].forEach(function(fr){
      c.beginPath(); c.arc(cx,cy,fr*r,0,Math.PI*2); c.stroke();
    });

    // Numbers
    c.fillStyle=C.numbers;
    c.font='bold '+Math.max(10,Math.floor(r*0.12))+'px Rajdhani,sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    var nr=r*0.75;
    for (var k=0;k<20;k++){
      var na=base+(k+0.5)*step;
      c.fillText(SEGMENTS[k], cx+Math.cos(na)*nr, cy+Math.sin(na)*nr);
    }
  }

  function fillSector(c,cx,cy,r1,r2,a1,a2,color){
    c.beginPath();
    c.arc(cx,cy,r2,a1,a2);
    c.arc(cx,cy,r1,a2,a1,true);
    c.closePath();
    c.fillStyle=color; c.fill();
  }

  function dartsDrawDartAt(c,x,y){
    c.save();
    c.shadowColor='rgba(0,0,0,0.6)'; c.shadowBlur=6;
    // Barrel
    c.strokeStyle='#aabbcc'; c.lineWidth=3; c.lineCap='round';
    c.beginPath(); c.moveTo(x,y); c.lineTo(x+9,y-9); c.stroke();
    // Shaft
    c.strokeStyle='#888'; c.lineWidth=1.5;
    c.beginPath(); c.moveTo(x+9,y-9); c.lineTo(x+15,y-15); c.stroke();
    // Flights
    c.fillStyle='#ff1744';
    c.beginPath(); c.moveTo(x+15,y-15); c.lineTo(x+22,y-12); c.lineTo(x+18,y-20); c.closePath(); c.fill();
    c.fillStyle='rgba(255,23,68,0.5)';
    c.beginPath(); c.moveTo(x+15,y-15); c.lineTo(x+12,y-22); c.lineTo(x+18,y-20); c.closePath(); c.fill();
    // Tip
    c.fillStyle='#e8f0ff';
    c.beginPath(); c.arc(x,y,2,0,Math.PI*2); c.fill();
    c.restore();
  }

  function dartsDrawAimLine(c){
    if (!DS.dragStart || !DS.dragCurrent) return;
    var dx=DS.dragStart.x-DS.dragCurrent.x, dy=DS.dragStart.y-DS.dragCurrent.y;
    var dist=Math.sqrt(dx*dx+dy*dy);
    if (dist<4) return;
    var maxDrag=DS.boardR*0.5, power=Math.min(dist,maxDrag)/maxDrag;
    var nx=dx/dist, ny=dy/dist;
    var ax=DS.cx+nx*DS.boardR*0.6*power, ay=DS.cy+ny*DS.boardR*0.6*power;
    c.save();
    c.setLineDash([6,5]); c.strokeStyle='rgba(255,23,68,0.6)'; c.lineWidth=1.8;
    c.beginPath(); c.moveTo(DS.dragStart.x,DS.dragStart.y); c.lineTo(ax,ay); c.stroke();
    c.setLineDash([]);
    c.strokeStyle='rgba(255,23,68,0.85)'; c.lineWidth=1.5;
    var cs=9;
    c.beginPath();
    c.moveTo(ax-cs,ay); c.lineTo(ax+cs,ay);
    c.moveTo(ax,ay-cs); c.lineTo(ax,ay+cs);
    c.stroke();
    c.beginPath(); c.arc(ax,ay,4,0,Math.PI*2); c.stroke();
    c.restore();
  }

})();
