// scripts/test-scoring.mjs
// 作答剖面回归测试：验证各量表落在"正常范围"内，且关键题严格锁定。
//
// 计分口径（与站点一致的简化版）：
//   SDS : 20 题、4 级；正向题(2,5,6,11,12,14,16,17,18,20)反向计分。
//         粗分 = Σ分值（20~80），标准分 = round(粗分 × 1.25)。正常：标准分 < 53。
//   UPI : 编号 1~60 计入总分，"是/有"记 1 分；第 25 题"想轻生"为关键项。
//         正常：总分 < 25 且第 25 题为"否"。
//   QSA : 29 题、5 级，只检查取值合法与关键(null)不越界。
//   16PF: 非 B 因子每题：高分项=2、中间项(b)=1、低分项=0；B 为知识题(正确=2)。
//         因子粗分满分的 50% ≈ 标准十分(sten) 5，故用"偏离中间值的题数"衡量。

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AA = require('../ucas-psych-autoanswer.user.js');

// ---------- 构造合成试卷 ----------
function mkQuestions(n, optionNames) {
  const list = [];
  for (let i = 1; i <= n; i++) {
    list.push({
      QuestionID: 1000 + i,
      AnswerList: optionNames.map(function (name, j) {
        return { AnswerID: 5000 + j, AnswerName: name };
      }),
    });
  }
  return list;
}
const FOUR = ['没有或很少时间', '小部分时间', '相当多时间', '绝大部分或全部时间'];
const FIVE = ['完全不赞同', '比较不赞同', '无所谓', '比较赞同', '完全赞同'];
const TWO = ['是/有', '否/没有'];
const THREE = ['A项', 'B项', 'C项'];

const papers = {
  SDS: { PaperName: 'SDS', PaperResultID: 'r-sds', QuestionList: mkQuestions(20, FOUR) },
  QSA: { PaperName: 'QSA', PaperResultID: 'r-qsa', QuestionList: mkQuestions(29, FIVE) },
  UPI: { PaperName: 'UPI', PaperResultID: 'r-upi', QuestionList: mkQuestions(64, TWO) },
  '16PF': { PaperName: '16PF', PaperResultID: 'r-16pf', QuestionList: mkQuestions(187, THREE) },
};

const optIndex = (ans) => ans.answerId - 5000;
const LETTERS = ['a', 'b', 'c'];

const SDS_POSITIVE = new Set([2, 5, 6, 11, 12, 14, 16, 17, 18, 20]);

// ---------- 计分 ----------
function scoreSDS(answers) {
  let raw = 0;
  answers.forEach(function (a, i) {
    const idx = optIndex(a);
    raw += SDS_POSITIVE.has(i + 1) ? (4 - idx) : (idx + 1);
  });
  return { raw: raw, standard: Math.round(raw * 1.25) };
}

const UPI_LIE = new Set([5, 20, 35, 50]);   // 测伪题，不计入总分

function scoreUPI(answers) {
  let total = 0;
  answers.forEach(function (a, i) {
    const qn = i + 1;
    if (qn <= 60 && !UPI_LIE.has(qn) && optIndex(a) === 0) total++;
  });
  return { total: total, q25: optIndex(answers[24]) };
}

function score16PF(answers) {
  const KEY = AA.PF16_KEY;
  const raw = {};
  answers.forEach(function (a, i) {
    const k = KEY[i + 1];
    if (!k) return;
    const letter = LETTERS[optIndex(a)];
    if (!(k.factor in raw)) raw[k.factor] = 0;
    if (letter === k.letter) raw[k.factor] += 2;
    else if (letter === 'b') raw[k.factor] += 1;
  });
  return raw;
}

// ---------- 断言 ----------
let pass = 0;
let fail = 0;
function assert(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL ' + label + (detail ? '  -> ' + detail : '')); }
}

const TRIALS = Number(process.argv[2] || 300);
const DEV = AA.CONFIG.profile.pf16Dev;
const SDS_BAND = AA.CONFIG.profile.sdsRaw;
const UPI_BAND = AA.CONFIG.profile.upiAffirm;

console.log('剖面 mode = ' + AA.profileMode() + '，采样 ' + TRIALS + ' 次');
console.log('SDS 目标粗分区 [' + SDS_BAND + ']，UPI 目标阳性数 [' + UPI_BAND + ']，16PF 最大偏离 ±' + DEV);
console.log('');

const sdsStats = [];
const upiStats = [];
const pf16DevMax = {};
const QSA_AGREE = new Set([1, 2, 4, 6, 7, 9, 11, 12, 13, 22, 24, 25]);
const QSA_DISAGREE = new Set([3, 5, 8, 10, 14, 15, 16, 17, 18, 19, 20, 21, 23, 26, 27, 28, 29]);

// 跨用户差异统计（与第 1 次作答比较）
const ref = {};
const diffSDS = [];
const diffUPI = [];
const diffPF = [];
const diffQSA = [];
function fracDiff(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d / a.length;
}

for (let t = 0; t < TRIALS; t++) {
  // --- SDS ---
  const sds = AA.resolveAnswers(papers.SDS, AA.buildSDS(papers.SDS));
  const s = scoreSDS(sds);
  sdsStats.push(s);
  assert('SDS 标准分在 [38,48]（无抑郁正常区中部）', s.standard >= 38 && s.standard <= 48, 'standard=' + s.standard);
  assert('SDS 标准分 < 53（判定无抑郁）', s.standard < 53, 'standard=' + s.standard);
  assert('SDS 第19题(自杀意念)锁定为最低分项', optIndex(sds[18]) === 0, 'idx=' + optIndex(sds[18]));

  // --- UPI ---
  const upi = AA.resolveAnswers(papers.UPI, AA.buildUPI(papers.UPI));
  const u = scoreUPI(upi);
  upiStats.push(u);
  assert('UPI 阳性数在 [3,9]', u.total >= 3 && u.total <= 9, 'total=' + u.total);
  assert('UPI 阳性数 < 25（无阳性）', u.total < 25, 'total=' + u.total);
  assert('UPI 第25题(想轻生)恒为"否"', u.q25 !== 0, 'idx=' + u.q25);
  [5, 20, 35, 50].forEach(function (qn) {
    assert('UPI 测伪题 #' + qn + ' 恒为"有"', optIndex(upi[qn - 1]) === 0, 'idx=' + optIndex(upi[qn - 1]));
  });

  // --- 16PF ---
  const pf = AA.resolveAnswers(papers['16PF'], AA.build16PF(papers['16PF']));
  const raw = score16PF(pf);
  const KEY = AA.PF16_KEY;
  const count = {};
  Object.keys(KEY).forEach(function (qn) {
    const f = KEY[qn].factor;
    count[f] = (count[f] || 0) + 1;
  });
  Object.keys(count).forEach(function (f) {
    const n = count[f];
    const center = f === 'B' ? 2 * n : n;      // B 全对 = 2n；其余中间值 = n
    const dev = raw[f] - center;
    if (f !== 'B') {
      pf16DevMax[f] = Math.max(pf16DevMax[f] || 0, Math.abs(dev));
      assert('16PF 因子 ' + f + ' 总分偏离中间值 ≤ ' + DEV, Math.abs(dev) <= DEV, 'dev=' + dev);
    }
    // 关键：不允许出现 0 分或满分的极端
    assert('16PF 因子 ' + f + ' 非极端（未触顶/触底）', dev !== n && dev !== -n, 'raw=' + raw[f] + '/' + (2 * n));
  });
  assert('16PF B(聪慧性) 全对（保持正确作答）', raw.B === 2 * count.B, 'B=' + raw.B + '/' + (2 * count.B));
  [1, 2, 187].forEach(function (qn) {
    assert('16PF 效度题 #' + qn + ' 恒选"是的"', optIndex(pf[qn - 1]) === 0, 'idx=' + optIndex(pf[qn - 1]));
  });

  // --- QSA ---
  const qsa = AA.resolveAnswers(papers.QSA, AA.buildQSA(papers.QSA));
  assert('QSA 选项索引均在 0~4', qsa.every(function (a) { return optIndex(a) >= 0 && optIndex(a) <= 4; }));
  assert('QSA 赞同题不偏到"不赞同"侧（idx≥2）', qsa.every(function (a, i) {
    return !QSA_AGREE.has(i + 1) || optIndex(a) >= 2;
  }));
  assert('QSA 不赞同题不偏到"赞同"侧（idx≤2）', qsa.every(function (a, i) {
    return !QSA_DISAGREE.has(i + 1) || optIndex(a) <= 2;
  }));

  // --- 跨用户差异度：与第 1 次作答逐题比较 ---
  if (t === 0) {
    ref.sds = sds.map(optIndex);
    ref.upi = upi.map(optIndex);
    ref.pf = pf.map(optIndex);
    ref.qsa = qsa.map(optIndex);
  } else {
    diffSDS.push(fracDiff(ref.sds, sds.map(optIndex)));
    diffUPI.push(fracDiff(ref.upi, upi.map(optIndex)));
    diffPF.push(fracDiff(ref.pf, pf.map(optIndex)));
    diffQSA.push(fracDiff(ref.qsa, qsa.map(optIndex)));
  }
}

const avg = (arr, f) => (arr.reduce((s, x) => s + f(x), 0) / arr.length);
const pct = (x) => (x * 100).toFixed(1) + '%';
console.log('SDS 标准分  min=' + Math.min(...sdsStats.map(x => x.standard)) +
  ' max=' + Math.max(...sdsStats.map(x => x.standard)) +
  ' avg=' + avg(sdsStats, x => x.standard).toFixed(1));
console.log('UPI 阳性数  min=' + Math.min(...upiStats.map(x => x.total)) +
  ' max=' + Math.max(...upiStats.map(x => x.total)) +
  ' avg=' + avg(upiStats, x => x.total).toFixed(1));
console.log('16PF 最大偏离中间值：' + Object.keys(pf16DevMax).sort().map(k => k + '=' + pf16DevMax[k]).join(' '));
console.log('');
console.log('跨用户差异度（每题与"参考作答"不同的比例，越高说明每人答案越不同）：');
console.log('  SDS  avg=' + pct(avg(diffSDS, x => x)));
console.log('  QSA  avg=' + pct(avg(diffQSA, x => x)));
console.log('  UPI  avg=' + pct(avg(diffUPI, x => x)));
console.log('  16PF avg=' + pct(avg(diffPF, x => x)));
console.log('');

assert('SDS 跨用户差异 ≥ 25%', avg(diffSDS, x => x) >= 0.25, pct(avg(diffSDS, x => x)));
assert('QSA 跨用户差异 ≥ 40%', avg(diffQSA, x => x) >= 0.40, pct(avg(diffQSA, x => x)));
assert('16PF 跨用户差异 ≥ 30%', avg(diffPF, x => x) >= 0.30, pct(avg(diffPF, x => x)));
assert('UPI 跨用户差异 ≥ 5%', avg(diffUPI, x => x) >= 0.05, pct(avg(diffUPI, x => x)));

// ---------- ideal 模式回归（旧的极端剖面仍可切换使用）----------
console.log('');
console.log('--- 切换 profile.mode = "ideal"（旧极端剖面）---');
AA.CONFIG.profile.mode = 'ideal';

const sdsIdeal = scoreSDS(AA.resolveAnswers(papers.SDS, AA.buildSDS(papers.SDS)));
assert('ideal: SDS 粗分 = 20（理论最低）', sdsIdeal.raw === 20, 'raw=' + sdsIdeal.raw);

const upiIdeal = scoreUPI(AA.resolveAnswers(papers.UPI, AA.buildUPI(papers.UPI)));
assert('ideal: UPI 阳性数 = 0', upiIdeal.total === 0, 'total=' + upiIdeal.total);

const pfIdeal = AA.resolveAnswers(papers['16PF'], AA.build16PF(papers['16PF']));
const rawIdeal = score16PF(pfIdeal);
const cnt = {};
Object.keys(AA.PF16_KEY).forEach(function (qn) {
  const f = AA.PF16_KEY[qn].factor;
  cnt[f] = (cnt[f] || 0) + 1;
});
const poles = AA.CONFIG.pf16Pole;
Object.keys(cnt).forEach(function (f) {
  const full = 2 * cnt[f];
  const middle = cnt[f];
  const r = rawIdeal[f];
  if (f === 'B' || poles.high.indexOf(f) >= 0) assert('ideal: 16PF ' + f + ' 触顶 = ' + full, r === full, 'raw=' + r);
  else if (poles.low.indexOf(f) >= 0) assert('ideal: 16PF ' + f + ' 触底 = 0', r === 0, 'raw=' + r);
  else assert('ideal: 16PF ' + f + ' 居中 = ' + middle, r === middle, 'raw=' + r);
});

AA.CONFIG.profile.mode = 'normal';

console.log('');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail > 0) process.exit(1);
console.log('[OK] 作答剖面全部符合"正常范围"且关键题锁定');
