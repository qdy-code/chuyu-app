# 星点法式原照 · 本地展示接入

2026-10-19。根据上一轮复核，采用实拍原照的压缩副本，并修正美甲列表裁切。原款图案未做AI重绘；旧的V1/R2优化候选仍为保真未通过。

## 展示资源

[display.jpg](display.jpg) 为列表与详情共用的JPEG展示版：

- 1080×1374，保持原图尺寸和比例；没有裁切、扩图、换背景或重绘图案。
- 原文件440,072 bytes（约430 KiB）→186,645 bytes（约182 KiB），减少57.59%。
- 使用macOS `sips` 进行JPEG质量85重编码。属于有损压缩副本，不宣称像素或字节完全不变；原始文件未覆盖，SHA-256已核对。
- 已与原照逐张查看星星、珠光和银色小饰，未见新增图案；原照自身的反光和边缘截断保留。
- 来源、输出哈希、编码参数见 [manifest.json](manifest.json)。

当前接口只有一组 `images`，因此使用同一张通用展示图，不新增封面字段，也不把两张相同照片分别塞进商品图集。

## 小程序修改

- `apps/member-miniapp/src/pages/nail/nail.vue`：美甲列表指定 `appearance="nail-list"`。
- `apps/member-miniapp/src/components/ProductGallery.vue`：该外观使用完整显示，固定图片区占位承托原图；图片下方单独放置至少48px的看图/翻图操作，避免遮住甲面。图片失败时展示重试，不以会员卡背景冒充作品。
- `apps/member-miniapp/src/utils/member-experience.test.cjs`：增加美甲列表坏图重试、选择指定原图预览、换图清除失败状态的回归测试。

饰品/鲜花等未传入此外观的图库保持原有展示方式。详情页继续使用完整显示。登录、收藏持久化、预约和接口协议沿用原流程。

## 本地验收

在微信开发者工具2.02.2608080、基础库3.15.2中，以只读本地服务提供这张JPEG给实际编译产物。

- 第一轮：390px，检查完整甲面、控件在图片之外、看图触摸区、详情和返回列表位置。结果见 [round1-results.json](round1-results.json)。
- 第二轮：320px，重复检查布局、详情和列表返回；实际打开微信原生大图。结果见 [round2-results.json](round2-results.json)。
- 83/83 小程序行为测试通过，微信构建成功，`git diff --check` 通过。
- 测试服务仅接受GET，没有生产商品、预约或会员写入。

截图：

- [390px 列表：完整甲面](screenshots/round1-list.png) / [390px 详情](screenshots/round1-detail.png)
- [320px 列表](screenshots/round2-list.png) / [320px 详情](screenshots/round2-detail.png)
- [320px 微信原生预览](screenshots/round2-native-preview.png)

与修改前 [列表裁切证据](../../reviews/2026-10-19/screenshots/list-source.png) 对比，上方星星甲面不再被额外裁切。此处的“完整”指完整显示原照片；原照片自身已截断的左侧指缘没有重建。

## 运行与绑定状态

- 正常源码构建仍输出 `apps/member-miniapp/dist/build/mp-weixin`。
- 隔离验收工程为 `/tmp/moonisle-photo-review-qa/delivery-project`；仅该临时工程关闭域名检查，使用 `http://127.0.0.1:8772/api`。
- 可用 `node fixture.cjs` 启动只读服务，配合9432自动化端口运行 `verify.cjs`；临时SDK在 `/tmp/moonisle-photo-review-qa/node_modules`。
- 用户随后明确要求创建商品并上传。现已通过正式后台创建并上架“星点法式”，分类为美甲/款式设计，商品ID为 `nail-prod-14b1ee46-4082-42a5-84ad-23da6b495fc7`；参考价留空，客户端显示到店确认。小程序新版页面代码未在本次任务上传或发布。
- 真机与弱网质量仍需在实际图片托管地址下验收。localhost加载正常不能证明远端加载性能。


## 正式商品创建与图片上传（2026-10-19）

用户明确授权创建商品并上传，已在 `https://chuy.shop/` 正式后台完成：

- 名称：星点法式；分类：美甲 → 款式设计；状态：上架中；排序100。
- 说明：裸粉珠光底色，搭配银白星星、棕铜色小星与浅蓝圆点法式。具体款式细节、服务时长及价格请与门店确认。
- 参考价：未设置，不虚构金额。
- 上传文件：本目录 `display.jpg`。服务器按既有流程重新编码后，公开文件125,332 bytes，1080×1374。
- 已重新读取小程序公开商品接口，确认返回此商品及图片地址；后台DOM确认图片 `complete=true`，自然尺寸1080×1374；已下载公开图片逐张查看。
- [创建凭证](production/receipt.json) / [后台上架截图](production/admin-created.png) / [服务器实际图片](production/uploaded-image.jpg)。

本次完成的是正式商品与图片上线；之前改造的小程序客户端代码仍须另行上传体验版或发布，二者状态分别记录。
