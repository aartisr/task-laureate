# Configure login

This guide configures Task-Laureate login so people can use an existing Google, Microsoft, GitHub, Apple, Yahoo, or other supported account. It is written for an operator configuring Supabase and Vercel—not for someone changing application code.

Task-Laureate uses **Supabase Auth** as the authentication broker. Provider client secrets stay in Supabase. The browser receives only the Supabase project URL and publishable key.

## Before you begin

You need:

- Access to the Task-Laureate repository and its Vercel project.
- Owner/admin access to the intended Supabase project.
- Owner/admin access to each external identity-provider developer console you will enable.
- A production domain, if deploying to production.
- A separate Supabase project for development/preview where practical.

Do not put a provider client secret, Supabase service-role key, database password, refresh token, or `VITE_SUPABASE_ACCESS_TOKEN` in this app. Do not commit `.env.local`.

## 1. Choose the providers you will offer

Start with one provider—normally Google—then add providers one at a time after each passes the validation checklist.

Supported launch identifiers:

| User-facing provider | `VITE_AUTH_PROVIDERS` value | Supabase setup |
| --- | --- | --- |
| Google | `google` | Built-in provider |
| Microsoft | `azure` | Built-in provider |
| Apple | `apple` | Built-in provider |
| GitHub | `github` | Built-in provider |
| Facebook | `facebook` | Built-in provider |
| LinkedIn | `linkedin_oidc` | Built-in provider; verify current identifier in Supabase before enabling |
| GitLab | `gitlab` | Built-in provider |
| Slack | `slack` | Built-in provider |
| Discord | `discord` | Built-in provider |
| Yahoo | `custom:yahoo` | Custom OIDC provider |

The app deliberately shows **no social button** until the corresponding provider is included in `VITE_AUTH_PROVIDERS`. This prevents users seeing a button for a provider that is not configured at Supabase.

## 2. Create local environment configuration

Create `apps/web/.env.local`. It is already ignored by Git.

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_WORKSPACE_ID=development

# Enable only providers you have completed in Supabase.
VITE_AUTH_PROVIDERS=google
```

Restart Vite whenever this file changes:

```bash
npm run dev
```

`VITE_AUTH_PROVIDERS` is public display configuration only. It is not a credential and does not enable a provider by itself.

## 3. Configure Supabase URL settings

In **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to the canonical app URL for this environment.
   - Local: `http://localhost:5173`
   - Production example: `https://tasks.example.com`
2. Add these exact entries under **Redirect URLs**:

   ```text
   http://localhost:5173/auth/callback
   https://tasks.example.com/auth/callback
   ```

3. Add a constrained Vercel Preview wildcard only if preview sign-in is intentionally supported:

   ```text
   https://*-YOUR-VERCEL-TEAM.vercel.app/**
   ```

4. Save the changes.

The application always returns OAuth/OIDC users to `/auth/callback`, exchanges the PKCE authorization code there, removes sensitive URL parameters, and sends the user back to a safe internal route.

## 4. Configure a built-in provider: Google example

Use this as the first provider pilot.

### A. Create Google credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Configure the OAuth consent screen, audience, support email, privacy-policy URL, and any required test users.
4. Create an OAuth web application client.
5. Do **not** invent the callback URL. In the next section, copy the one shown by Supabase and register it exactly in Google.

Google requires an authorized redirect URI to match exactly; a mismatch produces `redirect_uri_mismatch`. [Google OpenID Connect guidance](https://developers.google.com/identity/openid-connect/openid-connect)

### B. Add Google to Supabase

1. Go to **Supabase Dashboard → Authentication → Providers**.
2. Select **Google** and enable it.
3. Copy the callback URL displayed by Supabase.
4. Paste that exact callback URL into Google’s **Authorized redirect URIs** list.
5. Copy the Google client ID and client secret into the Google provider form in Supabase.
6. Save in Supabase.
7. Add `google` to `VITE_AUTH_PROVIDERS` if it is not already there.

```bash
VITE_AUTH_PROVIDERS=google
```

8. Restart local Vite or redeploy Vercel.

### C. Test Google

1. Select **Sign in to sync** in the sidebar (or open `/sign-in`).
2. Select **Continue with Google**.
3. Complete Google sign-in and consent.
4. Confirm that the app returns through `/auth/callback` and ultimately shows the signed-in email in Settings.
5. Create a list, refresh, and verify the workspace remains private to that account.
6. Sign out and confirm the workspace becomes empty until another account signs in. The in-app **Sign out** action is intentionally local to the current browser/device, so it still clears the device session when global server-side token revocation would fail for an expired or stale session.

## 5. Configure other built-in providers

Repeat the Google pattern for Microsoft, Apple, GitHub, Facebook, LinkedIn, GitLab, Slack, or Discord:

1. Register an application in the provider’s official developer console.
2. In Supabase, enable the matching built-in provider under **Authentication → Providers**.
3. Copy the exact Supabase callback URL to the provider registration.
4. Store the provider’s client ID and secret in Supabase.
5. Request only identity scopes (`openid`, `email`, `profile`) where applicable. Do not request calendar, drive, repository, Slack workspace, or other product data merely to sign in.
6. Add the provider identifier to `VITE_AUTH_PROVIDERS`.
7. Redeploy and complete the test checklist.

Example:

```bash
VITE_AUTH_PROVIDERS=google,azure,github
```

### Provider menu configuration

The app has a public provider registry for Google, Microsoft (`azure`), Apple,
GitHub, Facebook, LinkedIn (`linkedin_oidc`), GitLab, Slack, Discord, and
Yahoo (`custom:yahoo`). Only entries that are enabled in both Supabase and
`VITE_AUTH_PROVIDERS` appear. The UI shows at most three first-choice buttons;
the rest stay in a compact, expandable **More sign-in options** section.

For the full requested set:

```bash
VITE_AUTH_PROVIDERS=google,azure,apple,github,facebook,linkedin_oidc,gitlab,slack,discord,custom:yahoo
VITE_AUTH_PRIMARY_PROVIDERS=google,azure,apple
```

`microsoft`, `linkedin`, and `yahoo` are accepted as readable aliases in the
public environment variable. You may choose a different first three without
changing application code, for example `VITE_AUTH_PRIMARY_PROVIDERS=google,github,gitlab`.

For a generic custom OAuth/OIDC provider, configure it in Supabase first, then
give it a deliberate user-facing label in the public list:

```bash
VITE_AUTH_PROVIDERS=google,custom:acme-sso|Acme SSO
VITE_AUTH_PRIMARY_PROVIDERS=google,custom:acme-sso
```

The identifier must match the enabled Supabase custom-provider identifier. The
label is display-only; never put a client secret, issuer secret, or token in a
`VITE_*` value.

Provider-specific notes:

- **Microsoft:** choose the intended supported account types in the Microsoft app registration. [Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/v2-app-types)
- **Apple:** maintain a secure rotation process for the Apple signing key/client-secret configuration. [Supabase Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- **Facebook and LinkedIn:** complete provider review and production/publishing requirements before exposing the button to all users.
- **Slack, GitHub, GitLab, Discord:** identity-only login should not request broader integration permissions.

## 6. Configure Yahoo using custom OIDC

Yahoo is configured as a Supabase custom provider rather than a built-in social-provider identifier.

1. Create a Yahoo developer application and obtain its client ID and client secret.
2. Go to **Supabase Dashboard → Authentication → Providers → Custom Providers**.
3. Choose **New Provider** and select **Auto-discovery (OIDC)**.
4. Enter:

   ```text
   Identifier: custom:yahoo
   Display name: Yahoo
   Type: OIDC auto-discovery
   Scopes: openid profile email
   PKCE: enabled
   ```

5. Enter Yahoo’s issuer/discovery details from its current developer documentation.
6. Copy the Supabase callback URL shown after creating the provider into Yahoo’s registered redirect URI setting.
7. Save and enable the custom provider in Supabase.
8. Add it to the app configuration:

   ```bash
   VITE_AUTH_PROVIDERS=google,custom:yahoo
   ```

9. Restart/redeploy and run the validation checklist.

Supabase custom OIDC uses discovery and validates ID tokens against the provider’s JWKS; PKCE is enabled by default. [Supabase custom OAuth/OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers) Yahoo documents its OpenID Connect authorization-code flow separately. [Yahoo OIDC guide](https://developer.yahoo.com/oauth2/guide/openid_connect/)

## 7. Configure Vercel

In **Vercel → Project Settings → Environment Variables**, set the client-safe values for the correct targets.

| Variable | Production example | Preview recommendation |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Production Supabase URL | Separate Preview Supabase URL when possible |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production publishable key | Preview project publishable key |
| `VITE_SUPABASE_WORKSPACE_ID` | `production` | `preview` if deliberately sharing a project |
| `VITE_AUTH_PROVIDERS` | `google,azure,github` | Same tested subset, or unset to hide social sign-in |

After adding/changing variables, deploy again. Vite embeds `VITE_*` values at build time; changing Vercel settings does not alter an existing deployment.

The committed Vercel rewrite already serves the SPA for `/auth/callback`. Verify it by opening `https://YOUR_DOMAIN/auth/callback` directly: it should display the sign-in completion page, not a 404.

Do not set a private npm registry in the repository or Vercel project. The committed npm configuration and lockfile use the public npm registry.

## 8. Validate before enabling a provider for everyone

Run every item for each provider and environment.

- [ ] The provider button appears only after it is enabled in both Supabase and `VITE_AUTH_PROVIDERS`.
- [ ] Login succeeds in a new browser/private window.
- [ ] Cancelled consent gives a neutral retry message and does not leak a raw provider error.
- [ ] The callback completes at `/auth/callback` and ends on an in-app URL.
- [ ] Browser history and console do not retain authorization codes or tokens after callback completion.
- [ ] The user’s email/account appears in Settings after sign-in.
- [ ] A new list persists after refresh and appears only to that authenticated account.
- [ ] User A cannot see User B’s Lists or Tasks after sign-in, account switch, or sign-out.
- [ ] Sign-out removes access to the private workspace on that browser.
- [ ] Desktop, mobile, and production Vercel deployment all pass.
- [ ] The provider client secret is present only in the provider console/Supabase, never in Git, `.env.local`, or a `VITE_*` variable.

Run the local test suite before deployment:

```bash
npm run test
npm run lint
npm run build
```

For the live Supabase CRUD check, use a dedicated non-production user token:

```bash
SUPABASE_TEST_ACCESS_TOKEN='user-jwt' npm run test:supabase -w apps/web
```

## Troubleshooting

| Problem | Likely cause | Resolution |
| --- | --- | --- |
| Provider button is absent | Provider is not in `VITE_AUTH_PROVIDERS`, or Vite/Vercel was not restarted | Add the exact identifier and rebuild/redeploy. |
| `redirect_uri_mismatch` | The provider callback differs from the registered URL | Copy the exact callback URL from Supabase into the provider console. |
| Callback shows a retry message | `/auth/callback` is not allowed or the authorization code has expired/was reused | Check Supabase Redirect URLs, Vercel route rewrite, then start a fresh sign-in. |
| Button starts then returns without sign-in | Provider is disabled or credentials are wrong in Supabase | Enable the provider and recheck client ID/secret in Supabase. |
| Users see no data after successful sign-in | The user has no workspace data yet, or the app points to another Supabase environment | Confirm environment variables, RLS migration, and account email/UUID. |
| User A sees User B data | This is a security issue | Disable the affected deployment, verify RLS, and follow [Supabase persistence](SUPABASE_PERSISTENCE.md) before re-enabling. |
| Vercel works but local does not | Local callback URL was omitted | Add `http://localhost:5173/auth/callback` to Supabase Redirect URLs. |

## Related documentation

- [OIDC and social sign-in implementation plan](OIDC_SOCIAL_SIGN_IN_IMPLEMENTATION_PLAN.md)
- [Supabase persistence and RLS setup](SUPABASE_PERSISTENCE.md)
- [Vercel deployment configuration](VERCEL_DEPLOYMENT.md)
- [Supabase social login](https://supabase.com/docs/guides/auth/social-login)
