import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("A2 root element is missing");

const root = createRoot(rootElement);
root.render(<main className="runtime-loading"><strong>正在打开听叶…</strong><span>正在读取家庭书架</span></main>);

void import("../app/ListeningApp")
  .then(({ ListeningApp }) => {
    root.render(<StrictMode><ListeningApp /></StrictMode>);
  })
  .catch(() => {
    root.render(
      <main className="runtime-loading error">
        <strong>家庭书籍暂时无法读取</strong>
        <span>请确认 A2 私有书籍目录已经挂载，然后重新载入。</span>
        <button onClick={() => window.location.reload()}>重新载入</button>
      </main>,
    );
  });
