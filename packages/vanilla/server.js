import express from "express";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prod = process.env.NODE_ENV === "production";
const port = process.env.PORT || 5173;
const base = process.env.BASE || (prod ? "/front_7th_chapter4-1/vanilla/" : "/");

async function createServer() {
  const app = express();

  // HTML 템플릿과 render 함수 변수
  let template;
  let render;

  if (!prod) {
    // ============================================
    // 개발 환경: Vite dev server 사용
    // ============================================
    const { createServer: createViteServer } = await import("vite");

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
      base,
    });

    // Vite 미들웨어 사용
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      const url = req.originalUrl.replace(base, "/");

      try {
        // 1. index.html 읽기
        template = await fs.readFile(resolve(__dirname, "index.html"), "utf-8");

        // 2. Vite HTML 변환 적용 (HMR 클라이언트 주입 등)
        template = await vite.transformIndexHtml(url, template);

        // 3. SSR 모듈 로드 (매 요청마다 최신 코드 반영)
        const ssrModule = await vite.ssrLoadModule("/src/main-server.js");
        render = ssrModule.render;

        // 4. 렌더링 실행
        const { html: appHtml, head, initialData } = await render(url);

        // 5. initialData 스크립트 생성
        const initialDataScript = `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};</script>`;

        // 6. 템플릿 치환
        const finalHtml = template
          .replace("<!--app-head-->", head)
          .replace("<!--app-html-->", appHtml)
          .replace("</head>", `${initialDataScript}</head>`);

        // 7. 응답
        res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
      } catch (e) {
        // Vite 에러 처리
        vite.ssrFixStacktrace(e);
        console.error(e);
        next(e);
      }
    });
  } else {
    // ============================================
    // 프로덕션 환경: 빌드된 파일 사용
    // ============================================
    const compression = (await import("compression")).default;
    const sirv = (await import("sirv")).default;

    // gzip 압축
    app.use(compression());

    // 정적 파일 서빙 (dist/vanilla)
    app.use(base, sirv(resolve(__dirname, "dist/vanilla"), { extensions: [] }));

    // HTML 템플릿 미리 로드
    template = await fs.readFile(resolve(__dirname, "dist/vanilla/index.html"), "utf-8");

    // SSR 모듈 로드
    const ssrModule = await import(resolve(__dirname, "dist/vanilla-ssr/main-server.js"));
    render = ssrModule.render;

    app.use(async (req, res, next) => {
      const url = req.originalUrl.replace(base, "/");

      try {
        // 1. 렌더링 실행
        const { html: appHtml, head, initialData } = await render(url);

        // 2. initialData 스크립트 생성
        const initialDataScript = `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};</script>`;

        // 3. 템플릿 치환
        const finalHtml = template
          .replace("<!--app-head-->", head)
          .replace("<!--app-html-->", appHtml)
          .replace("</head>", `${initialDataScript}</head>`);

        // 4. 응답
        res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
      } catch (e) {
        console.error(e);
        next(e);
      }
    });
  }

  // 서버 시작
  app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
    console.log(`Environment: ${prod ? "production" : "development"}`);
  });
}

createServer();
