# PWA release and installation guide

This guide takes Task-Laureate from a working deployment to an installable app
on phones, tablets, and desktop browsers. A PWA is distributed from its HTTPS
URL: users do **not** download an `.ipa` or `.apk`, and no app store review is
needed for home-screen installation.

## The next step

Deploy the current branch to the production HTTPS domain, then complete the
real-device checks in this guide. The application already contains its manifest,
platform icons, install experience, and service worker. Those only become
installable when they are served from the final secure origin.

For the existing Vercel setup:

1. From the repository root, run the release checks:

   ```sh
   npm run verify:production
   npm run lint
   npm test
   npm run build
   ```

2. Commit and push the changes to the branch connected to the Vercel project,
   or create a deployment from the Vercel dashboard with **Root Directory** set
   to `apps/web`.
3. In Vercel, assign the production domain (currently intended to be
   `https://tasks.ai-aarti.com`) and wait for its TLS certificate to be active.
4. Open the final `https://` URL once in a normal browser. Do not test from a
   `file:` URL or an IP address: they are not installable PWA origins.

The broader environment, database, authentication, and release requirements
remain in [OPERATIONS.md](OPERATIONS.md).

## What ships with the PWA

| Capability | Production behavior |
| --- | --- |
| App identity | 192px, 512px, maskable Android, and Apple touch icons derived from the Infinity logo |
| App launch | Opens standalone, without ordinary browser controls where supported |
| Installation | Native install prompt on compatible Android/Chromium browsers; explicit iOS home-screen instructions where iOS does not provide a programmable prompt |
| Offline resilience | Previously visited app shell and static assets remain available; a friendly reconnect screen appears before the first successful visit or when a route is unavailable |
| Data safety | API responses and cross-origin data calls are never placed in the app-shell cache |
| Push | The same worker owns web-push notifications, so notifications and offline support cannot compete for the root service-worker scope |
| Updates | The worker is fetched without HTTP caching. A new version waits for an unobtrusive **New version available** prompt; users choose Reload when they are ready, avoiding mid-session asset changes |

Offline access does not make the cloud service fully offline-first. A user needs
a network connection for sign-in, syncing, and data that has not already been
stored locally by the application.

## Release verification

Perform these checks against the **production origin**, not only a Vercel preview.
Use an ordinary non-private browser window; private browsing can limit storage
and PWA behavior.

### 1. Network and PWA files

Open each URL and confirm it returns `200` over HTTPS:

```text
https://<your-domain>/manifest.json
https://<your-domain>/service-worker.js
https://<your-domain>/icons/task-laureate-192.png
https://<your-domain>/icons/task-laureate-512.png
https://<your-domain>/icons/task-laureate-maskable-512.png
https://<your-domain>/icons/apple-touch-icon-180.png
```

In Chrome or Edge desktop DevTools:

1. Open **Application** → **Manifest**. Confirm the app name, icons, start URL,
   and no manifest errors.
2. Open **Application** → **Service Workers**. Confirm `/service-worker.js` is
   activated and controls the page.
3. Open the site, then in DevTools enable **Offline** and reload. The app shell
   should still render after the first online visit.
4. Disable Offline and ensure normal sign-in and sync recover.

Do not leave DevTools’ **Update on reload** or **Bypass for network** enabled
when doing final behavior checks.

### 2. Android acceptance test

Test at least Chrome on a physical Android phone; Samsung Internet and Edge are
useful secondary checks.

1. Open `https://<your-domain>` in Chrome.
2. Wait briefly for the install prompt, then select **Install**. If it was
dismissed, use Chrome’s three-dot menu and select **Install app** or **Add to
Home screen**.
3. Confirm the supplied Infinity icon appears on the launcher.
4. Launch from the launcher. It should open as Task-Laureate rather than as a
regular browser tab.
5. Close it, enable airplane mode, and reopen it. The visited app shell should
remain available.
6. Reconnect, create or update a test task, and confirm sync succeeds.
7. If browser alerts are enabled for the environment, opt in only after the
PWA is installed, then send a safe test reminder and confirm its tap opens the
expected task route.

### 3. iPhone and iPad acceptance test

Use a physical iPhone and iPad when possible. Safari is the clearest supported
path and should be the documented user instruction.

1. Open `https://<your-domain>` in Safari.
2. Confirm the small in-app installation card explains **Share → Add to Home
   Screen**.
3. Tap Safari’s **Share** button, then **Add to Home Screen**.
4. Keep the displayed name as `Task-Laureate`, select **Add**, and confirm the
   Infinity icon appears on the Home Screen.
5. Launch from that icon. It should open as a standalone app.
6. Reopen it after enabling airplane mode; verify the visited shell is usable
   and the reconnect state is clear and non-destructive.
7. Reconnect, sign in, and verify a task update syncs normally.

iOS does not expose the Android-style `beforeinstallprompt` API. The guided
Share-sheet instruction is intentional; do not add a fake button that claims to
install the application automatically.

### 4. Desktop and other platforms

Chrome and Edge on Windows, macOS, Linux, and ChromeOS normally show an install
control in the address bar or menu once eligibility is met. Safari on recent
macOS supports **File → Add to Dock**. Treat those as progressive enhancements:
the website remains fully usable on browsers that do not offer installation.

## Copy for your website, release notes, and support

Use platform-specific wording so users never reach a dead end:

> **Install Task-Laureate** — Keep your focused workspace one tap away. On
> iPhone or iPad: open in Safari, tap Share, then Add to Home Screen. On
> Android: tap Install when prompted, or choose Install app from your browser
> menu.

Put this copy in the support page, onboarding email, release announcement, and
any help-center article. Do not imply that users must visit an app store.

## Deployment and update operations

### Normal release

1. Deploy the new version normally.
2. Confirm `/service-worker.js` has `Cache-Control: no-cache, no-store,
   must-revalidate` in the production response headers.
3. Test one existing installed app after closing it completely and reopening it.
   The new worker should then activate and clean up prior Task-Laureate caches.

The worker intentionally does not force activation while a user is working. It
prevents an update from replacing loaded JavaScript halfway through editing a
task. If an urgent incident requires a stronger action, deploy a fixed worker,
ask users to close and reopen the app, and communicate the incident clearly.

### Rollback

Rollback through the normal Vercel deployment controls or redeploy the prior
known-good commit. Then test a previously installed app after closing and
reopening it. Do not instruct users to clear storage unless that is necessary:
clearing site data also signs them out and can remove pending local state.

## Troubleshooting

| Symptom | Likely cause and action |
| --- | --- |
| No Android install option | Confirm HTTPS, `manifest.json` is `200`, the browser can load the 192px and 512px PNGs, and the app is not already installed. Test outside Incognito. |
| Wrong or blank launcher icon | Confirm the icon URLs above respond with an image, then remove and reinstall the app after the new deployment reaches the device. |
| iPhone does not show an automatic install prompt | Expected behavior. Use Safari’s Share → Add to Home Screen flow. |
| Offline launch shows reconnect page | The app has not been opened successfully while online, or that route/assets were not yet cached. Connect once, open the route, then retest. |
| New release is not visible immediately | Choose **Reload** on the in-app update prompt. If the prompt was dismissed or unavailable, fully close every open Task-Laureate window and reopen it. |
| Push alerts stopped after PWA release | Confirm `VITE_VAPID_PUBLIC_KEY` is set, browser permissions remain granted, and the active worker is `/service-worker.js`, not the retired push-only worker. |

## Optional app-store distribution

Home-screen installation is the recommended first release: it is immediate,
cross-platform, and requires no store account. If a later business requirement
demands store discovery, package this PWA in a platform-specific store workflow
and complete each store’s review, privacy, billing, and policy requirements.
That is a separate distribution project; it is not required for users to install
Task-Laureate from the web.
