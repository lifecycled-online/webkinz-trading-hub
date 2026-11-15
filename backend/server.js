import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const port = Number(process.env.PORT ?? 3002);
const databaseUrl = process.env.DATABASE_URL;
const databaseConnectionUrl = databaseUrl ? new URL(databaseUrl) : null;
databaseConnectionUrl?.searchParams.delete("sslmode");
const oidcIssuer = new URL(process.env.OIDC_ISSUER_URL ?? "https://webkinz-trading-hub-dev.auth.ssojet.com/");
const validListTypes = new Set(["inventory", "wishlist"]);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = resolve(projectRoot, "frontend");
const dataRoot = resolve(projectRoot, "data");
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
const allowedOrigins = new Set((process.env.CORS_ORIGINS ?? "http://localhost:3001,http://127.0.0.1:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean));
let userInfoEndpointPromise;

if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set in backend/.env");
}

const pool = new Pool({
    connectionString: databaseConnectionUrl.toString(),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 5,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function getUserInfoEndpoint() {
    userInfoEndpointPromise ??= fetch(new URL(".well-known/openid-configuration", oidcIssuer))
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`OIDC discovery failed with status ${response.status}`);
            }

            const metadata = await response.json();
            const endpoint = new URL(metadata.userinfo_endpoint);
            if (metadata.issuer !== oidcIssuer.href || endpoint.protocol !== "https:") {
                throw new Error("OIDC discovery returned unexpected issuer metadata");
            }

            return endpoint;
        });

    return userInfoEndpointPromise;
}

async function authenticateRequest(request) {
    const authorization = request.headers.authorization;
    const match = typeof authorization === "string" && authorization.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) return null;

    const endpoint = await getUserInfoEndpoint();
    const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${match[1]}` },
    });
    if (!response.ok) return null;

    const profile = await response.json();
    return typeof profile.sub === "string" && profile.sub.length > 0
        ? { issuer: oidcIssuer.href, sub: profile.sub }
        : null;
}

const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");

    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
        response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
        response.writeHead(origin && !allowedOrigins.has(origin) ? 403 : 204);
        response.end();
        return;
    }

    if (request.method === "GET" && request.url === "/api/health") {
        response.writeHead(200);
        response.end(JSON.stringify({ status: "ok" }));
        return;
    }

    if (request.method === "GET" && request.url === "/api/health/db") {
        try {
            await pool.query("SELECT 1");
            response.writeHead(200);
            response.end(JSON.stringify({ status: "ok", database: "connected" }));
        } catch (error) {
            console.error("Tiger Cloud database health check failed:", error);
            response.writeHead(503);
            response.end(JSON.stringify({
                status: "error",
                database: "unavailable",
                detail: error instanceof Error ? error.message : String(error),
            }));
        }
        return;
    }

    if (request.method === "GET" && request.url === "/api/me") {
        try {
            const user = await authenticateRequest(request);
            if (!user) {
                response.writeHead(401);
                response.end(JSON.stringify({ error: "Authentication required" }));
                return;
            }

            response.writeHead(200);
            response.end(JSON.stringify({ user }));
        } catch (error) {
            console.error("OIDC identity check failed:", error.message);
            response.writeHead(503);
            response.end(JSON.stringify({ error: "Identity provider unavailable" }));
        }
        return;
    }

    const requestUrl = new URL(request.url, "http://127.0.0.1");
    if (requestUrl.pathname === "/api/me/lists" || requestUrl.pathname.startsWith("/api/me/lists/")) {
        try {
            const user = await authenticateRequest(request);
            if (!user) {
                response.writeHead(401);
                response.end(JSON.stringify({ error: "Authentication required" }));
                return;
            }

            if (request.method === "GET" && requestUrl.pathname === "/api/me/lists") {
                const result = await pool.query(
                    "SELECT list_type, item_id FROM public.user_item_list_entries WHERE issuer = $1 AND subject = $2",
                    [user.issuer, user.sub],
                );
                const lists = { inventory: [], wishlist: [] };
                for (const row of result.rows) {
                    lists[row.list_type].push(row.item_id);
                }

                response.writeHead(200);
                response.end(JSON.stringify(lists));
                return;
            }

            const match = requestUrl.pathname.match(/^\/api\/me\/lists\/([^/]+)\/([^/]+)$/);
            if (!match || !["PUT", "DELETE"].includes(request.method)) {
                response.writeHead(405);
                response.end(JSON.stringify({ error: "Method not allowed" }));
                return;
            }

            let listType;
            let itemId;
            try {
                listType = decodeURIComponent(match[1]);
                itemId = decodeURIComponent(match[2]);
            } catch {
                response.writeHead(400);
                response.end(JSON.stringify({ error: "Invalid list item" }));
                return;
            }

            if (!validListTypes.has(listType) || itemId.length < 1 || itemId.length > 200 || /[\u0000-\u001f]/.test(itemId)) {
                response.writeHead(400);
                response.end(JSON.stringify({ error: "Invalid list item" }));
                return;
            }

            if (request.method === "PUT") {
                await pool.query(
                    "INSERT INTO public.user_item_list_entries (issuer, subject, list_type, item_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
                    [user.issuer, user.sub, listType, itemId],
                );
            } else {
                await pool.query(
                    "DELETE FROM public.user_item_list_entries WHERE issuer = $1 AND subject = $2 AND list_type = $3 AND item_id = $4",
                    [user.issuer, user.sub, listType, itemId],
                );
            }

            response.writeHead(204);
            response.end();
        } catch (error) {
            console.error("User item list request failed:", error.message);
            response.writeHead(503);
            response.end(JSON.stringify({ error: "Item lists are unavailable" }));
        }
        return;
    }

    if (!["GET", "HEAD"].includes(request.method ?? "")) {
        response.writeHead(405);
        response.end();
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(requestUrl.pathname);
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

server.listen(port, "0.0.0.0", () => {
    console.log(`Backend listening on http://0.0.0.0:${port}`);
});

async function shutdown() {
    server.close();
    await pool.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);