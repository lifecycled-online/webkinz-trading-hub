import { createServer } from "node:http";
import pg from "pg";

const { Pool } = pg;
const port = Number(process.env.PORT ?? 3002);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set in backend/.env");
}

const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 5,
});

const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");

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
            console.error("Tiger Cloud database health check failed:", error.message);
            response.writeHead(503);
            response.end(JSON.stringify({ status: "error", database: "unavailable" }));
        }
        return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "127.0.0.1", () => {
    console.log(`Backend listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
    server.close();
    await pool.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);