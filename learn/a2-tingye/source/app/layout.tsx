import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "家长安心准备，孩子专心聆听的家庭粤语听书空间。";

  return {
    title: "听叶 · 家庭粤语听书",
    description,
    applicationName: "听叶",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "听叶", statusBarStyle: "black-translucent" },
    icons: { icon: "/app-icon.png", apple: "/app-icon.png" },
    openGraph: {
      title: "听叶 · 家庭粤语听书",
      description,
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "听叶家庭粤语听书" }],
    },
    twitter: { card: "summary_large_image", title: "听叶 · 家庭粤语听书", description, images: [`${origin}/og.png`] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102f43",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hans"><body>{children}</body></html>;
}
