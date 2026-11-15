import { createItemListControls, loadItemLists } from "./item-lists.js";

const collections = [
    { name: "color", file: "data/collections/color-collections.json" },
    { name: "misc", file: "data/collections/misc-collections.json" },
    { name: "theme", file: "data/collections/theme-collections.json" },
    { name: "type", file: "data/collections/type-collections.json" },
];
const itemsPerPage = 50;
const listType = document.body.dataset.listType;
const listName = listType === "inventory" ? "Inventory" : "Wishlist";
const itemContainer = document.querySelector("#items");
const count = document.querySelector("#list-count");
const status = document.querySelector("#list-status");
const emptyState = document.querySelector("#empty-state");
const search = document.querySelector("#item-search");
let lists;
let savedItems = [];
let currentPage = 1;

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

    return [...new Map(categoryGroups.flat(2)
        .filter((item) => item.is_tradeable)
        .map((item) => [item.id, item])).values()];
}

function renderItems() {
    const query = search.value.trim().toLocaleLowerCase();
    const filteredItems = savedItems
        .filter((item) => item.title.toLocaleLowerCase().includes(query))
        .sort((first, second) => first.title.localeCompare(second.title));
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    currentPage = Math.min(currentPage, totalPages);
    const pageItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    itemContainer.replaceChildren();
    for (const item of pageItems) {
        const card = document.createElement("div");
        card.className = "item-card";
        const image = document.createElement("img");
        image.src = item.image_url;
        image.alt = item.title;
        const title = document.createElement("p");
        title.textContent = item.title;
        card.append(image, title, createItemListControls(item, lists, (changedList, isSaved) => {
            if (changedList === listType && !isSaved) {
                savedItems = savedItems.filter((savedItem) => savedItem.id !== item.id);
                renderItems();
            }
        }));
        itemContainer.append(card);
    }

    count.textContent = `${savedItems.length} ${savedItems.length === 1 ? "item" : "items"}`;
    emptyState.hidden = filteredItems.length > 0;
    emptyState.textContent = savedItems.length === 0
        ? `${listName} is empty. Add items from the catalog to see them here.`
        : "No saved items match your search.";
    document.querySelector("#page-numbers").textContent = `Page ${currentPage} of ${totalPages}`;
    document.querySelector("#pagination").hidden = totalPages <= 1;
    document.querySelector("#prev").ariaDisabled = String(currentPage <= 1);
    document.querySelector("#next").ariaDisabled = String(currentPage >= totalPages);
}

async function initialize() {
    try {
        lists = await loadItemLists();
        const catalog = await loadCatalog();
        const itemsById = new Map(catalog.map((item) => [item.id, item]));
        savedItems = lists[listType].map((itemId) => itemsById.get(itemId)).filter(Boolean);
        status.hidden = true;
        search.disabled = false;
        renderItems();
    } catch (error) {
        console.error(`Unable to load ${listName.toLowerCase()}:`, error.message);
        status.textContent = error.message.includes("Sign in")
            ? `Sign in to view and manage your ${listName.toLowerCase()}.`
            : `${listName} could not be loaded. Please try again later.`;
    }
}

search.addEventListener("input", () => {
    currentPage = 1;
    renderItems();
});

document.querySelector("#prev").addEventListener("click", (event) => {
    event.preventDefault();
    if (currentPage > 1) {
        currentPage--;
        renderItems();
    }
});

document.querySelector("#next").addEventListener("click", (event) => {
    event.preventDefault();
    currentPage++;
    renderItems();
});

initialize();