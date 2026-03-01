/*
 * ═══════════════════════════════════════════════════════════
 * TANKS ARENA — DuelZone Mini-Game  v2.0
 *
 * MOVEMENT FIX: Absolute 8-directional movement.
 *   W/↑ = up   S/↓ = down   A/← = left   D/→ = right
 *   Tank body smoothly rotates to face movement direction.
 *   Space / Enter = FIRE
 *
 * MOBILE: On-screen D-pad + FIRE button rendered below canvas.
 *   Bot mode  → 1 control set (P1 only)
 *   PvP mode  → 2 control sets side-by-side
 *
 * Integration:
 *   <script src="tanks.js"></script>
 *   Call tanksInit() on enter, tanksDestroy() on leave.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var CFG = {
    W:800, H:500,
    TANK_SPEED:3.2, TANK_R:16, TANK_HP:100,
    BULLET_SPEED:6.5, BULLET_DMG:25, BULLET_R:5,
    BULLET_LIFE:110, BULLET_BOUNCE:2, SHOOT_CD:38,
    POWERUP_INT:550, POWERUP_LIFE:380,
    RESPAWN:180, INVULN:150,
    PHYS_STEP:1000/60,
    BOT:{
      easy:  {react:55,err:0.38,agg:0.35},
      medium:{react:22,err:0.18,agg:0.70},
      hard:  {react:1, err:0.005,agg:1.00}
    }
  };

  var canvas,ctx,mobileDiv;
  var raf=null,lastTime=0,accum=0;
  var gameState='home';
  var isBot=false,botDiff='medium',killTarget=5;
  var inp={};   // unified input: inp['p1_up'], inp['p2_fire'], etc.

  var MAPS = [
    // Map 1: Classic (original)
    {
      name: 'Classic',
      obs: [
        {x:150,y:100,w:80,h:18},{x:580,y:100,w:80,h:18},
        {x:150,y:382,w:80,h:18},{x:580,y:382,w:80,h:18},
        {x:352,y:80, w:18,h:78},{x:352,y:342,w:18,h:78},
        {x:336,y:228,w:128,h:18},
        {x:75,y:222,w:62,h:18},{x:663,y:222,w:62,h:18}
      ],
      spawns:[{x:70,y:70,angle:0.785},{x:730,y:430,angle:0.785+Math.PI}]
    },
    // Map 2: Cross
    {
      name: 'Cross',
      obs: [
        {x:200,y:80,w:18,h:340},{x:582,y:80,w:18,h:340},
        {x:80,y:200,w:340,h:18},{x:80,y:282,w:340,h:18},
        {x:380,y:200,w:340,h:18},{x:380,y:282,w:340,h:18},
        {x:290,y:120,w:220,h:18},{x:290,y:362,w:220,h:18}
      ],
      spawns:[{x:60,y:60,angle:0.785},{x:740,y:440,angle:0.785+Math.PI}]
    },
    // Map 3: Open Arena with pillars
    {
      name: 'Pillars',
      obs: [
        {x:140,y:140,w:30,h:30},{x:630,y:140,w:30,h:30},
        {x:140,y:330,w:30,h:30},{x:630,y:330,w:30,h:30},
        {x:385,y:90,w:30,h:30},{x:385,y:380,w:30,h:30},
        {x:200,y:235,w:30,h:30},{x:570,y:235,w:30,h:30},
        {x:385,y:235,w:30,h:30}
      ],
      spawns:[{x:60,y:250,angle:0},{x:740,y:250,angle:Math.PI}]
    }
  ];

  var currentMapIdx = 0;
  var OBS = MAPS[0].obs;
  var SPAWNS = MAPS[0].spawns;

  function selectMap(idx) {
    currentMapIdx = idx % MAPS.length;
    OBS = MAPS[currentMapIdx].obs;
    SPAWNS = MAPS[currentMapIdx].spawns;
  }

  var tanks=[],bullets=[],powerups=[],particles=[];
  var powerupTimer=0;
  var shake={x:0,y:0,f:0,i:0};
  var bot={timer:0};

  // ── Collision ─────────────────────────────────────────────
  function circRect(cx,cy,cr,rx,ry,rw,rh){
    var nx=Math.max(rx,Math.min(cx,rx+rw));
    var ny=Math.max(ry,Math.min(cy,ry+rh));
    var dx=cx-nx,dy=cy-ny;
    return dx*dx+dy*dy<cr*cr;
  }
  function obsAt(px,py,pr){
    for(var i=0;i<OBS.length;i++){
      var o=OBS[i];
      if(circRect(px,py,pr,o.x,o.y,o.w,o.h)) return o;
    }
    return null;
  }

  // ── Tank factory ──────────────────────────────────────────
  function mkTank(sp,color,accent,pid){
    return{x:sp.x,y:sp.y,angle:sp.angle,vx:0,vy:0,
           hp:CFG.TANK_HP,kills:0,color:color,accent:accent,pid:pid,
           shootCD:0,respawnT:0,invulnT:0,dead:false,doubleDmg:0};
  }

  // ── Move tank (FIXED: absolute 8-directional) ─────────────
  function moveTank(tk,prefix){
    if(tk.dead){if(tk.invulnT>0)tk.invulnT--;return;}

    var up=!!inp[prefix+'_up'],   dn=!!inp[prefix+'_down'];
    var lt=!!inp[prefix+'_left'], rt=!!inp[prefix+'_right'];
    var fire=!!inp[prefix+'_fire'];

    var dx=(rt?1:0)-(lt?1:0);
    var dy=(dn?1:0)-(up?1:0);
    var prevX=tk.x,prevY=tk.y;

    if(dx!==0||dy!==0){
      // Normalise diagonal
      if(dx!==0&&dy!==0){dx*=0.7071;dy*=0.7071;}
      dx*=CFG.TANK_SPEED; dy*=CFG.TANK_SPEED;

      // Smooth body rotation toward movement direction
      var ta=Math.atan2(dy,dx);
      var diff=ta-tk.angle;
      while(diff>Math.PI)diff-=Math.PI*2;
      while(diff<-Math.PI)diff+=Math.PI*2;
      tk.angle+=diff*0.22;

      // Slide collision: try X and Y axes separately
      var nx=Math.max(CFG.TANK_R,Math.min(CFG.W-CFG.TANK_R,tk.x+dx));
      var ny=Math.max(CFG.TANK_R,Math.min(CFG.H-CFG.TANK_R,tk.y+dy));
      if(!obsAt(nx,tk.y,CFG.TANK_R)) tk.x=nx;
      if(!obsAt(tk.x,ny,CFG.TANK_R)) tk.y=ny;
    }

    // Store real velocity for bot prediction
    tk.vx=tk.x-prevX;
    tk.vy=tk.y-prevY;

    // Fire
    if(tk.shootCD>0)tk.shootCD--;
    if(fire&&tk.shootCD===0){
      var dmg=tk.doubleDmg>0?CFG.BULLET_DMG*2:CFG.BULLET_DMG;
      var bx=tk.x+Math.cos(tk.angle)*(CFG.TANK_R+6);
      var by=tk.y+Math.sin(tk.angle)*(CFG.TANK_R+6);
      bullets.push({x:bx,y:by,
        vx:Math.cos(tk.angle)*CFG.BULLET_SPEED,
        vy:Math.sin(tk.angle)*CFG.BULLET_SPEED,
        owner:tanks.indexOf(tk),dmg:dmg,
        life:CFG.BULLET_LIFE,bounces:0,active:true});
      tk.shootCD=CFG.SHOOT_CD;
      playSFX('shoot');
    }
    if(tk.doubleDmg>0)tk.doubleDmg--;
    if(tk.invulnT>0)tk.invulnT--;
  }

  // ── Bot AI ────────────────────────────────────────────────
  function updateBot(bk,enemy){
    if(bk.dead) return;
    var p=CFG.BOT[botDiff];
    bot.timer--;
    if(bot.timer>0) return;
    bot.timer=p.react;

    if(enemy.dead){
      // Wander toward center
      inp['bot_up']=bk.y>CFG.H*0.5;
      inp['bot_down']=bk.y<CFG.H*0.5;
      inp['bot_left']=bk.x>CFG.W*0.5;
      inp['bot_right']=bk.x<CFG.W*0.5;
      inp['bot_fire']=false;
      return;
    }

    // Predict enemy position (hard mode)
    var ex=enemy.x,ey=enemy.y;
    if(botDiff==='hard'){
      var tof=Math.hypot(ex-bk.x,ey-bk.y)/CFG.BULLET_SPEED;
      ex+=enemy.vx*tof; ey+=enemy.vy*tof;
    }

    var toAng=Math.atan2(ey-bk.y,ex-bk.x)+(Math.random()-0.5)*p.err*2;
    var dist=Math.hypot(enemy.x-bk.x,enemy.y-bk.y);

    // Strafe sideways when too close
    if(dist<110) toAng+=Math.PI*0.5;

    var mnx=Math.cos(toAng),mny=Math.sin(toAng);
    if(Math.random()>p.agg){mnx=0;mny=0;}

    inp['bot_up']=mny<-0.28;   inp['bot_down']=mny>0.28;
    inp['bot_left']=mnx<-0.28; inp['bot_right']=mnx>0.28;

    // Shoot when tank face is close to enemy angle
    var faceDiff=toAng-bk.angle;
    while(faceDiff>Math.PI)faceDiff-=Math.PI*2;
    while(faceDiff<-Math.PI)faceDiff+=Math.PI*2;
    inp['bot_fire']=Math.abs(faceDiff)<(botDiff==='hard'?0.08:0.38);

    // Wall avoidance override
    var mg=80;
    if(bk.x<mg||bk.x>CFG.W-mg||bk.y<mg||bk.y>CFG.H-mg){
      var ca=Math.atan2(CFG.H/2-bk.y,CFG.W/2-bk.x);
      var cnx=Math.cos(ca),cny=Math.sin(ca);
      inp['bot_up']=cny<-0.28;   inp['bot_down']=cny>0.28;
      inp['bot_left']=cnx<-0.28; inp['bot_right']=cnx>0.28;
    }
  }

  // ── Bullets ───────────────────────────────────────────────
  function updateBullets(){
    for(var i=bullets.length-1;i>=0;i--){
      var b=bullets[i];
      if(!b.active){bullets.splice(i,1);continue;}
      b.life--;
      if(b.life<=0){bullets.splice(i,1);continue;}
      var nx=b.x+b.vx,ny=b.y+b.vy;
      var wb=false;
      if(nx<CFG.BULLET_R||nx>CFG.W-CFG.BULLET_R){b.vx=-b.vx;nx=b.x+b.vx;wb=true;}
      if(ny<CFG.BULLET_R||ny>CFG.H-CFG.BULLET_R){b.vy=-b.vy;ny=b.y+b.vy;wb=true;}
      if(wb){
        b.bounces++;
        if(b.bounces>CFG.BULLET_BOUNCE){bullets.splice(i,1);continue;}
        // Ricochet spark
        spawnRicochetSpark(b.x,b.y,tanks[b.owner]?tanks[b.owner].accent:'#fff');
      }
      if(obsAt(nx,ny,CFG.BULLET_R)){
        var hx=obsAt(nx,b.y,CFG.BULLET_R),hy=obsAt(b.x,ny,CFG.BULLET_R);
        if(hx)b.vx=-b.vx; if(hy)b.vy=-b.vy;
        if(!hx&&!hy){b.vx=-b.vx;b.vy=-b.vy;}
        b.bounces++;
        if(b.bounces>CFG.BULLET_BOUNCE){bullets.splice(i,1);continue;}
        // Ricochet spark on obstacle
        spawnRicochetSpark(b.x,b.y,tanks[b.owner]?tanks[b.owner].accent:'#fff');
        nx=b.x+b.vx;ny=b.y+b.vy;
      }
      b.x=nx;b.y=ny;
      for(var t=0;t<tanks.length;t++){
        if(t===b.owner) continue;
        var tk=tanks[t];
        if(tk.dead||tk.invulnT>0) continue;
        var ddx=b.x-tk.x,ddy=b.y-tk.y,cr=CFG.TANK_R+CFG.BULLET_R;
        if(ddx*ddx+ddy*ddy<cr*cr){
          tk.hp-=b.dmg;
          spawnParts(b.x,b.y,'#ff4444',10);
          shake={x:0,y:0,f:8,i:4};
          playSFX('hit');
          bullets.splice(i,1);
          if(tk.hp<=0){tk.hp=0;killTank(tk,t,b.owner);}
          updateHUD();break;
        }
      }
    }
  }

  function spawnRicochetSpark(x,y,color){
    // 6 small white/color sparks flying off the bounce point
    for(var i=0;i<6;i++){
      var a=Math.random()*Math.PI*2;
      var s=1.5+Math.random()*2.5;
      particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
                      life:12+Math.random()*10,max:22,
                      color:(i%2===0)?color:'#ffffff',r:1.5+Math.random()*1.5});
    }
    playSFX('ricochet');
  }

  function killTank(tk,ti,ki){
    tk.dead=true;tk.respawnT=CFG.RESPAWN;
    spawnParts(tk.x,tk.y,tk.accent,25);
    shake={x:0,y:0,f:16,i:8};
    playSFX('exp');
    if(ki!==undefined&&ki>=0)tanks[ki].kills++;
    if(tanks[ki]&&tanks[ki].kills>=killTarget)endGame(ki);
  }

  // ── Powerups ──────────────────────────────────────────────
  function spawnPow(){
    var type=['health','double'][Math.floor(Math.random()*2)];
    var px,py,tr=0;
    do{px=90+Math.random()*(CFG.W-180);py=90+Math.random()*(CFG.H-180);tr++;}
    while(obsAt(px,py,22)&&tr<20);
    powerups.push({x:px,y:py,type:type,life:CFG.POWERUP_LIFE,pulse:0});
  }
  function updatePowerups(){
    powerupTimer++;
    if(powerupTimer>=CFG.POWERUP_INT&&powerups.length<3){spawnPow();powerupTimer=0;}
    for(var i=powerups.length-1;i>=0;i--){
      var p=powerups[i];
      p.life--;p.pulse=(p.pulse+0.07)%(Math.PI*2);
      if(p.life<=0){powerups.splice(i,1);continue;}
      for(var t=0;t<tanks.length;t++){
        var tk=tanks[t];if(tk.dead)continue;
        var dx=tk.x-p.x,dy=tk.y-p.y,cr=CFG.TANK_R+18;
        if(dx*dx+dy*dy<cr*cr){
          if(p.type==='health')tk.hp=Math.min(CFG.TANK_HP,tk.hp+40);
          else tk.doubleDmg=200;
          spawnParts(p.x,p.y,p.type==='health'?'#00ff88':'#ffab00',8);
          playSFX('pickup');powerups.splice(i,1);updateHUD();break;
        }
      }
    }
  }

  // ── Respawn ───────────────────────────────────────────────
  function updateRespawn(){
    for(var t=0;t<tanks.length;t++){
      var tk=tanks[t];if(!tk.dead)continue;
      tk.respawnT--;
      if(tk.respawnT<=0){
        var sp=SPAWNS[t];
        tk.x=sp.x;tk.y=sp.y;tk.angle=sp.angle;
        tk.hp=CFG.TANK_HP;tk.dead=false;tk.invulnT=CFG.INVULN;
        updateHUD();
      }
    }
  }

  function spawnParts(x,y,color,n){
    for(var i=0;i<n;i++){
      var a=Math.random()*Math.PI*2,s=1+Math.random()*4;
      particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
                      life:30+Math.random()*30,max:60,color:color,r:2+Math.random()*4});
    }
  }

  // ── HUD ───────────────────────────────────────────────────
  function updateHUD(){
    var t0=tanks[0],t1=tanks[1];if(!t0||!t1)return;
    var e;
    e=document.getElementById('tanks-p1-hp');   if(e)e.style.width=Math.max(0,t0.hp)+'%';
    e=document.getElementById('tanks-p2-hp');   if(e)e.style.width=Math.max(0,t1.hp)+'%';
    e=document.getElementById('tanks-p1-hp-num');if(e)e.textContent=Math.max(0,t0.hp);
    e=document.getElementById('tanks-p2-hp-num');if(e)e.textContent=Math.max(0,t1.hp);
    e=document.getElementById('tanks-p1-kills');if(e)e.textContent=t0.kills;
    e=document.getElementById('tanks-p2-kills');if(e)e.textContent=t1.kills;
  }

  // ── End game ─────────────────────────────────────────────
  function endGame(wi){
    gameState='over';
    var el=document.getElementById('tanks-result');if(!el)return;
    var icon=document.getElementById('tanks-result-icon');
    var title=document.getElementById('tanks-result-title');
    var sub=document.getElementById('tanks-result-sub');
    if(icon)icon.textContent='🏆';
    if(title)title.textContent=isBot&&wi===1?'🤖 Bot Wins!':'Player '+(wi+1)+' Wins!';
    if(sub)sub.textContent=isBot?(wi===0?'VICTORY — You Dominated!':'Bot wins! Try a lower difficulty.'):'CLOSE CALL — Great duel!';
    el.classList.remove('hidden');
    if(typeof SoundManager!=='undefined'&&SoundManager.win)SoundManager.win();
  }

  // ── Physics ───────────────────────────────────────────────
  function physicsStep(){
    if(gameState!=='playing')return;
    moveTank(tanks[0],'p1');
    if(isBot){updateBot(tanks[1],tanks[0]);moveTank(tanks[1],'bot');}
    else{moveTank(tanks[1],'p2');}
    updateBullets();
    updatePowerups();
    updateRespawn();
  }

  // ── Draw ─────────────────────────────────────────────────
  function draw(){
    ctx.save();
    if(shake.f>0){shake.f--;shake.x=(Math.random()-0.5)*shake.i;shake.y=(Math.random()-0.5)*shake.i;}
    else{shake.x=0;shake.y=0;}
    ctx.translate(shake.x,shake.y);

    ctx.fillStyle='#0a0d1a';ctx.fillRect(0,0,CFG.W,CFG.H);

    // Grid
    ctx.strokeStyle='rgba(0,229,255,0.045)';ctx.lineWidth=1;
    for(var gx=0;gx<=CFG.W;gx+=40){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,CFG.H);ctx.stroke();}
    for(var gy=0;gy<=CFG.H;gy+=40){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(CFG.W,gy);ctx.stroke();}

    // Obstacles
    for(var i=0;i<OBS.length;i++){
      var o=OBS[i];
      ctx.fillStyle='#141a38';ctx.strokeStyle='rgba(0,180,255,0.28)';ctx.lineWidth=1.5;
      ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeRect(o.x,o.y,o.w,o.h);
    }

    // Spawn zone hints
    SPAWNS.forEach(function(sp,i){
      ctx.save();ctx.globalAlpha=0.07;
      ctx.strokeStyle=i===0?'#00e5ff':'#f50057';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(sp.x,sp.y,32,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    });

    // Powerups
    for(var i=0;i<powerups.length;i++){
      var p=powerups[i];
      ctx.save();ctx.translate(p.x,p.y);
      ctx.shadowBlur=12+Math.sin(p.pulse)*5;
      ctx.shadowColor=p.type==='health'?'#00ff88':'#ffab00';
      ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(p.type==='health'?'💊':'🔥',0,0);
      ctx.restore();
    }

    // Bullets
    for(var i=0;i<bullets.length;i++){
      var b=bullets[i];
      ctx.save();
      ctx.beginPath();ctx.arc(b.x,b.y,CFG.BULLET_R,0,Math.PI*2);
      ctx.fillStyle=b.owner===0?'#00e5ff':'#f50057';
      ctx.shadowBlur=10;ctx.shadowColor=ctx.fillStyle;
      ctx.fill();ctx.restore();
    }

    // Tanks
    for(var t=0;t<tanks.length;t++) drawTank(tanks[t]);

    // Particles
    for(var i=particles.length-1;i>=0;i--){
      var pt=particles[i];
      pt.x+=pt.vx;pt.y+=pt.vy;pt.vx*=0.91;pt.vy*=0.91;pt.life--;
      if(pt.life<=0){particles.splice(i,1);continue;}
      var al=pt.life/pt.max;
      ctx.save();ctx.globalAlpha=al;ctx.fillStyle=pt.color;
      ctx.shadowBlur=5;ctx.shadowColor=pt.color;
      ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r*al,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }

    // Respawn labels
    for(var t=0;t<tanks.length;t++){
      var tk=tanks[t];
      if(tk.dead&&tk.respawnT>0){
        var sp=SPAWNS[t];
        ctx.save();ctx.font='bold 14px Rajdhani,sans-serif';
        ctx.fillStyle=tk.accent;ctx.textAlign='center';
        ctx.fillText('Respawn '+Math.ceil(tk.respawnT/60)+'s',sp.x,sp.y-36);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawTank(tk){
    if(tk.dead)return;
    ctx.save();ctx.translate(tk.x,tk.y);
    if(tk.invulnT>0&&Math.floor(tk.invulnT/5)%2===0)ctx.globalAlpha=0.3;
    if(tk.doubleDmg>0){ctx.shadowBlur=18;ctx.shadowColor='#ffab00';}

    ctx.save();ctx.rotate(tk.angle);
    var r=CFG.TANK_R;
    // Track shadows
    ctx.fillStyle='rgba(0,0,0,0.45)';
    ctx.fillRect(-r,-r*0.85,r*2,r*0.35);
    ctx.fillRect(-r, r*0.5, r*2,r*0.35);
    // Hull
    ctx.beginPath();
    ctx.roundRect(-r*0.88,-r*0.65,r*1.76,r*1.3,4);
    ctx.fillStyle=tk.color;ctx.fill();
    ctx.strokeStyle=tk.accent;ctx.lineWidth=2;ctx.stroke();
    // Turret
    ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);
    ctx.fillStyle=tk.accent;ctx.fill();
    // Barrel
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(r+9,0);
    ctx.strokeStyle=tk.accent;ctx.lineWidth=4;ctx.lineCap='round';ctx.stroke();
    ctx.restore();

    // HP bar (screen-aligned)
    var bw=38,bh=5,bx=-19,by=-(r+13);
    ctx.fillStyle='#0d0f1c';ctx.fillRect(bx,by,bw,bh);
    var hpf=tk.hp/CFG.TANK_HP;
    ctx.fillStyle=hpf>0.5?'#00ff88':hpf>0.25?'#ffab00':'#ff1744';
    ctx.fillRect(bx,by,bw*hpf,bh);
    ctx.restore();
  }

  // ── Loop ─────────────────────────────────────────────────
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

  // ── Start game ────────────────────────────────────────────
  function startGame(botMode){
    isBot=botMode;
    // Pick a random map each game
    selectMap(Math.floor(Math.random()*MAPS.length));
    bullets=[];powerups=[];particles=[];
    powerupTimer=CFG.POWERUP_INT/2;
    inp={};bot.timer=0;
    tanks=[
      mkTank(SPAWNS[0],'#1a3a5c','#00e5ff','p1'),
      mkTank(SPAWNS[1],'#5c1a1a','#f50057',isBot?'bot':'p2')
    ];
    var home=document.getElementById('tanks-home');
    var play=document.getElementById('tanks-play-panel');
    var res=document.getElementById('tanks-result');
    if(home)home.classList.add('hidden');
    if(play){play.classList.remove('hidden');play.style.display='flex';}
    if(res)res.classList.add('hidden');
    // Show current map name
    var mapLabel=document.getElementById('tanks-map-label');
    if(mapLabel)mapLabel.textContent='Map: '+MAPS[currentMapIdx].name;
    buildMobileControls(isBot);
    gameState='playing';
    updateHUD();
    if(!raf){lastTime=performance.now();raf=requestAnimationFrame(loop);}
  }

  function backToSetup(){
    gameState='home';inp={};
    if(mobileDiv)mobileDiv.innerHTML='';
    var home=document.getElementById('tanks-home');
    var play=document.getElementById('tanks-play-panel');
    var res=document.getElementById('tanks-result');
    if(play){play.classList.add('hidden');play.style.display='none';}
    if(res)res.classList.add('hidden');
    if(home)home.classList.remove('hidden');
  }

  // ── Mobile virtual controls ───────────────────────────────
  /*
   * Renders on-screen D-pad + FIRE buttons.
   * Uses Pointer Events (works for touch + mouse + stylus).
   * Each button calls inp[key]=true on pointerdown,
   * inp[key]=false on pointerup/leave/cancel.
   */
  function buildMobileControls(botMode){
    if(!mobileDiv)return;
    mobileDiv.innerHTML='';
    mobileDiv.style.cssText=
      'display:flex;justify-content:center;gap:16px;'
      +'padding:12px 8px;flex-wrap:wrap;'
      +'user-select:none;-webkit-user-select:none;touch-action:none;';
    if(botMode){
      mobileDiv.appendChild(mkControlSet('🔵 P1','p1','#00e5ff'));
    } else {
      mobileDiv.appendChild(mkControlSet('🔵 P1','p1','#00e5ff'));
      // Spacer
      var sp=document.createElement('div');sp.style.flex='1 1 16px';
      mobileDiv.appendChild(sp);
      mobileDiv.appendChild(mkControlSet('🔴 P2','p2','#f50057'));
    }
  }

  function mkControlSet(label,prefix,color){
    var wrap=document.createElement('div');
    wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px;';

    var lbl=document.createElement('div');
    lbl.textContent=label;
    lbl.style.cssText='font-family:Orbitron,sans-serif;font-size:10px;color:'+color
      +';letter-spacing:2px;text-shadow:0 0 8px '+color+'80;';
    wrap.appendChild(lbl);

    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:10px;';

    // D-pad (3x3 CSS grid, 5 cells used)
    var dpad=document.createElement('div');
    dpad.style.cssText=
      'display:grid;grid-template-columns:repeat(3,46px);'
      +'grid-template-rows:repeat(3,46px);gap:3px;';

    [{r:1,c:2,d:'up',   icon:'▲'},
     {r:2,c:1,d:'left', icon:'◀'},
     {r:2,c:3,d:'right',icon:'▶'},
     {r:3,c:2,d:'down', icon:'▼'}
    ].forEach(function(cfg){
      var btn=mkVBtn(cfg.icon,color,false);
      btn.style.gridRow=cfg.r+'';btn.style.gridColumn=cfg.c+'';
      attachHold(btn,prefix+'_'+cfg.d);
      dpad.appendChild(btn);
    });

    var fire=mkVBtn('💥',color,true);
    fire.style.cssText+=';width:62px;height:62px;font-size:26px;'
      +'border-radius:50%;background:rgba(255,255,255,0.07);';
    attachHold(fire,prefix+'_fire');

    row.appendChild(dpad);
    row.appendChild(fire);
    wrap.appendChild(row);
    return wrap;
  }

  function mkVBtn(icon,color,big){
    var b=document.createElement('button');
    b.textContent=icon;
    b.style.cssText=
      'width:46px;height:46px;border-radius:8px;'
      +'background:rgba(255,255,255,0.06);'
      +'border:1.5px solid '+color+'50;color:'+color+';'
      +'font-size:18px;display:flex;align-items:center;'
      +'justify-content:center;cursor:pointer;'
      +'-webkit-tap-highlight-color:transparent;'
      +'touch-action:none;user-select:none;'
      +'transition:background 0.08s,transform 0.08s;'
      +'box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    b.addEventListener('contextmenu',function(e){e.preventDefault();});
    return b;
  }

  function attachHold(btn,key){
    function press(e){
      e.preventDefault();
      inp[key]=true;
      btn.style.background='rgba(255,255,255,0.22)';
      btn.style.transform='scale(0.92)';
    }
    function release(e){
      e.preventDefault();
      inp[key]=false;
      btn.style.background='rgba(255,255,255,0.06)';
      btn.style.transform='scale(1)';
    }
    btn.addEventListener('pointerdown', press,   {passive:false});
    btn.addEventListener('pointerup',   release, {passive:false});
    btn.addEventListener('pointerleave',release, {passive:false});
    btn.addEventListener('pointercancel',release,{passive:false});
  }

  // ── Canvas resize ─────────────────────────────────────────
  function resizeCanvas(){
    if(!canvas)return;
    var maxW=Math.min(window.innerWidth-16,CFG.W);
    var scale=maxW/CFG.W;
    canvas.style.width=Math.round(CFG.W*scale)+'px';
    canvas.style.height=Math.round(CFG.H*scale)+'px';
  }

  // ── tanksInit ─────────────────────────────────────────────
  window.tanksInit=function(){
    canvas=document.getElementById('tanks-canvas');
    if(!canvas)return;
    canvas.width=CFG.W;canvas.height=CFG.H;
    ctx=canvas.getContext('2d');
    mobileDiv=document.getElementById('tanks-mobile-controls');
    resizeCanvas();

    var ad=document.querySelector('.tanks-diff-btn.active');
    var ak=document.querySelector('.tanks-kills-btn.active');
    botDiff=ad?ad.getAttribute('data-diff'):'medium';
    killTarget=ak?+ak.getAttribute('data-kills'):5;

    gameState='home';inp={};
    var home=document.getElementById('tanks-home');
    var play=document.getElementById('tanks-play-panel');
    if(home)home.classList.remove('hidden');
    if(play){play.classList.add('hidden');play.style.display='none';}

    if (!window._tanksWired) {
      document.addEventListener('keydown', onKey, false);
      document.addEventListener('keyup',   onKey, false);
      window.addEventListener('resize', resizeCanvas);
      window._tanksWired = true;
    }

    document.querySelectorAll('.tanks-diff-btn').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.tanks-diff-btn').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');botDiff=b.getAttribute('data-diff');
      });
    });
    document.querySelectorAll('.tanks-kills-btn').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.tanks-kills-btn').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');killTarget=+b.getAttribute('data-kills');
      });
    });

    var sPvp=document.getElementById('tanks-start-pvp');
    var sBot=document.getElementById('tanks-start-bot');
    if(sPvp)sPvp.onclick=function(){startGame(false);};
    if(sBot)sBot.onclick=function(){startGame(true);};

    var bHub=document.getElementById('tanks-back-hub');
    if(bHub)bHub.onclick=function(){tanksDestroy();showHub();};
    var bSet=document.getElementById('tanks-back-setup');
    if(bSet)bSet.onclick=backToSetup;
    var bPA=document.getElementById('tanks-play-again');
    if(bPA)bPA.onclick=function(){startGame(isBot);};
    var bTS=document.getElementById('tanks-to-setup');
    if(bTS)bTS.onclick=backToSetup;

    if(!raf){lastTime=performance.now();raf=requestAnimationFrame(loop);}
  };

  window.tanksDestroy=function(){
    if(raf){cancelAnimationFrame(raf);raf=null;}
    gameState='home';inp={};
    document.removeEventListener('keydown',onKey);
    document.removeEventListener('keyup',  onKey);
    window.removeEventListener('resize',resizeCanvas);
    window._tanksWired = false;
    if(mobileDiv)mobileDiv.innerHTML='';
  };

  // ── Keyboard map ──────────────────────────────────────────
  var KEY_MAP={
    'w':'p1_up','W':'p1_up','s':'p1_down','S':'p1_down',
    'a':'p1_left','A':'p1_left','d':'p1_right','D':'p1_right',' ':'p1_fire',
    'ArrowUp':'p2_up','ArrowDown':'p2_down',
    'ArrowLeft':'p2_left','ArrowRight':'p2_right','Enter':'p2_fire'
  };
  function onKey(e){
    var scr=document.getElementById('screen-tanks');
    if(!scr||scr.classList.contains('hidden'))return;
    var mapped=KEY_MAP[e.key];
    if(mapped){
      inp[mapped]=(e.type==='keydown');
      if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key)>=0)
        e.preventDefault();
    }
  }

  // ── SFX ───────────────────────────────────────────────────
  function playSFX(type){
    if(typeof SoundManager==='undefined'||SoundManager.isMuted())return;
    try{
      var AC=window.AudioContext||window.webkitAudioContext;
      var c=new AC();
      if(type==='shoot'){
        var o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);
        o.type='square';o.frequency.value=860;
        g.gain.setValueAtTime(0.08,c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.07);
        o.start();o.stop(c.currentTime+0.08);
      }else if(type==='hit'||type==='exp'){
        var len=type==='exp'?0.35:0.12;
        var buf=c.createBuffer(1,c.sampleRate*len,c.sampleRate);
        var d=buf.getChannelData(0);
        var decay=type==='exp'?5:12;
        for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/d.length*decay);
        var src=c.createBufferSource();src.buffer=buf;
        var flt=c.createBiquadFilter();flt.type='lowpass';flt.frequency.value=type==='exp'?400:700;
        var gg=c.createGain();gg.gain.value=type==='exp'?0.5:0.22;
        src.connect(flt);flt.connect(gg);gg.connect(c.destination);src.start();
      }else if(type==='pickup'){
        var o2=c.createOscillator(),g2=c.createGain();
        o2.connect(g2);g2.connect(c.destination);
        o2.type='sine';o2.frequency.setValueAtTime(600,c.currentTime);
        o2.frequency.exponentialRampToValueAtTime(1200,c.currentTime+0.15);
        g2.gain.setValueAtTime(0.1,c.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.18);
        o2.start();o2.stop(c.currentTime+0.19);
      }else if(type==='ricochet'){
        // Short metallic ping
        var o3=c.createOscillator(),g3=c.createGain();
        o3.connect(g3);g3.connect(c.destination);
        o3.type='triangle';o3.frequency.setValueAtTime(1800,c.currentTime);
        o3.frequency.exponentialRampToValueAtTime(600,c.currentTime+0.06);
        g3.gain.setValueAtTime(0.07,c.currentTime);
        g3.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08);
        o3.start();o3.stop(c.currentTime+0.09);
      }
    }catch(err){}
  }

})();
