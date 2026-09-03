# Raccoon Sky Jump — Release & Integration Guide (Firebase + AdMob)

This document lists **only what a human must do in external consoles / on a
machine with a JDK**. Everything code-side is already wired and fails soft.

Application identity (do not change):
- `applicationId` / package: `com.raccoonskyjump.game`
- `versionName` `1.0.0`, `versionCode` `1` (bump `versionCode` for every Play upload)
- Portrait-locked, `minSdk 23`, `target/compileSdk 35`

---

## 1. Firebase (you configure; the code is already prepared)

The game uses exactly three Firebase services, via the **Web SDK inside the
Capacitor WebView** (works on Android, iOS and browser with one config):
**Authentication** (Anonymous + Google link), **Cloud Firestore**
(optional cloud save mirror + leaderboard), **Analytics** (consent-gated).

### Console steps (yours to do)
1. https://console.firebase.google.com → *Add project* (Analytics optional).
2. *Project settings → Your apps → Add app → Web (`</>`)*. Register nickname
   `Raccoon Sky Jump`. **No hosting needed.**
3. Copy the `firebaseConfig` values into `.env` (see `.env.example`).
   These are *identifiers*, not secrets — safe in the client bundle.
4. **Authentication → Sign-in method**: enable
   - `Anonymous`
   - `Google` (set a support email; this enables the link/sign-in popup)
5. **Firestore Database → Create database** (production mode, region of your
   users). The game uses two collections, created on first write:
   - `players/{uid}` — merged save document (`saveUserProgress`)
   - `leaderboard/{uid}` — best-score document (`submitScore`)
   Suggested rules (adjust to your policy; this is a starting point, not legal advice):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /players/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       match /leaderboard/{uid} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
6. **Android native (optional but recommended for Crashlytics/Cloud Messaging
   later):** *Add app → Android*, package `com.raccoonskyjump.game`, download
   `google-services.json` → place at `android/app/google-services.json`
   (git-ignored). The Gradle build auto-detects it: it then applies the
   `google-services` plugin and adds the BOM + `firebase-auth/firestore/analytics`
   dependencies. Without the file, nothing Firebase-native is compiled and the
   Web-SDK path still works.

### Behaviour guarantees (already implemented)
- Local `localStorage` save is written **first, always**; cloud is a debounced
  mirror. No network ⇒ no progress loss.
- No config ⇒ `MockAdapter` (offline demo cloud). Config ⇒ real SDK.
- A boot failure logs a warning and disables cloud features; gameplay unaffected.

---

## 2. Privacy / consent (you configure; code defaults to privacy-safe)

- **Firebase Analytics is OFF by default.** It turns on only if
  `VITE_FIREBASE_ANALYTICS_CONSENT=granted` is set in `.env`. If you serve EEA/UK
  users, show your own consent prompt first and only then ship a build with that
  flag (or gate it at runtime later). This repo does not invent consent UI text.
- **AdMob UMP consent**: `LiveAdMobAdapter.boot()` calls
  `AdMob.requestConsentInfo()` and shows `AdMob.showConsentForm()` when Google
  says a form is required. For the form to exist you must, in the
  **AdMob console → Privacy & messaging → European consent message**, create
  and publish a UMP message and declare your ad-technology providers.
  If you monetise EEA/UK traffic you also need your own app privacy policy URL
  registered in AdMob (`App settings → Privacy policy`) and in Play Console.
- **Play Data safety form**: the game stores progress locally (and, if you
  enable Firebase, account-linked save/leaderboard/analytics per your config).
  Declare exactly what *you* enabled. Suggested baseline:
  - Collected: `App functionality → game progress` (if Firebase on:
    `Account → user id`, `Analytics → product interaction`);
  - Shared: **No** (AdMob shares device/ad identifiers — declare
    `Device or other IDs` as shared for advertising if real ads are on).
- **Privacy policy**: host a page and link it in Play Console *and* AdMob.
  (Content is yours; do not copy templates claiming compliance you haven't reviewed.)

---

## 3. AdMob (you configure; code is already prepared + release-guarded)

### Console steps (yours to do)
1. https://apps.admob.com → *Add app* → Android → package
   `com.raccoonskyjump.game`. Note the **App ID** (`ca-app-pub-XXXXXXXX~YYYYYYYY`).
2. Create three **ad units** per platform you ship: Banner, Interstitial,
   Rewarded. Note the unit IDs.
3. Put unit IDs in `.env` (`VITE_ADMOB_ANDROID_*`). Put the **App ID** in
   `android/local.properties` as `ADMOB_ANDROID_APP_ID=...` (git-ignored) or
   pass `-PADMOB_ANDROID_APP_ID=...` on the Gradle command.
4. Publish a UMP consent message (see §2) if you have EEA/UK users.

### Behaviour guarantees (already implemented)
- **Selection matrix** (`src/game/ads.ts`):
  | Runtime | Adapter |
  |---|---|
  | native + production unit IDs | `LiveAdMobAdapter` (real SDK) |
  | native + dev build | live SDK with Google **test units** |
  | web dev build | `MockAdsAdapter` (labelled TEST overlay) |
  | production without IDs | `DisabledAdsAdapter` (no ads, no rewards) |
- **Rewarded reward** resolves `true` **only** when the SDK fires
  `RewardAdPluginEvents.Rewarded`. Failures resolve `false`; the game continues
  (revive simply stays unused, coins simply aren't doubled).
- Test unit IDs are **unreachable in production builds** (`import.meta.env.DEV`).
- **Gradle refuses `assembleRelease`/`bundleRelease`** while the manifest App ID
  is still Google's sample id, with a message telling you exactly what to pass.
- Interstitials: every 3rd completed run, never during gameplay, skipped
  entirely with the Remove-Ads pass. Banners: menus only, in a reserved
  safe-area slot (`--ad-h`) that shrinks the playfield so nothing is covered.

---

## 4. Signing & builds (your machine, JDK 17+ & Android SDK 35)

Signing material stays **outside source control** (`.gitignore` already covers
`*.keystore`, `*.jks`, `android/keystore.properties`, `android/local.properties`).

1. Create a keystore **once**, keep it forever:
   ```
   keytool -genkeypair -v -keystore raccoon-release.keystore -alias raccoon \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. `android/keystore.properties` (never commit):
   ```
   storeFile=../../raccoon-release.keystore
   storePassword=<your password>
   keyAlias=raccoon
   keyPassword=<your password>
   ```
3. In `android/app/build.gradle` release block, uncomment:
   `signingConfig signingConfigs.release` (the `signingConfigs` block template is
   in `ANDROID.md §7`).
4. Build:
   ```
   npm install
   npm run cap:sync        # vite build + cap sync + capacitor config validation
   cd android
   ./gradlew assembleDebug                                  # device test APK
   ./gradlew bundleRelease -PADMOB_ANDROID_APP_ID=ca-app-pub-...~...   # Play AAB
   ```
   Outputs: `android/app/build/outputs/apk/debug/app-debug.apk`,
   `android/app/build/outputs/bundle/release/app-release.aab`.

---

## 5. Pre-publish checklist (yours to do)

- [ ] `versionCode` bumped for each upload (`android/app/build.gradle`)
- [ ] Real AdMob App ID + unit IDs configured; sample-id guard passes
- [ ] UMP message published (if EEA/UK); privacy policy URL live & linked
- [ ] Play Data-safety answers match the services *you* enabled
- [ ] Content rating questionnaire completed (expected: Everyone)
- [ ] Store assets: 512×512 icon (`assets/icon-1024.png`), 1024×500 feature
      graphic, 2–8 portrait screenshots
- [ ] Real-device pass: notch/safe-areas, nav-gesture area, first-tap audio
      unlock, rewarded flow grants only on completion, kill/reopen keeps progress
- [ ] `webContentsDebuggingEnabled` left `false` (already the committed default)
