#!/usr/bin/env bash
# One-shot verification chain for Raccoon Sky Jump.
# Runs the exact commands the sandbox could not execute (cap sync, gradle, sim)
# plus the ones it could, and prints a PASS/FAIL summary with the APK path/size.
#
#   ./scripts/verify-android.sh
#
# Requirements on this machine: Node 20+, JDK 17+ (21 recommended),
# Android SDK platform 35 (Android Studio SDK Manager), ANDROID_HOME set or
# android/local.properties containing sdk.dir=...
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0; fail=0
step() { # step <name> <command...>
  local name="$1"; shift
  echo; echo "=== $name: $* ==="
  if "$@"; then echo "--- $name: PASS"; pass=$((pass+1)); else echo "--- $name: FAIL"; fail=$((fail+1)); fi
}

step "1 npm install"      npm install
step "2 tsc --noEmit"     npx tsc --noEmit -p tsconfig.json
step "3 npm run build"    npm run build
step "4 cap sync android" npx cap sync android
step "5 cap config check" node scripts/validate-cap-config.mjs
step "6 gradle assembleDebug" bash -c "cd android && ./gradlew assembleDebug --console=plain"
step "7 npm run sim"      npm run sim

APK="android/app/build/outputs/apk/debug/app-debug.apk"
echo
if [ -f "$APK" ]; then
  echo "APK PATH: $APK"
  echo "APK SIZE: $(du -h "$APK" | cut -f1) ($(stat -c %s "$APK" 2>/dev/null || stat -f %z "$APK") bytes)"
else
  echo "APK PATH: NOT FOUND (assembleDebug did not produce an APK)"
  fail=$((fail+1))
fi

echo
echo "BUILD STATUS: $([ "$fail" -eq 0 ] && echo PASS || echo FAIL)"
echo "  passed steps: $pass, failed steps: $fail"
exit "$fail"
