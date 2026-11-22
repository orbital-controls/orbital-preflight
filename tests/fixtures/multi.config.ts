import { defineConfig } from '../../src/lib/orbital-preflight/config.ts';

/**
 * The multi-game build for the e2e tests: presets for Elite Dangerous and Star Citizen,
 * so the first visit is the bay with the pilot's preset on both tiles.
 */
export default defineConfig({
	title: 'Multi-game check',
	description: 'A build with presets for two games.',
	siteName: 'Multi Check',
	homeUrl: 'https://example.com',
	presets: [
		{ file: 'demo.binds', label: 'Demo HOTAS setup' },
		{ file: 'demo-star-citizen.xml', label: 'Demo SC layout', sim: 'star-citizen' }
	]
});
