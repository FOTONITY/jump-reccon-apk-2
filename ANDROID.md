# Raccoon Sky Jump → Android APK (Capacitor)

Everything below is already wired up in this repo. Sections 0–3 are the one-time
setup that was done for you; section 4 onward is your day-to-day workflow.

---

## 0. Requirements

| Tool | Version |
|---|---|
| Node | 20+ (Capacitor 7 requirement) |
| JDK | **21** (Capacitor 7 / AGP 8.7 will not build on JDK 17) |
| Android Studio | Ladybug 2024.2.1 or newer |
| Android SDK | Platform **35** + Build-Tools 35, installed via Android Studio → SDK Manager |

Check your JDK:

```bash
java -version      # must print 21.x
```

Android Studio ships its own JDK — you can point Gradle at it instead:
**Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK → jbr-21**

---

## 1. Packages that were installed

```bash
# runtime
npm install @capacitor/core@7 @capacitor/app@7 @capacitor/status-bar@7 @capacitor/splash-screen@7

# tooling
npm install -D @capacitor/cli@7 @capacitor/android@7 @capacitor/assets
```

---

## 2. Capacitor config

`capacitor.config.ts` (repo root):

```ts
appId:  'com.raccoonskyjump.game'   // ← change before publishing, must be globally unique
appName:'Raccoon Sky Jump'
webDir: 'dist'                      // Vite's output (single-file build)
```

The Android project was then generated once:

```bash
npm run build          # dist/ must exist before this
npx cap add android    # creates ./android
```

---

## 3. What was configured for mobile

**Safe areas** (`src/index.css` + `src/App.tsx`)

* `index.html` already has `viewport-fit=cover`.
* `.app-root` is padded with `env(safe-area-inset-*)`, so the notch, punch-hole
  camera and Android gesture bar never overlap the HUD.
* `App.tsx` measures `.app-root` with a **ResizeObserver** (not `window.innerHeight`),
  so the 9:16 playfield is computed from the *safe* box, and re-measures 300 ms
  after launch because Android reports final insets late.
* `StatusBar.setOverlaysWebView({ overlay: false })` keeps the WebView below the
  status bar on every Android version — belt and braces with the CSS insets.

**Native behaviour** (`src/native.ts`)

* Splash screen hides only after React paints → no white flash.
* Hardware **back button**: playing → pause, paused → resume, menus → home,
  home → exit app.
* `appStateChange` pauses the game when you switch apps.
* All of it no-ops in a browser, so `npm run dev` is unchanged.

**AndroidManifest.xml**

* `android:screenOrientation="portrait"` + `resizeableActivity="false"`
* `VIBRATE` permission (the landing/hit haptics use `navigator.vibrate`)
* `hardwareAccelerated="true"` for smooth canvas rendering

**Resources**

* Release builds use **R8** (`minifyEnabled true`, `shrinkResources true`,
  `proguard-android-optimize.txt`) with Capacitor-safe keep rules in
  `app/proguard-rules.pro`, so the JS↔native bridge survives obfuscation.
* `res/values/colors.xml` was **missing** from the scaffold while `styles.xml`
  referenced `@color/colorPrimary` → that would have failed the Gradle build.
  It now exists with the game palette.
* Launch theme uses the Android 12+ splash API: dark `#1a1030` plate + app icon.
* Launcher icons and splash images generated from `assets/icon.png` via
  `npx @capacitor/assets generate --android`.

---

> **Monetisation & cloud:** Firebase and AdMob placeholders live in `src/game/firebase.ts`
> and `src/game/ads.ts`. See **INTEGRATIONS.md** for the 3-step key swap.

## 4. Daily workflow

```bash
npm run dev          # browser development, unchanged

npm run cap:sync     # build web + copy into android/ + validate capacitor.config.json
npm run aab          # build + sync + bundleRelease (Play Store upload)
npm run sim          # headless engine regression test
npm run android      # build + sync + open Android Studio
npm run android:run  # build + sync + install on a connected device
npm run apk          # build + sync + assemble a debug APK (no Android Studio)
```

> Every time you change code you must re-run a sync — the APK contains a
> *copy* of `dist/`, it does not read your source folder.

---

## 5. Build a debug APK — terminal only

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
```

Output:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a plugged-in phone (USB debugging on):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

…or just copy the `.apk` to the phone and tap it (enable *Install unknown apps*).

---

## 6. Build a debug APK — Android Studio

1. `npm run android` (this runs build + sync, then opens Android Studio).
2. Wait for **Gradle sync** to finish (progress bar, bottom right). First run
   downloads Gradle + dependencies — several minutes.
   *If it fails:* File → Sync Project with Gradle Files.
3. Top toolbar → make sure the module dropdown shows **app**.
4. Menu → **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. When the balloon "APK(s) generated successfully" appears, click **locate**.
   The file is `android/app/build/outputs/apk/debug/app-debug.apk`.

**To run it straight on your phone instead:** enable Developer options →
USB debugging, plug it in, pick the device in the dropdown, press the green ▶ Run.

**Live debugging:** with the game running, open `chrome://inspect` in desktop
Chrome → *inspect* under your device. Full DevTools on the canvas game.
(`webContentsDebuggingEnabled: true` is already set.)

---

## 7. Release build for Google Play

Play Store requires a **signed AAB**, not an APK.

**a) Create a keystore once** — keep this file and its passwords forever, you
cannot update your app without them:

```bash
keytool -genkey -v -keystore raccoon-release.keystore \
  -alias raccoon -keyalg RSA -keysize 2048 -validity 10000
```

**b) `android/keystore.properties`** (add it to `.gitignore`, never commit):

```properties
storeFile=../../raccoon-release.keystore
storePassword=YOUR_PASSWORD
keyAlias=raccoon
keyPassword=YOUR_PASSWORD
```

**c) `android/app/build.gradle`** — inside `android { }`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        storeFile     file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias      keystoreProperties['keyAlias']
        keyPassword   keystoreProperties['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

**d) Bump the version** in `android/app/build.gradle` for every upload:

```gradle
versionCode 2          // must increase every single upload
versionName "1.0.1"
```

**e) Build the bundle:**

```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` → upload that
in Play Console → Production → Create new release.

In Android Studio the equivalent is **Build → Generate Signed Bundle / APK →
Android App Bundle**.

---

## 8. Play Store checklist

* [ ] Unique `appId` (reverse-domain you own) — cannot change after publishing
* [ ] `targetSdkVersion 35` (already set in `android/variables.gradle`)
* [ ] Privacy policy URL — required even with no data collection
* [ ] Data safety form: this game stores **only** local `localStorage` save data,
      no network, no analytics, no ads SDK → declare "no data collected"
* [ ] Content rating questionnaire (this is *Everyone*)
* [ ] Store listing: 512×512 icon, 1024×500 feature graphic, 2–8 phone
      screenshots (portrait, min 320 px)
* [ ] The in-game "Watch reward video" revive is a **simulated placeholder** —
      either wire up a real ad SDK (AdMob) or reword it before shipping, since
      Play rejects fake ad prompts

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=/Users/you/Library/Android/sdk` (Studio usually writes it) |
| `Unsupported class file major version` | Wrong JDK — switch Gradle JDK to 21 |
| White screen on device | You forgot `npx cap sync android` after building |
| HUD under the status bar | Confirm `viewport-fit=cover` in `index.html` and that `.app-root` keeps its `env(safe-area-inset-*)` padding |
| No sound until first tap | Correct and unavoidable — WebView blocks audio until a user gesture; the game unlocks it on the first tap |
| Game feels slow on a cheap phone | Settings → turn off Screen shake; the particle pool is already capped at 280 |
| Save data lost after reinstall | Expected: it lives in the WebView `localStorage`, which is wiped with the app |
