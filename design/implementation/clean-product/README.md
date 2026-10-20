# 商品页面精简验收 · 2026-10-19

用户要求商品页面美观、干净，删除影响观感的小字说明。本轮保留原色调，将主次关系集中到实拍、商品名、价格和预约动作。

## 交付

- 列表删除描述、验收措辞和反复确认事项；名称与价格同排，下方集中详情、收藏、预约。
- 详情删除品牌眉题、分类标签、介绍标题和预约前说明区，仅保留可选商品介绍，字号16px。
- 单图移除整行“1/1 · 查看大图”，使用放大图标，保留48px触摸范围与点击图片预览。
- 联系区不重复“门店信息”和无信息时的长说明，只展示实际配置及联系动作。
- 未设置价格显示“到店定价”。未填写虚构金额。
- 正式商品“星点法式”的描述已通过后台改为“裸粉珠光，点缀星星与浅蓝法式。”，公开接口回读见 [product-readback.json](product-readback.json)。使用已上传的原照压缩副本。

## 修改文件

路径均相对于仓库根目录：

- `apps/member-miniapp/src/pages/nail/nail.vue`
- `apps/member-miniapp/src/components/ProductDetailContent.vue`
- `apps/member-miniapp/src/components/ProductGallery.vue`
- `apps/member-miniapp/src/components/FavoriteButton.vue`
- `apps/member-miniapp/src/components/StoreContact.vue`
- `apps/member-miniapp/src/utils/catalog-display.ts`
- `apps/member-miniapp/src/utils/member-experience.test.cjs`
- `design/DESIGN.md`、`design/tokens.json`

商品读取、分类、原路径、收藏存储、登录、预约及支付协议未改。共享组件新增样式均按 appearance 选择，饰品/鲜花默认呈现保留。

## 两轮视觉检查

使用微信开发者工具 Stable 2.02.2608080、基础库3.15.2，通过原生界面操作。独立构建目录 `/tmp/moonisle-clean-product-qa/project` 接入正式公开商品接口，关闭演示数据回退；并非验收假商品。

| 轮次 | 视口 | 检查结果 | 截图 |
| --- | --- | --- | --- |
| 第一轮 | 390px | 列表不再堆积说明；详情保留一句介绍；原照完整；放大图标打开原生预览并返回详情 | [列表](screenshots/round1-list.png)、[详情](screenshots/round1-detail.png)、[大图](screenshots/round1-preview.png) |
| 第二轮 | 320px / iPhone 5 | 三项动作可同行显示；标题与价格不重叠；详情照片缩小以保留内容区；固定操作无截断；返回列表保留滚动位置 | [列表](screenshots/round2-list.png)、[详情](screenshots/round2-detail.png) |

完整开发者工具窗口截图以 `-full.png` 保存。展示图只裁出模拟器画面，没有修饰或重绘。

## 验证

- `pnpm --filter @member-platform/member-miniapp test`：83/83通过，见 [tests.txt](tests.txt)。覆盖现有业务行为与简洁价格格式。
- `pnpm --filter @member-platform/member-miniapp build`：成功，见 [build.txt](build.txt)。另完成接入正式公开接口的独立视觉构建。
- `git diff --check`：通过。
- 原生操作：列表进入详情、打开大图、返回详情、返回列表成功；收藏和预约按钮仍弹出原有登录提示；点“稍后”后恢复可操作的详情。预约登录截图见 [booking-login.png](screenshots/booking-login.png)。未提交真实预约或留言。

## 状态与后续

正式商品描述已更新；客户端改版已于2026-10-19按用户授权通过官方开发者工具上传为1.3.11（上传包1,479,216 bytes），正式配置和产物检查通过。微信公众平台被浏览器站点安全策略阻止访问，尚未提交审核、未正式发布，体验版选择状态未验证。上传回执位于仓库上级 `artifacts/wechat-upload-1.3.11-receipt.json`。真机字体、安全区和登录后的预约提交仍沿用后续设备验收；本轮没有进行真实支付。下一步将同样的简洁信息层级推广到饰品和鲜花，并使用实际商品价格替换“到店定价”。


### 后续域名切换

用户将主域名改为 `www.moonisle.shop` 后，服务器切换与验证通过，新域名包1.3.12已上传；后续以1.3.12为准。完整状态见 `docs/域名迁移-20261019.md`，正式审核/发布未执行。
