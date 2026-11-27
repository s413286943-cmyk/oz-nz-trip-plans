# oz-nz-trip-plans（澳新两次旅行 · 公开分享版）

两次澳新旅行的行程和自驾攻略，读者打开就能在浏览器里改成自己的。纯静态，没有数据库、登录和后端接口；访客的修改只存在其浏览器 localStorage（键 `trip-share:<trip>:v1`，清单勾选 `trip-share:<trip>:checks`）。存的副本和导出的文件带 `v: 2` 和 `trip` 写明属于哪条路线，只有旧版留下的才按内容推断；勾选和清单按单项写进存储里的最新状态，打开文件时行程和清单一起写、不成就全部退回（`openWithSide`），提醒按 id 改，另一个标签页删掉的东西不会改到别处。

## 不可破坏的约束

- **页面文字**：不用人称，不出现「我 / 你 / 我们 / 你们」（`tests/voice.test.mjs` 检查 `src`、地点库、路线图数据和方法页）。两趟行程叫「参考路线」（新西兰参考路线、澳洲参考路线），排出来的叫「方案」，排的动作叫「排路线」；按钮只写动作（排路线、看参考路线、改金额、存成文件），不写开发口吻（数据、浏览器存储、源码之类）。两趟行程自带的游记文字（每天的安排、2026 的经验、攻略）是导出内容，按导出那边的规则改。
- **2026 页面结构**：`/au2026` 是行程（`src/components/AtlasTrip.jsx`，样式在 `src/styles/atlas/`），附整趟、每一段、每一天的经验（`data/au2026-retro.json`）；`/au2026/guide` 是攻略；`/au2026/days` 是可编辑版本，访客的修改也会显示在 `/au2026`。
- **导出内容不手改**：`data/`（含 `places.json`）、`content/au2026-guide.md`、`content/method.md`、`public/nz/`、`public/au2026/` 都是导出结果，在这里改了会被下次导出覆盖。
- **排你自己的路线**：`/plan`（`src/components/RouteBuilder.jsx`）由读者定地点、顺序和晚数，草稿存 `trip-share:mine:route`；`src/lib/compose.js` 用 `data/places.json` 拼出每一天：到达那天优先用我们走同一段路的那一天，其余用我们在那个地方过的日子（优先同一趟旅行的），不够就加「在某地多留一天」，我们没走过的路段和没去过的地方写明要自己查。`reviewRoute` 给提醒（长途、搬家太频繁、给天气留一天、没有国际航班、没走过的路）。生成的方案存成 `trip-share:mine:v1`（`plan` 记路线、人数、节奏、预算里自己填的数，`prep` 记清单里删掉的和自己加的），页面在 `/mine`、`/mine/budget`、`/mine/prep`。加减天数后 `renumberDays` 重新编号、重排日期，并把文字里的「第 N 天」改成新编号；从我们那趟搬过来、对不上的写成「我们那趟的 DN」。
- **路线图、起伏、光带、路上**：`/nz` 顶部是南岛手绘路线图（`src/components/RouteMap.jsx`、`src/lib/routeMap.js`，数据 `data/nz-overview.json`），点一站出卡片，下面是「这一路的起伏」（`src/lib/ride.js`）。**`/nz` 只按“第 N 天”写，不放日出日落时刻和按日期的气温**，这些只在读者自己的方案里按读者的日子算（有 e2e 断言）。读者自己的方案 `/mine` 和排路线页 `/plan` 有路线图，按路线里的国家给图（`src/lib/routeMap.js` 的 `SHEETS`：新西兰南岛、澳洲东部；两国都有就上方切换，另一国直飞过来的地方画在角上的圆圈里，奥克兰在南岛图右上角）、起伏、「每天的光」（`src/lib/sun.js` 在读者手机上按地点和时区算日出日落，气温用 `places.json` 每个地方 12 个月的往年平均，出发前 16 天内由读者浏览器向 Open-Meteo 取预报：请求只带地点坐标、时区和天数（`forecast_days`），不带方案的日期，因为部署平台的统计脚本会记下页面发出的请求地址；按地点存在 `trip-share:mine:weather`，6 小时内只在缺地点或缺日子时再取，10 秒超时，失败的地点 10 分钟内不重试），出发后显示「路上」（`src/components/RoadBoard.jsx`：当地时钟（换时区那天写「某地时间」；参考路线以外的澳洲地方在加的时候选州定时区，其他地方按手机时间）、光带上的此刻、离日落多久、接下来、今晚住、明天第一件事；`?preview=road` 按第 1 天上午 10 点预览）。
- **`/nz` 按“第 N 天”写**：方便读者套到自己的日期；住处写到区域。
- **不放私人信息**：订单号、订位号、确认号、姓名、付款说明、私人邮箱都不能出现。地点名称和价格可以。
- **仓库是公开的**：提交身份固定是 `oz-nz-trip-plans <trips@example.invalid>`（本机 `.git/config` 已设；Coze 终端只 pull，不提交），不用真实姓名和私人邮箱；提交说明只写中性的话（例如“更新分享内容”）。推送前要通过导出那边的身份、提交说明和文件检查。
- **示例日期**：测试、e2e 和文档里的日期只用 3–6 月、9–11 月（`npm run check:privacy` 检查所有被跟踪的文件；2026 那条路线自己的日期除外）。

- **响应头和外部请求**：`next.config.mjs` 给每页发 `Content-Security-Policy`（`scripts/security-headers.mjs`）：脚本、样式、图片只来自本站，网络请求只到本站和 `https://api.open-meteo.com`，只有本站和 Coze 编辑器能嵌入页面。托管平台插进页面的统计脚本因此加载不了、发不出数据；页面文字写的是“方案不会上传，托管平台可能统计打开次数，取预报时各地的位置会发给 Open-Meteo，方案的日子不发”（和请求一致：只带坐标、时区和天数）。加任何外部服务（字体、统计、地图）都要先改这条策略，`tests/headers.test.mjs` 和 e2e 的“no requests to other sites”会拦下。`public/nz`、`public/au2026` 的图片缓存一周，换图不换文件名时读者最多一周后才看到新图。
- **分享预览和搜索**：每页用 `src/lib/meta.js` 的 `pageMeta` 写自己的简介和分享卡片图（导出的 `/nz/card.jpg`、`/au2026/card.jpg`，1200×630），`/mine` 系列不进搜索；`src/app/not-found.jsx` 是中文 404。

## 运行与检查

- Node 24 开发（`.nvmrc`），`engines` 允许 >=20.9。
- `npm ci` → `npm test` → `npm run check:privacy` → `npm run build` → `npm run test:e2e`（用本机 Chrome；有代理时去掉 `HTTP(S)_PROXY` 等变量再跑）。
- 构建 `next build`，运行 `next start`（读 `PORT`）。
