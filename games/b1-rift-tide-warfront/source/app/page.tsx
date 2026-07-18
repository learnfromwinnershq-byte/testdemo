import type { Metadata } from "next";
import GameClient from "./GameClient";

export const metadata: Metadata = {
  title: "裂潮戰線｜海陸即時戰爭原型",
  description: "原創海陸多人競技戰爭遊戲試玩原型：搶能源、升級單位、跨域作戰。",
};

export default function Home() {
  return <GameClient />;
}
