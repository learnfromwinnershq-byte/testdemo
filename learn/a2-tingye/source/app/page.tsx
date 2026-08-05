import type { Metadata } from "next";
import { ListeningApp } from "./ListeningApp";

export const metadata: Metadata = {
  title: "听叶 · 家庭粤语听书",
  description: "家长安心准备，孩子专心聆听的家庭粤语听书空间。",
};

export default function Home() {
  return <ListeningApp />;
}
