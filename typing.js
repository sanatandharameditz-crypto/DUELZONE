// ═══════════════════════════════════════════════════════════════
// DuelZone · Typing Speed Race  (typing.js)
// Both players type the same words. First to finish wins.
// PvP: P1 types in left box, P2 types in right box.
// PvBot: Bot "types" at configurable WPM.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var WORD_BANK = [
    'the','be','to','of','and','a','in','that','have','it',
    'for','not','on','with','he','as','you','do','at','this',
    'but','his','by','from','they','we','say','her','she','or',
    'an','will','my','one','all','would','there','their','what',
    'so','up','out','if','about','who','get','which','go','me',
    'when','make','can','like','time','no','just','him','know',
    'take','people','into','year','your','good','some','could',
    'them','see','other','than','then','now','look','only','come',
    'its','over','think','also','back','after','use','two','how',
    'our','work','first','well','way','even','new','want','because',
    'any','these','give','day','most','us','great','between','need',
    'large','often','hand','high','place','hold','free','real','life',
    'few','north','open','seem','together','next','white','children',
    'begin','got','walk','example','ease','paper','group','always',
    'music','those','both','mark','book','letter','until','mile',
    'river','car','feet','care','second','enough','plain','girl',
    'usual','young','ready','above','ever','red','list','though',
    'feel','talk','bird','soon','body','dog','family','direct',
    'pose','leave','song','measure','door','product','black','short',
  ];

  var BOT_WPM = { easy: 28, medium: 55, hard: 160 };

  var T = {
    mode: 'pvp', diff: 'medium', wordCount: 20,
    words: [], started: false, over: false,
    p: [
      { typed: '', wordIdx: 0, charIdx: 0, errors: 0, done: false, startTime: 0, wpm: 0 },
      { typed: '', wordIdx: 0, charIdx: 0, errors: 0, done: false, startTime: 0, wpm: 0 },
    ],
    botTimer: null, startTime: 0, timerInterval: null, elapsed: 0,
  };

  var _wired = false;

  window.typingInit = function () {
    if (!_wired) { typingWireUI(); _wired = true; }
    typingShowHome();
  };
  window.typingDestroy = function () { typingClearTimers(); };

  function el(id){ return document.getElementById(id); }
  function on(id,fn){ var e=el(id); if(e) e.addEventListener('click',fn); }

  function typingShowHome(){
    el('typing-home').classList.remove('hidden');
    el('typing-play').classList.add('hidden');
  }

  function typingWireUI(){
    on('typing-back-hub',   function(){ typingClearTimers(); showHub(); });
    on('typing-back-play',  function(){ typingClearTimers(); typingShowHome(); });
    on('typing-again',      function(){ typingStartGame(); });
    on('typing-result-hub', function(){ typingClearTimers(); showHub(); });

    // Mode selector
    on('typing-mode-pvp', function(){
      T.mode='pvp';
      document.getElementById('typing-mode-pvp').classList.add('active');
      document.getElementById('typing-mode-bot').classList.remove('active');
      var bs=document.getElementById('typing-bot-settings');
      if(bs) bs.classList.add('hidden');
    });
    on('typing-mode-bot', function(){
      T.mode='bot';
      document.getElementById('typing-mode-bot').classList.add('active');
      document.getElementById('typing-mode-pvp').classList.remove('active');
      var bs=document.getElementById('typing-bot-settings');
      if(bs) bs.classList.remove('hidden');
    });
    on('typing-start-btn', function(){ typingStartGame(); });

    document.querySelectorAll('.typ-diff').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.typ-diff').forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active'); T.diff=b.dataset.diff;
      });
    });
    document.querySelectorAll('.typ-wc').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.typ-wc').forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active'); T.wordCount=parseInt(b.dataset.wc);
      });
    });

    // P1 input
    var inp1=el('typing-input-p1');
    if(inp1) inp1.addEventListener('input', function(){ typingHandleInput(0, inp1); });
    var inp2=el('typing-input-p2');
    if(inp2) inp2.addEventListener('input', function(){ typingHandleInput(1, inp2); });
  }

  function typingClearTimers(){
    if(T.botTimer){ clearInterval(T.botTimer); T.botTimer=null; }
    if(T.timerInterval){ clearInterval(T.timerInterval); T.timerInterval=null; }
  }

  // ── Start Game ────────────────────────────────────────────
  function typingStartGame(){
    typingClearTimers();
    el('typing-home').classList.add('hidden');
    el('typing-play').classList.remove('hidden');
    el('typing-result').classList.add('hidden');

    // Build word list
    var bank=WORD_BANK.slice();
    shuffle(bank);
    T.words = bank.slice(0, T.wordCount);
    T.started=false; T.over=false; T.elapsed=0;

    T.p=[
      {typed:'',wordIdx:0,charIdx:0,errors:0,done:false,startTime:0,wpm:0},
      {typed:'',wordIdx:0,charIdx:0,errors:0,done:false,startTime:0,wpm:0},
    ];

    // Render word display areas
    typingRenderWords(0);
    typingRenderWords(1);

    // Set player names
    setText('typing-p1-name','Player 1');
    setText('typing-p2-name', T.mode==='bot'?'🤖 Bot':'Player 2');

    // Show/hide inputs
    var inp2=el('typing-input-p2');
    if(inp2) inp2.style.display = T.mode==='bot' ? 'none' : '';
    var wrap2=el('typing-p2-input-wrap');
    if(wrap2) wrap2.style.display = T.mode==='bot' ? 'none' : '';

    // Clear/focus inputs
    var inp1=el('typing-input-p1');
    if(inp1){ inp1.value=''; inp1.disabled=false; setTimeout(function(){inp1.focus();},50); }
    if(inp2){ inp2.value=''; inp2.disabled=false; }

    setText('typing-timer','0.0s');
    typingUpdateProgress();

    // Bot starts automatically
    if(T.mode==='bot') typingBotStart();
  }

  function typingHandleInput(pid, inp){
    var p=T.p[pid];
    if(p.done||T.over) return;

    // First keystroke starts timer
    if(!T.started){
      T.started=true; T.startTime=Date.now();
      T.timerInterval=setInterval(function(){
        T.elapsed=(Date.now()-T.startTime)/1000;
        setText('typing-timer',T.elapsed.toFixed(1)+'s');
      },100);
    }

    var val=inp.value;

    // Update live WPM
    if(T.started && p.wordIdx > 0){
      var elapsed2=(Date.now()-T.startTime)/1000;
      if(elapsed2>0){
        var liveWpm=Math.round((p.wordIdx/elapsed2)*60);
        var badge=el('typing-wpm-p'+(pid+1));
        if(badge){ badge.textContent=liveWpm+' WPM'; badge.classList.add('active'); }
      }
    }

    // Space or enter = submit current word
    if(val.endsWith(' ')||val.endsWith('\n')){
      var attempt=val.trim();
      var correct=T.words[p.wordIdx];
      if(attempt!==correct) p.errors++;
      p.wordIdx++;
      inp.value='';
      if(p.wordIdx>=T.words.length){ typingPlayerDone(pid); return; }
      typingRenderWords(pid);
      typingUpdateProgress();
      return;
    }

    typingRenderWords(pid, val);
  }

  function typingRenderWords(pid, currentInput){
    var container=el('typing-words-p'+(pid+1));
    if(!container) return;
    var p=T.p[pid];
    var ci=currentInput||'';

    container.innerHTML=T.words.map(function(w,i){
      if(i<p.wordIdx){
        return'<span class="tw-done">'+w+'</span>';
      } else if(i===p.wordIdx){
        // Current word: show char-by-char coloring
        var chars=w.split('').map(function(ch,ci2){
          if(ci2<ci.length){
            return'<span class="'+(ci[ci2]===ch?'tw-correct':'tw-wrong')+'">'+ch+'</span>';
          }
          return'<span class="tw-pending">'+ch+'</span>';
        }).join('');
        return'<span class="tw-current">'+chars+'</span>';
      } else {
        return'<span class="tw-future">'+w+'</span>';
      }
    }).join(' ');
  }

  function typingPlayerDone(pid){
    var p=T.p[pid];
    p.done=true;
    var elapsed=(Date.now()-T.startTime)/1000;
    p.wpm=Math.round((T.words.length/elapsed)*60);

    // Disable that input
    var inp=el('typing-input-p'+(pid+1));
    if(inp) inp.disabled=true;

    // Check if both done or if this is first finisher
    var donePlayers=T.p.filter(function(x){return x.done;});
    if(donePlayers.length===1||(T.mode==='bot'&&pid===0)||T.over) {
      // First player to finish wins immediately
      if(!T.over) typingEnd(pid);
    } else if(donePlayers.length>=2){
      typingEnd(-1); // both done, compare wpm
    }
    typingUpdateProgress();
  }

  function typingEnd(winner){
    if(T.over) return;
    T.over=true; typingClearTimers();

    // If bot wins check
    if(T.mode==='bot'&&T.botTimer){ clearInterval(T.botTimer); T.botTimer=null; }

    var names=['Player 1', T.mode==='bot'?'Bot':'Player 2'];
    var title=el('typing-result-title'), detail=el('typing-result-detail');

    if(winner===-1){
      // Compare WPM
      winner=T.p[0].wpm>=T.p[1].wpm?0:1;
    }

    title.textContent='🏆 '+names[winner]+' Wins!';
    var wpm0=T.p[0].wpm, wpm1=T.p[1].wpm;
    var errs='Errors: P1 '+T.p[0].errors+(T.mode==='pvp'?' · P2 '+T.p[1].errors:'');
    detail.innerHTML=(wpm0?'P1: '+wpm0+' WPM':'')+(wpm1&&T.mode==='pvp'?'  |  P2: '+wpm1+' WPM':'')+(T.mode==='bot'&&T.p[1].wpm?'  |  Bot: '+T.p[1].wpm+' WPM':'')+'<br><small>'+errs+'</small>';

    el('typing-result').classList.remove('hidden');
    if(typeof SoundManager!=='undefined'&&SoundManager.win) SoundManager.win();
  }

  function typingUpdateProgress(){
    var b1=el('typing-prog-p1'), b2=el('typing-prog-p2');
    var pct0=Math.round(T.p[0].wordIdx/T.words.length*100);
    var pct1=Math.round(T.p[1].wordIdx/T.words.length*100);
    if(b1) b1.style.width=pct0+'%';
    if(b2) b2.style.width=pct1+'%';
    setText('typing-pct-p1',pct0+'%');
    setText('typing-pct-p2',pct1+'%');
  }

  // ── Bot ───────────────────────────────────────────────────
  function typingBotStart(){
    // Bot types each word after a calculated delay
    var wpm=BOT_WPM[T.diff]||55;
    var msPerWord=60000/wpm;
    // Add some variance
    var variance={easy:0.45,medium:0.2,hard:0.01}[T.diff]||0.2;

    // Wait for player to start
    var checkStart=setInterval(function(){
      if(T.started){
        clearInterval(checkStart);
        runBotWords(0,msPerWord,variance);
      }
    },80);
    T.botTimer=checkStart;
  }

  function runBotWords(idx,msPerWord,variance){
    if(idx>=T.words.length||T.over) return;
    var delay=msPerWord*(1+(Math.random()-0.5)*variance*2);
    var timer=setTimeout(function(){
      if(T.over) return;
      var p=T.p[1]; p.wordIdx=idx+1;
      typingRenderWords(1,'');
      typingUpdateProgress();
      if(p.wordIdx>=T.words.length){typingPlayerDone(1);}
      else runBotWords(idx+1,msPerWord,variance);
    },delay);
    // Store timer ref for cleanup
    T.botTimer=timer;
  }

  function shuffle(arr){
    for(var i=arr.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=arr[i];arr[i]=arr[j];arr[j]=t;}
    return arr;
  }
  function setText(id,v){var e=el(id);if(e) e.textContent=v;}

})();
