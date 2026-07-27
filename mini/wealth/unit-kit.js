/*!
 * unit-kit.js v1.0.0 — 發票載具官方自營小程序 · 共用層
 * 單一資料源。四個單元共用同一份,任何單元都不得自行修改(verify.py 會以 hash 比對擋下)。
 * 無外部依賴;需先載入同目錄的 qrcode.min.js(MIT, kazuhikoarase)。
 *
 * 為什麼要有這一層:
 *   - NAV-STACK 是踩過兩個 P0 bug 才收斂出來的(id 撞號、過場頁誤刪返回堆疊)
 *   - DATA 決定跨頁數字一致性(正式版換中台只改這裡)
 *   - SHARE 決定裂變(圖+圖內 QR:圖被轉傳時文字連結會被剝掉,QR 活著)
 *   三份各寫一次 = 三份各壞一次。
 */
(function (global) {
  'use strict';
  var UK = { version: '1.0.0' };

  /* ═══════════════ 0. DEMO_MODE ═══════════════
     ?demo=0 → 全站自動移除「(示範)/示範數據」標記(含動態文案與 toast)。
     上線前不必逐字拆文案。 */
  UK.DEMO = (function () {
    try { return new URLSearchParams(location.search).get('demo') !== '0'; }
    catch (e) { return true; }
  })();
  var DEMO_RE = /[（(]\s*示範[^）)]*[）)]|示範數據/g;
  UK.dmText = function (t) {
    if (UK.DEMO || !t) return t;
    return String(t).replace(DEMO_RE, '').replace(/\s{2,}/g, ' ').replace(/[，,、·]\s*$/, '').trim();
  };
  UK.applyDemoMode = function (root) {
    if (UK.DEMO) return;
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (DEMO_RE.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(DEMO_RE, '').replace(/\s{2,}/g, ' ');
    }
  };

  /* ═══════════════ 1. DATA — 全站唯一資料源 ═══════════════
     正式版:呼叫 UK.data.load(apiBase) 從中台 /features/summary + /invoices 取真值;
     失敗時保留示範值並回報,畫面不會空掉。單元頁面一律只讀 UK.data.*,不自己寫死數字。 */
  UK.data = {
    /* 三個時間窗口彼此單調一致(30天 < 期別 < 90天),跨頁對得起來 */
    INV: {
      d30:    { n: 47,  shops: 23 },
      period: { label: '05-06月', n: 88 },
      d90:    { n: 128, shops: 61, items: 84 }
    },
    /* 五毒:值 + 權重。雷達列與綜合分都從這裡長出來 */
    POISON: [
      { k: 'sugar', nm: '🧋 糖毒',   v: 82, w: .30 },
      { k: 'oil',   nm: '🍗 油毒',   v: 74, w: .25 },
      { k: 'salt',  nm: '🧂 鈉毒',   v: 58, w: .20 },
      { k: 'proc',  nm: '🥫 加工',   v: 46, w: .15 },
      { k: 'caf',   nm: '☕ 咖啡因', v: 66, w: .10 }
    ],
    source: 'demo',           /* 'demo' | 'platform' */
    /* 綜合毒值 = 最毒一項 ×70% + 其餘平均 ×30%
       仿空品 AQI:取最嚴重項目為主——一項超標不會因為其他項乾淨就變安全。
       不取平均是刻意的;結果頁必須把這行算式印出來(見 UK.data.formula)。 */
    composite: function () {
      var vs = this.POISON.map(function (p) { return p.v; });
      if (!vs.length) return 0;
      var mx = Math.max.apply(null, vs);
      var rest = vs.filter(function (v, i) { return i !== vs.indexOf(mx); });
      var avg = rest.length ? rest.reduce(function (a, b) { return a + b; }, 0) / rest.length : mx;
      return Math.round(mx * 0.7 + avg * 0.3);
    },
    formula: function () {
      var vs = this.POISON.map(function (p) { return p.v; });
      var mx = Math.max.apply(null, vs);
      var rest = vs.filter(function (v, i) { return i !== vs.indexOf(mx); });
      var avg = Math.round(rest.reduce(function (a, b) { return a + b; }, 0) / rest.length * 10) / 10;
      return {
        total: this.composite(), max: mx, avg: avg, topName: this.topPoison(true),
        text: '綜合毒值 ' + this.composite() + ' ＝ 最毒的一項（' + this.topPoison(true) + ' ' + mx + '）×70% ＋ 其餘平均（' + avg + '）×30%',
        why: '為什麼不取平均：一項超標，不會因為其他項乾淨就變安全（同空品 AQI 的取法）'
      };
    },
    topPoison: function (nameOnly) {
      var top = this.POISON[0] || { nm: '', v: 0 };
      this.POISON.forEach(function (p) { if (p.v > top.v) top = p; });
      return nameOnly ? String(top.nm).replace(/^\S+\s*/, '') : top;
    },
    /* 發票張數(空狀態門檻用)。?inv=N 可演示不同張數。 */
    invCount: function () {
      try {
        var q = new URLSearchParams(location.search).get('inv');
        if (q !== null) return (+q || 0);
      } catch (e) {}
      return this.INV.d30.n;
    },
    MIN_INV: 5,
    /* 接中台:成功→source='platform';失敗→保留示範值(畫面不空) */
    load: function (apiBase) {
      var self = this;
      if (!apiBase || !global.fetch) return Promise.resolve(self);
      return fetch(apiBase.replace(/\/$/, '') + '/features/summary', { credentials: 'include' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          if (j && j.invoices) self.INV = j.invoices;
          if (j && j.poison && j.poison.length) self.POISON = j.poison;
          self.source = 'platform';
          return self;
        })
        .catch(function (e) {
          if (global.console) console.warn('[unit-kit] /features/summary 取用失敗，沿用示範值：', e.message);
          return self;
        });
    }
  };

  /* ═══════════════ 2. STATE — 持久化 / 回訪 / 趨勢 ═══════════════
     production 判準之一:狀態記得住。回訪要看得到上次結果與變化。 */
  UK.state = {
    load: function (key) {
      try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
    },
    save: function (key, obj) {
      try { obj.at = Date.now(); localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
      return obj;
    },
    ago: function (t) {
      if (!t) return '';
      var d = Math.floor((Date.now() - t) / 86400000);
      return d <= 0 ? '今天' : (d === 1 ? '昨天' : (d < 30 ? d + ' 天前' : '很久以前'));
    },
    /* 回訪盒:上次數值 + 趨勢角標 + 一顆「看上次結果」 */
    lastBox: function (o) {
      var trend = '';
      if (typeof o.prev === 'number' && o.prev !== o.n) {
        var d = o.n - o.prev;
        trend = '<i class="' + (d < 0 ? 'dn' : 'up') + '">' + (d < 0 ? '▼' : '▲') + Math.abs(d) + '</i>';
      }
      return '<div class="uk-lastbox"><div><small>' + (o.label || '上次') + ' · ' + this.ago(o.at) + '</small>'
           + '<b>' + o.n + '<span>' + (o.unit || '') + '</span>' + trend + '</b></div>'
           + '<button class="uk-lastgo" onclick="' + (o.onclick || '') + '">看上次結果 ›</button></div>';
    },
    /* 趨勢帶(結果頁頂):有上次且有變化才顯示 */
    trendHTML: function (cur, prev, unit) {
      if (typeof prev !== 'number' || prev === cur) return '';
      var d = cur - prev, dn = d < 0;
      return '上次 ' + prev + ' → 這次 <b>' + cur + '</b>　<span class="' + (dn ? 'dn' : 'up') + '">'
           + (dn ? '▼ 降了 ' + Math.abs(d) : '▲ 又漲了 ' + d) + '</span>';
    }
  };

  /* ═══════════════ 3. NAV — 返回堆疊 ═══════════════
     ⚠️ 這是踩過兩個 P0 bug 收斂出來的邏輯,不要重寫:
       bug1: 靜態視圖與 JS 注入視圖 id 撞號 → 功能永遠打不開(所以 views 必須顯式列出)
       bug2: 站在「過場頁/一次性頁」按返回會 pop 掉真正的上一頁 → 追蹤 current,
             不在堆疊頂時只回堆疊頂、不 pop
     transient = 過場動畫頁、一次性頁(空狀態):進得去但不入堆疊、也不會被誤刪。 */
  UK.nav = {
    create: function (cfg) {
      var views = cfg.views || [];
      var transient = cfg.transient || [];
      var render = cfg.render;                        /* function(view) 實際切畫面 */
      var sheets = cfg.sheets || function () { return []; }; /* 回傳目前開著的浮層 close 函式陣列 */
      var stack = [], cur = null, popping = false;
      /* 堆疊見底 → 一律回發票載具首頁(嵌入時 postMessage,單機時導回殼)。
         單元傳的 onHome 只在非嵌入時當備援。 */
      function goHome() {
        if (UK.embedded()) { UK.exitToHome(); return; }
        UK.exitToHome(cfg.onHome);
      }

      function isTrans(v) { return transient.indexOf(v) > -1; }
      function mark(v) {
        cur = v;
        if (isTrans(v)) return;
        if (stack[stack.length - 1] !== v) {
          stack.push(v);
          if (!popping) { try { history.pushState({ uk: 1 }, ''); } catch (e) {} }
        }
      }
      function paint(v) { popping = true; render(v); cur = v; popping = false; }

      var api = {
        views: views,
        show: function (v) {
          if (views.indexOf(v) < 0 && global.console) console.warn('[unit-kit] 未登記的 view:', v);
          mark(v); render(v);
        },
        back: function () {
          /* 浮層開著時:返回=關浮層,不動頁面 */
          var open = sheets();
          for (var i = 0; i < open.length; i++) { if (open[i]()) return; }
          var top = stack[stack.length - 1];
          if (cur !== top) { if (top) paint(top); else goHome(); return; }
          stack.pop();
          var prev = stack[stack.length - 1];
          if (!prev) goHome(); else paint(prev);
        },
        reset: function (v) { stack = []; cur = null; if (v) api.show(v); },
        current: function () { return cur; },
        depth: function () { return stack.length; }
      };
      global.addEventListener('popstate', function () { api.back(); });
      return api;
    }
  };

  /* ═══════════════ 3.5 HOME — 回發票載具首頁 ═══════════════
     正式環境:App 用 webview 開單元,「返回」要回到 App 首頁的小程序列。
     開發環境:測試殼(5180)用 iframe 開單元 → 用 postMessage 請殼關掉 webview。
     單機直開(5181/5182/5183):導回測試殼首頁,讓「先進首頁再點單元」這條路永遠存在。

     ⚠️ 這是 kit 層的保證:nav 在「堆疊見底」時一律走這裡,單元不必也不該自己實作。
        (單元傳的 onHome 只在「非嵌入」時當備援,嵌入時一律 postMessage——
         否則某個單元寫成 toast,在殼裡就變成死路。) */
  UK.HOME = 'http://localhost:5180/';        /* 測試殼;正式版由 App 接手,不會用到 */
  UK.embedded = function () {
    try { return global.parent && global.parent !== global; } catch (e) { return false; }
  };
  UK.exitToHome = function (fallback) {
    /* 1) 嵌在測試殼／App webview 裡 → 請上層關掉 */
    if (UK.embedded()) {
      try { global.parent.postMessage({ uk: 'home', from: (global.UK_SLUG || document.title) }, '*'); return true; } catch (e) {}
    }
    /* 2) 正式 App 的原生橋(有就用) */
    try { if (global.fapiao && global.fapiao.close) { global.fapiao.close(); return true; } } catch (e) {}
    /* 3) 單機直開 → 導回載具首頁(小程序列在那裡) */
    if (typeof fallback === 'function') { fallback(); return true; }
    if (UK.HOME) { global.location.href = UK.HOME; return true; }
    UK.toast('回發票載具首頁');
    return false;
  };
  /* 單機直開時,頁面頂端掛一條「從發票載具首頁進入」——
     讓正規入口(首頁 → 小程序列 → 單元)永遠看得到,但不擋開發直開。 */
  UK.homeHint = function () {
    if (UK.embedded() || document.getElementById('uk-homehint')) return;
    var a = document.createElement('a');
    a.id = 'uk-homehint'; a.href = UK.HOME;
    a.textContent = '⬅ 從發票載具首頁進入（正規路徑：首頁 → 小程序 → 這裡）';
    document.body.appendChild(a);
  };

  /* ═══════════════ 4. TOAST ═══════════════ */
  UK.toast = function (msg) {
    msg = UK.dmText(msg);
    var t = document.getElementById('uk-toast');
    if (!t) { t = document.createElement('div'); t.id = 'uk-toast'; t.className = 'uk-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 2400);
  };

  /* ═══════════════ 5. SHOPS — 商家小程序註冊表 ═══════════════
     解毒站/好去處要能直達「真的在小程序商店開通的那個商家 App」。
     點到店家頁格式:https://dotdao-eat.cmoney.tw/{shopId}/order  (shopId = 點到 Shop UUID)
     取得方式:掃店內桌卡 QR,或商家後台 → 顧客點餐連結。點到沒有公開的店家清單 API。
     未開通的商家**不給假的點餐入口**——有開通 vs 沒開通的對比就是 BD 的說服素材。 */
  UK.shops = {
    BASE: 'https://dotdao-eat.cmoney.tw',
    REGISTRY: {
      nnw:     { name: '暖暖窩義式廚房',        platform: '點到', shopId: '', registered: true  },
      yuanwei: { name: '原味時代健康餐盒 府中店', platform: null,  shopId: '', registered: false },
      guoyang: { name: '果漾 Fresh 冷壓蔬果飲',   platform: null,  shopId: '', registered: false }
    },
    /* null = 未開通;'' = 已開通但 shopId 待填;字串 = 可直達 */
    url: function (k) {
      var sh = this.REGISTRY[k];
      if (!sh || !sh.registered) return null;
      return sh.shopId ? (this.BASE + '/' + sh.shopId + '/order') : '';
    },
    open: function (k) {
      var u = this.url(k);
      if (u === null) { UK.toast('這家還沒開通線上點餐——先幫你導航過去'); return false; }
      if (u === '')   { UK.toast('店家連結待填：掃店內桌卡 QR 或到商家後台複製顧客點餐連結'); return false; }
      UK.track('shop_open', { shop: k });
      global.open(u, '_blank'); return true;
    },
    tag: function (k) {
      var u = this.url(k);
      return u === null ? '尚未開通線上點餐' : '📱 可線上點餐';
    }
  };

  /* ═══════════════ 6. TRACK ═══════════════ */
  UK.apiBase = null;
  UK.track = function (ev, extra) {
    try {
      if (global.console) console.log('[track]', ev, extra || {});
      if (UK.apiBase && global.fetch) {
        fetch(UK.apiBase.replace(/\/$/, '') + '/track', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: ev, props: extra || {} })
        }).catch(function () {});
      }
    } catch (e) {}
  };

  /* ═══════════════ 7. POI — 地點卡 bottom sheet ═══════════════
     推薦理由綁回發票證據;合作商家 CTA=看菜單(直達其店家頁),其餘=帶我去(Maps)。
     每一次點擊都 track:非合作店的點擊熱榜 = 引流商家開通名單的需求證據。 */
  UK.poi = {
    _el: null,
    open: function (row, dict) {
      var k = row.getAttribute('data-poi'), p = dict[k];
      if (!p) return;
      var shopKey = row.getAttribute('data-shop') || null;
      UK.track('poi_tap', { poi: k, shop: shopKey });
      var m = this._el;
      if (!m) {
        m = document.createElement('div'); m.id = 'uk-poi'; m.className = 'uk-mask';
        m.innerHTML = '<div class="uk-sheet uk-poi-sheet">'
          + '<div class="uk-poi-emoji"></div><b class="uk-poi-name"></b>'
          + '<div class="uk-poi-why"></div><div class="uk-poi-info"></div>'
          + '<div class="uk-poi-btns"><button class="uk-btn-go"></button><button class="uk-btn-add"></button></div>'
          + '<button class="uk-sheet-cancel">關閉</button></div>';
        m.onclick = function (e) { if (e.target === m) UK.poi.close(); };
        m.querySelector('.uk-sheet-cancel').onclick = function () { UK.poi.close(); };
        document.body.appendChild(m); this._el = m;
      }
      m.querySelector('.uk-poi-emoji').textContent = p.emoji || '📍';
      m.querySelector('.uk-poi-name').textContent = p.name;
      m.querySelector('.uk-poi-why').textContent = p.why || '';
      var extra = shopKey ? '　·　' + UK.shops.tag(shopKey) : '';
      m.querySelector('.uk-poi-info').textContent = (p.info || '') + extra;

      var go = m.querySelector('.uk-btn-go');
      var canOrder = shopKey && UK.shops.url(shopKey) !== null;
      function nav() { global.open('https://maps.google.com/?q=' + encodeURIComponent(p.q || p.name), '_blank'); }
      if (canOrder) {
        go.textContent = '🍝 看菜單，先點起來';
        go.onclick = function () { if (!UK.shops.open(shopKey)) nav(); };
      } else {
        go.textContent = '🧭 帶我去';
        go.onclick = function () { UK.track('poi_nav', { poi: k }); nav(); };
      }
      /* 第二顆按鈕:與列表列的按鈕雙向同步(交給單元用 onAdd 定義行為) */
      var add = m.querySelector('.uk-btn-add');
      var vf = row.querySelector('.uk-vf');
      function sync() {
        var done = vf && vf.classList.contains('done');
        add.textContent = done ? '✅ 已排入' : (p.addLabel || '就衝這家');
        add.classList.toggle('done', !!done);
      }
      sync();
      add.onclick = function () { if (p.onAdd) p.onAdd(vf, row); sync(); };
      m.classList.add('on');
      try { history.pushState({ uk: 1 }, ''); } catch (e) {}
    },
    close: function () { if (this._el) { this._el.classList.remove('on'); return true; } return false; },
    isOpen: function () { return !!(this._el && this._el.classList.contains('on')); },
    /* 委派:整列可點,但按鈕區不觸發 sheet */
    bind: function (dict, selector) {
      document.addEventListener('click', function (e) {
        if (!e.target.closest) return;
        var row = e.target.closest(selector || '[data-poi]');
        if (!row || e.target.closest('button')) return;
        UK.poi.open(row, dict);
      });
    }
  };

  /* ═══════════════ 8. SHARE — 一張圖 + 圖內 QR ═══════════════
     0724 定調:不做多社群尺寸選單。單一 4:5 圖卡(IG/FB/LINE 通吃),
     回鏈長在圖裡(QR)——圖被轉傳時文字與連結會被剝掉,QR 活著。
     入口極簡:右上 ⋯ → 複製連結。 */
  UK.share = {
    SIZE: { w: 1080, h: 1350 },
    /* 0727 改亮底:動態消息裡亮色卡比深色卡跳,而且和 App 本體(白底)一致。
       要改回深色只要換這張表,版面 code 不用動。 */
    THEME: {
      detox:  { bg:'#FFF1EC', bg2:'#FFDCD0', card:'#FFFBF9', ink:'#2A1416', accent:'#E4001A',
                head:'#C8321F', mut:'#96777B', sub2:'#6B4A4E', brand:'#B09296', line:'#F2CFC6' },
      bored:  { bg:'#EEF3FF', bg2:'#D8E4FF', card:'#FBFCFF', ink:'#101A33', accent:'#2E5BE0',
                head:'#2E5BE0', mut:'#7C88A6', sub2:'#44547A', brand:'#98A3BE', line:'#D3DEF7' },
      wcheck: { bg:'#FFF8EA', bg2:'#FFE9BE', card:'#FFFDF8', ink:'#2B1F08', accent:'#C98A00',
                head:'#A9720B', mut:'#9A8968', sub2:'#6B5A3C', brand:'#BCAD8E', line:'#F3E2BF' }
    },
    _get: null,
    /* getCard: function() → {theme,emoji,acc,sub,tint,score,unitTxt,head,punch,stamp,title,text,url} */
    open: function (getCard) {
      this._get = getCard;
      var m = document.getElementById('uk-share');
      if (!m) {
        m = document.createElement('div'); m.id = 'uk-share'; m.className = 'uk-mask';
        m.innerHTML = '<div class="uk-sheet">'
          + '<div class="uk-sheet-hd"><span id="uk-share-ttl">分享卡</span><button class="uk-x">✕</button></div>'
          + '<div class="uk-share-prev"><canvas id="uk-share-cv"></canvas></div>'
          + '<div class="uk-note">一張圖＋QR，IG／FB／LINE 都吃這張；掃碼直達</div>'
          + '<div class="uk-share-btns"><button class="uk-btn-share">📤 分享這張圖</button>'
          + '<button class="uk-btn-dl">⬇️ 下載</button></div></div>';
        m.onclick = function (e) { if (e.target === m) UK.share.close(); };
        m.querySelector('.uk-x').onclick = function () { UK.share.close(); };
        m.querySelector('.uk-btn-share').onclick = function () { UK.share.send(); };
        m.querySelector('.uk-btn-dl').onclick = function () { UK.share.download(); };
        document.body.appendChild(m);
      }
      this.render(); m.classList.add('on');
      try { history.pushState({ uk: 1 }, ''); } catch (e) {}
      UK.track('share_open');
    },
    close: function () {
      var m = document.getElementById('uk-share');
      if (m && m.classList.contains('on')) { m.classList.remove('on'); return true; }
      return false;
    },
    isOpen: function () { var m = document.getElementById('uk-share'); return !!(m && m.classList.contains('on')); },
    render: function () {
      var d = this._get && this._get(); if (!d) return;
      var p = this.SIZE, T = this.THEME[d.theme] || this.THEME.detox;
      var cv = document.getElementById('uk-share-cv'); cv.width = p.w; cv.height = p.h;
      var ctx = cv.getContext('2d'), cx = p.w / 2;
      document.getElementById('uk-share-ttl').textContent = (d.title || '分享卡') + '・分享卡';

      /* ══ 分享卡版面(0727 v2 · 三支自營小程式共用) ══
         參考順豐年度報告卡。它看起來不擠不是因為字少,是因為分區:
         一張內卡把「數字／結論／角色」框在一起,CTA 獨立在外面,
         所以每一區只跟自己競爭。舊版九個文字區塊平舖在同一平面,
         每一塊都在搶注意力,結果數字和 CTA 都不突出。

         這一版做三件事:
         1. 去重:sub 若把分數又講一次就整行不畫;診斷章直接拿掉
            (結論色塊已經在扮演「判定徽章」,兩個一起出現就是重複)。
         2. 數字放大到 150px 並拿掉光暈——亮底上實色才讀得清楚。
         3. CTA 變成看得出可以按的物件:搜尋框造型 + 單元名(照抄參考卡),
            不再是一行小字。
         資料契約沒變,單元一行都不用改。 */
      var FONT = '"PingFang TC","Noto Sans TC",sans-serif';
      function rr(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      }
      /* 三支文案長度不一,字級不能寫死——縮到裝得下為止 */
      function fit(txt, weight, start, maxW) {
        var s = start;
        while (s > 20) {
          ctx.font = weight + ' ' + s + 'px ' + FONT;
          if (ctx.measureText(txt || '').width <= maxW) break;
          s -= 4;
        }
        return s;
      }
      /* 底 */
      var lg = ctx.createLinearGradient(0, 0, 0, p.h);
      lg.addColorStop(0, T.bg); lg.addColorStop(1, T.bg2);
      ctx.fillStyle = lg; ctx.fillRect(0, 0, p.w, p.h);
      ctx.textAlign = 'center';

      /* ① 頂部標題帶(內卡外面) */
      ctx.fillStyle = T.head; fit(d.head || '', '800', 40, p.w - 150);
      ctx.fillText(d.head || '', cx, 94);

      /* 內卡:分區的關鍵。角色會被它的下緣裁掉 */
      var CX0 = 52, CY0 = 132, CW = p.w - 104, CH = 986, CY1 = CY0 + CH;
      ctx.save();
      rr(CX0, CY0, CW, CH, 46);
      ctx.fillStyle = T.card; ctx.fill();
      ctx.strokeStyle = T.line; ctx.lineWidth = 3; ctx.stroke();
      ctx.clip();                                   /* 之後畫的東西都被內卡裁切 */

      /* ② 數字:實色、無光暈,亮底上才讀得清楚 */
      ctx.fillStyle = T.accent; ctx.font = '900 150px ' + FONT;
      ctx.fillText(String(d.score), cx, 316);
      if (d.unitTxt) {
        ctx.fillStyle = T.mut; ctx.font = '700 32px ' + FONT;
        ctx.fillText(d.unitTxt, cx, 362);
      }
      ctx.fillStyle = T.accent; rr(cx - 88, 386, 176, 7, 4); ctx.fill();

      /* ③ 大字結論:整張卡的第一視覺。
            sub 若把分數又講一次(例:「無聊值 91／100」)就不畫——重複佔掉最大的一行 */
      var y = 500;
      var dupe = d.sub && String(d.score) && d.sub.indexOf(String(d.score)) > -1;
      /* fit() 一定要呼叫來抓行距,即使不畫——不然「跳過 sub」會在角色前面
         留一塊沒東西的空白(dupe 那格文字比較短,但下面的角色錨點沒有跟著往上提)。 */
      var f1 = fit(d.sub || '示', '900', 108, CW - 90);
      if (d.sub && !dupe) {
        ctx.fillStyle = T.ink; ctx.font = '900 ' + f1 + 'px ' + FONT;
        ctx.fillText(d.sub, cx, y);
      }
      y += f1 * .30;
      if (d.tint) {
        var f2 = fit(d.tint, '900', 108, CW - 150);
        ctx.font = '900 ' + f2 + 'px ' + FONT;
        var tw = ctx.measureText(d.tint).width, bh = f2 * 1.36;
        ctx.fillStyle = T.accent; rr(cx - tw / 2 - 34, y + 24, tw + 68, bh, 22); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.font = '900 ' + f2 + 'px ' + FONT;
        ctx.fillText(d.tint, cx, y + 24 + bh * .76);
        y += 24 + bh;
      }
      /* ④ 一句說明 */
      if (d.punch) {
        ctx.fillStyle = T.sub2; fit(d.punch, '700', 36, CW - 120);
        ctx.fillText(d.punch, cx, y + 60);
      }
      /* ⑤ 主視覺角色:被內卡下緣裁掉,裁切感=有設計過 */
      var fs = 400;
      ctx.font = fs + 'px sans-serif'; ctx.fillText(d.emoji || '', cx, CY1 + 76);
      if (d.acc) { ctx.font = (fs * .34) + 'px sans-serif'; ctx.fillText(d.acc, cx + fs * .46, CY1 + 76 - fs * .58); }
      ctx.restore();                                 /* 解除裁切 */

      /* ⑥ CTA:0727 二次修正——使用者指出「應該是叫人去搜尋發票載具本身」。
            小程式(解毒吧)不是全域可搜尋的東西,搜它的名字什麼都搜不到;
            能被搜到、能被安裝的是容器 App「發票載具」。所以搜尋框裡要放的
            字是固定的「發票載具」,不是各單元自己的名字/報告名——
            上一版把參考卡的「顺丰2025年度报告」誤讀成「小程式名稱該進搜尋框」,
            但那張卡成立的前提是順豐 App 已經裝了、搜的是 App 內的報告;
            我們的情境反過來,使用者要搜的是「發票載具」這個入口本身。
            單元自己的催促語(qrHint)退回當唯一的引導句,不再需要額外一行
            講「打開哪個 App」——因為搜尋框已經直接示範了要搜什麼。 */
      var by = CY1 + 34, TX = 292;
      try {
        var q = global.qrcode(0, 'M'); q.addData(d.url || location.href); q.make();
        var n = q.getModuleCount(), qs = 152, cell = qs / n, pad = 14, qx = 74, qy = by + 4;
        ctx.fillStyle = '#FFF'; rr(qx - pad, qy - pad, qs + pad * 2, qs + pad * 2, 14); ctx.fill();
        ctx.strokeStyle = T.line; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#111';
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
      } catch (e) { if (global.console) console.warn('[unit-kit] QR 產生失敗(qrcode.min.js 沒載入?)', e); }
      ctx.textAlign = 'left';
      ctx.fillStyle = T.ink; fit(d.qrHint || '掃碼，開啟發票載具', '800', 30, p.w - TX - 70);
      ctx.fillText(d.qrHint || '掃碼，開啟發票載具', TX, by + 34);
      var pw = p.w - TX - 74, ph = 78, py = by + 58;
      ctx.strokeStyle = T.ink; ctx.lineWidth = 4; rr(TX, py, pw, ph, 39); ctx.stroke();
      ctx.fillStyle = T.ink; ctx.font = '700 30px ' + FONT;
      ctx.fillText('🔍', TX + 26, py + 51);
      /* 固定字,不是單元的 head/title——搜這個名字才搜得到東西 */
      ctx.fillStyle = T.ink; ctx.font = '900 34px ' + FONT;
      ctx.fillText('發票載具', TX + 76, py + 52);
      ctx.textAlign = 'center';
      ctx.fillStyle = T.brand; ctx.font = '700 22px ' + FONT;
      ctx.fillText(UK.dmText('發票載具 × 官方自營（示範）'), cx, p.h - 26);
    },
    _blob: function (cb) { document.getElementById('uk-share-cv').toBlob(cb, 'image/png'); },
    send: function () {
      var d = this._get && this._get(); if (!d) return;
      this._blob(function (blob) {
        var file = new File([blob], 'fapiao-card.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: d.text }).catch(function () {});
        } else if (navigator.share) {
          navigator.share({ title: d.title, text: d.text, url: d.url }).catch(function () {});
        } else {
          UK.toast('已下載圖卡——貼到社群，QR 就是回程票'); UK.share.download();
        }
        UK.track('share_send', { title: d.title });
      });
    },
    download: function () {
      this._blob(function (blob) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'fapiao-card.png'; a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      });
    }
  };

  /* ═══════════════ 9. MENU — ⋯ 極簡選單(0728:分享 + 複製連結) ═══════════════
     0724 定調的是「不做多社群尺寸選單」,不是「不能分享」——複製連結是給
     沒有 Web Share API 的桌機瀏覽器當退路,手機上應該直接跳系統分享面板
     (LINE/IG/簡訊都在那裡面),不是每次都手動複製再自己去貼。
     meta 可選:{title, text},沒給就用 document.title / 空字串。 */
  UK.menu = {
    open: function (link, meta) {
      var m = document.getElementById('uk-menu');
      if (!m) {
        m = document.createElement('div'); m.id = 'uk-menu'; m.className = 'uk-mask';
        m.innerHTML = '<div class="uk-sheet">'
          + '<button class="uk-sheet-item" id="uk-native-share">📤 分享</button>'
          + '<button class="uk-sheet-item" id="uk-copy">🔗 複製連結</button>'
          + '<button class="uk-sheet-cancel">取消</button></div>';
        m.onclick = function (e) { if (e.target === m) UK.menu.close(); };
        m.querySelector('.uk-sheet-cancel').onclick = function () { UK.menu.close(); };
        document.body.appendChild(m);
      }
      var lk = link || location.href.split('?')[0];
      var title = (meta && meta.title) || document.title;
      var text = (meta && meta.text) || '';
      function copyToClipboard() {
        function ok() { UK.toast('連結已複製，貼給朋友'); UK.menu.close(); }
        function ng() { global.prompt('長按複製連結', lk); UK.menu.close(); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lk).then(ok, ng);
        else ng();
      }
      m.querySelector('#uk-native-share').onclick = function () {
        if (navigator.share) {
          UK.menu.close();
          navigator.share({ title: title, text: text, url: lk }).then(function () {
            UK.track('menu_share', { via: 'native' });
          }).catch(function () {});   /* 使用者自己取消分享面板,不是錯誤,不用處理 */
        } else {
          /* 桌機瀏覽器常常沒有系統分享面板:退回複製連結,不當死按鈕 */
          copyToClipboard();
        }
      };
      m.querySelector('#uk-copy').onclick = copyToClipboard;
      m.classList.add('on');
      try { history.pushState({ uk: 1 }, ''); } catch (e) {}
    },
    close: function () {
      var m = document.getElementById('uk-menu');
      if (m && m.classList.contains('on')) { m.classList.remove('on'); return true; }
      return false;
    },
    isOpen: function () { var m = document.getElementById('uk-menu'); return !!(m && m.classList.contains('on')); }
  };

  /* ═══════════════ 9.5 CARRIER — 手機條碼(消費鏈路的最後一哩) ═══════════════
     0728 定調:三支小程式不能只做到「好玩」。要走完
     「進場 → 被推去某家店 → 真的消費 → 用載具開發票 → 數據回流」這條鏈路,
     消費當下就得叫得出條碼。原本三支都只在「發票太少」的空狀態提到條碼,
     而且做法是把人踢回載具首頁自己找——人踢出去,這一趟就斷在那裡了。

     所以條碼改成「浮層」:在店裡、在結帳前的那一刻直接蓋在當前頁上,
     關掉就回到原本在看的東西,不離開單元。

     ⚠️ 條碼字串正式版一定要由載具 App / 中台給(那是使用者真實的載具號)。
        單元啟動時用 UK.carrier.setCode(來自平台的載具號) 注入。
        沒注入時走 DEMO 字串,而且畫面上會標「示範」——不假裝是真的。 */
  UK.carrier = {
    DEMO: '/AB12345',
    _code: null,
    setCode: function (c) { this._code = c || null; return this; },
    code: function () { return this._code || this.DEMO; },
    isReal: function () { return !!this._code; },

    /* Code 39:每個字 9 個元素(5 條 + 4 空),其中 3 個是寬的。
       真的照規格編碼,不是畫個好看的假條碼——示範時掃得出來才有意義。 */
    _C39: {
      '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw',
      '5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
      'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn',
      'F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
      'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn',
      'P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
      'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn',
      'Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','$':'nwnwnwnnn',
      '/':'nwnwnnnwn','+':'nwnnnwnwn','%':'nnnwnwnwn','*':'nwnnwnwnn'
    },
    _draw: function (cv, code) {
      var self = this, s = '*' + String(code).toUpperCase() + '*', pats = [];
      for (var i = 0; i < s.length; i++) {
        var p = self._C39[s.charAt(i)];
        if (!p) return false;                       /* 有不能編碼的字就整個不畫,不畫半套 */
        pats.push(p);
      }
      var NARROW = 3, WIDE = 9, GAP = 3, H = 76;
      var units = 0;
      pats.forEach(function (p, i) {
        for (var j = 0; j < 9; j++) units += (p.charAt(j) === 'w' ? WIDE : NARROW);
        if (i < pats.length - 1) units += GAP;
      });
      var PAD = 14;
      cv.width = units + PAD * 2; cv.height = H + PAD * 2;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#111';
      var x = PAD;
      pats.forEach(function (p, i) {
        for (var j = 0; j < 9; j++) {
          var w = (p.charAt(j) === 'w' ? WIDE : NARROW);
          if (j % 2 === 0) ctx.fillRect(x, PAD, w, H);   /* 偶數 index = 條,奇數 = 空 */
          x += w;
        }
        if (i < pats.length - 1) x += GAP;
      });
      return true;
    },

    /* opts.onDone:店員掃完之後單元想接的動作(例:標記這次消費、推下一步) */
    open: function (opts) {
      opts = opts || {};
      var m = document.getElementById('uk-carrier');
      if (!m) {
        m = document.createElement('div'); m.id = 'uk-carrier'; m.className = 'uk-mask';
        m.innerHTML = '<div class="uk-sheet">'
          + '<div class="uk-sheet-hd"><span>我的手機條碼</span><button class="uk-x">✕</button></div>'
          + '<div class="uk-carrier-wrap"><canvas id="uk-carrier-cv"></canvas>'
          + '<div class="uk-carrier-code" id="uk-carrier-code">—</div></div>'
          + '<div class="uk-carrier-hint" id="uk-carrier-hint"></div>'
          + '<button class="uk-sheet-item uk-carrier-done" id="uk-carrier-done">✅ 店員掃好了</button>'
          + '<button class="uk-sheet-cancel">關閉</button></div>';
        m.onclick = function (e) { if (e.target === m) UK.carrier.close(); };
        m.querySelector('.uk-x').onclick = function () { UK.carrier.close(); };
        m.querySelector('.uk-sheet-cancel').onclick = function () { UK.carrier.close(); };
        document.body.appendChild(m);
      }
      var code = this.code();
      this._draw(document.getElementById('uk-carrier-cv'), code);
      document.getElementById('uk-carrier-code').textContent = code;
      document.getElementById('uk-carrier-hint').innerHTML =
        '結帳時給店員掃 → 發票自動歸戶，不用拍不用存'
        + (this.isReal() ? '' : '<br><span class="uk-carrier-demo">示範條碼 · 正式版會帶出你自己的載具號</span>');
      document.getElementById('uk-carrier-done').onclick = function () {
        UK.track('carrier_done', { from: opts.from || '' });
        UK.carrier.close();
        if (opts.onDone) opts.onDone();
        else UK.toast('這張發票會自動進你的載具（示範）');
      };
      m.classList.add('on');
      try { history.pushState({ uk: 1 }, ''); } catch (e) {}
      UK.track('carrier_open', { from: opts.from || '' });
    },
    close: function () {
      var m = document.getElementById('uk-carrier');
      if (m && m.classList.contains('on')) { m.classList.remove('on'); return true; }
      return false;
    },
    isOpen: function () { var m = document.getElementById('uk-carrier'); return !!(m && m.classList.contains('on')); }
  };

  /* 給 nav 用的浮層關閉序(返回鍵優先關浮層) */
  UK.sheetClosers = function () {
    return [
      function () { return UK.carrier.close(); },
      function () { return UK.poi.close() && UK.poi.isOpen() === false && true; },
      function () { return UK.menu.close(); },
      function () { return UK.share.close(); }
    ].map(function (f) { return f; });
  };
  /* 更精確的版本:只在真的有開著的浮層時才吃掉返回 */
  UK.closeTopSheet = function () {
    if (UK.carrier.isOpen()) { UK.carrier.close(); return true; }  /* 條碼會蓋在地點卡上,要最先關 */
    if (UK.poi.isOpen())   { UK.poi.close();   return true; }
    if (UK.menu.isOpen())  { UK.menu.close();  return true; }
    if (UK.share.isOpen()) { UK.share.close(); return true; }
    return false;
  };

  /* ═══════════════ 10. CHIPS — 單選組(可取消選取) ═══════════════
     Robert 指定:所有選項鈕再點一次要能取消,並回中性值。
     用法:UK.chips.bind(container, {onPick:function(key,val){}}) — 需要 data-k / data-v。 */
  UK.chips = {
    bind: function (root, cfg) {
      (root || document).querySelectorAll('[data-chips]').forEach(function (g) {
        g.addEventListener('click', function (e) {
          var b = e.target.closest('[data-v]'); if (!b) return;
          var was = b.classList.contains('on');
          g.querySelectorAll('[data-v]').forEach(function (c) { c.classList.remove('on'); });
          var key = g.getAttribute('data-chips');
          if (was) { cfg.onPick && cfg.onPick(key, null, true); }
          else { b.classList.add('on'); cfg.onPick && cfg.onPick(key, b.getAttribute('data-v'), false); }
        });
      });
    }
  };

  /* ═══════════════ 11. CSS(一次性注入)═══════════════
     浮層/回訪盒/toast/chip 的樣式由 kit 提供,四單元外觀一致。
     單元只負責自己的頁面樣式,不要複製這些。 */
  var CSS = ''
  + '.uk-toast{position:fixed;left:50%;bottom:calc(30px + env(safe-area-inset-bottom,0));transform:translateX(-50%) translateY(20px);background:#1F2430;color:#fff;font-size:13px;font-weight:700;padding:11px 18px;border-radius:99px;opacity:0;transition:.25s;pointer-events:none;max-width:88vw;text-align:center;z-index:9999}'
  + '.uk-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}'
  + '.uk-mask{position:fixed;inset:0;background:rgba(15,20,30,.5);display:none;align-items:flex-end;z-index:9000}'
  + '.uk-mask.on{display:flex}'
  + '.uk-sheet{width:100%;max-width:430px;margin:0 auto;background:#fff;border-radius:20px 20px 0 0;padding:14px 14px calc(16px + env(safe-area-inset-bottom,0));max-height:88%;overflow-y:auto;text-align:center}'
  + '.uk-sheet-hd{display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:800;color:#1F2430}'
  + '.uk-x{font-size:20px;padding:8px 10px;color:#8B96A3;min-height:44px;background:none;border:none}'
  + '.uk-sheet-item{display:block;width:100%;padding:14px;font-size:15px;font-weight:800;color:#1F2430;border-radius:12px;min-height:48px;background:none;border:none}'
  + '.uk-sheet-cancel{display:block;width:100%;padding:14px;font-size:15px;font-weight:700;color:#8B96A3;border-radius:12px;min-height:48px;background:none;border:none;margin-top:2px}'
  + '.uk-note{font-size:10.5px;color:#6E5558;margin-top:8px;text-align:center}'
  + '.uk-share-prev{display:flex;justify-content:center;margin-top:10px;background:#F5F6F8;border-radius:12px;padding:10px}'
  + '.uk-share-prev canvas{max-width:100%;max-height:300px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.15)}'
  + '.uk-share-btns{display:flex;gap:8px;margin-top:10px}'
  + '.uk-share-btns button{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:800;min-height:48px;border:none}'
  + '.uk-btn-share{background:#E4001A;color:#fff}'
  + '.uk-btn-dl{background:#fff;border:1.5px solid #D8DEE6!important;color:#33404F}'
  + '.uk-poi-emoji{font-size:44px}'
  + '.uk-poi-sheet b.uk-poi-name{font-size:16px;font-weight:900;color:#1F2430;display:block;margin-top:4px}'
  + '.uk-poi-why{font-size:12.5px;font-weight:800;color:#8A5A00;margin-top:8px;line-height:1.7}'
  + '.uk-poi-info{font-size:12px;color:#6E7684;margin-top:6px}'
  + '.uk-poi-btns{display:flex;gap:8px;margin-top:14px}'
  + '.uk-poi-btns button{flex:1;padding:13px 8px;border-radius:12px;font-size:14px;font-weight:800;min-height:48px;border:none}'
  + '.uk-btn-go{background:#E4001A;color:#fff}'
  + '.uk-btn-add{background:#fff;border:1.5px solid #D8DEE6!important;color:#33404F}'
  + '.uk-btn-add.done{background:#9BB3A6;border-color:#9BB3A6!important;color:#fff}'
  + '.uk-lastbox{display:flex;align-items:center;justify-content:space-between;background:#fff;border:1.5px solid #F0E0E1;border-radius:13px;padding:11px 13px;margin-top:12px}'
  + '.uk-lastbox small{display:block;font-size:10.5px;color:#8B96A3;font-weight:700}'
  + '.uk-lastbox b{font-size:26px;color:#D7000F;line-height:1.2}'
  + '.uk-lastbox b span{font-size:12px;color:#8B96A3}'
  + '.uk-lastbox b i{font-style:normal;font-size:12px;margin-left:6px;font-weight:900}'
  + '.uk-lastbox b i.dn{color:#177A4C}.uk-lastbox b i.up{color:#D7000F}'
  + '.uk-lastgo{font-size:12.5px;font-weight:800;color:#A50011;background:#FFE9EB;border-radius:99px;padding:10px 13px;min-height:44px;border:none}'
  + '.uk-trend{display:flex;align-items:center;justify-content:center;background:#fff;border:1.5px solid #F0E0E1;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:12.5px;font-weight:800;color:#5A4548}'
  + '.uk-trend .dn{color:#177A4C}.uk-trend .up{color:#D7000F}'
  + '.uk-chip{font-size:13px;background:#fff;border:1.5px solid #D8DEE6;border-radius:99px;padding:10px 14px;color:#33404F;font-weight:700;min-height:44px}'
  + '.uk-chip.on{border-color:#2B4BD7;color:#2B4BD7;background:#EDF1FE}'
  + '.uk-vf{min-height:44px;font-size:12px;font-weight:800;background:#FFE9EB;color:#A50011;border-radius:9px;padding:8px 10px;border:none}'
  + '.uk-vf.done{background:#9BB3A6;color:#fff}'
  + '.uk-carrier-wrap{background:#fff;border:2px solid #1F2430;border-radius:14px;padding:12px 10px;margin-top:12px}'
  + '.uk-carrier-wrap canvas{width:100%;max-width:320px;height:auto;display:block;margin:0 auto;image-rendering:pixelated}'
  + '.uk-carrier-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:20px;font-weight:800;letter-spacing:3px;color:#1F2430;margin-top:8px}'
  + '.uk-carrier-hint{font-size:12px;font-weight:700;color:#5A4548;line-height:1.8;margin-top:10px}'
  + '.uk-carrier-demo{font-size:10.5px;color:#8B96A3;font-weight:700}'
  + '.uk-carrier-done{background:#E4001A!important;color:#fff!important;margin-top:12px}'
  + '#uk-homehint{position:fixed;left:0;right:0;bottom:0;z-index:8000;display:block;text-align:center;'
  + 'background:#1F2430;color:#fff;font-size:11px;font-weight:800;text-decoration:none;'
  + 'padding:10px 12px calc(10px + env(safe-area-inset-bottom,0));opacity:.92}'
  + '@media (prefers-reduced-motion:reduce){.uk-toast{transition:none}}';

  UK.injectCSS = function () {
    if (document.getElementById('uk-css')) return;
    var st = document.createElement('style'); st.id = 'uk-css'; st.textContent = CSS;
    document.head.appendChild(st);
  };

  /* ═══════════════ 12. 自檢(production 判準的機械檢查)═══════════════
     單元頁面按一下 UK.selfCheck() 就能知道有沒有踩到共同的坑。 */
  UK.selfCheck = function () {
    var issues = [];
    /* 觸控 ≥44 */
    document.querySelectorAll('button,a[role="button"],input[type="range"]').forEach(function (b) {
      var r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 44) issues.push('觸控過小(<44px): ' + (b.id || b.className || b.textContent.slice(0, 12)));
    });
    /* 橫向捲動:比 clientWidth(不含捲軸)。視窗量不到尺寸(隱藏分頁/headless)就跳過,否則誤判 */
    var de = document.documentElement;
    if (de.clientWidth > 200 && de.scrollWidth > de.clientWidth + 1) {
      issues.push('頁面出現橫向捲動: ' + de.scrollWidth + ' > ' + de.clientWidth);
    }
    /* 死按鈕:沒有 onclick、也不是委派處理(chip 群組/浮層/data-poi 列)、也沒被 disabled */
    document.querySelectorAll('button').forEach(function (b) {
      if (b.onclick || b.getAttribute('onclick') || b.disabled) return;
      if (b.closest('.uk-mask')) return;                 /* kit 浮層自己接 */
      if (b.closest('[data-chips]') && b.hasAttribute('data-v')) return;  /* UK.chips 委派 */
      if (b.closest('[data-poi]')) return;               /* UK.poi 委派 */
      if (b.hasAttribute('data-action')) return;          /* 單元自訂委派的慣例 */
      issues.push('可能的死按鈕: ' + (b.id || b.textContent.slice(0, 12)));
    });
    /* 數字一致性 */
    var c = UK.data.composite();
    if (typeof c !== 'number' || isNaN(c)) issues.push('綜合分算不出來');
    if (global.console) {
      if (issues.length) console.warn('[unit-kit selfCheck] ' + issues.length + ' 個問題:\n- ' + issues.join('\n- '));
      else console.log('[unit-kit selfCheck] 全過 ✓');
    }
    return issues;
  };

  /* init */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', UK.injectCSS);
  else UK.injectCSS();

  global.UK = UK;
})(window);
