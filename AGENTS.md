## 先读

本仓库的规则以 `CLAUDE.md` 为准（不可破坏的约束、目录、检查命令），这里只补充 Coze 上要知道的几点。两份说明有出入时按 `CLAUDE.md`。

## 项目概述

澳新两条参考路线的公开分享站（oz-nz-trip-plans）：读者可以看两趟参考路线、排自己的路线（`/plan`），排出来的方案在 `/mine`、`/mine/budget`、`/mine/prep`，方法页 `/method`。没有数据库、登录和后端接口；读者的修改只存在其浏览器 localStorage。

## 技术栈与运行

- Next.js 16（App Router）+ React 19，`next build` 后用 `next start` 运行（读 `PORT`）；Node 24（`.nvmrc`）。
- 样式是纯 CSS（`src/styles/`），Markdown 用 `marked`。
- `.coze [dev]`：`.cozeproj/scripts/dev_build.sh`（npm ci + build）、`dev_run.sh`（next start，端口读 `.preview` 的 expose_port=5000，绑 0.0.0.0）；部署同样用 5000，不碰 9000。
- 包管理器保持 npm（`package-lock.json`、部署脚本都按 npm 写），不迁移 pnpm，不删 lock。
- 检查：`npm test` → `npm run check:privacy` → `npm run build` → `npm run test:e2e`。

## 不可破坏的约束（摘要，全文见 CLAUDE.md）

- `data/`（含 `places.json`、`nz-overview.json`）、`content/au2026-guide.md`、`content/method.md`、`public/nz/`、`public/au2026/` 都是导出结果，不在这里手改。
- 页面文字不用人称（「我 / 你 / 我们 / 你们」，`tests/voice.test.mjs` 检查）；两趟叫「参考路线」，读者排出来的叫「方案」，动作叫「排路线」；不写开发口吻。
- `/nz` 只按“第 N 天”写：不写年份、日期、星期、航班号，住处只写到区域，不放日出日落时刻和按日期的气温。
- 不放私人信息：订单号、订位号、确认号、姓名、付款说明、私人邮箱。
- 测试、e2e 和文档里的示例日期只用 3–6 月、9–11 月（`check:privacy` 检查所有被跟踪的文件）。
- 仓库公开：提交身份固定是 `oz-nz-trip-plans <trips@example.invalid>`，提交说明写中性的话；Coze 终端只 pull，不提交：要改的内容带回本地，经检查后再提交推送。
