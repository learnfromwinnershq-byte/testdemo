import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const runtimeFiles = new Map([
  ["virtual:a2-book-data", { id: "\0a2-runtime-book", path: "books/white-paper/book.json" }],
  ["virtual:a2-audio-manifest", { id: "\0a2-runtime-audio", path: "books/white-paper/audio/manifest.json" }],
]);

function privateBookRuntime(): Plugin {
  return {
    name: "a2-private-book-runtime",
    enforce: "pre",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith("/app/ListeningApp.tsx")) return null;
      return code
        .replace('"../public/books/white-paper/book.json"', '"virtual:a2-book-data"')
        .replace('"../public/books/white-paper/audio/manifest.json"', '"virtual:a2-audio-manifest"');
    },
    resolveId(source) {
      const runtimeFile = runtimeFiles.get(source);
      if (runtimeFile) return runtimeFile.id;
      return null;
    },
    load(id) {
      const runtimeFile = [...runtimeFiles.values()].find((candidate) => candidate.id === id);
      if (!runtimeFile) return null;
      return `
        const response = await fetch(import.meta.env.BASE_URL + ${JSON.stringify(runtimeFile.path)}, { cache: "no-store" });
        if (!response.ok) throw new Error("家庭书籍数据尚未挂载：" + response.status);
        export default await response.json();
      `;
    },
  };
}

export default defineConfig({
  root: "static",
  base: "/learn/a2-tingye/",
  publicDir: "../static-public",
  plugins: [privateBookRuntime(), react()],
  build: {
    outDir: "../static-dist",
    emptyOutDir: true,
    target: "esnext",
  },
});
