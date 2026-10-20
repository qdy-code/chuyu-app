# 月光石屿商品图工作流

已在本机安装 `$moonisle-product-images`。技能源码在 [tools/skills/moonisle-product-images](../../tools/skills/moonisle-product-images/SKILL.md)，`~/.codex/skills/moonisle-product-images` 链接到该目录。移动项目后需更新链接。

## 使用方式

在 Codex 中直接说：

> 使用 $moonisle-product-images，按月光石屿品牌风格，为美甲、饰品、鲜花各生成一张新款概念主图，保存到本地。

有实物照片时：

> 使用 $moonisle-product-images，优化这些商品照片。只统一背景和光线，保留商品颜色、数量、结构、石纹/花材/甲面设计。商品编号是……，图片在……。各输出一张方形主图和一张列表图。

需要明确待保持的商品特征以及允许修改的范围。信息足够时由 Codex 写批次、调用模型、逐张检查并归档；正式上架不在自动流程内。

本地脚本管理任务与文件，实际生图使用 Codex 内置云端 image 模型，无需单独配置 API key。**脚本自身不能在终端独立调用内置模型，也没有设置定时或无人值守运行。** 如以后明确改用 API 自动化，沿用任务格式并按系统 imagegen 技能配置，不暗中切换模型。

## 品牌基线

沿用项目已确认的奶油白、月光灰蓝和深灰，低饱和环境、清透材质、柔和自然光。商品自身颜色必须保留。品牌规则集中在 [brand.json](../../tools/skills/moonisle-product-images/references/brand.json)，首版摄影方向等待样张反馈校准。支持 hero 方图、list 横图、detail 细节图与 social 竖图。

## 本次试跑：3 张 AI 概念图

批次输入：[concept-pilot.json](batches/concept-pilot.json)。实际使用内置 image_gen，每张一次调用；三张原图均为 1254 × 1254 PNG，已保存到项目内。图片不是门店实拍、库存或材料证明。

| 类别 | 原图 | 完整提示词 | 图片级检查 |
| --- | --- | --- | --- |
| 美甲 | [月雾贝光](output/concept-pilot-v1/nail-moonmist-concept-v1/original.png) | [prompt](output/concept-pilot-v1/nail-moonmist-concept-v1/prompt.txt) | 五枚、配色和晕染符合方向；甲形偏椭圆，未准确达到短杏仁形，作为风格候选 |
| 饰品 | [月光石感耳钉](output/concept-pilot-v1/accessory-moonstone-concept-v1/original.png) | [prompt](output/concept-pilot-v1/accessory-moonstone-concept-v1/prompt.txt) | 成对、包镶、光泽与阴影合理；真实材质和背部结构未验证 |
| 鲜花 | [日常月光小花束](output/concept-pilot-v1/flower-softday-concept-v1/original.png) | [prompt](output/concept-pilot-v1/flower-softday-concept-v1/prompt.txt) | 三朵郁金香与包装完整；当前横向列表裁切会丢失包装等，需独立 list 构图 |

每张同目录包含 `manifest.json`（输入与品牌快照、提示词/图片哈希）和 `review.json`（检查结论与局限）。样张仍是待品牌反馈的候选，未批准发布。

## 验证范围

- Skill 标准校验通过；校验器依赖 PyYAML，通过 `uv run --with pyyaml` 临时运行，没有给工作流增加依赖。
- 7 项本地行为测试通过：概念/实物区分、实物必要输入、参考角色顺序、缺失文件与路径穿越拒绝、无效批次不产生部分输出、无损归档且不覆盖、错误图片头拒绝。
- 三次真实内置模型生成与本地归档完成，已逐张视觉检查。提示词限制不保证模型精确执行，甲形与花束裁切问题已如实记录。
- 上述概念图试跑当时未完成实物保真及页面验证；后续实拍复核和本地接入结果见本文末尾的2026-10-19记录。真机与线上发布仍未完成。

命令和输入字段见 [workflow.md](../../tools/skills/moonisle-product-images/references/workflow.md)。


## 2026-10-19 实拍复核与展示接入

已重新对照用户实拍、V1、R2及美甲概念图，并在实际微信编译产物中验收。V1/R2仍有额外白色小星及珠光重绘，保真不通过，见 [复核报告](reviews/2026-10-19/README.md)。

随后采用原照压缩副本，完成美甲列表完整显示和看图控件下移；展示JPEG约182 KiB，比原照减少57.59%。[展示资源与本地验收](delivery/nail-star-source-web-v1/README.md)。后续经用户明确授权，已创建并上架美甲商品“星点法式”，上传实拍展示图，见该目录的 `production/receipt.json`。小程序客户端代码尚未发布。
