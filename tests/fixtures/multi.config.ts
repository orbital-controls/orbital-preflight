import { defineConfig } from '../../src/lib/orbital-preflight/config.ts';

/**
 * The multi-game build for the e2e tests. Only Elite Dangerous is `ready`, so this build
 * also sets ORBITAL_PREFLIGHT_MOCK_SIMS=star-citizen (scripts/build-e2e.ts): Star Citizen
 * stands in with Elite files, as the boards' mocks do. Presets for two sims, so the
 * first visit is the bay with the pilot's preset on both tiles.
 */
export default defineConfig({
	title: 'Multi-game check',
	description: 'A build with presets for two games.',
	siteName: 'Multi Check',
	homeUrl: 'https://example.com',
	presets: [
		{ file: 'demo.binds', label: 'Demo HOTAS setup' },
		{ file: 'demo.binds', label: 'Stand-in layout', sim: 'star-citizen' }
	]
});
