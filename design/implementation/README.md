# 美甲详情接入与验收

2026-10-15。用户已确认原型，并授权接入小程序。当前成果为本地源码和编译产物，尚未上传体验版或发布。

## 已实现

- 新增 `/pages/nail-detail/nail-detail?id=商品ID`，按现有美甲商品目录读取数据，支持直接进入、重试、缺图、缺价和下架状态。
- 列表增加「查看详情」，保留图片点击看大图和快捷预约；返回保留分类与滚动位置，同时后台刷新。刷新失败保留旧内容并提示，不把失败误报为空目录。
- 详情采用原有奶油白、灰蓝与深灰配色，大图不裁切关键内容；标题、参考价、款式说明、预约说明和门店联系依次展开。长文自然换行。
- 底部收藏与预约使用至少 48px 点击区及安全区。复用原收藏持久化、账号隔离、登录/手机号/协议流程和预约意图，点击预约只进入原申请界面。
- 原生 swiper、原生图片预览、按压反馈、收藏色彩反馈、140ms 内容淡入、220ms 预约面板进入。关闭立即生效，不靠动画回调执行业务；不自动轮播、不循环扫光。
- 预约面板改为底部进入，提示块统一为灰蓝色；日期、时段、冲突检查、备注和提交函数未改动。

未改动接口协议、会员余额刷新、会员记录缓存、支付、登录实现、预约提交及原有13个页面路径。仅增加1个详情路由。

## 修改文件

以下路径以仓库根目录为基准。

| 文件 | 作用 |
| --- | --- |
| `apps/member-miniapp/src/pages/nail-detail/nail-detail.vue` | 新详情页；数据与页面生命周期、状态、原预约入口 |
| `apps/member-miniapp/src/components/ProductDetailContent.vue` | 可复用详情内容 |
| `apps/member-miniapp/src/components/ProductActionBar.vue` | 固定底部操作栏 |
| `apps/member-miniapp/src/styles/product-detail.css` | 局部作用域 Design Tokens |
| `apps/member-miniapp/src/components/ProductGallery.vue` | 可选详情外观、完整看图、失败重试、48px 控件、短屏限高 |
| `apps/member-miniapp/src/components/FavoriteButton.vue` | 可选详情外观、按压与收藏状态过渡 |
| `apps/member-miniapp/src/components/StoreContact.vue` | 可选详情外观，联系动作沿用原逻辑 |
| `apps/member-miniapp/src/pages/nail/nail.vue` | 详情入口、重复导航保护、返回静默刷新 |
| `apps/member-miniapp/src/pages/appointment/appointment.vue` | 面板外观与进入动效 |
| `apps/member-miniapp/src/pages.json` | 注册新增路由 |
| `apps/member-miniapp/src/utils/member-experience.test.cjs` | 新增7项详情/返回/预约行为测试，补充生命周期模拟 |
| `design/DESIGN.md`、`design/INTERACTION.md` | 更新接入状态与实施边界 |
| `design/implementation/` | 两轮截图、验收脚本与结果 |

## 两轮视觉检查

使用实际 uni-app 编译产物，在微信开发者工具 2.02.2608080、基础库 3.15.2 中运行。不是用原型网页代替小程序截图。

验收数据来自独立 localhost 只读服务。图片为已批准原型的构图样片，**非实际商品照片**；这些样片与测试商品未写入应用源码或线上商品库。

| 轮次 | 检查与发现 | 修正与复核 |
| --- | --- | --- |
| 第一轮，390px | 详情、正文、固定栏、看图、预约面板、异常状态；发现顶部外边距造成露白、缺图占位过高、原预约面板橙色块不统一 | 页面自身承担顶部间距；缺图占位缩至208px；预约面板统一品牌色和底部布局，关闭区增至48px |
| 第二轮，390px + 320px | 复核上轮问题、长标题/长文、首屏、底部、预约滚动、安全区、网络失败/重试、下架、缺图缺价和坏图 | 320px 短屏增加图库40vh限高，让名称更早出现；复核原生预览返回图序；修正微信组件WXSS不支持的属性选择器告警 |

截图入口：

- [第二轮详情首屏](screenshots/round2-detail.png) / [详情正文](screenshots/round2-detail-bottom.png)
- [第二轮预约面板](screenshots/round2-booking.png)
- [320px 长标题](screenshots/round2-small-320.png) / [320px 页面底部](screenshots/round2-small-bottom.png)
- [320px 面板滚动到底部](screenshots/round2-small-booking-scroll.png)
- [缺图缺价](screenshots/round2-missing-data.png) / [加载失败](screenshots/round2-network-error.png) / [下架](screenshots/round2-removed.png)
- [真实微信原生大图预览](screenshots/round2-native-preview.png) / [预览返回仍为第2张](screenshots/round2-preview-return.png)
- 第一轮对照文件均以 `screenshots/round1-` 开头。

## 验证结果

- `pnpm --filter @member-platform/member-miniapp test`：**82/82 通过**，包括原有75项及新增7项。新增验证直达详情、加载失败与下架区分、重试、迟到响应、卸载、看图返回、重复预约点击、取消登录、登录引导保留款式、返回列表刷新及直接进入后的返回入口。
- `pnpm --filter @member-platform/member-miniapp build`：成功；`git diff --check`：通过。项目 lint 脚本仅为跳过提示，未把它计为有效检查。
- 第二轮模拟器自动化 **23项通过**：见 `round2-full-native-results.json`。含原生 swiper、预览参数、收藏/取消收藏、登录取消、携带款式进入原预约、关闭面板、列表分类/480px滚动位置恢复、网络重试及异常状态。
- 小屏补充：320px 页面无横向溢出，按钮48px下限；原预约面板可滚动至备注与提交按钮。见 `small-native-results.json` 和截图。
- 手动/SDK补充：选择时间后摘要同步、输入备注、关闭不提交；实际打开 `wx.previewImage` 的第2张图片，点击返回后仍保持2/3。见 `native-extra-results.json`。
- 测试服务只接受 GET，写请求一律405；验收请求记录没有写请求。未提交真实预约、未发送门店留言、未进行支付。
- 自动化初期过早执行返回导致导航取消/协议超时；脚本改为等待目标页与内容就绪，再返回并读回状态。通过记录以最终 JSON 为准。

## 验收环境与复现

正式源码编译目录仍为 `apps/member-miniapp/dist/build/mp-weixin`。隔离验收项目在 `/tmp/moonisle-miniapp-qa/project`，仅该临时项目关闭域名检查，并使用 localhost API。没有修改项目的生产环境文件或发布配置。

从仓库根目录执行普通构建和单元测试即可复查源码。模拟器自动化的额外准备：在 `/tmp/moonisle-miniapp-qa` 安装 `miniprogram-automator`；将 `design/prototype/assets/swatch-{1,2,3}.svg` 用 `sips -s format png` 转为该目录下同名PNG；用以下环境编译临时工程：

```sh
UNI_OUTPUT_DIR=/tmp/moonisle-miniapp-qa/project \
VITE_API_BASE_URL=http://127.0.0.1:8770/api \
VITE_DEVTOOLS_API_BASE_URL=http://127.0.0.1:8770/api \
VITE_ENABLE_CATALOG_FALLBACK=false \
pnpm --filter @member-platform/member-miniapp build
```

临时工程的 `project.config.json` 设置 `setting.urlCheck=false`、`libVersion=3.15.2`，开启开发者工具自动化端口9430。启动 `node design/implementation/native-fixture.cjs` 后，在390px模拟器运行：

```sh
QA_ROUND=round2 NODE_PATH=/tmp/moonisle-miniapp-qa/node_modules \
node design/implementation/native-verify.cjs
```

切换至 iPhone 5（320px）后运行 `native-small.cjs`。首次运行需先完成完整脚本，它会在隔离测试工程内准备测试会话。`native-small.cjs` 的合成触摸不保证原生滚动；面板到底部的截图由电脑操作工具实际滚动补充验证。

## 未完成与下一步

1. 真实上架照片的构图/清晰度仍需验收；样片只能验证布局。生产页只使用接口商品，不内置演示商品。
2. 真机 iOS/Android、低性能设备、系统大字体和系统「减少动态」仍待验证。CSS 已提供 `prefers-reduced-motion` 降级，但不能保证每个微信环境能读取该系统偏好。
3. 全局深色模式保持原计划：设计映射已定义，尚未开启全局 `darkmode`；需要为其余页面和原生导航一起适配再验收。
4. 面板退出采用立即关闭，未实现180ms离场动画。没有滚动视差、共享元素转场或震动反馈。
5. 上线前建议先使用真实商品和真机走一次完整的登录/手机号/预约确认流程；本次只在模拟数据和单元测试中验证提交边界，没有进行生产提交或发布。
