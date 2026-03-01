// ═══════════════════════════════════════════════════════════════
// DuelZone · Snake Duel  (snake.js)
// Two snakes on one board. Eat apples to grow. Crash = lose.
// PvP: WASD vs Arrow Keys  |  PvBot: 3 difficulty levels
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var COLS = 28, ROWS = 20, CELL = 22;
  var TICK_SPEED = { easy: 180, medium: 130, hard: 55 };
  var BOT_ERR    = { easy: 0.42, medium: 0.18, hard: 0.005 };

  var canvas, ctx;
  var _wired = false;

  var S = {
    running: false, over: false, mode: 'pvp', diff: 'medium', paused: false,
    snakes: [], food: [], stars: [], tick: 0,
    score: [0, 0], intervalId: null, cntId: null, countdown: 0,
  };

  window.snakeInit = function () {
    canvas = document.getElementById('snake-canvas');
    if (!canvas) return;
    canvas.width  = COLS * CELL;
    canvas.height = ROWS * CELL;
    ctx = canvas.getContext('2d');
    snakeResize();
    if (!_wired) { snakeWireUI(); _wired = true; }
    snakeShowHome();
  };

  window.snakeDestroy = function () { snakeClearTimers(); };

  function snakeResize() {
    if (!canvas) return;
    var max = Math.min(window.innerWidth - 16, COLS * CELL);
    var sc  = max / (COLS * CELL);
    canvas.style.width  = Math.round(COLS * CELL * sc) + 'px';
    canvas.style.height = Math.round(ROWS * CELL * sc) + 'px';
  }

  function snakeShowHome() {
    el('snake-home').classList.remove('hidden');
    el('snake-play').classList.add('hidden');
  }

  function el(id) { return document.getElementById(id); }
  function on(id, fn){ var e=el(id); if(e) e.addEventListener('click', fn); }
  function setText(id,v){ var e=el(id); if(e) e.textContent=v; }

  function snakeWireUI() {
    window.addEventListener('resize', snakeResize);
    document.addEventListener('keydown', snakeKey);
    on('snake-back-hub',   function(){ snakeClearTimers(); showHub(); });
    on('snake-back-play',  function(){ snakeClearTimers(); snakeShowHome(); });
    on('snake-again',      function(){ snakeCountdown(); });
    on('snake-result-hub', function(){ snakeClearTimers(); showHub(); });

    // New mode-selector logic
    on('snake-mode-pvp', function(){
      S.mode = 'pvp';
      document.getElementById('snake-mode-pvp').classList.add('active');
      document.getElementById('snake-mode-bot').classList.remove('active');
      var bs = document.getElementById('snake-bot-settings');
      if(bs) bs.classList.add('hidden');
      var sb = document.getElementById('snake-start-btn');
      if(sb) sb.removeAttribute('data-mode');
    });
    on('snake-mode-bot', function(){
      S.mode = 'bot';
      document.getElementById('snake-mode-bot').classList.add('active');
      document.getElementById('snake-mode-pvp').classList.remove('active');
      var bs = document.getElementById('snake-bot-settings');
      if(bs) bs.classList.remove('hidden');
      var sb = document.getElementById('snake-start-btn');
      if(sb) sb.setAttribute('data-mode','bot');
    });
    on('snake-start-btn', function(){ snakeCountdown(); });

    document.querySelectorAll('.sn-diff').forEach(function(b){
      b.addEventListener('click', function(){
        document.querySelectorAll('.sn-diff').forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active'); S.diff = b.dataset.diff;
      });
    });

    var tx0, ty0;
    canvas.addEventListener('touchstart', function(e){ tx0=e.touches[0].clientX; ty0=e.touches[0].clientY; },{passive:true});
    canvas.addEventListener('touchend', function(e){
      var dx=e.changedTouches[0].clientX-tx0, dy=e.changedTouches[0].clientY-ty0;
      if(Math.abs(dx)<12&&Math.abs(dy)<12) return;
      var s=S.snakes[0]; if(!s||!S.running) return;
      if(Math.abs(dx)>Math.abs(dy)){ if(dx>0&&s.dir.x!==-1) s.nd={x:1,y:0}; else if(dx<0&&s.dir.x!==1) s.nd={x:-1,y:0}; }
      else { if(dy>0&&s.dir.y!==-1) s.nd={x:0,y:1}; else if(dy<0&&s.dir.y!==1) s.nd={x:0,y:-1}; }
    },{passive:true});
  }

  function snakeCountdown() {
    snakeClearTimers();
    el('snake-home').classList.add('hidden');
    el('snake-play').classList.remove('hidden');
    el('snake-result').classList.add('hidden');
    snakeSetup();
    S.countdown = 3; snakeDraw(); drawCountdown();
    S.cntId = setInterval(function(){
      S.countdown--;
      if(S.countdown<=0){ clearInterval(S.cntId); S.cntId=null; snakeStart(); }
      else { snakeDraw(); drawCountdown(); }
    }, 900);
  }

  function snakeSetup() {
    S.over=false; S.running=false; S.tick=0; S.score=[0,0]; S.food=[]; S.stars=[]; S.paused=false;
    var midY=Math.floor(ROWS/2);
    S.snakes=[
      mkSnake([{x:4,y:midY},{x:3,y:midY},{x:2,y:midY}],{x:1,y:0},'#00e5ff',0,'P1'),
      mkSnake([{x:COLS-5,y:midY},{x:COLS-4,y:midY},{x:COLS-3,y:midY}],{x:-1,y:0},'#f50057',1,S.mode==='bot'?'BOT':'P2'),
    ];
    spawnApple(); spawnApple(); spawnApple(); hud();
  }

  function mkSnake(cells,dir,color,pid,label){
    return{cells:cells,dir:{x:dir.x,y:dir.y},nd:{x:dir.x,y:dir.y},alive:true,color:color,pid:pid,label:label};
  }

  function snakeStart(){ S.running=true; S.intervalId=setInterval(tick,TICK_SPEED[S.diff]||130); snakeDraw(); }

  function snakeClearTimers(){
    if(S.intervalId){clearInterval(S.intervalId);S.intervalId=null;}
    if(S.cntId){clearInterval(S.cntId);S.cntId=null;}
    S.running=false;
  }

  function tick(){
    if(!S.running||S.over||S.paused) return;
    S.tick++;
    if(S.mode==='bot') botMove(S.snakes[1],S.snakes[0]);
    S.snakes.forEach(function(s){
      if(!s.alive) return;
      s.dir={x:s.nd.x,y:s.nd.y};
      var h={x:s.cells[0].x+s.dir.x,y:s.cells[0].y+s.dir.y};
      if(h.x<0||h.x>=COLS||h.y<0||h.y>=ROWS){s.alive=false;return;}
      for(var si=0;si<S.snakes.length;si++){
        var b=S.snakes[si].cells, lim=(S.snakes[si]===s)?b.length-1:b.length;
        for(var ci=0;ci<lim;ci++) if(b[ci].x===h.x&&b[ci].y===h.y){s.alive=false;return;}
      }
      var ate=false;
      for(var fi=S.food.length-1;fi>=0;fi--){
        if(S.food[fi].x===h.x&&S.food[fi].y===h.y){S.food.splice(fi,1);S.score[s.pid]++;ate=true;spawnApple();sfx('eat');break;}
      }
      for(var ri=S.stars.length-1;ri>=0;ri--){
        if(S.stars[ri].x===h.x&&S.stars[ri].y===h.y){
          S.stars.splice(ri,1);S.score[s.pid]+=3;
          for(var g=0;g<3;g++) s.cells.push({x:s.cells[s.cells.length-1].x,y:s.cells[s.cells.length-1].y});
          sfx('star');break;
        }
      }
      s.cells.unshift(h);
      if(!ate) s.cells.pop();
    });
    if(S.tick%40===0&&S.stars.length<2) spawnStar();
    if(S.snakes.filter(function(s){return!s.alive;}).length){
      snakeClearTimers(); S.over=true; setTimeout(snakeEnd,350);
    }
    hud(); snakeDraw();
  }

  function botMove(bot,enemy){
    if(!bot.alive||Math.random()<BOT_ERR[S.diff]) return;
    var h=bot.cells[0];
    var targets=S.food.concat(S.stars), best=null, bd=Infinity;
    targets.forEach(function(t){var d=Math.abs(t.x-h.x)+Math.abs(t.y-h.y);if(d<bd){bd=d;best=t;}});
    var dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].filter(function(d){return!(d.x===-bot.dir.x&&d.y===-bot.dir.y);});
    dirs.sort(function(a,b){
      var ap={x:h.x+a.x,y:h.y+a.y},bp={x:h.x+b.x,y:h.y+b.y};
      var as=isSafe(ap),bs=isSafe(bp);
      if(as!==bs) return bs-as;
      if(!best) return 0;
      return(Math.abs(ap.x-best.x)+Math.abs(ap.y-best.y))-(Math.abs(bp.x-best.x)+Math.abs(bp.y-best.y));
    });
    for(var i=0;i<dirs.length;i++){if(isSafe({x:h.x+dirs[i].x,y:h.y+dirs[i].y})){bot.nd=dirs[i];break;}}
  }

  function isSafe(p){
    if(p.x<0||p.x>=COLS||p.y<0||p.y>=ROWS) return false;
    for(var si=0;si<S.snakes.length;si++){var c=S.snakes[si].cells;for(var ci=0;ci<c.length-1;ci++) if(c[ci].x===p.x&&c[ci].y===p.y) return false;}
    return true;
  }

  function freeCell(){
    for(var t=0;t<300;t++){
      var x=Math.floor(Math.random()*COLS),y=Math.floor(Math.random()*ROWS),ok=true;
      for(var si=0;si<S.snakes.length;si++){var c=S.snakes[si].cells;for(var ci=0;ci<c.length;ci++) if(c[ci].x===x&&c[ci].y===y){ok=false;break;} if(!ok) break;}
      if(ok&&!S.food.some(function(f){return f.x===x&&f.y===y;})&&!S.stars.some(function(r){return r.x===x&&r.y===y;})) return{x:x,y:y};
    }
    return null;
  }
  function spawnApple(){var c=freeCell();if(c) S.food.push(c);}
  function spawnStar(){var c=freeCell();if(c) S.stars.push(c);}

  function snakeEnd(){
    var alive=S.snakes.filter(function(s){return s.alive;});
    var w=alive.length===1?alive[0].pid:alive.length===0?(S.score[0]>S.score[1]?0:S.score[1]>S.score[0]?1:-1):-1;
    var names=['Player 1',S.mode==='bot'?'Bot':'Player 2'];
    var title=el('snake-result-title'),detail=el('snake-result-detail');
    if(w===-1){title.textContent='🤝 Draw!';detail.textContent='Both crashed simultaneously!';}
    else{title.textContent='🏆 '+names[w]+' Wins!';detail.textContent='Score  '+S.score[0]+' – '+S.score[1];}
    el('snake-result').classList.remove('hidden');
    sfx('die');
    if(typeof SoundManager!=='undefined'&&SoundManager.win) SoundManager.win();
  }

  function hud(){
    setText('snake-s1',S.score[0]); setText('snake-s2',S.score[1]);
    setText('snake-len1',S.snakes[0]?S.snakes[0].cells.length:'');
    setText('snake-len2',S.snakes[1]?S.snakes[1].cells.length:'');
  }

  function snakeKey(e){
    var scr=el('screen-snake');
    if(!scr||scr.classList.contains('hidden')) return;
    // Pause toggle
    if((e.key==='p'||e.key==='P'||e.key==='Escape')&&S.running&&!S.over&&S.cntId===null){
      S.paused=!S.paused;
      snakeDrawPause();
      return;
    }
    if(!S.running||S.paused) return;
    var s1=S.snakes[0],s2=S.snakes[1];
    var map={
      'w':function(){if(s1&&s1.dir.y!==1) s1.nd={x:0,y:-1};},'W':function(){if(s1&&s1.dir.y!==1) s1.nd={x:0,y:-1};},
      's':function(){if(s1&&s1.dir.y!==-1)s1.nd={x:0,y:1};}, 'S':function(){if(s1&&s1.dir.y!==-1)s1.nd={x:0,y:1};},
      'a':function(){if(s1&&s1.dir.x!==1) s1.nd={x:-1,y:0};},'A':function(){if(s1&&s1.dir.x!==1) s1.nd={x:-1,y:0};},
      'd':function(){if(s1&&s1.dir.x!==-1)s1.nd={x:1,y:0};}, 'D':function(){if(s1&&s1.dir.x!==-1)s1.nd={x:1,y:0};},
      'ArrowUp':   function(){if(S.mode==='pvp'&&s2&&s2.dir.y!==1)  s2.nd={x:0,y:-1};},
      'ArrowDown': function(){if(S.mode==='pvp'&&s2&&s2.dir.y!==-1) s2.nd={x:0,y:1};},
      'ArrowLeft': function(){if(S.mode==='pvp'&&s2&&s2.dir.x!==1)  s2.nd={x:-1,y:0};},
      'ArrowRight':function(){if(S.mode==='pvp'&&s2&&s2.dir.x!==-1) s2.nd={x:1,y:0};},
    };
    if(map[e.key]){map[e.key]();if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key)>=0) e.preventDefault();}
  }

  function snakeDrawPause(){
    if(!ctx) return;
    if(S.paused){
      snakeDraw();
      var W=COLS*CELL,H=ROWS*CELL;
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.65)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff';
      ctx.font='bold 40px Orbitron,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.shadowColor='#00e5ff';
      ctx.shadowBlur=30;
      ctx.fillText('⏸ PAUSED',W/2,H/2);
      ctx.font='14px Rajdhani,sans-serif';
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,0.4)';
      ctx.fillText('Press P or Esc to resume',W/2,H/2+36);
      ctx.restore();
    }
  }

  function snakeDraw(){
    if(!ctx) return;
    var W=COLS*CELL,H=ROWS*CELL;
    ctx.fillStyle='#07080f'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=0.5;
    for(var gx=0;gx<=W;gx+=CELL){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
    for(var gy=0;gy<=H;gy+=CELL){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}

    S.food.forEach(function(f){
      ctx.save(); ctx.shadowColor='#ff4444'; ctx.shadowBlur=14;
      ctx.fillStyle='#e03030'; rr(f.x*CELL+3,f.y*CELL+3,CELL-6,CELL-6,5);
      ctx.shadowBlur=0; ctx.fillStyle='#4ade80';
      ctx.fillRect(f.x*CELL+CELL/2-1,f.y*CELL+2,2,4); ctx.restore();
    });
    S.stars.forEach(function(r){
      ctx.save(); ctx.shadowColor='#fbbf24'; ctx.shadowBlur=18;
      ctx.font=(CELL)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⭐',r.x*CELL+CELL/2,r.y*CELL+CELL/2); ctx.restore();
    });
    S.snakes.forEach(function(s){
      s.cells.forEach(function(c,i){
        ctx.save(); ctx.globalAlpha=s.alive?1:0.3;
        ctx.shadowColor=s.color; ctx.shadowBlur=i===0?20:6;
        ctx.fillStyle=blendColor(s.color,Math.max(0.35,1-i/s.cells.length*0.6));
        rr(c.x*CELL+2,c.y*CELL+2,CELL-4,CELL-4,i===0?7:4);
        if(i===0&&s.alive){
          ctx.shadowBlur=0; ctx.fillStyle='#fff';
          var px=s.dir.x,py=s.dir.y,ex=c.x*CELL+CELL/2+px*4,ey=c.y*CELL+CELL/2+py*4;
          ctx.beginPath();ctx.arc(ex+py*4,ey-px*4,2.5,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(ex-py*4,ey+px*4,2.5,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#111';
          ctx.beginPath();ctx.arc(ex+py*4,ey-px*4,1.2,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(ex-py*4,ey+px*4,1.2,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      });
    });
  }

  function drawCountdown(){
    if(!ctx) return;
    var W=COLS*CELL,H=ROWS*CELL;
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; ctx.font='bold 80px Orbitron,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='#00e5ff'; ctx.shadowBlur=50;
    ctx.fillText(S.countdown,W/2,H/2); ctx.restore();
  }

  function rr(x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();ctx.fill();
  }

  function blendColor(hex,t){
    var n=parseInt(hex.replace('#',''),16);
    return'rgb('+Math.round(((n>>16)&255)*t+15*(1-t))+','+Math.round(((n>>8)&255)*t+15*(1-t))+','+Math.round((n&255)*t+15*(1-t))+')';
  }

  function sfx(type){
    try{
      var AC=window.AudioContext||window.webkitAudioContext,c=new AC();
      if(type==='eat'){var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(700,c.currentTime);o.frequency.exponentialRampToValueAtTime(1000,c.currentTime+0.07);g.gain.setValueAtTime(0.07,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1);o.start();o.stop(c.currentTime+0.11);}
      else if(type==='star'){[800,1100,1400].forEach(function(freq,i){setTimeout(function(){var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0.06,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1);o.start();o.stop(c.currentTime+0.12);},i*80);});}
      else if(type==='die'){var o2=c.createOscillator(),g2=c.createGain();o2.connect(g2);g2.connect(c.destination);o2.type='sawtooth';o2.frequency.setValueAtTime(350,c.currentTime);o2.frequency.exponentialRampToValueAtTime(60,c.currentTime+0.5);g2.gain.setValueAtTime(0.12,c.currentTime);g2.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.55);o2.start();o2.stop(c.currentTime+0.56);}
    }catch(e){}
  }

})();
