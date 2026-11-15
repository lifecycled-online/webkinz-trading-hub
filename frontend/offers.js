import { AuthenticationRequiredError, renderLoginPrompt, requireAuthenticatedUser } from "./oidc-client.js";

const apiBaseUrl = new URL("https://webkinz-trading-hub.onrender.com");
const collections = [
    { name: "color", file: "data/collections/color-collections.json" },
    { name: "misc", file: "data/collections/misc-collections.json" },
    { name: "theme", file: "data/collections/theme-collections.json" },
    { name: "type", file: "data/collections/type-collections.json" },
];
const offersList = document.querySelector("#offers-list");
const offersCount = document.querySelector("#offers-count");
const statusMessage = document.querySelector("#offers-status");
const refreshButton = document.querySelector("#refresh-offers");
const tabs = [...document.querySelectorAll(".offer-tab")];
let activeDirection = "incoming";
let offers = [];
let itemsById = new Map();

async function requestApi(path, options = {}) {
    const user = await requireAuthenticatedUser();

    const headers = { Authorization: `Bearer ${user.access_token}` };
    if (options.body) headers["Content-Type"] = "application/json";
    const response = await fetch(new URL(path, apiBaseUrl), { ...options, headers });
    if (response.status === 401) {
        throw new AuthenticationRequiredError();
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Trade offers are unavailable.");
    return result;
}

async function loadCatalog() {
    const groups = await Promise.all(collections.map(async ({ name, file }) => {
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
    return new Map(groups.flat(2).map((item) => [item.id, item]));
}

function renderItems(itemIds, label) {
    const section = document.createElement("section");
    section.className = "match-side";
    const heading = document.createElement("h4");
    heading.textContent = label;
    const list = document.createElement("div");
    list.className = "match-items";

    for (const itemId of itemIds) {
        const item = itemsById.get(itemId);
        const row = document.createElement("div");
        row.className = "match-item";
        if (item) {
            const image = document.createElement("img");
            image.src = item.image_url;
            image.alt = "";
            image.loading = "lazy";
            row.append(image);
        }
        const title = document.createElement("span");
        title.textContent = item?.title ?? itemId;
        row.append(title);
        list.append(row);
    }

    section.append(heading, list);
    return section;
}

function renderOffers() {
    const visibleOffers = offers.filter((offer) => offer.direction === activeDirection);
    offersList.replaceChildren();
    offersCount.textContent = `${visibleOffers.length} ${visibleOffers.length === 1 ? "offer" : "offers"} ${activeDirection === "incoming" ? "received" : "sent"}`;

    if (visibleOffers.length === 0) {
        statusMessage.hidden = false;
        statusMessage.textContent = activeDirection === "incoming" ? "No offers received yet." : "You have not sent any offers yet.";
        return;
    }

    statusMessage.hidden = true;
    for (const offer of visibleOffers) {
        const article = document.createElement("article");
        article.className = "trade-match offer-card";
        const heading = document.createElement("div");
        heading.className = "offer-card-heading";
        const title = document.createElement("h3");
        title.textContent = offer.trader;
        const badge = document.createElement("span");
        badge.className = `offer-status offer-status-${offer.status}`;
        badge.textContent = offer.status[0].toUpperCase() + offer.status.slice(1);
        heading.append(title, badge);

        const exchange = document.createElement("div");
        exchange.className = "match-exchange";
        exchange.append(
            renderItems(offer.offeringItems, activeDirection === "incoming" ? "They offer" : "You offer"),
            renderItems(offer.requestingItems, activeDirection === "incoming" ? "They request" : "You request"),
        );
        const details = document.createElement("div");
        details.className = "offer-details";
        const date = document.createElement("time");
        date.dateTime = offer.createdAt;
        date.textContent = new Date(offer.createdAt).toLocaleString();
        details.append(date);
        if (offer.message) {
            const message = document.createElement("p");
            message.textContent = offer.message;
            details.append(message);
        }
        if (offer.contact) {
            const contact = document.createElement("p");
            contact.className = "offer-contact";
            const method = { discord: "Discord", email: "Email", other: "Other" }[offer.contact.method] ?? "Contact";
            contact.textContent = `${offer.direction === "incoming" ? "Contact the trader" : "Your shared contact"} via ${method}: ${offer.contact.value}`;
            details.append(contact);
        }
        article.append(heading, exchange, details);

        if (offer.status === "pending" && offer.direction === "incoming") {
            const actions = document.createElement("div");
            actions.className = "offer-card-actions";
            actions.append(createAction("Accept offer", "accept", offer.id), createAction("Decline", "decline", offer.id));
            article.append(actions);
        } else if (offer.status === "pending") {
            const actions = document.createElement("div");
            actions.className = "offer-card-actions";
            actions.append(createAction("Withdraw offer", "withdraw", offer.id));
            article.append(actions);
        } else if (offer.status === "accepted") {
            const note = document.createElement("p");
            note.className = "offer-completion-note";
            const ownConfirmation = offer.direction === "incoming" ? offer.recipientCompletedAt : offer.senderCompletedAt;
            const otherConfirmation = offer.direction === "incoming" ? offer.senderCompletedAt : offer.recipientCompletedAt;
            note.textContent = ownConfirmation
                ? "You confirmed the exchange. Waiting for the other trader."
                : otherConfirmation
                    ? "The other trader confirmed. Confirm after you have completed the exchange in Webkinz."
                    : "After completing the exchange in Webkinz, confirm it here.";
            article.append(note);
            if (!ownConfirmation) article.append(createAction("Confirm exchange complete", "complete", offer.id));
        } else if (offer.status === "completed") {
            const note = document.createElement("p");
            note.className = "offer-completion-note";
            note.textContent = "Both traders confirmed. Inventory was updated and fulfilled wishlist items were removed.";
            article.append(note);
        }

        offersList.append(article);
    }
}

function createAction(label, action, offerId) {
    const button = document.createElement("button");
    button.className = "offer-action";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async () => {
        button.disabled = true;
        statusMessage.hidden = false;
        statusMessage.textContent = `${label}...`;
        try {
            await requestApi(`/api/me/offers/${encodeURIComponent(offerId)}`, {
                method: "PUT",
                body: JSON.stringify({ action }),
            });
            await loadOffers();
        } catch (error) {
            if (error instanceof AuthenticationRequiredError) {
                renderLoginPrompt(statusMessage, "Log in to manage your trade offers. ");
            } else {
                statusMessage.textContent = error.message;
            }
            button.disabled = false;
        }
    });
    return button;
}

async function loadOffers() {
    const result = await requestApi("/api/me/offers");
    offers = result.offers;
    renderOffers();
}

async function initialize() {
    refreshButton.disabled = true;
    statusMessage.hidden = false;
    statusMessage.textContent = "Loading your offers...";
    try {
        await requestApi("/api/me/offers").then((result) => { offers = result.offers; });
        itemsById = await loadCatalog();
        renderOffers();
    } catch (error) {
        offersCount.textContent = "Offers unavailable";
        if (error instanceof AuthenticationRequiredError) {
            renderLoginPrompt(statusMessage, "Log in to view your trade offers. ");
        } else {
            statusMessage.textContent = error.message;
        }
    } finally {
        refreshButton.disabled = false;
    }
}

for (const tab of tabs) {
    tab.addEventListener("click", () => {
        activeDirection = tab.dataset.direction;
        for (const otherTab of tabs) {
            const active = otherTab === tab;
            otherTab.classList.toggle("active", active);
            otherTab.setAttribute("aria-pressed", String(active));
        }
        renderOffers();
    });
}

refreshButton.addEventListener("click", initialize);
initialize();