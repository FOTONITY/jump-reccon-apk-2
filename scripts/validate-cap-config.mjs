#!/usr/bin/env node
/**
 * Validates every Capacitor JSON artifact after `cap sync`.
 * A single missing comma in capacitor.config.json makes the native bridge
 * throw before the WebView loads => permanent white screen on device.
 * This script fails the build instead of letting that APK ship.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'android/app/src/main/assets/capacitor.config.json',
  'android/app/src/main/assets/capacitor.plugins.json',
  'ios/App/App/capacitor.config.json', // present only after `cap add ios`
];

const REQUIRED_KEYS = ['appId', 'appName', 'webDir'];
let failed = false;

for (const rel of files) {
  const abs = resolve(rel);
  if (!existsSync(abs)) { console.log(`↷ skip (not generated): ${rel}`); continue; }
  const raw = readFileSync(abs, 'utf8');
  try {
    const json = JSON.parse(raw);
    if (rel.endsWith('capacitor.config.json')) {
      const missing = REQUIRED_KEYS.filter((k) => !(k in json));
      if (missing.length) throw new Error(`missing keys: ${missing.join(', ')}`);
      if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(json.appId)) throw new Error(`appId "${json.appId}" is not a valid reverse-domain id`);
    }
    if (rel.endsWith('capacitor.plugins.json') && !Array.isArray(json)) throw new Error('plugins manifest must be an array');
    console.log(`✔ valid: ${rel}`);
  } catch (err) {
    failed = true;
    // Point at the exact byte so a missing comma is easy to spot.
    const m = /position (\d+)/.exec(String(err.message));
    if (m) {
      const pos = Number(m[1]);
      const line = raw.slice(0, pos).split('\n').length;
      const snippet = raw.split('\n').slice(Math.max(0, line - 3), line + 2).join('\n');
      console.error(`✖ ${rel}: ${err.message}\n  around line ${line}:\n${snippet}`);
    } else {
      console.error(`✖ ${rel}: ${err.message}`);
    }
  }
}

if (failed) { console.error('\nCapacitor config validation FAILED — fix capacitor.config.ts and re-run `npx cap sync`.'); process.exit(1); }
console.log('Capacitor config OK.');
