// ═══════════════════════════════════════════════════════════════
// DuelZone · Draw & Guess  (drawguess.js)  — v2 FIXED
//
// FIXES vs v1:
//  1. Bot now animates real strokes on canvas when it draws
//  2. PvP: BOTH players can draw on their turn (was blocking turn=1)
//  3. Difficulty pills split: .dg-botdiff (speed) / .dg-worddiff (words)
//     — clicking one no longer resets the other
//  4. dgBotGuess delay fixed: was (timeLeft-5)*1000 which = 55000ms minimum
//  5. Default DG.color = '#000000' matches the active black button
//  6. Bot scoring: pts calculated from current timeLeft at guess moment
//  7. dgEndTurn guards double-call with phase check
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var WORD_LISTS = {
    easy:   ['cat','dog','sun','car','hat','fish','ball','tree','star','house',
             'book','bird','cake','moon','ship','rain','fire','leaf','king','lion',
             'cup','key','pen','bus','fly','egg','arm','map','pig','bee'],
    medium: ['rocket','guitar','turtle','castle','bridge','dragon','coffee',
             'umbrella','trumpet','volcano','mermaid','telescope','butterfly',
             'elephant','tornado','pyramid','lantern','compass','penguin','cactus'],
    hard:   ['democracy','labyrinth','orchestra','astronaut','philosophy',
             'paradox','guillotine','metamorphosis','archipelago','kaleidoscope',
             'hieroglyphic','conquistador','bureaucracy','Renaissance','thermometer'],
  };

  var ROUNDS    = 4;   // each player draws 4 times = 8 total turns
  var TURN_TIME = 60;  // seconds

  var DG = {
    mode: 'pvp',
    botDiff:  'medium',  // bot speed: easy=slow, hard=fast
    wordDiff: 'medium',  // word category
    over: false,
    round: 0, turn: 0,   // turn 0=P1 draws, 1=P2/Bot draws
    word: '', hintArr: [],
    scores: [0, 0],
    timeLeft: TURN_TIME,
    timerInterval:  null,
    botGuessTimer:  null,
    botDrawInterval:null,
    phase: 'home',
    drawing: false, lastX: 0, lastY: 0,
    color: '#000000',   // FIX: matches default active black button
    brushSize: 3,
    _wired: false,
  };

  window.drawguessInit    = function () { if (!DG._wired) { dgWireUI(); DG._wired = true; } dgShowHome(); };
  window.drawguessDestroy = function () { dgStop(); };

  function el(id)         { return document.getElementById(id); }
  function on(id, fn)     { var e = el(id); if (e) e.addEventListener('click', fn); }
  function setText(id, v) { var e = el(id); if (e) e.textContent = v; }
  function hintStr()      { return DG.hintArr.join(' '); }
  function shuffle(a)     {
    for (var i = a.length-1; i > 0; i--) {
      var j = Math.floor(Math.random()*(i+1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
  }

  // ── Screen toggle ─────────────────────────────────────────────
  function dgShowHome() {
    dgStop();
    DG.phase = 'home';
    el('dg-home').classList.remove('hidden');
    el('dg-play').classList.add('hidden');
    dgClearCanvas();
  }

  // ── Wire UI once ──────────────────────────────────────────────
  function dgWireUI() {
    on('dg-back-hub',   function () { dgStop(); showHub(); });
    on('dg-back-play',  function () { dgStop(); dgShowHome(); });
    on('dg-again',      function () { dgStartGame(); });
    on('dg-result-hub', function () { dgStop(); showHub(); });
    on('dg-start-btn',  function () { dgStartGame(); });

    on('dg-mode-pvp', function () {
      DG.mode = 'pvp';
      el('dg-mode-pvp').classList.add('active');
      el('dg-mode-bot').classList.remove('active');
      var bs = el('dg-bot-settings'); if (bs) bs.classList.add('hidden');
    });
    on('dg-mode-bot', function () {
      DG.mode = 'bot';
      el('dg-mode-bot').classList.add('active');
      el('dg-mode-pvp').classList.remove('active');
      var bs = el('dg-bot-settings'); if (bs) bs.classList.remove('hidden');
    });

    // FIX: separate pill classes prevent mutual interference
    document.querySelectorAll('.dg-botdiff').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.dg-botdiff').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); DG.botDiff = b.dataset.diff;
      });
    });
    document.querySelectorAll('.dg-worddiff').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.dg-worddiff').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); DG.wordDiff = b.dataset.diff;
      });
    });

    document.querySelectorAll('.dg-color').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.dg-color').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); DG.color = b.dataset.color;
      });
    });

    document.querySelectorAll('.dg-brush').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.dg-brush').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); DG.brushSize = parseInt(b.dataset.size, 10);
      });
    });

    on('dg-clear', function () { if (isHumanTurn()) dgClearCanvas(); });
    on('dg-pass',  function () { if (DG.phase === 'draw' && !DG.over) dgEndTurn(false); });

    var inp = el('dg-guess-input');
    if (inp) inp.addEventListener('input', function () { dgCheckGuess(inp.value); });

    [1, 2, 3].forEach(function (i) {
      on('dg-word-' + i, function () {
        var btn = el('dg-word-' + i);
        if (btn && DG.phase === 'pick') dgPickWord(btn.dataset.word);
      });
    });

    var canvas = el('dg-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', function (e) {
        if (!isHumanTurn()) return;
        DG.drawing = true;
        var p = getPos(canvas, e); DG.lastX = p.x; DG.lastY = p.y;
      });
      canvas.addEventListener('mousemove', function (e) {
        if (DG.drawing && isHumanTurn()) dgApplyStroke(canvas, e);
      });
      canvas.addEventListener('mouseup',    function () { DG.drawing = false; });
      canvas.addEventListener('mouseleave', function () { DG.drawing = false; });
      canvas.addEventListener('touchstart', function (e) {
        if (!isHumanTurn()) return;
        e.preventDefault(); DG.drawing = true;
        var p = getPos(canvas, e.touches[0]); DG.lastX = p.x; DG.lastY = p.y;
      }, { passive: false });
      canvas.addEventListener('touchmove', function (e) {
        if (DG.drawing && isHumanTurn()) { e.preventDefault(); dgApplyStroke(canvas, e.touches[0]); }
      }, { passive: false });
      canvas.addEventListener('touchend', function () { DG.drawing = false; });
    }
  }

  // FIX: only the correct human can draw
  // PvP: whoever's turn it is draws.  Bot mode: only P1 (turn=0).
  function isHumanTurn() {
    if (DG.over || DG.phase !== 'draw') return false;
    if (DG.mode === 'pvp') return true;
    return DG.turn === 0;
  }

  function getPos(canvas, e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width  / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    };
  }

  function dgStop() {
    DG.over = true; DG.drawing = false;
    if (DG.timerInterval)   { clearInterval(DG.timerInterval);   DG.timerInterval   = null; }
    if (DG.botGuessTimer)   { clearTimeout(DG.botGuessTimer);    DG.botGuessTimer   = null; }
    if (DG.botDrawInterval) { clearInterval(DG.botDrawInterval); DG.botDrawInterval = null; }
  }

  // ── Start game ────────────────────────────────────────────────
  function dgStartGame() {
    dgStop();
    DG.over = false; DG.round = 0; DG.turn = 0; DG.scores = [0, 0];
    el('dg-home').classList.add('hidden');
    el('dg-play').classList.remove('hidden');
    el('dg-result').classList.add('hidden');
    setText('dg-p2-name', DG.mode === 'bot' ? '🤖 Bot' : 'Player 2');
    dgClearCanvas();
    dgNextTurn();
  }

  // ── Turn flow ─────────────────────────────────────────────────
  function dgNextTurn() {
    if (DG.round >= ROUNDS * 2) { dgShowFinalResult(); return; }
    DG.turn  = DG.round % 2;
    DG.round++;
    DG.phase = 'pick';
    dgClearCanvas();
    dgShowWordPicker();
  }

  function dgShowWordPicker() {
    var words    = getRandomWords(3);
    var picker   = el('dg-word-picker');
    var drawArea = el('dg-draw-area');
    if (picker)   picker.classList.remove('hidden');
    if (drawArea) drawArea.classList.add('hidden');

    var isBot    = DG.mode === 'bot';
    var drawName = DG.turn === 0 ? 'Player 1' : (isBot ? '🤖 Bot' : 'Player 2');
    setText('dg-picker-title', '✏️ ' + drawName + ': Pick a word to draw!');

    [0, 1, 2].forEach(function (i) {
      var btn = el('dg-word-' + (i+1));
      if (btn) { btn.textContent = words[i]; btn.dataset.word = words[i]; }
    });

    if (isBot && DG.turn === 1) {
      setTimeout(function () {
        if (DG.phase === 'pick' && !DG.over) dgPickWord(words[Math.floor(Math.random()*3)]);
      }, 900);
    }
  }

  function getRandomWords(n) {
    var pool = (WORD_LISTS[DG.wordDiff] || WORD_LISTS.medium).slice();
    shuffle(pool);
    return pool.slice(0, n);
  }

  function dgPickWord(word) {
    if (DG.phase !== 'pick' || DG.over) return;
    DG.word    = word;
    DG.hintArr = word.split('').map(function (ch) { return /[a-z]/i.test(ch) ? '_' : ch; });
    DG.phase   = 'draw';

    var picker   = el('dg-word-picker');
    var drawArea = el('dg-draw-area');
    if (picker)   picker.classList.add('hidden');
    if (drawArea) drawArea.classList.remove('hidden');

    dgClearCanvas();

    var isBot     = DG.mode === 'bot';
    var drawName  = DG.turn === 0 ? 'Player 1' : (isBot ? '🤖 Bot' : 'Player 2');
    var guessName = DG.turn === 0 ? (isBot ? '🤖 Bot' : 'Player 2') : 'Player 1';

    setText('dg-current-drawer',  '✏️ Drawing: ' + drawName);
    setText('dg-current-guesser', '🔍 Guessing: ' + guessName);

    // Show secret word only to human drawer
    var humanDraws = (DG.mode === 'pvp') || (DG.turn === 0);
    setText('dg-word-display', humanDraws ? '📝 Word: ' + word : '🎨 Guess what\'s being drawn!');
    setText('dg-hint-display', hintStr());

    var drawCtrl  = el('dg-draw-controls');
    var guessCtrl = el('dg-guess-controls');
    if (DG.mode === 'pvp') {
      if (drawCtrl)  drawCtrl.style.display  = '';
      if (guessCtrl) guessCtrl.style.display = '';
    } else if (DG.turn === 0) {
      if (drawCtrl)  drawCtrl.style.display  = '';
      if (guessCtrl) guessCtrl.style.display = 'none';
    } else {
      if (drawCtrl)  drawCtrl.style.display  = 'none';
      if (guessCtrl) guessCtrl.style.display = '';
    }

    var inp = el('dg-guess-input');
    if (inp) inp.value = '';

    // Timer
    DG.timeLeft = TURN_TIME;
    setText('dg-timer', DG.timeLeft + 's');
    if (DG.timerInterval) clearInterval(DG.timerInterval);
    DG.timerInterval = setInterval(function () {
      if (DG.phase !== 'draw') { clearInterval(DG.timerInterval); return; }
      DG.timeLeft--;
      setText('dg-timer', DG.timeLeft + 's');
      if (DG.timeLeft > 0 && DG.timeLeft % 15 === 0) dgRevealHintLetter();
      if (DG.timeLeft <= 0) dgEndTurn(false);
    }, 1000);

    if (isBot) {
      if (DG.turn === 0) {
        dgBotScheduleGuess();  // P1 draws → bot guesses
      } else {
        dgBotStartDrawing();   // bot draws → P1 guesses (actual strokes on canvas)
      }
    }
  }

  // ── Hint ─────────────────────────────────────────────────────
  function dgRevealHintLetter() {
    var hidden = [];
    for (var i = 0; i < DG.hintArr.length; i++) {
      if (DG.hintArr[i] === '_') hidden.push(i);
    }
    if (!hidden.length) return;
    var idx = hidden[Math.floor(Math.random() * hidden.length)];
    DG.hintArr[idx] = DG.word[idx];
    setText('dg-hint-display', hintStr());
  }

  // ── Guess ─────────────────────────────────────────────────────
  function dgCheckGuess(val) {
    if (DG.phase !== 'draw' || DG.over) return;
    if (val.trim().toLowerCase() !== DG.word.toLowerCase()) return;
    var guesserIdx = DG.turn === 0 ? 1 : 0;
    var drawerIdx  = DG.turn;
    var pts = Math.max(10, Math.round(DG.timeLeft * 1.5));
    DG.scores[guesserIdx] += pts;
    DG.scores[drawerIdx]  += Math.floor(pts * 0.5);
    dgEndTurn(true);
  }

  // ── End turn ──────────────────────────────────────────────────
  function dgEndTurn(guessed) {
    if (DG.phase === 'reveal' || DG.phase === 'home') return;  // guard double-fire
    DG.phase = 'reveal'; DG.drawing = false;

    if (DG.timerInterval)   { clearInterval(DG.timerInterval);   DG.timerInterval   = null; }
    if (DG.botGuessTimer)   { clearTimeout(DG.botGuessTimer);    DG.botGuessTimer   = null; }
    if (DG.botDrawInterval) { clearInterval(DG.botDrawInterval); DG.botDrawInterval = null; }

    setText('dg-word-display', guessed
      ? '✅ Correct! The word was: ' + DG.word
      : '⏰ Time up! The word was: ' + DG.word);

    var names = ['Player 1', DG.mode === 'bot' ? 'Bot' : 'Player 2'];
    setText('dg-hint-display',
      names[0] + ': ' + DG.scores[0] + ' pts  |  ' + names[1] + ': ' + DG.scores[1] + ' pts');

    var inp = el('dg-guess-input');
    if (inp) inp.value = '';

    setTimeout(function () { if (!DG.over) dgNextTurn(); }, 2400);
  }

  function dgShowFinalResult() {
    DG.over = true;
    var names  = ['Player 1', DG.mode === 'bot' ? 'Bot' : 'Player 2'];
    var winner = DG.scores[0] > DG.scores[1] ? 0 : DG.scores[1] > DG.scores[0] ? 1 : -1;
    el('dg-result-title').textContent  = winner >= 0 ? '🏆 ' + names[winner] + ' Wins!' : '🤝 It\'s a Tie!';
    el('dg-result-detail').textContent =
      names[0] + ': ' + DG.scores[0] + ' pts  |  ' + names[1] + ': ' + DG.scores[1] + ' pts';
    el('dg-result').classList.remove('hidden');
    if (typeof SoundManager !== 'undefined' && SoundManager.win) SoundManager.win();
  }

  // ── Human drawing ─────────────────────────────────────────────
  function dgApplyStroke(canvas, e) {
    var pos = getPos(canvas, e);
    var ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(DG.lastX, DG.lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = DG.color;
    ctx.lineWidth   = DG.brushSize;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    DG.lastX = pos.x; DG.lastY = pos.y;
  }

  function dgClearCanvas() {
    var canvas = el('dg-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Bot drawing: animates real strokes on canvas ──────────────
  function dgBotStartDrawing() {
    if (DG.botDrawInterval) { clearInterval(DG.botDrawInterval); DG.botDrawInterval = null; }
    var canvas = el('dg-canvas');
    if (!canvas) return;
    setText('dg-word-display', '🎨 Bot is drawing… try to guess!');

    var strokes = dgGenerateBotStrokes(DG.word, canvas.width, canvas.height);
    var si = 0, pi = 0;
    var tickMs = { easy: 260, medium: 140, hard: 55 }[DG.botDiff] || 140;

    DG.botDrawInterval = setInterval(function () {
      if (DG.phase !== 'draw' || DG.over) {
        clearInterval(DG.botDrawInterval); DG.botDrawInterval = null; return;
      }
      if (si >= strokes.length) {
        clearInterval(DG.botDrawInterval); DG.botDrawInterval = null; return;
      }
      var stroke = strokes[si];
      var ctx    = canvas.getContext('2d');
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth   = stroke.width;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      if (pi < stroke.pts.length - 1) {
        ctx.beginPath();
        ctx.moveTo(stroke.pts[pi].x,   stroke.pts[pi].y);
        ctx.lineTo(stroke.pts[pi+1].x, stroke.pts[pi+1].y);
        ctx.stroke();
        pi++;
      } else { pi = 0; si++; }
    }, tickMs);
  }

  // ── Bot drawing: generates recognizable strokes for each word ──
  function dgGenerateBotStrokes(word, W, H) {
    var cx = W/2, cy = H/2;
    var strokes = [];
    var w = word.toLowerCase();

    // Helper: ellipse
    function ellipse(ex,ey,rx,ry,color,lw){
      var pts=[];
      for(var a=0;a<=360;a+=5){var r2=a*Math.PI/180;pts.push({x:ex+Math.cos(r2)*rx,y:ey+Math.sin(r2)*ry});}
      strokes.push({pts:pts,color:color||'#111',width:lw||3});
    }
    // Helper: rect
    function rect(x,y,rw,rh,color,lw){
      strokes.push({pts:[{x:x,y:y},{x:x+rw,y:y},{x:x+rw,y:y+rh},{x:x,y:y+rh},{x:x,y:y}],color:color||'#111',width:lw||3});
    }
    // Helper: line
    function line(x1,y1,x2,y2,color,lw){
      strokes.push({pts:[{x:x1,y:y1},{x:x2,y:y2}],color:color||'#111',width:lw||2});
    }
    // Helper: polygon
    function poly(pts2,color,lw){ strokes.push({pts:pts2,color:color||'#111',width:lw||2}); }
    // Helper: arc
    function arc(ex,ey,rx,ry,aStart,aEnd,color,lw){
      var pts=[];
      for(var a=aStart;a<=aEnd;a+=5){var r2=a*Math.PI/180;pts.push({x:ex+Math.cos(r2)*rx,y:ey+Math.sin(r2)*ry});}
      strokes.push({pts:pts,color:color||'#111',width:lw||2});
    }

    var wordMap = {
      // Animals
      'cat':    function(){ellipse(cx,cy-20,55,45);line(cx-55,cy-20,cx-80,cy-55);line(cx+55,cy-20,cx+80,cy-55);ellipse(cx,cy-20,18,14,'#555',2);line(cx-8,cy-10,cx-40,cy+10);line(cx,cy-10,cx-30,cy+5);line(cx+8,cy-10,cx+40,cy+10);line(cx,cy+55,cx-30,cy+110);},
      'dog':    function(){ellipse(cx,cy,60,50);ellipse(cx+45,cy-10,35,28);line(cx+45,cy+18,cx+45,cy+80);line(cx+65,cy+18,cx+65,cy+80);line(cx-20,cy+50,cx-20,cy+100);line(cx+10,cy+50,cx+10,cy+100);arc(cx-25,cy,22,35,60,180,'#111',3);arc(cx+70,cy-15,15,25,60,220,'#111',3);ellipse(cx+62,cy-35,12,8,'#555',2);},
      'fish':   function(){ellipse(cx-10,cy,70,40);poly([{x:cx+60,y:cy},{x:cx+100,y:cy-40},{x:cx+100,y:cy+40},{x:cx+60,y:cy}]);ellipse(cx-30,cy-8,8,8,'#333',2);line(cx-10,cy-30,cx-10,cy+30,'#888',1);line(cx+10,cy-35,cx+10,cy+35,'#888',1);line(cx+30,cy-30,cx+30,cy+30,'#888',1);},
      'bird':   function(){arc(cx,cy,50,35,180,360);arc(cx-30,cy-20,40,25,0,180);line(cx-70,cy,cx-100,cy+20);line(cx+50,cy,cx+90,cy+20);ellipse(cx+60,cy-45,12,10);line(cx+72,cy-45,cx+90,cy-45,'#f80',3);ellipse(cx+68,cy-52,4,4,'#333',2);},
      'pig':    function(){ellipse(cx,cy,65,55);ellipse(cx+60,cy-5,30,25);ellipse(cx+80,cy-5,18,12,'#f8a0a0',3);ellipse(cx+80,cy-8,6,5,'#333',2);ellipse(cx+80,cy+2,6,5,'#333',2);line(cx-20,cy+55,cx-20,cy+100);line(cx+20,cy+55,cx+20,cy+100);ellipse(cx-15,cy-15,8,8,'#333',2);ellipse(cx+15,cy-15,8,8,'#333',2);arc(cx,cy+20,20,15,0,180);},
      'bee':    function(){ellipse(cx,cy,40,30,'#ff0',4);line(cx-40,cy,cx-40,cy,'#000',1);for(var i=-2;i<=2;i++)rect(cx-5+i*16,cy-30,12,60,'#333',2);ellipse(cx-60,cy-15,30,15,'rgba(180,220,255,0.8)',2);ellipse(cx-60,cy+15,30,15,'rgba(180,220,255,0.8)',2);ellipse(cx+55,cy-15,25,12,'rgba(180,220,255,0.8)',2);ellipse(cx+55,cy+15,25,12,'rgba(180,220,255,0.8)',2);},
      'lion':   function(){ellipse(cx,cy,70,65);for(var a=0;a<360;a+=25){var ra=a*Math.PI/180;line(cx+Math.cos(ra)*70,cy+Math.sin(ra)*65,cx+Math.cos(ra)*100,cy+Math.sin(ra)*95,'#c80',4);}ellipse(cx,cy,45,42,'#fda',3);ellipse(cx-15,cy-10,9,9,'#333',2);ellipse(cx+15,cy-10,9,9,'#333',2);arc(cx,cy+15,20,10,0,180);},
      'elephant': function(){ellipse(cx-10,cy,85,70);ellipse(cx+85,cy-20,45,35);arc(cx+80,cy+15,15,60,90,270,'#555',4);ellipse(cx+120,cy-30,18,14,'#555',2);line(cx-30,cy+70,cx-30,cy+130);line(cx,cy+70,cx,cy+130);line(cx+30,cy+68,cx+30,cy+128);line(cx-70,cy+65,cx-70,cy+125);arc(cx-20,cy-45,18,22,0,180);arc(cx+20,cy-45,18,22,0,180);},
      'butterfly': function(){ellipse(cx-60,cy-20,55,45,'#e070ff',3);ellipse(cx+60,cy-20,55,45,'#e070ff',3);ellipse(cx-45,cy+30,35,28,'#cc44ff',3);ellipse(cx+45,cy+30,35,28,'#cc44ff',3);line(cx,cy-70,cx,cy+70,'#333',3);line(cx-5,cy-60,cx-25,cy-90);line(cx+5,cy-60,cx+25,cy-90);},
      'penguin': function(){ellipse(cx,cy+20,50,70,'#111',4);ellipse(cx,cy+10,28,40,'#fff',3);ellipse(cx,cy-60,35,35,'#111',4);ellipse(cx,cy-62,16,14,'#fff',3);rect(cx-25,cy-5,20,40,'#111',3);rect(cx+5,cy-5,20,40,'#111',3);ellipse(cx,cy-75,10,8,'#f80',3);line(cx-25,cy+90,cx-35,cy+115,'#f80',3);line(cx+25,cy+90,cx+35,cy+115,'#f80',3);},
      'cactus':  function(){rect(cx-15,cy-80,30,160,'#2a8',3);rect(cx-55,cy-10,40,25,'#2a8',3);rect(cx-55,cy-60,25,55,'#2a8',3);rect(cx+15,cy+10,40,25,'#2a8',3);rect(cx+15,cy-30,25,45,'#2a8',3);},
      // Objects / things
      'sun':    function(){ellipse(cx,cy,55,55,'#ff0',4);for(var a2=0;a2<360;a2+=45){var ra=a2*Math.PI/180;line(cx+Math.cos(ra)*60,cy+Math.sin(ra)*60,cx+Math.cos(ra)*90,cy+Math.sin(ra)*90,'#ff0',3);}},
      'moon':   function(){ellipse(cx,cy,60,60,'#ffd',4);ellipse(cx+30,cy,60,60,'#fff',6);},
      'star':   function(){var pts=[];for(var i=0;i<5;i++){var ra=(i*144-90)*Math.PI/180;pts.push({x:cx+Math.cos(ra)*80,y:cy+Math.sin(ra)*80});var rb=((i*144+72)-90)*Math.PI/180;pts.push({x:cx+Math.cos(rb)*32,y:cy+Math.sin(rb)*32});}pts.push(pts[0]);poly(pts,'#ff0',3);},
      'house':  function(){rect(cx-70,cy,140,110);poly([{x:cx-80,y:cy},{x:cx,y:cy-80},{x:cx+80,y:cy},{x:cx-80,y:cy}],'#c44',3);rect(cx-20,cy+40,40,70);line(cx,cy+40,cx,cy+110);},
      'tree':   function(){ellipse(cx,cy-30,70,80,'#2a6',4);ellipse(cx-30,cy+10,50,60,'#2a6',4);ellipse(cx+30,cy+10,50,60,'#2a6',4);rect(cx-12,cy+60,24,70,'#840',4);},
      'car':    function(){rect(cx-80,cy+10,160,60);rect(cx-50,cy-30,100,50);ellipse(cx-50,cy+70,25,25,'#444',4);ellipse(cx+50,cy+70,25,25,'#444',4);rect(cx-35,cy-25,30,30,'#aef',2);rect(cx+5,cy-25,30,30,'#aef',2);line(cx-80,cy+40,cx+80,cy+40,'#888',1);},
      'book':   function(){rect(cx-60,cy-70,120,140);line(cx,cy-70,cx,cy+70,'#888',2);rect(cx-50,cy-60,40,20,'#aaa',1);rect(cx-50,cy-30,40,15,'#aaa',1);},
      'ship':   function(){poly([{x:cx-90,y:cy+40},{x:cx+90,y:cy+40},{x:cx+70,y:cy+80},{x:cx-70,y:cy+80},{x:cx-90,y:cy+40}]);rect(cx-20,cy-60,40,100);rect(cx-50,cy-20,100,60);line(cx,cy-60,cx,cy-120,'#555',2);poly([{x:cx,y:cy-120},{x:cx+50,y:cy-80},{x:cx,y:cy-60},{x:cx,y:cy-120}],'#f00',3);},
      'ball':   function(){ellipse(cx,cy,65,65);arc(cx,cy,65,65,0,360,'#555',1);line(cx-65,cy,cx+65,cy,'#888',1);arc(cx,cy,65,25,0,180);arc(cx,cy,65,25,180,360);},
      'hat':    function(){ellipse(cx,cy+40,90,20);rect(cx-35,cy-60,70,100);line(cx-70,cy+20,cx-35,cy+20);line(cx+70,cy+20,cx+35,cy+20);},
      'key':    function(){ellipse(cx-40,cy,40,40);ellipse(cx-40,cy,22,22,'#fff',4);line(cx,cy,cx+90,cy,'#555',4);line(cx+65,cy,cx+65,cy+20,'#555',3);line(cx+80,cy,cx+80,cy+15,'#555',3);},
      'cup':    function(){rect(cx-40,cy-50,80,100);arc(cx+40,cy-20,20,25,270,90);line(cx-40,cy+50,cx-50,cy+70);line(cx+40,cy+50,cx+50,cy+70);line(cx-50,cy+70,cx+50,cy+70,'#555',3);},
      'pen':    function(){poly([{x:cx-100,y:cy-10},{x:cx+70,y:cy-10},{x:cx+70,y:cy+10},{x:cx-100,y:cy+10},{x:cx-100,y:cy-10}]);poly([{x:cx+70,y:cy-10},{x:cx+100,y:cy},{x:cx+70,y:cy+10},{x:cx+70,y:cy-10}],'#00c',3);ellipse(cx-80,cy,14,14,'#888',2);},
      'bus':    function(){rect(cx-90,cy-50,180,100);ellipse(cx-55,cy+50,22,22,'#333',4);ellipse(cx+55,cy+50,22,22,'#333',4);for(var i=-3;i<=3;i+=2)rect(cx+i*24-14,cy-45,24,35,'#aef',2);line(cx-90,cy-10,cx+90,cy-10,'#888',2);rect(cx-90,cy-50,30,40,'#ffd',2);},
      'fly':    function(){ellipse(cx,cy+10,25,30);ellipse(cx,cy-20,18,20);ellipse(cx-50,cy-10,45,20,'rgba(200,230,255,0.7)',3);ellipse(cx+50,cy-10,45,20,'rgba(200,230,255,0.7)',3);line(cx-10,cy-10,cx-30,cy-40);line(cx+10,cy-10,cx+30,cy-40);line(cx,cy-10,cx,cy-45);},
      'map':    function(){rect(cx-80,cy-60,160,120);line(cx-80,cy-60,cx-80,cy+60,'#888',3);line(cx+80,cy-60,cx+80,cy+60,'#888',3);poly([{x:cx-30,y:cy-40},{x:cx+20,y:cy-20},{x:cx,y:cy+20},{x:cx-50,y:cy},{x:cx-30,y:cy-40}],'#2a8',2);line(cx-80,cy-30,cx+80,cy-50,'#888',1);line(cx-80,cy+30,cx+80,cy+40,'#888',1);},
      'egg':    function(){ellipse(cx,cy+15,45,60);},
      'fire':   function(){poly([{x:cx,y:cy-90},{x:cx+40,y:cy-10},{x:cx+50,y:cy-50},{x:cx+65,y:cy+20},{x:cx+30,y:cy+70},{x:cx-30,y:cy+70},{x:cx-65,y:cy+20},{x:cx-50,y:cy-50},{x:cx-40,y:cy-10},{x:cx,y:cy-90}],'#f60',4);poly([{x:cx,y:cy-30},{x:cx+22,y:cy+30},{x:cx,y:cy+60},{x:cx-22,y:cy+30},{x:cx,y:cy-30}],'#ff0',3);},
      'leaf':   function(){poly([{x:cx,y:cy-80},{x:cx+70,y:cy},{x:cx,y:cy+80},{x:cx-70,y:cy},{x:cx,y:cy-80}],'#2a6',4);line(cx,cy-80,cx,cy+80,'#840',2);line(cx,cy-20,cx+30,cy-50,'#840',1);line(cx,cy-20,cx-30,cy-50,'#840',1);line(cx,cy+10,cx+35,cy-10,'#840',1);line(cx,cy+10,cx-35,cy-10,'#840',1);},
      'king':   function(){rect(cx-40,cy-20,80,100);poly([{x:cx-40,y:cy-20},{x:cx-40,y:cy-70},{x:cx-15,y:cy-40},{x:cx,y:cy-80},{x:cx+15,y:cy-40},{x:cx+40,y:cy-70},{x:cx+40,y:cy-20},{x:cx-40,y:cy-20}],'#ffd',3);ellipse(cx,cy-80,14,14,'#f00',3);},
      'rain':   function(){arc(cx,cy-20,70,50,180,360,'#88f',4);for(var i=-3;i<=3;i++){line(cx+i*25,cy+30,cx+i*25-10,cy+80,'#66f',2);}},
      'cake':   function(){ellipse(cx,cy+50,75,25,'#fda',4);rect(cx-75,cy-20,150,70,'#fda',3);ellipse(cx,cy-20,75,25,'#fff',3);line(cx,cy-20,cx,cy-80,'#f44',2);ellipse(cx,cy-80,8,8,'#ff0',3);},
      'rocket': function(){poly([{x:cx,y:cy-100},{x:cx+35,y:cy+20},{x:cx,y:cy},{x:cx-35,y:cy+20},{x:cx,y:cy-100}],'#888',3);ellipse(cx,cy-80,18,25,'#aef',2);poly([{x:cx-35,y:cy+20},{x:cx-60,y:cy+60},{x:cx,y:cy+30},{x:cx-35,y:cy+20}],'#f44',3);poly([{x:cx+35,y:cy+20},{x:cx+60,y:cy+60},{x:cx,y:cy+30},{x:cx+35,y:cy+20}],'#f44',3);poly([{x:cx-15,y:cy+30},{x:cx+15,y:cy+30},{x:cx+20,y:cy+80},{x:cx-20,y:cy+80}],'#f60',4);},
      'guitar': function(){ellipse(cx,cy+40,55,65);ellipse(cx,cy-30,40,50);line(cx,cy-80,cx,cy-130,'#840',3);rect(cx-20,cy-140,40,20,'#840',3);for(var i=-2;i<=2;i++)line(cx+i*7,cy-80,cx+i*7,cy+80,'#888',1);ellipse(cx,cy+40,15,15,'#210',3);},
      'castle': function(){rect(cx-80,cy-40,160,110);for(var i=-1;i<=1;i++){rect(cx+i*55-15,cy-80,30,45);}rect(cx-15,cy+20,30,50);for(var j=0;j<6;j++)rect(cx-70+j*25,cy-40,15,20,'#888',1);},
      'bridge': function(){poly([{x:cx-100,y:cy+40},{x:cx-100,y:cy},{x:cx,y:cy-60},{x:cx+100,y:cy},{x:cx+100,y:cy+40}]);line(cx-100,cy+40,cx+100,cy+40,'#555',3);for(var k=-4;k<=4;k++)line(cx+k*22,cy+40,cx+k*22+Math.sign(k)*15,cy-30,'#555',2);},
      'dragon': function(){ellipse(cx+30,cy,80,55);ellipse(cx+100,cy-20,45,38);ellipse(cx+120,cy-50,22,18);line(cx+138,cy-42,cx+170,cy-30);poly([{x:cx-50,y:cy-40},{x:cx-90,y:cy-100},{x:cx-20,y:cy-60},{x:cx-50,y:cy-40}],'#060',3);poly([{x:cx+10,y:cy-40},{x:cx+50,y:cy-110},{x:cx+60,y:cy-50},{x:cx+10,y:cy-40}],'#060',3);poly([{x:cx-50,y:cy+30},{x:cx-70,y:cy+90},{x:cx-10,y:cy+80},{x:cx+40,y:cy+120},{x:cx+60,y:cy+60}]);},
      'umbrella': function(){arc(cx,cy+10,85,70,180,360,'#66f',4);line(cx,cy+10,cx,cy+90,'#333',3);arc(cx,cy+90,20,20,0,180,'#333',2);line(cx-85,cy+10,cx-85,cy+25,'#333',2);line(cx-42,cy-48,cx-42,cy-30,'#333',2);line(cx+42,cy-48,cx+42,cy-30,'#333',2);},
      'volcano': function(){poly([{x:cx-100,y:cy+80},{x:cx-30,y:cy-60},{x:cx+30,y:cy-60},{x:cx+100,y:cy+80},{x:cx-100,y:cy+80}],'#844',4);ellipse(cx,cy-60,35,20,'#222',3);poly([{x:cx-15,y:cy-60},{x:cx-30,y:cy-120},{x:cx,y:cy-100},{x:cx+30,y:cy-110},{x:cx+15,y:cy-60}],'#f60',4);},
      'mermaid': function(){ellipse(cx,cy-20,45,70);ellipse(cx-20,cy-70,20,25);ellipse(cx+20,cy-70,20,25);ellipse(cx,cy-80,28,28,'#fda',3);poly([{x:cx-40,y:cy+50},{x:cx-70,y:cy+110},{x:cx-20,y:cy+90},{x:cx,y:cy+120},{x:cx+20,y:cy+90},{x:cx+70,y:cy+110},{x:cx+40,y:cy+50},{x:cx-40,y:cy+50}],'#2a8',3);},
      'telescope': function(){poly([{x:cx-90,y:cy+10},{x:cx+30,y:cy-20},{x:cx+30,y:cy+20},{x:cx-90,y:cy+30},{x:cx-90,y:cy+10}]);ellipse(cx+30,cy,20,25);ellipse(cx-90,cy+20,12,16);line(cx-30,cy+30,cx-50,cy+90,'#555',3);line(cx+10,cy+20,cx+10,cy+90,'#555',3);},
      'tornado': function(){for(var i=0;i<8;i++){var yy=cy-80+i*25,ww=10+i*14;arc(cx,yy,ww,8,180,360,'#888',2+i/3);}line(cx-10,cy+90,cx+10,cy+90,'#888',3);},
      'pyramid': function(){poly([{x:cx,y:cy-90},{x:cx+110,y:cy+80},{x:cx-110,y:cy+80},{x:cx,y:cy-90}],'#da0',4);line(cx,cy-90,cx,cy+80,'#a80',1);line(cx,cy,cx+55,cy+80,'#a80',1);},
      'lantern': function(){rect(cx-30,cy-50,60,100,'#ffd',3);ellipse(cx,cy-50,30,15,'#888',3);ellipse(cx,cy+50,30,15,'#888',3);line(cx,cy-65,cx,cy-100,'#888',3);ellipse(cx,cy,20,70,'#ff8',2);},
      'compass': function(){ellipse(cx,cy,75,75);line(cx,cy-75,cx,cy-60,'#333',2);line(cx,cy+75,cx,cy+60,'#333',2);line(cx-75,cy,cx-60,cy,'#333',2);line(cx+75,cy,cx+60,cy,'#333',2);poly([{x:cx,y:cy-55},{x:cx+12,y:cy+10},{x:cx,y:cy},{x:cx-12,y:cy+10},{x:cx,y:cy-55}],'#f00',3);poly([{x:cx,y:cy+55},{x:cx+10,y:cy},{x:cx,y:cy+5},{x:cx-10,y:cy},{x:cx,y:cy+55}],'#555',3);},
    };

    var rng = seededRand(word);

    if (wordMap[w]) {
      wordMap[w]();
    } else {
      // Fallback: draw first letter large + random shapes
      var numShapes = 3 + (word.length % 4);
      for (var s = 0; s < numShapes; s++) {
        var pts = [];
        var type = Math.floor(rng() * 4);
        if (type === 0) {
          var ex = cx+(rng()-0.5)*W*0.4, ey = cy+(rng()-0.5)*H*0.4;
          var rx = 28+rng()*80, ry = 22+rng()*60;
          for (var a = 0; a <= 360; a += 6) { var rad=a*Math.PI/180; pts.push({x:ex+Math.cos(rad)*rx,y:ey+Math.sin(rad)*ry}); }
        } else if (type === 1) {
          var bx=cx+(rng()-0.5)*W*0.35, by=cy+(rng()-0.5)*H*0.35, bw=40+rng()*100, bh=30+rng()*70;
          pts=[{x:bx,y:by},{x:bx+bw,y:by},{x:bx+bw,y:by+bh},{x:bx,y:by+bh},{x:bx,y:by}];
        } else if (type === 2) {
          var p0x=cx+(rng()-0.5)*W*0.6, p0y=cy+(rng()-0.5)*H*0.6;
          var p1x=cx+(rng()-0.5)*W*0.6, p1y=cy+(rng()-0.5)*H*0.6;
          var p2x=cx+(rng()-0.5)*W*0.6, p2y=cy+(rng()-0.5)*H*0.6;
          for (var t=0;t<=1;t+=0.04){var u=1-t;pts.push({x:u*u*p0x+2*u*t*p1x+t*t*p2x,y:u*u*p0y+2*u*t*p1y+t*t*p2y});}
        } else {
          var lx=cx+(rng()-0.5)*W*0.6, ly=cy+(rng()-0.5)*H*0.6, len=20+rng()*80, ang=rng()*Math.PI*2;
          pts=[{x:lx,y:ly},{x:lx+Math.cos(ang)*len,y:ly+Math.sin(ang)*len}];
        }
        if (pts.length>1) strokes.push({pts:pts,color:'#111',width:2+Math.floor(rng()*3)});
      }
    }

    return strokes;
  }

  // Deterministic PRNG seeded by string
  function seededRand(seed) {
    var h = 0;
    for (var i = 0; i < seed.length; i++) { h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0; }
    return function () {
      h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
      h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
  }

  // ── Bot guessing (when P1 draws) ──────────────────────────────
  // FIX: was scheduling (timeLeft-5)*1000ms which = 55000ms (near-timeout always)
  // Now: fixed seconds from start of turn based on difficulty
  function dgBotScheduleGuess() {
    if (DG.botGuessTimer) { clearTimeout(DG.botGuessTimer); DG.botGuessTimer = null; }
    // Seconds after turn starts before bot guesses (easy=late, hard=early)
    var guessAfterSec = { easy: 45, medium: 25, hard: 3 }[DG.botDiff] || 25;
    guessAfterSec = Math.min(TURN_TIME - 3, guessAfterSec);

    DG.botGuessTimer = setTimeout(function () {
      if (DG.phase !== 'draw' || DG.over) return;
      // FIX: points from current timeLeft at the moment of guess, not from itself
      var pts = Math.max(10, Math.round(DG.timeLeft * 1.5));
      DG.scores[1] += pts;
      DG.scores[0] += Math.floor(pts * 0.5);
      setText('dg-hint-display', '🤖 Bot guessed it: ' + DG.word + '!');
      setTimeout(function () { dgEndTurn(true); }, 700);
    }, guessAfterSec * 1000);
  }

})();
