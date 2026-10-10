# UCAS_Xinshang_auto —— 国科大心赏心理测评自动答题插件

![License: MIT](https://img.shields.io/badge/License-MIT-2f7bff.svg)
![Version](https://img.shields.io/badge/version-1.3.3-34c759.svg)
![Platform](https://img.shields.io/badge/Tampermonkey-userscript-orange.svg)

插件名称：**UCAS 国科大心赏心理测评自动答题 (SDS/QSA/UPI/16PF)**

国科大"心赏"心理测评（心理危机预防干预系统，`https://mhec.ucas.ac.cn`）的自动答题油猴（Tampermonkey）插件。登录后**一键**即可自动完成四个量表：

| 量表 | 题量 | 题型 |
|---|---|---|
| 抑郁自评量表 SDS | 20 | 单选（4 级） |
| 自杀态度问卷 QSA | 29 | 单选（5 级态度） |
| 大学生人格测验 UPI | 64 | 单选（是/否、有/没有） |
| 卡特尔 16 种人格因素测验 16PF | 187 | 单选（三选一） |

作答方向：**健康 / 正常优先**（详见下文"作答规则"）。四卷合计约 1.5 分钟完成（可调）。

> 重要：本插件直接调用系统接口生成并提交答案，提交即产生**真实测评记录**，会进入你的心理健康档案。请自行评估风险后使用。

## 目录

- [安装（三步快速版）](#安装三步快速版)
- [一、新手完整教程（没用过油猴必读）](#一新手完整教程没用过油猴必读)
- [二、使用](#二使用)
- [三、配置（脚本顶部 `CONFIG`）](#三配置脚本顶部-config)
- [四、作答规则](#四作答规则)
- [五、接口说明](#五接口说明)
- [六、风险与免责](#六风险与免责)
- [七、发布与更新（GitHub 直发）](#七发布与更新github-直发)
- [八、许可证](#八许可证)
- [九、作者](#九作者)

---

## 安装（三步快速版）

> 已经用过油猴？三步即可。**从没用过，请直接跳到[一、新手完整教程](#一新手完整教程没用过油猴必读)**，那里有每一屏该点哪里的图文级说明。

1. 给浏览器装上 **Tampermonkey** 扩展（Chrome / Edge 装完还需在扩展管理页打开「开发者模式」，原因见教程 1.2）。
2. 点击安装链接 → 在油猴弹出的安装页点「安装」：

   ```
   https://raw.githubusercontent.com/zhan-nine/UCAS_Xinshang_auto/main/ucas-psych-autoanswer.user.js
   ```

3. **手动登录**系统（含滑块验证）→ 打开 `https://mhec.ucas.ac.cn/Visitors/Waiting_test?MenuID=111` → 点右下角面板的「**⚡ 一键自动答题**」。

---

## 一、新手完整教程（没用过油猴必读）

### 1.1 油猴是什么？

「**油猴**」是**用户脚本管理器**的俗称。它本身只是一个浏览器扩展，作用是让你能安装别人写的小脚本，给网页增加原本没有的功能。

本插件的本体是一个 `.user.js` 脚本文件（就是仓库里的 [`ucas-psych-autoanswer.user.js`](ucas-psych-autoanswer.user.js)）。**它不能单独运行，必须先装一个"管理器"来加载它**——就像 `.doc` 文件需要先装 Word。

| 管理器 | 支持的浏览器 | 说明 |
|---|---|---|
| **Tampermonkey**（推荐） | Chrome、Edge、Firefox、Safari、国产 Chromium 系 | 用户量最大，本教程以其为准 |
| Violentmonkey | Chrome、Edge、Firefox、Opera | 开源、免费，界面更简洁，用法几乎一样 |
| Greasemonkey | **仅** Firefox | Firefox 的老牌管理器 |

> 三者**任选其一**即可，装好后安装脚本的步骤基本相同。下文截图文字以 Tampermonkey 为例；若你用 Violentmonkey，按钮可能叫「安装 / Install」而非「添加至 Chrome」。

### 1.2 第一步：安装用户脚本管理器

请**对号入座**找到你的浏览器。每一步都按顺序做，不要跳。

#### Chrome（谷歌浏览器）

1. 打开 Chrome 应用商店的 [Tampermonkey 页面](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)。
2. 点蓝色按钮「**添加至 Chrome**」→ 弹窗中点「**添加扩展程序**」。
3. ⚠️ **关键一步，很多人卡在这里**：地址栏输入 `chrome://extensions` 回车 → 打开页面**右上角**的「**开发者模式**」开关。
   - **为什么必须开**：Chrome 新版本（MV3）规定，扩展要以"用户脚本"方式注入网页，必须先开启开发者模式。不开启会出现「此扩展程序可能已损坏」或**脚本装了却完全不生效**。
   - 开完保持开启即可，**不需要**再做其他操作（不会影响日常上网）。

#### Edge（微软浏览器）

1. 打开 Edge 加载项商店的 [Tampermonkey 页面](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)。
2. 点「**获取**」→ 弹窗中点「**添加扩展**」。
3. 建议同样开启开发者模式：地址栏输入 `edge://extensions` → 打开「**开发人员模式**」。（Edge 通常不开也能用，但开了更稳妥）

> Chrome 与 Edge 都是 Chromium 内核，扩展**可以互装**：你在 Edge 里也能用上面 Chrome 商店的链接（需先在 Edge 开启"允许来自其他应用商店的扩展"）。

#### Firefox（火狐浏览器）

1. 打开 [Firefox 附加组件 - Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)，点「**添加到 Firefox**」→「**添加**」。
2. Firefox **不需要开发者模式**，一般也不会有"已损坏"提示。若弹出权限请求，选「允许」。
3. 若偏好开源方案，可改装 [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) 或 [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/)。
4. 装完在地址栏输入 `about:addons` 可查看/管理已装扩展。

#### Safari（macOS / iPhone / iPad）

1. **Mac**：App Store 搜索「**Tampermonkey**」安装 → 打开 Safari → 菜单「设置 → 扩展」勾选 Tampermonkey → 切到「网站」标签，给 `mhec.ucas.ac.cn` 授权「允许」。
2. **iPhone / iPad**：App Store 安装 Tampermonkey → 「设置 → Safari → 扩展」启用 → 允许该扩展访问 `mhec.ucas.ac.cn`。
3. Safari 上可用的脚本管理器较少（Tampermonkey、Stay、Userscripts），装好后***安装脚本的步骤与下文一致***。

#### 国产浏览器（360、QQ、搜狗、夸克、UC 等）

- 这些浏览器大多基于 Chromium，**通常可以安装 Chrome 扩展**：在它们的「扩展中心 / 应用中心」搜索 **Tampermonkey**，或下载 `.crx` 文件后拖进扩展管理页。
- 同样找一下「**开发者模式**」开关并打开（入口一般在扩展管理页）。
- ⚠️ 部分"精简版/极速版"国产浏览器**阉割了扩展功能**。若翻遍设置都找不到"扩展"入口，请改用 **Chrome / Edge / Firefox** 桌面版。

#### 手机端

- **Android**：可用 [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwi.browser)（直接支持 Chrome 扩展）或 Firefox for Android，装 Tampermonkey 后流程相同。
- **iOS / iPadOS**：用 Safari + Tampermonkey（App Store），或 Userscripts、Stay 等管理器。
- 手机端操作体验不如桌面，**建议在电脑上完成测评**。

### 1.3 第二步：安装本脚本

1. 确认上一步的**管理器已安装完毕**，且它的图标出现在浏览器**右上角工具栏**（看不到图标就点一下工具栏的「拼图」形状按钮，把它固定出来）。
2. **点击**下面这条链接（或复制到地址栏回车）：

   ```
   https://raw.githubusercontent.com/zhan-nine/UCAS_Xinshang_auto/main/ucas-psych-autoanswer.user.js
   ```

3. 油猴会**自动拦截**这个链接，弹出「**安装用户脚本**」页面，上面会显示脚本名称、版本、作者、适用网站（`@match`）。
4. 点页面上的「**安装 / Install**」按钮。
5. 若**没有弹出安装页**，而是直接显示了一大堆代码，请见下方 [1.6 常见问题](#16-常见问题防呆) 的 Q1。

#### 备选安装方式（方式一失败时用）

- **方式二·自动导入**：把链接换成 CDN 版本再点一次：`https://cdn.jsdelivr.net/gh/zhan-nine/UCAS_Xinshang_auto@main/ucas-psych-autoanswer.user.js`
- **方式三·手动粘贴**（最保险）：点管理器图标 →「**管理面板 / Dashboard**」→ 左侧「**实用工具 / Utilities**」右侧或顶部菜单找「**+**」/「添加新脚本」→ 打开 [`ucas-psych-autoanswer.user.js`](ucas-psych-autoanswer.user.js) 全文，复制后**全选删除**编辑器里的模板内容、粘贴进去 → 按 `Ctrl+S`（Mac 为 `Cmd+S`）保存。
- **方式四·Greasy Fork**（尚未上架）：

  <!-- TODO: 由作者补上 Greasy Fork 安装链接 -->
  `（待补充）`

  > **Greasy Fork 说明**：Greasy Fork 对新注册账号有约 **7 天**的发布冷却期（反垃圾机制）。本脚本暂未上架 Greasy Fork，
  > 作者计划于 **2026-10-17** 前后补充链接；在此之前请用上述直装方式，安装与自动更新均不受影响。
  > Greasy Fork 会重写 `@updateURL` / `@downloadURL` 指向自身，因此同一份脚本可同时发布于 GitHub 与 Greasy Fork，二者互不冲突。

### 1.4 第三步：验证是否装好

1. 点浏览器右上角的管理器图标，看是否有**数字角标**（如 `1`）——表示当前页面有 N 个脚本生效。
2. 点「**管理面板 / Dashboard**」→「已安装脚本」列表里应能看到「**UCAS 国科大心赏心理测评自动答题 (SDS/QSA/UPI/16PF)**」，且左侧开关是**打开**状态。
3. 点进该脚本详情，确认 `@match` 一行包含 `https://mhec.ucas.ac.cn/*`。
4. 确认 `@version` 与[仓库最新版本](https://github.com/zhan-nine/UCAS_Xinshang_auto)一致（脚本会自动更新，见 Q4）。

### 1.5 第四步：开始使用

见下一节 **[二、使用](#二使用)**。核心就一句话：**先手动登录，再打开待测页，点右下角面板的「一键自动答题」**。

### 1.6 常见问题（防呆）

**Q1：点安装链接没反应，或页面直接显示一堆代码？**
- 按顺序试：
  1. 确认管理器**已安装且是启用状态**；
  2. **刷新**该页面，或把链接重新粘贴到地址栏再回车；
  3. 换**方式二**的 jsDelivr 链接再点一次；
  4. 仍不行就用**方式三·手动粘贴**（最稳，一次成功）。

**Q2：Chrome / Edge 提示「此扩展程序可能已损坏」，或脚本装了却完全不生效？**
- 打开 `chrome://extensions`（Edge：`edge://extensions`）→ 打开「**开发者模式 / 开发人员模式**」→ **完全重启浏览器**。这是 Chrome 新版最常见的坑。

**Q3：已登录，但页面右下角没有「心赏自动答题」面板？**
- 逐条排查（99% 是前三项）：
  1. 当前网址是否为 `https://mhec.ucas.ac.cn/Visitors/Waiting_test?MenuID=111`（注意 **`Visitors` 首字母大写**，路径写错脚本不会触发）；
  2. 按 `F5` **刷新页面**（脚本在页面加载后才注入）；
  3. 点管理器图标，确认脚本**已启用**且**角标数字 ≥ 1**；
  4. 打开管理面板，检查该脚本是否被误关闭、或显示报错；
  5. 换 **Chrome / Edge / Firefox** 桌面版再试。

**Q4：脚本会自动更新吗？怎么手动更新？**
- 会。脚本内置了更新地址，管理器一般每 24 小时检查一次。
- 手动更新：管理面板 →「**实用工具 / Utilities**」→「**检查用户脚本更新**」；或点脚本详情里的「检查更新」。

**Q5：登录时出现的滑块验证能自动过吗？**
- **不能，也不建议**。请**手动完成登录与滑块验证**，脚本只在你登录后接管答题环节，不接触你的账号密码。

**Q6：怎么临时关闭或卸载？**
- **临时关闭**：管理面板里点脚本右侧的开关。
- **彻底卸载脚本**：管理面板里点「删除」。
- **卸载管理器**：Chrome `chrome://extensions`、Edge `edge://extensions`、Firefox `about:addons` 中移除。

**Q7：装脚本安全吗？**
- 本脚本开源（[MIT](#八许可证)），代码可逐行审阅；它只读取你在 `mhec.ucas.ac.cn` 上的登录凭证（`sessionStorage` 中的 JWT）用于调用官方接口，且 `@match` 限定只在该网站生效。
- **请勿**安装来源不明的脚本——管理器能读取你所有网站的页面内容，风险很高。

## 二、使用

1. 在浏览器里**手动登录**系统（含滑块验证）。
2. 打开待测页：`https://mhec.ucas.ac.cn/Visitors/Waiting_test?MenuID=111`（注意路径大小写为 `Visitors`）。
3. 页面右下角出现"心赏自动答题"悬浮面板：
   - **⚡ 一键自动答题**（主按钮）：直接依次完成全部待测量表并提交。
   - `SDS · 抑郁自评` / `QSA · 自杀态度` / `UPI · 人格测验` / `16PF · 16 种人格`：单独完成某一卷。
   - `仅预览（不提交）`：只做 dry-run，日志里显示每卷题数、作答时长与样例。
   - 顶部状态条显示当前登录账号与运行进度；底部日志区实时显示接口返回（`Code:200 提交成功` 即成功）。
4. 默认即为"一键答题"（**dry-run 关闭**，会真实提交）；如需先核对，点"仅预览（不提交）"。

> 脚本复用你登录后的 `sessionStorage.Authorization`（JWT）与 Cookie 调用接口，不涉及账号密码。

## 三、配置（脚本顶部 `CONFIG`）

```js
const CONFIG = {
  dryRun: false,                        // 默认直接提交；true=只预览
  pacing: { mode: 'timed', minMs: 180, maxMs: 360 }, // 每题节奏；'instant' 立即提交
  pf16Pole: {                           // 16PF 各因子"健康"极向
    high: ['A','B','C','F','G','H','Q3'], // 高分即理想
    low:  ['L','O','Q4'],                 // 低分即理想
    mid:  ['E','I','M','N','Q1','Q2'],    // 居中即理想
  },
  qsaExtreme: false,                    // false=用"比较赞同/比较不赞同"；true=用"完全赞同/完全不赞同"
  randomness: { enabled: true, rate: 0.08, maxFraction: 0.12 }, // 少量随机（见下）
};
```

- `pacing.mode = 'timed'` 会在 `Paper/GetPaperInfo` 与 `Paper/Submit` 之间按 `minMs~maxMs` 真实等待；默认每题 **180~360ms（逐题随机）**，四卷合计约 1.5 分钟。调大更接近真人节奏，调小更快。
- 想在提交前核对，把 `dryRun` 设为 `true`，或直接点面板里的"仅预览（不提交）"。

## 四、作答规则

选项按**题内位置**选择（A=第 0 项、B=第 1 项、C=第 2 项……），再用取卷返回的 `AnswerList` 动态取 `AnswerID`，因此不依赖易变的选项 ID。

### SDS（20 题，目标：无抑郁，粗分 20 / 标准分 25）
- 正向题 `2,5,6,11,12,14,16,17,18,20` → 选最后一项"绝大部分或全部时间"。
- 其余 10 道症状题 → 选第一项"没有或很少时间"。

### QSA（29 题，目标：珍视生命 / 关怀方向）
- 选"赞同"：`1,2,4,6,7,9,11,12,13,22,24,25`
- 选"不赞同"：`3,5,8,10,14,15,16,17,18,19,20,21,23,26,27,28,29`
- 默认取"比较赞同 / 比较不赞同"，避免全选极端；置 `qsaExtreme:true` 可改用"完全"。

### UPI（64 题，目标：无阳性）
- 第 `5,20,35,50` 题（正向"测伪题"）→ 选"有"。
- 其余全部（含第 25 题"想轻生"、第 61–64 题）→ 选"否 / 没有"。

### 16PF（187 题，目标：理想化健康剖面）
- 效度题 `1,2,187` → 选"是的"。
- `A,B,C,F,G,H,Q3` 因子 → 选计分键中的"高分选项"（B 因子即正确答案）。
- `L,O,Q4` 因子 → 选"高分选项"的相反极端（低分）。
- `E,I,M,N,Q1,Q2` 因子 → 选中间项（"介于A和C之间/不一定"等）。

16PF 计分键（字母 = 该题高分选项）内置于脚本 `PF16_FACTOR_KEY`。

### 少量随机性（默认开启，不影响整体评估）

为避免答案过于"完美规律"，脚本会在**安全变体**范围内做少量随机（`CONFIG.randomness`）：

- `rate: 0.08`：每道题有 8% 概率改用其"安全变体"；`maxFraction: 0.12` 限制每卷变体比例上限。
- 变体仍落在健康方向，只是不再总是取最极端项：
  - **SDS** 症状题偶尔选"小部分时间"、正向题偶尔选"相当多时间"（标准分仍在无抑郁区间）。
  - **QSA** 在"比较/完全"之间轻微游走。
  - **UPI** 非关键症状题偶尔选"是"（仅极少量，总分远低于阳性阈值）。
  - **16PF** 高/低分因子偶尔退到中间项，居中因子偶尔偏一到高分侧（因子分变化约 ±1）。
- **关键题永不随机**：SDS 第 19 题（自杀意念）、UPI 第 25 题（想轻生）与 4 道测伪题及第 61–64 题、16PF 效度题 1/2/187 与聪慧性（B）正确题。
- 关闭随机：把 `CONFIG.randomness.enabled` 改为 `false`。

> 实测（真实试卷、多次采样）：SDS 标准分 25–28（<53）、UPI 总分 6–11（<25）且第 25 题恒为"否"、16PF 的 C 高（24–26）/ O 低（0–3）/ Q4 低（0–1）/ B 满分（13），整体健康结论保持稳定。

## 五、接口说明

- 基地址 `https://mhec.ucas.ac.cn:8019/`，请求为 `application/json`，鉴权用 `Authorization` 头。
- `POST ScaleIssue/GetLfzWaitText` → 待测列表
- `POST Paper/GetPaperInfo` `{SourceNo,PaperID,UserID}` → 取卷（含 `PaperResultID`、`QuestionList`）
- `POST Paper/Submit` `{data:{...}}` → 交卷；`TmpResult` 每答一题拼一段 `;题ID|选项ID|开始|结束|填空|父选项|上一题号`，时间格式 `YYYY/M/D H:mm:ss`。

## 六、风险与免责

- 提交产生真实记录并进入心理档案，请确认你接受该后果。
- 系统说明明确"拒绝作答、作答不完整或故意歪曲作答的个体将被甄别"，且每题记录作答时间；本脚本的健康作答与时长模拟**不保证**不被任何服务端规则识别。
- 16PF 计分键来自公开资料，已抽样核对关键题（如第 28 题应选"石头"），但不对结果解释负责。
- 本项目以 MIT 许可开源，初衷为学习与研究；请遵守学校相关管理规定，使用者自行承担全部责任（见[许可证](#八许可证)）。

## 七、发布与更新（GitHub 直发）

本脚本以 GitHub 为主要发布源，用户无需 Greasy Fork 即可安装并自动更新。

**分发链接**

| 用途 | URL |
|---|---|
| 安装 · 最新（推荐） | `https://raw.githubusercontent.com/zhan-nine/UCAS_Xinshang_auto/main/ucas-psych-autoanswer.user.js` |
| 安装 · 备选（MIME 正确） | `https://cdn.jsdelivr.net/gh/zhan-nine/UCAS_Xinshang_auto@main/ucas-psych-autoanswer.user.js` |
| 自动更新（内置 `@updateURL`/`@downloadURL`） | 同"安装 · 最新" |

> **两者区别**：GitHub raw **只缓存约 5 分钟**，推送后立刻是最新版，作为安装与更新源最及时（Tampermonkey 依据 URL 末尾的 `.user.js` 识别，不受 `text/plain` 影响）。
> jsDelivr 的 MIME 为 `application/javascript`、更"标准"，但 `@main` 分支缓存约 12 小时，可能拿到旧版本；
> 如需立刻刷新，可访问 `https://purge.jsdelivr.net/gh/zhan-nine/UCAS_Xinshang_auto@main/ucas-psych-autoanswer.user.js` 清缓存。

**发布流程**

1. 修改 `ucas-psych-autoanswer.user.js`，并**提升 `@version`**（例如 `1.3.2 → 1.3.3`）。
2. 提交并推送：

   ```bash
   git add -A && git commit -m "v1.3.3: ..." && git push origin main
   ```

3. GitHub Actions（[`.github/workflows/validate-userscript.yml`](.github/workflows/validate-userscript.yml)）会做语法检查、元数据校验与 **`@version` 递增检查**；
   若忘记升版本，CI 会失败并提示。
4. 推送即生效：raw 几分钟内更新，Tampermonkey 在下一次检查更新时自动升级。

**以后上架 Greasy Fork**

- 到 Greasy Fork 发布时可直接粘贴同一份代码；GF 会**重写** `@updateURL` / `@downloadURL` 指向它自己，故二者可共存、互不冲突。
- 但请注意 GF 规定：脚本**主体功能必须完整地托管在 Greasy Fork 上**，不允许靠外链加载主体代码。
- 若只想发布于 Greasy Fork，可删除 `@updateURL` / `@downloadURL`；CI 默认仅对其告警，设置环境变量 `STRICT_GF=1` 可改为报错。

## 八、许可证

本项目采用 **MIT License** 开源发布，允许任何人自由使用、复制、修改、合并、发布、分发、再授权及销售本软件，**只需保留原始版权声明与许可声明**。

```
MIT License

Copyright (c) 2026 Xinpei Zhang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

完整文本见仓库根目录 [`LICENSE`](LICENSE)。

> 说明：MIT 的"按原样提供、不提供任何担保"条款与上文"风险与免责"一致——作者不对使用本脚本产生的任何后果（包括心理档案记录）承担责任。

## 九、作者

- **作者**：Xinpei Zhang
- **GitHub**：[@zhan-nine](https://github.com/zhan-nine)
- **项目主页**：<https://github.com/zhan-nine/UCAS_Xinshang_auto>
- **问题反馈**：<https://github.com/zhan-nine/UCAS_Xinshang_auto/issues>

© 2026 Xinpei Zhang. Released under the [MIT License](LICENSE).
