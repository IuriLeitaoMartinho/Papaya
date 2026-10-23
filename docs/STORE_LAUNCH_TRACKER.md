# Papaya store launch and advertising progress

Last updated: 23 October 2026  
Baseline: commit `92a305c`  
Release decision: **Not ready for store upload**  
Launch model confirmed by owner: **Free with ads; neither developer account exists yet**

Use this as the editable working document. Check a task only when its acceptance evidence exists. A completed research task does not mean the implementation is complete. Keep passwords, signing keys, payment details and real family records out of this file.

## Decisions and open choices

| Topic | Current position | Decision owner |
| --- | --- | --- |
| Pricing | Free with advertising, confirmed | App owner |
| Store accounts | Google Play and Apple accounts still to create | App owner |
| Mobile packaging | Recommend Capacitor with bundled guide content | App owner and developer |
| Mobile ads | Recommend AdMob native SDK integration | App owner and developer |
| Website ads | AdSense is a separate optional workstream | App owner |
| Audience | **Decided 2026-10-21:** adult parents and caregivers (18+), not directed at children; written for both parents, the father's angle shows in the text, not in the store title | App owner |
| Initial countries | **Decided 2026-10-21:** Portugal only at launch | App owner |
| Publisher identity | **Decided 2026-10-21:** individual (pessoa singular) with an open self-employment activity in Portugal; declares EU trader status; health-app account risk accepted (see A2) | App owner |
| iOS devices | **Decided 2026-10-21:** iPhone only at launch; Android phones and tablets both allowed | App owner |
| Store name | **Decided 2026-10-21:** `Papaya: bebé dos 0 aos 2 anos` (29 characters) on both stores; Google developer name `Papaya Bebé` | App owner |
| Ad format | Recommend one banner on approved non-urgent screens; no launch interstitials | App owner |
| Health-content review | Qualified reviewer still to be assigned | App owner |
| Domain | **Decided 2026-10-21:** `papayabebe.pt` (not yet registered), set as the custom domain of this repository's GitHub Pages site | App owner |
| Ad income tax | **Decided 2026-10-21:** owner already invoices Irish clients under the open activity; no change expected | App owner |

The existing app is a static PWA. No native projects, advertising SDK or consent platform was found. AdSense and AdMob solve different distribution cases: [Google's product comparison](https://support.google.com/admob/answer/9234653).

## Work completed during the assessment

- [x] Read app structure, persistence, backup/import, timer, offline cache and publication notes.
- [x] Confirmed no Android/iOS packaging in the checkout.
- [x] Ran existing content validation: 16 chapters, 76 tips, 10 searches and 39 offline resources passed.
- [x] Ran syntax checks on 12 app JavaScript modules and `sw.js`.
- [x] Reproduced acceptance of an impossible date in a synthetic backup.
- [x] Reproduced acceptance of markup-bearing member IDs/colours; identified unescaped attribute rendering.
- [x] Reproduced an unhandled storage-write failure using a mock, without changing real user data.
- [x] Researched current store, health, advertising and consent requirements.
- [x] Recorded the owner's free-with-ads launch choice.

No implementation fixes, account registrations, native builds, live-site tests or store submissions have been completed by this assessment.

## How to add advertising to this project

### Choose the integration by distribution channel

| Channel | Recommended product | Integration boundary |
| --- | --- | --- |
| Public website or installed browser PWA | AdSense, after site approval | Web script and permitted DOM ad slots |
| Android and iOS store app | AdMob | Native Google Mobile Ads SDK through a compatible bridge |
| Web ads inside an app WebView | Separate advanced option | Follow Google's WebView advertising requirements; do not assume a normal website tag is sufficient |

For the current store goal, prioritize AdMob. Adding an AdSense script to `index.html` does not create store-ready binaries or implement native AdMob. Google provides a [WebView advertising integration path](https://developers.google.com/admob/android/browser/webview), but its network-hosted web-content assumptions are a poor match for Papaya's proposed bundled, offline guide.

### AdSense implementation sequence for the PWA

1. **Prepare the public website.** Confirm the deployed HTTPS URL, ownership and actual content visible to a new visitor. Publish About, Privacy, Support and medical-limit/source information. Check [AdSense eligibility](https://support.google.com/adsense/answer/9724); approval depends on compliant, original, useful content, not simply installing a tag.
2. **Make public content inspectable.** Papaya uses JavaScript, fetched Markdown and hash routes. Verify that Google's site-review/crawling tools can discover and read the guide. If they cannot, generate public HTML chapter pages from the existing Markdown. This is a recommendation to improve accessibility and discoverability, not a claim that every SPA is disallowed.
3. **Create or connect the AdSense account and add the site.** Use the account's actual publisher identity. Confirm whether you already have an eligible publisher account rather than creating duplicates. Complete the account's identity/payment requirements as requested.
4. **Verify site ownership.** The account provides supported choices such as a code snippet, meta tag or `ads.txt`. A verification meta tag can separate ownership verification from ad loading. Follow the exact [site-connection instructions](https://support.google.com/adsense/answer/7584263).
5. **Publish `ads.txt` at the domain root.** Use the exact account-provided seller line. A GitHub Pages project path is not necessarily the domain root. Test the public `https://YOUR-DOMAIN/ads.txt` URL and the account's detection status. This is different from AdMob's `app-ads.txt`.
6. **Configure the web consent platform.** Use a Google-certified CMP meeting the current European requirements. Configure the actual vendors, privacy-policy link, language, refusal and revisiting choices. Follow [AdSense consent requirements](https://support.google.com/adsense/answer/13554116). Non-personalized ads are not a blanket exemption from storage/consent rules.
7. **Create a dedicated web advertising module.** Load the account-generated AdSense script once through the supported CMP integration. Do not blindly load ad requests before the required consent handling. Keep publisher/ad-unit settings separate from family data. Never place private profile values in URLs or targeting.
8. **Add a controlled placement.** Start with a manually selected slot on a non-urgent, content-rich screen. Avoid site-wide Auto ads initially because hash routes, emergency links and fixed timer/navigation bars require precise placement. Route changes must clean up slots without repeatedly injecting the script, creating duplicate requests or implementing artificial refresh.
9. **Fix the service worker.** Cache only intended first-party app assets and successful responses. Do not cache advertising, consent or verification traffic. Bump the cache version and test upgrades from the current `papaya-v21`.
10. **Submit the site for review.** Only consider web monetization ready after the site is approved and marked Ready. See [site management and approval](https://support.google.com/adsense/answer/12131223).
11. **Verify production behavior.** Confirm no overlays, accidental-click layouts, unwanted ads on excluded routes or blank offline screens. Never click your own live ads or ask testers to generate revenue.

### AdMob implementation sequence for Android and iOS

1. Build the Capacitor shell and verify an ad-free release candidate first. Produce Android and iOS projects with stable identifiers and a reproducible web asset directory.
2. Create the AdMob account and separate Android and iOS app entries. Create platform-specific ad units. Keep **app ID**, **ad unit ID** and **publisher ID** distinct; they are used in different places.
3. Evaluate [`@capacitor-community/admob`](https://github.com/capacitor-community/admob). It is a community bridge, not Google's official Capacitor SDK. Pin mutually compatible Capacitor/plugin/native SDK versions and inspect current setup instructions before installing. Record versions and licenses below.
4. Add a bundling step if importing npm modules into the current plain browser JavaScript. A bare package import will not automatically work in the existing static deployment. Separate web and native adapters so browser startup does not call unavailable native APIs.
5. Configure the Android app ID in the native manifest and the iOS app ID/configuration in `Info.plist` as required by the chosen SDK. Audit Android's merged permissions and any advertising-ID declaration. Configure iOS attribution identifiers only as required by the current integration.
6. Configure AdMob Privacy & messaging and integrate UMP. Refresh consent information on startup, display required forms and use `canRequestAds` or the equivalent supported API before requesting ads. Provide a privacy-options control when required. Avoid duplicate initialization/ad requests across callbacks. See [UMP integration](https://developers.google.com/admob/android/privacy).
7. Decide whether the iOS build tracks under Apple's definition. If it does, implement ATT and the purpose string. Consent in a CMP does not replace ATT. If tracking is denied or restricted, respect that choice and use only a compliant configuration. See [Apple tracking rules](https://developer.apple.com/app-store/user-privacy-and-data-use/) and [AdMob iOS configuration](https://developers.google.com/admob/ios/privacy/strategies).
8. Show an adaptive banner only on an explicit allowlist of safe screens. Hide/remove it on emergency guidance, symptom triage, personal logs, settings, consent, imports and input forms. Recalculate reserved layout space for rotation, safe areas and keyboard changes. Test interactions with the fixed navigation, feeding and sleep bars.
9. Use official test ad units and test devices in development. Follow [Google's test-ad instructions](https://developers.google.com/admob/android/test-ads). Exercise consent testing without using real family data.
10. Publish `app-ads.txt` using the seller entry supplied by AdMob at the website root discovered from the store listing. Complete [app ownership verification](https://support.google.com/admob/answer/14538460), link the store listings and pass [AdMob app readiness review](https://support.google.com/admob/answer/15948559). Store review and ad-serving review are separate.
11. Complete Data safety and App Privacy using the **final SDK versions and configuration**, not a generic template. SDKs can transmit IP-derived location, identifiers, diagnostics and interaction data. Consult [Android disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure) and [iOS disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure).
12. Enable production ad units only after release checks pass. Verify the app remains fully usable when consent is refused, ads fail, no ad is available, or the device is offline. Recheck every SDK upgrade for data and manifest changes.

### Proposed advertising control flow

This is architecture pseudocode, not executable code or an implemented consent solution.

```text
Start core Papaya UI independently of advertising
  Determine web or native build
  Restore no sensitive user data into advertising configuration
  Refresh the selected CMP's consent state
  Present any required consent flow
  Native iOS only: resolve ATT if the chosen configuration requires it
  Ask the supported consent API whether ad requests are permitted
  If permitted and online and route is allowlisted:
      initialize the platform's ad adapter once
      show one placement with reserved layout space
  Otherwise:
      leave core functionality available without an ad

On route change, consent change or app resume:
  re-evaluate eligibility
  hide/remove disallowed ads
  follow SDK refresh rules; do not invent a refresh loop
```

Do not send child names, dates of birth, sleep/feeding data, symptoms, relationship notes or backup data to advertising SDKs, custom targeting or diagnostic logs. This is a design boundary to verify in network tests, not a property guaranteed merely by using native ads.

## Proposed file changes

All paths in this section are relative to the app root `GitPage/Papaya`. These are plans, not files created by the assessment.

| File or area | Planned change | Acceptance evidence |
| --- | --- | --- |
| `package.json` and build configuration | Pin build/platform/bridge dependencies; generate a clean asset directory | Reproducible fresh install/build; lockfile committed |
| `capacitor.config.*`, `android/`, `ios/` | Native identifiers, versions, signing references and platform projects | Signed test builds install |
| `js/ads.js` with platform adapters | Single advertising coordinator, safe routes, lifecycle, failure handling | Web/native tests and no duplicate ads |
| `js/privacy.js` | Consent/privacy-options integration | Acceptance/refusal/withdrawal tests |
| `js/app.js` | Privacy/support/about/erase entry points; route-aware ads | Settings and navigation verified |
| `js/armazenamento.js` | Strict import validation, safe writes and persistence migration | Invalid input and write-failure tests |
| `js/temporizador.js` | Native reminders if promised | Background/lock/reboot tests |
| `index.html` | Revised privacy wording; web verification/loader integration as appropriate | Accurate public claims and consent behavior |
| `css/estilo.css` | Ad placement spacing independent of fixed controls | Small-screen and large-text screenshots |
| `sw.js` | Same-origin asset allowlist, successful-response caching, no ad caching | Offline and failed-response tests |
| Public privacy/support/about pages | Publisher information, data/ads explanation, contacts and medical limits | Public HTTPS URLs; accessible in app |
| Domain-root `ads.txt` and `app-ads.txt` | Correct seller authorizations if corresponding product used | AdSense/AdMob detects valid files |
| App icon and listing assets | Native icons, Play graphic, platform screenshots | Store validation and visual review |

## Milestone A Identity and account setup

- [ ] **A1** Assign the legal publisher and confirm name/brand rights. Owner: app owner. Done when ownership and public seller identity are recorded. *2026-10-21: publisher is the owner as an individual; the App Store will show the owner's legal name as seller, Google Play shows `Papaya Bebé`. Store search (Play and App Store, PT/US) found many "Papaya" apps (Papaya Global, Papaya Insurtech, "Papaya for HS" in Health & Fitness, Papaya Gaming titles) but none for babies or parenting. Still open: trademark search (INPI, EUIPO) for "Papaya" in the relevant classes.*
- [ ] **A2** Confirm personal versus organization eligibility for the actual health features. Owner: app owner. Done when the route is justified against [Google account guidance](https://support.google.com/googleplay/android-developer/answer/13634885) and [Apple review rules](https://developer.apple.com/app-store/review/guidelines/), with support confirmation if needed. *2026-10-21: owner chose a personal account knowing the risk. Google says an organization account should be chosen for "Health apps, such as Medical apps and Human Subjects Research apps", and its [health categories](https://support.google.com/googleplay/android-developer/answer/13996367) define medical apps as providing "medical information, resources, or tools". Apple 5.1.1(ix) asks for a legal entity when an app provides services in healthcare or requires sensitive user information. Papaya provides no medical service and keeps data on the device, so the case is arguable, not settled. Asking both stores in writing first was offered and declined. If either store requires an organization, reopen the company decision (or ship on the other store first). Both texts read at source on 2026-10-21.*
- [ ] **A3** Create and verify Google Play Console. Owner: app owner. Depends on A2. Done when account verification and any device verification pass. *Personal account created after 13 Nov 2023: production needs a closed test with at least 12 testers opted in for 14 continuous days ([source](https://support.google.com/googleplay/android-developer/answer/14151465)). Owner will gather 12 Android testers; their phones double as the physical-phone tests.*
- [ ] **A4** Enroll in Apple Developer Program. Owner: app owner. Depends on A2. Done when membership and App Store Connect access are active. *Declare EU trader status; as an individual Apple displays address or P.O. box, phone and email ([source](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements)). Owner will use a CTT P.O. box (apartado), not the home address. Google's equivalent display rules not yet confirmed at source.*
- [ ] **A5** Arrange Mac/macOS build access and physical Android/iPhone devices. Owner: app owner. Done when test builds can be built and installed. *2026-10-21: owner has a Mac, an iPhone and an Android tablet (no Android phone; emulator for phone screenshots, closed-test testers for real phones). The Mac must run macOS Tahoe 26.2+ for Xcode 26.4.1 and later (Sequoia 15.6 covers Xcode 26.0-26.3, [source](https://developer.apple.com/xcode/system-requirements/)); macOS version not yet confirmed.*
- [x] **A6** Confirm countries, adult target audience, iPad support, package/bundle IDs and release name. Owner: app owner and developer. *Done 2026-10-21: Portugal only; adults 18+; iPhone only on iOS, phones and tablets on Android; ID `pt.papayabebe.app` on both platforms; store name `Papaya: bebé dos 0 aos 2 anos`. See the decisions table and register.*
- [ ] **A7** Secure a developer website/domain and support email. Owner: app owner. Done when public root files and pages can be published. *2026-10-21: chosen `papayabebe.pt` (no DNS on 2026-10-21; `papaya.pt` is taken); confirm availability with the .pt registry when buying. Pick a registrar that includes a mailbox, or forwarding plus sending, so `suporte@papayabebe.pt` can reply without exposing a personal address. The domain becomes the custom domain of this repository's Pages site: the PWA moves from `iurileitaomartinho.github.io/Papaya` (live, still `papaya-v21`) to `https://papayabebe.pt/`, with privacy/support pages and `app-ads.txt` in the same repository. Existing installs keep their data under the old origin and must export and import once. GitHub Pages forbids sites "primarily directed at either facilitating commercial transactions"; an information site for a free app fits, but revisit hosting if web AdSense (milestone D) is chosen.*

Standard account budget: Google US$25 once; Apple US$99/year or local pricing. About US$124 in the first year before taxes, local pricing and other resources. Sources: [Google registration](https://support.google.com/googleplay/android-developer/answer/6112435), [Apple membership](https://developer.apple.com/programs/whats-included/).

## Milestone B Data safety and content

- [x] **B1** Fix attribute injection from imported IDs/colours and audit other imported HTML sinks. Owner: developer. Done when malicious attribute text stays inert and invalid colours/IDs are rejected. *Done 2026-10-20: every imported id must match `[A-Za-z0-9:_-]{1,80}`, colours must be `#RRGGBB`, so all `data-id`/`data-ritual`/`style` sinks receive only safe values; member colour/id are also escaped where rendered (`js/app.js`, `js/tarefas.js`). Evidence: `tests/validar-backup.mjs`; browser import of a hostile file rejected with "Nada foi alterado".*
- [x] **B2** Validate real dates, times, timestamps, sizes and duplicate identifiers. Owner: developer. Done when impossible/malformed values fail without changing stored data. *Done 2026-10-20: real calendar dates (1900-2200), `HH:MM` within 00:00-23:59, sleep instants after 2000 and at most one day ahead, licence values from the allowlist, text limits (500/10 000), lists up to 50 000, no duplicate ids, files over 5 MB refused. Legacy v1-v4 and replace/merge retested. Evidence: `node tests/validar-backup.mjs` (31 tampered files refused, state unchanged).*
- [x] **B3** Handle storage failures and interrupted multi-record imports. Owner: developer. Done when errors are visible and records are not silently partially replaced. *Done 2026-10-20: every write (including the timer and in-progress sleep keys) goes through `escrever()` in `js/armazenamento.js`, which never throws and shows one warning per failure streak, advising export. Import builds the new state apart, writes the six keys, rolls back the ones already written if one fails, and only then swaps the in-memory state; the user sees "Nada foi alterado". The Chama `rev` now only rises after import. Also fixed: removing a member now saves the tasks it reassigns. Evidence: `tests/validar-backup.mjs` (a failure at each of the six writes, in both modes, leaves disk and memory unchanged); browser with `setItem` forced to throw: sleep start/stop still work, one warning, import refused with the message, no uncaught errors in two clean runs. Limit: if the rollback writes themselves fail, nothing more can be done in localStorage; native storage (B5) is the long-term answer.*
- [ ] **B4** Implement complete local-data deletion and active-notification cleanup. Owner: developer. Done when app restart cannot restore erased data; export-copy limits are explained.
- [ ] **B5** Define native storage, migration and backup security. Owner: developer. Done when restart/upgrade/import recovery passes on both platforms.
- [ ] **B6** Complete qualified review of the health gaps in `investigacao/revisao-publicacao-2026-10-13.md`. Owner: content reviewer. Done when sources, dates and reviewer signoff are recorded.
- [ ] **B7** Verify current Portugal-specific legal/benefit information. Owner: content reviewer. Done when claims match current primary sources and dependent UI cards.
- [ ] **B8** Publish policy/support/about pages and update broad local-only wording for advertising. Owner: app owner and developer. Done when page URLs and final data flows agree.
- [ ] **B9** Add appropriate health limitations in-app and in listings. Owner: content reviewer. Done when they meet [Google health policy](https://support.google.com/googleplay/android-developer/answer/16679511) and accurately describe the product.
- [ ] **B10** Complete content, artwork and dependency-license review. Owner: app owner and developer. Include Fuse.js distribution notices.

## Milestone C Native app and advertising implementation

- [ ] **C1** Add reproducible Capacitor packaging and a clean bundled asset directory. Owner: developer. Depends on A6. *Android done 2026-10-23; iOS pending (needs the Mac). Capacitor 8.5.3 and `@capacitor/app` 8.1.2 pinned exactly, with `package-lock.json`; `capacitor.config.json` (`pt.papayabebe.app`, "Papaya", `webDir: www`). `scripts/preparar-www.mjs` copies exactly the `ASSETS` list of `sw.js` into `www/`; `tests/validar-pacote.mjs` checks this (38 files, byte-identical, nothing extra, stale files removed). `android/` generated (minSdk 24, compile/target 36, AGP 8.13.0, Gradle 8.14.3). Native build skips the service worker; Android back closes the open sheet, then goes back, then exits. Two defects found on the emulator and fixed: scrolled text ran under the status bar (edge-to-edge), and in dark mode the status bar icons stayed dark (now `SystemBars.setStyle` follows the app's theme). `_config.yml` keeps `android/`, `ios/`, `scripts/` and npm files off GitHub Pages. Evidence: debug APK on the API 37 emulator in airplane mode (no network confirmed): guide, chapters and search ("febre") work; a sleep started, survived a force-stop, stopped after 1 min and survived another force-stop; 112 opens the dialer; back button by real taps chapter -> Guia -> Hoje -> exit; light, dark and app-forced dark status bars checked by screenshot; APK has no `.so` files (16 KB rule not applicable). Web check: `papaya-v24` service worker still registers in the browser, no console errors. Not yet tested: the owner's Android tablet, any iOS build. Build note: the project needs JDK 21; Android Studio's bundled JDK 25 fails with Gradle 8.14.3. Build-time `npm audit`: 3 moderate (uuid via `@capacitor/cli`), not shipped in the app; the suggested fix downgrades the CLI, so it was not applied.*
- [ ] **C2** Produce Android release configuration targeting API 36 or later and validate 16 KB compatibility. Owner: developer. Evidence: merged manifest, bundle analysis and device/emulator result.
- [ ] **C3** Produce iOS archive with Xcode 26+/iOS 26+ SDK and supported deployment target. Owner: developer. Evidence: Xcode archive validation.
- [ ] **C4** Adapt file export/import and PWA-to-native record transfer. Owner: developer. Evidence: round-trip files on Android and iPhone.
- [ ] **C5** Implement/test native notification behavior or narrow feature promises. Owner: developer. Evidence: background, denial and restart tests.
- [x] **C6** Repair service-worker caching and test update behavior. Owner: developer. Evidence: failed HTTP responses do not destroy working offline assets; ad requests are not cached. *Done 2026-10-20 (`papaya-v23`): only same-origin GETs are handled (other domains and POSTs go straight to the network); only 200, non-redirected responses for files in `ASSETS` are cached, under the URL without query string; a 404/500 or network failure serves the cached copy; activation deletes only old `papaya-*` caches. Evidence: `tests/validar-sw.mjs` runs the real `sw.js` against simulated network and caches (fails on 92a305c); browser: 39 entries in `papaya-v23`, a 404 not cached, guide chapter renders with the server stopped. Not tested: upgrade from an installed v21 on a real phone.*
- [ ] **C7** Create AdMob account, platform app entries and test ad units. Owner: app owner and developer. Evidence: configuration recorded without private credentials.
- [ ] **C8** Integrate compatible ad bridge/native SDKs and record licenses/versions. Owner: developer. Evidence: test ads work on both platforms.
- [ ] **C9** Implement CMP/UMP consent, privacy options and applicable ATT. Owner: developer. Evidence: refusal, withdrawal, restricted state and no-consent startup tests.
- [ ] **C10** Implement approved placements and fail-open core functionality. Owner: developer. Evidence: no ad covers navigation, urgent content or timer controls.
- [ ] **C11** Audit final SDK traffic, permissions and privacy manifests. Owner: developer. Evidence: no family data transmitted; disclosure worksheet approved.
- [ ] **C12** Set up app-ads.txt, link store entries and complete AdMob readiness. Owner: app owner. Depends on public listings when required; record ad-serving approval separately from store approval.

## Milestone D Optional web AdSense

Leave this milestone open until web monetization is explicitly selected. It is not a prerequisite for native AdMob.

- [ ] **D1** Confirm live domain ownership, crawlable guide content and web privacy/support pages.
- [ ] **D2** Create/connect AdSense and verify the site using the actual account-provided method.
- [ ] **D3** Publish correct domain-root ads.txt and verify detection.
- [ ] **D4** Configure certified web CMP and privacy-options entry point.
- [ ] **D5** Add one safe ad slot with route lifecycle handling and appropriate script loading.
- [ ] **D6** Prove service-worker exclusion, no duplicate requests and useful offline/no-fill behavior.
- [ ] **D7** Receive AdSense site Ready status and test production layout without clicking live ads.

## Milestone E Store submissions

- [ ] **E1** Create Play listing, icon, feature graphic and final-build screenshots. Owner: app owner/designer.
- [ ] **E2** Create Apple listing, app icon and supported-device screenshot sets. Owner: app owner/designer.
- [ ] **E3** Complete Data safety, Contains ads, health declaration, age/content rating, audience and app access. Owner: app owner with developer evidence.
- [ ] **E4** Complete Apple App Privacy, updated age rating, export-compliance answers, content rights and EU trader information. Owner: app owner with developer evidence.
- [ ] **E5** Run physical-device release tests and record results below. Owner: developer/testers.
- [ ] **E6** Upload Play internal build and resolve pre-launch findings. Owner: developer.
- [ ] **E7** If a new personal account is applicable, complete 12 continuously opted-in testers for 14 days and apply for production access. Owner: app owner/test lead. Evidence: console eligibility and substantive feedback.
- [ ] **E8** Upload TestFlight build; complete any external Beta App Review and test it. Owner: developer/test lead.
- [ ] **E9** Submit the exact tested builds with review instructions and a reachable contact. Owner: app owner.
- [ ] **E10** Record store approvals, choose release dates and monitor launch. Owner: app owner.
- [ ] **E11** Confirm ad-network approval, production IDs and support process. Owner: app owner/developer. Ads may remain limited independently of store publication.

Current build requirements: [Android target API](https://support.google.com/googleplay/android-developer/answer/11926878), [Android 16 KB compatibility](https://developer.android.com/guide/practices/page-sizes), [Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/). Recheck at build time.

## Release test log

Every row is pending unless evidence is recorded. Use synthetic family records.

| Test | Android result | iPhone result | Evidence and build |
| --- | --- | --- | --- |
| Fresh install and all core workflows | Pending | Pending | |
| Airplane-mode first native launch and full guide search | Pending | Pending | |
| App restart and version upgrade preserve records | Pending | Pending | |
| Backup versions 1-4, import replace and merge | Pending | Pending | |
| Malformed/oversized backup and storage-write failure | Pending | Pending | |
| Export/share, import picker and PWA migration | Pending | Pending | |
| Erase records, timer state and scheduled notifications | Pending | Pending | |
| Lock/background/process death/reboot reminders | Pending | Pending | |
| Timezone/DST/date boundaries | Pending | Pending | |
| Consent accept/refuse/withdraw and offline startup | Pending | Pending | |
| ATT denied/restricted and privacy settings | Not applicable | Pending | |
| No-fill, ad failure and ad-free emergency routes | Pending | Pending | |
| No family data in ad requests, telemetry or logs | Pending | Pending | |
| Keyboard, small screens, large text and screen readers | Pending | Pending | |
| Safe areas, bottom bars, back navigation and rotation | Pending | Pending | |
| Release bundle validation and store pre-review checks | Pending | Pending | |

## Release and SDK register

| Field | Value |
| --- | --- |
| Android application ID | `pt.papayabebe.app` (selected, not yet registered in a console) |
| iOS bundle ID | `pt.papayabebe.app` (selected, not yet registered in a console) |
| Release version and build numbers | Not selected |
| Capacitor / bridge / native SDK versions | Capacitor 8.5.3 (core, cli, android, ios), `@capacitor/app` 8.1.2; Android minSdk 24 / target 36; iOS 15.0 (template, not yet generated); no ad SDK yet |
| CMP and configured ad partners | Not selected |
| Support URL and email | Planned `suporte@papayabebe.pt`; not published |
| Privacy URL | Planned under `https://papayabebe.pt/`; not published |
| Developer website | `https://papayabebe.pt/` selected; domain not yet registered |
| app-ads.txt verification | Pending |
| Optional ads.txt / AdSense approval | Not started |
| Play account type and verification | Personal (decided 2026-10-21); not created |
| Apple enrollment status | Pending |
| Play test start / earliest eligible completion | Not started |
| Play production access | Pending |
| TestFlight and App Review status | Pending |
| AdMob readiness status | Pending |
| Content reviewer and approval date | Not assigned |

## Change log

| Date | Change | Evidence |
| --- | --- | --- |
| 2026-10-20 | Initial assessment and tracker created; free-with-ads plan confirmed | Baseline commit 92a305c; source review and Node checks |
| 2026-10-20 | B1 and B2 fixed: strict backup validation, escaped member attributes; `papaya-v22` | `tests/validar-backup.mjs` passes (fails on 92a305c); browser import test; content test still passes |
| 2026-10-20 | B3 and C6 fixed: visible write failures, all-or-nothing import, service worker caches only good first-party responses; `papaya-v23` | `tests/validar-backup.mjs`, new `tests/validar-sw.mjs`; browser with forced storage failure and with the server stopped |
| 2026-10-23 | C1 Android: Capacitor 8.5.3 packaging, `www/` from the `sw.js` list, native back button, status bar fixes; `papaya-v24` | `tests/validar-pacote.mjs` and the three earlier tests pass; debug APK driven on the emulator offline; web preview rechecked |
| 2026-10-21 | Milestone A decisions taken with the owner; A6 done, A1/A2/A4/A5/A7 annotated | Store rules read at source (Google account types and health categories, Apple 5.1.1(ix), Apple DSA trader page, Xcode requirements); DNS lookups for candidate domains; live site checked at `papaya-v21` |

## Definition of done

Launch is ready when the required milestones have evidence, the signed ad-enabled builds pass the device tests, policies match actual behavior, content review is complete and both stores accept the submission. Advertising readiness is recorded separately. Do not describe pending tasks as completed merely because a report or checklist exists.
