# 新手启动指南（30分钟可跑通）

## 1. 你将得到什么

你将同时跑起来 3 个端：

1. 后端 API（NestJS）
2. 后台管理 Web（Vue3）
3. 会员小程序端（uni-app）

并完成一条演示链路：

1. 会员端登录并提交充值申请
2. 后台审核通过
3. 会员余额变化

## 2. 前置准备

确保已安装：

1. Node.js LTS
2. pnpm
3. 微信开发者工具

## 3. 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 4. 启动后端 API

```bash
pnpm dev:api
```

默认地址：`http://localhost:3000`

可测试接口：`GET http://localhost:3000/admin/members`

## 5. 启动后台 Web

新开一个终端：

```bash
pnpm dev:admin
```

打开浏览器访问终端提示地址（默认是 `http://localhost:5173`）。

## 6. 启动小程序端

新开一个终端：

```bash
pnpm dev:miniapp
```

然后：

1. 打开微信开发者工具
2. 选择项目目录 `E:\dev-project\Test\apps\member-miniapp`
3. 首次导入后直接点“编译”，工具会按 `project.config.json` 的 `miniprogramRoot=dist/build/mp-weixin/` 读取产物
4. 进入首页后点“演示登录”

## 7. 演示账号与关键ID

1. 演示管理员ID：`admin-001`
2. 默认种子会员ID：`u-demo-001`

## 8. 推荐演示流程

1. 在小程序端提交一笔充值申请（例如 100）
2. 到后台“充值审核”页面点击“通过”
3. 回小程序“个人信息”刷新，查看余额上涨

## 9. 常见报错

### 9.1 前端提示无法连接 API

检查 `apps/admin-web/.env.example` 与 `apps/member-miniapp/.env.example` 中 API 地址（推荐 `http://127.0.0.1:3000`）。

### 9.2 小程序无法请求本地 API

微信开发者工具里关闭“校验合法域名”用于本地开发，或把 API 部署到可访问地址。

### 9.3 端口冲突

修改：

1. API 端口：`apps/api/.env.example` 中 `API_PORT`
2. Web 端口：`apps/admin-web/vite.config.ts`
3. 小程序 dev 端口：`apps/member-miniapp/vite.config.ts`

## 10. 生产化下一步（你后面再做）

1. 把内存数据仓库替换为 PostgreSQL + ORM（Prisma 或 TypeORM）
2. 接入真实微信登录 code2session
3. 增加权限与风控
4. 接入微信支付
