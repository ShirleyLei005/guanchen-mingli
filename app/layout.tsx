import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "观辰 · 解码东方智慧，洞见人生起伏",
  description: "以八字观人生格局，以紫微察十二宫垣。循古法排盘，取今意解读，知命而行，不囿于命。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "观辰 · 解码东方智慧，洞见人生起伏",
    description: "观天时，察人事，知进退。知命而行，不囿于命。",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "观辰 · 解码东方智慧，洞见人生起伏",
    description: "观天时，察人事，知进退。知命而行，不囿于命。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
