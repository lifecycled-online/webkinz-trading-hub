import { AuthenticationRequiredError, renderLoginPrompt, requireAuthenticatedUser } from "./oidc-client.js";

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
const offerDialog = document.querySelector("#trade-offer-dialog");
const offerForm = document.querySelector("#trade-offer-form");
const offerChoices = document.querySelector("#offer-item-choices");
const offerStatus = document.querySelector("#offer-compose-status");
const sendOfferButton = document.querySelector("#send-offer");
let itemsById = new Map();
let currentMatch = null;

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
    if (response.status === 401) {
        throw new AuthenticationRequiredError();
    }
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

function renderOfferChoices(itemIds, name, legendText) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "offer-choice-group";
    const legend = document.createElement("legend");
    legend.textContent = legendText;
    fieldset.append(legend);

    for (const itemId of itemIds) {
        const item = itemsById.get(itemId);
        if (!item) continue;

        const label = document.createElement("label");
        label.className = "offer-choice";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = name;
        checkbox.value = item.id;
        const image = document.createElement("img");
        image.src = item.image_url;
        image.alt = "";
        const title = document.createElement("span");
        title.textContent = item.title;
        label.append(checkbox, image, title);
        fieldset.append(label);
    }

    return fieldset;
}

function openOfferDialog(match) {
    currentMatch = match;
    offerForm.reset();
    offerStatus.textContent = "";
    document.querySelector("#offer-recipient").value = match.traderId;
    offerChoices.replaceChildren(
        renderOfferChoices(match.itemsTheyWant, "offering", "Items you offer"),
        renderOfferChoices(match.itemsYouWant, "requesting", "Items you request"),
    );
    offerDialog.showModal();
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
        const cardHeading = document.createElement("div");
        cardHeading.className = "match-card-heading";
        const heading = document.createElement("h3");
        heading.textContent = match.trader;
        const proposeButton = document.createElement("button");
        proposeButton.className = "offer-action offer-action-primary";
        proposeButton.type = "button";
        proposeButton.textContent = "Propose trade";
        proposeButton.addEventListener("click", () => openOfferDialog(match));
        cardHeading.append(heading, proposeButton);

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
        article.append(cardHeading, exchange);
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
        const user = await requireAuthenticatedUser();

        const [catalog, matches] = await Promise.all([loadCatalog(), loadMatches(user)]);
        itemsById = catalog;
        renderMatches(matches);
    } catch (error) {
        console.error("Unable to load trade matches:", error.message);
        matchCount.textContent = "Matches unavailable";
        status.hidden = false;
        if (error instanceof AuthenticationRequiredError) {
            renderLoginPrompt(status, "Log in to find trade matches. ");
        } else {
            status.textContent = error.message;
        }
    } finally {
        refreshButton.disabled = false;
    }
}

refreshButton.addEventListener("click", initialize);
document.querySelector("#cancel-offer").addEventListener("click", () => offerDialog.close());
offerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const offeringItems = [...offerForm.querySelectorAll('input[name="offering"]:checked')].map((input) => input.value);
    const requestingItems = [...offerForm.querySelectorAll('input[name="requesting"]:checked')].map((input) => input.value);
    if (offeringItems.length === 0 || requestingItems.length === 0) {
        offerStatus.textContent = "Choose at least one item on both sides of the offer.";
        return;
    }

    sendOfferButton.disabled = true;
    offerStatus.textContent = "Sending offer...";
    try {
        const user = await requireAuthenticatedUser();
        const response = await fetch(new URL("/api/me/offers", apiBaseUrl), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${user.access_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                recipientTraderId: currentMatch.traderId,
                offeringItems,
                requestingItems,
                message: offerForm.elements.message.value.trim(),
                contactMethod: offerForm.elements.contactMethod.value,
                contactValue: offerForm.elements.contactValue.value.trim(),
            }),
        });
        if (response.status === 401) {
            throw new AuthenticationRequiredError();
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "The offer could not be sent.");

        offerDialog.close();
        status.hidden = false;
        status.replaceChildren(document.createTextNode(`Offer sent to ${currentMatch.trader}. `));
        const offersLink = document.createElement("a");
        offersLink.href = "offers.html";
        offersLink.textContent = "View offers";
        status.append(offersLink);
    } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
            renderLoginPrompt(offerStatus, "Log in to send this trade offer. ");
        } else {
            offerStatus.textContent = error.message;
        }
    } finally {
        sendOfferButton.disabled = false;
    }
});
initialize();