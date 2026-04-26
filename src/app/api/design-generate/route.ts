import { NextRequest, NextResponse } from "next/server";
import { ImageGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import axios from "axios";
import fs from "fs";
import path from "path";

const WORKSPACE_PATH = process.env.COZE_WORKSPACE_PATH || "/workspace/projects";

export async function POST(request: NextRequest) {
  try {
    const { prompts, saveToPublic = true } = await request.json();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    const results = [];

    for (const promptData of prompts) {
      try {
        console.log(`Generating image for: ${promptData.page}`);

        const response = await client.generate({
          prompt: promptData.prompt,
          size: "2K",
          watermark: false
        });

        const helper = client.getResponseHelper(response);

        if (helper.success && helper.imageUrls[0]) {
          let savedPath = "";

          if (saveToPublic) {
            // 下载并保存图片
            const publicDir = path.join(WORKSPACE_PATH, "public", "design-previews");
            if (!fs.existsSync(publicDir)) {
              fs.mkdirSync(publicDir, { recursive: true });
            }

            const timestamp = Date.now();
            const fileName = `${promptData.page.replace(/\s+/g, "-")}-${timestamp}.png`;
            const filePath = path.join(publicDir, fileName);

            const imageResponse = await axios.get(helper.imageUrls[0], {
              responseType: "arraybuffer"
            });
            fs.writeFileSync(filePath, imageResponse.data);

            savedPath = `/design-previews/${fileName}`;
          }

          results.push({
            page: promptData.page,
            description: promptData.description,
            imageUrl: helper.imageUrls[0],
            savedPath,
            success: true
          });
        } else {
          results.push({
            page: promptData.page,
            error: helper.errorMessages.join(", "),
            success: false
          });
        }
      } catch (err) {
        results.push({
          page: promptData.page,
          error: err instanceof Error ? err.message : "未知错误",
          success: false
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Design generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
