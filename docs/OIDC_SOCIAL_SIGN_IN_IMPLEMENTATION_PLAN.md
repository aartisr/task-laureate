# Social sign-in and OIDC implementation plan

## Purpose

This document is the implementation plan for letting a Task-Laureate user use an existing identity—such as Google, Microsoft, Apple, GitHub, or Yahoo—instead of creating a new password for this application.

It is intentionally provider-neutral and uses **Supabase Auth as the only authentication broker**. The browser talks only to Supabase. Each external identity provider talks to Supabase, not directly to the Vite application. That boundary keeps provider client secrets out of the browser, gives every sign-in method one Supabase session format, and preserves the existing user-scoped RLS and workspace isolation rules.

This is a plan, not an assertion that authentication can be literally error-free. OAuth/OIDC depends on third-party identity providers, redirect configuration, user consent, network availability, and provider policy. The design below minimizes failure modes, makes failures understandable, and makes every configuration item testable before release.

## What users should experience

The normal path should take one choice and one familiar provider screen:

```text
Continue with Google → Google approves → return to the same Task-Laureate screen → private workspace loads
```

No Task-Laureate password is required for a user who selects a supported provider. Email/password remains an optional fallback only if the product owner wants it.

### Recommended sign-in UX

1. Show a primary `Continue with Google` button first when Google is enabled.
2. Show Microsoft, Apple, and GitHub as recognizable secondary buttons. Do not display ten equal-weight buttons at once.
3. Put the remaining enabled providers under `More ways to continue`; reveal them in a dialog or expandable list.
4. Provide a compact `Use work email instead` field. On submit, route known corporate domains to enterprise SSO; otherwise keep the provider choices available. Do not guess a personal provider from an email address or disclose whether an account exists.
5. Keep `Continue with email` as a fallback only if it is enabled. It must not be presented as an account-creation requirement.
6. After redirect return, show an in-place `Finishing sign-in…` status with a retry option—not a blank Settings page or an unexplained reload.
7. On the account page, show the current signed-in identity as `Signed in with Google` (or the provider display name). Offer `Add another sign-in method` and `Manage sign-in methods` only after a session exists.
8. Never use provider brand assets unless their current branding requirements permit them. Use maintained SVG assets and accessible text labels; do not use emoji as provider identity.

The Settings sidebar is the appropriate durable location for account management. A lightweight `Sign in` call-to-action should also be available wherever a signed-out person first needs private persistence. Do not make people navigate through a deep Settings screen simply to begin a required sign-in.

## Launch set of ten

“Top 10” is audience-dependent, so this is a practical broad-coverage launch set rather than a claim of a universal ranking. Enable only providers that have an owner, a tested callback, and a support path. A short, reliable set is better than a crowded, partially configured login wall.

| Priority | User-facing label | Supabase identifier | Integration type | Notes |
| --- | --- | --- | --- | --- |
| 1 | Continue with Google | `google` | Built-in OAuth/OIDC | Best broad consumer and Google Workspace coverage. |
| 2 | Continue with Microsoft | `azure` | Built-in OAuth/OIDC | Supports Microsoft personal and organization accounts when configured appropriately. |
| 3 | Continue with Apple | `apple` | Built-in OAuth/OIDC | Important for Apple-centric audiences; plan for Apple’s periodic client-secret rotation requirements. |
| 4 | Continue with GitHub | `github` | Built-in OAuth | Strong for technical audiences. |
| 5 | Continue with Facebook | `facebook` | Built-in OAuth | Enable only when the product audience supports it and Meta review requirements are acceptable. |
| 6 | Continue with LinkedIn | `linkedin_oidc` or current Supabase-supported LinkedIn identifier | Built-in OAuth/OIDC | Validate the exact identifier against the current Supabase provider catalog when enabling. |
| 7 | Continue with GitLab | `gitlab` | Built-in OAuth | Useful for engineering and self-hosted-workflow users. |
| 8 | Continue with Slack | `slack` | Built-in OAuth | Useful for work-focused audiences; do not request workspace data merely for sign-in. |
| 9 | Continue with Discord | `discord` | Built-in OAuth | Useful for community-focused audiences. |
| 10 | Continue with Yahoo | `custom:yahoo` | Custom OIDC | Yahoo is not in Supabase’s built-in social-provider list; configure it via custom OIDC. |

Supabase’s supported social-provider catalog includes Google, Apple, Azure (Microsoft), Facebook, GitHub, GitLab, Discord, LinkedIn, Slack, and many others. Use the current catalog—not a hard-coded assumption—when activating a provider. [Supabase social login](https://supabase.com/docs/guides/auth/social-login)

### Not part of the default ten

- **Okta, Ping, OneLogin, Google Workspace, Microsoft Entra tenant SSO:** treat these as organization/enterprise SSO, not social buttons. Use domain discovery and SAML SSO (or an OIDC bridge) per organization.
- **Auth0, Keycloak, Cognito, GitHub Enterprise:** add as a named custom OIDC provider when a customer needs it.
- **Notion, Spotify, Zoom, Twitch, Figma, Bitbucket, X/Twitter:** supported by Supabase or feasible through custom OAuth/OIDC, but should be activated only from evidence of audience demand.

## Architecture

```text
Browser (Vite / Vercel)
    │  publishable key only; no provider secrets
    ▼
Supabase Auth
    │  OAuth/OIDC authorization-code flow, callback, token validation
    ├──────── Google / Apple / Microsoft / GitHub / …
    └──────── Yahoo or another custom OIDC issuer
    │
    ▼
Supabase JWT (user UUID)
    │
    ▼
RLS-protected workspace_snapshots rows
```

The application must continue to use `auth.uid()` / the Supabase user UUID for ownership and RLS. An email address is display data, not an authorization key: it can change, be absent, or be shared in enterprise SSO scenarios. Supabase identifies a sign-in method as an identity attached to a user; a user can have multiple identities. [Supabase identities](https://supabase.com/docs/guides/auth/identities)

### Why this app should use the Supabase JavaScript client for OAuth

The present `supabaseAuth.ts` adapter implements email/password through direct REST calls and imports an implicit-flow session from the URL fragment. It is a sensible small adapter for password auth, but it is not the most robust foundation for a multi-provider OAuth/OIDC rollout.

For this work, use `@supabase/supabase-js` as the Supabase Auth transport inside the existing provider-neutral boundary. It handles provider redirects, PKCE state/code-verifier storage, code exchange, token refresh, cross-tab events, and callback parsing using the supported API. The app should call `signInWithOAuth({ provider, options: { redirectTo } })`, and the callback route should exchange the returned code for a session. Supabase documents the callback/code-exchange requirement for PKCE flows. [Supabase OAuth callback guidance](https://supabase.com/docs/guides/auth/social-login/auth-google)

Do **not** put a Google, Apple, Yahoo, Microsoft, or Supabase service-role secret in `VITE_*`, Vercel client variables, source code, issue comments, logs, or exported workspace files. Only the Supabase URL and publishable key belong in the browser. Provider client secrets reside in Supabase Auth’s provider configuration or a server-side automation secret store.

## Generic application contract

Keep provider catalog data separate from the login UI and separate from Supabase configuration. The browser registry contains no secret and controls only which already-enabled providers are offered.

```ts
export type OAuthProviderId =
  | 'google' | 'azure' | 'apple' | 'github' | 'facebook'
  | 'linkedin_oidc' | 'gitlab' | 'slack' | 'discord' | 'custom:yahoo';

export interface SocialProviderDefinition {
  id: OAuthProviderId;
  label: string;
  category: 'recommended' | 'more' | 'enterprise';
  enabled: boolean;
  icon: 'google' | 'microsoft' | 'apple' | 'github' | 'facebook' | 'linkedin' | 'gitlab' | 'slack' | 'discord' | 'yahoo';
  analyticsName: string; // approved, non-PII event label
}

export interface OAuthAuthProvider extends AuthProvider {
  signInWithOAuth(input: { provider: OAuthProviderId; returnTo?: string }): Promise<void>;
  getIdentities(): Promise<ReadonlyArray<AuthIdentity>>;
  linkIdentity(provider: OAuthProviderId): Promise<void>;
  unlinkIdentity(identityId: string): Promise<void>;
}
```

`AuthProvider` is the generalized replacement for the current password-specific interface. Email/password methods should live in an optional `PasswordAuthProvider` capability so social-only deployments do not carry a misleading registration UI.

Suggested file boundaries:

| Concern | Proposed location | Responsibility |
| --- | --- | --- |
| Provider-neutral contracts | `src/core/contracts/auth.ts` | Session, social-provider, identity, and error types. |
| Provider display registry | `src/config/authProviders.ts` | Labels, order, enabled client-facing flags, icons. |
| Supabase adapter | `src/infrastructure/persistence/supabaseAuth.ts` | `supabase-js` client, OAuth redirect, callback, sessions, identity linking. |
| Callback page/route | `src/pages/AuthCallbackPage.tsx` and router | Exchange code, validate return path, render progress/failure. |
| Sign-in component | `src/components/CloudSyncAuthPanel.tsx` or a renamed `SignInPanel.tsx` | Accessible provider chooser; no protocol logic. |
| Account methods | `src/components/ConnectedAccountsPanel.tsx` | View/link/unlink identities after sign-in. |
| Telemetry interface | `src/core/contracts/telemetry.ts` | Privacy-safe outcome events; never log tokens or authorization codes. |

## Callback and redirect design

Use one fixed callback path per environment:

```text
http://localhost:5173/auth/callback
https://<production-domain>/auth/callback
https://<preview-domain>/auth/callback  (only if preview auth is intentionally enabled)
```

At sign-in start:

1. Capture the in-app destination only if it is a local, allow-listed path such as `/lists/123`.
2. Store it as an opaque local transaction value or encode it in a signed/validated `returnTo` value.
3. Call the Supabase OAuth method with `redirectTo` equal to the fixed callback URL.
4. Redirect the browser to Supabase, then to the external provider.
5. On `/auth/callback`, exchange the authorization code for a session.
6. Verify a session and user UUID exist, then navigate to the validated local destination; otherwise use `/`.
7. Remove OAuth parameters from the address bar and never log them.

The callback must be in Supabase Auth’s redirect allow list and the provider’s registered callback must be the exact Supabase callback displayed in the provider configuration. Exact matching is required by providers such as Google; copy the values rather than manually reconstructing them. [Google OIDC redirect URI guidance](https://developers.google.com/identity/openid-connect/openid-connect)

For Vercel, configure an SPA rewrite so a direct request to `/auth/callback` serves the app entry point, or implement the callback in a Vercel server route. Test this on a production deployment—not only with Vite development fallback behavior. Do not use broad wildcard redirect URLs in production; explicitly allow the production origin and any intentional preview origin.

## Supabase configuration runbook

Perform these steps one provider at a time in a non-production Supabase project first.

### Common prerequisites

1. Add every intended app callback URL to **Authentication → URL Configuration → Redirect URLs** in Supabase.
2. Set **Site URL** to the canonical production app URL.
3. Confirm email and user UUID behavior expected by the app; do not use email as the workspace key.
4. Keep the existing RLS policies enabled and test as `anon`, authenticated user A, and authenticated user B.
5. Use separate Supabase projects for development/preview/production where practical. Every environment needs its own provider registration and callback configuration.
6. Record provider owner, provider-console URL, client ID location, secret rotation date, callback URL, scopes, and test account in a restricted operations vault—not in this repository.

### Built-in providers (Google through Discord)

For each enabled built-in provider:

1. Create an OAuth/OIDC app registration in the provider’s official developer console.
2. Copy the **exact callback URL shown by Supabase** into the provider registration.
3. Request only identity scopes. Start with `openid`, `email`, and `profile` where supported; do not request drive, calendar, Slack workspace, repository, or other product-data access for sign-in.
4. In **Supabase Dashboard → Authentication → Providers**, enable the matching built-in provider and save its client ID and client secret.
5. Add the application’s `/auth/callback` URL to the Supabase redirect allow list.
6. Complete the provider’s publishing/review and test-user requirements before exposing the button in production.
7. Run the provider acceptance test suite below before enabling it in `authProviders.ts`.

Provider-specific operational cautions:

- **Google:** configure consent-screen audience, verified domains, test users during development, and exact redirect URI.
- **Apple:** keep the Apple private key and secret-generation details in a secure operations process; Apple web OAuth client secrets have renewal requirements. [Supabase Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- **Microsoft:** deliberately choose supported account types (organization-only vs organization + personal). Microsoft uses standard OAuth/OIDC and requires an app registration and redirect URI. [Microsoft identity platform app types](https://learn.microsoft.com/en-us/entra/identity-platform/v2-app-types)
- **Facebook/LinkedIn:** factor provider review and privacy-policy requirements into release timing; do not show a production button until approval is complete.
- **Slack/Discord/GitHub/GitLab:** request identity scopes only; separately approved product integrations belong to a different consent flow.

### Yahoo as a custom OIDC provider

Yahoo supports OpenID Connect but is not among Supabase’s built-in provider identifiers. Configure it as a custom OIDC provider:

1. Register a Yahoo application and obtain its client ID and client secret.
2. In **Supabase Dashboard → Authentication → Providers → Custom Providers**, create a provider using auto-discovery (OIDC).
3. Use identifier `custom:yahoo`, display name `Yahoo`, Yahoo’s issuer/discovery configuration, client credentials, and minimal identity scopes: `openid`, `profile`, `email` if Yahoo supports it for the app.
4. Copy the Supabase-provided callback URL to the Yahoo application’s redirect URI configuration.
5. Keep PKCE enabled. Supabase custom providers enable it by default; disabling it is not a normal compatibility fix.
6. Enable the provider only after the callback, consent cancellation, expired session, and existing-user tests pass.

Supabase custom OIDC providers resolve discovery, JWKS, and endpoints from the issuer and validate ID tokens; custom providers use the `custom:` identifier prefix. PKCE is enabled by default. [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers) Yahoo documents its OIDC authorization-code flow and endpoints. [Yahoo OpenID Connect](https://developer.yahoo.com/oauth2/guide/openid_connect/)

### Generic custom OIDC provider template

Use this for Auth0, Keycloak, Cognito, regional providers, or customer identity systems:

```text
Identifier:     custom:<short-lowercase-provider-name>
Type:           OIDC auto-discovery
Issuer:         https://issuer.example.com
Client ID:       from the provider application registration
Client secret:   stored only in Supabase/provider configuration
Scopes:          openid profile email
PKCE:            enabled
Email optional:  false, unless product policy explicitly supports no-email accounts
Callback URI:    copied from Supabase provider configuration
```

Use a manual custom OAuth2 configuration only when the provider genuinely lacks OIDC discovery. It requires explicit authorization, token, and user-info endpoints, increasing operational risk. Custom OIDC is the preferred generic path.

## Account matching and linking

This is the most sensitive UX area. A user may first use Google, then Microsoft, then want both to open the same Task-Laureate account.

1. Let Supabase automatic identity linking handle identities with the same verified email according to its configured security rules.
2. Never implement client-side “same email means same account” merges, and never merge workspaces using email alone.
3. Offer manual **Add another sign-in method** only to an already authenticated user. Make the redirect flow explicit: “You will return here after verifying this account.”
4. After linking, show each identity, its provider, and the last-used date. Require at least one remaining identity before unlinking another.
5. Do not promise that enterprise SSO identities can link to social/password identities; Supabase documents that SAML SSO identities are excluded from normal identity linking for security reasons. [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
6. Treat provider removal as a migration project. Before disabling a provider, prompt affected users to link another method and measure completion; never strand an account without a path back in.

## Enterprise SSO path

Social sign-in is not a substitute for an organization’s identity provider. Add an optional `Continue with work SSO` path that accepts an email domain and calls Supabase SSO only after a known organization mapping exists.

For an enterprise connection, use SAML 2.0 with domain routing, metadata URL/XML, a named organization record, and restrictive RLS based on the provider/tenant claim where needed. Supabase documents SAML SSO setup, domain-initiated sign-in, metadata handling, and the fact that users must be keyed by UUID rather than email. [Supabase enterprise SSO](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)

Do not send arbitrary entered email domains to an IdP discovery endpoint. Return a neutral message such as “Your organization’s sign-in is not configured here. Try another method or contact your administrator.” This avoids account and organization enumeration.

## Security and privacy requirements

- Authorization Code + PKCE is mandatory. Do not use a hand-built implicit flow for the new provider sign-in path.
- Validate callback destinations against a strict local allow list; never redirect to arbitrary `returnTo` URLs.
- Use HTTPS in production, exact redirect URI registrations, and no open redirect wildcards.
- Keep Supabase RLS enabled. Authentication identifies the caller; RLS authorizes the caller’s data access.
- Use the Supabase user UUID as the storage namespace and ownership key. The current account-scoped workspace design must remain in place.
- Do not log access tokens, refresh tokens, authorization codes, `state`, PKCE verifiers, client secrets, passwords, or raw provider error payloads.
- Use neutral sign-in error messages. Preserve a short internal correlation ID for support, not sensitive detail.
- Limit scopes to authentication. Obtain separate consent and product approval for any integration API access.
- Define a secret rotation calendar and a tested emergency disable switch per provider.
- Treat account unlinking and provider removal as high-risk state changes; require fresh authentication for sensitive account-management actions when the security policy calls for it.
- Add a Content Security Policy appropriate for the deployed origin and test it with each redirect flow.

## Observability without identity leakage

Use aggregate, privacy-safe events:

```text
auth_provider_clicked { provider, surface }
auth_redirect_started { provider }
auth_callback_succeeded { provider, duration_bucket }
auth_callback_failed { provider, normalized_error_code }
auth_identity_linked { provider }
auth_identity_unlinked { provider }
```

Never include email, user UUID, OAuth code, token, `state`, raw exception, or provider profile data in client analytics. Operational logs may use a generated correlation ID and a normalized error class such as `provider_disabled`, `callback_not_allowed`, `consent_cancelled`, `network`, `session_exchange_failed`, or `identity_conflict`.

## Implementation phases and definition of done

### Phase 0 — decisions and safeguards

- Confirm the initial audience and which of the ten providers will actually launch.
- Choose whether email/password remains enabled, is hidden, or is removed after provider adoption.
- Establish development, preview, and production provider registrations and secure secret ownership.
- Add a feature flag for each provider; an unconfigured provider never renders.
- Define support copy, privacy policy, terms links, analytics rules, and incident owner.

**Done when:** there is a signed-off provider matrix and no secret is needed in the Vite environment.

### Phase 1 — generic auth foundation

- Add `@supabase/supabase-js` and replace direct OAuth/session handling in `supabaseAuth.ts` with a typed adapter.
- Generalize `PasswordAuthProvider` into capability-based contracts while preserving the app’s existing `AuthSession` and subscription boundary.
- Add `/auth/callback`, safe return-path handling, callback progress, and normalized errors.
- Add a browser registry for enabled provider buttons; no provider-specific branching in the component.
- Keep all persistence and RLS code using the existing authenticated user UUID.

**Done when:** a fake/provider-mocked OAuth flow can sign in, refresh a session, sign out, and never expose another user’s workspace.

### Phase 2 — Google pilot

- Configure Google in development and production Supabase projects.
- Enable only Google in the registry.
- Run manual and automated acceptance tests across desktop/mobile, private window, expired session, cancelled consent, direct callback, and Vercel production.
- Monitor normalized failure rates and support requests before adding more providers.

**Done when:** the Google flow is stable on production, RLS verification passes, and no token appears in logs/URLs after callback completion.

### Phase 3 — remaining built-in providers

- Add Microsoft, Apple, GitHub, and the remaining selected providers one at a time.
- Repeat the complete provider acceptance suite for each.
- Keep buttons behind per-provider feature flags until their review/publishing requirements are complete.

**Done when:** each displayed provider has an owner, working callback configuration in every intended environment, documented secret rotation, and passing tests.

### Phase 4 — Yahoo/custom OIDC and enterprise SSO

- Add Yahoo as `custom:yahoo` after OIDC discovery and callback validation.
- Add custom-provider administration procedures and quota/plan checks.
- Implement enterprise domain routing only when customer demand exists; configure one organization at a time.

**Done when:** custom OIDC and SSO have their own runbooks, test tenants, disable procedure, and support escalation path.

### Phase 5 — connected accounts and migration

- Implement account identity view, link, unlink, and provider-deprecation guidance.
- Test duplicate/verified-email behavior and SAML non-linking behavior explicitly.
- Roll out with measured adoption and an exit path before changing password availability.

**Done when:** a user can safely retain access after adding or removing a provider, and no automatic merge uses email as the authorization key.

## Test plan

### Automated tests

- Provider registry validates unique identifiers, supported icon names, labels, and only enabled providers render.
- Auth adapter unit tests cover redirect initiation, allowed `returnTo`, callback code exchange, session restoration, refresh, sign-out, cancellation, normalized errors, and no token logging.
- Callback route tests reject external return URLs, malformed state, missing code, stale transaction, and duplicate callback completion.
- Existing workspace tests run for user A, user B, signed-out, sign-out, and account-switch paths for every auth event.
- RLS integration tests prove user A cannot read/write user B’s workspace with a valid user A JWT.
- Accessibility tests verify keyboard activation, visible focus, button names, status announcements, error association, reduced-motion behavior, and 320px responsive layout.
- Vercel build test confirms `/auth/callback` is reachable directly after deployment.

### Manual provider acceptance checklist

For every provider and every enabled environment:

1. New user signs in and sees an empty private workspace or only their own existing data.
2. Returning user signs in and sees the same user UUID/workspace.
3. User denies consent and gets a neutral, useful recovery path.
4. Provider session has expired; the app explains what to do without losing local work.
5. Callback URL is copied exactly and succeeds from a direct browser redirect.
6. Mobile and desktop browsers succeed; private/incognito mode works where the provider allows it.
7. Sign-out removes the local session and shows no data until another authenticated user signs in.
8. Account linking/unlinking works; the last usable identity cannot be removed.
9. A malicious external `returnTo` is rejected.
10. Browser history, console, analytics, and logs do not contain codes or tokens.

## Rollback and support playbook

- **Provider misconfigured:** disable its feature flag/button immediately; existing sessions continue until normal expiry unless a security incident requires revocation.
- **Client secret leak:** rotate the provider secret and Supabase configuration, revoke affected provider credentials, investigate logs, and communicate according to incident policy.
- **Callback failure after deployment:** keep email fallback if enabled; revert the redirect/callback change; verify Vercel rewrite and Supabase allow list before re-enabling.
- **Provider retirement:** announce early, prompt affected users to link a different method, measure remaining single-identity accounts, then disable only after an approved migration window.
- **Account-access support:** verify ownership through the approved support process; never merge accounts solely because supplied email addresses match.

## Configuration checklist

Before enabling a provider in production, all boxes must be true:

- [ ] Provider is enabled in Supabase Auth and has a current client ID/secret.
- [ ] Exact Supabase callback URL is registered at the provider.
- [ ] App `/auth/callback` is in Supabase Redirect URLs and works on the deployed origin.
- [ ] No provider secret appears in `.env.local`, Vercel client variables, Git, or logs.
- [ ] Scopes are identity-only and are documented.
- [ ] Provider consent/review/brand requirements are complete.
- [ ] User A/User B RLS and local workspace isolation tests pass.
- [ ] Cancellation, callback failure, expired session, and network failure have user-facing recovery copy.
- [ ] Provider owner, rotation date, support path, and disable switch are documented in restricted operations records.
- [ ] Production acceptance test has passed on desktop and mobile.

## Reference links

- [Supabase social login providers](https://supabase.com/docs/guides/auth/social-login)
- [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [Supabase OAuth callback / PKCE guidance](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase enterprise SSO with SAML](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)
- [Yahoo OpenID Connect guide](https://developer.yahoo.com/oauth2/guide/openid_connect/)
- [Google OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect)
- [Microsoft identity platform application types](https://learn.microsoft.com/en-us/entra/identity-platform/v2-app-types)
