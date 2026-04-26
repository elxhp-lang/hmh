import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { action, prompt, imageUrl } = await request.json();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    if (action === "analyze_reference") {
      // 分析参考图片（如火山引擎官网截图）
      const messages: Array<{ role: "user" | "system" | "assistant"; content: string | Array<{ type: "text" | "image_url" | "video_url"; text?: string; image_url?: { url: string; detail?: "high" | "low" } }> }> = [
        {
          role: "system" as const,
          content: `你是一位资深UI/UX设计专家，专注于极简科技风格的设计。请从以下维度分析图片的设计特征：
1. 色彩方案：主色、辅助色、背景色、强调色（请提供具体的Hex色值）
2. 字体风格：标题字体、正文字体的特征（粗细、大小对比）
3. 布局结构：间距比例、网格系统、视觉层级
4. 组件风格：卡片、按钮、输入框的圆角、阴影、边框特征
5. 图形元素：图标风格、装饰元素、背景纹理
6. 交互暗示：悬停效果、过渡动画的设计语言

请以JSON格式输出分析结果，包含具体的数值和建议。`
        },
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "请分析这张设计参考图，提取可复用的设计规范：" },
            {
              type: "image_url" as const,
              image_url: { url: imageUrl, detail: "high" as const }
            }
          ]
        }
      ];

      const response = await client.invoke(messages, {
        model: "doubao-seed-1-6-vision-250815",
        temperature: 0.3
      });

      return NextResponse.json({ analysis: response.content });
    }

    if (action === "generate_design_spec") {
      // 根据需求生成详细的设计规范
      const messages: Array<{ role: "user" | "system" | "assistant"; content: string }> = [
        {
          role: "system" as const,
          content: `你是一位资深UI/UX设计专家，请根据以下约束条件生成详细的设计规范：

## 项目背景
海盟会是一个多智能体协作的视频生成平台，需要体现专业、科技、智能的品牌形象。

## 设计约束
1. 参考火山引擎官网的极简科技风格
2. 主色调使用深蓝色系（#1E40AF / #3B82F6）
3. 浅色背景必须使用深色字体，深色背景必须使用浅色字体
4. 必须集成公司Logo

## 输出格式
请以JSON格式输出设计规范，包含：
1. colorPalette: 色彩方案（primary, secondary, background, foreground, muted, accent等）
2. typography: 字体规范（标题、正文、代码的字体、大小、粗细）
3. spacing: 间距系统（页面边距、组件间距、内边距）
4. borderRadius: 圆角规范
5. shadows: 阴影规范
6. components: 关键组件的样式规范（按钮、卡片、输入框、导航栏等）

每个规范请提供具体的CSS变量名和值。`
        },
        {
          role: "user" as const,
          content: prompt
        }
      ];

      const response = await client.invoke(messages, {
        model: "doubao-seed-2-0-pro-260215",
        temperature: 0.7,
        thinking: "enabled"
      });

      return NextResponse.json({ designSpec: response.content });
    }

    if (action === "generate_image_prompts") {
      // 根据设计规范生成图像生成的prompt
      const messages: Array<{ role: "user" | "system" | "assistant"; content: string }> = [
        {
          role: "system" as const,
          content: `你是一位UI设计专家，擅长将设计规范转化为精确的图像生成提示词。

请根据提供的设计规范，为海盟会平台的以下页面生成图像生成提示词：
1. 登录页面
2. 仪表盘页面
3. 视频生成页面
4. 智能体对话页面

每个提示词需要：
- 描述完整的页面布局
- 指定具体的颜色（使用Hex值）
- 说明字体风格和大小
- 描述组件样式（圆角、阴影等）
- 体现极简科技感

输出格式为JSON数组，每个元素包含：
- page: 页面名称
- prompt: 英文图像生成提示词
- description: 中文设计说明`
        },
        {
          role: "user" as const,
          content: prompt
        }
      ];

      const response = await client.invoke(messages, {
        model: "doubao-seed-2-0-pro-260215",
        temperature: 0.8
      });

      return NextResponse.json({ prompts: response.content });
    }

    return NextResponse.json({ error: "无效的操作" }, { status: 400 });
  } catch (error) {
    console.error("Design consultation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
