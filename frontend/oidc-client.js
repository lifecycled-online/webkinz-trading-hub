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