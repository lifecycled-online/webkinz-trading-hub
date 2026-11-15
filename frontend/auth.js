import { redirectToLogin, userManager } from "./oidc-client.js";

const accountButtons = document.querySelector("#accountButtons");
const loginButton = document.querySelector("#loginButton");
const registerButton = document.querySelector("#registerButton");

async function startSignIn() {
    try {
        await redirectToLogin();
    } catch (error) {
        console.error("Unable to start SSO sign-in:", error);
    }
}

loginButton?.addEventListener("click", startSignIn);
registerButton?.addEventListener("click", startSignIn);

async function updateAccountControls() {
    try {
        const user = await userManager.getUser();
        if (!user || user.expired || !accountButtons) return;

        loginButton.hidden = true;
        registerButton.hidden = true;

        const accountName = document.createElement("span");
        accountName.className = "auth-account-name";
        accountName.textContent = user.profile.name || user.profile.email || "Signed in";

        const logoutButton = document.createElement("button");
        logoutButton.className = "headerButton";
        logoutButton.type = "button";
        logoutButton.textContent = "Sign out";
        logoutButton.addEventListener("click", async () => {
            await userManager.removeUser();
            window.location.reload();
        });

        accountButtons.append(accountName, logoutButton);

        const apiUrl = new URL("https://webkinz-trading-hub.onrender.com/api/me");
        const apiResponse = await fetch(apiUrl, {
            headers: { Authorization: `Bearer ${user.access_token}` },
        });
        if (!apiResponse.ok) {
            console.error(`Backend sign-in check failed with status ${apiResponse.status}`);
        }
    } catch (error) {
        console.error("Unable to update account controls:", error);
    }
}

updateAccountControls();