# 本地运行

`SKILL` 设为 `~/.codex/skills/moonisle-product-images` 的展开路径。只需 Python 3 标准库；准备与归档不联网，不读取密钥。

```sh
python3 "$SKILL/scripts/workflow.py" prepare --batch /absolute/batch.json --out /absolute/new-batch-folder
python3 "$SKILL/scripts/workflow.py" capture --job /absolute/new-batch-folder/nail-01 --image /absolute/generated.png
```

`prepare` 创建新目录，不覆盖已有批次；`capture` 不覆盖已有图片。Codex 按 `tool-request.json` 调用内置模型，终端脚本本身不生图。每个任务一张，先少量样张再扩展。`review.json` 是待填写记录，不是自动评分器。

## 批次格式

顶层 `jobs` 为列表，每项必填 `id`、`mode`、`category`、`brief`；可选 `shot` 默认 hero、`facts` 真实信息列表、`preserve` 保留项列表、`edit_scope` 允许改动字符串、`product_images` 和 `style_images` 路径列表。路径相对 batch.json 解析，也可绝对路径。概念图可使用风格参考，不用 product_images 冒充实物。

```json
{
  "jobs": [{
    "id": "bracelet-001-bg-v1",
    "sku": "店内真实SKU",
    "mode": "product-edit",
    "category": "accessory",
    "shot": "hero",
    "brief": "统一已有手串商品图背景",
    "facts": [],
    "preserve": ["全部珠子、排列、石纹、颜色、配件及比例"],
    "edit_scope": "仅替换背景为奶油白，调整环境光和接触阴影，保持原视角",
    "product_images": ["inputs/bracelet-front.jpg"],
    "style_images": []
  }]
}
```

`mode`: concept / product-edit；`category`: nail / accessory / flower；`shot`: hero / list / detail / social。id 仅字母数字、横杠、下划线，不重复。概念批次示例在项目 `design/product-images/batches/concept-pilot.json`。竖向花束通常需要独立 list 构图，不能直接沿用方形主图并声称完整展示。

## 输出

- `prompt.txt` 和 `tool-request.json`：完整提示词与内置工具参数。
- `manifest.json`：输入、参考图 SHA256、品牌快照、提示词哈希、引擎、概念/实物标记及归档状态。
- `review.json`：逐项 pending/pass/fail/not-applicable、具体观察及总体结论；默认没有通过项。
- `original.*`：capture 后的原始生成文件，不压缩不裁切，manifest 记录 SHA256。

看图后填写 reviewer、observations、checks、verdict；没有检查的项目保留 pending。approved_for_publication 默认 false，本流程不自动修改。实物须与原图并排比较；没有真实参考不得报告实物保真通过。

检查真实输出尺寸和数量，不把提示词当成结果。像素完全不变需求需要确定性合成或人工修图，不能承诺通过提示词锁定像素。用户需要裁切/压缩时按当前工具约定另存衍生图。方图详情与列表裁切分别验证；未接入页面不报告小程序验收通过。
