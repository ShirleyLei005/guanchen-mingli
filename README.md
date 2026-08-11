# 观辰 · 八字与紫微斗数

面向中文用户的现代命理商业网站 MVP。首版覆盖八字、紫微斗数、八字合婚、固定命盘追问、积分包和支付沙箱。

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
- 邮箱账号注册/登录：未登录积分为 0；新用户注册即赠 5 积分，可解锁八字或紫微斗数完整报告
- 沙箱支付：下单 → 模拟收银台 → 回调入账，订单、支付事件与不可变积分流水均幂等
- 八字、紫微、合婚、连续追问四类产品入口
- D1/Drizzle 商业数据模型与首版迁移
- 用户、出生档案、命盘版本、报告、对话、不可变积分流水、订单和支付事件模型
- 幂等键、任务失败退款、敏感问题分流等领域约束
- 算法版本和命盘结果哈希接口
- 内容免责声明与隐私提示

## 账号与支付

- 账号保存在 D1（`users`、`sessions`），密码使用 PBKDF2 加盐哈希，会话使用 HttpOnly Cookie。
- 未登录用户积分为 0；登录后新用户通过 `signup_gift` 账本条目获得 5 积分，重复注册不会重复发放。
- 支付当前为沙箱模式（`PAYMENT_PROVIDER=sandbox`）：`POST /api/payments/orders` 创建订单，`POST /api/payments/sandbox/confirm` 模拟用户确认，`POST /api/payments/webhook/sandbox` 模拟服务商回调。
- 正式启用微信/支付宝时，设置 `PAYMENT_PROVIDER=wechat|alipay` 并配置对应商户密钥环境变量；回调验签在 `lib/payments.ts` 适配器中扩展，业务逻辑不依赖具体渠道。
- 测试积分：登录后调用 `POST /api/sandbox/tester-credits`，`code` 见该路由常量。

## 计算边界

浏览器当前只生成明确标记为 `previewOnly` 的演示盘，不用于收费报告。生产排盘必须由服务端适配器完成：

- 八字：`lunar-python`，按节气换月，支持真太阳时配置。
- 紫微：固定 `iztro@2.5.8`，记录算法版本。
- AI：只接收服务端结构化盘面事实，不自行推算干支、星曜或宫位。

在服务端排盘适配器、真实鉴权和支付商户接入完成前，界面始终显示“支付沙箱”，不会产生真实交易。

## 数据与安全

- `.openai/hosting.json` 声明 D1 逻辑绑定 `DB`。
- `db/schema.ts` 是数据模型源文件，`drizzle/0001_commercial_core.sql` 与 `drizzle/0002_auth_payments.sql` 是迁移文件。
- OpenAI 密钥只能放在服务端环境变量 `OPENAI_API_KEY` 中，不得写入源码或客户端包。
- 出生资料、关系资料和对话正文不得写入访问日志。
- 生产上线前必须接入正式身份系统、支付验签、字段加密、限流和大陆地区合规审查。
