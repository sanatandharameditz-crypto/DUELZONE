// ═══════════════════════════════════════════════════════════════
// DuelZone · Blackjack Duel  (blackjack.js)
// Both players play blackjack simultaneously against the dealer.
// Score points for beating the dealer. First to target score wins.
// PvP: Both humans | PvBot: P2 uses basic strategy
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var SUITS=['♠','♥','♦','♣'];
  var RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  var SUIT_COLOR={'♠':'#1a1a2e','♥':'#c0392b','♦':'#c0392b','♣':'#1a1a2e'};

  var TARGET_WINS=5;

  var BJ={
    mode:'pvp', diff:'medium', over:false,
    deck:[], dealer:[],
    players:[
      {hand:[],stood:false,bust:false,bj:false,wins:0,done:false,name:'Player 1'},
      {hand:[],stood:false,bust:false,bj:false,wins:0,done:false,name:'Player 2'},
    ],
    phase:'betting', // betting | playing | dealer | result
    botTimer:null,
    roundOver:false,
  };

  var _wired=false;

  window.blackjackInit=function(){
    if(!_wired){bjWireUI();_wired=true;}
    bjShowHome();
  };
  window.blackjackDestroy=function(){bjClearTimers();};

  function el(id){return document.getElementById(id);}
  function on(id,fn){var e=el(id);if(e)e.addEventListener('click',fn);}
  function setText(id,v){var e=el(id);if(e)e.textContent=v;}

  function bjShowHome(){
    el('bj-home').classList.remove('hidden');
    el('bj-play').classList.add('hidden');
  }

  function bjWireUI(){
    on('bj-back-hub',   function(){bjClearTimers();showHub();});
    on('bj-back-play',  function(){bjClearTimers();bjShowHome();});
    on('bj-again',      function(){bjStartGame();});
    on('bj-result-hub', function(){bjClearTimers();showHub();});

    // Mode selector
    on('bj-mode-pvp', function(){
      BJ.mode='pvp';
      document.getElementById('bj-mode-pvp').classList.add('active');
      document.getElementById('bj-mode-bot').classList.remove('active');
      var bs=document.getElementById('bj-bot-settings');
      if(bs) bs.classList.add('hidden');
    });
    on('bj-mode-bot', function(){
      BJ.mode='bot';
      document.getElementById('bj-mode-bot').classList.add('active');
      document.getElementById('bj-mode-pvp').classList.remove('active');
      var bs=document.getElementById('bj-bot-settings');
      if(bs) bs.classList.remove('hidden');
    });
    on('bj-start-btn', function(){bjStartGame();});

    document.querySelectorAll('.bj-diff').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.bj-diff').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active'); BJ.diff=b.dataset.diff;
      });
    });

    on('bj-hit-p1',   function(){if(canAct(0)) bjHit(0);});
    on('bj-stand-p1', function(){if(canAct(0)) bjStand(0);});
    on('bj-hit-p2',   function(){if(canAct(1)) bjHit(1);});
    on('bj-stand-p2', function(){if(canAct(1)) bjStand(1);});
  }

  function bjClearTimers(){
    if(BJ.botTimer){clearTimeout(BJ.botTimer);BJ.botTimer=null;}
  }

  function canAct(pid){
    return BJ.phase==='playing'&&!BJ.players[pid].stood&&!BJ.players[pid].bust&&!BJ.players[pid].done&&!BJ.roundOver;
  }

  // ── Start game / round ────────────────────────────────────
  function bjStartGame(){
    bjClearTimers();
    el('bj-home').classList.add('hidden');
    el('bj-play').classList.remove('hidden');
    el('bj-result').classList.add('hidden');

    BJ.over=false;
    BJ.players[0].wins=0; BJ.players[1].wins=0;
    BJ.players[0].name='Player 1';
    BJ.players[1].name=BJ.mode==='bot'?'🤖 Bot':'Player 2';

    setText('bj-target','First to '+TARGET_WINS+' wins!');
    setText('bj-p2-name',BJ.players[1].name);

    // Show/hide P2 controls
    var p2ctrl=el('bj-p2-controls');
    if(p2ctrl) p2ctrl.style.display=BJ.mode==='bot'?'none':'';

    bjNewRound();
  }

  function bjNewRound(){
    bjClearTimers();
    BJ.roundOver=false;
    BJ.deck=buildDeck();
    BJ.dealer=[];
    BJ.players.forEach(function(p){p.hand=[];p.stood=false;p.bust=false;p.bj=false;p.done=false;});

    // Deal: P1, P2, Dealer x2
    BJ.players[0].hand.push(deal(),deal());
    BJ.players[1].hand.push(deal(),deal());
    BJ.dealer.push(deal(),deal());

    // Check naturals
    BJ.players.forEach(function(p){if(handValue(p.hand)===21) p.bj=true;});

    BJ.phase='playing';
    bjRender();

    // If both have BJ, skip to dealer
    if(BJ.players[0].bj&&BJ.players[1].bj){
      BJ.players[0].stood=true; BJ.players[1].stood=true;
      setTimeout(bjDealerPlay,700);
      return;
    }

    // Auto-stand players with BJ
    if(BJ.players[0].bj){BJ.players[0].stood=true;}
    if(BJ.players[1].bj){BJ.players[1].stood=true;}

    if(BJ.mode==='bot') bjBotThink();
    bjRender();
  }

  // ── Deck ──────────────────────────────────────────────────
  function buildDeck(){
    var d=[];
    SUITS.forEach(function(s){RANKS.forEach(function(r){d.push({suit:s,rank:r});});});
    // 2 decks for variety
    d=d.concat(d);
    shuffle(d);
    return d;
  }

  function deal(){return BJ.deck.pop();}

  function cardValue(c){
    if(['J','Q','K'].indexOf(c.rank)>=0) return 10;
    if(c.rank==='A') return 11;
    return parseInt(c.rank);
  }

  function handValue(hand){
    var val=0, aces=0;
    hand.forEach(function(c){val+=cardValue(c);if(c.rank==='A')aces++;});
    while(val>21&&aces>0){val-=10;aces--;}
    return val;
  }

  // ── Actions ───────────────────────────────────────────────
  function bjHit(pid){
    var p=BJ.players[pid];
    p.hand.push(deal());
    var v=handValue(p.hand);
    if(v>=21){
      if(v>21) p.bust=true;
      p.stood=true; p.done=true;
      bjCheckAllDone();
    }
    bjRender();
    if(BJ.mode==='bot'&&pid===0) bjBotThink();
  }

  function bjStand(pid){
    var p=BJ.players[pid];
    p.stood=true; p.done=true;
    bjRender();
    bjCheckAllDone();
    if(BJ.mode==='bot'&&pid===0) bjBotThink();
  }

  function bjCheckAllDone(){
    var allDone=BJ.players.every(function(p){return p.done||p.stood||p.bust;});
    if(allDone) setTimeout(bjDealerPlay,500);
  }

  // ── Dealer plays ──────────────────────────────────────────
  function bjDealerPlay(){
    BJ.phase='dealer';
    bjRender();
    // Dealer hits to 17
    function dealerStep(){
      var dv=handValue(BJ.dealer);
      if(dv<17){
        BJ.dealer.push(deal());
        bjRender();
        BJ.botTimer=setTimeout(dealerStep,650);
      } else {
        bjResolve();
      }
    }
    BJ.botTimer=setTimeout(dealerStep,600);
  }

  function bjResolve(){
    BJ.roundOver=true;
    BJ.phase='result';
    var dv=handValue(BJ.dealer);
    var dBust=dv>21;

    BJ.players.forEach(function(p){
      var pv=handValue(p.hand);
      var win=false;
      if(p.bust){ win=false; }
      else if(p.bj&&!bjDealerBJ()){ win=true; }
      else if(dBust){ win=true; }
      else if(pv>dv){ win=true; }
      if(win) p.wins++;
    });

    bjRender();
    bjCheckGameOver();
  }

  function bjDealerBJ(){return handValue(BJ.dealer)===21&&BJ.dealer.length===2;}

  function bjCheckGameOver(){
    var winner=-1;
    BJ.players.forEach(function(p,i){if(p.wins>=TARGET_WINS) winner=i;});
    if(winner>=0){
      BJ.over=true;
      setTimeout(function(){
        el('bj-result-title').textContent='🏆 '+BJ.players[winner].name+' Wins the Match!';
        el('bj-result-detail').textContent=BJ.players[0].wins+' – '+BJ.players[1].wins+' rounds won';
        el('bj-result').classList.remove('hidden');
        if(typeof SoundManager!=='undefined'&&SoundManager.win) SoundManager.win();
      },800);
    } else {
      // Next round after delay
      BJ.botTimer=setTimeout(bjNewRound,2000);
    }
  }

  // ── Bot strategy ────────────────────────────────────────────
  // Hard = perfect basic strategy (nearly unbeatable)
  function bjBotThink(){
    if(BJ.mode!=='bot'||BJ.players[1].done||BJ.players[1].stood||BJ.players[1].bust) return;
    if(BJ.phase!=='playing') return;
    if(BJ.botTimer){clearTimeout(BJ.botTimer);BJ.botTimer=null;}
    var delay={easy:1400,medium:900,hard:180}[BJ.diff]||900;
    delay+=Math.random()*(BJ.diff==='hard'?80:350);
    BJ.botTimer=setTimeout(function(){
      if(BJ.over||BJ.roundOver) return;
      var p=BJ.players[1];
      if(p.done||p.stood||p.bust) return;
      var pv=handValue(p.hand);
      var dUp=cardValue(BJ.dealer[0]);
      var rawVal=p.hand.reduce(function(s,c){return s+cardValue(c);},0);
      var isSoft=(rawVal!==pv); // ace counted as 11
      var shouldHit=false;

      if(BJ.diff==='hard'){
        // Perfect basic strategy
        if(isSoft){
          if(pv<=17) shouldHit=true;
          else if(pv===18){shouldHit=(dUp>=9);}
          else shouldHit=false;
        } else {
          if(pv<=8) shouldHit=true;
          else if(pv===9){shouldHit=(dUp>=3&&dUp<=6);}
          else if(pv===10){shouldHit=(dUp>=10);}
          else if(pv<=12){shouldHit=(dUp<4||dUp>=7);}
          else if(pv<=16){shouldHit=(dUp>=7);}
          else shouldHit=false;
        }
      } else if(BJ.diff==='medium'){
        shouldHit=(pv<17)||(dUp>=7&&pv<17);
      } else {
        shouldHit=(pv<14);
      }

      if(shouldHit){ bjHit(1); }
      else { bjStand(1); }
    },delay);
  }

  // ── Render ────────────────────────────────────────────────
  function bjRender(){
    // Scores
    setText('bj-wins-p1','★ '+BJ.players[0].wins);
    setText('bj-wins-p2','★ '+BJ.players[1].wins);

    // Hands
    renderHand('bj-hand-p1',BJ.players[0].hand,false);
    renderHand('bj-hand-p2',BJ.players[1].hand,false);
    renderHand('bj-hand-dealer',BJ.dealer,BJ.phase==='playing');

    // Values
    var pv0=handValue(BJ.players[0].hand);
    var pv1=handValue(BJ.players[1].hand);
    var dv=handValue(BJ.dealer);
    setText('bj-val-p1',pv0+(BJ.players[0].bust?' BUST!':BJ.players[0].bj?' BJ!':''));
    setText('bj-val-p2',pv1+(BJ.players[1].bust?' BUST!':BJ.players[1].bj?' BJ!':''));
    setText('bj-val-dealer',BJ.phase==='playing'?'?':(dv+(dv>21?' BUST!':dv===21&&BJ.dealer.length===2?' BJ!':'')));

    // Status messages
    if(BJ.phase==='result'){
      var dBust=handValue(BJ.dealer)>21;
      [0,1].forEach(function(i){
        var p=BJ.players[i];
        var pv=handValue(p.hand);
        var dv2=handValue(BJ.dealer);
        var msg='';
        if(p.bust) msg='💀 Bust';
        else if(p.bj&&!bjDealerBJ()) msg='🌟 Blackjack!';
        else if(dBust) msg='✅ Win (Dealer Bust)';
        else if(pv>dv2) msg='✅ Win!';
        else if(pv===dv2) msg='🤝 Push';
        else msg='❌ Lose';
        setText('bj-status-p'+(i+1),msg);
      });
    } else {
      setText('bj-status-p1',BJ.players[0].bj?'🌟 Blackjack!':BJ.players[0].stood?'Standing…':'');
      setText('bj-status-p2',BJ.players[1].bj?'🌟 Blackjack!':BJ.players[1].stood?'Standing…':'');
    }

    // Buttons
    var act0=canAct(0), act1=canAct(1);
    btnDisabled('bj-hit-p1',!act0); btnDisabled('bj-stand-p1',!act0);
    btnDisabled('bj-hit-p2',!act1); btnDisabled('bj-stand-p2',!act1);

    // Phase indicator
    setText('bj-phase',{playing:'🎴 Players Acting',dealer:"🤵 Dealer's Turn",result:'📊 Round Over',betting:''}[BJ.phase]||'');
  }

  function btnDisabled(id,dis){ var e=el(id); if(e) e.disabled=dis; }

  function renderHand(containerId,hand,hideSecond){
    var c=el(containerId); if(!c) return;
    c.innerHTML='';
    hand.forEach(function(card,i){
      var div=document.createElement('div');
      if(hideSecond&&i===1){
        div.className='bj-card bj-card-back';
        div.textContent='🂠';
      } else {
        div.className='bj-card';
        div.style.color=SUIT_COLOR[card.suit]||'#000';
        div.innerHTML='<div class="bj-card-rank">'+card.rank+'</div><div class="bj-card-suit">'+card.suit+'</div>';
      }
      c.appendChild(div);
    });
  }

  function shuffle(arr){for(var i=arr.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=arr[i];arr[i]=arr[j];arr[j]=t;}return arr;}

})();
