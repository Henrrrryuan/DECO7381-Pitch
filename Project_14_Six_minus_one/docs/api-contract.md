# API 与数据结构约定

这份文档用于统一前后端与四个 analyzer 的接口格式。

## 1. 输入

MVP 阶段统一输入：

```json
{
  "html": "<html>...</html>"
}
```

说明：

- 所有 analyzer 都吃同一个 `html: str`
- 不在 analyzer 层处理文件路径、PDF、URL 或图片

## 2. 单个维度输出

每个 analyzer 必须返回：

```json
{
  "dimension": "Readability",
  "score": 82,
  "issues": [
    {
      "rule_id": "RD-1",
      "title": "平均句长过长",
      "severity": "major",
      "base_penalty": 3,
      "penalty": 6,
      "description": "平均句长超过 20 个词，增加阅读负担。",
      "suggestion": "将长句拆分为更短的句子。",
      "evidence": {
        "average_sentence_length": 24.1
      },
      "locations": []
    }
  ],
  "metadata": {}
}
```

## 3. 总接口输出

`POST /analyze` 返回：

```json
{
  "overall_score": 74,
  "weighted_average": 79,
  "min_dimension_score": 68,
  "dimensions": [
    {
      "dimension": "Readability",
      "score": 82,
      "issues": [],
      "metadata": {}
    },
    {
      "dimension": "Visual Complexity",
      "score": 68,
      "issues": [],
      "metadata": {}
    },
    {
      "dimension": "Interaction & Distraction",
      "score": 77,
      "issues": [],
      "metadata": {}
    },
    {
      "dimension": "Consistency",
      "score": 71,
      "issues": [],
      "metadata": {}
    }
  ]
}
```

## 4. 严重程度与扣分

统一 severity：

- `minor`
- `major`
- `critical`

统一 penalty 公式：

```text
Penalty = Base Penalty * Severity Multiplier
```

统一 multiplier：

- `minor = 1`
- `major = 2`
- `critical = 3`

## 5. 最终总分

```text
Weighted Average
= Visual Complexity * 0.30
+ Readability * 0.25
+ Interaction & Distraction * 0.25
+ Consistency * 0.20

Final Score
= 0.5 * min_dimension_score
+ 0.5 * weighted_average
```

## 6. 模块职责

- `analyzers/*.py`：负责规则检测与问题返回
- `scoring.py`：负责统一扣分和总分
- `main.py`：负责整合四个 analyzer
- `frontend/`：只负责展示返回结果
