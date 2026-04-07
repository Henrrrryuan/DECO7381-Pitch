# 认知无障碍评估框架

本文档用于支撑 **Project 14: Cognitive Accessibility Assistant for Web Content** 的方法设计、评分逻辑、MVP 范围与评估方案。

本项目的产品定位为：

- 主要用户：开发者、设计师
- 最终受益者：认知障碍者、神经多样性用户、存在沟通或理解困难的用户
- 产品形态：先做自动分析与解释，再做可选的用户验证

---

## 1. 项目目标

根据 brief，本项目需要完成以下几件事：

1. 分析网页内容中的认知无障碍风险，包括语言复杂度、布局密度、间距、动画使用和视觉层级
2. 提供一个可解释的 dashboard 或报告界面，说明问题、影响和改进建议
3. 将分析结果映射到 WCAG / COGA 与 ISO 9241-11 等标准
4. 提供一个结构化评估方案，证明工具能提升清晰度、理解度或可用性

结合项目定位，我们将系统设计为：

- 前台采用 4 个开发者易理解的评分维度
- 后台使用规则检测和解释机制完成评分
- 用户测试作为验证层，不作为每次开发迭代的必经步骤

---

## 2. 四个核心维度

本项目最终对外展示的四个维度为：

1. `Visual Complexity`
2. `Readability`
3. `Interaction & Distraction`
4. `Consistency`

它们与 brief 的对应关系如下：

| 维度 | brief 对应内容 | 核心关注点 |
| --- | --- | --- |
| Visual Complexity | layout density, spacing, visual hierarchy | 页面是否拥挤、视觉层级是否清晰、信息是否容易扫描 |
| Readability | language complexity, clarity, comprehension | 文本是否容易阅读、理解、执行 |
| Interaction & Distraction | animation usage, cognitive effort, interruptions | 页面是否分散注意力、交互是否增加额外认知负担 |
| Consistency | structural organisation, navigation patterns | 页面结构、导航、标签和流程是否稳定可预测 |

---

## 3. 理论来源与映射

本框架参考 `inclusive-design-skills` 仓库中的认知无障碍方法，但不直接照搬其分类，而是将其作为底层分析因素使用。

来源框架包括：

1. cognitive load
2. plain language
3. wayfinding and navigation
4. focus and attention
5. memory load
6. error prevention and recovery

映射关系如下：

| 来源框架 | 主要映射到 | 原因 |
| --- | --- | --- |
| visual complexity / information density | Visual Complexity | 直接对应布局密度、拥挤程度、视觉扫描负担 |
| plain language / reading complexity | Readability | 直接对应文字理解难度 |
| focus and attention | Visual Complexity / Interaction & Distraction | 既影响视觉清晰度，也影响注意力控制 |
| wayfinding/navigation | Consistency / Visual Complexity | 同时影响方向感与结构清晰度 |
| memory load | Consistency / Interaction & Distraction | 影响跨页面记忆负担与流程摩擦 |
| error prevention/recovery | Interaction & Distraction / Consistency | 影响交互负担与系统可预测性 |

---

## 4. 最终 MVP 范围

为了保证项目既有研究深度，又能在课程周期内实现，MVP 范围锁定如下。

### 4.1 必须实现

1. 文件上传与解析
2. 四个维度评分
3. 总分计算
4. 问题列表展示
5. 每条问题的原因解释
6. 对应修改建议
7. reupload 后前后对比
8. 基础 standards mapping

### 4.2 建议实现

1. 点击问题后高亮对应页面区域
2. 全文朗读或阅读高亮预览
3. 更细的分维度 drill-down
4. AI 辅助解释或改写建议

### 4.3 不纳入 MVP 主流程

以下内容可以保留在报告中作为 future work：

1. 眼动追踪实时接入评分
2. 每次修改后都进行真实用户测试
3. 大规模相关性统计验证
4. 多格式输入同时支持，如 PDF、截图、URL、Figma 导出

---

## 5. MVP 最终规则集

本项目最终采用 11 条规则，分布在 4 个维度中。

### 5.1 Readability（3 条）

| 规则编号 | 规则 | 阈值 |
| --- | --- | --- |
| RD-1 | 平均句长过长 | 平均句长 `> 20` 个词 |
| RD-2 | 段落过长 | 单段 `> 4` 句 |
| RD-3 | 按钮文案模糊 | 出现 `Next`、`Click here` 等模糊文案 |

### 5.2 Visual Complexity（3 条）

| 规则编号 | 规则 | 阈值 |
| --- | --- | --- |
| VC-1 | 首屏元素过多 | 首屏可见重点元素 `> 12` |
| VC-2 | 卡片或内容块过密 | 同一区域内卡片/项目 `> 6` |
| VC-3 | sidebar / banner 过多 | 存在过多侧栏、横幅、悬浮干扰区 |

### 5.3 Interaction & Distraction（3 条）

| 规则编号 | 规则 | 阈值 |
| --- | --- | --- |
| ID-1 | 自动播放媒体 | 存在 autoplay 音频或视频 |
| ID-2 | 动画元素过多 | 同一视口中动画元素 `> 2` |
| ID-3 | CTA 竞争 | 同一区域主操作按钮 `> 2` |

### 5.4 Consistency（2 条）

| 规则编号 | 规则 | 阈值 |
| --- | --- | --- |
| CS-1 | heading 结构断层 | 标题层级跳跃或结构不连贯 |
| CS-2 | 缺少 breadcrumb / progress | 多层级或多步骤流程中没有当前位置提示 |

---

## 6. 每个维度的检测重点

### 6.1 Visual Complexity

定义：
页面是否过于拥挤、层级不清、信息过多，导致用户难以快速判断“先看哪里”。

检测重点：

- 首屏中同时竞争注意力的元素数量
- 单一区域内内容块是否过密
- 侧栏、横幅、悬浮组件是否过多

高风险表现：

- 首页一打开就出现大量按钮、卡片、横幅、浮窗
- 用户无法快速判断主内容区域
- 非主任务内容占据过多视觉空间

### 6.2 Readability

定义：
文本是否足够简洁、易懂、可快速理解。

检测重点：

- 句子是否太长
- 段落是否太密
- 按钮或链接文案是否模糊

高风险表现：

- 用户需要反复阅读同一句话
- 说明文字过长导致理解缓慢
- 按钮名字不能直接说明下一步动作

### 6.3 Interaction & Distraction

定义：
页面是否通过动画、自动播放或竞争操作增加认知负担。

检测重点：

- autoplay 媒体
- 动画元素数量
- CTA 是否过多

高风险表现：

- 页面存在自动播放声音或视频
- 同一屏里多个按钮都像主按钮
- 页面有多个动态元素同时争夺注意力

### 6.4 Consistency

定义：
页面结构、导航和流程提示是否稳定、可预测。

检测重点：

- heading 层级是否连续
- 是否存在 breadcrumb 或 progress

高风险表现：

- 标题层级跳跃，页面结构难以理解
- 多步骤任务里用户不知道自己现在在哪一步

---

## 7. 评分模型

### 7.1 维度权重

建议使用以下权重：

| 维度 | 权重 |
| --- | --- |
| Visual Complexity | 30% |
| Readability | 25% |
| Interaction & Distraction | 25% |
| Consistency | 20% |

### 7.2 加权平均分

```text
Weighted Average Score
= Visual Complexity * 0.30
+ Readability * 0.25
+ Interaction & Distraction * 0.25
+ Consistency * 0.20
```

### 7.3 最终总分

```text
Final Score
= 0.5 * 最低维度分
+ 0.5 * 加权平均分
```

设计理由：

- 单纯平均分会掩盖严重短板
- 认知无障碍具有明显“短板效应”
- 只要某一维度非常差，整体体验仍可能很差

例如：

- Visual Complexity = 90
- Readability = 88
- Interaction & Distraction = 85
- Consistency = 42

此时如果只做平均，系统看起来仍然“还可以”；但实际上用户可能会因为导航或结构不稳定而持续迷失。  
因此最终分数必须让最弱维度真实影响结果。

---

## 8. 惩罚机制

### 8.1 简化版惩罚公式

MVP 使用简化公式：

```text
Penalty = Base Penalty * Severity
```

其中：

- `Base Penalty`：规则基础扣分
- `Severity`：严重程度系数

建议严重程度系数如下：

| 严重程度 | 系数 | 含义 |
| --- | --- | --- |
| Minor | 1 | 小范围、单点问题 |
| Major | 2 | 明显增加认知负担 |
| Critical | 3 | 可能直接影响理解或任务完成 |

### 8.2 建议的基础扣分

MVP 中可以统一先设为：

- 普通规则：`Base Penalty = 3`
- 严重规则：`Base Penalty = 4`

示例：

```text
自动播放媒体
Base Penalty = 4
Severity = Major = 2
Penalty = 8
```

### 8.3 为什么要加严重程度

如果没有 severity：

- 一个轻微问题
- 一个严重问题

可能会被系统当作同样程度的扣分，这在逻辑上不合理。

加入 severity 后：

- 评分更符合真实影响
- dashboard 更容易解释
- 用户测试时也更容易与真实体验对应

---

## 9. 维度分数计算方式

推荐流程：

1. 检测每条规则是否命中
2. 判断命中的严重程度
3. 根据 `Penalty = Base * Severity` 计算扣分
4. 将该维度所有扣分相加
5. 用 `100 - 总扣分` 得到维度分数
6. 分数最低不低于 0

```text
Dimension Score = max(0, 100 - Sum(Penalties))
```

MVP 阶段不强制实现复杂去重模型，但需要在文档中说明：

> 当前版本采用简化惩罚模型，复杂规则重叠与归一化机制保留为后续优化方向。

---

## 10. 边界与限制

为了保证项目范围合理，需要明确以下边界。

### 10.1 输入边界

MVP 建议优先支持一种主要输入形式，例如：

- HTML 文件
- 网页片段

不建议第一版同时支持：

- PDF
- 图片
- URL 实时抓取
- 多源文件混合分析

### 10.2 检测边界

本系统检测的是 **认知负担代理指标**，不是对人类认知过程的完整建模。

也就是说：

- 系统可以识别与认知负担相关的页面特征
- 但不能声称自己“准确模拟用户大脑如何理解网页”

### 10.3 评分边界

本项目输出的是：

- 开发决策支持分数
- 认知无障碍启发式评分

而不是：

- 医学诊断
- 法律认证
- 官方 WCAG 合规结论

### 10.4 用户测试边界

用户测试用于验证模型是否有帮助，不用于宣称大规模普适性结论。

因此报告建议使用如下表述：

- pilot evaluation
- preliminary evidence
- initial validation

---

## 11. Dashboard 输出结构

dashboard 至少应包含以下内容：

1. 四个维度分数
2. 最终总分
3. 问题列表
4. 每条问题的严重程度
5. 每条问题的原因解释
6. 每条问题的修改建议
7. reupload 前后对比结果

如果时间允许，建议加上：

1. 点击问题后高亮页面对应区域
2. 每个问题对应的 brief / WCAG / COGA / ISO 标签

建议单条问题卡片结构如下：

```text
问题：同一区域出现 3 个主操作按钮
维度：Interaction & Distraction
严重程度：Major
影响：增加决策负担，削弱用户对主任务的注意力集中
建议：保留 1 个主按钮，其余改为次要按钮或文本链接
```

---

## 12. 标准映射

### 12.1 WCAG / COGA 映射

| 维度 | 对应标准含义 |
| --- | --- |
| Visual Complexity | 清晰结构、减少视觉干扰、支持内容扫描 |
| Readability | 可理解语言、plain language、降低阅读负担 |
| Interaction & Distraction | 减少自动播放、无关动画、打断性元素 |
| Consistency | 一致导航、一致识别、可预测的交互与流程 |

### 12.2 ISO 9241-11 映射

| ISO 因素 | 本项目对应解释 |
| --- | --- |
| Effectiveness | 用户能更准确理解页面信息并完成任务 |
| Efficiency | 用户理解和操作所需时间减少 |
| Satisfaction | 用户主观上感觉更清晰、更轻松、更少挫败 |

---

## 13. Evaluation 方案

### 13.1 最小可行评估方案

MVP 建议采用一个小规模 before / after 评估：

- 样本数：5 人
- 对比方式：修改前版本 vs 修改后版本
- 目标：验证工具是否帮助页面变得更容易理解、更快完成任务

### 13.2 最小问题设置

可以只问两个核心问题：

1. 是否更容易理解？
2. 是否更快完成？

如果希望再稳一点，可以加：

3. 是否更清晰？
4. 是否更少分心？

### 13.3 建议指标

| 指标 | 对应验证目标 |
| --- | --- |
| 完成任务时间 | Efficiency |
| 理解题正确率 | Effectiveness |
| 主观清晰度评分 | Satisfaction |
| 主观容易程度评分 | Satisfaction / cognitive load |

### 13.4 推荐报告写法

建议使用如下表述：

> 本项目通过一个小规模 pilot evaluation 比较修改前后页面在理解效率与主观清晰度上的差异，以提供该评分框架有效性的初步证据。

如果你想写得再研究化一点，可以用：

> 本评估关注系统评分与用户表现之间是否存在方向一致的变化趋势，而非在 MVP 阶段追求大规模统计显著性。

---

## 14. Future Work

以下内容可明确写入 future work，而不纳入第一版实现：

1. 更复杂的规则分组与去重模型
2. 跨页面、跨内容长度的归一化机制
3. 眼动追踪数据与规则评分融合
4. 大样本相关性研究
5. 个性化认知障碍模式，如 ADHD / dyslexia / autism 定制建议
6. 多格式输入支持，如 PDF、截图、URL 实时分析
7. 浏览器插件化，支持边浏览边分析

---

## 15. 最终结论

本项目最终采用的策略是：

1. 用 4 个维度作为开发者可理解的展示层
2. 用 11 条启发式规则作为 MVP 的检测核心
3. 用 `Final = 0.5 * 最低维度分 + 0.5 * 加权平均分` 作为最终评分模型
4. 用 `Penalty = Base * Severity` 实现可解释、可实现的扣分机制
5. 用 before / after 的小规模用户评估作为初步验证
6. 将眼动追踪和复杂统计验证保留为 future work

这样可以同时满足三件事：

- 能做出来
- 能讲清楚
- 能拿高分
