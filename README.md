# 会员后台系统

这是一个会员管理演示项目，包含：

- `apps/api`：NestJS API，负责登录、会员、充值、消费订单、审计日志和图片上传。
- `apps/admin-web`：Vue3 后台管理端。
- `apps/member-miniapp`：uni-app 微信小程序端。
- `packages/shared`：前后端共享类型。

## 本地启动

1. 安装依赖

```bash
pnpm install
```

2. 启动 PostgreSQL 数据库

```bash
pnpm db:up
```

3. 初始化数据库结构和演示数据

```bash
pnpm db:migrate
pnpm seed
```

4. 启动服务

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:miniapp
```

API 默认读取 `apps/api/.env`，示例配置在 `apps/api/.env.example`。

## 小程序上线配置

本地开发默认使用 `MINIAPP_LOGIN_MODE=mock`，方便微信开发者工具调试。准备上线时需要在 `apps/api/.env` 中改为：

```bash
MINIAPP_LOGIN_MODE=real
WECHAT_MINIAPP_APP_ID=你的小程序AppID
WECHAT_MINIAPP_APP_SECRET=你的小程序AppSecret
```

手机号绑定使用微信小程序 `getPhoneNumber` 授权，正式版需要在微信公众平台配置好小程序主体和相关权限。
