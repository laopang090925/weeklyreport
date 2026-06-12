import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '周报记录',
  description: '每日工作记录与周报生成',
  icons: { icon: '/favicon.jpg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
