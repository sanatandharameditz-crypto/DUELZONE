// ═══════════════════════════════════════════════════════════════
// DuelZone · Minesweeper Duel  (minesweeper.js)
// Each player gets their own identical grid.
// Race to clear all safe cells fastest.
// Hit a mine = lose instantly. Flag mines for bonus.
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var CONFIGS={
    easy:   {cols:9, rows:9, mines:10},
    medium: {cols:12,rows:10,mines:20},
    hard:   {cols:16,rows:12,mines:40},
  };

  var MS={
    mode:'pvp', diff:'easy', over:false, botDiff:'medium',
    grids:[null,null],
    cleared:[0,0], total:[0,0],
    started:[false,false], startTime:[0,0],
    flagMode:[false,false],
    botInterval:null,
  };

  var _wired=false;

  window.mineInit=function(){
    if(!_wired){mineWireUI();_wired=true;}
    mineShowHome();
  };
  window.mineDestroy=function(){ mineClearTimers(); };

  function el(id){return document.getElementById(id);}
  function on(id,fn){var e=el(id);if(e)e.addEventListener('click',fn);}
  function setText(id,v){var e=el(id);if(e)e.textContent=v;}

  function mineShowHome(){
    el('mine-home').classList.remove('hidden');
    el('mine-play').classList.add('hidden');
  }

  function mineWireUI(){
    on('mine-back-hub',   function(){mineClearTimers();showHub();});
    on('mine-back-play',  function(){mineClearTimers();mineShowHome();});
    on('mine-again',      function(){mineStartGame();});
    on('mine-result-hub', function(){mineClearTimers();showHub();});

    // Mode selector
    on('mine-mode-pvp', function(){
      MS.mode='pvp';
      document.getElementById('mine-mode-pvp').classList.add('active');
      document.getElementById('mine-mode-bot').classList.remove('active');
      var bs=document.getElementById('mine-bot-settings');
      if(bs) bs.classList.add('hidden');
    });
    on('mine-mode-bot', function(){
      MS.mode='bot';
      document.getElementById('mine-mode-bot').classList.add('active');
      document.getElementById('mine-mode-pvp').classList.remove('active');
      var bs=document.getElementById('mine-bot-settings');
      if(bs) bs.classList.remove('hidden');
    });
    on('mine-start-btn', function(){mineStartGame();});

    document.querySelectorAll('.mine-diff').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.mine-diff').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active'); MS.diff=b.dataset.diff;
      });
    });
    document.querySelectorAll('.mine-bot-diff').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.mine-bot-diff').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active'); MS.botDiff=b.dataset.bdiff||'medium';
      });
    });

    on('mine-flag-p1',function(){MS.flagMode[0]=!MS.flagMode[0];updateFlagBtn(0);});
    on('mine-flag-p2',function(){MS.flagMode[1]=!MS.flagMode[1];updateFlagBtn(1);});
  }

  function mineClearTimers(){
    if(MS.botInterval){clearInterval(MS.botInterval);MS.botInterval=null;}
  }

  function mineStartGame(){
    mineClearTimers();
    el('mine-home').classList.add('hidden');
    el('mine-play').classList.remove('hidden');
    el('mine-result').classList.add('hidden');

    MS.over=false; MS.cleared=[0,0]; MS.started=[false,false];
    MS.startTime=[0,0]; MS.flagMode=[false,false];

    var cfg=CONFIGS[MS.diff];

    // Generate two identical mine patterns for fairness
    var mineSet=generateMines(cfg.cols,cfg.rows,cfg.mines);

    MS.grids=[
      buildGrid(cfg.cols,cfg.rows,mineSet,0),
      buildGrid(cfg.cols,cfg.rows,mineSet,1),
    ];
    MS.total=[cfg.cols*cfg.rows-cfg.mines, cfg.cols*cfg.rows-cfg.mines];

    setText('mine-p2-name',MS.mode==='bot'?'🤖 Bot':'Player 2');
    var p2Section=el('mine-p2-section');
    if(p2Section) p2Section.style.display='';

    updateFlagBtn(0); updateFlagBtn(1);
    renderGrid(0); renderGrid(1);
    updateMineCount(0); updateMineCount(1);

    if(MS.mode==='bot') setTimeout(startBot,300);
  }

  function generateMines(cols,rows,count){
    var all=[];
    for(var r=0;r<rows;r++) for(var c=0;c<cols;c++) all.push({r:r,c:c});
    shuffle(all);
    var mines={};
    all.slice(0,count).forEach(function(m){mines[m.r+','+m.c]=true;});
    return mines;
  }

  function buildGrid(cols,rows,mineSet,pid){
    var cfg=CONFIGS[MS.diff];
    var cells=[];
    for(var r=0;r<rows;r++){
      cells[r]=[];
      for(var c=0;c<cols;c++){
        cells[r][c]={mine:!!mineSet[r+','+c],revealed:false,flagged:false,adj:0};
      }
    }
    // Calculate adjacency
    for(var r2=0;r2<rows;r2++){
      for(var c2=0;c2<cols;c2++){
        if(cells[r2][c2].mine) continue;
        var count=0;
        forNeighbors(r2,c2,rows,cols,function(nr,nc){if(cells[nr][nc].mine)count++;});
        cells[r2][c2].adj=count;
      }
    }
    return{cells:cells,rows:rows,cols:cols,mines:cfg.mines,flagCount:0,pid:pid};
  }

  function forNeighbors(r,c,rows,cols,fn){
    for(var dr=-1;dr<=1;dr++) for(var dc=-1;dc<=1;dc++){
      if(dr===0&&dc===0) continue;
      var nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<rows&&nc>=0&&nc<cols) fn(nr,nc);
    }
  }

  function renderGrid(pid){
    var g=MS.grids[pid];
    if(!g) return;
    var container=el('mine-grid-p'+(pid+1));
    if(!container) return;
    container.innerHTML='';
    container.style.gridTemplateColumns='repeat('+g.cols+',1fr)';

    for(var r=0;r<g.rows;r++){
      for(var c=0;c<g.cols;c++){
        (function(row,col){
          var cell=document.createElement('button');
          cell.className='mine-cell';
          var d=g.cells[row][col];
          if(d.revealed){
            cell.classList.add('mine-revealed');
            if(d.mine){ cell.textContent='💣'; cell.classList.add('mine-hit'); }
            else if(d.adj>0){ cell.textContent=d.adj; cell.classList.add('mine-n'+d.adj); }
          } else if(d.flagged){
            cell.textContent='🚩'; cell.classList.add('mine-flagged');
          }
          cell.addEventListener('click',function(e){
            e.preventDefault();
            if(MS.over) return;
            if(MS.flagMode[pid]){ toggleFlag(pid,row,col); }
            else { revealCell(pid,row,col); }
          });
          cell.addEventListener('contextmenu',function(e){
            e.preventDefault();
            if(MS.over) return;
            toggleFlag(pid,row,col);
          });
          container.appendChild(cell);
        })(r,c);
      }
    }
  }

  function revealCell(pid,r,c){
    var g=MS.grids[pid];
    var d=g.cells[r][c];
    if(d.revealed||d.flagged) return;

    if(!MS.started[pid]){
      // Guarantee first click is safe — swap mine if needed
      if(d.mine) moveMine(g,r,c);
      MS.started[pid]=true;
      MS.startTime[pid]=Date.now();
    }

    d.revealed=true;
    if(d.mine){
      revealAllMines(pid);
      renderGrid(pid);
      endGame(pid===0?1:0,'💣 Hit a mine!');
      return;
    }
    if(d.adj===0) floodReveal(pid,r,c);
    MS.cleared[pid]=countCleared(pid);
    renderGrid(pid);
    updateMineCount(pid);
    checkWin(pid);
  }

  function moveMine(g,r,c){
    // Find a non-mine cell to swap with
    for(var nr=0;nr<g.rows;nr++){
      for(var nc=0;nc<g.cols;nc++){
        if(!g.cells[nr][nc].mine&&!(nr===r&&nc===c)){
          g.cells[r][c].mine=false;
          g.cells[nr][nc].mine=true;
          recalcAdj(g);
          return;
        }
      }
    }
  }

  function recalcAdj(g){
    for(var r=0;r<g.rows;r++) for(var c=0;c<g.cols;c++){
      if(g.cells[r][c].mine){g.cells[r][c].adj=0;continue;}
      var count=0;
      forNeighbors(r,c,g.rows,g.cols,function(nr,nc){if(g.cells[nr][nc].mine)count++;});
      g.cells[r][c].adj=count;
    }
  }

  function floodReveal(pid,r,c){
    var g=MS.grids[pid];
    var queue=[{r:r,c:c}];
    while(queue.length){
      var cur=queue.shift();
      forNeighbors(cur.r,cur.c,g.rows,g.cols,function(nr,nc){
        var nd=g.cells[nr][nc];
        if(!nd.revealed&&!nd.mine&&!nd.flagged){
          nd.revealed=true;
          if(nd.adj===0) queue.push({r:nr,c:nc});
        }
      });
    }
  }

  function toggleFlag(pid,r,c){
    var g=MS.grids[pid];
    var d=g.cells[r][c];
    if(d.revealed) return;
    d.flagged=!d.flagged;
    g.flagCount+=d.flagged?1:-1;
    renderGrid(pid);
    updateMineCount(pid);
  }

  function updateFlagBtn(pid){
    var btn=el('mine-flag-p'+(pid+1));
    if(btn) btn.textContent=(MS.flagMode[pid]?'🚩 Flag: ON':'🚩 Flag: OFF');
    if(btn) btn.classList.toggle('mine-flag-active',MS.flagMode[pid]);
  }

  function updateMineCount(pid){
    var g=MS.grids[pid];
    if(!g) return;
    var remaining=g.mines-g.flagCount;
    setText('mine-mines-p'+(pid+1),'💣 '+remaining);
    var pct=Math.round(MS.cleared[pid]/MS.total[pid]*100)||0;
    var bar=el('mine-prog-p'+(pid+1));
    if(bar) bar.style.width=pct+'%';
    setText('mine-pct-p'+(pid+1),pct+'%');
  }

  function countCleared(pid){
    var g=MS.grids[pid],count=0;
    for(var r=0;r<g.rows;r++) for(var c=0;c<g.cols;c++) if(g.cells[r][c].revealed&&!g.cells[r][c].mine) count++;
    return count;
  }

  function revealAllMines(pid){
    var g=MS.grids[pid];
    for(var r=0;r<g.rows;r++) for(var c=0;c<g.cols;c++) if(g.cells[r][c].mine) g.cells[r][c].revealed=true;
  }

  function checkWin(pid){
    if(MS.cleared[pid]>=MS.total[pid]) endGame(pid,'⏱ '+(((Date.now()-MS.startTime[pid])/1000).toFixed(1))+'s');
  }

  function endGame(winner,detail){
    if(MS.over) return;
    MS.over=true;
    mineClearTimers();
    var names=['Player 1',MS.mode==='bot'?'Bot':'Player 2'];
    el('mine-result-title').textContent='🏆 '+names[winner]+' Wins!';
    el('mine-result-detail').textContent=detail||'';
    el('mine-result').classList.remove('hidden');
    if(typeof SoundManager!=='undefined'&&SoundManager.win) SoundManager.win();
  }

  // ── Bot AI ────────────────────────────────────────────────
  function startBot(){
    var cfg=CONFIGS[MS.diff];
    var delayMs={easy:1100,medium:500,hard:30}[MS.botDiff]||500;
    // Build list of safe cells (bot cheats slightly to seem competent)
    // Bot clicks cells one at a time
    var g=MS.grids[1];
    var queue=buildBotQueue(g);
    var idx=0;

    // Wait for P1 to start
    var checkP1=setInterval(function(){
      if(MS.started[0]||MS.over){
        clearInterval(checkP1);
        if(!MS.started[1]){MS.started[1]=true;MS.startTime[1]=Date.now();}
        MS.botInterval=setInterval(function(){
          if(MS.over||idx>=queue.length){clearInterval(MS.botInterval);return;}
          var cell=queue[idx++];
          if(!cell) return;
          var d=g.cells[cell.r][cell.c];
          if(d.revealed||d.mine) return;
          d.revealed=true;
          if(d.adj===0) floodReveal(1,cell.r,cell.c);
          MS.cleared[1]=countCleared(1);
          renderGrid(1);
          updateMineCount(1);
          checkWin(1);
        },delayMs*(0.7+Math.random()*0.6));
      }
    },100);
  }

  function buildBotQueue(g){
    // Return safe cells sorted from center outward (to simulate smart play)
    var safe=[];
    var cr=Math.floor(g.rows/2), cc=Math.floor(g.cols/2);
    for(var r=0;r<g.rows;r++) for(var c=0;c<g.cols;c++){
      if(!g.cells[r][c].mine) safe.push({r:r,c:c,d:Math.abs(r-cr)+Math.abs(c-cc)});
    }
    safe.sort(function(a,b){return a.d-b.d;});
    return safe;
  }

  function shuffle(arr){ for(var i=arr.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=arr[i];arr[i]=arr[j];arr[j]=t;} return arr; }

})();
