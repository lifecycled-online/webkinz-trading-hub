import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = resolve(projectRoot, "frontend");
const dataRoot = resolve(projectRoot, "data");
const port = Number(process.env.FRONTEND_PORT ?? 3001);
const contentTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpeg", "image/jpeg"],
    [".jpg", "image/jpeg"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".webp", "image/webp"],
]);

const server = createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method ?? "")) {
        response.writeHead(405);
        response.end();
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    } catch {
        response.writeHead(400);
        response.end();
        return;
    }

    const servesData = pathname.startsWith("/data/");
    const root = servesData ? dataRoot : frontendRoot;
    const relativePath = servesData
        ? pathname.slice("/data/".length)
        : pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
        response.writeHead(404);
        response.end();
        return;
    }

    try {
        const fileInfo = await stat(filePath);
        if (!fileInfo.isFile()) throw new Error("Not a file");
        response.setHeader("Content-Type", contentTypes.get(extname(filePath)) ?? "application/octet-stream");
        response.writeHead(200);
        if (request.method === "HEAD") response.end();
        else createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404);
        response.end("Not found");
    }
});

server.listen(port, "127.0.0.1", () => {
    console.log(`Frontend listening on http://127.0.0.1:${port}`);
});