import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Cantonese Rift Tide Warfront prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-Hant-HK">/i);
  assert.match(html, /<title>裂潮戰線｜俯視即時海戰原型<\/title>/i);
  assert.match(html, /Mk48 式俯視海戰原型/);
  assert.match(html, /刃鰭巡邏艇/);
  assert.match(html, /揀出擊艦種/);
  assert.match(html, /即刻出海/);
  assert.match(html, /戰場粵語/);
  assert.match(html, /滑鼠指向航行/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps the complete Traditional Chinese product source and assets", async () => {
  const [gameClient, layout, gdd] = await Promise.all([
    readFile(new URL("../app/GameClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/RIFT-TIDE-GDD.md", import.meta.url), "utf8"),
  ]);

  assert.match(gameClient, /const SHIPS/);
  assert.match(gameClient, /赤潮聯隊/);
  assert.match(gameClient, /藍穹同盟/);
  assert.match(gameClient, /PHRASES/);
  assert.match(gameClient, /開船喇，望實雷達/);
  assert.match(gameClient, /瞄準先，唔好亂射/);
  assert.match(gameClient, /onContextMenu/);
  assert.match(gameClient, /右鍵/);
  assert.match(gameClient, /撳 Enter 傳送訊息/);
  assert.match(layout, /裂潮戰線｜俯視即時海戰原型/);
  assert.match(layout, /zh-Hant-HK/);
  assert.match(layout, /og\.png/);
  assert.match(gdd, /## 19\. 風險與治理/);
  assert.match(gdd, /Mk48 式俯視即時海戰/);
  assert.ok(gdd.split("\n").length >= 120);

  await Promise.all([
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/favicon.svg", import.meta.url)),
    access(new URL("../.openai/hosting.json", import.meta.url)),
  ]);
});
