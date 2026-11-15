import { userManager } from "./oidc-client.js";

const title = document.querySelector("#callback-title");
const message = document.querySelector("#callback-message");
const returnLink = document.querySelector("#callback-link");

try {
    const user = await userManager.signinRedirectCallback();
    const returnTo = user.state?.returnTo;
    let destination = new URL("./index.html", window.location.href);

    if (typeof returnTo === "string") {
        const requestedDestination = new URL(returnTo, window.location.origin);
        if (requestedDestination.origin === window.location.origin) {
            destination = requestedDestination;
        }
    }

    window.location.replace(destination.href);
} catch (error) {
    console.error("SSO callback failed:", error);
    title.textContent = "Sign-in could not be completed";
    message.textContent = "The authentication response could not be verified. Please return to the app and try again.";
    returnLink.hidden = false;
}