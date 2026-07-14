# 月光石屿会员与预约系统

项目包含：

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

3. 初始化数据库结构；本地需要演示目录时再执行开发种子

```bash
pnpm db:migrate
SEED_DEMO_CATALOG=true pnpm seed
```

4. 启动服务

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:miniapp
```

API 默认读取 `apps/api/.env`，示例配置在 `apps/api/.env.example`。

## 登录说明

本地开发默认使用 `MINIAPP_LOGIN_MODE=mock`，方便微信开发者工具调试。正式环境必须使用微信 `wx.login` 返回的 code 换取 OpenID；用户首次登录后主动填写手机号，不调用微信手机号授权接口。

正式 API 至少需要：

```bash
MINIAPP_LOGIN_MODE=real
WECHAT_MINIAPP_APP_ID=你的小程序AppID
WECHAT_MINIAPP_APP_SECRET=你的小程序AppSecret
```

## 正式发布

普通 `build` 使用本地调试配置，不能作为正式送审包。完整生产部署、微信公众平台配置、真机验收和送审步骤见 [正式上线送审检查清单](docs/正式上线送审检查清单.md)。
