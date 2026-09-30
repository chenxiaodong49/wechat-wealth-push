# 理财新品日报 · 微信小程序 + 每日推送后端

每天推送**未来 3 天内新发行**、风险等级 **R1/R2**、且**购买后半年内可赎回**的
**招商银行 / 中国银行 / 工商银行**理财产品。

> 数据来源：中国理财网（银行理财产品的官方登记托管平台，覆盖全部银行与在售产品）。

---

## 一、功能与实现要点

| 需求 | 实现 |
| --- | --- |
| 招行 / 中行 / 工行 APP 可购买 | `config.banks` 按**购买渠道/销售机构**匹配（含这三家 APP 代销的其他机构产品，不限定发行机构） |
| 风险 R1 / R2 | `filter.isRiskEligible` 白名单过滤 |
| 可赎回时间 ≤ 半年 | `filter.isRedeemEligible`：开放式/现金管理类看「最短持有期」、封闭式看「产品期限」，均 ≤ 180 天 |
| 未来 3 天新发 | `filter.isWithinLookahead`：起售日落在 `[今天, 今天+3]` |
| 每天推送 | 后端 `node-cron` 定时任务（`PUSH_CRON`，默认每天 09:00）抓取→筛选→逐用户发订阅消息 |
| 微信主动推送 | 微信订阅消息（subscribe message），需用户先在端内点「开启每日推送」授权 |

> **重要口径**：筛选维度是「购买渠道（销售机构）」，不是「发行机构」。
> 招行/中行/工行 APP 既卖自家理财子公司（招银理财/中银理财/工银理财）发的产品，
> 也代销其他机构（如建信理财、农银理财、兴银理财）的产品——只要能在这三家 APP 里买到就算。
> 归一化后 `seller`=销售机构、`issuer`=发行机构；`bankCode` 按 `seller` 匹配（接口无销售机构时用 `issuer` 兜底匹配三家理财子公司）。
> 小程序详情页同时展示「购买渠道」与「发行机构」。

### “可赎回不超过半年”的判定口径
- **开放式 / 现金管理类**（可随时或最短持有后赎回）：以「最短持有期」是否 ≤ 180 天为准。
- **封闭式**：到期才能取回，以「产品期限」是否 ≤ 180 天为准（视为半年内资金可回）。
- 该口径集中在 `server/src/filter.js`，可按你的合规要求调整。

---

## 二、目录结构

```
wechat-wealth-push/
├── server/                 # Node.js 后端（Express + node-cron）
│   ├── package.json
│   ├── .env.example        # 复制为 .env 填写真实配置
│   └── src/
│       ├── config.js       # 全局配置（银行/风险/期限/推送时间…）
│       ├── chinawealth.js  # 中国理财网抓取 + 归一化（失败自动回退样例）
│       ├── mock.js         # 内置样例数据（保证本地开箱即跑）
│       ├── filter.js       # 筛选逻辑（核心）
│       ├── wechat.js       # access_token / code2session / 订阅消息
│       ├── store.js        # 订阅用户存储（JSON 文件，生产换数据库）
│       ├── scheduler.js    # 定时推送 + 产品缓存
│       ├── pipeline.js     # 完整流水线：抓取→预筛→补全销售机构→渠道筛选
│       ├── server.js       # API 服务（有后端模式用）
│       ├── scripts/push.js # 免服务器推送脚本（GitHub Actions 调用）
│       └── _selftest.js    # 离线筛选逻辑自测
├── docs/products.json      # 每日生成的产品列表（GitHub Pages 托管，小程序读取）
├── Dockerfile / docker-compose.yml   # Docker 一键部署
├── render.yaml             # Render 一键部署配置
├── .github/workflows/      # GitHub Actions 每天 09:00 定时抓取+筛选+推送
├── start.sh / start.bat    # 本地一键启动（自动生成 .env）
└── miniprogram/            # 微信小程序前端（用微信开发者工具打开本目录）
    ├── app.js / app.json / app.wxss
    ├── project.config.json # appid 改为你自己的
    ├── utils/request.js    # API 地址（本地 http://localhost:3000）
    └── pages/
        ├── index/          # 产品列表 + 银行/风险筛选 + 订阅按钮
        └── detail/         # 产品详情
```

---

## 三、本地运行（后端）

```bash
cd server
npm install
cp .env.example .env        # 按需填写，本地演示可直接用占位值
npm start
```

启动后访问：
- `GET  http://localhost:3000/api/health`      服务健康检查
- `GET  http://localhost:3000/api/products`    当前合格产品列表（已按需求筛选）
- `POST http://localhost:3000/api/login`       小程序登录（body: `{code}` 或开发用 `{openid}`）
- `POST http://localhost:3000/api/subscribe`   订阅登记（body: `{openid}`）
- `GET  http://localhost:3000/api/trigger-push?secret=xxx`  手动触发一次推送（验证用）
- `GET  http://localhost:3000/api/preview-push`            预览“今天会推送的内容”（不真正发送，新手无需配置微信即可验证筛选结果）

筛选逻辑离线自测：
```bash
node src/_selftest.js        # 预期输出“合格数量(预期7): 7”并通过，并验证详情补全逻辑
```

> 新手友好：启动时若检测到没有 `.env`，会自动从 `.env.example` 复制一份，不会因缺配置直接崩溃。
> Windows 用户也可直接双击 `start.bat`。

> 说明：本环境直连中国理财网返回 500（站点有反爬/限流），`DATA_SOURCE=auto` 会自动回退到
> `mock.js` 样例数据，因此无需联网即可完整跑通。把 `.env` 里 `DATA_SOURCE` 改为 `chinawealth`
> 即走真实抓取；若生产环境仍被拦截，建议改用无头浏览器（Playwright）或申请官方数据合作。

### “按购买渠道”是怎么严格落地的（已用详情接口补全）
中国理财网搜索列表主返回「发行机构(`orgName`)」，但你要的是「在招行/中行/工行 APP 能买到」（销售机构）。
为此流水线在搜索之后、渠道筛选之前插入一步补全：
1. 先用 `filterBasic` 按 **R1/R2 + 半年内可赎回 + 未来3天新发** 预筛出候选（把要打详情接口的量压到最小）；
2. 对候选逐个调用产品详情接口 `POST /prodInfo/getProductDetail`（参数 `prodRegCode`），
   从返回里尽力提取「销售机构」（`extractSellers` 会扫描 `saleOrgList / saleOrgName / 代销` 等多种字段形态）；
3. 用补全后的销售机构重算 `bankCode`，再走 `filterEligible` 做最终渠道筛选。
代码位置：`server/src/chinawealth.js` 的 `fetchProductDetail` / `enrichProducts`，编排在 `server/src/pipeline.js`。
详情接口失败（反爬/网络）时自动回退到「发行机构兜底匹配三家理财子公司」，不影响服务。

---

## 四、小程序前端（微信开发者工具）

1. 打开微信开发者工具 → 导入项目 → 选择 `miniprogram/` 目录。
2. 把 `project.config.json` 里的 `appid` 改成你自己的小程序 AppID（或先用测试号）。
3. 勾选 **详情 → 本地设置 → 不校验合法域名**（本地联调用 `http://localhost:3000`）。
4. 如需真机/上线（免服务器方案，默认）：
   把 `miniprogram/app.js` 的 `PAGES_BASE` 改成你的 GitHub Pages 地址
   （`https://<用户名>.github.io/wechat-wealth-push`），**保持 `USE_STATIC: true`**，
   然后「上传」新版本。**无需在小程序后台配「服务器域名」**（读的是 GitHub Pages 静态文件）。
5. 编译预览：列表页可下拉刷新、按银行/风险筛选、点「开启每日推送」（即授权订阅消息）、点卡片看详情。

---

## 四（之二）、零基础部署：推荐「免服务器方案」（无需信用卡、无需常驻服务器）

> 你之前卡在 Render 要绑卡。这里给出**完全不需要信用卡、不需要任何云服务器**的方案：
> 用 **GitHub Actions**（免费）每天 09:00 跑脚本抓数据+发推送，用 **GitHub Pages**（免费）
> 托管产品列表给小程序读。你只需要一个 **GitHub 账号**（邮箱注册即可）。

### 整体原理
```
GitHub Actions（每天 09:00 北京时间）
   ├─ 抓中国理财网 → 筛 R1/R2 + 半年内可赎回 + 未来3天新发 + 招行/中行/工行可买
   ├─ 写 docs/products.json  ──►  GitHub Pages（https://你.github.io/仓库/products.json）
   └─ 给 SUBSCRIBERS 里的 openid 发微信订阅消息
小程序 ──读──► GitHub Pages 的 products.json（列表/详情）
```
小程序**不连任何后端**，所以你也不用配「服务器域名」。

### 步骤 1：把代码推到 GitHub（你已完成的部分）
把本仓库推到 GitHub（公开/私有均可）。仓库名建议用 `wechat-wealth-push`。

### 步骤 2：开启 GitHub Pages（托管产品列表，1 次）
1. 进你的 GitHub 仓库 → **Settings → Pages**。
2. **Build and deployment → Source** 选 **Deploy from a branch**。
3. **Branch** 选 `main`，目录选 **/docs** → 点 **Save**。
4. 等一两分钟，访问 `https://<你的GitHub用户名>.github.io/wechat-wealth-push/products.json`
   能看到 JSON 即成功（首次是占位文件，跑过一次 Actions 后变真实数据）。

### 步骤 3：配置 5 个仓库密钥（Settings → Secrets → Actions → New repository secret）
每行一个，**名字照抄、值填你自己的**：

| Secret 名（区分大小写） | 值 |
| --- | --- |
| `WX_APPID` | 小程序 AppID（微信公众平台「开发设置」） |
| `WX_APPSECRET` | 小程序 AppSecret（同页点「重置/查看」） |
| `WX_SUBSCRIBE_TEMPLATE_ID` | 你申请的订阅消息模板 ID |
| `SUBSCRIBERS` | 接收人 openid，**多个用半角逗号分隔**（怎么拿见下方「获取 openid」） |
| `DATA_SOURCE` | 填 `chinawealth`（只抓真实数据；若想演示先填 `auto`） |

> 填完这 5 个就够推送了，无需绑卡、无需服务器。

### 步骤 4：手动跑一次验证
进仓库 **Actions → 每日理财推送 → Run workflow**。几分钟后：
- `docs/products.json` 被更新（Settings → Pages 的地址能看到新数据）；
- 你的微信收到一条订阅消息（前提是已点过小程序的「开启每日推送」授权过）。
之后每天 **北京时间 09:00** 自动跑，无需再管。

### 步骤 5：小程序改 1 行域名
把 `miniprogram/app.js` 里的 `PAGES_BASE` 改成你的 GitHub Pages 地址
（格式 `https://<用户名>.github.io/wechat-wealth-push`），**保持 `USE_STATIC: true`**，
然后在微信开发者工具里**上传**新版本。无需配「服务器域名」（因为读的是 GitHub Pages 的静态文件）。

### 怎么拿到你的 openid（填进 SUBSCRIBERS）
订阅消息要发给谁，得知道你的微信 openid。最简单两种办法：
- **方法 1（最省事）**：微信开发者工具里打开小程序 → 点「真机调试」或「预览」，
  顶部/设备面板会直接显示你的 **OpenID**，复制它填进 `SUBSCRIBERS`。
- **方法 2**：在小程序里临时加一行 `console.log(res)` 打印 `wx.login` 的 code，
  再用微信「接口调试工具」拿 code 换 openid（稍麻烦，新手优先方法 1）。

> 单人订阅（只推给你自己）时，上面 5 个密钥 + 1 行域名就齐了。
> 要推给多人：让每个人用方法 1 拿到自己的 openid，逗号拼进 `SUBSCRIBERS` 即可（最多一次可填多个）。

---

## 四（之三）、备选：有后端部署（Render / Docker，适合要多人在线看列表）

如果你希望小程序连一个真正的后端（多人订阅、在线管理），可走下面任一条。
注意 Render 免费版**需要绑一张卡做验证**（储蓄卡/信用卡均可，免费实例不扣费）；
不想绑卡就继续用上面的「免服务器方案」。

### 路线 A：Render 一键部署
1. 把本项目推到 GitHub → 打开 https://render.com → 用 GitHub 登录 → **New → Blueprint** → 选中本仓库。
   Render 读取 `render.yaml` 自动建好 Web 服务（免费，自带 `https://xxx.onrender.com`）。
2. 在 Render 控制台 **Environment** 填 4 个变量：`WX_APPID` / `WX_APPSECRET` /
   `WX_SUBSCRIBE_TEMPLATE_ID` / `PUSH_SECRET`（随便写个字符串）。
3. 记好 `https://xxx.onrender.com` —— 把小程序 `app.js` 的 `USE_STATIC` 改为 `false`、`apiBase` 改成它，
   并在小程序后台「服务器域名 → request 合法域名」加入该域名。

### 路线 B：Docker 本地/服务器
```bash
cp .env.example .env        # 填好 AppID/AppSecret/模板ID
docker compose up -d        # 后台启动，访问 http://<机器IP>:3000/api/health
```
反向代理到 HTTPS（Nginx/Caddy/云厂商）后即可作为小程序 `apiBase`。

> 有后端模式下，定时推送由进程内 `node-cron`（每天 09:00）执行；免费实例会休眠，
> 可保留 `.github/workflows/daily-push.yml` 的旧版「唤醒」逻辑，或改用 `pm2` 常驻。

---

## 五、上线需要配置的 4 件事（免服务器方案）

1. **AppID / AppSecret**：微信公众平台 → 开发设置，填进 GitHub 仓库 Secret `WX_APPID` / `WX_APPSECRET`。
2. **订阅消息模板**：微信公众平台 → 订阅消息 → 我的模板 → 申请，建议 4 个关键字
   **产品数量 / 适用银行 / 起售日期 / 温馨提示**。模板 ID 填进 Secret `WX_SUBSCRIBE_TEMPLATE_ID`，
   并让 `miniprogram/pages/index/index.js` 的 `SUBSCRIBE_TMPL_ID` 与之**完全一致**
   （字段顺序对应 `server/src/wechat.js` 的 `buildSubscribeData`）。
3. **接收人 openid**：用「四（之二）获取 openid」的办法拿到，填进 Secret `SUBSCRIBERS`
   （多人逗号分隔）。小程序端点「开启每日推送」只是**授权**，真正发给谁由这个密钥决定。
4. **GitHub Pages 域名**：开启 Pages（/docs）后，把 `app.js` 的 `PAGES_BASE` 改成
   `https://<用户名>.github.io/wechat-wealth-push`，上传小程序新版本即可。无需配服务器域名。

---

## 六、数据字段说明（归一化后的 Product）

| 字段 | 含义 |
| --- | --- |
| productCode | 产品登记编码 |
| name / bank / bankCode | 名称 / **购买渠道**(销售机构)全称 / 渠道代码(CMB/BOC/ICBC) |
| issuer / seller | 发行机构全称 / 销售机构(购买渠道)原始名 |
| riskLevel / riskLevelRaw | 归一化风险等级(R1~R5) / 原始描述 |
| issueDate / raiseEndDate | 募集起始日 / 募集结束日 |
| term / termDays | 产品期限文本 / 期限天数 |
| operateMode | 运作模式（现金管理/开放式/封闭式…） |
| redeemType / minRedeemDays | 可赎回类型 / 最早可赎回天数 |
| expectedRate / minAmount / currency | 业绩比较基准 / 起购金额 / 币种 |

---

## 七、重要提示

- 本服务仅做**信息聚合与提醒**，所有数据以中国理财网及产品说明书为准，不构成投资建议。
- 微信订阅消息需用户主动授权，无法在用户未授权时强行推送；首次授权后，单次订阅通常仅对应当次，
  若要“每天推送”建议在小程序内引导用户多次/长期订阅（或申请长期订阅模板）。
- 生产环境 `store.js` 的 JSON 文件存储请替换为数据库；真实抓取若被反爬拦截，请参考上文调整。
