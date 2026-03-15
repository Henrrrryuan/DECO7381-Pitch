# BCI-Powered Adaptive Environment

This repository presents an interactive concept demo for a **BCI-powered adaptive environment**.  
The project moves beyond passive EEG monitoring and explores real-time environmental adaptation based on cognitive states.

## 5-Minute Brief Speech (English)

Good afternoon everyone, and thank you for being here.

Today, I will briefly present our project: **BCI-Powered Adaptive Environment**.

Our core idea is simple: instead of only monitoring brain activity, we use EEG signals to create environments that can respond in real time to a user's cognitive state.

Let me start with context.

Our timeline shows how BCI evolved from early EEG research in 1924, to the formal definition of BCI in 1973, then to implanted studies in the late 1990s, and later to consumer products like EMOTIV and Muse.

Those products proved that wearable EEG and real-time feedback are practical. But most of them still stop at "monitoring."

Our project focuses on the next step: **adaptive response**.

Second, our design is grounded in a **human-centered approach**.

We identified three major problems:

1. EEG systems often provide insights, but not direct action.
2. Smart environments still rely heavily on manual control or fixed automation.
3. Existing systems rarely adapt dynamically to real-time cognitive changes.

Our target users include students and knowledge workers, people experiencing stress or fatigue, and users who are sensitive to environmental conditions.

The value we offer is improved focus and wellbeing, while reducing repetitive manual adjustments and preserving user control.

Third, let us talk about how the system works.

Our **System Flow** has five steps:

1. EEG Signal Input
2. Signal Processing
3. Cognitive Analysis
4. Adaptive Environment
5. Evaluation and Iteration

In practice, we collect real-time EEG data through a wearable device, clean noise and artifacts, extract brainwave features, classify states like focus or stress, and then map those states to actions such as adjusting lighting, soundscape, or temperature.

After that, we evaluate effectiveness and refine thresholds and control logic.

We also built a **Real-Time Adaptive Control Demo** to make this loop visible.

The demo shows pipeline stages, confidence scores, policy gates, and output actions. It also includes automation status, system metrics, and manual override states.

This is important because intelligence without transparency can reduce trust.

That leads to ethics.

We explicitly address four ethical risks:

- Privacy
- Autonomy
- Bias
- Trust and Safety

Our mitigation strategies include local processing where possible, data minimization, human-in-the-loop control, and safe behavior under uncertainty.

When signal confidence is low, automation becomes conservative or blocked, and user override is prioritized.

Now, on team capability.

Our **Team Expertise Matrix** and **Technical Skills Required** sections show complete role coverage across the pipeline:

- Signal processing
- Cognitive state detection
- Adaptive environment control
- Interactive dashboard design
- End-to-end system integration

This alignment matters because adaptive BCI is an interdisciplinary challenge, and each stage depends on both technical depth and user-centered design decisions.

To conclude:

Our project moves BCI from passive feedback to active, responsible adaptation.

The expected outcome is better attention support, improved study or work efficiency, and reduced cognitive friction in daily environments.

Most importantly, we aim to deliver this with transparency, safety, and user control at the center.

Thank you.

---

## 5分钟简短演讲稿（中文）

大家下午好，感谢各位来到这里。

今天我将简要介绍我们的项目：**脑机接口驱动的自适应环境**。

我们的核心理念很简单：不再只“监测”脑活动，而是利用 EEG 信号，让环境能够根据用户的认知状态进行实时响应。

我先从背景开始。

我们的时间线展示了 BCI 的发展过程：从 1924 年 EEG 的早期研究，到 1973 年 BCI 概念正式提出，再到 1990 年代末的植入式研究，以及后来的消费级产品，如 EMOTIV 和 Muse。

这些产品证明了可穿戴 EEG 和实时反馈是可行的，但大多数仍停留在“监测”阶段。

我们的项目聚焦下一步：**自适应响应**。

第二，我们的设计基于**以人为中心**的方法。

我们识别了三个主要问题：

1. EEG 系统通常只能提供洞察，无法直接触发行动。
2. 智能环境仍然高度依赖手动控制或固定规则自动化。
3. 现有系统很少能对实时认知变化进行动态适配。

我们的目标用户包括学生和知识工作者、处于压力或疲劳状态的人群，以及对环境刺激较敏感的用户。

我们提供的价值是：提升专注与状态恢复，减少重复的手动调整，同时保留用户控制权。

第三，我们来看系统是如何工作的。

我们的**系统流程**包含五个步骤：

1. EEG 信号输入
2. 信号处理
3. 认知分析
4. 自适应环境控制
5. 评估与迭代

在实际运行中，我们通过可穿戴设备采集实时 EEG 数据，去除噪声和伪迹，提取脑波特征，识别如专注或压力等状态，再将这些状态映射为环境动作，例如调节灯光、声音或温度。

之后我们会评估效果，并持续优化阈值和控制逻辑。

我们还构建了一个**实时自适应控制演示模块**，让整个闭环过程可视化。

该演示展示了流程阶段、置信度分数、决策门控和输出动作，同时包含自动化状态、系统指标和手动接管状态。

这很重要，因为缺乏透明性的智能系统会降低用户信任。

这也引出了伦理问题。

我们明确关注四类伦理风险：

- 隐私
- 自主性
- 偏差
- 信任与安全

我们的应对策略包括：尽可能本地处理、最小化数据留存、人机协同控制，以及在不确定条件下的安全策略。

当信号置信度较低时，系统会转为保守模式或停止自动执行，并优先交还用户手动控制。

接下来谈团队能力。

我们的**团队能力矩阵**与**核心技术栈**展示了全流程角色覆盖：

- 信号处理
- 认知状态识别
- 自适应环境控制
- 交互式仪表盘设计
- 端到端系统集成

这种匹配非常关键，因为自适应 BCI 是跨学科挑战，每个阶段都依赖技术深度和以用户为中心的设计决策。

最后总结一下：

我们的项目将 BCI 从“被动反馈”推进到“主动且负责任的适配”。

预期成果是：更好的专注支持、更高的学习和工作效率，以及在日常环境中更低的认知负担。

最重要的是，我们希望在透明、安全、用户可控的前提下实现这一目标。

谢谢大家。
