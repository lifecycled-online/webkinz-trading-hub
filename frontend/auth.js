import { userManager } from "./oidc-client.js";

const accountButtons = document.querySelector("#accountButtons");
const loginButton = document.querySelector("#loginButton");
const registerButton = document.querySelector("#registerButton");

const dialog = document.createElement("dialog");
dialog.className = "auth-dialog";
dialog.setAttribute("aria-labelledby", "auth-title");
dialog.innerHTML = `
    <form id="sso-form">
        <h2 id="auth-title">Continue with SSO</h2>
        <label for="sso-email">Email</label>
        <input id="sso-email" name="email" type="email" autocomplete="email" required maxlength="254">
        <p id="sso-error" role="alert" aria-live="polite"></p>
        <div class="auth-dialog-actions">
            <button id="sso-close" class="headerButton" type="button">Cancel</button>
            <button id="sso-submit" class="headerButton" type="submit">Continue with SSO</button>
        </div>
    </form>
`;
document.body.append(dialog);

const form = dialog.querySelector("#sso-form");
const emailInput = dialog.querySelector("#sso-email");
const errorMessage = dialog.querySelector("#sso-error");
const submitButton = dialog.querySelector("#sso-submit");

function showDialog() {
    errorMessage.textContent = "";
    dialog.showModal();
    emailInput.focus();
}

loginButton?.addEventListener("click", showDialog);
registerButton?.addEventListener("click", showDialog);
dialog.querySelector("#sso-close").addEventListener("click", () => dialog.close());

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMessage.textContent = "";
    submitButton.disabled = true;

    try {
        await userManager.signinRedirect({
            extraQueryParams: { login_hint: emailInput.value.trim() },
            state: { returnTo: window.location.href },
        });
    } catch (error) {
        console.error("Unable to start SSO sign-in:", error);
        errorMessage.textContent = "Sign-in could not be started. Please try again.";
        submitButton.disabled = false;
    }
});

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
    } catch (error) {
        console.error("Unable to read the local sign-in state:", error);
    }
}

updateAccountControls();