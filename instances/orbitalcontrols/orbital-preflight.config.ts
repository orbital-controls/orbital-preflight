import { defineConfig } from '../../src/lib/orbital-preflight/config.ts';

/**
 * Phil's instance: "Preflight" on orbitalcontrols.com. Built with
 * ORBITAL_PREFLIGHT_CONFIG=instances/orbitalcontrols/orbital-preflight.config.ts and
 * deployed by .github/workflows/pages.yml to GitHub Pages at preflight.orbitalcontrols.com
 * (the repository variable ORBITAL_PREFLIGHT_CONFIG points the workflow here).
 */
export default defineConfig({
	title: 'Preflight: test your Elite Dangerous binds | Orbital Controls',
	description:
		'Load your Elite Dangerous binds, connect your stick and throttle, test every bind against a mock flight, rebind anything and export a new preset.',
	siteName: 'Orbital Controls',
	// Turn on once preflight.orbitalcontrols.com serves the app. Until then the site is
	// at orbital-controls.github.io/orbital-preflight/, and a canonical pointing at the
	// subdomain would send search engines and link previews to a page that isn't there.
	// siteUrl: 'https://preflight.orbitalcontrols.com',
	homeUrl: 'https://orbitalcontrols.com',
	sim: 'elite-dangerous',
	// Phil's own presets go in static/binds/ and here once there are real files.
	presets: [],
	// The default brand: the Orbital Controls mark and "Preflight".
	brand: { label: 'Orbital Controls Preflight' }
});
