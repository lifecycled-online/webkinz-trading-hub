import { createHash } from "node:crypto";
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
const validContactMethods = new Set(["discord", "email", "other"]);
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
const allowedOrigins = new Set([
    "https://lifecycled-online.github.io",
    ...(process.env.CORS_ORIGINS ?? "http://localhost:3001,http://127.0.0.1:3001").split(","),
].map((origin) => origin.trim()).filter(Boolean));
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

function getTraderId(subject) {
    return createHash("sha256").update(subject).digest("hex");
}

async function readJsonBody(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 20000) throw Object.assign(new Error("Request body is too large"), { status: 413 });
        chunks.push(chunk);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
    }
}

function parseTradeItemIds(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
    if (value.some((itemId) => typeof itemId !== "string" || itemId.length < 1 || itemId.length > 200 || /[\u0000-\u001f]/.test(itemId))) {
        return null;
    }

    return new Set(value);
}

async function validateTradeItems(client, issuer, sender, recipient, offeringItems, requestingItems) {
    const result = await client.query(
        `SELECT subject, list_type, item_id
         FROM public.user_item_list_entries
         WHERE issuer = $1
           AND (
               (subject = $2 AND list_type = 'inventory' AND item_id = ANY($3::text[])) OR
               (subject = $4 AND list_type = 'wishlist' AND item_id = ANY($3::text[])) OR
               (subject = $4 AND list_type = 'inventory' AND item_id = ANY($5::text[])) OR
               (subject = $2 AND list_type = 'wishlist' AND item_id = ANY($5::text[]))
           )
         FOR SHARE`,
        [issuer, sender, [...offeringItems], recipient, [...requestingItems]],
    );
    const presentItems = new Set(result.rows.map((row) => `${row.subject}\u0000${row.list_type}\u0000${row.item_id}`));
    const hasEveryItem = (subject, listType, itemIds) => [...itemIds].every((itemId) => presentItems.has(`${subject}\u0000${listType}\u0000${itemId}`));

    return hasEveryItem(sender, "inventory", offeringItems)
        && hasEveryItem(recipient, "wishlist", offeringItems)
        && hasEveryItem(recipient, "inventory", requestingItems)
        && hasEveryItem(sender, "wishlist", requestingItems);
}

const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");

    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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

    if (request.method === "GET" && request.url === "/api/me/matches") {
        try {
            const user = await authenticateRequest(request);
            if (!user) {
                response.writeHead(401);
                response.end(JSON.stringify({ error: "Authentication required" }));
                return;
            }

            const result = await pool.query(
                                `WITH match_items AS (
                                         SELECT other.subject, 'they_want' AS match_type, mine.item_id
                                         FROM public.user_item_list_entries AS mine
                                         JOIN public.user_item_list_entries AS other
                                             ON other.issuer = mine.issuer
                                            AND other.list_type = 'wishlist'
                                            AND other.item_id = mine.item_id
                                         WHERE mine.issuer = $1
                                             AND mine.subject = $2
                                             AND mine.list_type = 'inventory'
                                             AND other.subject <> $2
                                         UNION
                                         SELECT other.subject, 'you_want' AS match_type, other.item_id
                                         FROM public.user_item_list_entries AS mine
                                         JOIN public.user_item_list_entries AS other
                                             ON other.issuer = mine.issuer
                                            AND other.list_type = 'inventory'
                                            AND other.item_id = mine.item_id
                                         WHERE mine.issuer = $1
                                             AND mine.subject = $2
                                             AND mine.list_type = 'wishlist'
                                             AND other.subject <> $2
                                 ), reciprocal_traders AS (
                                         SELECT subject
                                         FROM match_items
                                         GROUP BY subject
                                         HAVING COUNT(DISTINCT match_type) = 2
                                 )
                                 SELECT match_items.subject, match_items.match_type, match_items.item_id
                                 FROM match_items
                                 JOIN reciprocal_traders USING (subject)
                                 ORDER BY match_items.subject, match_items.match_type, match_items.item_id`,
                [user.issuer, user.sub],
            );
            const matchesBySubject = new Map();
            for (const row of result.rows) {
                let match = matchesBySubject.get(row.subject);
                if (!match) {
                    match = {
                        traderId: getTraderId(row.subject),
                        trader: `Trader ${getTraderId(row.subject).slice(0, 12).toUpperCase()}`,
                        itemsTheyWant: [],
                        itemsYouWant: [],
                    };
                    matchesBySubject.set(row.subject, match);
                }

                const itemIds = row.match_type === "they_want" ? match.itemsTheyWant : match.itemsYouWant;
                itemIds.push(row.item_id);
            }

            response.writeHead(200);
            response.end(JSON.stringify({ matches: [...matchesBySubject.values()] }));
        } catch (error) {
            console.error("User matches request failed:", error.message);
            response.writeHead(503);
            response.end(JSON.stringify({ error: "Matches are unavailable" }));
        }
        return;
    }

    if (request.method === "GET" && request.url === "/api/me/offers") {
        try {
            const user = await authenticateRequest(request);
            if (!user) {
                response.writeHead(401);
                response.end(JSON.stringify({ error: "Authentication required" }));
                return;
            }

            const result = await pool.query(
                `SELECT offers.id, offers.sender_subject, offers.recipient_subject,
                    offers.message, offers.status, offers.created_at,
                    offers.contact_method, offers.contact_value,
                    offers.sender_completed_at, offers.recipient_completed_at,
                        offer_items.side, offer_items.item_id
                 FROM public.trade_offers AS offers
                 LEFT JOIN public.trade_offer_items AS offer_items ON offer_items.offer_id = offers.id
                 WHERE offers.issuer = $1
                   AND (offers.sender_subject = $2 OR offers.recipient_subject = $2)
                 ORDER BY offers.created_at DESC, offers.id DESC, offer_items.side, offer_items.item_id`,
                [user.issuer, user.sub],
            );
            const offersById = new Map();
            for (const row of result.rows) {
                let offer = offersById.get(row.id);
                if (!offer) {
                    const incoming = row.recipient_subject === user.sub;
                    const counterpart = incoming ? row.sender_subject : row.recipient_subject;
                    offer = {
                        id: row.id,
                        direction: incoming ? "incoming" : "outgoing",
                        trader: `Trader ${getTraderId(counterpart).slice(0, 12).toUpperCase()}`,
                        message: row.message,
                        status: row.status,
                        createdAt: row.created_at,
                        contact: (row.sender_subject === user.sub || ["accepted", "completed"].includes(row.status)) && row.contact_value
                            ? { method: row.contact_method, value: row.contact_value }
                            : null,
                        senderCompletedAt: row.sender_completed_at,
                        recipientCompletedAt: row.recipient_completed_at,
                        offeringItems: [],
                        requestingItems: [],
                    };
                    offersById.set(row.id, offer);
                }

                if (row.item_id) {
                    const itemIds = row.side === "offering" ? offer.offeringItems : offer.requestingItems;
                    itemIds.push(row.item_id);
                }
            }

            response.writeHead(200);
            response.end(JSON.stringify({ offers: [...offersById.values()] }));
        } catch (error) {
            console.error("User offers request failed:", error.message);
            response.writeHead(503);
            response.end(JSON.stringify({ error: "Offers are unavailable" }));
        }
        return;
    }

    if (request.method === "POST" && request.url === "/api/me/offers") {
        let client;
        let transactionStarted = false;
        try {
            const user = await authenticateRequest(request);
            if (!user) {
                response.writeHead(401);
                response.end(JSON.stringify({ error: "Authentication required" }));
                return;
            }

            const body = await readJsonBody(request);
            const offeringItems = body && typeof body === "object" && !Array.isArray(body)
                ? parseTradeItemIds(body.offeringItems)
                : null;
            const requestingItems = body && typeof body === "object" && !Array.isArray(body)
                ? parseTradeItemIds(body.requestingItems)
                : null;
            const contactValue = typeof body?.contactValue === "string" ? body.contactValue.trim() : "";
            if (!offeringItems || !requestingItems
                || typeof body.recipientTraderId !== "string"
                || !/^[a-f0-9]{64}$/.test(body.recipientTraderId)
                || !validContactMethods.has(body.contactMethod)
                || contactValue.length < 1
                || contactValue.length > 200
                || /[\u0000-\u001f]/.test(contactValue)
                || (body.contactMethod === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue))
                || (body.message !== undefined && (typeof body.message !== "string" || body.message.length > 500))) {
                response.writeHead(400);
                response.end(JSON.stringify({ error: "Invalid trade offer" }));
                return;
            }

            client = await pool.connect();
            await client.query("BEGIN");
            transactionStarted = true;
            const candidates = await client.query(
                `SELECT DISTINCT other.subject
                 FROM public.user_item_list_entries AS mine
                 JOIN public.user_item_list_entries AS other
                   ON other.issuer = mine.issuer
                  AND other.item_id = mine.item_id
                  AND ((mine.list_type = 'inventory' AND other.list_type = 'wishlist')
                    OR (mine.list_type = 'wishlist' AND other.list_type = 'inventory'))
                 WHERE mine.issuer = $1 AND mine.subject = $2 AND other.subject <> $2`,
                [user.issuer, user.sub],
            );
            const recipient = candidates.rows.find((row) => getTraderId(row.subject) === body.recipientTraderId)?.subject;
            if (!recipient) {
                await client.query("ROLLBACK");
                transactionStarted = false;
                response.writeHead(404);
                response.end(JSON.stringify({ error: "That trade match is no longer available" }));
                return;
            }

            const itemsStillMatch = await validateTradeItems(
                client,
                user.issuer,
                user.sub,
                recipient,
                offeringItems,
                requestingItems,
            );
            if (!itemsStillMatch) {
                await client.query("ROLLBACK");
                transactionStarted = false;
                response.writeHead(409);
                response.end(JSON.stringify({ error: "Those items no longer make a valid match" }));
                return;
            }

            const created = await client.query(
                `INSERT INTO public.trade_offers
                    (issuer, sender_subject, recipient_subject, message, contact_method, contact_value)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, status, created_at`,
                [user.issuer, user.sub, recipient, (body.message ?? "").trim(), body.contactMethod, contactValue],
            );
            const offerId = created.rows[0].id;
            await client.query(
                `INSERT INTO public.trade_offer_items (offer_id, side, item_id)
                 SELECT $1, 'offering', item_id FROM unnest($2::text[]) AS selected(item_id)
                 UNION ALL
                 SELECT $1, 'requesting', item_id FROM unnest($3::text[]) AS selected(item_id)`,
                [offerId, [...offeringItems], [...requestingItems]],
            );
            await client.query("COMMIT");
            transactionStarted = false;

            response.writeHead(201);
            response.end(JSON.stringify({ offer: created.rows[0] }));
        } catch (error) {
            if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
            console.error("Trade offer creation failed:", error.message);
            response.writeHead(error.status ?? 503);
            response.end(JSON.stringify({ error: error.status ? error.message : "Trade offers are unavailable" }));
        } finally {
            client?.release();
        }
        return;
    }

    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const offerActionMatch = requestUrl.pathname.match(/^\/api\/me\/offers\/(\d+)$/);
    if (offerActionMatch && request.method === "PUT") {
        let client;
        let transactionStarted = false;
        try {
            const user = await authenticateRequest(request);
            if (!user) {
                response.writeHead(401);
                response.end(JSON.stringify({ error: "Authentication required" }));
                return;
            }

            const body = await readJsonBody(request);
            if (!body || typeof body !== "object" || Array.isArray(body)
                || !new Set(["accept", "decline", "withdraw", "complete"]).has(body.action)) {
                response.writeHead(400);
                response.end(JSON.stringify({ error: "Invalid offer action" }));
                return;
            }

            client = await pool.connect();
            await client.query("BEGIN");
            transactionStarted = true;
            const result = await client.query(
                `SELECT id, sender_subject, recipient_subject, status,
                    sender_completed_at, recipient_completed_at
                 FROM public.trade_offers
                 WHERE issuer = $1 AND id = $2
                   AND (sender_subject = $3 OR recipient_subject = $3)
                 FOR UPDATE`,
                [user.issuer, offerActionMatch[1], user.sub],
            );
            const offer = result.rows[0];
            if (!offer) {
                await client.query("ROLLBACK");
                transactionStarted = false;
                response.writeHead(404);
                response.end(JSON.stringify({ error: "Offer not found" }));
                return;
            }
            const isSender = offer.sender_subject === user.sub;
            const isRecipient = offer.recipient_subject === user.sub;
            if (body.action === "complete") {
                if (offer.status !== "accepted") {
                    await client.query("ROLLBACK");
                    transactionStarted = false;
                    response.writeHead(409);
                    response.end(JSON.stringify({ error: "Only accepted offers can be marked complete" }));
                    return;
                }

                const updated = await client.query(
                    `UPDATE public.trade_offers
                     SET sender_completed_at = CASE WHEN $3 THEN COALESCE(sender_completed_at, now()) ELSE sender_completed_at END,
                         recipient_completed_at = CASE WHEN $4 THEN COALESCE(recipient_completed_at, now()) ELSE recipient_completed_at END,
                         status = CASE
                             WHEN (sender_completed_at IS NOT NULL OR $3)
                              AND (recipient_completed_at IS NOT NULL OR $4) THEN 'completed'
                             ELSE 'accepted'
                         END,
                         updated_at = now()
                     WHERE issuer = $1 AND id = $2
                     RETURNING status, sender_completed_at, recipient_completed_at`,
                    [user.issuer, offer.id, isSender, isRecipient],
                );
                await client.query("COMMIT");
                transactionStarted = false;
                response.writeHead(200);
                response.end(JSON.stringify(updated.rows[0]));
                return;
            }

            if (offer.status !== "pending") {
                await client.query("ROLLBACK");
                transactionStarted = false;
                response.writeHead(409);
                response.end(JSON.stringify({ error: "This offer is no longer pending" }));
                return;
            }

            if ((body.action === "withdraw" && !isSender) || (body.action !== "withdraw" && !isRecipient)) {
                await client.query("ROLLBACK");
                transactionStarted = false;
                response.writeHead(403);
                response.end(JSON.stringify({ error: "You cannot perform that action on this offer" }));
                return;
            }

            if (body.action === "accept") {
                const itemRows = await client.query(
                    "SELECT side, item_id FROM public.trade_offer_items WHERE offer_id = $1",
                    [offer.id],
                );
                const offeringItems = new Set(itemRows.rows.filter((row) => row.side === "offering").map((row) => row.item_id));
                const requestingItems = new Set(itemRows.rows.filter((row) => row.side === "requesting").map((row) => row.item_id));
                const itemsStillMatch = await validateTradeItems(
                    client,
                    user.issuer,
                    offer.sender_subject,
                    offer.recipient_subject,
                    offeringItems,
                    requestingItems,
                );
                if (!itemsStillMatch) {
                    await client.query("ROLLBACK");
                    transactionStarted = false;
                    response.writeHead(409);
                    response.end(JSON.stringify({ error: "The listed items no longer line up with both traders' lists" }));
                    return;
                }
            }

            await client.query(
                `UPDATE public.trade_offers
                 SET status = $3, updated_at = now()
                 WHERE issuer = $1 AND id = $2`,
                [user.issuer, offer.id, body.action === "withdraw" ? "withdrawn" : body.action === "accept" ? "accepted" : "declined"],
            );
            await client.query("COMMIT");
            transactionStarted = false;
            response.writeHead(200);
            response.end(JSON.stringify({ status: body.action === "withdraw" ? "withdrawn" : body.action === "accept" ? "accepted" : "declined" }));
        } catch (error) {
            if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
            console.error("Trade offer action failed:", error.message);
            response.writeHead(error.status ?? 503);
            response.end(JSON.stringify({ error: error.status ? error.message : "Trade offers are unavailable" }));
        } finally {
            client?.release();
        }
        return;
    }

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