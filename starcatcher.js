/*
 * ═══════════════════════════════════════════════════════════
 * STAR CATCHER — DuelZone Mini-Game  v2.0
 *
 * MOVEMENT FIX: Smooth basket sliding with proper speed.
 *   P1: A/D keys     P2: J/L keys (keyboard)
 *   MOBILE: Drag/touch anywhere on your half of the screen.
 *     • Bot mode  → left half is P1 touch zone
 *     • PvP mode  → left half P1, right half P2
 *
 * Integration:
 *   <script src="starcatcher.js"></script>
 *   Call scInit() on enter, scDestroy() on leave.
 * ═══════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var CFG={
    W:800,H:460,
    BASKET_W:72,BASKET_H:26,
    BASKET_SPEED:6,         // px per physics frame
    STAR_R:14,
    STAR_SPEED_BASE:1.9,
    SPAWN_BASE:85,SPAWN_MIN:26,
    WAVE_INTERVAL:550,
    COMBO_WINDOW:85,
    PHYS_STEP:1000/60,
    BOT:{
      easy:  {delay:55,noise:72,spd:3.8,miss:0.32},
      medium:{delay:22,noise:28,spd:5.0,miss:0.12},
      hard:  {delay:1, noise:1, spd:9.0,miss:0.001}
    }
  };

  var canvas,ctx;
  var raf=null,lastTime=0,accum=0;
  var gameState='home';  // 'home'|'countdown'|'playing'|'over'
  var isBot=false,botDiff='medium',matchTime=60,timeLeft=60;
  var timerInterval=null,cdInterval=null;

  var keys={};            // keyboard state
  var touchX={p1:null,p2:null};  // current touch X per player (null = no touch)

  var items=[],particles=[],confetti=[];
  var spawnTimer=0,spawnInterval=CFG.SPAWN_BASE,waveTimer=0;
  var windX=0,windTimer=0;

  var players=[];
  var botState={targetX:CFG.W*0.75,reactionTimer:0};
  var cdCount=3;

  // ── Player factory ────────────────────────────────────────
  function mkPlayer(x,color,accent,side){
    return{
      x:x,y:CFG.H-38,
      color:color,accent:accent,side:side,  // 'left'|'right'
      score:0,combo:0,comboTimer:0,
      magnetTimer:0,shieldTimer:0,
      slowTimer:0,frozenTimer:0
    };
  }

  // ── Basket movement (FIXED) ───────────────────────────────
  function moveBasket(pl,kLeft,kRight){
    if(pl.frozenTimer>0){pl.frozenTimer--;return;}

    // Touch input: if a touch is active on this player's side, drive toward it
    var tx=touchX[pl.side==='left'?'p1':'p2'];
    if(tx!==null){
      // Map canvas-pixel X to logical coordinate
      var scale=CFG.W/(canvas.getBoundingClientRect().width||CFG.W);
      var logicX=tx*scale;
      // Drive basket center toward touch X
      var cx=pl.x+CFG.BASKET_W*0.5;
      var dx=logicX-cx;
      if(Math.abs(dx)>4){
        pl.x+=Math.sign(dx)*Math.min(CFG.BASKET_SPEED,Math.abs(dx));
      }
    } else {
      // Keyboard
      if(keys[kLeft])  pl.x-=CFG.BASKET_SPEED;
      if(keys[kRight]) pl.x+=CFG.BASKET_SPEED;
    }
    pl.x=Math.max(0,Math.min(CFG.W-CFG.BASKET_W,pl.x));
  }

  // ── Bot AI ────────────────────────────────────────────────
  function updateBot(pl){
    if(pl.frozenTimer>0)return;
    var p=CFG.BOT[botDiff];
    botState.reactionTimer--;
    if(botState.reactionTimer>0) return;
    botState.reactionTimer=p.delay;

    // Find best target
    var bestX=pl.x+CFG.BASKET_W*0.5, bestScore=-999;
    for(var i=0;i<items.length;i++){
      var it=items[i];if(!it.active)continue;
      var sc=0;
      if(it.type==='gold')sc=10;
      else if(it.type==='star')sc=5;
      else if(it.type==='evil')sc=-15;  // avoid evil stars
      else if(it.type==='magnet')sc=8;
      else if(it.type==='shield')sc=7;
      else if(it.type==='slow')sc=6;
      else if(it.type==='bomb')sc=pl.shieldTimer>0?0:-18;
      sc+=(it.y/CFG.H)*4 - Math.abs(it.x-(pl.x+CFG.BASKET_W*0.5))/CFG.W*3;
      if(sc>bestScore&&Math.random()>p.miss){bestScore=sc;bestX=it.x+(Math.random()-0.5)*p.noise;}
    }
    botState.targetX=bestX;
  }

  function moveBotBasket(pl){
    if(pl.frozenTimer>0)return;
    var p=CFG.BOT[botDiff];
    var cx=pl.x+CFG.BASKET_W*0.5;
    var dx=botState.targetX-cx;
    if(Math.abs(dx)>4) pl.x+=Math.sign(dx)*Math.min(p.spd,Math.abs(dx));
    pl.x=Math.max(0,Math.min(CFG.W-CFG.BASKET_W,pl.x));
  }

  // ── Spawn items ───────────────────────────────────────────
  function spawnItem(){
    var x=CFG.STAR_R+Math.random()*(CFG.W-CFG.STAR_R*2);
    if(Math.random()<0.18) x=CFG.W*0.5+(Math.random()-0.5)*80;
    var r=Math.random();
    var type;
    if(r<0.43)      type='star';
    else if(r<0.60) type='gold';      // 3 points
    else if(r<0.70) type='evil';      // -1 point, new!
    else if(r<0.80) type='bomb';
    else if(r<0.86) type='magnet';
    else if(r<0.92) type='slow';
    else            type='shield';
    items.push({
      x:x,y:-CFG.STAR_R,
      vy:CFG.STAR_SPEED_BASE+Math.random()*0.9,
      type:type,active:true,
      pulse:Math.random()*Math.PI*2,
      trailX:[],trailY:[]
    });
  }

  // ── Update items (physics + catch) ───────────────────────
  function updateItems(){
    var slowActive=players.some(function(p){return p.slowTimer>0;});
    var waveSpeedMult=1+Math.min((CFG.SPAWN_BASE-spawnInterval)/CFG.SPAWN_BASE,0.65);

    for(var i=items.length-1;i>=0;i--){
      var it=items[i];
      if(!it.active){items.splice(i,1);continue;}

      it.x+=windX;
      it.y+=it.vy*waveSpeedMult*(slowActive?0.42:1);
      it.pulse+=0.1;
      it.trailX.push(it.x);it.trailY.push(it.y);
      if(it.trailX.length>8){it.trailX.shift();it.trailY.shift();}

      // Magnet attraction
      for(var p=0;p<players.length;p++){
        if(players[p].magnetTimer>0&&(it.type==='star'||it.type==='gold')){
          var bcx=players[p].x+CFG.BASKET_W*0.5;
          var ddx=bcx-it.x,ddy=players[p].y-it.y;
          var dist=Math.sqrt(ddx*ddx+ddy*ddy);
          if(dist<200&&dist>1){it.x+=ddx/dist*2.8;it.y+=ddy/dist*2.8;}
        }
      }

      if(it.y>CFG.H+30){items.splice(i,1);continue;}

      // Catch check
      var caught=false;
      for(var p=0;p<players.length;p++){
        var pl=players[p];
        var magExt=pl.magnetTimer>0?18:0;
        var hitX=pl.x-magExt, hitW=CFG.BASKET_W+magExt*2;
        if(it.y+CFG.STAR_R>=pl.y&&
           it.y-CFG.STAR_R<=pl.y+CFG.BASKET_H&&
           it.x>=hitX&&it.x<=hitX+hitW){
          catchItem(pl,p,it);
          items.splice(i,1);
          caught=true;break;
        }
      }
      if(caught)break;  // splice invalidates i
    }
  }

  function catchItem(pl,idx,it){
    var pts=0,color='#ffffff';
    if(it.type==='star'){
      pts=1;color='#ffd600';playSFX('catch');
    }else if(it.type==='gold'){
      pts=3;color='#ff8c00';
      spawnConfetti(it.x,it.y);playSFX('gold');
    }else if(it.type==='evil'){
      // Evil star: -1 point, flash screen red
      if(pl.shieldTimer>0){
        pl.shieldTimer=0;color='#888';
        spawnParts(it.x,it.y,'#888',6);
      }else{
        pts=-1;color='#ff0055';
        pl.combo=0;pl.comboTimer=0;
        spawnParts(it.x,it.y,'#ff0055',10);
        playSFX('bomb');
        // Flash player basket red briefly
        pl._evilFlash = 20;
      }
    }else if(it.type==='bomb'){
      if(pl.shieldTimer>0){
        pl.shieldTimer=0;color='#888';
        spawnParts(it.x,it.y,'#888',6);
      }else{
        pts=-2;color='#ff1744';
        pl.frozenTimer=65;
        spawnParts(it.x,it.y,'#ff4444',12);
        playSFX('bomb');
      }
    }else if(it.type==='magnet'){
      pl.magnetTimer=340;color='#aa00ff';playSFX('pickup');
    }else if(it.type==='slow'){
      pl.slowTimer=280;color='#00e5ff';playSFX('pickup');
    }else if(it.type==='shield'){
      pl.shieldTimer=280;color='#00ff88';playSFX('pickup');
    }

    if(pts>0){
      pl.comboTimer=CFG.COMBO_WINDOW;pl.combo++;
      var mult=pl.combo>=5?2:pl.combo>=3?1.5:1;
      pts=Math.ceil(pts*mult);
    }else if(pts<0){
      pl.combo=0;pl.comboTimer=0;
    }
    pl.score=Math.max(0,pl.score+pts);
    spawnParts(it.x,it.y,color,pts>0?8:5);
    updateHUD();
  }

  // ── Wind ─────────────────────────────────────────────────
  function updateWind(){
    windTimer--;
    if(windTimer<=0){windX=(Math.random()-0.5)*1.1;windTimer=200+Math.random()*280;}
    windX*=0.998;
  }

  // ── Physics step ─────────────────────────────────────────
  function physicsStep(){
    if(gameState!=='playing')return;

    // Wave escalation
    waveTimer++;
    if(waveTimer>=CFG.WAVE_INTERVAL){
      spawnInterval=Math.max(CFG.SPAWN_MIN,spawnInterval-8);
      waveTimer=0;
    }
    spawnTimer++;
    if(spawnTimer>=spawnInterval){spawnItem();spawnTimer=0;}

    // Move baskets
    moveBasket(players[0],'a','d');
    if(isBot){updateBot(players[1]);moveBotBasket(players[1]);}
    else{moveBasket(players[1],'j','l');}

    // Combo timers & power-up countdowns
    for(var p=0;p<players.length;p++){
      var pl=players[p];
      if(pl.comboTimer>0){pl.comboTimer--;if(pl.comboTimer<=0)pl.combo=0;}
      if(pl.magnetTimer>0)pl.magnetTimer--;
      if(pl.shieldTimer>0)pl.shieldTimer--;
      if(pl.slowTimer>0)pl.slowTimer--;
    }

    updateItems();
    updateWind();
  }

  // ── HUD ───────────────────────────────────────────────────
  function updateHUD(){
    var e;
    e=document.getElementById('sc-p1-score');if(e)e.textContent=players[0]?players[0].score:0;
    e=document.getElementById('sc-p2-score');if(e)e.textContent=players[1]?players[1].score:0;
    e=document.getElementById('sc-p1-combo');
    if(e)e.textContent=players[0]&&players[0].combo>1?'x'+players[0].combo+' COMBO!':'';
    e=document.getElementById('sc-p2-combo');
    if(e)e.textContent=players[1]&&players[1].combo>1?'x'+players[1].combo+' COMBO!':'';
    e=document.getElementById('sc-timer');if(e)e.textContent=Math.ceil(timeLeft);
  }

  // ── Draw ─────────────────────────────────────────────────
  var bgStars=[];
  function initBgStars(){
    bgStars=[];
    for(var i=0;i<80;i++)
      bgStars.push({x:Math.random()*CFG.W,y:Math.random()*CFG.H,
                    r:Math.random()*1.5,a:0.1+Math.random()*0.4,
                    tw:Math.random()*Math.PI*2});
  }

  function draw(){
    // Background
    var grad=ctx.createLinearGradient(0,0,0,CFG.H);
    grad.addColorStop(0,'#080c1a');grad.addColorStop(1,'#0d0f28');
    ctx.fillStyle=grad;ctx.fillRect(0,0,CFG.W,CFG.H);

    // BG stars
    for(var i=0;i<bgStars.length;i++){
      var s=bgStars[i];s.tw+=0.018;
      var al=s.a*(0.7+0.3*Math.sin(s.tw));
      ctx.save();ctx.globalAlpha=al;ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.restore();
    }

    // Wind indicator — improved visual with arrow and strength
    if (Math.abs(windX) > 0.08) {
      var windStr = Math.min(Math.abs(windX) / 0.55, 1);
      var windAlpha = 0.35 + windStr * 0.5;
      ctx.save();
      ctx.globalAlpha = windAlpha;
      var windDir = windX > 0 ? 1 : -1;
      var arrowCount = Math.ceil(windStr * 3);
      var centerY = 22;
      // Draw arrow glyphs
      ctx.font = 'bold 16px Rajdhani,sans-serif';
      ctx.fillStyle = windStr > 0.6 ? '#ffcc44' : 'rgba(160,210,255,0.9)';
      ctx.textAlign = 'center';
      var arrowStr = '';
      for (var aw = 0; aw < arrowCount; aw++) arrowStr += (windDir > 0 ? '›' : '‹');
      ctx.fillText('WIND ' + arrowStr, CFG.W * 0.5, centerY);
      // Strength bar
      ctx.fillStyle = 'rgba(150,200,255,0.25)';
      ctx.fillRect(CFG.W/2 - 40, centerY + 4, 80, 3);
      ctx.fillStyle = windStr > 0.6 ? '#ffcc44' : 'rgba(150,200,255,0.7)';
      ctx.fillRect(windDir > 0 ? CFG.W/2 - 40 : CFG.W/2 - 40 + 80*(1-windStr), centerY + 4, 80 * windStr, 3);
      ctx.restore();
    }

    // Center divider
    ctx.save();ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.setLineDash([5,8]);
    ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(CFG.W*0.5,0);ctx.lineTo(CFG.W*0.5,CFG.H);
    ctx.stroke();ctx.setLineDash([]);ctx.restore();

    // Items
    for(var i=0;i<items.length;i++) drawItem(items[i]);

    // Baskets
    for(var p=0;p<players.length;p++) drawBasket(players[p],p);

    // Particles & confetti
    drawParticles();
    drawConfetti();

    // Countdown overlay
    if(gameState==='countdown'){
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.font='bold 96px Orbitron,sans-serif';
      ctx.fillStyle='#ffd600';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowBlur=30;ctx.shadowColor='#ffd600';
      ctx.fillText(cdCount===0?'GO!':cdCount,CFG.W*0.5,CFG.H*0.5);
      ctx.restore();
    }
  }

  var ITEM_EMOJI={star:'⭐',gold:'🌟',evil:'💀',bomb:'💣',magnet:'🧲',slow:'🌀',shield:'🛡️'};
  var ITEM_COLOR={star:'#ffd600',gold:'#ff8c00',evil:'#ff0055',bomb:'#ff1744',magnet:'#aa00ff',slow:'#00e5ff',shield:'#00ff88'};

  function drawItem(it){
    ctx.save();
    var color=ITEM_COLOR[it.type]||'#fff';
    // Trail
    for(var t=0;t<it.trailX.length;t++){
      ctx.globalAlpha=(t/it.trailX.length)*0.25;
      ctx.fillStyle=color;
      ctx.beginPath();ctx.arc(it.trailX[t],it.trailY[t],CFG.STAR_R*0.38,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.shadowBlur=13+Math.sin(it.pulse)*4;ctx.shadowColor=color;
    ctx.font=(CFG.STAR_R*1.75)+'px serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(ITEM_EMOJI[it.type]||'⭐',it.x,it.y);
    ctx.restore();
  }

  function drawBasket(pl,idx){
    ctx.save();
    if(pl.frozenTimer>0&&Math.floor(pl.frozenTimer/5)%2===0) ctx.globalAlpha=0.45;
    if(pl.shieldTimer>0){ctx.shadowBlur=18;ctx.shadowColor='#00ff88';}
    if(pl.magnetTimer>0){ctx.shadowBlur=18;ctx.shadowColor='#aa00ff';}

    var bx=pl.x,by=pl.y,bw=CFG.BASKET_W,bh=CFG.BASKET_H;

    // U-shape (open top)
    ctx.beginPath();
    ctx.moveTo(bx,by);
    ctx.lineTo(bx,by+bh);
    ctx.lineTo(bx+bw,by+bh);
    ctx.lineTo(bx+bw,by);
    ctx.strokeStyle=pl.accent;ctx.lineWidth=3;ctx.lineJoin='round';ctx.stroke();

    var grd=ctx.createLinearGradient(bx,by,bx,by+bh);
    grd.addColorStop(0,pl.color+'90');grd.addColorStop(1,pl.color+'20');
    ctx.fillStyle=grd;ctx.fillRect(bx,by,bw,bh);

    // Label
    ctx.globalAlpha=1;
    ctx.font='11px Rajdhani,sans-serif';
    ctx.fillStyle=pl.accent;ctx.textAlign='center';
    ctx.fillText(isBot&&idx===1?'BOT':'P'+(idx+1),bx+bw*0.5,by-7);

    // Power-up icons
    var icons=[];
    if(pl.magnetTimer>0)icons.push('🧲');
    if(pl.shieldTimer>0)icons.push('🛡️');
    if(pl.slowTimer>0)icons.push('🌀');
    if(icons.length){
      ctx.font='13px serif';ctx.textAlign='center';
      ctx.fillText(icons.join(''),bx+bw*0.5,by-21);
    }
    ctx.restore();
  }

  function spawnParts(x,y,color,n){
    for(var i=0;i<n;i++){
      var a=Math.random()*Math.PI*2,s=1.5+Math.random()*3;
      particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-0.8,
                      life:25+Math.random()*25,max:50,color:color,r:2+Math.random()*4});
    }
  }
  function spawnConfetti(x,y){
    var COLS=['#ffd600','#ff6d00','#00e5ff','#00ff88','#f50057'];
    for(var i=0;i<20;i++){
      confetti.push({x:x,y:y,vx:(Math.random()-0.5)*8,vy:-(2+Math.random()*6),
                     life:60+Math.random()*60,max:120,
                     color:COLS[Math.floor(Math.random()*COLS.length)],
                     w:4+Math.random()*8,h:3+Math.random()*6,
                     rot:Math.random()*Math.PI*2,rotV:(Math.random()-0.5)*0.3});
    }
  }
  function drawParticles(){
    for(var i=particles.length-1;i>=0;i--){
      var pt=particles[i];
      pt.x+=pt.vx;pt.y+=pt.vy;pt.vx*=0.9;pt.vy*=0.9;pt.life--;
      if(pt.life<=0){particles.splice(i,1);continue;}
      var al=pt.life/pt.max;
      ctx.save();ctx.globalAlpha=al;ctx.fillStyle=pt.color;
      ctx.shadowBlur=4;ctx.shadowColor=pt.color;
      ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r*al,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }
  function drawConfetti(){
    for(var i=confetti.length-1;i>=0;i--){
      var c=confetti[i];
      c.x+=c.vx;c.y+=c.vy;c.vy+=0.15;c.rot+=c.rotV;c.life--;
      if(c.life<=0){confetti.splice(i,1);continue;}
      var al=c.life/c.max;
      ctx.save();ctx.globalAlpha=al;ctx.translate(c.x,c.y);ctx.rotate(c.rot);
      ctx.fillStyle=c.color;ctx.fillRect(-c.w*0.5,-c.h*0.5,c.w,c.h);
      ctx.restore();
    }
  }

  // ── Main loop ─────────────────────────────────────────────
  function loop(ts){
    raf=requestAnimationFrame(loop);
    var dt=ts-lastTime;lastTime=ts;
    if(dt>100)dt=100;
    if(gameState==='playing'){
      accum+=dt;
      while(accum>=CFG.PHYS_STEP){physicsStep();accum-=CFG.PHYS_STEP;}
    }
    draw();
  }

  // ── Countdown then play ───────────────────────────────────
  function startCountdown(cb){
    gameState='countdown';cdCount=3;
    var t=setInterval(function(){
      cdCount--;
      if(cdCount<0){clearInterval(t);cdInterval=null;cb();}
      else cdInterval=t;
    },1000);
  }

  // ── End game ─────────────────────────────────────────────
  function endGame(){
    gameState='over';
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    var s0=players[0]?players[0].score:0;
    var s1=players[1]?players[1].score:0;
    var wi=s0>s1?0:s1>s0?1:-1;
    var el=document.getElementById('sc-result');if(!el)return;
    var icon=document.getElementById('sc-result-icon');
    var title=document.getElementById('sc-result-title');
    var sub=document.getElementById('sc-result-sub');
    if(wi===-1){
      if(icon)icon.textContent='🤝';
      if(title)title.textContent="IT'S A DRAW!";
      if(sub)sub.textContent='Perfectly matched — try again!';
      if(typeof SoundManager!=='undefined')SoundManager.draw&&SoundManager.draw();
    }else{
      if(icon)icon.textContent='🌟';
      if(title)title.textContent=isBot&&wi===1?'🤖 Bot Wins!':'Player '+(wi+1)+' Wins!';
      if(sub)sub.textContent=isBot?(wi===0?'VICTORY — You Dominated!':'So close! Try an easier difficulty.'):'CLOSE CALL — Great catch duel!';
      if(typeof SoundManager!=='undefined')SoundManager.win&&SoundManager.win();
    }
    el.classList.remove('hidden');
  }

  // ── Start game ────────────────────────────────────────────
  function startGame(botMode){
    isBot=botMode;
    items=[];particles=[];confetti=[];
    spawnTimer=0;spawnInterval=CFG.SPAWN_BASE;
    waveTimer=0;windX=0;windTimer=180;
    timeLeft=matchTime;keys={};touchX={p1:null,p2:null};
    botState.reactionTimer=0;

    initBgStars();

    players=[
      mkPlayer(CFG.W*0.25-CFG.BASKET_W*0.5,'#1a3a5c','#00e5ff','left'),
      mkPlayer(CFG.W*0.75-CFG.BASKET_W*0.5,'#5c1a1a','#f50057','right')
    ];

    var home=document.getElementById('sc-home');
    var play=document.getElementById('sc-play-panel');
    var res=document.getElementById('sc-result');
    if(home)home.classList.add('hidden');
    if(res)res.classList.add('hidden');
    if(play){play.classList.remove('hidden');play.style.display='flex';}

    updateHUD();
    lastTime=performance.now();accum=0;
    if(!raf)raf=requestAnimationFrame(loop);

    startCountdown(function(){
      gameState='playing';
      timerInterval=setInterval(function(){
        timeLeft-=1;updateHUD();
        if(timeLeft<=0){clearInterval(timerInterval);timerInterval=null;endGame();}
      },1000);
    });
  }

  function backToSetup(){
    gameState='home';
    keys={};touchX={p1:null,p2:null};
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    if(cdInterval){clearInterval(cdInterval);cdInterval=null;}
    var home=document.getElementById('sc-home');
    var play=document.getElementById('sc-play-panel');
    var res=document.getElementById('sc-result');
    if(play){play.classList.add('hidden');play.style.display='none';}
    if(res)res.classList.add('hidden');
    if(home)home.classList.remove('hidden');
  }

  // ── Canvas resize ─────────────────────────────────────────
  function resizeCanvas(){
    if(!canvas)return;
    var maxW=Math.min(window.innerWidth-16,CFG.W);
    var scale=maxW/CFG.W;
    canvas.style.width=Math.round(CFG.W*scale)+'px';
    canvas.style.height=Math.round(CFG.H*scale)+'px';
  }

  // ── Touch input ───────────────────────────────────────────
  /*
   * Canvas is split in half. Left half → P1, Right half → P2.
   * On touchmove/touchstart, record X position for each half.
   * basket moveBasket() reads touchX[side] and drives toward it.
   */
  function canvasX(touch){
    var rect=canvas.getBoundingClientRect();
    // Return X in canvas CSS pixels (relative to canvas left edge)
    return touch.clientX - rect.left;
  }

  function onTouchStart(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      var cx=canvasX(t);
      var half=canvas.getBoundingClientRect().width*0.5;
      if(cx<=half) touchX.p1=cx;
      else          touchX.p2=cx;
    }
  }
  function onTouchMove(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      var cx=canvasX(t);
      var half=canvas.getBoundingClientRect().width*0.5;
      if(cx<=half) touchX.p1=cx;
      else          touchX.p2=cx;
    }
  }
  function onTouchEnd(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      var cx=canvasX(t);
      var half=canvas.getBoundingClientRect().width*0.5;
      // Only clear if no other touch in same half remains
      var hasLeft=false,hasRight=false;
      for(var j=0;j<e.touches.length;j++){
        var tx=canvasX(e.touches[j]);
        if(tx<=half)hasLeft=true; else hasRight=true;
      }
      if(!hasLeft)  touchX.p1=null;
      if(!hasRight) touchX.p2=null;
    }
  }

  // ── scInit ────────────────────────────────────────────────
  window.scInit=function(){
    canvas=document.getElementById('sc-canvas');
    if(!canvas)return;
    canvas.width=CFG.W;canvas.height=CFG.H;
    ctx=canvas.getContext('2d');
    initBgStars();resizeCanvas();

    var ad=document.querySelector('.sc-diff-btn.active');
    var at=document.querySelector('.sc-time-btn.active');
    botDiff=ad?ad.getAttribute('data-diff'):'medium';
    matchTime=at?+at.getAttribute('data-sec'):60;

    gameState='home';keys={};touchX={p1:null,p2:null};
    var home=document.getElementById('sc-home');
    var play=document.getElementById('sc-play-panel');
    if(home)home.classList.remove('hidden');
    if(play){play.classList.add('hidden');play.style.display='none';}

    if (!window._scWired) {
      document.addEventListener('keydown', onKey, false);
      document.addEventListener('keyup',   onKey, false);
      canvas.addEventListener('touchstart', onTouchStart, {passive:false});
      canvas.addEventListener('touchmove',  onTouchMove,  {passive:false});
      canvas.addEventListener('touchend',   onTouchEnd,   {passive:false});
      canvas.addEventListener('touchcancel',onTouchEnd,   {passive:false});
      window.addEventListener('resize', resizeCanvas);
      window._scWired = true;
    }

    document.querySelectorAll('.sc-diff-btn').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.sc-diff-btn').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');botDiff=b.getAttribute('data-diff');
      });
    });
    document.querySelectorAll('.sc-time-btn').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.sc-time-btn').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');matchTime=+b.getAttribute('data-sec');
      });
    });

    var sPvp=document.getElementById('sc-start-pvp');
    var sBot=document.getElementById('sc-start-bot');
    if(sPvp)sPvp.onclick=function(){startGame(false);};
    if(sBot)sBot.onclick=function(){startGame(true);};

    var bHub=document.getElementById('sc-back-hub');
    if(bHub)bHub.onclick=function(){scDestroy();showHub();};
    var bSet=document.getElementById('sc-back-setup');
    if(bSet)bSet.onclick=backToSetup;
    var bPA=document.getElementById('sc-play-again');
    if(bPA)bPA.onclick=function(){startGame(isBot);};
    var bTS=document.getElementById('sc-to-setup');
    if(bTS)bTS.onclick=backToSetup;

    if(!raf){lastTime=performance.now();raf=requestAnimationFrame(loop);}
  };

  window.scDestroy=function(){
    if(raf){cancelAnimationFrame(raf);raf=null;}
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    if(cdInterval){clearInterval(cdInterval);cdInterval=null;}
    gameState='home';keys={};touchX={p1:null,p2:null};
    document.removeEventListener('keydown',onKey);
    document.removeEventListener('keyup',  onKey);
    if(canvas){
      canvas.removeEventListener('touchstart',onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend',  onTouchEnd);
      canvas.removeEventListener('touchcancel',onTouchEnd);
    }
    window.removeEventListener('resize',resizeCanvas);
    window._scWired = false;
  };

  // ── Keyboard ─────────────────────────────────────────────
  function onKey(e){
    var scr=document.getElementById('screen-starcatcher');
    if(!scr||scr.classList.contains('hidden'))return;
    var down=(e.type==='keydown');
    if(e.key==='a'||e.key==='A')keys['a']=down;
    if(e.key==='d'||e.key==='D')keys['d']=down;
    if(e.key==='j'||e.key==='J')keys['j']=down;
    if(e.key==='l'||e.key==='L')keys['l']=down;
    if(['a','d','j','l'].indexOf(e.key.toLowerCase())>=0)e.preventDefault();
  }

  // ── SFX ───────────────────────────────────────────────────
  function playSFX(type){
    if(typeof SoundManager==='undefined'||SoundManager.isMuted())return;
    try{
      var AC=window.AudioContext||window.webkitAudioContext;
      var c=new AC();
      if(type==='catch'){
        var o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=880;
        g.gain.setValueAtTime(0.1,c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1);
        o.start();o.stop(c.currentTime+0.11);
      }else if(type==='gold'){
        [1047,1319,1568].forEach(function(f,i){
          var o2=c.createOscillator(),g2=c.createGain();
          o2.connect(g2);g2.connect(c.destination);o2.type='sine';o2.frequency.value=f;
          var t2=c.currentTime+i*0.07;
          g2.gain.setValueAtTime(0.1,t2);g2.gain.exponentialRampToValueAtTime(0.001,t2+0.16);
          o2.start(t2);o2.stop(t2+0.17);
        });
      }else if(type==='bomb'){
        var buf=c.createBuffer(1,c.sampleRate*0.2,c.sampleRate);
        var d=buf.getChannelData(0);
        for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/d.length*8);
        var src=c.createBufferSource();src.buffer=buf;
        var gg=c.createGain();gg.gain.value=0.38;
        src.connect(gg);gg.connect(c.destination);src.start();
      }else if(type==='pickup'){
        var o3=c.createOscillator(),g3=c.createGain();
        o3.connect(g3);g3.connect(c.destination);o3.type='sine';
        o3.frequency.setValueAtTime(500,c.currentTime);
        o3.frequency.exponentialRampToValueAtTime(1000,c.currentTime+0.18);
        g3.gain.setValueAtTime(0.1,c.currentTime);
        g3.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.2);
        o3.start();o3.stop(c.currentTime+0.21);
      }
    }catch(err){}
  }

})();
