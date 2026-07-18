import type { Metadata } from "next";
import GameClient from "./GameClient";

export const metadata: Metadata = {
  title: "裂潮戰線｜俯視即時海戰原型",
  description: "Mk48 式多人海戰試玩原型：揸單艦、食補給箱、用雷達搵敵，並透過戰場粵語對話邊玩邊學。",
};

export default function Home() {
  return <GameClient />;
}
