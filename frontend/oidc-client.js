import { UserManager, WebStorageStateStore } from "https://cdn.jsdelivr.net/npm/oidc-client-ts@3.5.0/+esm";

const frontendRoot = new URL("./", import.meta.url);

export const userManager = new UserManager({
    authority: "https://webkinz-trading-hub-dev.auth.ssojet.com/",
    client_id: "cli_dbsj51b9o96c73j98js0.3b92063cd3ee490eacbc8591f72c4f74.gGniUBSPUAzxExuMZfCoP9",
    redirect_uri: new URL("auth-callback.html", frontendRoot).href,
    response_type: "code",
    scope: "openid profile email",
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: false,
});

export function redirectToLogin(loginHint) {
    return userManager.signinRedirect({
        extraQueryParams: loginHint ? { login_hint: loginHint } : {},
        state: { returnTo: window.location.href },
    });
}

export async function requireAuthenticatedUser() {
    const user = await userManager.getUser();
    if (!user || user.expired || !user.access_token) {
        throw new AuthenticationRequiredError();
    }
    return user;
}

export class AuthenticationRequiredError extends Error {
    constructor() {
        super("Authentication is required.");
        this.name = "AuthenticationRequiredError";
    }
}

export function renderLoginPrompt(container, message) {
    const loginLink = document.createElement("a");
    loginLink.className = "login-prompt-link";
    loginLink.href = "#login";
    loginLink.textContent = "Log in";
    loginLink.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
            await redirectToLogin();
        } catch (error) {
            console.error("Unable to start SSO sign-in:", error);
            loginLink.textContent = "Sign-in could not be started. Try again.";
        }
    });
    container.replaceChildren(document.createTextNode(message), loginLink);
}