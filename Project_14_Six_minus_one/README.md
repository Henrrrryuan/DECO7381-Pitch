# Cognitive Accessibility Assistant

这是项目的共享开发骨架。

当前已完成：

- 统一目录结构
- 统一数据结构
- 统一评分逻辑
- 四个 analyzer 的公共 stub
- 后端统一入口
- API contract 文档

当前未完成：

- 四个维度的具体规则实现
- 前端 dashboard
- 文件上传和 reupload 对比界面

## 目录说明

```text
backend/
  analyzers/
  schemas.py
  scoring.py
  main.py
  sample_input/
docs/
  api-contract.md
frontend/
```

## 后续分工

- Readability: 在 `backend/analyzers/readability.py` 中实现
- Visual Complexity: 在 `backend/analyzers/visual.py` 中实现
- Interaction & Distraction: 在 `backend/analyzers/interaction.py` 中实现
- Consistency: 在 `backend/analyzers/consistency.py` 中实现

## 开发约定

- 所有 analyzer 输入统一为 `html: str`
- 所有 analyzer 输出统一为 `DimensionResult`
- 总分只通过 `backend/scoring.py` 计算
- 前端只接 `main.py` 的统一输出
