# 会员后台系统 v1（Monorepo）

这是一个面向新手可快速演示的会员系统骨架，包含：

- `apps/api`：NestJS API（登录、会员、充值申请、后台审核、审计日志）
- `apps/admin-web`：Vue3 后台管理
- `apps/member-miniapp`：uni-app 小程序端骨架
- `packages/shared`：前后端共享类型
- `docs`：新手文档和流程图

## 快速开始

1. 安装依赖

```bash
pnpm install
```

2. 启动 API

```bash
pnpm dev:api
```

3. 启动后台（另一个终端）

```bash
pnpm dev:admin
```

4. 启动 uni-app（另一个终端）

```bash
pnpm dev:miniapp
```

或者用一条命令并行启动（首次建议先单独启动调试）

```bash
pnpm demo:dev
```

详细步骤看 `docs/README-新手启动指南.md`。
