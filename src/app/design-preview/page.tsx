import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const designs = [
  {
    id: "login",
    title: "登录页面",
    description: "极简科技风格登录页，左右分栏布局，左侧展示渐变科技图形，右侧放置登录卡片",
    image: "/design-previews/login-1775414547966.png",
    features: ["左右分栏布局", "深蓝渐变科技图形", "白色登录卡片", "极简设计语言"],
  },
  {
    id: "dashboard",
    title: "仪表盘页面",
    description: "仪表盘采用顶部导航栏+左侧深色侧边栏+右侧内容区布局，数据卡片组展示关键指标",
    image: "/design-previews/dashboard-1775414558135.png",
    features: ["全局导航栏", "深色侧边栏", "数据卡片组", "迷你折线图"],
  },
  {
    id: "video-generate",
    title: "视频生成页面",
    description: "三栏布局：左侧参数配置区 + 右侧预览区，深色预览背景突出视频内容",
    image: "/design-previews/video-generate-1775414580854.png",
    features: ["参数配置面板", "深色预览区", "进度条动画", "一键生成按钮"],
  },
  {
    id: "agent-chat",
    title: "智能体对话页面",
    description: "聊天界面采用左右布局，消息气泡区分用户与智能体，底部固定输入栏",
    image: "/design-previews/agent-chat-1775414593884.png",
    features: ["智能体列表", "消息气泡布局", "蓝色品牌色", "简洁交互"],
  },
];

export default function DesignPreviewPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">海盟会 - 设计效果图预览</h1>
              <p className="text-muted-foreground mt-1">火山引擎极简科技风格设计规范</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                v2.0
              </Badge>
              <Link href="/dashboard">
                <Button variant="outline">返回</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Design Specs */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-6 py-8">
          <h2 className="text-lg font-semibold mb-4">设计规范概览</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-2">主色调</div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-[#1E40AF]" />
                <div className="w-8 h-8 rounded-md bg-[#3B82F6]" />
              </div>
              <div className="text-xs text-muted-foreground mt-2">#1E40AF / #3B82F6</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-2">背景色</div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-[#F8FAFC] border" />
                <div className="w-8 h-8 rounded-md bg-[#0F172A]" />
              </div>
              <div className="text-xs text-muted-foreground mt-2">#F8FAFC / #0F172A</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-2">圆角</div>
              <div className="text-lg font-semibold">8-12px</div>
              <div className="text-xs text-muted-foreground mt-1">卡片12px / 按钮8px</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-2">风格</div>
              <div className="text-lg font-semibold">极简科技</div>
              <div className="text-xs text-muted-foreground mt-1">参考火山引擎官网</div>
            </div>
          </div>
        </div>
      </section>

      {/* Design Previews */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {designs.map((design) => (
            <Card key={design.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle>{design.title}</CardTitle>
                <CardDescription>{design.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-4">
                  <Image
                    src={design.image}
                    alt={design.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {design.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/api/design-generate">
            <Button variant="outline" size="lg">
              重新生成设计
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg">应用设计方案</Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>© 2025 海盟会 - 多智能体协作视频生成平台</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
