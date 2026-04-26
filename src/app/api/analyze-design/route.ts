import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { imagePath } = await request.json();
    
    // 读取图片文件
    const fullPath = path.join(process.cwd(), 'public', imagePath);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString("base64");
    const dataUri = `data:image/png;base64,${base64Image}`;

    const config = new Config();
    const client = new LLMClient(config);

    const messages: Array<{ role: "user" | "system" | "assistant"; content: Array<{ type: "text" | "image_url" | "video_url"; text?: string; image_url?: { url: string; detail?: "high" | "low" } }> }> = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `请详细分析这张UI设计图，从以下维度进行描述：

1. **整体布局结构**
   - 页面的分栏方式（左右/上下分栏比例）
   - 主要区域划分和功能定位
   - 元素的空间分布

2. **视觉层次与重点**
   - 页面的第一视觉焦点在哪里
   - 主要内容和次要内容的区分方式
   - 视觉引导路径

3. **核心UI元素**
   - 卡片样式（圆角大小、阴影效果、背景色）
   - 按钮样式（形状、颜色、大小）
   - 输入框样式
   - 图标使用方式

4. **配色方案**
   - 主色调和辅助色
   - 背景色和前景色搭配
   - 强调色的使用位置

5. **交互设计**
   - 用户操作流程
   - 关键交互元素的位置
   - 状态提示方式

请用结构化的方式输出，方便开发实现。`,
          },
          {
            type: "image_url" as const,
            image_url: {
              url: dataUri,
              detail: "high" as const,
            },
          },
        ],
      },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-1-6-vision-250815",
      temperature: 0.3,
    });

    return NextResponse.json({ analysis: response.content });
  } catch (error) {
    console.error("分析设计图片失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "分析失败" },
      { status: 500 }
    );
  }
}
