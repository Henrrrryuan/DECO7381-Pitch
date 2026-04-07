# 项目前期协作规划

本文档用于统一小组开发方式，避免出现“每个人都写了代码，但最后拼不起来”的情况。

当前项目采用四维度分工：

1. Readability
2. Visual Complexity
3. Interaction & Distraction
4. Consistency

每位组员分别负责一个维度，但必须在同一个技术协议下开发。

---

## 1. 开发总原则

在开始写各自模块之前，团队必须先统一以下内容：

1. 输入格式
2. 输出数据结构
3. 目录结构
4. 评分方式
5. 后端总入口
6. 前后端接口协议

原因很简单：

- 如果每个人的输入不一样，模块不能互换
- 如果每个人的输出字段不一样，前端无法统一展示
- 如果每个人自己算总分，最后分数会不一致
- 如果没有统一目录，合并时冲突会很多

所以本项目的正确顺序应该是：

1. 先统一协议
2. 再分头开发
3. 最后统一集成

---

## 2. 推荐项目结构

建议使用如下结构：

```text
project/
├── backend/
│   ├── analyzers/
│   │   ├── readability.py
│   │   ├── visual.py
│   │   ├── interaction.py
│   │   └── consistency.py
│   ├── schemas.py
│   ├── scoring.py
│   ├── main.py
│   └── sample_input/
├── frontend/
│   ├── src/
│   └── ...
├── docs/
│   ├── api-contract.md
│   └── ...
└── README.md
```

---

## 3. 每个部分是干嘛的

### 3.1 `backend/analyzers/`

这里存放四个维度的分析模块。

每个人只需要负责自己那个文件，例如：

- 做 Readability 的人写 `readability.py`
- 做 Visual 的人写 `visual.py`
- 做 Interaction 的人写 `interaction.py`
- 做 Consistency 的人写 `consistency.py`

这些文件的职责是：

- 接收统一输入
- 检测本维度规则
- 返回统一格式的结果

它们**不能**做的事：

- 不能自己决定总分怎么算
- 不能输出跟别人不一样的字段名
- 不能擅自增加前端依赖

### 3.2 `backend/schemas.py`

这里放统一的数据结构定义。

它的作用是：

- 规定每个 analyzer 必须返回什么字段
- 规定每条 issue 长什么样
- 规定总返回结果长什么样

它相当于团队的“数据合同”。

如果没有这个文件，最后很容易出现：

- A 同学返回 `severity`
- B 同学返回 `level`
- C 同学返回 `risk`

前端就没法接。

### 3.3 `backend/scoring.py`

这里专门负责分数计算。

它的职责是：

- 统一 severity 系数
- 统一 penalty 算法
- 统一总分算法

建议写在这里的内容：

- `Penalty = Base * Severity`
- `Final = 0.5 * 最低维度分 + 0.5 * 加权平均分`

这样四个 analyzer 只负责“发现问题”，不负责“决定最终总分”。

### 3.4 `backend/main.py`

这是后端统一入口。

它的职责是：

1. 接收前端传来的 HTML 或文件内容
2. 依次调用四个 analyzer
3. 汇总四个维度结果
4. 调用 `scoring.py` 计算总分
5. 把统一结果返回给前端

前端以后只请求一个接口，比如：

- `POST /analyze`

前端不应该分别请求四个维度。

### 3.5 `backend/sample_input/`

放测试用的 HTML 示例。

作用：

- 让每个人都能用同一份输入调试
- 方便明天合并前做统一测试

建议至少放：

- `simple-page.html`
- `dense-page.html`

### 3.6 `frontend/`

前端只做一件事：

- 接后端统一返回的数据
- 展示 dashboard

前端不应该自己重新计算分数。

前端展示重点：

1. 四维分数
2. 总分
3. 问题列表
4. 严重程度
5. 修改建议
6. reupload 前后对比

### 3.7 `docs/api-contract.md`

这个文件是给团队看的接口文档。

它的职责是：

- 告诉每个人输入长什么样
- 告诉前端输出长什么样
- 告诉后端字段名不能乱改

这个文件非常重要，等于你们团队的“协议说明书”。

---

## 4. 统一输入格式

MVP 阶段建议统一输入为：

```python
html: str
```

原因：

- 最简单
- 最稳定
- 所有人都能处理
- 方便后续从文件中读取

不建议第一版就有人吃：

- 文件路径
- URL
- DOM 对象
- PDF
- 图片

因为这会让四个人写出来的模块完全不统一。

---

## 5. 统一函数接口

建议四个 analyzer 都采用同样的函数签名：

```python
def analyze_readability(html: str) -> dict:
    ...
```

其他三个模块同理：

```python
def analyze_visual(html: str) -> dict:
    ...

def analyze_interaction(html: str) -> dict:
    ...

def analyze_consistency(html: str) -> dict:
    ...
```

这样做的好处：

- `main.py` 很容易调用
- 每个人写法统一
- 调试方便
- 明天合并最稳

---

## 6. 统一输出数据结构

### 6.1 每个维度统一返回格式

每个 analyzer 都必须返回：

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
      "suggestion": "将长句拆成更短的句子。",
      "evidence": {
        "average_sentence_length": 24.1
      }
    }
  ]
}
```

### 6.2 字段说明

#### `dimension`

表示当前结果属于哪个维度。

固定值：

- `Readability`
- `Visual Complexity`
- `Interaction & Distraction`
- `Consistency`

#### `score`

当前维度的分数，范围固定为：

```text
0 - 100
```

#### `issues`

当前维度检测到的问题列表。

如果没有问题，也必须返回空数组：

```json
"issues": []
```

### 6.3 单条 issue 字段说明

#### `rule_id`

规则编号，例如：

- `RD-1`
- `VC-2`
- `ID-3`
- `CS-1`

#### `title`

问题标题，用于 dashboard 直接显示。

例如：

- `平均句长过长`
- `首屏元素过多`
- `存在自动播放媒体`

#### `severity`

严重程度，必须统一为这三个值之一：

- `minor`
- `major`
- `critical`

不允许自己发明别的写法。

#### `base_penalty`

规则基础扣分，例如 `3` 或 `4`。

#### `penalty`

最终扣分，按统一规则计算：

```text
Penalty = Base Penalty * Severity Multiplier
```

建议系数：

- `minor = 1`
- `major = 2`
- `critical = 3`

#### `description`

解释为什么这是问题。

这个字段是给用户看的，不是给程序看的。

#### `suggestion`

具体修改建议。

例如：

- `将按钮文案改成更具体的动作词`
- `减少主按钮数量，只保留一个主 CTA`

#### `evidence`

放检测出来的证据数据。

例如：

```json
{
  "average_sentence_length": 24.1
}
```

或者：

```json
{
  "cta_count": 4
}
```

这个字段的作用是：

- 让问题更可解释
- 方便调试
- 方便之后做高亮定位

---

## 7. 总接口返回结构

`main.py` 最终应该返回如下结构：

```json
{
  "overall_score": 74,
  "weighted_average": 79,
  "min_dimension_score": 68,
  "dimensions": [
    {
      "dimension": "Readability",
      "score": 82,
      "issues": []
    },
    {
      "dimension": "Visual Complexity",
      "score": 68,
      "issues": []
    },
    {
      "dimension": "Interaction & Distraction",
      "score": 77,
      "issues": []
    },
    {
      "dimension": "Consistency",
      "score": 71,
      "issues": []
    }
  ]
}
```

### 字段说明

#### `overall_score`

最终总分。

#### `weighted_average`

四维加权平均分。

#### `min_dimension_score`

四个维度中的最低分。

#### `dimensions`

四个 analyzer 的结果数组。

---

## 8. 统一评分规则

### 8.1 维度权重

统一使用：

| 维度 | 权重 |
| --- | --- |
| Visual Complexity | 30% |
| Readability | 25% |
| Interaction & Distraction | 25% |
| Consistency | 20% |

### 8.2 最终总分公式

```text
Weighted Average
= Visual * 0.30
+ Readability * 0.25
+ Interaction * 0.25
+ Consistency * 0.20

Final Score
= 0.5 * min_dimension_score
+ 0.5 * weighted_average
```

### 8.3 为什么要统一放在 `scoring.py`

因为如果四个人各自算总分，很容易出现：

- 每个人用的权重不一样
- 每个人 severity 系数不一样
- 前端展示和后端结果不一致

所以：

- analyzer 只负责找问题
- `scoring.py` 统一负责算分

---

## 9. 四个人分别做什么

### 9.1 Readability 负责人

负责实现：

- `RD-1` 平均句长 > 20
- `RD-2` 段落 > 4 句
- `RD-3` vague button text

输出必须符合统一格式。

### 9.2 Visual 负责人

负责实现：

- `VC-1` 首屏元素 > 12
- `VC-2` 卡片密集 > 6 items
- `VC-3` sidebar/banner 过多

输出必须符合统一格式。

### 9.3 Interaction 负责人

负责实现：

- `ID-1` autoplay
- `ID-2` 动画元素 > 2
- `ID-3` CTA > 2

输出必须符合统一格式。

### 9.4 Consistency 负责人

负责实现：

- `CS-1` heading 结构断层
- `CS-2` 无 breadcrumb / progress

输出必须符合统一格式。

---

## 10. 推荐开发顺序

### 今天先完成

1. 确定目录结构
2. 确定 `schemas.py`
3. 确定 analyzer 输入输出格式
4. 确定 `scoring.py` 公式
5. 确定 sample html

### 今天晚上每个人本地开发

每个人只做自己的 analyzer，不碰别人模块。

### 明天合并顺序

1. 先合并公共文件
   - `schemas.py`
   - `scoring.py`
   - `main.py`
2. 再逐个接入四个 analyzer
3. 最后前端接统一接口

---

## 11. Git 协作建议

每个人一个分支：

- `feature/readability`
- `feature/visual`
- `feature/interaction`
- `feature/consistency`

不要四个人同时改主分支。

建议流程：

1. 先建立公共主分支
2. 每个人在自己分支写代码
3. 明天由一个人负责集成
4. 集成完成后统一测试

---

## 12. 最低协作规则

这 6 条必须统一：

1. 输入统一为 `html: str`
2. 输出字段名必须完全一致
3. `score` 范围统一为 `0-100`
4. `severity` 只能是 `minor / major / critical`
5. 总分只能由 `main.py + scoring.py` 统一计算
6. 前端只接一个总接口，不直接对接四个 analyzer

---

## 13. 给组员的一句话总结

我们不是四个人各写各的“独立项目”，而是在同一个协议下各做一个分析模块。

所以最重要的不是谁先写规则，而是先统一：

- 输入
- 输出
- 字段名
- 分数算法
- 总接口

只要这五件事统一，明天合并就会非常顺。否则每个人都写完了，代码也可能拼不起来。
