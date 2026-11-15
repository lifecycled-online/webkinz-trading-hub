import { createItemListControls, loadItemLists } from "./item-lists.js";

const collections = [
    { name: "color", file: "data/collections/color-collections.json" },
    { name: "misc", file: "data/collections/misc-collections.json" },
    { name: "theme", file: "data/collections/theme-collections.json" },
    { name: "type", file: "data/collections/type-collections.json" }
];

const ITEMS_PER_PAGE = 50;
let currentPage = 1;
let tradeableItems = [];
let itemLists = null;
const search = document.getElementById("all-items-search");
const count = document.getElementById("all-items-count");
const emptyState = document.getElementById("all-items-empty");

async function loadAllItems() {
    try {
        const allItems = [];

        for (const collection of collections) {
            const response = await fetch(collection.file);
            const categories = await response.json();

            const itemPromises = categories.map(async category => {
                const itemFile = `data/items/${collection.name}-items/${category.id}-items.json`;
                const response = await fetch(itemFile);
                return await response.json();
            });

            const categoryItems = await Promise.all(itemPromises);

            allItems.push(...categoryItems.flat());
        }

        const uniqueItems = [...new Map(allItems.map(item => [item.id, item])).values()];

        tradeableItems = uniqueItems.filter(item => item.is_tradeable);

        tradeableItems.sort((a, b) => a.title.localeCompare(b.title));

        try {
            itemLists = await loadItemLists();
        } catch (error) {
            console.error("Unable to load saved item lists:", error.message);
        }

        search.disabled = false;
        displayItems();
    } catch (error) {
        console.error("Error loading all items:", error);
        count.textContent = "Unable to load items.";
    }
}

function displayItems() {
    const query = search.value.trim().toLocaleLowerCase();
    const filteredItems = tradeableItems.filter(item => item.title.toLocaleLowerCase().includes(query));
    const container = document.getElementById("items");
    container.innerHTML = "";

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    paginatedItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "item-card";
        const img = document.createElement("img");
        img.src = item.image_url;
        img.alt = item.title;
        const caption = document.createElement("p");
        caption.textContent = item.title;

        card.appendChild(img);
        card.appendChild(caption);
        card.appendChild(createItemListControls(item, itemLists));

        container.appendChild(card);
    });

    count.textContent = `${filteredItems.length} ${filteredItems.length === 1 ? "item" : "items"}`;
    emptyState.hidden = filteredItems.length > 0;
    emptyState.textContent = query ? "No items match your search." : "No tradeable items found.";
    setupPagination(filteredItems.length);
}

function setupPagination(filteredItemCount) {
    const pageNumbers = document.getElementById("page-numbers");
    const prev = document.getElementById("prev");
    const next = document.getElementById("next");

    const totalPages = Math.max(1, Math.ceil(filteredItemCount / ITEMS_PER_PAGE));
    currentPage = Math.min(currentPage, totalPages);

    pageNumbers.innerHTML = `Page ${currentPage} of ${totalPages}`;
    document.getElementById("pagination").hidden = filteredItemCount <= ITEMS_PER_PAGE;
    prev.setAttribute("aria-disabled", String(currentPage === 1));
    next.setAttribute("aria-disabled", String(currentPage === totalPages));

    prev.onclick = (event) => {
        event.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            window.scrollTo({ top: 0 });
            displayItems();
        }
    };

    next.onclick = (event) => {
        event.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            window.scrollTo({ top: 0 });
            displayItems();
        }
    };
}

search.addEventListener("input", () => {
    currentPage = 1;
    displayItems();
});

loadAllItems();