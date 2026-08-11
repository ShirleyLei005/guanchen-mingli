import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "观辰 · 看见命盘中的线索，找回人生的主动权",
  description: "八字、紫微斗数与双人合盘。校准出生时空，以确定性排盘和可追溯依据理解趋势、课题与现实选择。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "观辰 · 看见命盘中的线索，找回人生的主动权",
    description: "先校准时空，再排盘解读。看见趋势，理解课题，主动选择。",
    images: [{ url: "/og-v2.png", width: 1200, height: 630, alt: "观辰：看见命盘中的线索，找回人生的主动权" }],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "观辰 · 看见命盘中的线索，找回人生的主动权",
    description: "先校准时空，再排盘解读。看见趋势，理解课题，主动选择。",
    images: ["/og-v2.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
