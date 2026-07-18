import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "裂潮戰線｜俯視即時海戰原型",
  description: "Mk48 式多人海戰試玩原型，加入戰場粵語對話，俾小朋友邊玩邊學。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "裂潮戰線｜揸一艘艦 · 食箱升級",
    description: "揸住原創艦種出海，食補給箱、開雷達、擊沉對手，順手學粵語現場講法。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "裂潮戰線俯視海戰" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "裂潮戰線｜揸一艘艦 · 食箱升級",
    description: "Mk48 式多人海戰試玩原型，加入戰場粵語對話。",
    images: ["/og.png"],
  },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="zh-Hant-HK"><body>{children}</body></html>;
}
