// ==UserScript==
// @name         UCAS 国科大心赏心理测评自动答题 (SDS/QSA/UPI/16PF)
// @namespace    local.ucas.psych.autoanswer
// @version      1.5.0
// @description  在国科大"心赏"心理测评系统自动完成 抑郁自评(SDS)、自杀态度(QSA)、大学生人格(UPI)、卡特尔16PF 四个量表（健康/正常方向作答）。需先手动登录，登录后一键答题。
// @author       Xinpei Zhang (zhan-nine)
// @copyright    2026 Xinpei Zhang
// @license      MIT
// @homepageURL  https://github.com/zhan-nine/UCAS_Xinshang_auto
// @supportURL   https://github.com/zhan-nine/UCAS_Xinshang_auto/issues
// @updateURL    https://raw.githubusercontent.com/zhan-nine/UCAS_Xinshang_auto/main/ucas-psych-autoanswer.user.js
// @downloadURL  https://raw.githubusercontent.com/zhan-nine/UCAS_Xinshang_auto/main/ucas-psych-autoanswer.user.js
// @match        https://mhec.ucas.ac.cn/*
// @grant        none
// @run-at       document-idle
// @connect      mhec.ucas.ac.cn
// ==/UserScript==

/*
 * UCAS 国科大"心赏"心理测评自动答题
 * ---------------------------------------------------------------
 * 作者 / Author : Xinpei Zhang
 * GitHub        : zhan-nine
 * 项目主页      : https://github.com/zhan-nine/UCAS_Xinshang_auto
 * 反馈 / Issues : https://github.com/zhan-nine/UCAS_Xinshang_auto/issues
 *
 * © 2026 Xinpei Zhang. 本脚本仅供个人学习与研究使用，
 * 使用本脚本产生的一切后果由使用者自行承担（详见仓库 README 免责声明）。
 *
 * 许可 / License : MIT（详见仓库根目录 LICENSE 文件）
 *                  允许自由使用、修改、分发，需保留本版权与许可声明。
 * ---------------------------------------------------------------
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 配置
  // ---------------------------------------------------------------------------
  const API_BASE = 'https://mhec.ucas.ac.cn:8019/';
  const PUBLISH_OVERRIDE = ''; // 留空则自动从待测列表取 PublishID

  const CONFIG = {
    dryRun: false,                      // false=直接提交（默认一键答题）
    // 作答节奏：'timed' 会模拟每题作答时长并真实等待；'instant' 立即提交。
    // 提速：默认每题 180~360ms（逐题随机），四卷合计约 1.5 分钟；可自行调小。
    pacing: { mode: 'timed', minMs: 180, maxMs: 360 },

    // 作答剖面（核心策略）
    //   mode: 'normal' = 各量表落在"正常范围"内（默认，不再取极端理想值）
    //         'ideal'  = 旧的极端理想剖面（SDS/UPI 压到最低、16PF 取极端极向）
    // 注意：无论哪种模式，关键题（SDS 第19题、UPI 第25题/测伪题、16PF 效度题）都锁定。
    profile: {
      mode: 'normal',
      sdsRaw: [30, 38],    // SDS 粗分目标区间（标准分 ≈ 38~48，属"无抑郁"正常区）
      upiAffirm: [3, 9],   // UPI 阳性题数目标（不含 4 道测伪题；<25 即无阳性）
      pf16Dev: 3,          // 16PF 各因子总分相对"中间值"的最大偏离（±3 → sten 约 4~6）
    },

    // QSA：态度量表，默认"赞同题偏赞同 / 不赞同题偏不赞同"，靠 per-item 概率产生差异
    qsaExtreme: false,     // true=更偏向"完全赞同/完全不赞同"

    // 仅 profile.mode='ideal' 时使用的 16PF 极向
    //   high = 高分即理想，low = 低分即理想，mid = 居中即理想
    pf16Pole: {
      high: ['A', 'B', 'C', 'F', 'G', 'H', 'Q3'],
      low: ['L', 'O', 'Q4'],
      mid: ['E', 'I', 'M', 'N', 'Q1', 'Q2'],
    },
  };

  // ---------------------------------------------------------------------------
  // UI 运行时状态
  // ---------------------------------------------------------------------------
  const ui = { buttons: [], status: null, log: null };
  let running = false;

  function setStatus(text) {
    if (ui.status) ui.status.textContent = text;
  }
  function setBusy(b) {
    running = b;
    ui.buttons.forEach(function (btn) { btn.disabled = b; });
    document.querySelectorAll('#ucas-aa-panel [data-aa-btn]').forEach(function (btn) { btn.disabled = b; });
  }
  function refreshIdleStatus() {
    if (running) return;
    const uid = decodeJwtUserId();
    setStatus(uid ? '已登录：' + uid : '未登录，请先登录系统');
  }

  // ---------------------------------------------------------------------------
  // 量表作答规则数据
  // ---------------------------------------------------------------------------

  // SDS：正向题（反向计分）——健康作答应选"绝大部分或全部时间"（最后一个选项）
  const SDS_POSITIVE_ITEMS = new Set([2, 5, 6, 11, 12, 14, 16, 17, 18, 20]);
  // SDS 关键题：第 19 题（自杀意念），任何模式下都锁定为最低分项
  const SDS_CRITICAL_ITEM = 19;

  // QSA：珍视生命方向。选"赞同"的题号 / 选"不赞同"的题号
  const QSA_AGREE_ITEMS = new Set([1, 2, 4, 6, 7, 9, 11, 12, 13, 22, 24, 25]);
  const QSA_DISAGREE_ITEMS = new Set([3, 5, 8, 10, 14, 15, 16, 17, 18, 19, 20, 21, 23, 26, 27, 28, 29]);

  // UPI：正向"测伪题"选"有"，其余选"否/没有"
  const UPI_POSITIVE_ITEMS = new Set([5, 20, 35, 50]);
  // UPI 关键题：绝不随机（测伪题、想轻生、健康/心理卫生/咨询相关）
  const UPI_CRITICAL_ITEMS = new Set([5, 20, 25, 35, 50, 61, 62, 63, 64]);

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
    let name = strategy;
    let ex = extra;
    if (typeof strategy === 'string' && strategy.indexOf('index:') === 0) {
      name = 'index';
      ex = Number(strategy.slice(6));
    }
    const fn = STRATEGY[name] || STRATEGY.first;
    const rawIdx = fn(list.length, ex);
    const idx = Math.max(0, Math.min(list.length - 1, rawIdx));
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
  // 作答剖面工具
  // ---------------------------------------------------------------------------
  function profileMode() {
    return (CONFIG.profile && CONFIG.profile.mode) || 'normal';
  }

  function sampleInt(range, fallback) {
    const lo = range && range[0] != null ? range[0] : fallback[0];
    const hi = range && range[1] != null ? range[1] : fallback[1];
    return randInt(Math.min(lo, hi), Math.max(lo, hi));
  }

  // 从数组中等概率取 k 个（不重复）
  function sampleK(arr, k) {
    const pool = arr.slice();
    const out = [];
    k = Math.max(0, Math.min(k, pool.length));
    for (let i = 0; i < k; i++) {
      const j = randInt(0, pool.length - 1);
      out.push(pool[j]);
      pool.splice(j, 1);
    }
    return out;
  }

  // 按权重表 [[value, weight], ...] 抽一个值
  function weightedPick(pairs) {
    let total = 0;
    for (let i = 0; i < pairs.length; i++) total += pairs[i][1];
    let r = Math.random() * total;
    for (let i = 0; i < pairs.length; i++) {
      r -= pairs[i][1];
      if (r <= 0) return pairs[i][0];
    }
    return pairs[pairs.length - 1][0];
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ---------------------------------------------------------------------------
  // 各量表作答生成
  //   返回 [{questionId, strategy, critical, factor}]
  //   随机性内建在"落区"的选取里（正常范围 / 理想剖面），关键题 critical=true 锁定。
  // ---------------------------------------------------------------------------

  // SDS：症状题分值 = 选项索引+1，正向题分值 = 4-选项索引；粗分 20(最低)~80(最高)
  //   'normal' → 粗分落在 CONFIG.profile.sdsRaw（默认 32~36 → 标准分 40~45）
  //   'ideal'  → 粗分 20（旧行为，全部取最低分）
  function buildSDS(paperInfo) {
    const list = paperInfo.QuestionList || [];
    const n = list.length;
    const positive = list.map(function (q, i) { return SDS_POSITIVE_ITEMS.has(i + 1); });
    const critical = list.map(function (q, i) { return (i + 1) === SDS_CRITICAL_ITEM; });
    const extra = list.map(function () { return 0; }); // 每题相对最低分的加分（0~3）

    if (profileMode() === 'normal') {
      const target = sampleInt(CONFIG.profile && CONFIG.profile.sdsRaw, [32, 36]);
      let need = Math.max(0, target - n);              // 基础粗分 = n（每题 1 分）
      const cand = [];
      for (let i = 0; i < n; i++) if (!critical[i]) cand.push(i);
      let guard = 0;
      while (need > 0 && guard++ < 10000) {
        const avail = cand.filter(function (i) { return extra[i] < 3; });
        if (!avail.length) break;
        const pick = avail[randInt(0, avail.length - 1)];
        extra[pick] += 1;
        need -= 1;
      }
    }

    return list.map(function (q, i) {
      const e = extra[i];
      // 症状题：索引 0→e；正向题（反向计分）：索引 3→3-e
      const idx = positive[i] ? (3 - e) : e;
      return {
        questionId: q.QuestionID,
        strategy: 'index:' + Math.max(0, Math.min(3, idx)),
        critical: critical[i],
        factor: '',
      };
    });
  }

  // QSA：态度量表，题内 5 级（0 完全不赞同 ~ 4 完全赞同）
  //   赞同题 → 偏向 3/4；不赞同题 → 偏向 1/0；中立题 → 中间
  //   逐题按权重抽样，因此每个用户的作答模式都不同（方向保持一致）
  function buildQSA(paperInfo) {
    const ex = CONFIG.qsaExtreme;
    const agreePairs = ex ? [[4, 0.62], [3, 0.26], [2, 0.12]] : [[3, 0.60], [4, 0.28], [2, 0.12]];
    const disagreePairs = ex ? [[0, 0.62], [1, 0.26], [2, 0.12]] : [[1, 0.60], [0, 0.28], [2, 0.12]];
    const neutralPairs = [[2, 0.7], [1, 0.15], [3, 0.15]];
    return (paperInfo.QuestionList || []).map(function (q, i) {
      const n = i + 1;
      let idx;
      if (QSA_AGREE_ITEMS.has(n)) idx = weightedPick(agreePairs);
      else if (QSA_DISAGREE_ITEMS.has(n)) idx = weightedPick(disagreePairs);
      else idx = weightedPick(neutralPairs);
      return { questionId: q.QuestionID, strategy: 'index:' + idx, critical: false, factor: '' };
    });
  }

  // UPI：编号 1~60 计入总分，任一"是/有"记 1 分
  //   测伪题(5/20/35/50) → "有"；关键题(含第25题"想轻生") → "否"
  //   'normal' → 阳性题数落在 CONFIG.profile.upiAffirm（默认 4~8，远低于阈值 25）
  //   'ideal'  → 阳性 0（旧行为）
  function buildUPI(paperInfo) {
    const list = paperInfo.QuestionList || [];
    const n = list.length;
    const isLie = function (i) { return UPI_POSITIVE_ITEMS.has(i + 1); };
    const isCritical = function (i) { return UPI_CRITICAL_ITEMS.has(i + 1); };

    const yes = new Set();
    if (profileMode() === 'normal') {
      const cand = [];
      for (let i = 0; i < n; i++) {
        const qn = i + 1;
        if (qn > 60 || isLie(i) || isCritical(i)) continue;
        cand.push(i);
      }
      const k = sampleInt(CONFIG.profile && CONFIG.profile.upiAffirm, [4, 8]);
      sampleK(cand, k).forEach(function (i) { yes.add(i); });
    }

    return list.map(function (q, i) {
      if (isLie(i)) return { questionId: q.QuestionID, strategy: 'first', critical: true, factor: '' };
      if (isCritical(i)) return { questionId: q.QuestionID, strategy: 'last', critical: true, factor: '' };
      return { questionId: q.QuestionID, strategy: yes.has(i) ? 'first' : 'last', critical: false, factor: '' };
    });
  }

  // 16PF：非 B 因子每题三选项，"中间项(b)"=1 分、"高分项"=2 分、"低分项"=0 分
  //   效度题(1/2/187) → "是的"；B(聪慧性) → 正确项，两者均锁定
  //   'normal' → 每题按权重独立抽样(0/1/2)，再把因子总分夹到"中间值 ±pf16Dev"内
  //              （逐题不同 → 每个用户模式不同；总分居中 → 不出现 0/满分极端）
  //   'ideal'  → 旧行为：极向因子全取高/低分项（→ sten 10 / 0 / 5）
  function build16PF(paperInfo) {
    const list = paperInfo.QuestionList || [];
    const mode = profileMode();
    const poles = CONFIG.pf16Pole || { high: [], low: [], mid: [] };
    const out = new Array(list.length);
    const groups = {};

    for (let i = 0; i < list.length; i++) {
      const qn = i + 1;
      if (PF16_NO_SCORE_ITEMS.has(qn)) {
        out[i] = { questionId: list[i].QuestionID, strategy: 'first', critical: true, factor: '(效度)' };
        continue;
      }
      const k = PF16_KEY[qn];
      if (!k) {
        out[i] = { questionId: list[i].QuestionID, strategy: 'middle', critical: false, factor: '?' };
        continue;
      }
      (groups[k.factor] = groups[k.factor] || []).push({ i: i, key: k });
    }

    // 逐题抽样权重：均值恰好为中间项（1 分）
    const ITEM_PAIRS = [[0, 0.25], [1, 0.50], [2, 0.25]];

    Object.keys(groups).forEach(function (factor) {
      const items = groups[factor];
      if (factor === 'B') {
        items.forEach(function (o) {
          out[o.i] = { questionId: list[o.i].QuestionID, strategy: letterToStrategy(o.key.letter), critical: true, factor: 'B↑' };
        });
        return;
      }

      const n = items.length;
      if (mode === 'ideal') {
        const full = poles.high.indexOf(factor) >= 0;
        const zero = poles.low.indexOf(factor) >= 0;
        items.forEach(function (o) {
          let st = 'middle';
          if (full) st = letterToStrategy(o.key.letter);
          else if (zero) st = invertStrategy(o.key.letter);
          out[o.i] = { questionId: list[o.i].QuestionID, strategy: st, critical: false, factor: factor };
        });
        return;
      }

      // normal：逐题独立抽样 → 再夹到 [n-DEV, n+DEV]
      const dev = CONFIG.profile && CONFIG.profile.pf16Dev != null ? Math.abs(CONFIG.profile.pf16Dev) : 3;
      const vals = items.map(function () { return weightedPick(ITEM_PAIRS); });
      let sum = vals.reduce(function (a, b) { return a + b; }, 0);

      const lower = Math.max(0, n - dev);
      const upper = Math.min(2 * n, n + dev);
      // 降：把 2 分项改回中间项，再不够就把 1 分项降到 0
      while (sum > upper) {
        const twos = shuffle(items.map(function (_, k) { return k; }).filter(function (k) { return vals[k] === 2; }));
        let done = false;
        for (let t = 0; t < twos.length && sum > upper; t++) { vals[twos[t]] = 1; sum -= 1; done = true; }
        if (!done) {
          const ones = shuffle(items.map(function (_, k) { return k; }).filter(function (k) { return vals[k] === 1; }));
          for (let t = 0; t < ones.length && sum > upper; t++) { vals[ones[t]] = 0; sum -= 1; }
        }
      }
      // 升：把 0 分项改回中间项，再不够就把 1 分项升到 2
      while (sum < lower) {
        const zeros = shuffle(items.map(function (_, k) { return k; }).filter(function (k) { return vals[k] === 0; }));
        let done = false;
        for (let t = 0; t < zeros.length && sum < lower; t++) { vals[zeros[t]] = 1; sum += 1; done = true; }
        if (!done) {
          const ones = shuffle(items.map(function (_, k) { return k; }).filter(function (k) { return vals[k] === 1; }));
          for (let t = 0; t < ones.length && sum < lower; t++) { vals[ones[t]] = 2; sum += 1; }
        }
      }

      items.forEach(function (o, k) {
        const v = vals[k];
        let st = 'middle';
        let tag = '·';
        if (v === 2) { st = letterToStrategy(o.key.letter); tag = '↑'; }
        else if (v === 0) { st = invertStrategy(o.key.letter); tag = '↓'; }
        out[o.i] = { questionId: list[o.i].QuestionID, strategy: st, critical: false, factor: factor + tag };
      });
    });

    return out;
  }

  const BUILDERS = {
    SDS: buildSDS, QSA: buildQSA, UPI: buildUPI, '16PF': build16PF,
  };

  // 把选择规格解析为具体选项
  function resolveAnswers(paperInfo, specs) {
    return specs.map(function (s, i) {
      const a = pickAnswer(paperInfo.QuestionList[i], s.strategy);
      return {
        questionId: s.questionId,
        answerId: a && a.AnswerID,
        optionName: a && a.AnswerName,
        strategy: s.strategy,
        factor: s.factor,
        critical: !!s.critical,
      };
    });
  }

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

    const specs = builder(paperInfo);
    const answers = resolveAnswers(paperInfo, specs).map(function (a, i) {
      a.questionIndex = i;
      return a;
    });
    const lockedCount = answers.filter(function (a) { return a.critical; }).length;

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
      profile: profileMode(),
      lockedCount: lockedCount,
    };

    if (opts.dryRun) {
      log('  [dry-run] ' + paperId + ' 共 ' + answers.length + ' 题，剖面 ' + profileMode() + '（关键题锁定 ' +
        lockedCount + ' 题），预计时长 ' + summary.durationSec + 's，未提交');
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
    if (running) { log('已有任务进行中，请稍候...'); return []; }
    setBusy(true);
    try {
      const list = await getWaitList();
      const targets = opts.papers && opts.papers.length
        ? list.filter(function (x) { return opts.papers.indexOf(x.PaperID) >= 0; })
        : list;
      if (!targets.length) {
        log('没有待测量表' + (opts.papers ? '（' + opts.papers.join('/') + '）' : ''));
        setStatus('没有待测量表');
        return [];
      }
      const label = opts.dryRun ? '预览' : '答题';
      log('开始' + label + '：' + targets.map(function (x) { return x.PaperID; }).join(', '));
      const out = [];
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        setStatus(label + '中 (' + (i + 1) + '/' + targets.length + ')：' + item.PaperID);
        try {
          out.push(await runPaper(item, opts));
        } catch (e) {
          log('  ✘ ' + item.PaperID + ' 出错: ' + e.message);
        }
      }
      const ok = out.filter(function (s) { return s.response && (s.response.Code === 200 || s.response.Code === 0); }).length;
      const msg = opts.dryRun ? '预览完成（未提交）' : '完成：成功 ' + ok + '/' + targets.length;
      log(msg);
      setStatus(msg);
      return out;
    } catch (e) {
      log('ERR ' + e.message);
      setStatus('出错：' + e.message);
      return [];
    } finally {
      setBusy(false);
      setTimeout(refreshIdleStatus, 4000);
    }
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  function log(msg) {
    // eslint-disable-next-line no-console
    console.log('[UCAS-AA]', msg);
    if (typeof document === 'undefined') return;
    const line = document.createElement('div');
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    const box = ui.log || document.getElementById('ucas-aa-log');
    if (box) {
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    }
  }

  function makeButton(text, fn, opts) {
    opts = opts || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.aaBtn = '1';
    b.textContent = text;
    b.style.cssText = [
      'font:inherit',
      'border-radius:8px',
      'border:1px solid ' + (opts.border || '#d9d9d9'),
      'background:' + (opts.bg || '#f7f8fa'),
      'color:' + (opts.color || '#333'),
      'padding:' + (opts.big ? '10px 12px' : '6px 10px'),
      'font-size:' + (opts.big ? '15px' : '12px'),
      'font-weight:' + (opts.big ? '700' : '500'),
      'cursor:pointer',
      'transition:filter .15s,opacity .15s',
      'white-space:nowrap',
    ].join(';');
    b.addEventListener('mouseenter', function () { if (!b.disabled) b.style.filter = 'brightness(.95)'; });
    b.addEventListener('mouseleave', function () { b.style.filter = ''; });
    b.addEventListener('click', function () { fn(); });
    ui.buttons.push(b);
    return b;
  }

  function injectPanel() {
    if (document.getElementById('ucas-aa-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ucas-aa-panel';
    panel.style.cssText = 'position:fixed;right:14px;bottom:14px;width:288px;z-index:999999;' +
      'background:#fff;border:1px solid #e3e6ea;border-radius:12px;' +
      'box-shadow:0 10px 30px rgba(16,24,40,.16),0 2px 6px rgba(16,24,40,.06);' +
      'font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;' +
      'display:flex;flex-direction:column;overflow:hidden;color:#1f2430';

    // 头部
    const head = document.createElement('div');
    head.style.cssText = 'padding:10px 12px;background:linear-gradient(135deg,#2f7bff,#1e63e9);color:#fff;' +
      'display:flex;justify-content:space-between;align-items:center;gap:8px';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;font-size:13px';
    title.textContent = '心赏自动答题';
    const collapse = document.createElement('span');
    collapse.textContent = '—';
    collapse.style.cssText = 'cursor:pointer;padding:0 6px;font-weight:700;user-select:none';
    head.appendChild(title);
    head.appendChild(collapse);

    // 主体
    const body = document.createElement('div');
    body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:10px;overflow:auto';

    // 状态
    ui.status = document.createElement('div');
    ui.status.id = 'ucas-aa-status';
    ui.status.style.cssText = 'font-size:12px;color:#5a6472;background:#f5f7fa;border:1px solid #eef1f5;' +
      'border-radius:8px;padding:7px 9px;word-break:break-all';

    // 一键答题（主按钮）
    const main = makeButton('⚡ 一键自动答题', function () { runAll({}); }, {
      big: true, bg: 'linear-gradient(135deg,#34c759,#22a447)', border: '#22a447', color: '#fff',
    });
    main.style.width = '100%';

    // 单量表按钮
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    [['SDS', '抑郁自评'], ['QSA', '自杀态度'], ['UPI', '人格测验'], ['16PF', '16 种人格']].forEach(function (p) {
      const b = makeButton(p[0] + ' · ' + p[1], function () { runAll({ papers: [p[0]] }); });
      b.style.width = '100%';
      b.style.padding = '7px 6px';
      b.style.fontSize = '12px';
      grid.appendChild(b);
    });

    // 仅预览
    const preview = makeButton('仅预览（不提交）', function () { runAll({ dryRun: true }); }, {
      bg: '#fff', border: '#e0e3e8', color: '#6b7280',
    });
    preview.style.width = '100%';
    preview.style.padding = '6px 10px';
    preview.style.fontSize = '12px';

    // 日志
    const logHead = document.createElement('div');
    logHead.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#8a93a0;margin-top:2px';
    const logTitle = document.createElement('span');
    logTitle.textContent = '运行日志';
    const logToggle = document.createElement('span');
    logToggle.textContent = '收起';
    logToggle.style.cssText = 'cursor:pointer;user-select:none';
    logHead.appendChild(logTitle);
    logHead.appendChild(logToggle);

    ui.log = document.createElement('div');
    ui.log.id = 'ucas-aa-log';
    ui.log.style.cssText = 'height:132px;overflow:auto;background:#0f1115;color:#b7e1a1;' +
      'font-family:Consolas,Menlo,monospace;font-size:11px;line-height:1.5;padding:8px;border-radius:8px;white-space:pre-wrap';

    body.appendChild(ui.status);
    body.appendChild(main);
    body.appendChild(grid);
    body.appendChild(preview);
    body.appendChild(logHead);
    body.appendChild(ui.log);

    // 署脚：作者 + GitHub 链接
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:6px 12px;border-top:1px solid #eef1f5;background:#fafbfc;' +
      'font-size:11px;color:#8a93a0;display:flex;justify-content:space-between;align-items:center;gap:8px';
    const credit = document.createElement('span');
    credit.textContent = '© 2026 Xinpei Zhang';
    const gh = document.createElement('a');
    gh.href = 'https://github.com/zhan-nine/UCAS_Xinshang_auto';
    gh.target = '_blank';
    gh.rel = 'noopener noreferrer';
    gh.textContent = 'GitHub @zhan-nine';
    gh.style.cssText = 'color:#2f7bff;text-decoration:none';
    footer.appendChild(credit);
    footer.appendChild(gh);

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(footer);
    document.body.appendChild(panel);

    logToggle.addEventListener('click', function () {
      const hidden = ui.log.style.display === 'none';
      ui.log.style.display = hidden ? 'block' : 'none';
      logToggle.textContent = hidden ? '收起' : '展开';
    });

    let collapsed = false;
    collapse.addEventListener('click', function () {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : 'flex';
      collapse.textContent = collapsed ? '+' : '—';
      if (!collapsed) panel.style.width = '288px';
      if (collapsed) panel.style.width = 'auto';
      footer.style.display = collapsed ? 'none' : 'flex';
    });

    refreshIdleStatus();
  }

  // ---------------------------------------------------------------------------
  // 页面识别（鲁棒）
  //   · 大小写不敏感、容忍尾斜杠与查询串
  //   · 排除"来访者测试"页 /Client/Waiting_test（它用的是另一个接口
  //     ScaleIssue/GetvisitorWaitText，本脚本不支持）
  //
  // 实测依据（2026-10，真实站点）：
  //   vue-router 3.6.5 / history 模式，路由 {path:"/Visitors/Waiting_test", name:"Waiting_test"}
  //   未声明 caseSensitive，path-to-regexp 的 flags 为 `sensitive ? "" : "i"` → 默认不敏感。
  //   实测 resolve() 对 /Visitors/Waiting_test、/visitors/waiting_test、/VISITORS/WAITING_TEST
  //   均匹配到同一条 name="Waiting_test" 路由；服务器对任意大小写都返回同一 SPA 外壳。
  //   而 /Client/Waiting_test 的 name 为 "/Waiting_test"，是另一条路由。
  // ---------------------------------------------------------------------------
  const WAITING_PATH_RE = /^\/visitors\/waiting_test\/?$/i; // 尾斜杠可选
  const WAITING_ROUTE_NAMES = ['Waiting_test'];             // 仅"本人待测"页
  const WAITING_DOM_SELECTOR = '.Wait-test-content';        // 仅该页组件渲染
  const CLIENT_ROUTE_NAMES = ['/Waiting_test'];             // "来访者测试"页（不支持）

  // 纯函数：便于离线单测（不触碰 DOM / location）
  function isWaitingPageForSelf(info) {
    info = info || {};
    if (info.hasDomMarker) return true;                    // 组件已渲染：最可靠
    if (info.routeName && WAITING_ROUTE_NAMES.indexOf(info.routeName) >= 0) return true;
    if (info.pathname && WAITING_PATH_RE.test(info.pathname)) return true;
    return false;
  }

  function getVueRouter() {
    try {
      const el = document.querySelector('#app') || document.body.firstElementChild;
      const vm = el && el.__vue__;
      const r = vm && (vm.$router || (vm.$root && vm.$root.$router));
      return r || null;
    } catch (e) { return null; }
  }

  function getRouteName() {
    try {
      const r = getVueRouter();
      return (r && r.currentRoute && r.currentRoute.name) || null;
    } catch (e) { return null; }
  }

  function currentPathname() {
    try { return decodeURIComponent(location.pathname); } catch (e) { return location.pathname; }
  }

  function probePage() {
    return {
      hasDomMarker: !!document.querySelector(WAITING_DOM_SELECTOR),
      routeName: getRouteName(),
      pathname: currentPathname(),
    };
  }

  let clientPageHinted = false;
  function tryInject() {
    if (document.getElementById('ucas-aa-panel')) return;
    const info = probePage();
    if (isWaitingPageForSelf(info)) { injectPanel(); return; }
    // 在"来访者测试"页给一次提示（本脚本只支持"本人待测"页）
    if (info.routeName && CLIENT_ROUTE_NAMES.indexOf(info.routeName) >= 0 && !clientPageHinted) {
      clientPageHinted = true;
      log('提示：当前是"来访者测试"页（他人测评），本脚本只支持"本人待测"页 /Visitors/Waiting_test，故不显示面板。');
    }
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
    resolveAnswers: resolveAnswers,
    profileMode: profileMode,
    buildTmpResult: buildTmpResult,
    PF16_KEY: PF16_KEY,
    injectPanel: injectPanel,
    // 页面识别（导出以便离线单测）
    isWaitingPageForSelf: isWaitingPageForSelf,
    probePage: probePage,
  };
  // 浏览器环境下启动 UI
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.UCASPsychAutoAnswer = api;
    tryInject();
    // SPA 路由切换不会刷新页面，用轮询 + popstate 兜底
    setInterval(tryInject, 1000);
    window.addEventListener('popstate', tryInject);
    log('脚本已加载。登录后在本页点击面板按钮即可。当前登录 UserID=' + (decodeJwtUserId() || '(未登录)'));
  }
  // Node 环境下可复用纯规则逻辑做离线校验
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
