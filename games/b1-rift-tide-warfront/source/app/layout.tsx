import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "裂潮戰線｜海陸即時戰爭原型",
  description: "原創多人海陸戰爭遊戲試玩原型。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "裂潮戰線｜海陸一圖 · 全域開戰",
    description: "揸住原創艦艇同未來戰車，搶奪能源核心。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "裂潮戰線海陸戰場" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "裂潮戰線｜海陸一圖 · 全域開戰",
    description: "原創多人海陸戰爭遊戲試玩原型。",
    images: ["/og.png"],
  },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="zh-Hant-HK"><body>{children}</body></html>;
}
