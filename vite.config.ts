import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const coopCoepHeaders =
  process.env.ENABLE_COOP_COEP === "true"
    ? {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      }
    : undefined;

function binaryDownloadsPlugin(): Plugin {
  const mimeMap: Record<string, string> = {
    "/WHATIF.apk": "application/vnd.android.package-archive",
    "/WHATIF-github-export.zip": "application/zip",
  };

  const handleRequest = (
    reqUrl: string | undefined,
    res: {
      statusCode: number;
      setHeader: (name: string, value: string | number) => void;
    } & NodeJS.WritableStream,
    next: () => void,
    rootDir: string
  ) => {
    const cleanUrl = (reqUrl ?? "").split("?")[0];
    const mimeType = mimeMap[cleanUrl];
    if (!mimeType) {
      next();
      return;
    }

    const fileName = cleanUrl.slice(1);
    const candidate = path.resolve(rootDir, fileName);
    if (!fs.existsSync(candidate)) {
      next();
      return;
    }

    const stat = fs.statSync(candidate);
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(candidate).pipe(res);
  };

  return {
    name: "whatif-binary-downloads",
    configureServer(server) {
      server.middlewares.use((req, res, next) =>
        handleRequest(req.url, res, next, path.resolve(process.cwd(), "public"))
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) =>
        handleRequest(req.url, res, next, path.resolve(process.cwd(), "dist"))
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), binaryDownloadsPlugin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    headers: coopCoepHeaders,
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
});
