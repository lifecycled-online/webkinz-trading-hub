import { userManager } from "./oidc-client.js";

const apiBaseUrl = new URL("https://webkinz-trading-hub.onrender.com");

async function requestListApi(path, method = "GET") {
    const user = await userManager.getUser();
    if (!user || user.expired || !user.access_token) {
        throw new Error("Sign in to manage your item lists.");
    }

    const response = await fetch(new URL(path, apiBaseUrl), {
        method,
        headers: { Authorization: `Bearer ${user.access_token}` },
    });
    if (!response.ok) {
        throw new Error(`Item list request failed with status ${response.status}`);
    }

    return response;
}

export async function loadItemLists() {
    const response = await requestListApi("/api/me/lists");
    return response.json();
}

export function createItemListControls(item, lists, onChange = () => {}) {
    const container = document.createElement("div");
    container.className = "button-container";

    for (const [listType, className, labelText] of [
        ["wishlist", "wishlist-button", "Add to wishlist"],
        ["inventory", "inventory-button", "Add to inventory"],
    ]) {
        const control = document.createElement("div");
        control.className = className;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `${listType}-${item.id}`;
        checkbox.checked = lists?.[listType]?.includes(item.id) ?? false;
        checkbox.disabled = !lists;
        checkbox.setAttribute("aria-label", labelText);

        const label = document.createElement("label");
        label.setAttribute("for", checkbox.id);
        label.title = labelText;

        checkbox.addEventListener("change", async () => {
            const checked = checkbox.checked;
            checkbox.disabled = true;
            try {
                const encodedItemId = encodeURIComponent(item.id);
                await requestListApi(`/api/me/lists/${listType}/${encodedItemId}`, checked ? "PUT" : "DELETE");
                const itemIds = lists[listType];
                if (checked && !itemIds.includes(item.id)) itemIds.push(item.id);
                if (!checked) lists[listType] = itemIds.filter((itemId) => itemId !== item.id);
                onChange(listType, checked);
            } catch (error) {
                checkbox.checked = !checked;
                console.error("Unable to save item list change:", error.message);
            } finally {
                checkbox.disabled = false;
            }
        });

        control.append(checkbox, label);
        container.append(control);
    }

    return container;
}