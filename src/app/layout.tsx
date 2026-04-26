import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '海盟会 | 多智能体视频生成平台',
    template: '%s | 海盟会',
  },
  description:
    '海盟会是一个多智能体协作的视频生成平台，支持 AI 视频创作、智能对话、财务管理等功能。',
  keywords: [
    '海盟会',
    'AI 视频生成',
    'Seedance',
    '智能体',
    '视频创作',
    '多智能体协作',
  ],
  authors: [{ name: 'HaiMengHui Team' }],
  generator: 'Coze Code',
  openGraph: {
    title: '海盟会 | 多智能体视频生成平台',
    description:
      '海盟会是一个多智能体协作的视频生成平台，支持 AI 视频创作、智能对话、财务管理等功能。',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        <AuthProvider>
          <AuthGuard>
            {isDev && <Inspector />}
            {children}
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
