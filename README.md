# 观辰 · 八字与紫微斗数

面向中文用户的现代命理商业网站 MVP。首版覆盖八字、紫微斗数、八字合婚、固定命盘追问、积分包和支付沙箱。

**在线访问：[https://guanchen.site](https://guanchen.site)**

## 本地启动

需要 Node.js 22+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

生产构建与验收：

```bash
pnpm build
pnpm test
```

## 已实现

- 移动端优先的完整商业落地页和交互式测算流程
- 免费命盘预览、专题选择、积分扣减与沙箱充值
- 邮箱账号注册/登录：未登录积分为 0；注册后邮箱验证通过，新用户获赠 5 积分，可解锁八字或紫微斗数完整报告
- 沙箱支付：下单 → 模拟收银台 → 回调入账，订单、支付事件与不可变积分流水均幂等
- 八字、紫微、合婚、连续追问四类产品入口
- D1/Drizzle 商业数据模型与首版迁移
- 用户、出生档案、命盘版本、报告、对话、不可变积分流水、订单和支付事件模型
- 幂等键、任务失败退款、敏感问题分流等领域约束
- 算法版本和命盘结果哈希接口
- 内容免责声明与隐私提示

## 账号与支付

- 账号保存在 D1（`users`、`sessions`），密码使用 PBKDF2 加盐哈希，会话使用 HttpOnly Cookie。
- 未登录用户积分为 0；新账号在邮箱验证通过后才通过 `signup_gift` 账本条目获得 5 积分，重复验证不会重复发放。
- 防刷：注册页含隐藏蜜罐字段；同一 IP 24 小时内最多创建 10 个账号；6 位验证码 30 分钟有效，最多尝试 5 次，重发间隔 60 秒。
- 邮件服务：配置 `RESEND_API_KEY` 与 `EMAIL_FROM` 后自动发送验证码邮件；本地验收可设 `ALLOW_DEBUG_VERIFICATION_CODE=true`，接口会返回 `debugCode` 供测试，生产环境请勿开启。
- 支付临时默认人工充值模式（`PAYMENT_PROVIDER=manual`），配合微信经营收款码；正式接入商户号后通过 `PAYMENT_PROVIDER=wechat|alipay|sandbox` 切换。
- 正式支付支持微信 Native 扫码与支付宝电脑网站支付，服务端验签、幂等入账与订单查询已内置，见下方“支付接入”章节。

## 支付接入（微信 / 支付宝）

设置 `PAYMENT_PROVIDER=wechat|alipay` 并配置对应商户密钥后，充值入口会自动切换为真实收银台；未配置时默认使用人工充值（`manual`），不会产生真实商户交易。

公共环境变量：

- `PAYMENT_PROVIDER`：`manual`（默认）/ `wechat` / `alipay` / `sandbox`
- `PAYMENT_NOTIFY_BASE_URL`：站点公网域名，例如 `https://guanchen.site`，用于拼接支付回调地址
- `PAYMENT_RETURN_BASE_URL`：支付宝支付完成后跳转地址，默认同 `PAYMENT_NOTIFY_BASE_URL`

### 微信支付（Native 扫码）

前置条件：已开通微信支付商户号，并在商户平台开通 Native 支付、完成域名配置。

环境变量：

- `WECHAT_PAY_MCHID`：商户号
- `WECHAT_PAY_APPID`：公众号/小程序 AppID
- `WECHAT_PAY_SERIAL_NO`：商户 API 证书序列号
- `WECHAT_PAY_PRIVATE_KEY`：商户 API 私钥 PEM（PKCS#1 或 PKCS#8 均可）
- `WECHAT_PAY_API_V3_KEY`：APIv3 密钥（32 位字符串）
- `WECHAT_PAY_PUBLIC_KEY`：微信支付公钥 PEM（在商户平台下载“微信支付公钥”）
- `WECHAT_PAY_PUBLIC_KEY_ID`：微信支付公钥 ID（即公钥证书序列号）

回调地址（需在商户平台配置为可用的支付回调域名）：

```text
https://guanchen.site/api/payments/webhook/wechat
```

### 支付宝（电脑网站支付）

前置条件：支付宝开放平台已创建应用并签约“电脑网站支付”，完成应用网关与回调域名配置。

环境变量：

- `ALIPAY_APP_ID`：开放平台应用 APPID
- `ALIPAY_PRIVATE_KEY`：应用私钥 PEM（PKCS#1 或 PKCS#8 均可）
- `ALIPAY_PUBLIC_KEY`：支付宝公钥 PEM
- `ALIPAY_GATEWAY`：网关地址，默认 `https://openapi.alipay.com/gateway.do`

回调地址（在支付宝应用后台配置）：

```text
https://guanchen.site/api/payments/webhook/alipay
```

### 入账与安全

- 微信回调使用 `WECHATPAY2-SHA256-RSA2048` 验签并解密 AES-256-GCM 资源；支付宝回调使用 RSA2 验签，同时核对 AppID、订单号与金额。
- 订单、支付事件与积分流水均以数据库唯一约束保证幂等，重复回调不会重复加积分。
- 前端轮询订单状态时，服务端会向支付平台查询真实交易状态，回调丢失也能自动补记。
- 商户私钥、APIv3 密钥等只能放在服务端环境变量中，不得写入源码或客户端包。

## 人工充值（临时方案，无需商户号）

在商户资质开通前，可先用 `PAYMENT_PROVIDER=manual`（当前为默认）走“微信收款商业版 + 自动/人工确认”流程：

- 用户选择积分包后看到管理员配置的微信收款码、应付金额与订单号；
- 用户用微信付款后点击“我已支付”，默认自动确认到账；每日自动确认额度用完后转人工确认；
- 管理员也可访问 `/admin/recharge`，输入密码后核对微信到账，点击“确认到账”手动入账；
- 微信经营收款码没有官方到账通知接口，自动确认属于“信任模式 + 每日限额防刷”，只适合小额、低频或熟人场景；正式收款请切换为微信/支付宝商户支付。

人工充值环境变量：

- `PAYMENT_PROVIDER=manual`
- `MANUAL_PAY_QR_IMAGE`：收款码图片地址，可放一张截图到 `public/manual-pay-qr.png`（默认即此路径），也可填任意图片 URL
- `MANUAL_PAY_QR_DATA_URL`：可选，收款码的 data URL，优先于 `MANUAL_PAY_QR_IMAGE`
- `ADMIN_RECHARGE_PASSWORD`：后台确认到账所需的管理员密码（务必设置为强密码并只放在服务端环境变量中）
- `MANUAL_AUTO_CONFIRM`：默认 `true`；设为 `false` 则关闭自动确认，全部转人工确认
- `MANUAL_AUTO_CONFIRM_DAILY_LIMIT_FEN`：每用户每日自动确认金额上限，默认 `5000`（即 ¥50，单位为分）

管理后台：

```text
https://guanchen.site/admin/recharge
```
- 测试积分：登录后调用 `POST /api/sandbox/tester-credits`，`code` 见该路由常量。

## 计算边界

浏览器当前只生成明确标记为 `previewOnly` 的演示盘，不用于收费报告。生产排盘必须由服务端适配器完成：

- 八字：`lunar-python`，按节气换月，支持真太阳时配置。
- 紫微：固定 `iztro@2.5.8`，记录算法版本。
- AI：只接收服务端结构化盘面事实，不自行推算干支、星曜或宫位。

在服务端排盘适配器、真实鉴权和支付商户接入完成前，界面始终显示“支付沙箱”，不会产生真实交易。

## 数据与安全

- `.openai/hosting.json` 声明 D1 逻辑绑定 `DB`。
- `db/schema.ts` 是数据模型源文件，`drizzle/0001_commercial_core.sql`、`drizzle/0002_auth_payments.sql` 与 `drizzle/0003_email_verification_anti_abuse.sql` 是迁移文件。
- OpenAI 密钥只能放在服务端环境变量 `OPENAI_API_KEY` 中，不得写入源码或客户端包。
- 出生资料、关系资料和对话正文不得写入访问日志。
- 生产上线前必须接入正式身份系统、支付验签、字段加密、限流和大陆地区合规审查。
