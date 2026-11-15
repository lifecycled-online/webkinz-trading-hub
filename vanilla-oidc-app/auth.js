// Initialize UserManager with configuration
const userManager = new oidc.UserManager(oidcConfig);

// Handle the authentication callback
async function handleCallback() {
    try {
        const user = await userManager.signinRedirectCallback();
        window.location.href = '/';
    } catch (error) {
        console.error('Callback error:', error);
        displayError(error);
    }
}

// Login function
async function login() {
    try {
        await userManager.signinRedirect();
    } catch (error) {
        console.error('Login error:', error);
        displayError(error);
    }
}

// Logout function
async function logout() {
    try {
        await userManager.signoutRedirect();
    } catch (error) {
        console.error('Logout error:', error);
        displayError(error);
    }
}

// Check authentication status
async function checkAuth() {
    try {
        const user = await userManager.getUser();
        if (user) {
            displayProfile(user);
        } else {
            displayLogin();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        displayError(error);
    }
}

// Display functions
function displayProfile(user) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('profile').style.display = 'block';
    document.getElementById('profile-data').textContent = 
        JSON.stringify(user.profile, null, 2);
}

function displayLogin() {
    document.getElementById('login').style.display = 'block';
    document.getElementById('profile').style.display = 'none';
}

function displayError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = 'Error: ' + error.message;
    document.body.appendChild(errorDiv);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/callback.html') {
        handleCallback();
    } else {
        checkAuth();
    }
});