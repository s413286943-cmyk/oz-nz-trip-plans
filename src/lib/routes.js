// Where each route's pages live on the site, and how the two routes are introduced.
export const ROUTE_PAGES = {
  nz: { view: "/nz" },
  au2026: { view: "/au2026" },
  mine: { view: "/mine", budget: "/mine/budget", prep: "/mine/prep", plan: "/plan" },
};

export const ROUTE_CARDS = [
  {
    id: "nz",
    when: "南半球夏天 · 17 天 · 两人",
    title: "悉尼 3 晚 + 新西兰南岛自驾 + 奥克兰",
    line: "悉尼进，基督城取车一路开到皇后镇，Milford 坐大巴，最后飞奥克兰。每天写满细节，二选一的地方都写了选这个会错过什么。",
    who: "适合：第一次去新西兰、想自驾南岛的人",
    status: "每天写满细节的行程和花销",
  },
  {
    id: "au2026",
    when: "2026 年 7 月底 – 8 月中 · 16 天 · 两对夫妻",
    title: "澳洲自驾：4 次租车、6 天开车，踩过的坑",
    line: "墨尔本进、悉尼出，大洋路、凯恩斯高原和 Palm Cove、悉尼南海岸自己开车。每天去哪、住哪、吃什么，租车、保险和花销，都附了经验。",
    who: "适合：冬天去澳洲、想自己开一段的人",
    status: "16 天行程 + 自驾攻略",
  },
];

// Stands in for "our original" on the visitor's own plan pages, which have none.
export const EMPTY_PLAN = { version: "mine", trip: { title: "方案" }, stages: [], days: [] };
