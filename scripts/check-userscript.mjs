// scripts/check-userscript.mjs
// 校验油猴脚本：必需元数据、Greasy Fork 禁用项、@version 格式与递增。
// 用法：node scripts/check-userscript.mjs [路径]
//   PREV_VERSION 环境变量 = 上一次的版本号（为空则跳过递增检查）

import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'ucas-psych-autoanswer.user.js';
const prevVersion = (process.env.PREV_VERSION || '').trim();

const problems = [];
const notes = [];

let src;
try {
  src = readFileSync(file, 'utf8');
} catch (e) {
  console.error('[FAIL] 无法读取文件: ' + file);
  process.exit(1);
}

function fail(msg) {
  problems.push(msg);
}

// --- 元数据块 ---
const block = src.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
if (!block) {
  console.error('[FAIL] 未找到 UserScript 元数据块（// ==UserScript== ... // ==/UserScript==）');
  process.exit(1);
}
const header = block[1];

function meta(name) {
  const re = new RegExp('^\\s*//\\s*@' + name + '\\s+(.+)$', 'm');
  const m = header.match(re);
  return m ? m[1].trim() : '';
}
function metaAll(name) {
  const re = new RegExp('^\\s*//\\s*@' + name + '\\s+(.+)$', 'gm');
  return [...header.matchAll(re)].map((x) => x[1].trim());
}

// --- 必需项 ---
const name = meta('name');
const version = meta('version');
const matches = metaAll('match').concat(metaAll('include'));

if (!name) fail('缺少 @name');
if (!version) fail('缺少 @version');
if (matches.length === 0) fail('缺少 @match 或 @include（脚本不会在任何页面生效）');

// --- 更新地址字段 ---
// 说明：GitHub 直装需要 @updateURL/@downloadURL 才能自动更新；
//       Greasy Fork 会把这些字段重写为指向自己（因此二者可以共存）。
//       默认仅告警；设置 STRICT_GF=1 时视为失败（用于"只发 Greasy Fork"的严格模式）。
const strictGF = process.env.STRICT_GF === '1';
['updateURL', 'downloadURL', 'installURL'].forEach(function (k) {
  if (!meta(k)) return;
  const msg = '@' + k + ' 会被 Greasy Fork 重写/移除；若仅发布到 Greasy Fork 建议删除' +
    '（GitHub 直装则需要保留）';
  if (strictGF) fail(msg); else notes.push('警告：' + msg);
});

// --- 版本号格式 ---
const VERSION_RE = /^\d+(\.\d+)*$/;
if (version && !VERSION_RE.test(version)) {
  fail('@version 必须是纯数字点分格式（如 1.2.3），当前为 "' + version + '"');
}

// --- 版本递增 ---
let bumped = null;
if (version && VERSION_RE.test(version) && prevVersion && VERSION_RE.test(prevVersion)) {
  bumped = compareVersions(version, prevVersion) > 0;
  if (!bumped) {
    fail('@version 未递增：上一次 ' + prevVersion + ' -> 当前 ' + version +
      '（Greasy Fork 不会为未递增的版本创建新版本）');
  }
} else if (prevVersion) {
  notes.push('跳过递增检查（上一次版本号无法解析："' + prevVersion + '"）');
} else {
  notes.push('跳过递增检查（没有可比较的上一次版本）');
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// --- 体积 ---
const bytes = Buffer.byteLength(src, 'utf8');
if (bytes > 2 * 1024 * 1024) fail('文件超过 Greasy Fork 2MB 上限（' + bytes + ' 字节）');

// --- 输出 ---
console.log('文件      : ' + file + '（' + bytes + ' 字节）');
console.log('@name     : ' + (name || '<空>'));
console.log('@version  : ' + (version || '<空>') + (prevVersion ? '  （上一次 ' + prevVersion + '）' : ''));
console.log('@match    : ' + (matches.join(', ') || '<空>'));
notes.forEach(function (n) { console.log('提示      : ' + n); });

if (problems.length) {
  console.error('');
  problems.forEach(function (p) { console.error('[FAIL] ' + p); });
  process.exit(1);
}
console.log('');
console.log('[OK] 校验通过');
