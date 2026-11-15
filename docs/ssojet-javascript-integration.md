---
title: "Add SSOJet SSO to an Existing JavaScript Login"
description: "Add an SSOJet OpenID Connect sign-in option to an existing Node.js login flow while preserving email and password authentication."
sidebar_label: "JavaScript SSO Integration"
sidebar_position: 1
---

# Add SSOJet SSO to an Existing JavaScript Login

This guide adds a **Sign in with SSO** option to an existing JavaScript login page. It uses SSOJet as the OpenID Connect (OIDC) provider and a Node.js/Express backend to start authentication, validate the callback, establish the application's existing session, and send the user to `/dashboard`. The existing email-and-password handler stays in place.

The examples use Express and EJS for illustration. Adapt route names and template syntax to your app rather than replacing its existing login or session system.

## Prerequisites

- An existing JavaScript application with a login page and traditional authentication handler.
- Basic knowledge of JavaScript, Node.js, Express, HTML forms, and sessions.
- An active SSOJet account and a configured OIDC connection. See the [SSO Connection Setup Guide](/how-to-guides/sso/integrations/).
- A server-side session store suitable for your deployment. Do not use Express's in-memory session store in production.
- Node.js and npm. The example uses [`openid-client`](https://github.com/panva/openid-client), Express, and `express-session`.

> This is a confidential web application pattern: the client secret stays on the server. Do not put it in browser JavaScript, a frontend bundle, or a publicly served configuration file. For a browser-only SPA, register a public client and use Authorization Code with PKCE without a client secret.

## 1. Create an application in SSOJet

1. Sign in to the SSOJet Dashboard.
2. Open **Applications** and create a new application, for example `MyJavaScriptApp`, with type **Regular Web App**.
3. Add the exact callback URI used by the server, such as `http://localhost:3000/auth/callback` for local development. Add the production URI separately when deploying.
4. Copy the **Client ID** and **Client Secret** into your server's secret manager or local environment file.
5. In **Advanced > Endpoints**, copy the **Issuer URL**.

![SSOJet Applications page showing application creation](./images/ssojet-applications-step1.png)

*Caption: Create a Regular Web App in SSOJet. Replace this placeholder with a screenshot from your dashboard.*

![SSOJet application settings showing the callback URI](./images/ssojet-applications-step2.png)

*Caption: Register the exact callback URL that the application will handle.*

![SSOJet application endpoints showing issuer URL](./images/ssojet-applications-step3.png)

*Caption: Copy the issuer URL and client credentials from the application settings.*

## 2. Add OIDC support to the existing project

### Install dependencies

From the Node.js project root:

```bash
npm install express express-session openid-client dotenv
npm install ejs
```

If the application already uses Express, EJS, or a session middleware, keep the existing packages and configuration instead of installing duplicates.

### Configure server-side credentials

Add these values to the server environment. Keep `.env` out of source control and use your hosting provider's secret manager in production.

```dotenv
OIDC_ISSUER_URL=https://your-tenant.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_CALLBACK_URL=http://localhost:3000/auth/callback
PUBLIC_ORIGIN=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-secret
```

Use the exact issuer URL SSOJet provides. Do not guess or construct its endpoint paths manually.

### Discover the provider and create the Express routes

The following is an integration example for `openid-client` v6. Merge the middleware and routes into your existing server. Keep the current `POST /login` implementation for email-and-password sign-in.

```js
import "dotenv/config";
import express from "express";
import session from "express-session";
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from "openid-client";

const app = express();
const callbackUrl = process.env.OIDC_CALLBACK_URL;
const publicOrigin = process.env.PUBLIC_ORIGIN;

if (!callbackUrl || !publicOrigin || !process.env.SESSION_SECRET) {
  throw new Error("Missing required authentication environment configuration");
}

const oidc = await discovery(
  new URL(process.env.OIDC_ISSUER_URL),
  process.env.OIDC_CLIENT_ID,
  process.env.OIDC_CLIENT_SECRET,
);

app.set("trust proxy", 1); // Required when TLS terminates at a trusted proxy.
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: "app_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    // Configure a persistent session store here for production.
  }),
);

app.post("/auth/sso/start", async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "").trim();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).render("login", {
        error: "Enter a valid email address to continue with SSO.",
        ssoMode: true,
      });
    }

    const state = randomState();
    const nonce = randomNonce();
    const codeVerifier = randomPKCECodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

    req.session.oidcTransaction = { state, nonce, codeVerifier };

    const authorizationUrl = buildAuthorizationUrl(oidc, {
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid profile email",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      login_hint: email,
    });

    req.session.save((error) => {
      if (error) return next(error);
      return res.redirect(authorizationUrl.href);
    });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/callback", async (req, res, next) => {
  try {
    const transaction = req.session.oidcTransaction;
    if (!transaction) {
      return res.status(400).render("login", {
        error: "Your sign-in session expired. Please try again.",
        ssoMode: true,
      });
    }

    const currentUrl = new URL(req.originalUrl, publicOrigin);
    const tokens = await authorizationCodeGrant(oidc, currentUrl, {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
    });
    const claims = tokens.claims();

    if (!claims?.sub) {
      throw new Error("OIDC response did not contain a subject identifier");
    }

    // Resolve or create the local account by the verified issuer + subject,
    // then attach it to the same application session used by password login.
    const user = await findOrCreateUserFromOidc({
      issuer: process.env.OIDC_ISSUER_URL,
      subject: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: claims.name,
    });

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.redirect("/dashboard");
      });
    });
  } catch (error) {
    next(error);
  }
});

// Keep your existing POST /login route and password verification unchanged.
// Both authentication methods should establish the same local session shape.

app.listen(process.env.PORT ?? 3000);
```

`findOrCreateUserFromOidc` represents your application's existing user persistence and account-linking policy; implement it using your current data layer. The stable identity key is the OIDC issuer plus `sub`, not the email address alone. Only use an email for automatic account linking when your policy verifies ownership and handles collisions safely. Never accept a browser-supplied user ID or treat `login_hint` as proof of identity.

The example's centralized Express error handler should log diagnostic details on the server and return a generic sign-in error to the browser. Do not expose tokens, provider responses, client secrets, or stack traces to the user.

### Add the SSO option to the existing login page

Keep the email and password inputs and existing submit route. Add a separate control for SSO. In SSO mode, the form posts to `/auth/sso/start`; in password mode, it continues posting to `/login`.

```html
<form id="login-form" method="post" action="/login">
  <!-- Keep your application's existing CSRF token field here. -->
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required>

  <div id="password-field">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
  </div>

  <button id="submit-button" type="submit">Sign In</button>
  <button id="sso-toggle" type="button">Sign in with SSO</button>
  <p id="login-error" role="alert"><%= error ?? "" %></p>
</form>
<script src="/js/login.js" defer></script>
```

If your app does not use EJS, replace `<%= error ?? "" %>` with its normal error rendering. Protect the SSO-start POST route with the same CSRF protection as other form submissions.

```js
const form = document.querySelector("#login-form");
const passwordField = document.querySelector("#password-field");
const passwordInput = document.querySelector("#password");
const submitButton = document.querySelector("#submit-button");
const ssoToggle = document.querySelector("#sso-toggle");

let ssoMode = false;

ssoToggle.addEventListener("click", () => {
  ssoMode = !ssoMode;
  passwordField.hidden = ssoMode;
  passwordInput.disabled = ssoMode;
  passwordInput.required = !ssoMode;
  form.action = ssoMode ? "/auth/sso/start" : "/login";
  submitButton.textContent = ssoMode ? "Continue with SSO" : "Sign In";
  ssoToggle.textContent = ssoMode ? "Use email and password" : "Sign in with SSO";

  if (ssoMode) {
    document.querySelector("#email").focus();
  } else {
    passwordInput.value = "";
  }
});
```

The browser only changes the UI and chooses the route. The server validates the email, generates the OIDC request, and sets `login_hint`; it does not trust a client-side `sso=true` flag to authenticate anyone.

### Preserve the existing traditional login

Leave the current password verification and its route intact. On successful password login, continue setting the same local session property used above (`userId` in the example) and redirect according to the existing behavior. On successful SSO, map the verified provider identity to a local account and set that same session property. Do not create a second, incompatible session mechanism for SSO.

## 3. Test the updated connection

1. Start the application and open the existing login page.
2. Sign in with a test email and password. Confirm the original handler, error behavior, and post-login destination still work.
3. Click **Sign in with SSO**. Confirm the password field hides, the button reads **Continue with SSO**, and the email remains visible.
4. Enter an email and submit. Confirm the browser redirects to SSOJet and the authorization request includes `login_hint` with that email.
5. Complete authentication. Confirm SSOJet redirects to the registered callback, the app validates the OIDC response, establishes the normal app session, and redirects to `/dashboard`.
6. Try an expired or missing transaction, a mismatched callback state, and a denied sign-in. Confirm each results in a useful generic error and does not create an authenticated session.
7. Check server logs for actionable diagnostics. Verify that passwords, client secrets, authorization codes, and tokens are not logged.

## Additional considerations

- **Error handling:** Return messages using the app's existing validation and error display patterns. Keep detailed errors in protected server logs only.
- **Styling:** Match the SSO toggle and changed submit label to the existing login page styles; retain visible focus indicators and accessible labels.
- **Security:** Use HTTPS in production, secure HTTP-only cookies, CSRF protection on form posts, OIDC state and nonce validation, and PKCE with `S256`. Store the session in a persistent production session store and rotate the session ID after authentication.
- **Redirect URI:** Register the production callback URI with SSOJet and set `OIDC_CALLBACK_URL` to that exact value. Do not derive trusted redirect URLs from an unvalidated `Host` header.
- **Session management:** Reuse the app's established session lifecycle, logout behavior, expiration policy, and account authorization checks. An OIDC login does not by itself grant application-specific permissions.
- **Account matching:** Treat the provider's verified `(issuer, sub)` pair as the external identity. Establish an explicit linking policy before associating an SSO identity with an existing password account.
- **Session middleware:** Configure a durable session store, HTTPS proxy trust, cookie domain, expiration, and secret rotation for the actual deployment environment.

## Support

- Contact [SSOJet Support](https://ssojet.com/) for dashboard, connection, or issuer configuration questions.
- Check the application server logs and SSOJet application logs for callback and authentication failures.
- See the [`openid-client` documentation](https://github.com/panva/openid-client) and [Express session documentation](https://expressjs.com/en/resources/middleware/session.html) for library-specific details.