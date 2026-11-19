import { defineConfig } from '../../src/lib/orbital-preflight/config.ts';

/**
 * The theme-override build for the e2e tests: a re-tinted trail, no presets (so the
 * first visit is the upload state) and no "Powered by" link.
 */
export default defineConfig({
	title: 'Theme check',
	description: 'A build with a theme override and no shipped presets.',
	siteName: 'Theme Check',
	siteUrl: 'https://example.com/theme',
	homeUrl: 'https://example.com',
	theme: { '--color-trail': '#ff6a00' },
	poweredBy: false
});
