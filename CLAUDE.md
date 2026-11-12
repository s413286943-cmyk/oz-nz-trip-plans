# oz-nz-trip-plans（澳新两次旅行 · 公开分享版）

公开仓库 `s413286943-cmyk/oz-nz-trip-plans`，部署在 Coze：项目 `7706904922159333402`（https://code.coze.cn/p/7706904922159333402），正式地址 **https://oznz-trips.coze.site**（平台默认域名 `h326jpn2nc.coze.site` 也能打开）。2026-11-12 首次部署 GitHub `556c4ae`，部署后从正式域名跑 `E2E_BASE_URL=https://oznz-trips.coze.site npm run test:e2e` 全部通过。自用版（带记账、访问码）是私有仓库 `s413286943-cmyk/Aussie-Split`，本地 `/Users/SeanSun/Documents/Aussie/aussie-split-bill`。

## 不可破坏的约束

- **数据只从自用版导出**：`data/`、`content/au2026-guide.md`、`public/nz2027/`、`public/au2026/` 都由自用仓库的 `npm run share:export -- ../trip-share --costs <账本汇总 JSON>` 生成（步骤见自用仓库 CLAUDE.md“分享版”）。不要在这里手改这些文件，否则下次导出会被覆盖。
- **不放私人信息**：订单号、订位号、确认号、姓名、扣卡说明、私人邮箱都不能出现。名字、地址、价格可以。导出时自用仓库有完整禁用词表；这里的 `npm run check:privacy` 是第二道检查。
- **仓库是公开的**：提交作者用 GitHub noreply 邮箱（本仓库 `.git/config` 已设），不要用私人邮箱提交。
- 没有数据库、登录和后端接口；访客的修改只存在其浏览器 localStorage（键 `trip-share:<trip>:v1`，清单勾选 `trip-share:<trip>:checks`）。

## 运行与检查

- Node 24 开发（`.nvmrc`），`engines` 允许 >=20.9。本机先 `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`。
- `npm ci` → `npm test` → `npm run check:privacy` → `npm run build` → `npm run test:e2e`（本机 Chrome；本机有代理时去掉 `HTTP(S)_PROXY` 等变量再跑）。
- 构建 `next build`，运行 `next start`（读 `PORT`）。

## 更新流程

自用版行程上线后：
1. 在自用仓库跑 `share:export`，这里跑检查，提交推送到 GitHub；
2. Coze 项目是 GitHub 导入的，工作区的 `origin` 就是这个仓库：在 Coze 终端 `GIT_TERMINAL_PROMPT=0 git pull --ff-only origin main`，`git status` 干净、`git log -1` 等于 GitHub 的提交；
3. 点「部署」，部署版本选这个提交，「开始部署」，等到「部署成功」；
4. `E2E_BASE_URL=https://oznz-trips.coze.site npm run test:e2e` 复查。

Coze 自己加的 `.coze`、`AGENTS.md`、`.codegraph/.gitignore` 已经同步进 GitHub；Coze 助手若再改文件，先在 Coze 终端 `git push origin main`（无需输入凭据）或把改动带回本地，保持两边同一个提交。
