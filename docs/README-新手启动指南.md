# 月光石屿本地启动指南

项目包含三个应用：NestJS API、Vue 3 管理后台和 uni-app 微信小程序。小程序提供美甲、饰品、鲜花产品展示与预约，不包含线上下单或付款。

## 环境准备

- Node.js 20 或更高版本
- pnpm 10
- Docker Desktop
- 微信开发者工具

## 首次启动

1. 安装依赖并创建本地配置：

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/member-miniapp/.env.example apps/member-miniapp/.env
```

2. 启动 PostgreSQL，执行迁移；需要演示产品时再执行种子：

```bash
pnpm db:up
pnpm db:migrate
SEED_DEMO_CATALOG=true pnpm seed
```

3. 分别启动三个应用：

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:miniapp
```

默认地址：

- API：`http://127.0.0.1:3000`
- 后台：`http://127.0.0.1:5173`
- 小程序开发产物：`apps/member-miniapp/dist/dev/mp-weixin`

微信开发者工具调试时直接导入开发产物目录。仅本地开发可关闭合法域名校验；体验版和正式版必须开启。

## 登录模式

本地配置使用 `MINIAPP_LOGIN_MODE=mock`。正式环境必须改为 `real`，并在服务器安全环境变量中配置当前小程序的 AppID 与 AppSecret。用户首次微信登录后填写手机号，后续登录按 OpenID 找回同一会员，不应再次要求手机号。

## 测试

```bash
pnpm --filter @member-platform/api build
pnpm --filter @member-platform/api test
```

E2E 测试会重置数据库，因此必须显式使用独立测试库，数据库名必须包含 `test` 或 `e2e`：

```bash
E2E_DATABASE_URL='postgresql://postgres:password@localhost:5432/member_platform_e2e?schema=public' \
  pnpm --filter @member-platform/api test:e2e
```

测试命令会拒绝名称不像测试库的数据库，禁止将其指向生产库。

## 正式构建

普通 `build` 只用于本地开发。上传微信审核前必须执行：

```bash
pnpm --filter @member-platform/api build
pnpm --filter @member-platform/admin-web build:release
pnpm --filter @member-platform/member-miniapp build:release
```

微信开发者工具应导入：

```text
apps/member-miniapp/dist/build/mp-weixin
```

完整生产部署、真机验收和送审步骤见 [正式上线送审检查清单](正式上线送审检查清单.md)。
