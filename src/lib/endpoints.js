// @ts-check
/**
 * endpoints.js — Centralized endpoint URL constants.
 *
 * All remote URLs used by CPM live here.
 * The base URL is imported from `src/cpm-url.config.js` — the single
 * source of truth shared with the Rollup build (which injects it into
 * the plugin-header.js banner at build time).
 *
 * To switch between test / production, edit ONLY `src/cpm-url.config.js`.
 */

import { CPM_BASE_URL } from '../cpm-url.config.js';

export { CPM_BASE_URL };

/** Version manifest endpoint (GET → JSON). */
export const VERSIONS_URL = `${CPM_BASE_URL}/api/versions`;

/** Main plugin JS download endpoint (GET → text/javascript). */
export const MAIN_UPDATE_URL = `${CPM_BASE_URL}/api/main-plugin`;

/** Single-bundle update endpoint (GET → JSON with code + hashes). */
export const UPDATE_BUNDLE_URL = `${CPM_BASE_URL}/api/update-bundle`;
