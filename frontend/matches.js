import { userManager } from "./oidc-client.js";

const apiBaseUrl = new URL("https://webkinz-trading-hub.onrender.com");
const collections = [
    { name: "color", file: "data/collections/color-collections.json" },
    { name: "misc", file: "data/collections/misc-collections.json" },
    { name: "theme", file: "data/collections/theme-collections.json" },
    { name: "type", file: "data/collections/type-collections.json" },
];
const matchList = document.querySelector("#matches-list");
const matchCount = document.querySelector("#matches-count");
const status = document.querySelector("#matches-status");
const refreshButton = document.querySelector("#refresh-matches");
let itemsById = new Map();

async function loadCatalog() {
    const categoryGroups = await Promise.all(collections.map(async ({ name, file }) => {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`Unable to load ${file}`);
        const categories = await response.json();
        return Promise.all(categories.map(async (category) => {
            const itemFile = `data/items/${name}-items/${category.id}-items.json`;
            const itemResponse = await fetch(itemFile);
            if (!itemResponse.ok) throw new Error(`Unable to load ${itemFile}`);
            return itemResponse.json();
        }));
    }));

    return new Map(categoryGroups.flat(2)
        .filter((item) => item.is_tradeable)
        .map((item) => [item.id, item]));
}

async function loadMatches(user) {
    if (!user || user.expired || !user.access_token) {
        throw new Error("Sign in to find trade matches.");
    }

    const response = await fetch(new URL("/api/me/matches", apiBaseUrl), {
        headers: { Authorization: `Bearer ${user.access_token}` },
    });
    if (response.status === 401) throw new Error("Your sign-in has expired. Please sign in again.");
    if (!response.ok) throw new Error("Matches could not be loaded. Please try again later.");
    return (await response.json()).matches;
}

function renderItems(itemIds) {
    const container = document.createElement("div");
    container.className = "match-items";

    for (const itemId of itemIds) {
        const item = itemsById.get(itemId);
        if (!item) continue;

        const entry = document.createElement("div");
        entry.className = "match-item";
        const image = document.createElement("img");
        image.src = item.image_url;
        image.alt = "";
        image.loading = "lazy";
        const title = document.createElement("span");
        title.textContent = item.title;
        entry.append(image, title);
        container.append(entry);
    }

    return container;
}

function renderMatches(matches) {
    matchList.replaceChildren();
    matchCount.textContent = `${matches.length} ${matches.length === 1 ? "trader match" : "trader matches"}`;

    if (matches.length === 0) {
        status.hidden = false;
        status.textContent = "No reciprocal matches yet. Add items to your inventory and wishlist to discover traders.";
        return;
    }

    status.hidden = true;
    for (const match of matches) {
        const article = document.createElement("article");
        article.className = "trade-match";
        const heading = document.createElement("h3");
        heading.textContent = match.trader;

        const wants = document.createElement("section");
        wants.className = "match-side match-side-wants";
        const wantsHeading = document.createElement("h4");
        wantsHeading.textContent = "They want from you";
        wants.append(wantsHeading, renderItems(match.itemsTheyWant));

        const offers = document.createElement("section");
        offers.className = "match-side match-side-offers";
        const offersHeading = document.createElement("h4");
        offersHeading.textContent = "You want from them";
        offers.append(offersHeading, renderItems(match.itemsYouWant));

        const exchange = document.createElement("div");
        exchange.className = "match-exchange";
        exchange.append(wants, offers);
        article.append(heading, exchange);
        matchList.append(article);
    }
}

async function initialize() {
    refreshButton.disabled = true;
    matchList.replaceChildren();
    status.hidden = false;
    status.textContent = "Loading your matches...";
    matchCount.textContent = "Finding matches...";

    try {
        const user = await userManager.getUser();
        if (!user || user.expired || !user.access_token) {
            throw new Error("Sign in to find trade matches.");
        }

        const [catalog, matches] = await Promise.all([loadCatalog(), loadMatches(user)]);
        itemsById = catalog;
        renderMatches(matches);
    } catch (error) {
        console.error("Unable to load trade matches:", error.message);
        matchCount.textContent = "Matches unavailable";
        status.hidden = false;
        status.textContent = error.message;
    } finally {
        refreshButton.disabled = false;
    }
}

refreshButton.addEventListener("click", initialize);
initialize();