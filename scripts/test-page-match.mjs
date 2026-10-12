// scripts/test-page-match.mjs
// 页面识别回归测试：确保"本人待测页"的大小写/尾斜杠鲁棒性，
// 并且绝不会误命中"来访者测试"页 /Client/Waiting_test。
//
// 实测背景（2026-10 真实站点，vue-router 3.6.5）：
//   /Visitors/Waiting_test  -> name "Waiting_test"  （本人待测，脚本支持）
//   /Client/Waiting_test    -> name "/Waiting_test" （来访者测试，接口不同，必须排除）
//   路由未声明 caseSensitive，path-to-regexp 默认 flags 为 "i"，故大小写不敏感。

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AA = require('../ucas-psych-autoanswer.user.js');

const isSelf = AA.isWaitingPageForSelf;

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.error('  FAIL ' + label + '  (期望 ' + expected + '，实际 ' + actual + ')'); }
}

console.log('--- 路径判定（大小写 / 尾斜杠 / 查询串）---');
const truePaths = [
  '/Visitors/Waiting_test',
  '/visitors/Waiting_test',
  '/visitors/waiting_test',
  '/VISITORS/WAITING_TEST',
  '/Visitors/Waiting_Test',
  '/Visitors/Waiting_test/',      // 尾斜杠
];
truePaths.forEach(function (p) {
  check('pathname ' + JSON.stringify(p), isSelf({ pathname: p }), true);
});

console.log('--- 必须排除的路径 ---');
const falsePaths = [
  '/Client/Waiting_test',         // 来访者测试页（另一接口）
  '/client/waiting_test',
  '/Waiting_test',                // 缺少 /Visitors 前缀
  '/Visitors/Waiting',            // 不完整
  '/Visitors',                    // 信息管理页
  '/login',
  '/',
  '/Visitors/Waiting_test_extra', // 前缀相同但不是该路由
];
falsePaths.forEach(function (p) {
  check('pathname ' + JSON.stringify(p), isSelf({ pathname: p }), false);
});

console.log('--- 路由名判定（不依赖 URL 写法）---');
check('routeName "Waiting_test"（本人待测）', isSelf({ routeName: 'Waiting_test' }), true);
check('routeName "/Waiting_test"（来访者测试）', isSelf({ routeName: '/Waiting_test' }), false);
check('routeName "login"', isSelf({ routeName: 'login' }), false);
check('routeName null + 空路径', isSelf({ routeName: null, pathname: '/' }), false);

console.log('--- DOM 标记优先级（组件已渲染即认定）---');
check('hasDomMarker=true, 即使路径陌生', isSelf({ hasDomMarker: true, pathname: '/whatever' }), true);
check('hasDomMarker=false, 路径匹配', isSelf({ hasDomMarker: false, pathname: '/visitors/waiting_test' }), true);

console.log('--- 参数健壮性 ---');
check('undefined', isSelf(undefined), false);
check('null', isSelf(null), false);
check('{}', isSelf({}), false);

console.log('');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail > 0) process.exit(1);
console.log('[OK] 页面识别判定全部符合预期');
