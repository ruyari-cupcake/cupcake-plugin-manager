/**
 * Rollup Configuration — Cupcake Provider Manager
 *
 * Bundles modular ES source (src/) into a single IIFE for the RisuAI V3
 * iframe sandbox (about:srcdoc, CSP connect-src 'none').
 *
 * Output: dist/provider-manager.js (self-contained, no external imports)
 * The RisuAI plugin header (src/plugin-header.js) is prepended as a banner.
 *
 * The `@update-url` inside the banner is rewritten at build time from
 * `src/cpm-url.config.js` — the single source of truth for the deployment URL.
 */
import resolve from '@rollup/plugin-node-resolve';
import { readFileSync } from 'node:fs';

// ── Read the single-source-of-truth URL ──
const urlConfigSrc = readFileSync(
  new URL('./src/cpm-url.config.js', import.meta.url),
  'utf-8',
);
const urlMatch = urlConfigSrc.match(/CPM_BASE_URL\s*=\s*['"]([^'"]+)['"]/);
if (!urlMatch) {
  throw new Error('[rollup] Failed to extract CPM_BASE_URL from src/cpm-url.config.js');
}
const CPM_BASE_URL = urlMatch[1];

// ── Read plugin header and inject the URL ──
let pluginHeader = readFileSync(
  new URL('./src/plugin-header.js', import.meta.url),
  'utf-8',
).trimEnd();

// Replace the @update-url value with the URL from config
pluginHeader = pluginHeader.replace(
  /(@update-url\s+)\S+/,
  `$1${CPM_BASE_URL}/api/main-plugin`,
);

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/provider-manager.js',
    format: 'iife',
    name: 'CupcakeProviderManager',
    banner: pluginHeader,
    // No sourcemap — production runtime in iframe sandbox
  },
  plugins: [
    resolve(),
  ],
};
