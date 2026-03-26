/* ================================================================
   DuelZone Share System v2  —  dzshare.js
   ─────────────────────────────────────────────────────────────────
   • Generates an 800×450 share card PNG via HTML5 Canvas (no API needed)
   • Challenge link:  ?challenge=Rahul&score=24&diff=easy&slug=chess
   • Beat-score popup when Player 2 beats the challenge
   • Challenge banner shown when page opens via challenge link
   • Share via WhatsApp / Instagram (native file share on mobile) / Copy Link / Save Image
   ================================================================ */

(function (window) {
  'use strict';

  var BASE = 'https://duelzone.online';

  /* ── Current game result ────────────────────────────────────── */
  var _r = {
    game:   'DuelZone',
    slug:   '',
    winner: '',
    detail: '',
    accent: '#00e5ff',
    icon:   '🎮',
    score:  0,
    diff:   '',
    isWin:  true
  };

  /* ── PNG data-URL cache (cleared whenever result changes) ────── */
  var _cache = null;

  /* ── Challenge params parsed once from URL on load ───────────── */
  var _ch = (function () {
    try {
      var p = new URLSearchParams(window.location.search);
      var diff = (p.get('diff') || '').toLowerCase();
      return {
        name:  p.get('challenge') || '',
        score: parseInt(p.get('score') || '0', 10) || 0,
        diff:  diff,
        slug:  p.get('slug')  || ''
      };
    } catch (e) {
      return { name: '', score: 0, diff: '', slug: '' };
    }
  })();

  /* ================================================================
     setResult  —  called by every game when it ends
     d = { game, slug, winner, detail, accent, icon, score, diff, isWin }
     ================================================================ */
  function setResult(d) {
    _r.game   = d.game   || 'DuelZone';
    _r.slug   = d.slug   || '';
    _r.winner = d.winner || '';
    _r.detail = d.detail || '';
    _r.accent = d.accent || '#00e5ff';
    _r.icon   = d.icon   || '🎮';
    _r.score  = d.score  || 0;
    _r.diff   = d.diff   || '';
    _r.isWin  = d.isWin  !== false;
    _cache    = null;   /* always regenerate card with new result */

    /* ── Beat-challenge check ─────────────────────────────────── */
    if (_r.isWin && _ch.name && _r.slug && _r.slug === _ch.slug) {
      /* lower is better for: chess (moves), minesweeper/sudoku (time), darts */
      var lowerBetter = ['minesweeper', 'sudoku', 'chess', 'darts'];
      var beats = lowerBetter.indexOf(_r.slug) !== -1
        ? (_r.score > 0 && _ch.score > 0 && _r.score < _ch.score)
        : (_r.score > _ch.score);
      if (beats) setTimeout(_showBeatPopup, 1400);
    }
  }

  /* ================================================================
     Utility helpers
     ================================================================ */

  /* Strip non-printable-ASCII for canvas text (keeps Latin Extended) */
  function _safe(str, maxLen) {
    var s = String(str || '');
    s = s.replace(/[^\x20-\x7E\xC0-\x024F]/g, '').trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen) + '...';
    return s;
  }

  /* Convert #rrggbb → rgba() string (8-digit hex unreliable on iOS canvas) */
  function _hex2rgba(hex, a) {
    hex = (hex || '#00e5ff').replace('#', '');
    if (hex.length === 3)
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.slice(0,2),16);
    var g = parseInt(hex.slice(2,4),16);
    var b = parseInt(hex.slice(4,6),16);
    return 'rgba('+r+','+g+','+b+','+(a===undefined?1:a)+')';
  }

  /* ================================================================
     _buildURL  —  builds the challenge link
     e.g. https://duelzone.online/chess?challenge=Rahul&score=24&diff=easy&slug=chess
     ================================================================ */
  function _buildURL(playerName) {
    var base = BASE + '/' + (_r.slug || '');
    var params = [];
    var n = (playerName || '').trim();
    if (n)        params.push('challenge=' + encodeURIComponent(n));
    if (_r.score) params.push('score='     + _r.score);
    if (_r.diff)  params.push('diff='      + encodeURIComponent(_r.diff));
    if (_r.slug)  params.push('slug='      + _r.slug);
    return params.length ? base + '?' + params.join('&') : base;
  }

  /* ================================================================
     _drawCard  —  generates 800×450 PNG share card, synchronously.
     • No requestAnimationFrame — rAF is throttled on hidden tabs and
       some mobile browsers, which causes the spinner to hang forever.
     • measureText() is always called while the matching font is set —
       never after _emoji() which temporarily changes ctx.font.
     • Every emoji draw is individually wrapped in try/catch so a
       platform failure never aborts the whole card.
     ================================================================ */
  function _drawCard(playerName, callback) {
    if (_cache) { callback(_cache); return; }

    /* Safety timeout — if something hangs past 10 s, surface the error */
    var timedOut = false;
    var tid = setTimeout(function () { timedOut = true; callback(null); }, 10000);

    try {
      var W = 800, H = 450;
      var cv  = document.createElement('canvas');
      cv.width  = W;
      cv.height = H;
      var ctx = cv.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');

      var acc  = _r.accent || '#00e5ff';
      var name = (playerName || '').trim();

      /* ── 1. Background ─────────────────────────────────────────── */
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 0, W, H);

      /* Subtle dot-grid */
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (var gx = 24; gx < W; gx += 32) {
        for (var gy = 24; gy < H; gy += 32) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      /* ── 2. Accent border bars ──────────────────────────────────── */
      var tg = ctx.createLinearGradient(0, 0, W, 0);
      tg.addColorStop(0,   acc);
      tg.addColorStop(0.6, _hex2rgba(acc, 0.4));
      tg.addColorStop(1,   _hex2rgba(acc, 0));
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, W, 5);

      var bg2 = ctx.createLinearGradient(0, 0, W, 0);
      bg2.addColorStop(0,   _hex2rgba(acc, 0));
      bg2.addColorStop(0.4, _hex2rgba(acc, 0.4));
      bg2.addColorStop(1,   acc);
      ctx.fillStyle = bg2;
      ctx.fillRect(0, H - 5, W, 5);

      /* Left glow strip */
      var lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0,   _hex2rgba(acc, 0));
      lg.addColorStop(0.5, _hex2rgba(acc, 0.18));
      lg.addColorStop(1,   _hex2rgba(acc, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, 4, H);

      /* ── 3. DuelZone brand (top-left) ───────────────────────────── */
      ctx.fillStyle = acc;
      ctx.fillRect(26, 20, 3, 24);

      ctx.font         = 'bold 15px Arial,sans-serif';
      ctx.fillStyle    = '#ffffff';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('DuelZone', 37, 22);

      ctx.font      = '11px Arial,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.fillText('duelzone.online', 37, 40);

      /* ── 4. Game icon emoji ──────────────────────────────────────── */
      try {
        ctx.font         = '54px serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(_r.icon || '🎮', W / 2, 105);
      } catch (e) {
        /* fallback: coloured circle */
        ctx.beginPath();
        ctx.arc(W / 2, 105, 22, 0, Math.PI * 2);
        ctx.fillStyle = acc;
        ctx.fill();
      }

      /* ── 5. Game name ───────────────────────────────────────────── */
      var gameName = (_safe(_r.game, 28) || 'DUELZONE').toUpperCase();
      ctx.font         = 'bold 28px Arial,sans-serif';
      ctx.fillStyle    = acc;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gameName, W / 2, 163);

      /* Accent underline */
      var ul = ctx.createLinearGradient(W/2 - 150, 0, W/2 + 150, 0);
      ul.addColorStop(0,   _hex2rgba(acc, 0));
      ul.addColorStop(0.5, acc);
      ul.addColorStop(1,   _hex2rgba(acc, 0));
      ctx.strokeStyle = ul;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(W/2 - 150, 178);
      ctx.lineTo(W/2 + 150, 178);
      ctx.stroke();

      /* ── 6. Winner line ─────────────────────────────────────────── */
      var winLine = name
        ? (_safe(name, 20) + (_r.isWin ? ' Wins!' : ' played'))
        : (_safe(_r.winner, 30) || 'WINNER');

      /* Measure text WHILE the correct font is active — before any emoji call */
      ctx.font = 'bold 34px Arial,sans-serif';
      var winW   = ctx.measureText(winLine).width;
      var iconW  = 36;
      var gap    = 8;
      var grpW   = iconW + gap + winW;
      var grpX   = Math.max(16, (W - grpW) / 2);

      /* Trophy emoji */
      try {
        ctx.font         = '28px serif';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏆', grpX, 228);
      } catch (e) { /* skip on platforms that can't render */ }

      /* Winner text — re-set font after emoji call */
      ctx.font         = 'bold 34px Arial,sans-serif';
      ctx.fillStyle    = '#ffffff';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(winLine, grpX + iconW + gap, 228);

      /* ── 7. Detail / score ─────────────────────────────────────── */
      /* _r.detail may contain the · char (U+00B7) which _safe strips.
         Re-build a clean ASCII version instead.                       */
      var rawDetail = (_r.detail || '').replace(/·/g, '-').replace(/[^\x20-\x7E]/g, '');
      if (!rawDetail) {
        var cap = _r.diff ? _r.diff.charAt(0).toUpperCase() + _r.diff.slice(1) : '';
        if (cap && _r.score) rawDetail = cap + ' - ' + _r.score;
        else if (cap)        rawDetail = cap;
        else if (_r.score)   rawDetail = String(_r.score);
      }
      if (rawDetail) {
        ctx.font         = '16px Arial,sans-serif';
        ctx.fillStyle    = 'rgba(255,255,255,0.50)';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rawDetail.slice(0, 60), W / 2, 270);
      }

      /* ── 8. CTA box ────────────────────────────────────────────── */
      var bx = 110, by = 300, bw = 580, bh = 58, br = 10;
      ctx.beginPath();
      ctx.moveTo(bx + br, by);
      ctx.lineTo(bx + bw - br, by);
      ctx.quadraticCurveTo(bx + bw, by,      bx + bw, by + br);
      ctx.lineTo(bx + bw, by + bh - br);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
      ctx.lineTo(bx + br, by + bh);
      ctx.quadraticCurveTo(bx, by + bh,      bx, by + bh - br);
      ctx.lineTo(bx, by + br);
      ctx.quadraticCurveTo(bx, by,           bx + br, by);
      ctx.closePath();
      ctx.fillStyle   = _hex2rgba(acc, 0.08);
      ctx.fill();
      ctx.strokeStyle = _hex2rgba(acc, 0.28);
      ctx.lineWidth   = 1;
      ctx.stroke();

      var cta1 = name
        ? 'I just won at ' + (_safe(_r.game, 20) || 'DuelZone') + '! Can YOU beat my score?'
        : 'Play ' + (_safe(_r.game, 20) || 'DuelZone') + ' on DuelZone - can you beat this?';
      ctx.font         = '14px Arial,sans-serif';
      ctx.fillStyle    = _hex2rgba(acc, 0.90);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cta1.slice(0, 72), W / 2, by + 20);

      ctx.font      = '13px Arial,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.50)';
      ctx.fillText('Tap the link below to accept the challenge!', W / 2, by + 40);

      /* ── 9. Divider ────────────────────────────────────────────── */
      var dg = ctx.createLinearGradient(60, 0, W - 60, 0);
      dg.addColorStop(0,   'rgba(255,255,255,0)');
      dg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      dg.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.strokeStyle = dg;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(60, 374);
      ctx.lineTo(W - 60, 374);
      ctx.stroke();

      /* ── 10. Challenge URL ─────────────────────────────────────── */
      var urlStr = _buildURL(name);
      if (urlStr.length > 68) urlStr = urlStr.slice(0, 68) + '...';
      ctx.font         = '11px Arial,sans-serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.24)';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(urlStr, W / 2, 410);

      /* ── Done ──────────────────────────────────────────────────── */
      if (timedOut) return;
      clearTimeout(tid);
      _cache = cv.toDataURL('image/png');
      callback(_cache);

    } catch (err) {
      clearTimeout(tid);
      console.error('[DZShare] _drawCard failed:', err);
      if (!timedOut) callback(null);
    }
  }

  /* ================================================================
     Modal helpers
     ================================================================ */
  function _getName() {
    var el = document.getElementById('dz-share-name');
    return el ? el.value.trim() : '';
  }

  function _setPreview(state, dataURL) {
    var preview = document.getElementById('dz-share-preview');
    var status  = document.getElementById('dz-share-status');
    if (!preview) return;

    if (state === 'loading') {
      preview.innerHTML = '<div class="dz-share-spinner"></div>';
      if (status) {
        status.textContent = '⏳ Generating your card…';
        status.style.display = 'block';
      }
    } else if (state === 'done' && dataURL) {
      var img = document.createElement('img');
      img.src = dataURL;
      img.style.cssText = 'width:100%;border-radius:8px;display:block;';
      preview.innerHTML = '';
      preview.appendChild(img);
      if (status) status.style.display = 'none';
    } else {
      preview.innerHTML =
        '<div style="color:rgba(255,255,255,0.30);padding:28px;text-align:center;' +
        'font-size:0.82rem;line-height:1.7;">' +
        '⚠️ Could not generate preview.<br>You can still copy the link and share it!' +
        '</div>';
      if (status) status.style.display = 'none';
    }
  }

  /* ================================================================
     openModal  —  shows the share modal and generates the card
     ================================================================ */
  function openModal() {
    var modal    = document.getElementById('dz-share-modal');
    var backdrop = document.getElementById('dz-share-backdrop');
    if (!modal) { console.error('[DZShare] #dz-share-modal not found in DOM'); return; }

    /* Pre-fill name from localStorage */
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.value) {
      try {
        var saved = localStorage.getItem('dz_player_name');
        if (saved) inp.value = saved;
      } catch (e) {}
    }

    if (backdrop) backdrop.classList.add('active');
    modal.classList.add('active');

    _setPreview('loading');

    var name = _getName();
    var safetyTimer = setTimeout(function () { _setPreview('error'); }, 13000);
    _drawCard(name, function (url) {
      clearTimeout(safetyTimer);
      _setPreview(url ? 'done' : 'error', url);
    });
  }

  /* ================================================================
     closeModal
     ================================================================ */
  function closeModal() {
    var modal    = document.getElementById('dz-share-modal');
    var backdrop = document.getElementById('dz-share-backdrop');
    if (modal)    modal.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
  }

  /* ================================================================
     Name input  —  regenerate card when name changes (debounced)
     ================================================================ */
  var _debounce = null;
  function _onNameChange() {
    var inp = document.getElementById('dz-share-name');
    if (!inp) return;
    var name = inp.value.trim();
    try { if (name) localStorage.setItem('dz_player_name', name); } catch (e) {}
    _cache = null;
    clearTimeout(_debounce);
    _setPreview('loading');
    _debounce = setTimeout(function () {
      _drawCard(name, function (url) {
        _setPreview(url ? 'done' : 'error', url);
      });
    }, 650);
  }

  /* ================================================================
     Share actions
     ================================================================ */

  /* WhatsApp — text + link; anchor-click is never blocked by popup blockers */
  function _wa() {
    var name = _getName() || 'Someone';
    var text = [
      '🏆 ' + name + ' just won at ' + (_r.game || 'DuelZone') + ' on DuelZone!',
      _r.detail ? '📊 ' + _r.detail : '',
      '👇 Can YOU beat this score?',
      _buildURL(_getName())
    ].filter(Boolean).join('\n');

    var a        = document.createElement('a');
    a.href       = 'https://wa.me/?text=' + encodeURIComponent(text);
    a.target     = '_blank';
    a.rel        = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* Instagram / Native Share — tries to share with the PNG file on mobile
     (Web Share API with files works on Android Chrome, iOS Safari 15+)     */
  function _ig() {
    var name    = _getName() || 'Someone';
    var caption =
      '🏆 ' + name + ' just won at ' + (_r.game || 'DuelZone') + ' on DuelZone!\n' +
      (_r.detail ? '📊 ' + _r.detail + '\n' : '') +
      '👇 ' + _buildURL(_getName());

    /* Always show caption box so desktop users can copy-paste */
    var box  = document.getElementById('dz-share-ig-caption');
    var wrap = document.getElementById('dz-share-ig-wrap');
    if (box)  box.textContent  = caption;
    if (wrap) wrap.style.display = 'block';

    /* Helper: try native share with image file (mobile) */
    function _nativeShareWithFile(dataURL) {
      if (!navigator.share || !navigator.canShare) return false;
      try {
        /* Convert data-URL → Blob → File */
        var parts = dataURL.split(',');
        var mime  = parts[0].match(/:(.*?);/)[1];
        var raw   = atob(parts[1]);
        var n     = raw.length;
        var u8    = new Uint8Array(n);
        while (n--) u8[n] = raw.charCodeAt(n);
        var file = new File([u8], 'duelzone-' + (_r.slug || 'result') + '.png', { type: mime });
        if (!navigator.canShare({ files: [file] })) return false;
        navigator.share({
          title: (_r.game || 'DuelZone') + ' — DuelZone',
          text:  caption,
          files: [file]
        }).catch(function () {});
        return true;
      } catch (e) { return false; }
    }

    /* Helper: text-only Web Share API fallback */
    function _nativeShareText() {
      if (!navigator.share) return false;
      navigator.share({
        title: (_r.game || 'DuelZone') + ' — DuelZone',
        text:  caption
      }).catch(function () {});
      return true;
    }

    if (_cache) {
      if (!_nativeShareWithFile(_cache)) { if (!_nativeShareText()) _saveImg(); }
      return;
    }

    _drawCard(_getName(), function (url) {
      if (url) {
        if (!_nativeShareWithFile(url)) { if (!_nativeShareText()) _saveImg(); }
      } else {
        if (!_nativeShareText()) _saveImg();
      }
    });
  }

  /* Copy challenge link to clipboard */
  function _copy() {
    var link = _buildURL(_getName());
    var btn  = document.getElementById('dz-share-copy-btn');
    function _done() {
      if (btn) {
        btn.textContent = '✅ Copied!';
        setTimeout(function () { btn.textContent = '🔗 Copy Link'; }, 2000);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(_done).catch(function () { _fbCopy(link); _done(); });
    } else { _fbCopy(link); _done(); }
  }

  /* Copy Instagram caption */
  function _copyCaption() {
    var box = document.getElementById('dz-share-ig-caption');
    var btn = document.getElementById('dz-share-ig-copy');
    if (!box) return;
    var text = box.textContent;
    function _done() {
      if (btn) {
        btn.textContent = '✅ Copied!';
        setTimeout(function () { btn.textContent = '📋 Copy Caption'; }, 2000);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(_done).catch(function () { _fbCopy(text); _done(); });
    } else { _fbCopy(text); _done(); }
  }

  /* Save card PNG to device */
  function _saveImg() {
    function doSave(url) {
      if (!url) return;
      var a      = document.createElement('a');
      a.href     = url;
      a.download = 'duelzone-' + (_r.slug || 'result') + '.png';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    if (_cache) { doSave(_cache); return; }
    _drawCard(_getName(), doSave);
  }

  /* Clipboard fallback for browsers without navigator.clipboard */
  function _fbCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ================================================================
     Beat-score popup  —  shown when Player 2 beats the challenge
     ================================================================ */
  function _showBeatPopup() {
    var pop = document.getElementById('dz-beat-popup');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'dz-beat-popup';
      pop.innerHTML =
        '<div class="dz-beat-inner">' +
          '<div class="dz-beat-emoji">🎉</div>' +
          '<div class="dz-beat-title">You beat <span id="dz-beat-name"></span>\'s score!</div>' +
          '<div class="dz-beat-detail" id="dz-beat-detail"></div>' +
          '<div class="dz-beat-btns">' +
            '<button class="dz-beat-share-btn" ' +
              'onclick="DZShare.openModal();' +
              'document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              '📤 Share it back!</button>' +
            '<button class="dz-beat-close-btn" ' +
              'onclick="document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              'Maybe later</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(pop);
    }
    var n = document.getElementById('dz-beat-name');
    var d = document.getElementById('dz-beat-detail');
    if (n) n.textContent = _ch.name;
    if (d) d.textContent = _r.detail || '';
    pop.classList.add('active');
  }

  /* ================================================================
     Challenge banner  —  shown when page opened via challenge link
     Appears ~1.8 s after page load so it doesn't block content.
     ================================================================ */
  function _showChallengeBanner() {
    if (!_ch.name || !_ch.slug) return;

    var banner = document.getElementById('dz-challenge-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dz-challenge-banner';
      banner.innerHTML =
        '<span class="dz-cb-icon">🏆</span>' +
        '<span class="dz-cb-text">' +
          'Beat <strong id="dz-cb-name"></strong>\'s score of ' +
          '<strong id="dz-cb-score"></strong> in ' +
          '<strong id="dz-cb-game"></strong>!' +
        '</span>' +
        '<button class="dz-cb-close" aria-label="Dismiss" ' +
          'onclick="this.closest(\'#dz-challenge-banner\').classList.remove(\'active\')">' +
          '✕</button>';
      document.body.appendChild(banner);
    }

    var nEl = document.getElementById('dz-cb-name');
    var sEl = document.getElementById('dz-cb-score');
    var gEl = document.getElementById('dz-cb-game');
    if (nEl) nEl.textContent = _ch.name;

    /* Show "24 (Easy)" if diff is known, otherwise just the number */
    var scoreDisplay = _ch.score
      ? (_ch.score + (_ch.diff ? ' (' + _ch.diff.charAt(0).toUpperCase() + _ch.diff.slice(1) + ')' : ''))
      : '—';
    if (sEl) sEl.textContent = scoreDisplay;

    /* Game name — prettify the slug */
    var gamePretty = _ch.slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    if (gEl) gEl.textContent = gamePretty;

    setTimeout(function () { banner.classList.add('active'); }, 1800);
  }

  /* ================================================================
     Init  —  wire name input, ESC key, challenge banner
     ================================================================ */
  function _init() {
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.__dzShareReady) {
      inp.__dzShareReady = true;
      inp.addEventListener('input', _onNameChange);
    }

    if (!window.__dzShareEscWired) {
      window.__dzShareEscWired = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var m = document.getElementById('dz-share-modal');
          if (m && m.classList.contains('active')) closeModal();
        }
      });
    }

    _showChallengeBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 0);
  }

  /* ================================================================
     Public API  —  same surface as v1, fully backward-compatible
     ================================================================ */
  window.DZShare = {
    setResult:    setResult,
    openModal:    openModal,
    closeModal:   closeModal,
    getChallenge: function () { return _ch; },
    /* called directly from onclick attributes in HTML */
    _wa:          _wa,
    _ig:          _ig,
    _copy:        _copy,
    _saveImg:     _saveImg,
    _copyCaption: _copyCaption
  };

})(window);
