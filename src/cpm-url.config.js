// @ts-check
/**
 * cpm-url.config.js — Single source of truth for the CPM deployment URL.
 *
 * Both `src/lib/endpoints.js` (runtime) and `rollup.config.mjs` (build-time
 * banner injection into plugin-header.js) read from this file.
 *
 * To switch between test and production deployments, change ONLY this value:
 *
 * - Test:       https://cupcake-plugin-manager-test.vercel.app
 * - Production: https://cupcake-plugin-manager.vercel.app
 */

/** @type {string} */
export const CPM_BASE_URL = 'https://cupcake-plugin-manager-test.vercel.app';
