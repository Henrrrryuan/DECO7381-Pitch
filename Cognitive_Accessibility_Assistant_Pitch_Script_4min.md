# DECO3801/7381 Team Pitch — 4 分钟演讲稿

## 一、和评分标准的对应（为什么这样写）

根据课程 PDF，Team Pitch 主要看三点：

| 维度 | 要求 | 稿子里怎么体现 |
|------|------|----------------|
| **Depth of Argument** | 对问题有清晰、有研究支撑的理解，不只会复述 brief | 先讲「现有工具做技术无障碍、认知无障碍缺位」，再点出 WAVE/axe 等对比，说明我们做过调研。 |
| **Justification** | 方案有理由、和团队技能匹配 | 讲四个分析维度 + Dashboard + 评估（NASA-TLX 等），并明确对应 Ruilong / Zezhi / Yanya / Yali / Daitian 的分工。 |
| **Communication** | 逻辑清楚、好懂、能解释决策和取舍 | 结构：问题 → 我们做什么 → 为什么我们能做 → 流程 → 伦理 → 收尾；用语口语、短句。 |

4 分钟约 **480–520 个英文词**（按每分钟 120 词算），下面稿子控制在这个范围，便于现场讲完。

---

## 二、4 分钟英文演讲稿（口语化、通俗）

**开场（约 30 秒）**

Hi, we’re team Six Minus One. We’re pitching the **Cognitive Accessibility Assistant for Web Content** as one of our preferred projects. In the next few minutes we’ll cover the problem we see, what we want to build, and why our team is a good fit.

---

**问题与调研（约 45 秒）**

A lot of accessibility tools already do a good job on **technical** issues—things like colour contrast, alt text, keyboard navigation. Tools like WAVE, axe DevTools, and Accessibility Insights are strong there. But when we looked at the research and at real users, we found a gap: **cognitive accessibility** is much less supported. Many people—including neurodivergent users, or people with dyslexia or ADHD—struggle with dense text, cluttered layouts, too much animation, or confusing navigation. Existing tools don’t really analyse that. So we’re not just restating the brief; we’re saying: the problem isn’t only “does it pass WCAG,” it’s “does it respect cognitive load and different ways of thinking.” That’s the space we want to work in.

---

**我们要做什么（约 1 分钟）**

We want to build an assistant that analyses a webpage across **four dimensions**: language complexity, layout and visual hierarchy, animation and media, and interaction complexity. For each dimension we’ll give a risk level and clear, actionable recommendations—aligned with WCAG and ISO 9241-11 where relevant. The output is an **interactive dashboard**: designers can see before-and-after risk, switch between dimensions, and read why we flagged something and what to do about it. We also want to build in **evaluation**: controlled comparison, NASA-TLX for perceived workload, task completion metrics, and a simple report so teams can show that applying our recommendations actually improves outcomes. We’re aiming for something that works on a URL or uploaded HTML, with no need to collect user data for the core analysis.

---

**为什么我们团队能做好（约 45 秒）**

We’ve thought about how this maps to our skills. **Ruilong** brings HCI and standards—WCAG and ISO—so we can keep the tool grounded in accessibility guidelines and ethics. **Zezhi** will own the backend: scraping and parsing with Python and BeautifulSoup, plus readability and rule-based scoring so we can turn raw content into structured inputs for the four dimensions. **Yanya** will handle metrics, visualisation, and evaluation—ECharts, NASA-TLX, and the stats behind the dashboard. **Yali** will own the product and UI/UX—making the dashboard low-clutter and cognitively friendly itself. **Daitian** will drive the frontend and testing—React, the recommendation UI, and making sure the prototype is stable and testable. So we’re not just “five people who want to do a project”; we have a clear split that covers extraction, analysis, visualisation, design, and evaluation.

---

**系统流程（约 25 秒）**

The flow is straightforward: **input**—URL or HTML; **extract**—text, structure, media, interaction; **analyse**—readability and rule-based scoring, cognitive load indicators, mapping to standards; **output**—dashboard and recommendations; and **evaluate**—before/after comparison and validation. We’ve put this in our SoW and system diagram so the teaching team can see we’ve thought through the pipeline.

---

**伦理（约 20 秒）**

We’re not building something that replaces designer judgment. The tool **supports** decisions: it highlights where cognitive load might be high and suggests changes, but humans decide what to implement. We’re also careful about over-simplification—we don’t want to strip out important content—and we want the tool to explain *why* it flags something and how recommendations are generated, so it’s transparent and supports inclusive design rather than one-size-fits-all.

---

**收尾（约 15 秒）**

So in short: we see a real gap in cognitive accessibility, we’ve proposed a concrete set of features and an evaluation plan, and our team’s skills line up with the work. We’re confident we can deliver this prototype within the semester and would be a strong fit for this brief. Thanks—we’re happy to take questions.

---

## 三、时间分配建议（总计约 4 分钟）

| 段落       | 内容           | 建议时间 |
|------------|----------------|----------|
| 开场       | 团队 + 项目名  | ~30 s    |
| 问题与调研 | Gap + 现有工具  | ~45 s    |
| 方案       | 四维度 + 输出 + 评估 | ~60 s |
| 团队匹配   | 五人分工       | ~45 s    |
| 系统流程   | 五步流程       | ~25 s    |
| 伦理       | 立场与边界     | ~20 s    |
| 收尾       | 总结 + 致谢    | ~15 s    |

**合计约 4 分钟**；若现场略快或略慢，可微调「方案」或「团队匹配」段落的细节程度。

---

## 四、演示时的小建议

1. **谁讲哪段**：可以按人分工（例如一人讲问题、一人讲方案、一人讲团队与流程、一人讲伦理+收尾），或两人交替，避免一个人连续讲太久。
2. **对着幻灯片**：讲「问题」时指 Research / 现有工具对比表；讲「方案」时指 Core Functions 和 Dashboard；讲「团队」时指 Team capability matching；讲「流程」时指 System Workflow；讲「伦理」时指 Ethical considerations。
3. **Q&A**：老师常会问「和 WAVE/axe 具体有什么不同」「NASA-TLX 怎么用」「时间线/优先级」。可以提前准备一两句：我们补的是**认知维度**；NASA-TLX 用在优化前后对比；优先做分析+Dashboard，评估模块先做简化版。
4. **口语化**：现场不必照念；用短句、自然停顿，把关键词（cognitive accessibility, four dimensions, dashboard, NASA-TLX, team fit）讲清楚即可。

如果你把「我们实际选的 2–3 个 preferred projects」或「老师给的具体 brief 原文」发给我，我可以把稿子改成「多项目版」或更贴某一条 brief 的表述。
