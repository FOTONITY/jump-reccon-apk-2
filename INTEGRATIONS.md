# Integrations — Firebase & AdMob (plug-and-play)

The game never talks to a vendor SDK directly. Two adapters sit behind stable
interfaces; the **mock** adapter is used automatically until keys exist.

```
src/game/firebase.ts   CloudAdapter   → MockAdapter (localStorage)  | RealAdapter (Firebase JS SDK)
src/game/ads.ts        AdsAdapter     → MockAdsAdapter (<AdOverlay>) | AdMobAdapter (@capacitor-community/admob)
src/context/UserContext.tsx           → React state for auth (useUser())
src/components/ads.tsx                → <AdOverlay/> simulated ads, <BannerAd/> bottom slot
```

Nothing in `src/App.tsx`, the engine, or the screens changes when you go live.

---

## 1. Firebase (Auth · Firestore · Analytics)

### What is already wired
| Game moment | Call |
|---|---|
| Sign in (guest / Google) | `useUser().loginAnonymously()` / `linkWithGoogle()` / `logout()` |
| Every save | `persist()` → localStorage **sync**, then debounced `firebase.saveUserProgress(uid, save)` |
| Sign-in on a new device | `pullCloudSave()` → `mergeSaves()` keeps the best of both |
| New best score | `firebase.submitScore()` → leaderboard |
| Ranks screen | `firebase.fetchLeaderboards(25)` |
| Analytics | `trackEvent(EV.*)` for run start/end, new best, world reached, achievements, missions, skin unlock/select, remove-ads, ad impressions/rewards, revive, cloud sync |

### Go live in 3 steps
```bash
npm i firebase
cp .env.example .env         # paste the web config from Firebase console → Project settings
```
Then open `src/game/firebase.ts`, class `RealAdapter`, and replace each
`throw new Error('TODO…')` with the commented SDK line directly above it
(imports are listed in the constructor comment). Build — the mode indicator in
Settings flips from `mock` to `live`.

**Firestore layout used by the adapter**
```
players/{uid}        ← full SaveData document (merge writes)
leaderboard/{uid}    ← { uid, name, score, altitude, skin, date }
```
**Suggested rules**
```
match /players/{uid}     { allow read, write: if request.auth != null && request.auth.uid == uid; }
match /leaderboard/{uid} { allow read: if true; allow write: if request.auth != null && request.auth.uid == uid; }
```
For native Google sign-in on Android/iOS use `@codetrix-studio/capacitor-google-auth`
and pass its idToken to `signInWithCredential` inside `linkWithGoogle()`.

---

## 2. AdMob (Banner · Interstitial · Rewarded)

### Behaviour (already implemented, vendor-agnostic)
| Format | When | Gate |
|---|---|---|
| Banner | Home + menus, **never** during play | hidden if `save.removeAds` |
| Interstitial | when the player leaves Game Over, every **3rd** completed run (`INTERSTITIAL_EVERY_N_RUNS`) | skipped if `save.removeAds` |
| Rewarded | **Revive** (once per run) and **2× Coins** buttons on Game Over | always opt-in, not gated |
| Remove Ads pass | Shop, `REMOVE_ADS_PRICE` coins (swap for a real IAP later) | sets `save.removeAds = true` |

The banner slot writes `--ad-h` on `<html>`; `.app-root` reserves that height so
the canvas and every button stay above the ad. Live AdMob draws its native view
in exactly that reserved strip.

### Go live
```bash
npm i @capacitor-community/admob
npx cap sync
```
`.env`
```
VITE_ADMOB_USE_TEST_IDS=true          # Google test units while developing
VITE_ADMOB_ANDROID_BANNER=ca-app-pub-…/…
VITE_ADMOB_ANDROID_INTERSTITIAL=…
VITE_ADMOB_ANDROID_REWARDED=…
```
`android/app/src/main/AndroidManifest.xml` inside `<application>`:
```xml
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXXXXXX~YYYYYYYY"/>
```
Then uncomment the SDK lines in `AdMobAdapter` (`src/game/ads.ts`) and the
`-keep` rules for `com.google.android.gms.ads.**` in `android/app/proguard-rules.pro`.

> Play policy: never ship the simulated overlay as a "real" ad prompt. The mock
> is labelled `TEST` and only renders when no AdMob ids exist.

---

## 3. Scripts

```bash
npm run dev          # browser dev server
npm run typecheck    # tsc --noEmit
npm run sim          # headless engine regression (fairness + perf governor)
npm run cap:sync     # build → cap sync → validate capacitor.config.json
npm run android      # cap:sync + open Android Studio
npm run apk          # cap:sync + assembleDebug  → android/app/build/outputs/apk/debug/app-debug.apk
npm run aab          # cap:sync + bundleRelease  → android/app/build/outputs/bundle/release/app-release.aab
```
`?debug` in the URL (e.g. `http://localhost:5173/?debug`) shows FPS and the
current quality scale in the HUD.

---

## 4. Performance governor (src/game/engine.ts)

`frameEma` tracks frame time; `perfScale` (1 → 0.35) scales every particle
burst, the jetpack/rock trails, speed lines and ambient density. Below 45 FPS
`lowPerf` switches on (hysteresis, recovers above 55 FPS): the particle renderer
draws every other particle and quantises alpha to 4 levels so the canvas
changes blend state far less often. Single stalls >250 ms (tab switch) are ignored.
