# Webkinz Trading Hub — Agent Instructions

## 1. Project Overview

This project is a Webkinz Trading Hub, a community-oriented website where players can organize their items, manage inventories, create wishlists, and eventually coordinate trades with other players.

The project is being developed for a hackathon with a very short deadline. Prioritize working features, stability, and a clean user experience over unnecessary complexity.

### Main Goals
- Browse Webkinz items by category and collection.
- View all available items in alphabetical order.
- Allow users to add items to their wishlist.
- Allow users to add items to their inventory.
- Implement user registration and authentication using SSOJet.
- Eventually allow users to manage their inventory and wishlist across devices.
- Deploy the website publicly.

## 2. Your Role and Permissions

You are authorized to act as an active development agent.

You MAY:
- Read and analyze the entire project.
- Create, edit, rename, and delete files when necessary.
- Modify HTML, CSS, JavaScript, and Python.
- Refactor existing code when it improves maintainability.
- Install project dependencies when necessary.
- Run local development servers.
- Run tests, diagnostics, and builds.
- Identify and fix bugs.
- Improve accessibility, responsiveness, and usability.
- Create documentation.
- Configure GitHub Actions and deployment workflows.

You do NOT need to request permission before making ordinary code changes.

However:
- Never make major architectural changes without explaining the reasoning first.
- Never replace an existing technology or framework without approval.
- Never delete substantial functionality without explaining why.
- Never overwrite user data or existing project files without checking first.
- Never introduce unnecessary dependencies.
- Never commit, push, publish, or deploy changes without explicit approval.
- Never modify Git history or perform destructive Git operations without approval.

When a task is ambiguous, investigate first and ask questions only when necessary.

## 3. Communication Requirements

Transparency is extremely important.

After EVERY task involving file modifications, provide a development report.

Use this format:

### Changes Made
List every file created, modified, or deleted.

### What Changed
Explain specifically what you implemented or fixed.

### Why
Explain why the changes were necessary and any important decisions made.

### Affected Functionality
Identify which parts of the website are affected.

### Testing
List:
- Tests performed.
- Commands executed.
- Whether the tests passed.
- Anything that could not be tested.

### Outstanding Issues
Mention remaining bugs, limitations, assumptions, or recommended next steps.

Do not simply say "everything is fixed."

Be specific about what you changed and how it affects the project.

If you make multiple unrelated changes, clearly separate them in your report.

## 4. Development Guidelines

### General
- Keep the existing project architecture unless there is a good reason to change it.
- Prefer simple, readable solutions.
- Avoid unnecessary abstractions and overengineering.
- Write code that a beginner developer can understand and maintain.
- Use descriptive variable and function names.
- Follow consistent formatting.
- Remove unnecessary debugging statements before completion.
- Do not silently swallow errors.
- Handle failed requests and missing data gracefully.

### Frontend
The current frontend uses:
- HTML
- CSS
- Vanilla JavaScript

Continue using these technologies.

Do not introduce React, Vue, Angular, Next.js, or other frontend frameworks without approval.

Use separate JavaScript files for separate responsibilities when appropriate.

Keep HTML focused on page structure, CSS focused on presentation, and JavaScript focused on functionality.

Reuse existing components and patterns instead of unnecessarily duplicating code.

### Python
Python is currently used for scraping item information from Webkinz Guide.

Preserve the existing Python scraper unless changes are necessary.

Do not run the scraper against external websites without checking the existing scraping rules and respecting rate limits.

Do not unnecessarily regenerate or overwrite existing JSON datasets.

### Data
The project currently uses JSON files for item and collection information.

The data structure includes:
- Collections
- Categories
- Individual items
- Item titles
- Image URLs
- Tradeability information
- Unique item identifiers

Preserve the existing JSON structure unless a change is necessary.

Do not introduce SQLite, PostgreSQL, or another database without discussing the implementation first.

Keep static item information separate from user-specific information such as inventory and wishlist selections.

## 5. Authentication — SSOJet

SSOJet is the designated authentication provider for this project and is being provided by the hackathon.

Do not implement a separate authentication system.

Before implementing authentication:
1. Review the official SSOJet documentation.
2. Identify the correct integration method for our existing technology stack.
3. Determine whether the integration requires a backend.
4. Explain the proposed authentication flow.
5. Identify all required environment variables and configuration.
6. Explain how local development and production authentication will differ.

Official documentation:
https://ssojet.com/docs/en

Important requirements:
- Never expose client secrets, API secrets, or private credentials in frontend JavaScript.
- Never commit `.env` files or credentials.
- Add appropriate environment files to `.gitignore`.
- Never treat frontend-only checks as secure authorization.
- Validate authentication responses and sessions appropriately.
- Implement login, logout, and authentication state handling.
- Handle failed authentication and expired sessions gracefully.
- Configure exact callback URLs for local development and production.

Do not assume that GitHub Pages can securely perform backend authentication operations.

If the existing architecture cannot support the required SSOJet flow, explain the limitations and propose the smallest viable solution before implementing it.

## 6. Hosting and Deployment

The intended hosting platform is GitHub.

Investigate GitHub Pages as the preferred frontend hosting solution.

Requirements:
- The website must work from the deployed repository URL.
- Do not assume the website will be hosted at the root domain.
- Check relative asset paths and JSON fetch paths.
- Ensure navigation works when deployed under a repository subdirectory.
- Ensure all images and scripts load correctly.
- Check that the deployment does not expose credentials.
- Test the production build before recommending deployment.

GitHub Pages is static hosting. If backend functionality is needed, identify an appropriate external hosting solution rather than attempting to run Python or Node.js directly on GitHub Pages.

Do not publish or deploy without explicit approval.

## 7. UI and Design

The website has an intentionally cute, cozy, playful aesthetic inspired by Webkinz.

Preserve this visual identity.

Existing design characteristics:
- Pastel colors.
- Rounded cards.
- Dashed borders.
- Soft shadows.
- Playful buttons.
- Manrope typography.
- Soft pink, blue, and yellow color schemes.

Do not replace the existing visual design with a generic modern dashboard.

Prioritize:
- Consistent styling.
- Responsive layouts.
- Readable item cards.
- Intuitive navigation.
- Accessible buttons and inputs.
- Useful hover and active states.

Mobile responsiveness is important.

## 8. Security

Always consider security when implementing functionality.

- Never expose secrets.
- Never store passwords directly.
- Never trust user-provided IDs or data without validation.
- Never assume a user is authorized simply because the frontend displays an authenticated state.
- Prevent users from accessing or modifying another user's private information.
- Avoid unsafe HTML injection.
- Use textContent when displaying scraped item titles or other untrusted text.
- Validate external URLs and user input.
- Do not add unnecessary tracking or analytics.
- Do not introduce insecure authentication shortcuts just to meet the hackathon deadline.

## 9. Git and Version Control

The project is maintained in GitHub.

Before significant changes:
- Inspect the current Git status.
- Identify uncommitted user changes.
- Avoid overwriting existing work.

Do not:
- Automatically commit changes.
- Automatically push to GitHub.
- Delete branches.
- Rewrite commit history.
- Force push.

When appropriate, suggest logical commits and provide suggested commit messages.

## 10. Testing and Diagnostics

Do not assume code works simply because it was written successfully.

Whenever possible:
- Check browser console errors.
- Check network requests and HTTP responses.
- Verify JSON parsing.
- Verify image loading.
- Test navigation.
- Test buttons and interactive elements.
- Test authentication flows.
- Check responsive layouts.
- Verify deployed paths.
- Run available automated tests.

If something cannot be tested, explicitly state that.

Never claim a feature is fully functional without actually verifying it.

## 11. Priorities

Prioritize work in this order:

1. Make the existing item catalog reliable.
2. Complete item browsing and View All functionality.
3. Implement working wishlist and inventory interactions.
4. Integrate SSOJet authentication.
5. Connect user-specific data to a suitable persistent backend.
6. Make the website responsive and polished.
7. Deploy the working application.
8. Perform final testing and bug fixes.

Do not spend excessive time refactoring working code.

If a requested feature is too large for the remaining time, explain the tradeoffs and recommend a smaller working implementation.

## 12. Working Agreement

Treat the developer as the project owner and decision-maker.

Be proactive:
- Identify problems before they become bigger problems.
- Suggest improvements when they have practical value.
- Explain technical concepts when introducing unfamiliar technologies.
- Recommend simpler alternatives when appropriate.
- Keep track of architectural decisions and existing functionality.

Do not:
- Overcomplicate simple features.
- Make assumptions about intended behavior.
- Introduce technologies just because they are popular.
- Hide limitations or incomplete work.
- Claim that something is finished when it is not.