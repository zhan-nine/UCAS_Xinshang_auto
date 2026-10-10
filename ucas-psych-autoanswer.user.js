// ==UserScript==
// @name         UCAS 心理测评自动答题 (SDS/QSA/UPI/16PF)
// @namespace    local.ucas.psych.autoanswer
// @version      1.0.0
// @description  在国科大"心理危机预防干预系统"待测页自动完成 抑郁自评(SDS)、自杀态度(QSA)、大学生人格(UPI)、卡特尔16PF 四个量表（健康/正常方向作答）。需先手动登录。
// @author       local
// @match        https://mhec.ucas.ac.cn/*
// @grant        none
// @run-at       document-idle
// @connect      mhec.ucas.ac.cn
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 配置
  // ---------------------------------------------------------------------------
  const API_BASE = 'https://mhec.ucas.ac.cn:8019/';
  const PUBLISH_OVERRIDE = ''; // 留空则自动从待测列表取 PublishID

  const CONFIG = {
    dryRun: true,                      // true=只预览不提交
    pacing: { mode: 'timed', minMs: 800, maxMs: 1500 }, // mode: 'instant' | 'timed'
    // 16PF 各因子"健康"极向：
    //   high = 高分即理想，low = 低分即理想，mid = 居中即理想
    pf16Pole: {
      high: ['A', 'B', 'C', 'F', 'G', 'H', 'Q3'],
      low: ['L', 'O', 'Q4'],
      mid: ['E', 'I', 'M', 'N', 'Q1', 'Q2'],
    },
    qsaExtreme: false,                 // false=用"比较赞同/比较不赞同"，true=用"完全赞同/完全不赞同"
  };

  // ---------------------------------------------------------------------------
  // 量表作答规则数据
  // ---------------------------------------------------------------------------

  // SDS：正向题（反向计分）——健康作答应选"绝大部分或全部时间"（最后一个选项）
  const SDS_POSITIVE_ITEMS = new Set([2, 5, 6, 11, 12, 14, 16, 17, 18, 20]);

  // QSA：珍视生命方向。选"赞同"的题号 / 选"不赞同"的题号
  const QSA_AGREE_ITEMS = new Set([1, 2, 4, 6, 7, 9, 11, 12, 13, 22, 24, 25]);
  const QSA_DISAGREE_ITEMS = new Set([3, 5, 8, 10, 14, 15, 16, 17, 18, 19, 20, 21, 23, 26, 27, 28, 29]);

  // UPI：正向"测伪题"选"有"，其余选"否/没有"
  const UPI_POSITIVE_ITEMS = new Set([5, 20, 35, 50]);

  // 16PF 官方计分键：字母 = 该题"高分选项"（B 因子为正确答案）
  const PF16_FACTOR_KEY = {
    A: '3a 26c 27c 51c 52a 76c 101a 126a 151c 176a',
    B: '28b 53b 54b 77c 78b 102c 103b 127c 128b 152b 153c 177a 178a',
    C: '4a 5c 29c 30a 55a 79c 80c 104a 105a 129a 130a 154c 179a',
    E: '6c 7a 31c 32c 56a 57c 81c 106c 131a 155a 156a 180a 181a',
    F: '8c 33a 58a 82c 83c 107c 108c 132a 133a 157c 158c 182a 183a',
    G: '9c 34c 59a 84c 109a 134a 159c 160a 184a 185a',
    H: '10a 35c 36a 60c 61c 85c 86c 110a 111a 135c 136a 161c 186a',
    I: '11c 12c 37a 62c 87c 112a 137c 138a 162c 163a',
    L: '13a 38a 63c 64c 88a 89c 113a 114a 139c 164a',
    M: '14c 15c 39a 40a 65a 90c 91a 115a 116c 140a 141c 165c 166c',
    N: '16c 17c 41c 42a 66c 67c 92c 117a 142a 167a',
    O: '18a 19c 43a 44c 68c 69a 93c 94c 118a 119a 143a 144c 168a',
    Q1: '20a 21a 45c 46a 70a 95c 120c 145a 169a 170c',
    Q2: '22c 47a 71a 72a 96c 97c 121c 122c 146a 171a',
    Q3: '23c 24c 48a 73a 98a 123c 147a 148a 172c 173a',
    Q4: '25a 49a 50a 74a 75c 99a 100c 124a 125c 149a 150a 174a 175c',
  };
  const PF16_NO_SCORE_ITEMS = new Set([1, 2, 187]); // 效度/引导题，健康作答选"是的"

  // 解析出 题号 -> {factor, letter}
  const PF16_KEY = (function () {
    const map = {};
    Object.keys(PF16_FACTOR_KEY).forEach(function (factor) {
      PF16_FACTOR_KEY[factor].split(/\s+/).forEach(function (tok) {
        const m = /^(\d+)([abc])$/.exec(tok);
        if (m) map[Number(m[1])] = { factor: factor, letter: m[2] };
      });
    });
    return map;
  })();

  // ---------------------------------------------------------------------------
  // 工具
  // ---------------------------------------------------------------------------
  const STRATEGY = {
    first: function (len) { return 0; },
    last: function (len) { return len - 1; },
    middle: function (len) { return Math.floor((len - 1) / 2); },
    index: function (len, i) { return Math.max(0, Math.min(len - 1, i)); },
  };

  function letterToStrategy(letter) {
    if (letter === 'a') return 'first';
    if (letter === 'b') return 'middle';
    if (letter === 'c') return 'last';
    return 'middle';
  }
  function invertStrategy(letter) {
    if (letter === 'a') return 'last';  // 低分 → 选相反极端 c
    if (letter === 'c') return 'first'; // 低分 → 选相反极端 a
    return 'middle';
  }

  function pickAnswer(question, strategy, extra) {
    const list = question.AnswerList || [];
    if (!list.length) return null;
    const idx = STRATEGY[strategy](list.length, extra);
    return list[idx];
  }

  function fmtTime(ms) {
    const d = new Date(ms);
    const pad = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      d.getHours() + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function getAuth() {
    return sessionStorage.getItem('Authorization') || '';
  }

  function decodeJwtUserId() {
    try {
      const tok = getAuth().split('.')[1];
      const json = JSON.parse(decodeURIComponent(escape(atob(tok.replace(/-/g, '+').replace(/_/g, '/')))));
      return json.UserID || '';
    } catch (e) { return ''; }
  }

  // ---------------------------------------------------------------------------
  // 接口
  // ---------------------------------------------------------------------------
  async function apiPost(path, body) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: getAuth() },
      credentials: 'include',
      body: JSON.stringify(body || {}),
    });
    return await res.json();
  }

  async function getWaitList() {
    const auth = getAuth();
    const r = await apiPost('ScaleIssue/GetLfzWaitText', {
      token: auth, pageSize: '50', pageIndex: 1, PaperName: '',
    });
    if (r.Code !== 200 && r.Code !== 0) throw new Error('取待测列表失败: ' + r.Message);
    return r.Data || [];
  }

  async function getPaperInfo(paperId, publishId, userId) {
    const r = await apiPost('Paper/GetPaperInfo', {
      SourceNo: publishId, PaperID: paperId, UserID: userId,
    });
    if (r.Code !== 200 && r.Code !== 0) throw new Error('取卷失败(' + paperId + '): ' + r.Message);
    return r.Data;
  }

  async function submitPaper(payload) {
    return await apiPost('Paper/Submit', { data: payload });
  }

  // ---------------------------------------------------------------------------
  // 各量表作答生成：返回 [{questionId, answerId, strategy, optionName}]
  // ---------------------------------------------------------------------------
  function buildSDS(paperInfo) {
    return (paperInfo.QuestionList || []).map(function (q, i) {
      const n = i + 1;
      const st = SDS_POSITIVE_ITEMS.has(n) ? 'last' : 'first';
      const a = pickAnswer(q, st);
      return { questionId: q.QuestionID, answerId: a && a.AnswerID, optionName: a && a.AnswerName, strategy: st };
    });
  }

  function buildQSA(paperInfo) {
    return (paperInfo.QuestionList || []).map(function (q, i) {
      const n = i + 1;
      let idx = 2; // 默认中立
      if (QSA_AGREE_ITEMS.has(n)) idx = CONFIG.qsaExtreme ? 0 : 1;
      else if (QSA_DISAGREE_ITEMS.has(n)) idx = CONFIG.qsaExtreme ? 4 : 3;
      const a = pickAnswer(q, 'index', idx);
      return { questionId: q.QuestionID, answerId: a && a.AnswerID, optionName: a && a.AnswerName, strategy: 'index:' + idx };
    });
  }

  function buildUPI(paperInfo) {
    return (paperInfo.QuestionList || []).map(function (q, i) {
      const n = i + 1;
      const st = UPI_POSITIVE_ITEMS.has(n) ? 'first' : 'last';
      const a = pickAnswer(q, st);
      return { questionId: q.QuestionID, answerId: a && a.AnswerID, optionName: a && a.AnswerName, strategy: st };
    });
  }

  function build16PF(paperInfo) {
    const poles = CONFIG.pf16Pole;
    return (paperInfo.QuestionList || []).map(function (q, i) {
      const n = i + 1;
      let st;
      let factor = '';
      if (PF16_NO_SCORE_ITEMS.has(n)) {
        st = 'first'; // 是的
        factor = '(效度)';
      } else {
        const k = PF16_KEY[n];
        if (!k) { st = 'middle'; factor = '?'; }
        else if (poles.high.indexOf(k.factor) >= 0) { st = letterToStrategy(k.letter); factor = k.factor + '↑'; }
        else if (poles.low.indexOf(k.factor) >= 0) { st = invertStrategy(k.letter); factor = k.factor + '↓'; }
        else { st = 'middle'; factor = k.factor + '·'; }
      }
      const a = pickAnswer(q, st);
      return { questionId: q.QuestionID, answerId: a && a.AnswerID, optionName: a && a.AnswerName, strategy: st, factor: factor };
    });
  }

  const BUILDERS = {
    SDS: buildSDS, QSA: buildQSA, UPI: buildUPI, '16PF': build16PF,
  };

  // ---------------------------------------------------------------------------
  // TmpResult 组装（复刻前端 Submit 逻辑）
  // ---------------------------------------------------------------------------
  function buildTmpResult(answers) {
    let s = '';
    answers.forEach(function (ans, i) {
      const preQ = i - 1;
      s += ';' + ans.questionId + '|' + ans.answerId + '|' + fmtTime(ans.startMs) + '|' +
        fmtTime(ans.endMs) + '|' + '' + '|' + '' + '|' + preQ;
    });
    return s;
  }

  // ---------------------------------------------------------------------------
  // 为一份卷分配时间戳
  // ---------------------------------------------------------------------------
  function assignTimes(answers, baseMs) {
    const { mode, minMs, maxMs } = CONFIG.pacing;
    if (mode === 'instant') {
      answers.forEach(function (a) { a.startMs = baseMs; a.endMs = baseMs; });
      return 0;
    }
    let t = baseMs;
    let total = 0;
    answers.forEach(function (a) {
      const dur = randInt(minMs, maxMs);
      a.startMs = t;
      t += dur;
      a.endMs = t;
      total += dur;
    });
    return total;
  }

  // ---------------------------------------------------------------------------
  // 跑一份卷
  // ---------------------------------------------------------------------------
  async function runPaper(item, opts) {
    opts = opts || {};
    const userId = opts.userId || decodeJwtUserId();
    const publishId = PUBLISH_OVERRIDE || item.PublishID;
    const paperId = item.PaperID;
    log('取卷 ' + paperId + ' ...');
    const paperInfo = await getPaperInfo(paperId, publishId, userId);

    const builder = BUILDERS[paperId];
    if (!builder) throw new Error('未支持的量表: ' + paperId);

    const answers = builder(paperInfo).map(function (a, i) {
      a.questionIndex = i;
      return a;
    });

    const missing = answers.filter(function (a) { return !a.answerId; });
    if (missing.length) throw new Error(paperId + ' 有 ' + missing.length + ' 题未匹配到选项');

    const base = Date.now();
    const total = assignTimes(answers, base);
    const endMs = answers.length ? answers[answers.length - 1].endMs : base;

    const payload = {
      PaperResultID: paperInfo.PaperResultID,
      SourceNo: publishId,
      SourceFlg: 1,
      PaperID: paperId,
      PaperTestProgress: 0,
      UserID: userId,
      StartDateTime: fmtTime(base),
      EndDateTime: fmtTime(endMs),
      TmpResult: buildTmpResult(answers),
      IsSubmit: 1,
      Creator: userId,
      ModuleID: 'PC',
    };

    const summary = {
      paperId: paperId,
      paperName: paperInfo.PaperName,
      questionCount: answers.length,
      durationSec: Math.round(total / 1000),
      PaperResultID: paperInfo.PaperResultID,
      payload: payload,
      answers: answers,
    };

    if (opts.dryRun) {
      log('  [dry-run] ' + paperId + ' 共 ' + answers.length + ' 题，预计时长 ' + summary.durationSec + 's，未提交');
      return summary;
    }

    if (CONFIG.pacing.mode === 'timed' && total > 0) {
      log('  [timed] 模拟作答 ' + summary.durationSec + 's ...');
      await sleep(total);
    }

    log('  提交 ' + paperId + ' ...');
    const r = await submitPaper(payload);
    summary.response = r;
    if (r.Code === 200 || r.Code === 0) {
      log('  ✔ ' + paperId + ' 提交成功: ' + r.Message);
    } else {
      log('  ✘ ' + paperId + ' 提交失败: ' + JSON.stringify(r));
    }
    return summary;
  }

  async function runAll(opts) {
    opts = opts || {};
    const list = await getWaitList();
    const targets = opts.papers && opts.papers.length
      ? list.filter(function (x) { return opts.papers.indexOf(x.PaperID) >= 0; })
      : list;
    log('待测量表: ' + targets.map(function (x) { return x.PaperID; }).join(', '));
    const out = [];
    for (const item of targets) {
      try {
        out.push(await runPaper(item, opts));
      } catch (e) {
        log('  ✘ ' + item.PaperID + ' 出错: ' + e.message);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  let logBox = null;
  function log(msg) {
    const line = document.createElement('div');
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    if (logBox) {
      logBox.appendChild(line);
      logBox.scrollTop = logBox.scrollHeight;
    }
    // eslint-disable-next-line no-console
    console.log('[UCAS-AA]', msg);
  }

  function injectPanel() {
    if (document.getElementById('ucas-aa-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'ucas-aa-panel';
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;width:360px;max-height:70vh;z-index:999999;' +
      'background:#fff;border:1px solid #d0d0d0;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);' +
      'font:12px/1.5 -apple-system,Segoe UI,Microsoft YaHei,sans-serif;display:flex;flex-direction:column;overflow:hidden';

    const head = document.createElement('div');
    head.textContent = '心理测评自动答题';
    head.style.cssText = 'padding:8px 10px;background:#2499ff;color:#fff;font-weight:600;display:flex;justify-content:space-between;align-items:center';
    const collapse = document.createElement('span');
    collapse.textContent = '—';
    collapse.style.cssText = 'cursor:pointer;padding:0 6px';
    head.appendChild(collapse);

    const body = document.createElement('div');
    body.style.cssText = 'padding:8px 10px;display:flex;flex-direction:column;gap:6px;overflow:auto';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    function mkBtn(text, fn, color) {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'padding:4px 8px;border:1px solid #ccc;border-radius:4px;background:' + (color || '#f7f7f7') + ';cursor:pointer;font-size:12px';
      b.addEventListener('click', fn);
      return b;
    }

    const dryRunLabel = document.createElement('label');
    dryRunLabel.style.cssText = 'display:flex;align-items:center;gap:4px';
    const dryChk = document.createElement('input');
    dryChk.type = 'checkbox';
    dryChk.checked = CONFIG.dryRun;
    dryChk.addEventListener('change', function () { CONFIG.dryRun = dryChk.checked; log('dry-run = ' + CONFIG.dryRun); });
    dryRunLabel.appendChild(dryChk);
    dryRunLabel.appendChild(document.createTextNode('dry-run（只预览不提交）'));

    row.appendChild(mkBtn('预览全部', function () { runAll({ dryRun: true }).catch(function (e) { log('ERR ' + e.message); }); }, '#fff7e6'));
    row.appendChild(mkBtn('全自动完成', function () { runAll({}).catch(function (e) { log('ERR ' + e.message); }); }, '#ffe9e9'));
    ['SDS', 'QSA', 'UPI', '16PF'].forEach(function (p) {
      row.appendChild(mkBtn(p, function () { runAll({ papers: [p] }).catch(function (e) { log('ERR ' + e.message); }); }));
    });

    logBox = document.createElement('div');
    logBox.style.cssText = 'height:200px;overflow:auto;background:#0f1115;color:#b7e1a1;font-family:Consolas,monospace;font-size:11px;padding:6px;border-radius:4px;white-space:pre-wrap';

    body.appendChild(dryRunLabel);
    body.appendChild(row);
    body.appendChild(logBox);
    panel.appendChild(head);
    panel.appendChild(body);
    document.body.appendChild(panel);

    let collapsed = false;
    collapse.addEventListener('click', function () {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : 'flex';
      collapse.textContent = collapsed ? '+' : '—';
    });
  }

  // 只在待测页出现面板
  function tryInject() {
    const onWaiting = /Waiting_test/i.test(location.href) || document.querySelector('.Wait-test-content');
    if (onWaiting) injectPanel();
  }

  const api = {
    CONFIG: CONFIG,
    log: log,
    getWaitList: getWaitList,
    getPaperInfo: getPaperInfo,
    runPaper: runPaper,
    runAll: runAll,
    buildSDS: buildSDS,
    buildQSA: buildQSA,
    buildUPI: buildUPI,
    build16PF: build16PF,
    buildTmpResult: buildTmpResult,
    PF16_KEY: PF16_KEY,
  };
  // 浏览器环境下启动 UI
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.UCASPsychAutoAnswer = api;
    tryInject();
    setInterval(tryInject, 2000);
    log('脚本已加载。登录后在本页点击面板按钮即可。当前登录 UserID=' + (decodeJwtUserId() || '(未登录)'));
  }
  // Node 环境下可复用纯规则逻辑做离线校验
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
