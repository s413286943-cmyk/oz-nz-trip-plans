## 项目概述
澳新两次旅行的真实行程与自驾攻略公开分享站（oz-nz-trip-plans）。打开就能在浏览器里改成自己的：改每日行程、加删步、导入导出、打印。纯静态，无数据库/登录/后端接口；访客修改只存浏览器 localStorage（键 `trip-share:<trip>:v1`，清单勾选 `trip-share:<trip>:checks`）。

## 技术栈
- Next.js 16（App Router，Turbopack，SSG 静态导出）+ React 19，`next start` 运行
- Node 24（`.nvmrc`），`engines >=20.9`
- 样式：纯 CSS（`src/styles/nz2027.css`、`share.css`），非 Tailwind
- Markdown 渲染：`marked`
- 数据驱动：`data/*.json` + `content/*.md` + `public/<trip>/` 图片

## 目录结构
- `src/app/`：页面（`/`、`/au2026*`、`/nz2027*`）
- `src/components/`：`TripFrame`(布局)、`TripPlan`(时间线编辑)、`CostView`、`DiningView`、`PrepList`
- `src/lib/`：`markdown`、`edits`(localStorage 编辑)、`guide`、`format`、`useTripCopy`
- `data/`：`au2026.json`、`nz2027.json`、`nz2027-costs.json`（行程数据源）
- `content/au2026-guide.md`、`public/au2026/`、`public/nz2027/`：攻略正文与配图
- `.cozeproj/scripts/`：预览与部署脚本
- `e2e/`、`tests/`：端到端与单元测试

## 关键入口 / 核心模块
- 入口：`src/app/layout.jsx`（根布局）；页面路由见 `src/app/**/page.jsx`
- 数据不可在 `data/`、`content/au2026-guide.md` 手改——由自用仓库 `share:export` 导出覆盖，改了会被下次导出冲掉

## 运行与预览
- 预览型（`project_type=web`，`preview_enable=enabled`）
- `.coze [dev]`：`build=.cozeproj/scripts/dev_build.sh`（npm ci + build）、`run=.cozeproj/scripts/dev_run.sh`（next start，端口读 `.preview` expose_port=5000，绑 0.0.0.0，幂等清理 5000 残留）
- 常用命令：`npm test`、`npm run check:privacy`、`npm run test:e2e`、`npm run build && npm start`
- 无 API 路由，交付验收用 `test_run` 跑静态检查 + 服务探活即可

## 用户偏好与长期约束
- **不可破坏约束**：
  - `data/`、`content/au2026-guide.md`、`public/nz2027/`、`public/au2026/` 数据只能由自用仓库导出生成，不在此手改
  - 不放私人信息（订单号、订位号、确认号、姓名扣卡说明、私人邮箱）；`npm run check:privacy` 是第二道检查
  - 仓库公开；提交作者用 GitHub noreply 邮箱，不用私人邮箱
- 包管理器：当前为 npm（`package-lock.json` 存在）。工程规范要求 Node 项目改用 pnpm，**迁移尚未执行，待用户确认**——不擅自删除 lock 或重写脚本

## 常见问题和预防
- 端口：预览固定 5000（`.preview`），部署也 5000；不碰 9000。前端无 API，相对路径即可，无域名硬编码
- 构建产物在 `.next/`；静态导出，任何能跑 Node 的地方都可部署