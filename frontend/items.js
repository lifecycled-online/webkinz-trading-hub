const params = new URLSearchParams(window.location.search);

const collection = params.get("collection");
const category = params.get("category");
const validCollections = new Set(["color", "misc", "theme", "type"]);
const categoryName = document.getElementById("category-name");
const container = document.getElementById("items");

function showMessage(message) {
    container.textContent = message;
}

async function loadCategory() {
    if (!validCollections.has(collection) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category ?? "")) {
        categoryName.textContent = "Unavailable";
        showMessage("This category link is invalid. Browse categories to choose an item group.");
        return;
    }

    try {
        const collectionResponse = await fetch(`data/collections/${collection}-collections.json`);
        if (!collectionResponse.ok) {
            throw new Error(`Collection request failed with status ${collectionResponse.status}`);
        }

        const collections = await collectionResponse.json();
        const currentCollection = collections.find(item => item.id === category);
        if (!currentCollection) {
            categoryName.textContent = "Unavailable";
            showMessage("This category could not be found. Browse categories to choose an item group.");
            return;
        }

        categoryName.textContent = currentCollection.title;
        const jsonFile = `data/items/${collection}-items/${currentCollection.id}-items.json`;
        const itemsResponse = await fetch(jsonFile);
        if (!itemsResponse.ok) {
            throw new Error(`Items request failed with status ${itemsResponse.status}`);
        }

        const items = await itemsResponse.json();
        items.forEach(item => {
            if (item.is_tradeable) {
                const card = document.createElement("div");
                card.className = "item-card";
                const img = document.createElement("img");
                img.src = item.image_url;
                img.alt = item.title;
                const caption = document.createElement("p");
                caption.textContent = item.title;

                const buttonContainer = document.createElement("div");
                buttonContainer.className = "button-container";

                /* button html structure:
                    <div class="wishlist-button">
                        <input type="checkbox" id="wishlist-button" />
                        <label for="wishlist-button"></label>
                    </div>
                    <div class="inventory-button">
                        <input type="checkbox" id="inventory-button" />
                        <label for="inventory-button"></label>
                    </div>
                */  

                const wishlistButtonContainer = document.createElement("div");
                wishlistButtonContainer.className = "wishlist-button";
                const wishlistButton = document.createElement("input");
                wishlistButton.type = "checkbox";
                wishlistButton.id = `wishlist-${item.id}`;
                const wishlistLabel = document.createElement("label");
                wishlistLabel.setAttribute("for", wishlistButton.id);
                wishlistButtonContainer.appendChild(wishlistButton);
                wishlistButtonContainer.appendChild(wishlistLabel);

                const inventoryButtonContainer = document.createElement("div");
                inventoryButtonContainer.className = "inventory-button";
                const inventoryButton = document.createElement("input");
                inventoryButton.type = "checkbox";
                inventoryButton.id = `inventory-${item.id}`;
                const inventoryLabel = document.createElement("label");
                inventoryLabel.setAttribute("for", inventoryButton.id);
                inventoryButtonContainer.appendChild(inventoryButton);
                inventoryButtonContainer.appendChild(inventoryLabel);

                buttonContainer.appendChild(wishlistButtonContainer);
                buttonContainer.appendChild(inventoryButtonContainer);

                card.appendChild(img);
                card.appendChild(caption);
                card.appendChild(buttonContainer);

                container.appendChild(card);
            }
        });

        if (container.children.length === 0) {
            showMessage("No tradeable items found in this category.");
        }
    } catch (error) {
        console.error("Error loading category items:", error);
        showMessage("Unable to load this category right now. Please try again later.");
    }
}

loadCategory();