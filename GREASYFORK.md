# Greasy Fork 上架资料（UCAS 国科大心赏心理测评自动答题）

> 本文件用于把本项目发布到 [Greasy Fork](https://greasyfork.org/)。
> Greasy Fork 的发布表单是**分字段**的，下文按字段逐一给出可直接复制的内容。
> 仓库地址：<https://github.com/zhan-nine/UCAS_Xinshang_auto>　当前版本：**1.5.1**

---

## 一、表单字段速填

| Greasy Fork 字段 | 填什么 | 长度限制 |
|---|---|---|
| **Script name（脚本名称）** | `UCAS 国科大心赏心理测评自动答题 (SDS/QSA/UPI/16PF)` | 100 |
| **Description（简介）** | 见 [第二节](#二简介description-字段) | 500 |
| **Additional info（详细说明）** | 见 [第三节](#三详细说明additional-info-字段) 全文粘贴 | 50000 |
| **Script code（脚本代码）** | 粘贴仓库根目录 [`ucas-psych-autoanswer.user.js`](ucas-psych-autoanswer.user.js) 的**全部内容** | 2 MB |
| **Language / 语言** | `中文（简体）` | — |
| **License / 许可证** | `MIT License` | — |
| **Tags / 标签** | `国科大`、`UCAS`、`心理测评`、`自动答题`、`Tampermonkey` | 建议 ≤5 |
| **Script icon / 图标** | 可留空 | — |
| **Sync / 同步** | 见 [第五节](#五同步与自动更新)（可留空，用 Webhook 更即时） | — |

> 说明：脚本名称、简介、`@match` 等也会从脚本头部的 `@name` / `@description` 元数据读取，两边保持一致即可。

---

## 二、简介（Description 字段）

> 以下内容约 150 字（含标点），直接粘贴：

国科大"心赏"心理测评系统（mhec.ucas.ac.cn）辅助答题脚本。手动登录后一键完成 SDS 抑郁自评、QSA 自杀态度、UPI 大学生人格、16PF 卡特尔16种人格四个量表。得分落在正常范围内且逐题随机（每人结果不同），自杀意念等关键题严格作答。需自行登录，仅支持"本人待测"页。

---

## 三、详细说明（Additional info 字段）

> 以下为 Markdown 正文，可直接整段复制到 **Additional info**。

```markdown
国科大"心赏"心理测评（心理危机预防干预系统，`https://mhec.ucas.ac.cn`）的自动答题辅助脚本。
**手动登录后一键**依次完成四个量表，四卷合计约 1.5 分钟。

## 支持的四个量表

| 量表 | 题量 | 题型 |
|---|---|---|
| 抑郁自评量表 SDS | 20 | 单选（4 级） |
| 自杀态度问卷 QSA | 29 | 单选（5 级态度） |
| 大学生人格测验 UPI | 64 | 单选（是/否、有/没有） |
| 卡特尔 16 种人格因素测验 16PF | 187 | 单选（三选一） |

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）。
   - Chrome / Edge 装完请在扩展管理页打开「**开发者模式**」，否则脚本可能不生效。
2. 点击本页的「安装此脚本」按钮，在油猴弹出的安装页点「安装」。
3. 确认脚本已启用，`@match` 允许 `https://mhec.ucas.ac.cn/*`。

> 也支持从 GitHub 直装并自动更新：<https://github.com/zhan-nine/UCAS_Xinshang_auto>

## 使用

1. 在浏览器里**手动登录**系统（含滑块验证）。
2. 打开待测页：`https://mhec.ucas.ac.cn/Visitors/Waiting_test?MenuID=111`
   - **URL 大小写不影响**（`/visitors/waiting_test`、带尾斜杠均正常）。
   - ⚠️ 必须是「**本人待测**」页；若进的是 `/Client/Waiting_test`（"来访者测试"，给他人作答），脚本**不会**显示面板。
3. 页面右下角出现「心赏自动答题」悬浮面板：
   - **⚡ 一键自动答题**：依次完成全部待测量表并提交。
   - `SDS / QSA / UPI / 16PF` 四个按钮：单独完成某一卷。
   - **仅预览（不提交）**：只做演练，日志显示每卷题数与预计时长，不产生记录。
   - 面板底部日志实时显示接口返回，`Code:200 提交成功` 即成功。

> 脚本复用你登录后浏览器里的登录凭证（`sessionStorage` 中的 JWT）与 Cookie 调用系统自身接口，**不涉及、也不会索取你的账号密码**。

## 作答策略（重点）

设计目标：**得分落在正常范围内**，同时**每个用户、每次作答都不同**，避免出现"满分/零分"这类不自然的极端剖面。

| 量表 | 作答范围 |
|---|---|
| SDS 抑郁自评 | 粗分 30~38 → **标准分 38~48**（无抑郁） |
| UPI 大学生人格 | **阳性 3~9 项**（远低于阳性阈值 25） |
| 16PF 卡特尔 | 各因子**居中**（标准十分约 4~6），不出现 0 分/满分 |
| QSA 自杀态度 | 逐题加权抽样，整体偏"珍视生命 / 关怀"方向 |

**关键题在任何情况下都严格作答、不参与随机：**

- SDS 第 19 题（自杀意念）
- UPI 第 25 题（想轻生）、4 道测伪题（第 5/20/35/50 题）、第 61–64 题
- 16PF 效度题（第 1/2/187 题）、聪慧性（B）正确题

作答节奏默认每题 180~360 毫秒随机，可在脚本顶部 `CONFIG` 自行调整；也可把 `CONFIG.profile.mode` 改为 `'ideal'` 切换回旧的极端理想剖面。

## 适用与限制

- 仅适用于国科大「心赏」系统 `mhec.ucas.ac.cn`。
- 只支持「本人待测」页 `/Visitors/Waiting_test`。系统的其它页面（含"来访者测试"页）不会触发。
- 需要你自己完成登录与滑块验证；脚本不处理登录环节。
- 页面改版可能导致脚本失效，欢迎在 GitHub Issues 反馈。

## 风险提示

- 提交后会产生**真实测评记录**并进入你的心理健康档案，请确认你接受该后果后再使用。
- 系统说明中提到"拒绝作答、作答不完整或故意歪曲作答的个体将被甄别"，且会记录每题作答时间；本脚本的正常范围作答与时长模拟**不保证**不被任何服务端规则识别。
- 16PF 计分键来自公开资料，作者不对结果解释负责。
- 请遵守学校相关管理规定，使用者自行承担全部责任。

## 开源与反馈

- 源码仓库：<https://github.com/zhan-nine/UCAS_Xinshang_auto>
- 问题反馈：<https://github.com/zhan-nine/UCAS_Xinshang_auto/issues>
- 许可证：MIT License
```

---

## 四、标签与语言

- **Language**：中文（简体）
- **Tags（建议，挑 3~5 个）**：`国科大`、`UCAS`、`心理测评`、`自动答题`、`Tampermonkey`
- **License**：MIT License（与仓库 [`LICENSE`](LICENSE) 一致，脚本头部也已声明 `@license MIT`）

---

## 五、同步与自动更新

Greasy Fork **没有可直接调用的发布 API**，"自动更新"指的是：让 Greasy Fork 定期（或收到 Webhook 时）从外部 URL 拉取脚本。

本项目的情况：

- 脚本头部含 `@updateURL` / `@downloadURL` 指向 GitHub 原始文件（供**从 GitHub 直装**的用户自动更新）。
- 发布到 Greasy Fork 时，GF 会**自动重写这两个字段**指向它自己，因此两边**可以共存，不冲突**。
- 若你只想在 Greasy Fork 维护，也可以直接把这两行删掉再发布（本项目 CI 对此仅告警，不影响通过）。

**两种更新方式选其一：**

| 方式 | 做法 | 时效 |
|---|---|---|
| 手动 | 修改后在脚本编辑页粘贴新代码、保存 | 立即 |
| URL 同步 | 在脚本页「同步」里填仓库 raw 地址，GF 每天拉取一次 | 约 24 小时 |
| Webhook（推荐） | 在 Greasy Fork 用户页拿到专属 Webhook URL → GitHub 仓库 `Settings → Webhooks → Add webhook`，Content type 选 `application/json`，事件选 **Just the push event** | 推送后数十秒 |

> ⚠️ 无论哪种方式，**每次都必须提升 `@version`**，否则 Greasy Fork 不会创建新版本。本仓库的 GitHub Actions 已内置该检查（忘记升版本会让 CI 失败）。

---

## 六、发布前检查清单

- [ ] 新账号需等待约 **7 天**冷却期（Greasy Fork 反垃圾限制）；若提示"邮箱域名被屏蔽"，请更换常用邮箱（QQ / Gmail / Outlook 等）。
- [ ] 脚本**主体功能必须完整托管在 Greasy Fork**，不能靠外链加载主体代码（GF 明令禁止）。
- [ ] 文件大小 < **2 MB**（本脚本约 37 KB，远低于上限）。
- [ ] `@name` / `@description` / `@version` / `@license` 元数据完整。
- [ ] 已从仓库根目录复制 `ucas-psych-autoanswer.user.js` 的**全部内容**（含 `// ==UserScript==` 头部）。
- [ ] 发布后自测：重新从 Greasy Fork 安装一次，确认面板正常出现。

---

## 七、发布后

- 把 GF 脚本页链接补到仓库 README 的「安装」章节（当前为 `（待补充）`）。
- 建议在 GF 脚本页上传 1~2 张截图（待测页 + 悬浮面板），列表页展示效果更好。
- 后续更新走 [第五节](#五同步与自动更新) 的流程；GF 会保留历史版本便于回滚。

---

## 附：一句话简介备选（若 500 字限制更严时用）

- 国科大心赏心理测评一键辅助答题：SDS / QSA / UPI / 16PF 四量表，正常范围 + 逐题随机，关键题严格作答。
- UCAS 心理测评自动答题（心赏系统）：抑郁自评 / 自杀态度 / 大学生人格 / 16PF，登录后一键完成。
