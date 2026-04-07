from PIL import Image, ImageDraw, ImageFont
import textwrap

# -------------------------- 基础设置（A4尺寸+300DPI）--------------------------
A4_WIDTH, A4_HEIGHT = 2480, 3508  # 300DPI标准A4像素
BG_COLOR = (255, 255, 255)        # 白底（适配手写）
BLACK = (0, 0, 0)                 # 主文字色
UQ_BLUE = (0, 76, 153)            # 昆士兰大学蓝（优秀设计区）
RED = (204, 0, 0)                 # 红色（糟糕设计区）
GREY = (180, 180, 180)            # 浅灰（辅助/提示文字）
LINE_WIDTH = 2                    # 边框/分割线宽度

# 创建空白A4画布
img = Image.new("RGB", (A4_WIDTH, A4_HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)


# -------------------------- 字体设置（兼容Windows/Mac/Linux）--------------------------
def get_font(font_size, is_bold=False):
    """获取字体，优先系统Arial，无则用默认字体"""
    try:
        if is_bold:
            # Windows/Arial
            return ImageFont.truetype("arialbd.ttf", font_size)
        else:
            return ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        try:
            # Linux/DejaVuSans
            return ImageFont.truetype(
                "DejaVuSans-Bold.ttf" if is_bold else "DejaVuSans.ttf", font_size
            )
        except Exception:
            # 兜底默认字体
            return ImageFont.load_default()


# 字体大小定义（层级分明，适配手写阅读）
title_font = get_font(65, is_bold=True)    # 大标题
sub_title_font = get_font(40)              # 副标题
h1_font = get_font(48, is_bold=True)       # 分区标题
h2_font = get_font(38, is_bold=True)       # 步骤标题
body_font = get_font(34)                   # 正文/要点
note_font = get_font(28)                   # 提示文字
small_font = get_font(26)                  # 小字备注


# -------------------------- 辅助函数：自动换行文字--------------------------
def draw_wrapped_text(x, y, text, font, max_chars=55, color=BLACK):
    """自动换行绘制文字，返回绘制后的y坐标，方便后续排版"""
    lines = textwrap.wrap(text, width=max_chars)
    y_pos = y
    line_height = (getattr(font, "size", 16) or 16) + 10  # 行间距
    for line in lines:
        draw.text((x, y_pos), line, font=font, fill=color)
        y_pos += line_height
    return y_pos


# -------------------------- 顶部标题区--------------------------
y = 50
# 课程代码
draw.text((60, y), "DECO1100 / DECO7110", font=title_font, fill=UQ_BLUE)
y += 75
# 主标题
draw.text((60, y), "Week 1 | Design Practice Core Activity", font=title_font, fill=BLACK)
y += 50
# 子标题（任务名）
draw.text((60, y), "Workbook Activity 1: What is Good Design?", font=sub_title_font, fill=GREY)
y += 40
# 顶部分割线
draw.line([(60, y), (A4_WIDTH - 60, y)], fill=GREY, width=LINE_WIDTH)
y += 60


# -------------------------- 双栏分割线（左右区：优秀/糟糕设计）--------------------------
COL_MID = A4_WIDTH // 2
draw.line([(COL_MID, 280), (COL_MID, A4_HEIGHT - 150)], fill=GREY, width=LINE_WIDTH)


# -------------------------- 左栏：✅ 优秀设计分析（Great Design）--------------------------
x_left = 70
y_left = y
# 分区标题
draw.text((x_left, y_left), "✅ GREAT DESIGN / INVENTION", font=h1_font, fill=UQ_BLUE)
y_left += 60

# 步骤1：识别并描述
draw.text((x_left, y_left), "1. Identify & Describe", font=h2_font, fill=BLACK)
y_left += 10
y_left = draw_wrapped_text(x_left, y_left, "• What is it? (Name + basic function)", body_font, color=BLACK)
y_left = draw_wrapped_text(x_left, y_left, "• Who is it made for? (Target users)", body_font, color=BLACK)
y_left += 40

# 步骤2：分析优秀原因
draw.text((x_left, y_left), "2. Explain Why It’s Great", font=h2_font, fill=BLACK)
y_left += 10
y_left = draw_wrapped_text(
    x_left,
    y_left,
    "What makes this design successful? Think about user needs, usability, functionality, or how it solves a real problem.",
    note_font,
    max_chars=50,
    color=GREY,
)
y_left += 10
draw.text((x_left, y_left), "→ Use dot points for clear reasoning", font=small_font, fill=UQ_BLUE)
y_left += 40

# 步骤3：手绘并标注
draw.text((x_left, y_left), "3. Sketch & Annotate", font=h2_font, fill=BLACK)
y_left += 10
y_left = draw_wrapped_text(
    x_left,
    y_left,
    "Draw a simple sketch (no perfect art needed!). Annotate key good features with arrows + short notes.",
    note_font,
    max_chars=50,
    color=GREY,
)
y_left += 30

# 左栏草图区（超大空白，适配手绘）
sketch_height_left = A4_HEIGHT - y_left - 200
draw.rectangle(
    [(x_left, y_left), (COL_MID - 40, y_left + sketch_height_left)],
    outline=BLACK,
    width=LINE_WIDTH,
)
draw.text((x_left + 20, y_left + 20), "SKETCH AREA", font=sub_title_font, fill=GREY)
draw.text((x_left + 20, y_left + 70), "→ Draw here + add good design annotations", font=note_font, fill=UQ_BLUE)


# -------------------------- 右栏：❌ 糟糕设计分析（Bad Design）--------------------------
x_right = COL_MID + 70
y_right = y
# 分区标题
draw.text((x_right, y_right), "❌ BAD DESIGN / INVENTION", font=h1_font, fill=RED)
y_right += 60

# 步骤1：识别并描述
draw.text((x_right, y_right), "1. Identify & Describe", font=h2_font, fill=BLACK)
y_right += 10
y_right = draw_wrapped_text(x_right, y_right, "• What is it? (Name + basic function)", body_font, color=BLACK)
y_right = draw_wrapped_text(x_right, y_right, "• Who is it made for? (Target users)", body_font, color=BLACK)
y_right += 40

# 步骤2：分析糟糕原因
draw.text((x_right, y_right), "2. Explain Why It’s Poor", font=h2_font, fill=BLACK)
y_right += 10
y_right = draw_wrapped_text(
    x_right,
    y_right,
    "What problems does this design have? Think about bad usability, unmet user needs, confusing functionality, or frustrating experience.",
    note_font,
    max_chars=50,
    color=GREY,
)
y_right += 10
draw.text((x_right, y_right), "→ Use dot points for clear reasoning", font=small_font, fill=RED)
y_right += 40

# 步骤3：手绘并标注
draw.text((x_right, y_right), "3. Sketch & Annotate", font=h2_font, fill=BLACK)
y_right += 10
y_right = draw_wrapped_text(
    x_right,
    y_right,
    "Draw a simple sketch. Annotate key flaws or problematic features with arrows + short notes explaining the issues.",
    note_font,
    max_chars=50,
    color=GREY,
)
y_right += 30

# 右栏草图区（超大空白，适配手绘）
sketch_height_right = A4_HEIGHT - y_right - 200
draw.rectangle(
    [(x_right, y_right), (A4_WIDTH - 70, y_right + sketch_height_right)],
    outline=BLACK,
    width=LINE_WIDTH,
)
draw.text((x_right + 20, y_right + 20), "SKETCH AREA", font=sub_title_font, fill=GREY)
draw.text((x_right + 20, y_right + 70), "→ Draw here + add bad design flaw annotations", font=note_font, fill=RED)


# -------------------------- 底部备注区--------------------------
footer_y = A4_HEIGHT - 130
# 底部分割线
draw.line([(60, footer_y), (A4_WIDTH - 60, footer_y)], fill=GREY, width=LINE_WIDTH)
footer_y += 20
# 课程提示（文档中的*标注）
footer_note = "* You can add photos to support your analysis | Sketching is great practice for future design tasks!"
draw_wrapped_text(60, footer_y, footer_note, small_font, max_chars=120, color=GREY)


# -------------------------- 保存图片（本地根目录）--------------------------
output_file = "UQ_Week1_Design_Practice_A4.png"
img.save(output_file, dpi=(300, 300), quality=100)
print(f"✅ A4模板图片生成成功！文件名为：{output_file}")
