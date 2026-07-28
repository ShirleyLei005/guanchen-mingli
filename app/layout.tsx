import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "观辰 · 读懂命盘，不把人生交给命盘",
  description: "八字、紫微斗数与合盘分析。自动匹配出生地经纬度与历史时区，校正真太阳时，从趋势中看见人生课题。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "观辰 · 读懂命盘，不把人生交给命盘",
    description: "看见趋势，理解课题，主动选择。八字与紫微斗数真太阳时排盘。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "观辰命理网站" }],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "观辰 · 读懂命盘，不把人生交给命盘",
    description: "看见趋势，理解课题，主动选择。八字与紫微斗数真太阳时排盘。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
