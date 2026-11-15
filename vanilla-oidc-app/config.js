const oidcConfig = {
    authority: 'https://webkinz-trading-hub-dev.auth.ssojet.com',
    client_id: 'cli_dbsk2a0e1i9c73i0t2rg.5e019f7e18494425aacccafbbfa3518e.mtTfPmykbe9m2rWCJuonxm',
    redirect_uri: window.location.origin + '/callback.html',
    response_type: 'code',
    scope: 'openid profile email',
    post_logout_redirect_uri: window.location.origin,
    
    // Additional security settings
    automaticSilentRenew: true,
    loadUserInfo: true,
    extraQueryParams: {
        prompt: "login",
        display: "page",
        max_age: "3600",
        ui_locales: "en-US",
        acr_values: "urn:mace:incommon:iap:silver",
    }
};

// Generate random nonce for security
function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// Add nonce to config
oidcConfig.extraQueryParams.nonce = generateNonce();