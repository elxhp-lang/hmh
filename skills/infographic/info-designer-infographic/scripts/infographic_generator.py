#!/usr/bin/env python3
"""
信息图生成脚本 - 模块化生成和合并

功能：
1. 为每个模块生成独立图像（通过智能体的图像生成工具）
2. 合并多张模块图像为最终信息长图

使用方法：
python infographic_generator.py --config module_config.json --output final_infographic.png
"""

import argparse
import json
import os
from typing import Dict, List, Any

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("错误: 需要安装Pillow库")
    print("请运行: pip install Pillow")
    exit(1)


# 模块Prompt模板
MODULE_PROMPTS = {
    "brand-array": """A professional brand comparison infographic module for information design.

Style: Laboratory manual aesthetic with clean technical design.

Content: Brand matrix grid (3x3 or 4x4) showing multiple brand options. Highlight the best choice with vibrant fluorescent pink (#E91E63).

Color Palette:
- Background: Professional light gray with faint grid texture
- Grid lines: Ultra-fine dark charcoal
- Highlight: Vibrant fluorescent pink for the winner
- Text: Dark charcoal for labels

Layout: Grid layout with brand names and key specs. Minimal margins with technical annotations.

Typography: Bold headers for brand names, clean body text for specifications.

Image size: 800x600 pixels""",

    "specs-scale": """A technical specifications scale infographic module for information design.

Style: Laboratory manual aesthetic with precise technical design.

Content: Technical ruler or gauge showing parameter scale. Include numerical increments, markers, and comparison points (Standard vs Premium).

Color Palette:
- Background: Professional light gray with faint grid texture
- Scale: Muted sage green for main scale
- Markers: Vibrant fluorescent pink for critical points
- Highlights: Lemon yellow for key measurements
- Text: Dark charcoal for labels

Layout: Horizontal or vertical ruler with precise measurements. Include coordinate-style label (e.g., B-05).

Typography: Large highlighted numbers in yellow/blue, clean body text for descriptions.

Image size: 800x600 pixels""",

    "deep-dive": """A technical deep dive infographic module for information design.

Style: Laboratory manual aesthetic with exploded view.

Content: Technical sketch or exploded view of the subject. Include zoom-in callout circles showing internal components and details.

Color Palette:
- Background: Professional light gray with faint grid texture
- Drawing: Ultra-fine dark charcoal for technical lines
- Highlights: Vibrant fluorescent pink for callout circles
- Annotations: Lemon yellow for key labels
- Text: Dark charcoal for specifications

Layout: Central technical drawing with circular callouts pointing to specific features. Include anchor points and directional arrows.

Typography: Technical annotations in small crisp font, bold labels for major components.

Image size: 800x600 pixels""",

    "scenario-grid": """A scenario comparison grid infographic module for information design.

Style: Laboratory manual aesthetic with clean data comparison.

Content: Comparison cards showing different scenarios or use cases. Separated by fine hair-lines (0.5pt).

Color Palette:
- Background: Professional light gray with faint grid texture
- Cards: Muted sage green for card backgrounds
- Highlights: Vibrant fluorescent pink for recommended scenarios
- Dividers: Ultra-fine dark charcoal lines
- Text: Dark charcoal for content

Layout: Grid of comparison cards. Each card shows scenario name, key parameters, and pros/cons.

Typography: Bold headers for scenario names, clean body text for details.

Image size: 800x600 pixels""",

    "warning-zone": """A warning and pitfalls infographic module for information design.

Style: High-contrast warning zone with laboratory manual aesthetic.

Content: Critical warnings, pitfalls to avoid, and common mistakes. Use high-contrast design to grab attention.

Color Palette:
- Background: Vibrant fluorescent pink (#E91E63) for high alert
- Text: Black for maximum contrast
- Warnings: Black panels with white text for specific warnings
- Icons: Black warning symbols

Layout: High-contrast layout with warning icons, bullet points of pitfalls, and clear alert boxes. Include coordinate-style label (e.g., E-07).

Typography: Bold brutalist Chinese characters for warnings, clean text for details.

Image size: 800x600 pixels""",

    "quick-check": """A quick reference summary table infographic module for information design.

Style: Laboratory manual aesthetic resembling a lab data sheet.

Content: Dense summary table with key parameters, ratings, and quick reference data.

Color Palette:
- Background: Professional light gray with faint grid texture
- Table: Muted sage green for alternate rows
- Highlights: Lemon yellow for critical values
- Text: Dark charcoal for content

Layout: Dense table with columns for parameter, value, rating, and notes. Include row headers and summary statistics.

Typography: Clean tabular font, large highlighted numbers for key metrics.

Image size: 800x600 pixels""",

    "status-bar": """A status bar and metadata infographic module for information design.

Style: Laboratory manual aesthetic with information block stack.

Content: Status information, metadata, timestamps, technical parameters, and supplementary data.

Color Palette:
- Background: Professional light gray with faint grid texture
- Blocks: Muted sage green for information blocks
- Highlights: Lemon yellow for critical metadata
- Text: Dark charcoal for labels and values

Layout: Vertical or horizontal stack of information blocks. Include bar code patterns, timestamps, and technical parameters.

Typography: Small crisp font for metadata, bold headers for section titles.

Image size: 800x600 pixels"""
}


def generate_module_prompt(module: Dict[str, Any]) -> str:
    """
    为指定模块生成图像Prompt

    Args:
        module: 模块配置字典，包含 type, name, content 等字段

    Returns:
        完整的图像生成Prompt
    """
    module_type = module.get("type", "brand-array")
    module_name = module.get("name", "Module")
    module_content = module.get("content", "")

    base_prompt = MODULE_PROMPTS.get(module_type, MODULE_PROMPTS["brand-array"])

    # 在Prompt中添加模块特定内容
    specific_content = f"\n\nSpecific Content for {module_name}:\n{module_content}"

    final_prompt = base_prompt + specific_content

    return final_prompt


def merge_images(image_paths: List[str], output_path: str, spacing: int = 20,
                 background_color: tuple = (242, 242, 242)) -> None:
    """
    合并多张图像为长图

    Args:
        image_paths: 图像文件路径列表
        output_path: 输出图像路径
        spacing: 图像之间的间距（像素）
        background_color: 背景颜色（RGB）
    """
    if not image_paths:
        raise ValueError("没有图像需要合并")

    # 加载所有图像
    images = []
    max_width = 0
    total_height = 0

    for path in image_paths:
        if not os.path.exists(path):
            print(f"警告: 图像文件不存在: {path}")
            continue

        img = Image.open(path)
        images.append(img)

        if img.width > max_width:
            max_width = img.width

        total_height += img.height

    if not images:
        raise ValueError("没有有效的图像文件")

    # 计算最终高度（包括间距）
    total_height += spacing * (len(images) - 1)

    # 创建背景图像
    result = Image.new('RGB', (max_width, total_height), background_color)
    draw = ImageDraw.Draw(result)

    # 拼接图像
    y_offset = 0
    for i, img in enumerate(images):
        # 居中放置图像
        x_offset = (max_width - img.width) // 2
        result.paste(img, (x_offset, y_offset))

        # 添加分隔线（除了最后一张）
        if i < len(images) - 1:
            y_line = y_offset + img.height + spacing // 2
            draw.line([(0, y_line), (max_width, y_line)], fill=(200, 200, 200), width=2)

        y_offset += img.height + spacing

    # 保存结果
    result.save(output_path, quality=95)
    print(f"合并完成: {output_path}")
    print(f"最终尺寸: {max_width}x{total_height} 像素")


def main():
    parser = argparse.ArgumentParser(description='信息图生成脚本')
    parser.add_argument('--config', required=True, help='模块配置文件路径（JSON）')
    parser.add_argument('--output', required=True, help='输出图像路径')
    parser.add_argument('--images', help='模块图像文件路径列表（逗号分隔）')

    args = parser.parse_args()

    # 如果提供了图像路径，直接合并
    if args.images:
        image_paths = [path.strip() for path in args.images.split(',')]
        merge_images(image_paths, args.output)
        return

    # 否则读取配置并生成Prompt
    if not os.path.exists(args.config):
        raise FileNotFoundError(f"配置文件不存在: {args.config}")

    with open(args.config, 'r', encoding='utf-8') as f:
        config = json.load(f)

    print(f"加载配置: {config['title']}")
    print(f"模块数量: {len(config['modules'])}")

    # 生成每个模块的Prompt
    prompts = []
    for module in config['modules']:
        module_id = module['id']
        module_name = module['name']
        module_type = module['type']

        print(f"\n处理模块 {module_id}: {module_name} ({module_type})")

        prompt = generate_module_prompt(module)
        prompts.append({
            'id': module_id,
            'name': module_name,
            'prompt': prompt
        })

        print(f"  Prompt 长度: {len(prompt)} 字符")

    # 保存Prompts到文件（供智能体使用）
    prompts_file = args.output.replace('.png', '_prompts.json')
    with open(prompts_file, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, ensure_ascii=False, indent=2)

    print(f"\n已生成 {len(prompts)} 个模块Prompt")
    print(f"Prompts已保存到: {prompts_file}")
    print("\n下一步：使用智能体的图像生成工具为每个模块生成图像，然后使用 --images 参数合并")


if __name__ == '__main__':
    main()
