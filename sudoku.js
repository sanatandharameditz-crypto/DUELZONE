/* ═══════════════════════════════════════════════════════════
   DuelZone · Sudoku  –  sudoku.js
   Fully self-contained puzzle game module
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Inject CSS ─────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
  /* ─── Sudoku app container ─── */
  #sdk-app {
    width: 100%;
    max-width: 460px;
    margin: 0 auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }

  /* ─── Stats bar ─── */
  .sdk-stats-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 2px 10px;
    flex-shrink: 0;
  }
  .sdk-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .sdk-stat-lbl {
    font-family: 'DM Mono', monospace;
    font-size: 0.55rem; letter-spacing: 0.3em;
    color: rgba(255,255,255,0.28); text-transform: uppercase;
  }
  .sdk-stat-val {
    font-family: 'Orbitron', sans-serif;
    font-weight: 700; font-size: 0.88rem; color: #e2e8ff;
  }
  #sdk-timer-val { color: #6c63ff; }
  #sdk-diff-badge {
    font-family: 'DM Mono', monospace;
    font-size: 0.65rem; letter-spacing: 0.2em;
    padding: 3px 10px; border-radius: 20px;
    background: rgba(108,99,255,0.15);
    border: 1px solid rgba(108,99,255,0.35);
    color: #6c63ff; text-transform: uppercase;
  }
  .sdk-hearts { display: flex; gap: 4px; }
  .sdk-heart { font-size: 0.95rem; transition: opacity 0.3s, transform 0.3s; }
  .sdk-heart.lost { opacity: 0.18; transform: scale(0.65); }

  /* ─── Grid wrapper ─── */
  .sdk-grid-wrap {
    width: 100%;
    position: relative;
    flex-shrink: 0;
  }
  .sdk-grid-wrap::before {
    content: ''; display: block; padding-top: 100%;
  }
  #sdk-grid {
    position: absolute; inset: 0;
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    grid-template-rows: repeat(9, 1fr);
    border: 2.5px solid rgba(108,99,255,0.90);
    border-radius: 7px;
    overflow: hidden;
    background: #0b0d1a;
    box-shadow: 0 0 28px rgba(108,99,255,0.12), inset 0 0 0 1px rgba(108,99,255,0.06);
  }

  /* ─── Cell ─── */
  .sdk-cell {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    box-sizing: border-box;
    border-right: 1px solid rgba(255,255,255,0.18);
    border-bottom: 1px solid rgba(255,255,255,0.18);
    font-family: 'Orbitron', sans-serif;
    font-weight: 700;
    font-size: clamp(0.78rem, 3.2vw, 1.25rem);
    cursor: pointer;
    transition: background 0.1s;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    touch-action: manipulation;
  }
  /* thick box borders */
  .sdk-cell[data-col="2"],.sdk-cell[data-col="5"]{ border-right:  2.5px solid rgba(108,99,255,0.90); }
  .sdk-cell[data-row="2"],.sdk-cell[data-row="5"]{ border-bottom: 2.5px solid rgba(108,99,255,0.90); }
  .sdk-cell[data-col="8"]{ border-right: none; }
  .sdk-cell[data-row="8"]{ border-bottom: none; }

  /* state colours */
  .sdk-cell.given       { color: #c8ceff; }
  .sdk-cell.user-entry  { color: #a29bff; }
  .sdk-cell.error-entry { color: #f50057 !important; background: rgba(245,0,87,0.09) !important; }
  .sdk-cell.selected    { background: rgba(108,99,255,0.28) !important; }
  .sdk-cell.peer-hi     { background: rgba(108,99,255,0.07); }
  .sdk-cell.same-val    { background: rgba(108,99,255,0.16); }

  /* hint flash */
  .sdk-cell.hint-flash { animation: sdkHintFlash 0.6s ease; }
  @keyframes sdkHintFlash {
    0%,100% { background: rgba(108,99,255,0.28); }
    50%     { background: rgba(108,99,255,0.55); box-shadow: inset 0 0 10px rgba(108,99,255,0.6); }
  }
  /* correct pulse */
  .sdk-cell.correct-flash { animation: sdkCorrectFlash 0.4s ease; }
  @keyframes sdkCorrectFlash {
    0%   { background: rgba(0,230,118,0.3); }
    100% { background: transparent; }
  }

  /* ─── Notes grid ─── */
  .sdk-notes {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    grid-template-rows: repeat(3,1fr);
    width: 94%; height: 94%;
    gap: 0;
  }
  .sdk-n {
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Mono', monospace;
    font-size: clamp(0.3rem, 0.9vw, 0.5rem);
    color: rgba(108,99,255,0.65);
    line-height: 1;
  }

  /* ─── Action row ─── */
  .sdk-actions {
    display: flex; gap: 7px;
    margin: 10px 0 9px;
    flex-shrink: 0;
  }
  .sdk-act {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 3px;
    padding: 8px 4px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, border-color 0.12s;
    touch-action: manipulation;
  }
  .sdk-act:active { background: rgba(108,99,255,0.18); }
  .sdk-act.on { background: rgba(108,99,255,0.2); border-color: rgba(108,99,255,0.5); }
  .sdk-act-icon { font-size: 1.05rem; }
  .sdk-act-lbl {
    font-family: 'DM Mono', monospace; font-size: 0.52rem;
    letter-spacing: 0.12em; color: rgba(255,255,255,0.38);
    text-transform: uppercase;
  }
  .sdk-act-sub { font-family:'DM Mono',monospace; font-size:0.5rem; color:rgba(108,99,255,0.7); }

  /* ─── Number pad ─── */
  .sdk-numpad {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    gap: 5px;
    flex-shrink: 0;
    margin-bottom: 6px;
  }
  .sdk-nbtn {
    aspect-ratio: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s, transform 0.08s;
    touch-action: manipulation;
    gap: 1px;
  }
  .sdk-nbtn:active { transform: scale(0.88); background: rgba(108,99,255,0.28); }
  .sdk-nbtn.used { opacity: 0.22; pointer-events: none; }
  .sdk-nv {
    font-family: 'Orbitron', sans-serif; font-weight: 700;
    font-size: clamp(0.78rem, 3vw, 1.1rem); color: #e2e8ff; line-height: 1;
  }
  .sdk-nc {
    font-family: 'DM Mono', monospace; font-size: 0.48rem;
    color: rgba(255,255,255,0.28);
  }
  `;
  document.head.appendChild(style);

  /* ══════════════════════════════════════════════════════════
     Constants
  ══════════════════════════════════════════════════════════ */
  const CLUES_REMOVE = { easy: 32, medium: 45, hard: 52, expert: 58 };
  const MAX_ERR = 3;

  /* ══════════════════════════════════════════════════════════
     State
  ══════════════════════════════════════════════════════════ */
  let diff      = 'medium';
  let solution  = [];   // 81 ints
  let given     = [];   // 81 bools
  let board     = [];   // 81 ints (0=empty)
  let notes     = [];   // 81 Sets
  let selected  = -1;
  let notesMode = false;
  let errors    = 0;
  let hints     = 3;
  let timerSec  = 0;
  let timerInt  = null;
  let history   = [];
  let done      = false;

  /* ══════════════════════════════════════════════════════════
     DOM refs (lazy – resolved at runtime)
  ══════════════════════════════════════════════════════════ */
  const $ = id => document.getElementById(id);

  /* ══════════════════════════════════════════════════════════
     Navigation wiring
  ══════════════════════════════════════════════════════════ */

  // FIX BUG-A: Renamed from showAllScreensExcept → hideAllScreensExcept.
  // toggle('hidden', el.id !== keepId) ADDS hidden to everything except keepId
  // and REMOVES it from keepId — i.e. it shows ONLY keepId, hides the rest.
  // The old name said the exact opposite, which is a maintenance landmine.
  function hideAllScreensExcept(keepId) {
    document.querySelectorAll('[id^="screen-"]').forEach(el => {
      el.classList.toggle('hidden', el.id !== keepId);
    });
  }

  // Hub card click (fallback if main script.js also handles it – that's fine)
  document.addEventListener('click', e => {
    if (e.target.closest('.arena-card[data-screen="sudoku"]')) {
      if(typeof window.showSudoku==='function') window.showSudoku();
      else hideAllScreensExcept('screen-sudoku');
    }
  });

  // "← Hub" on home panel
  document.addEventListener('click', e => {
    if (e.target.id === 'sdk-back-hub') {
      stopTimer();
      if(typeof window.showHub==='function') window.showHub(); else hideAllScreensExcept('screen-hub');
    }
  });

  // "← Back" on play panel
  document.addEventListener('click', e => {
    if (e.target.id === 'sdk-back-play') {
      stopTimer();
      window.scrollTo(0, 0);
      var backBtn = document.getElementById('sdk-back-play'); if (backBtn) backBtn.style.display = 'none';
      var playEl = $('sdk-play');
      if (playEl) { playEl.classList.add('hidden'); playEl.style.display = 'none'; }
      var homeEl = $('sdk-home');
      if (homeEl) { homeEl.classList.remove('hidden'); homeEl.style.removeProperty('display'); homeEl.style.removeProperty('visibility'); }
    }
  });

  // Difficulty pills
  document.addEventListener('click', e => {
    const pill = e.target.closest('.sdk-diff');
    if (!pill) return;
    document.querySelectorAll('.sdk-diff').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    diff = pill.dataset.diff;
  });

  /* ── Auto-apply difficulty from challenge link ─────────── */
  (function() {
    if (!window.DZShare || typeof DZShare.getChallenge !== 'function') return;
    const _ch = DZShare.getChallenge();
    if (!_ch || _ch.slug !== 'sudoku' || !_ch.diff) return;
    const target = _ch.diff.toLowerCase();
    document.querySelectorAll('.sdk-diff').forEach(p => {
      if ((p.dataset.diff || '').toLowerCase() === target) {
        document.querySelectorAll('.sdk-diff').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        diff = target;
      }
    });
  })();

  // Start button
  document.addEventListener('click', e => {
    if (e.target.id === 'sdk-start-btn' || e.target.closest('#sdk-start-btn')) {
      window.scrollTo(0, 0);
      var homeEl = $('sdk-home');
      if (homeEl) { homeEl.classList.add('hidden'); homeEl.style.display = 'none'; }
      var playEl = $('sdk-play');
      if (playEl) { playEl.classList.remove('hidden'); playEl.style.setProperty('display','flex','important'); playEl.scrollTop = 0; }
      var backBtn = document.getElementById('sdk-back-play'); if (backBtn) backBtn.style.display = 'block';
      initGame();
    }
  });

  // "New Puzzle" on result
  document.addEventListener('click', e => {
    if (e.target.id === 'sdk-again') {
      var res = $('sdk-result'); if (res) res.classList.add('hidden');
      initGame();
    }
  });

  // Result → Hub
  document.addEventListener('click', e => {
    if (e.target.id === 'sdk-result-hub') {
      stopTimer();
      window.scrollTo(0, 0);
      var backBtn = document.getElementById('sdk-back-play'); if (backBtn) backBtn.style.display = 'none';
      // FIX BUG-B: guard every $() call — getElementById returns null if the element
      // is missing, and calling .classList on null throws a TypeError that crashes
      // hub navigation, leaving the user stuck on the result screen.
      const _res=$('sdk-result'), _play=$('sdk-play'), _home=$('sdk-home');
      if(_res)  _res.classList.add('hidden');
      if(_play) _play.classList.add('hidden');
      if(_home) _home.classList.remove('hidden');
      if(typeof window.showHub==='function') window.showHub(); else hideAllScreensExcept('screen-hub');
    }
  });

  /* ══════════════════════════════════════════════════════════
     PUZZLE GENERATION
  ══════════════════════════════════════════════════════════ */

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.random() * (i + 1) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function canPlace(g, row, col, d) {
    for (let i = 0; i < 9; i++) {
      if (g[row*9+i] === d || g[i*9+col] === d) return false;
    }
    const br = (row/3|0)*3, bc = (col/3|0)*3;
    for (let r = br; r < br+3; r++)
      for (let c = bc; c < bc+3; c++)
        if (g[r*9+c] === d) return false;
    return true;
  }

  function solve(g, rand=false) {
    const e = g.indexOf(0);
    if (e === -1) return true;
    const row = e/9|0, col = e%9;
    const digits = rand ? shuffle([1,2,3,4,5,6,7,8,9]) : [1,2,3,4,5,6,7,8,9];
    for (const d of digits) {
      if (canPlace(g, row, col, d)) {
        g[e] = d;
        if (solve(g, rand)) return true;
        g[e] = 0;
      }
    }
    return false;
  }

  function countSols(g, cap=2) {
    const copy = g.slice();
    let n = 0;
    function bt() {
      const e = copy.indexOf(0);
      if (e === -1) { n++; return; }
      const row = e/9|0, col = e%9;
      for (let d = 1; d <= 9 && n < cap; d++) {
        if (canPlace(copy, row, col, d)) {
          copy[e] = d; bt(); copy[e] = 0;
        }
      }
    }
    bt();
    return n;
  }

  function makePuzzle(cluesRemove) {
    const sol = Array(81).fill(0);
    solve(sol, true);
    const puz = sol.slice();
    const positions = shuffle([...Array(81).keys()]);
    let removed = 0;
    for (const p of positions) {
      if (removed >= cluesRemove) break;
      const bk = puz[p]; puz[p] = 0;
      if (countSols(puz) === 1) removed++;
      else puz[p] = bk;
    }
    return { sol, puz };
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */

  function initGame() {
    stopTimer();
    done = false; selected = -1; notesMode = false;
    errors = 0; hints = 3; timerSec = 0; history = [];

    const toRemove = CLUES_REMOVE[diff] || 45;
    const { sol, puz } = makePuzzle(toRemove);
    solution = sol;
    given = puz.map(v => v !== 0);
    board = puz.slice();
    notes = Array.from({length:81}, () => new Set());

    renderGame();
    startTimer();
  }

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */

  function renderGame() {
    const app = $('sdk-app');
    if (!app) return;
    app.innerHTML = '';

    // ── Stats bar ──
    const statsBar = el('div', 'sdk-stats-bar');
    statsBar.innerHTML = `
      <div class="sdk-stat">
        <span class="sdk-stat-lbl">Difficulty</span>
        <span id="sdk-diff-badge">${diff.toUpperCase()}</span>
      </div>
      <div class="sdk-stat">
        <span class="sdk-stat-lbl">Lives</span>
        <div class="sdk-hearts" id="sdk-hearts">
          ${[0,1,2].map(i=>`<span class="sdk-heart${i>=MAX_ERR-errors?' lost':''}">❤️</span>`).join('')}
        </div>
      </div>
      <div class="sdk-stat">
        <span class="sdk-stat-lbl">Time</span>
        <span class="sdk-stat-val" id="sdk-timer-val">${fmt(timerSec)}</span>
      </div>
    `;
    app.appendChild(statsBar);

    // ── Grid ──
    const wrap = el('div', 'sdk-grid-wrap');
    const grid = el('div', '');
    grid.id = 'sdk-grid';
    for (let i = 0; i < 81; i++) {
      const r = i/9|0, c = i%9;
      const cell = el('div', 'sdk-cell');
      cell.dataset.idx = i;
      cell.dataset.row = r;
      cell.dataset.col = c;
      applyGivenClass(cell, i);
      renderCellContent(cell, i);
      cell.addEventListener('pointerdown', e => { e.preventDefault(); selectCell(i); });
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    app.appendChild(wrap);

    // ── Actions ──
    const acts = el('div', 'sdk-actions');
    acts.innerHTML = `
      <button class="sdk-act" id="sdk-undo">
        <span class="sdk-act-icon">↩️</span>
        <span class="sdk-act-lbl">Undo</span>
      </button>
      <button class="sdk-act" id="sdk-erase">
        <span class="sdk-act-icon">🗑️</span>
        <span class="sdk-act-lbl">Erase</span>
      </button>
      <button class="sdk-act${notesMode?' on':''}" id="sdk-notes-btn">
        <span class="sdk-act-icon">✏️</span>
        <span class="sdk-act-lbl">Notes</span>
        <span class="sdk-act-sub" id="sdk-notes-sub">${notesMode?'ON':'OFF'}</span>
      </button>
      <button class="sdk-act" id="sdk-hint-btn">
        <span class="sdk-act-icon">💡</span>
        <span class="sdk-act-lbl">Hint</span>
        <span class="sdk-act-sub" id="sdk-hints-sub">${hints} left</span>
      </button>
    `;
    app.appendChild(acts);

    // ── Numpad ──
    const numpad = el('div', 'sdk-numpad');
    const cnts = digitCounts();
    for (let d = 1; d <= 9; d++) {
      const rem = 9 - cnts[d];
      const btn = el('button', 'sdk-nbtn' + (rem<=0?' used':''));
      btn.dataset.d = d;
      btn.innerHTML = `<span class="sdk-nv">${d}</span><span class="sdk-nc">${rem>0?rem:'✓'}</span>`;
      btn.addEventListener('pointerdown', e => { e.preventDefault(); inputDigit(d); });
      numpad.appendChild(btn);
    }
    app.appendChild(numpad);

    // Action wiring
    $('sdk-undo').addEventListener('pointerdown', e=>{e.preventDefault();undoMove();});
    $('sdk-erase').addEventListener('pointerdown', e=>{e.preventDefault();eraseCell();});
    $('sdk-notes-btn').addEventListener('pointerdown', e=>{e.preventDefault();toggleNotes();});
    $('sdk-hint-btn').addEventListener('pointerdown', e=>{e.preventDefault();useHint();});

    highlight();
  }

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function applyGivenClass(cell, idx) {
    cell.classList.remove('given','user-entry','error-entry');
    if (given[idx]) {
      cell.classList.add('given');
    } else if (board[idx] !== 0) {
      cell.classList.add(board[idx]!==solution[idx]?'error-entry':'user-entry');
    }
  }

  function renderCellContent(cell, idx) {
    cell.innerHTML = '';
    if (board[idx] !== 0) {
      cell.textContent = board[idx];
    } else if (notes[idx].size > 0) {
      const ng = el('div','sdk-notes');
      for (let d=1;d<=9;d++){
        const s=el('span','sdk-n');
        if(notes[idx].has(d)) s.textContent=d;
        ng.appendChild(s);
      }
      cell.appendChild(ng);
    }
  }

  /* ── Highlight peers + same value ── */
  function highlight() {
    document.querySelectorAll('.sdk-cell').forEach(cell => {
      cell.classList.remove('selected','peer-hi','same-val');
    });
    if (selected === -1) return;

    const sr = selected/9|0, sc = selected%9;
    const sb = (sr/3|0)*3 + (sc/3|0);
    const sv = board[selected];

    document.querySelectorAll('.sdk-cell').forEach(cell => {
      const i = +cell.dataset.idx;
      if (i === selected) { cell.classList.add('selected'); return; }
      const r = i/9|0, c = i%9, b = (r/3|0)*3+(c/3|0);
      const isPeer = r===sr || c===sc || b===sb;
      if (sv>0 && board[i]===sv) { cell.classList.add('same-val'); return; }
      if (isPeer) cell.classList.add('peer-hi');
    });
  }

  /* ── Select cell ── */
  function selectCell(idx) {
    if (done) return;
    selected = idx;
    highlight();
  }

  /* ── Input digit ── */
  function inputDigit(d) {
    if (selected===-1 || done) return;
    if (given[selected]) return;

    if (notesMode) {
      pushHistory(selected, board[selected], new Set(notes[selected]));
      notes[selected].has(d) ? notes[selected].delete(d) : notes[selected].add(d);
      refreshCell(selected);
      return;
    }

    if (board[selected]===d) return;
    // FIX BUG-5: only count a new error if the cell was not already wrong
    // (prevents extra error-increments when overwriting one wrong digit with another)
    const _wasAlreadyWrong = board[selected]!==0 && board[selected]!==solution[selected];
    pushHistory(selected, board[selected], new Set(notes[selected]));
    notes[selected].clear();
    board[selected] = d;

    if (d !== solution[selected]) {
      if (!_wasAlreadyWrong) { errors++; updateHearts(); buzz(); }
      refreshCell(selected);
      if (errors >= MAX_ERR) { done=true; stopTimer(); showResult(false); }
    } else {
      // Clear notes for peers
      const r=selected/9|0,c=selected%9;
      const br=(r/3|0)*3,bc=(c/3|0)*3;
      const peers=new Set();
      for(let i=0;i<9;i++){peers.add(r*9+i);peers.add(i*9+c);}
      for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++)peers.add(rr*9+cc);
      peers.forEach(pi=>{if(notes[pi].has(d)){notes[pi].delete(d);refreshCell(pi);}});
    }

    refreshCell(selected); // note: applyGivenClass inside adds 'user-entry' if correct
    // FIX BUG-1: check if correct AFTER refreshCell (class is set), then flash
    if (board[selected] === solution[selected] && !given[selected] && board[selected] !== 0) {
      flashCorrect(selected);
    }
    refreshNumpad();
    highlight();

    if (checkWin()) { done=true; stopTimer(); setTimeout(()=>showResult(true),400); }
  }

  /* ── Erase ── */
  function eraseCell() {
    if (selected===-1||done||given[selected]) return;
    pushHistory(selected,board[selected],new Set(notes[selected]));
    board[selected]=0; notes[selected].clear();
    refreshCell(selected);
    refreshNumpad();
    highlight();
  }

  /* ── Toggle notes ── */
  function toggleNotes() {
    notesMode=!notesMode;
    const btn=$('sdk-notes-btn'), sub=$('sdk-notes-sub');
    if(btn) btn.classList.toggle('on',notesMode);
    if(sub) sub.textContent=notesMode?'ON':'OFF';
  }

  /* ── Undo ── */
  function pushHistory(idx,val,n){history.push({idx,val,n});if(history.length>60)history.shift();}
  function undoMove(){
    if(!history.length) return;
    const {idx,val,n}=history.pop();
    board[idx]=val; notes[idx]=n;
    // FIX BUG-3: recalculate errors from the actual board so undoing a mistake
    // correctly restores the error count and heart display
    errors=0;
    for(let i=0;i<81;i++){
      if(!given[i]&&board[i]!==0&&board[i]!==solution[i]) errors++;
    }
    updateHearts();
    refreshCell(idx); refreshNumpad(); highlight();
  }

  /* ── Hint ── */
  function useHint(){
    if(hints<=0||done) return;
    let t=-1;
    if(selected!==-1&&!given[selected]&&(board[selected]===0||board[selected]!==solution[selected])) t=selected;
    else{
      const pool=[];
      for(let i=0;i<81;i++) if(!given[i]&&board[i]!==solution[i]) pool.push(i);
      if(!pool.length) return;
      t=pool[Math.random()*pool.length|0];
    }
    hints--;
    pushHistory(t,board[t],new Set(notes[t]));
    board[t]=solution[t]; notes[t].clear();
    selected=t;
    // FIX BUG-4: clear revealed digit from peer cell notes (same row/col/box)
    const _d=solution[t], _r=t/9|0, _c=t%9, _br=(_r/3|0)*3, _bc=(_c/3|0)*3;
    const _peers=new Set();
    for(let _i=0;_i<9;_i++){_peers.add(_r*9+_i);_peers.add(_i*9+_c);}
    for(let _rr=_br;_rr<_br+3;_rr++)for(let _cc=_bc;_cc<_bc+3;_cc++)_peers.add(_rr*9+_cc);
    _peers.forEach(_pi=>{if(_pi!==t&&notes[_pi].has(_d)){notes[_pi].delete(_d);refreshCell(_pi);}});
    refreshCell(t); refreshNumpad(); highlight();

    const cell=document.querySelector(`.sdk-cell[data-idx="${t}"]`);
    if(cell){cell.classList.add('hint-flash');setTimeout(()=>cell.classList.remove('hint-flash'),700);}

    const sub=$('sdk-hints-sub');
    if(sub) sub.textContent=hints+' left';

    if(checkWin()){done=true;stopTimer();setTimeout(()=>showResult(true),400);}
  }

  /* ── Refresh single cell ── */
  function refreshCell(idx){
    const cell=document.querySelector(`.sdk-cell[data-idx="${idx}"]`);
    if(!cell) return;
    cell.classList.remove('selected','peer-hi','same-val','hint-flash','correct-flash');
    applyGivenClass(cell,idx);
    renderCellContent(cell,idx);
  }

  function flashCorrect(idx){
    const cell=document.querySelector(`.sdk-cell[data-idx="${idx}"]`);
    if(!cell) return;
    cell.classList.add('correct-flash');
    setTimeout(()=>cell.classList.remove('correct-flash'),400);
  }

  function refreshNumpad(){
    const cnts=digitCounts();
    document.querySelectorAll('.sdk-nbtn').forEach(btn=>{
      const d=+btn.dataset.d;
      const rem=9-cnts[d];
      btn.classList.toggle('used',rem<=0);
      btn.querySelector('.sdk-nc').textContent=rem>0?rem:'✓';
    });
  }

  function updateHearts(){
    const wrap=$('sdk-hearts');
    if(!wrap) return;
    wrap.querySelectorAll('.sdk-heart').forEach((h,i)=>{
      h.classList.toggle('lost',i>=MAX_ERR-errors);
    });
  }

  function digitCounts(){
    const c={};
    for(let d=1;d<=9;d++)c[d]=0;
    board.forEach(v=>{if(v>0)c[v]++;});
    return c;
  }

  function checkWin(){
    return board.every((v,i)=>v===solution[i]);
  }

  /* ── Timer ── */
  function startTimer(){
    stopTimer();
    timerInt=setInterval(()=>{
      if(done) return;
      timerSec++;
      const el=$('sdk-timer-val');
      if(el) el.textContent=fmt(timerSec);
    },1000);
  }
  function stopTimer(){ clearInterval(timerInt); timerInt=null; }
  function fmt(s){ return `${(s/60|0)}:${(s%60).toString().padStart(2,'0')}`; }

  /* ── Expose stop/pause so dzPauseAllGames() and orientation handler can call them ── */
  window.sudokuStop  = function() { stopTimer(); };
  window.sudokuPause = function() { stopTimer(); };
  window.sudokuResume = function() {
    // Only resume if a game is actively in progress (not on home screen, not done)
    var playEl = document.getElementById('sdk-play');
    if (playEl && !playEl.classList.contains('hidden') && !done) {
      startTimer();
    }
  };

  /* ── Buzz (haptic) ── */
  function buzz(){ if('vibrate' in navigator) navigator.vibrate([50,20,50]); }

  /* ── Show result ── */
  function showResult(won){
    const res=$('sdk-result');
    if(!res) return;
    const emojiEl=$('sdk-result-emoji'), titleEl=$('sdk-result-title'), detailEl=$('sdk-result-detail');
    if(emojiEl)  emojiEl.textContent  = won?'🏆':'💀';
    if(titleEl)  titleEl.textContent  = won?'PUZZLE SOLVED!':'GAME OVER';
    if(detailEl) detailEl.textContent = won
      ? `${diff.toUpperCase()} · ${fmt(timerSec)} · ${errors} mistake${errors!==1?'s':''}`
      : 'Too many mistakes! Try again.';
    res.classList.remove('hidden');
    if (window.DZShare) DZShare.setResult({ game:'Sudoku', slug:'sudoku', winner:won?'Puzzle Solved! 🏆':'Game Over 💀', detail:won?`${diff.toUpperCase()} · ${fmt(timerSec)} · ${errors} mistake${errors!==1?'s':''}`:'Too many mistakes!', accent:'#6c63ff', icon:'🔢', score:timerSec, diff:diff, isWin:won });
  }

  /* ══════════════════════════════════════════════════════════
     KEYBOARD
  ══════════════════════════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    const screen=$('screen-sudoku');
    if(!screen||screen.classList.contains('hidden')) return;
    const play=$('sdk-play');
    if(!play||play.classList.contains('hidden')) return;

    const k=e.key;
    if(k>='1'&&k<='9'){e.preventDefault();inputDigit(+k);}
    else if(k==='Backspace'||k==='Delete'||k==='0'){e.preventDefault();eraseCell();}
    else if(k==='n'||k==='N') toggleNotes();
    else if(k==='h'||k==='H') useHint();
    else if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();undoMove();}
    else if(selected!==-1){
      const r=selected/9|0,c=selected%9;
      let nxt=-1;
      if(k==='ArrowRight') nxt=r*9+Math.min(c+1,8);
      else if(k==='ArrowLeft') nxt=r*9+Math.max(c-1,0);
      else if(k==='ArrowDown') nxt=Math.min(r+1,8)*9+c;
      else if(k==='ArrowUp') nxt=Math.max(r-1,0)*9+c;
      if(nxt!==-1){e.preventDefault();selectCell(nxt);}
    }
  });

})();
