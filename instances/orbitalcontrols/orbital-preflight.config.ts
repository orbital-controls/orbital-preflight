import { defineConfig } from '../../src/lib/orbital-preflight/config.ts';
// The Orbital Controls mark, copied from the site's Mark.svelte (full and small). The
// framework's own default is the plain wordmark; only this instance carries the logo.
import mark from './mark.svg?raw';
import markSmall from './mark-small.svg?raw';

/**
 * Phil's instance: "Preflight" on orbitalcontrols.com. Built with
 * ORBITAL_PREFLIGHT_CONFIG=instances/orbitalcontrols/orbital-preflight.config.ts and
 * deployed by .github/workflows/deploy-cloudflare.yml.
 */
export default defineConfig({
	title: 'Preflight: test your Elite Dangerous binds | Orbital Controls',
	description:
		'Load your Elite Dangerous binds, connect your stick and throttle, test every bind against a mock flight, rebind anything and export a new preset.',
	siteName: 'Orbital Controls',
	siteUrl: 'https://preflight.orbitalcontrols.com',
	homeUrl: 'https://orbitalcontrols.com',
	sim: 'elite-dangerous',
	// Phil's own presets go in static/binds/ and here once there are real files.
	presets: [],
	brand: { wordmark: 'Orbital Controls', mark, markSmall, label: 'Orbital Controls Preflight' }
});
