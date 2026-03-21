/* ═══════════════════════════════════════════════════════════════
   DuelZone · Carrom  (carrom.js)  v4
   Pixel-perfect real carrom board · PvP + Solo · Correct scoring
   ─────────────────────────────────────────────────────────────
   SCORING: Black=1 pt · White=2 pts · Queen=5 pts
   Rules:   Pocket any coin → your points + bonus turn
            Miss → switch turns
            Striker pocketed → foul: −1 pt, turn lost
            Queen alone pocketed → returns to center (must cover)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $  = id  => document.getElementById(id);
  const qA = sel => document.querySelectorAll(sel);

  /* ══════════════════════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════════════════════ */
  function showScreen(id) {
    qA('[id^="screen-"]').forEach(s => s.classList.toggle('hidden', s.id !== id));
    window.scrollTo(0, 0);
  }

  document.querySelector('[data-screen="carrom"]')
    ?.addEventListener('click', () => {
      if(typeof window.showCarrom === 'function') { window.showCarrom(); return; }
      showScreen('screen-carrom');
      $('carrom-home').classList.remove('hidden');
      $('carrom-play').classList.add('hidden');
    });

  $('carrom-back-hub').addEventListener('click', () => {
    if(typeof window.showHub==='function') window.showHub(); else showScreen('screen-hub');
  });
  $('carrom-back-play').addEventListener('click', () => {
    stopGame();
    window.scrollTo(0, 0);
    var backBtn = $('carrom-back-play'); if (backBtn) backBtn.style.display = 'none';
    $('carrom-play').classList.add('hidden');
    $('carrom-home').classList.remove('hidden');
  });
  $('carrom-again').addEventListener('click', () => {
    $('carrom-result').classList.add('hidden');
    startGame();
  });
  $('carrom-result-hub').addEventListener('click', () => {
    stopGame();
    window.scrollTo(0, 0);
    var backBtn = $('carrom-back-play'); if (backBtn) backBtn.style.display = 'none';
    $('carrom-result').classList.add('hidden');
    $('carrom-play').classList.add('hidden');
    $('carrom-home').classList.remove('hidden');
    if(typeof window.showHub==='function') window.showHub(); else showScreen('screen-hub');
  });

  let gameMode = 'solo';
  qA('.carrom-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      qA('.carrom-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameMode = btn.dataset.cmode;
      $('carrom-diff-wrap').style.display = gameMode === 'pvp' ? 'none' : '';
    });
  });

  let difficulty = 'medium';
  qA('.carrom-diff').forEach(btn => {
    btn.addEventListener('click', () => {
      qA('.carrom-diff').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.diff;
    });
  });

  $('carrom-start-btn').addEventListener('click', () => {
    window.scrollTo(0, 0);
    $('carrom-home').classList.add('hidden');
    var playEl = $('carrom-play');
    if (playEl) { playEl.classList.remove('hidden'); playEl.scrollTop = 0; }
    var backBtn = $('carrom-back-play'); if (backBtn) backBtn.style.display = 'block';
    startGame();
  });

  /* ══════════════════════════════════════════════════════════
     CONSTANTS  (all in logical units 0–480)
  ══════════════════════════════════════════════════════════ */
  const L   = 480;
  const BDR = 48;          // black frame width
  const PF  = BDR;         // playfield start
  const PF2 = L - BDR;     // playfield end
  const PFS = PF2 - PF;    // playfield size (384)
  const CX  = L / 2;       // 240
  const CY  = L / 2;       // 240

  /* Inner rectangle — inset ~11.5% from playfield edge */
  const IR_INSET = 44;
  const IR  = PF  + IR_INSET;   // 92
  const IR2 = PF2 - IR_INSET;   // 388
  const IRS = IR2 - IR;         // 296

  /* Radii */
  const R_COIN    = 11.5;
  const R_STRIKER = 17;
  const R_POCKET  = 20;    // physics capture radius

  /* Striker baselines */
  const BASE_Y  = [PF2 - R_STRIKER - 3, PF + R_STRIKER + 3];
  const BASE_XL = CX - 72;
  const BASE_XR = CX + 72;

  /* Pocket positions — outer corners of playfield */
  const POCKETS = [
    { x:PF,  y:PF  }, { x:PF2, y:PF  },
    { x:PF,  y:PF2 }, { x:PF2, y:PF2 },
  ];

  /* Physics */
  const FRICTION    = 0.979;
  const RESTITUTION = 0.82;
  const WALL_DAMP   = 0.68;
  const STOP_VEL    = 0.10;

  /* Scoring */
  const PTS = { white:2, black:1, queen:5 };

  /* ══════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════ */
  let canvas, ctx, scale = 1, boardCache = null;
  let SK = { x:CX, y:CY, vx:0, vy:0 };
  let coins = [];
  let curPlayer = 0;
  let players = [
    { label:'P1',  isHuman:true,  score:0 },
    { label:'P2',  isHuman:false, score:0 },
  ];
  let wasMoving=false, gameOver=false;
  let pocketedThisTurn=0, queenPocketed=false, strikerFoul=false;
  let dragging=false, dragPos={x:0,y:0};
  let timerSec=120, timerInterval=null;
  let rafId=null, lastTs=-1, aiTimer=null;

  /* ══════════════════════════════════════════════════════════
     CANVAS SETUP
  ══════════════════════════════════════════════════════════ */
  function setupCanvas() {
    const old = $('carrom-canvas');
    const fr  = old.cloneNode(false);
    old.parentNode.replaceChild(fr, old);
    canvas = fr; ctx = canvas.getContext('2d');

    const wrap = $('carrom-canvas-wrap');
    const W = wrap.clientWidth || window.innerWidth;
    const H = window.innerHeight - 165;
    const sz = Math.max(240, Math.min(W - 6, H, 520));

    canvas.width = canvas.height = sz;
    scale = sz / L;
    canvas.style.cssText =
      'border-radius:8px;touch-action:none;max-width:100%;display:block;cursor:crosshair;' +
      'box-shadow:0 12px 50px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.04);';

    canvas.addEventListener('pointerdown', evDown);
    canvas.addEventListener('pointermove', evMove);
    canvas.addEventListener('pointerup',   evUp);
    canvas.addEventListener('pointercancel', evUp);

    boardCache = buildBoard(sz, scale);
  }

  /* ══════════════════════════════════════════════════════════
     BUILD STATIC BOARD — rendered once, blit every frame
     Faithfully replicates the Vigour Sports reference image:
       • Thick matte-black frame
       • Cream / pale-ivory playing surface with faint grain
       • Thick outer black border rect
       • Thinner inner black border rect
       • Large 3-D red sphere pockets at 4 outer corners
       • Small red guide circles at midpoints of inner rect sides
       • Double diagonal lines from each outer corner → inner corner
       • Curved-arrow decorations at each inner corner
       • Striker baselines (horizontal lines) with end-dot circles
       • 8-pointed compass star with thick red ring at board centre
  ══════════════════════════════════════════════════════════ */
  function buildBoard(sz, s) {
    const oc = document.createElement('canvas');
    oc.width = oc.height = sz;
    const c  = oc.getContext('2d');

    /* pixel shortcuts */
    const pf   = PF  * s,  pf2  = PF2 * s,  pfs = PFS * s;
    const ir   = IR  * s,  ir2  = IR2 * s,  irs = IRS * s;
    const cx   = CX  * s,  cy   = CY  * s;

    /* ── 1. MATTE BLACK FRAME ── */
    c.fillStyle = '#111111';
    rr(c, 0, 0, sz, sz, 9*s); c.fill();
    /* subtle inner edge highlight */
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.lineWidth   = s;
    rr(c, 1.5*s, 1.5*s, sz-3*s, sz-3*s, 8*s); c.stroke();

    /* ── 2. CREAM PLAYING SURFACE ── */
    const bg = c.createRadialGradient(cx-20*s, cy-20*s, 5*s, cx, cy, sz*0.68);
    bg.addColorStop(0,    '#faf6e8');
    bg.addColorStop(0.4,  '#f4ecce');
    bg.addColorStop(0.75, '#ece0b8');
    bg.addColorStop(1,    '#dfd0a0');
    c.fillStyle = bg;
    c.fillRect(pf, pf, pfs, pfs);

    /* faint wood grain */
    c.save();
    c.globalAlpha = 0.02;
    c.strokeStyle = '#7a5518';
    c.lineWidth   = 0.8*s;
    for (let i = -pfs; i < pfs*1.5; i += 5.5*s) {
      c.beginPath();
      c.moveTo(pf+i, pf);
      c.lineTo(pf+i+pfs*0.12, pf+pfs);
      c.stroke();
    }
    c.restore();

    /* ── 3. OUTER BORDER RECT (thick black) ── */
    c.strokeStyle = '#111111';
    c.lineWidth   = 4.5*s;
    c.strokeRect(pf+2.5*s, pf+2.5*s, pfs-5*s, pfs-5*s);

    /* ── 4. INNER BORDER RECT (thinner black) ── */
    c.strokeStyle = '#111111';
    c.lineWidth   = 2*s;
    c.strokeRect(ir, ir, irs, irs);

    /* ── 5. DOUBLE DIAGONAL LINES from each outer corner ──
       Two parallel lines side-by-side, going from the outer
       corner of the playfield to the corresponding inner corner.
       Offset perpendicularly so they're clearly two separate lines.
    ── */
    c.strokeStyle = '#111111';
    c.lineWidth   = 1.7*s;
    const dOff = 4.5*s;
    const sq2  = Math.SQRT2;
    // For each corner: outer pt, inner pt, perpendicular direction
    [
      { ox:pf,  oy:pf,  ix:ir,  iy:ir,  px: 1/sq2, py:-1/sq2 },
      { ox:pf2, oy:pf,  ix:ir2, iy:ir,  px: 1/sq2, py: 1/sq2 },
      { ox:pf,  oy:pf2, ix:ir,  iy:ir2, px:-1/sq2, py:-1/sq2 },
      { ox:pf2, oy:pf2, ix:ir2, iy:ir2, px:-1/sq2, py: 1/sq2 },
    ].forEach(({ox,oy,ix,iy,px,py}) => {
      [dOff, -dOff].forEach(d => {
        c.beginPath();
        c.moveTo(ox + px*d, oy + py*d);
        c.lineTo(ix + px*d, iy + py*d);
        c.stroke();
      });
    });

    /* ── 6. CURVED-ARROW DECORATIONS at inner corners ──
       Each inner corner has a small arc (quarter-circle)
       with an arrowhead at the end, sweeping toward board centre.
       This exactly matches the reference image's ↙↗ style marks.
    ── */
    const arcR   = 22*s;   // arc radius
    const arcPiv = 24*s;   // pivot offset from inner corner
    c.strokeStyle = '#111111';
    c.lineWidth   = 1.8*s;
    c.fillStyle   = '#111111';

    [
      { cx:ir +arcPiv, cy:ir +arcPiv, a1:Math.PI,      a2:Math.PI*3/2 },  // TL
      { cx:ir2-arcPiv, cy:ir +arcPiv, a1:Math.PI*3/2,  a2:Math.PI*2   },  // TR
      { cx:ir +arcPiv, cy:ir2-arcPiv, a1:Math.PI/2,    a2:Math.PI     },  // BL
      { cx:ir2-arcPiv, cy:ir2-arcPiv, a1:0,            a2:Math.PI/2   },  // BR
    ].forEach(({cx:pcx, cy:pcy, a1, a2}) => {
      c.beginPath(); c.arc(pcx, pcy, arcR, a1, a2); c.stroke();
      /* arrowhead at a2 end */
      const ex  = pcx + Math.cos(a2)*arcR;
      const ey  = pcy + Math.sin(a2)*arcR;
      const tx  = -Math.sin(a2);   // tangent direction
      const ty  =  Math.cos(a2);
      const hs  = 6.5*s, hw = 2.8*s;
      c.beginPath();
      c.moveTo(ex, ey);
      c.lineTo(ex - tx*hs - ty*hw, ey - ty*hs + tx*hw);
      c.lineTo(ex - tx*hs + ty*hw, ey - ty*hs - tx*hw);
      c.closePath(); c.fill();
    });

    /* ── 7. STRIKER BASELINES (horizontal lines near inner rect edges)
       Standard board has a line parallel to the inner rect edge
       with a small filled circle at each end.
    ── */
    const bxL = BASE_XL * s;
    const bxR = BASE_XR * s;
    /* Lines sit just inside the inner rectangle */
    const blY = [(IR2 - 11)*s, (IR + 11)*s];

    blY.forEach(by => {
      c.strokeStyle = '#111111'; c.lineWidth = 1.8*s;
      c.beginPath(); c.moveTo(bxL, by); c.lineTo(bxR, by); c.stroke();
      [bxL, bxR].forEach(bx => {
        c.beginPath(); c.arc(bx, by, 5*s, 0, Math.PI*2);
        c.fillStyle='#111111'; c.fill();
      });
    });

    /* ── 8. SMALL RED CIRCLES on inner rect sides ──
       At the midpoint of each side of the inner rectangle.
       These are the circular guide marks visible in the reference.
    ── */
    const smR = 7*s;
    [
      {x:cx,   y:ir  }, {x:cx,   y:ir2 },
      {x:ir,   y:cy  }, {x:ir2,  y:cy  },
    ].forEach(({x,y}) => {
      const g2 = c.createRadialGradient(x-smR*0.3, y-smR*0.3, smR*0.04, x, y, smR);
      g2.addColorStop(0, '#ff4444'); g2.addColorStop(0.55,'#cc0000'); g2.addColorStop(1,'#880000');
      c.beginPath(); c.arc(x, y, smR, 0, Math.PI*2);
      c.fillStyle=g2; c.fill();
      c.strokeStyle='#440000'; c.lineWidth=0.8*s; c.stroke();
      c.beginPath(); c.arc(x-smR*0.3, y-smR*0.3, smR*0.28, 0, Math.PI*2);
      c.fillStyle='rgba(255,255,255,0.42)'; c.fill();
    });

    /* ── 9. CENTRE COMPASS STAR ──
       Thick red outer ring → thin black ring → 8-pointed star
       (alternating black / dark-red spokes) → small red centre circle.
       Matches the Vigour Sports reference exactly.
    ── */
    const outerRing = 71*s;
    const innerRing = 65*s;
    const tipR      = 59*s;   // spike tip distance
    const baseR     = 19*s;   // spike base width radius
    const centR     = 15*s;   // centre filled circle

    /* outer red ring */
    c.beginPath(); c.arc(cx, cy, outerRing, 0, Math.PI*2);
    c.strokeStyle='#cc0f0f'; c.lineWidth=6*s; c.stroke();

    /* thin black ring */
    c.beginPath(); c.arc(cx, cy, innerRing, 0, Math.PI*2);
    c.strokeStyle='#111111'; c.lineWidth=1.5*s; c.stroke();

    /* 8 spokes */
    for (let i=0; i<8; i++) {
      const mid  = (i/8)*Math.PI*2 - Math.PI/2;
      const left = mid - Math.PI/8;
      const rgt  = mid + Math.PI/8;
      c.beginPath();
      c.moveTo(cx + Math.cos(mid)*tipR,  cy + Math.sin(mid)*tipR);
      c.lineTo(cx + Math.cos(left)*baseR, cy + Math.sin(left)*baseR);
      c.lineTo(cx + Math.cos(rgt)*baseR,  cy + Math.sin(rgt)*baseR);
      c.closePath();
      c.fillStyle = i%2===0 ? '#1a1a1a' : '#b80a0a';
      c.fill();
      c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=0.5*s; c.stroke();
    }

    /* centre circle */
    const cg = c.createRadialGradient(cx-centR*0.28, cy-centR*0.28, centR*0.04, cx, cy, centR);
    cg.addColorStop(0,'#ff5555'); cg.addColorStop(0.5,'#cc0000'); cg.addColorStop(1,'#770000');
    c.beginPath(); c.arc(cx, cy, centR, 0, Math.PI*2);
    c.fillStyle=cg; c.fill();
    c.strokeStyle='#440000'; c.lineWidth=s; c.stroke();
    c.beginPath(); c.arc(cx-centR*0.3, cy-centR*0.3, centR*0.28, 0, Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.38)'; c.fill();

    /* ── 10. LARGE 3-D RED POCKET BALLS at outer corners ──
       These are the most distinctive element of a real carrom board.
       Rendered as glossy 3-D spheres with strong radial gradient.
    ── */
    const ballR = (R_POCKET + 7)*s;

    POCKETS.forEach(p => {
      const px = p.x*s, py = p.y*s;

      /* drop shadow */
      c.save();
      c.shadowColor='rgba(0,0,0,0.6)';
      c.shadowBlur=10*s; c.shadowOffsetX=2.5*s; c.shadowOffsetY=3*s;

      const rg = c.createRadialGradient(
        px - ballR*0.38, py - ballR*0.38, ballR*0.02,
        px, py, ballR
      );
      rg.addColorStop(0,    '#ff7070');
      rg.addColorStop(0.22, '#ee2020');
      rg.addColorStop(0.55, '#bb0000');
      rg.addColorStop(0.82, '#880000');
      rg.addColorStop(1,    '#3a0000');

      c.beginPath(); c.arc(px, py, ballR, 0, Math.PI*2);
      c.fillStyle=rg; c.fill();
      c.restore();

      /* rim */
      c.strokeStyle='#2a0000'; c.lineWidth=s;
      c.beginPath(); c.arc(px, py, ballR, 0, Math.PI*2); c.stroke();

      /* main highlight */
      c.beginPath(); c.arc(px-ballR*0.34, py-ballR*0.34, ballR*0.3, 0, Math.PI*2);
      c.fillStyle='rgba(255,255,255,0.52)'; c.fill();

      /* small secondary glint */
      c.beginPath(); c.arc(px-ballR*0.5, py-ballR*0.46, ballR*0.1, 0, Math.PI*2);
      c.fillStyle='rgba(255,255,255,0.82)'; c.fill();
    });

    /* ── 11. Point legend in bottom frame ── */
    c.fillStyle    = 'rgba(255,255,255,0.48)';
    c.font         = `bold ${8*s}px 'DM Mono',monospace`;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillText('⚫ 1pt  ⚪ 2pts  👑 5pts', cx, (PF2 + (L-PF2)*0.46)*s);

    return oc;
  }

  /* ══════════════════════════════════════════════════════════
     PIECE LAYOUT  19 pieces: 1 queen + 9 white + 9 black
  ══════════════════════════════════════════════════════════ */
  function initPieces() {
    coins = [];
    coins.push(mk(CX, CY, 'queen'));
    for (let i=0;i<6;i++) {
      const a=(Math.PI*2*i/6)+Math.PI/6;
      coins.push(mk(CX+Math.cos(a)*29, CY+Math.sin(a)*29, i%2===0?'white':'black'));
    }
    for (let i=0;i<12;i++) {
      const a=(Math.PI*2*i/12)+Math.PI/12;
      coins.push(mk(CX+Math.cos(a)*61, CY+Math.sin(a)*61, i%2===0?'white':'black'));
    }
  }
  function mk(x,y,type){return{x,y,vx:0,vy:0,type,pocketed:false};}
  function placeStriker(p){SK.x=CX; SK.y=BASE_Y[p]; SK.vx=0; SK.vy=0;}

  /* ══════════════════════════════════════════════════════════
     GAME LIFECYCLE
  ══════════════════════════════════════════════════════════ */
  function startGame() {
    stopGame(); setupCanvas(); initPieces();
    players = gameMode==='pvp'
      ? [{label:'P1',isHuman:true,score:0},{label:'P2',isHuman:true,score:0}]
      : [{label:'YOU',isHuman:true,score:0},{label:'BOT',isHuman:false,score:0}];
    curPlayer=0; wasMoving=false; gameOver=false;
    pocketedThisTurn=0; queenPocketed=false; strikerFoul=false;
    dragging=false; timerSec=120; lastTs=-1;
    placeStriker(0); updateHudLabels(); updateHUD(); updateTurnLabel();
    startTimer(); rafId=requestAnimationFrame(loop);
  }

  function stopGame() {
    if(rafId){cancelAnimationFrame(rafId);rafId=null;}
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    if(aiTimer){clearTimeout(aiTimer);aiTimer=null;}
    dragging=false;
  }

  /* ══════════════════════════════════════════════════════════
     MAIN LOOP
  ══════════════════════════════════════════════════════════ */
  function loop(ts) {
    if(lastTs<0){lastTs=ts; rafId=requestAnimationFrame(loop); return;}
    const dt=Math.min(Math.max((ts-lastTs)/16.667,0.05),2.5);
    lastTs=ts; update(dt); draw();
    if(!gameOver) rafId=requestAnimationFrame(loop);
  }

  /* ══════════════════════════════════════════════════════════
     PHYSICS
  ══════════════════════════════════════════════════════════ */
  function update(dt) {
    if(gameOver) return;
    integrate(SK, R_STRIKER, dt);
    for(const c of coins) if(!c.pocketed) integrate(c, R_COIN, dt);

    for(let i=0;i<coins.length;i++){
      if(coins[i].pocketed) continue;
      for(let j=i+1;j<coins.length;j++)
        if(!coins[j].pocketed) hit(coins[i],coins[j],R_COIN,R_COIN);
    }
    for(const c of coins) if(!c.pocketed) hit(SK,c,R_STRIKER,R_COIN);

    for(const c of coins){
      if(c.pocketed) continue;
      for(const p of POCKETS){
        const dx=c.x-p.x,dy=c.y-p.y;
        if(dx*dx+dy*dy<R_POCKET*R_POCKET){potCoin(c);break;}
      }
    }

    if(!strikerFoul){
      for(const p of POCKETS){
        const dx=SK.x-p.x,dy=SK.y-p.y;
        if(dx*dx+dy*dy<(R_POCKET*0.9)*(R_POCKET*0.9)){
          strikerFoul=true; SK.vx=0; SK.vy=0; SK.x=-999; SK.y=-999; break;
        }
      }
    }

    const moving=objM(SK)||coins.some(c=>!c.pocketed&&objM(c));
    if(wasMoving&&!moving){wasMoving=false; endTurn();}
    else if(moving) wasMoving=true;
  }

  function integrate(o,r,dt){
    if(o.vx===0&&o.vy===0) return;
    o.x+=o.vx*dt; o.y+=o.vy*dt;
    o.vx*=Math.pow(FRICTION,dt); o.vy*=Math.pow(FRICTION,dt);
    wall(o,r);
    if(Math.hypot(o.vx,o.vy)<STOP_VEL){o.vx=0;o.vy=0;}
  }

  function wall(o,r){
    const lo=PF+r,hi=PF2-r;
    if(o.x<lo){o.x=lo;o.vx= Math.abs(o.vx)*WALL_DAMP;}
    if(o.x>hi){o.x=hi;o.vx=-Math.abs(o.vx)*WALL_DAMP;}
    if(o.y<lo){o.y=lo;o.vy= Math.abs(o.vy)*WALL_DAMP;}
    if(o.y>hi){o.y=hi;o.vy=-Math.abs(o.vy)*WALL_DAMP;}
  }

  function hit(a,b,ra,rb){
    const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy,md=ra+rb;
    if(d2>=md*md||d2<0.001) return;
    const d=Math.sqrt(d2),nx=dx/d,ny=dy/d;
    const ma=ra*ra,mb=rb*rb,mt=ma+mb,ov=md-d;
    a.x-=nx*ov*(mb/mt); a.y-=ny*ov*(mb/mt);
    b.x+=nx*ov*(ma/mt); b.y+=ny*ov*(ma/mt);
    const rv=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(rv<=0) return;
    const j=(1+RESTITUTION)*rv/(1/ma+1/mb);
    a.vx-=(j/ma)*nx; a.vy-=(j/ma)*ny;
    b.vx+=(j/mb)*nx; b.vy+=(j/mb)*ny;
  }
  function objM(o){return Math.hypot(o.vx,o.vy)>=STOP_VEL;}

  /* ══════════════════════════════════════════════════════════
     SCORING
  ══════════════════════════════════════════════════════════ */
  function potCoin(c){
    c.pocketed=true; c.vx=0; c.vy=0;
    if(c.type==='queen'){
      queenPocketed=true;
    } else {
      players[curPlayer].score+=PTS[c.type];
      pocketedThisTurn++;
      if(queenPocketed){players[curPlayer].score+=PTS.queen; queenPocketed=false;}
    }
    updateHUD();
    if(coins.every(c=>c.pocketed)) endGame();
  }

  /* ══════════════════════════════════════════════════════════
     TURN MANAGEMENT
  ══════════════════════════════════════════════════════════ */
  function endTurn(){
    if(gameOver) return;
    dragging=false;

    if(strikerFoul){
      strikerFoul=false;
      players[curPlayer].score=Math.max(0,players[curPlayer].score-1);
      if(queenPocketed){
        queenPocketed=false;
        const q=coins.find(c=>c.type==='queen'&&c.pocketed);
        if(q){q.pocketed=false;q.x=CX;q.y=CY;q.vx=0;q.vy=0;}
      }
      pocketedThisTurn=0; updateHUD();
      setTurnLabel('💥 FOUL! −1 pt');
      setTimeout(()=>switchTurn(), 900); return;
    }

    if(queenPocketed){
      queenPocketed=false;
      const q=coins.find(c=>c.type==='queen'&&c.pocketed);
      if(q){q.pocketed=false;q.x=CX;q.y=CY;q.vx=0;q.vy=0;}
    }

    if(pocketedThisTurn>0){
      pocketedThisTurn=0; placeStriker(curPlayer);
      setTurnLabel(`🎯 BONUS — ${players[curPlayer].label}!`);
      setTimeout(()=>{
        if(gameOver) return; updateTurnLabel();
        if(!players[curPlayer].isHuman) aiTimer=setTimeout(aiShot,700);
      }, 700);
    } else {
      pocketedThisTurn=0; switchTurn();
    }
  }

  function switchTurn(){
    curPlayer=1-curPlayer; pocketedThisTurn=0;
    placeStriker(curPlayer); updateHUD(); updateTurnLabel();
    if(!players[curPlayer].isHuman){
      const d={easy:1200,medium:800,hard:400}[difficulty]||800;
      aiTimer=setTimeout(aiShot,d);
    }
  }

  /* ══════════════════════════════════════════════════════════
     INPUT
  ══════════════════════════════════════════════════════════ */
  function lp(e){
    const r=canvas.getBoundingClientRect();
    return{x:(e.clientX-r.left)*(canvas.width/r.width)/scale,
           y:(e.clientY-r.top)*(canvas.height/r.height)/scale};
  }

  function evDown(e){
    if(gameOver||wasMoving||!players[curPlayer].isHuman) return;
    const pos=lp(e);
    if(Math.hypot(pos.x-SK.x,pos.y-SK.y)<R_STRIKER+30){dragging=true;dragPos=pos;return;}
    if(Math.abs(pos.y-BASE_Y[curPlayer])<42)
      SK.x=Math.max(BASE_XL,Math.min(BASE_XR,pos.x));
  }
  function evMove(e){if(dragging) dragPos=lp(e);}
  function evUp(e){
    if(!dragging) return;
    const pos=lp(e); dragging=false;
    const dx=SK.x-pos.x,dy=SK.y-pos.y,d=Math.hypot(dx,dy);
    if(d<4) return;
    const F=0.44,MAX=92;
    SK.vx=(dx/d)*Math.min(d,MAX)*F; SK.vy=(dy/d)*Math.min(d,MAX)*F;
    wasMoving=true;
  }

  /* ══════════════════════════════════════════════════════════
     BOT AI
  ══════════════════════════════════════════════════════════ */
  function aiShot(){
    if(gameOver||players[curPlayer].isHuman) return;
    let targets=coins.filter(c=>!c.pocketed&&c.type!=='queen');
    if(!targets.length) targets=coins.filter(c=>!c.pocketed&&c.type==='queen');
    if(!targets.length) targets=coins.filter(c=>!c.pocketed);
    if(!targets.length){switchTurn();return;}

    let best=null,bPocket=null,bScore=-Infinity;
    for(const coin of targets){
      for(const p of POCKETS){
        const d=Math.hypot(coin.x-p.x,coin.y-p.y);
        const sc=PTS[coin.type]/(d+1);
        if(sc>bScore){bScore=sc;best=coin;bPocket=p;}
      }
    }

    const tdx=bPocket.x-best.x,tdy=bPocket.y-best.y;
    const td=Math.hypot(tdx,tdy)||1;
    const tnx=tdx/td,tny=tdy/td;
    const ix=best.x-tnx*(R_COIN+R_STRIKER+8), iy=best.y-tny*(R_COIN+R_STRIKER+8);
    const lo=PF+R_STRIKER+2,hi=PF2-R_STRIKER-2;
    SK.x=Math.max(lo,Math.min(hi,ix)); SK.y=Math.max(lo,Math.min(hi,iy));

    const ns={easy:0.40,medium:0.16,hard:0.04}[difficulty]||0.16;
    const angle=Math.atan2(best.y-SK.y,best.x-SK.x)+(Math.random()-0.5)*Math.PI*ns;
    const pw={easy:5.5,medium:7.8,hard:11.0}[difficulty]||7.8;
    SK.vx=Math.cos(angle)*(pw+Math.random()*2.2);
    SK.vy=Math.sin(angle)*(pw+Math.random()*2.2);
    wasMoving=true;
  }

  /* ══════════════════════════════════════════════════════════
     TIMER + END
  ══════════════════════════════════════════════════════════ */
  function startTimer(){
    timerInterval=setInterval(()=>{
      if(gameOver) return;
      timerSec=Math.max(0,timerSec-1); updateHUD();
      if(timerSec===0) endGame();
    },1000);
  }

  function endGame(){
    if(gameOver) return; gameOver=true; stopGame(); draw();
    const s0=players[0].score,s1=players[1].score,tie=s0===s1;
    const p0w=s0>s1;
    const emoji=tie?'🤝':p0w?'🏆':(gameMode==='pvp'?'🏆':'🤖');
    const title=tie?"IT'S A DRAW!":p0w?(gameMode==='pvp'?`${players[0].label} WINS!`:'YOU WIN! 🎉'):(gameMode==='pvp'?`${players[1].label} WINS!`:'BOT WINS!');
    $('carrom-result-emoji').textContent=emoji;
    $('carrom-result-title').textContent=title;
    $('carrom-result-detail').textContent=`${players[0].label}: ${s0} pts  ·  ${players[1].label}: ${s1} pts`;
    $('carrom-result').classList.remove('hidden');
    if (window.DZShare) DZShare.setResult({ game:'Carrom', slug:'carrom', winner:title, detail:`${players[0].label}: ${s0} pts  ·  ${players[1].label}: ${s1} pts`, accent:'#ff9100', icon:'🪙' });
  }

  /* ══════════════════════════════════════════════════════════
     HUD
  ══════════════════════════════════════════════════════════ */
  function updateHudLabels(){
    $('carrom-lbl-p').textContent  = players[0].label;
    $('carrom-lbl-ai').textContent = players[1].label;
  }
  function updateHUD(){
    $('carrom-score-p').textContent  = players[0].score;
    $('carrom-score-ai').textContent = players[1].score;
    $('carrom-pts-p').textContent    = players[0].score+' pts';
    $('carrom-pts-ai').textContent   = players[1].score+' pts';
    const h0=$('carrom-p1-hud'),h1=$('carrom-p2-hud');
    h0.style.borderColor=curPlayer===0?'rgba(0,229,255,0.7)':'rgba(0,229,255,0.15)';
    h0.style.background =curPlayer===0?'rgba(0,229,255,0.1)':'rgba(0,229,255,0.03)';
    h0.style.boxShadow  =curPlayer===0?'0 0 14px rgba(0,229,255,0.2)':'none';
    h1.style.borderColor=curPlayer===1?'rgba(255,82,82,0.7)':'rgba(255,82,82,0.15)';
    h1.style.background =curPlayer===1?'rgba(255,82,82,0.1)':'rgba(255,82,82,0.03)';
    h1.style.boxShadow  =curPlayer===1?'0 0 14px rgba(255,82,82,0.2)':'none';
    const m=Math.floor(timerSec/60),ss=timerSec%60;
    const tEl=$('carrom-timer');
    tEl.textContent=`${m}:${String(ss).padStart(2,'0')}`;
    tEl.style.color=timerSec<=10?'#ff5252':timerSec<=30?'#ffab40':'rgba(255,255,255,0.8)';
  }
  function updateTurnLabel(){
    const who=players[curPlayer].label;
    setTurnLabel(players[curPlayer].isHuman
      ?(gameMode==='pvp'?`🎯 ${who}'S TURN`:`🎯 YOUR TURN`)
      :`🤖 ${who}'S TURN`);
  }
  function setTurnLabel(t){$('carrom-turn-label').textContent=t;}

  /* ══════════════════════════════════════════════════════════
     RENDERING
  ══════════════════════════════════════════════════════════ */
  function draw(){
    if(!ctx||!canvas) return;
    const s=scale;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(boardCache) ctx.drawImage(boardCache,0,0);

    for(const type of ['black','white','queen'])
      for(const c of coins) if(!c.pocketed&&c.type===type) drawCoin(c,s);

    if(SK.x>0) drawStriker(s);
    if(dragging&&!wasMoving&&players[curPlayer].isHuman) drawAim(s);
    else if(!wasMoving&&!dragging&&!gameOver&&players[curPlayer].isHuman) drawHint(s);
  }

  /* ─── Coin ─── */
  function drawCoin(c,s){
    const cx=c.x*s,cy=c.y*s,r=R_COIN*s;
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=5*s; ctx.shadowOffsetY=2*s;
    const g=ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,r*0.04,cx,cy,r);
    if(c.type==='white'){
      g.addColorStop(0,'#ffffff'); g.addColorStop(0.4,'#e0e0e0'); g.addColorStop(1,'#999999');
    } else if(c.type==='black'){
      g.addColorStop(0,'#686868'); g.addColorStop(0.4,'#2a2a2a'); g.addColorStop(1,'#050505');
    } else {
      g.addColorStop(0,'#ff7070'); g.addColorStop(0.45,'#cc0000'); g.addColorStop(1,'#770000');
    }
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.restore();
    ctx.strokeStyle=c.type==='white'?'rgba(80,80,80,0.35)':c.type==='black'?'rgba(0,0,0,0.8)':'rgba(80,0,0,0.7)';
    ctx.lineWidth=0.9*s; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2);
    ctx.strokeStyle=c.type==='white'?'rgba(100,100,100,0.25)':c.type==='black'?'rgba(255,255,255,0.07)':'rgba(255,180,30,0.45)';
    ctx.lineWidth=0.8*s; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx-r*0.28,cy-r*0.28,r*0.22,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();
    if(c.type==='queen'){
      ctx.fillStyle='rgba(255,220,30,0.95)';
      ctx.font=`bold ${r*0.72}px serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('Q',cx,cy+0.5*s);
    }
  }

  /* ─── Striker ─── */
  function drawStriker(s){
    const cx=SK.x*s,cy=SK.y*s,r=R_STRIKER*s;
    const isP0=curPlayer===0, col=isP0?'#00e5ff':'#ff5252';
    ctx.save();
    ctx.shadowColor=isP0?'rgba(0,229,255,0.65)':'rgba(255,82,82,0.65)';
    ctx.shadowBlur=22*s;
    const g=ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,r*0.06,cx,cy,r);
    g.addColorStop(0,isP0?'#b8f6ff':'#ffb8b8'); g.addColorStop(0.55,col); g.addColorStop(1,isP0?'#003858':'#580015');
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.restore();
    ctx.strokeStyle=col; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2);
    ctx.strokeStyle=isP0?'rgba(0,229,255,0.28)':'rgba(255,82,82,0.28)';
    ctx.lineWidth=s; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,r*0.18,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
    ctx.beginPath(); ctx.arc(cx-r*0.26,cy-r*0.28,r*0.2,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();
  }

  /* ─── Idle hint ─── */
  function drawHint(s){
    const cx=SK.x*s,cy=SK.y*s,isP0=curPlayer===0;
    ctx.beginPath(); ctx.arc(cx,cy,(R_STRIKER+9)*s,0,Math.PI*2);
    ctx.strokeStyle=isP0?'rgba(0,229,255,0.2)':'rgba(255,82,82,0.2)';
    ctx.lineWidth=1.5*s; ctx.setLineDash([4*s,4*s]); ctx.stroke(); ctx.setLineDash([]);
  }

  /* ─── Aim guide ─── */
  function drawAim(s){
    const ox=SK.x*s,oy=SK.y*s,tx=dragPos.x*s,ty=dragPos.y*s;
    const ddx=tx-ox,ddy=ty-oy,dd=Math.hypot(ddx,ddy);
    if(dd<2) return;
    const MAX=92*s,power=Math.min(dd,MAX)/MAX;
    const nx=-ddx/dd,ny=-ddy/dd;
    const pc=power<0.4?`rgba(60,210,60,${0.25+power*0.55})`:power<0.75?`rgba(255,185,30,${0.3+power*0.5})`:`rgba(255,50,50,${0.35+power*0.5})`;
    ctx.beginPath(); ctx.arc(ox,oy,(R_STRIKER+13)*s,0,Math.PI*2);
    ctx.strokeStyle=pc; ctx.lineWidth=3.5*s; ctx.stroke();
    const len=(44+power*76)*s;
    ctx.setLineDash([7*s,5*s]); ctx.strokeStyle=pc; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox+nx*len,oy+ny*len); ctx.stroke();
    ctx.setLineDash([]);
    const ax=ox+nx*len,ay=oy+ny*len,hs=11*s,pw=-ny,ph=nx;
    ctx.beginPath(); ctx.moveTo(ax,ay);
    ctx.lineTo(ax-nx*hs+pw*hs*0.4,ay-ny*hs+ph*hs*0.4);
    ctx.lineTo(ax-nx*hs-pw*hs*0.4,ay-ny*hs-ph*hs*0.4);
    ctx.closePath(); ctx.fillStyle=pc; ctx.fill();
    ctx.beginPath(); ctx.arc(ox,oy,(R_STRIKER+23)*s,-Math.PI/2,-Math.PI/2+Math.PI*2*power);
    ctx.strokeStyle=pc; ctx.lineWidth=3*s; ctx.lineCap='round'; ctx.stroke(); ctx.lineCap='butt';
    ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(tx,ty);
    ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1.5*s;
    ctx.setLineDash([3*s,3*s]); ctx.stroke(); ctx.setLineDash([]);
  }

  /* ─── Rounded rect helper ─── */
  function rr(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y); c.lineTo(x+w-r,y);
    c.quadraticCurveTo(x+w,y,x+w,y+r); c.lineTo(x+w,y+h-r);
    c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h);
    c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r);
    c.quadraticCurveTo(x,y,x+r,y); c.closePath();
  }

})();
