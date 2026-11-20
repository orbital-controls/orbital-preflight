import { defineConfig } from './src/lib/orbital-preflight/config.ts';

/**
 * Your Orbital Preflight. This is the only file a fork has to edit: see "Fork it" in
 * the README for what each field does.
 */
export default defineConfig({
	title: 'Orbital Preflight: test my space sim binds',
	description:
		'Load my Elite Dangerous binds, test every one against a mock flight with your own stick and keyboard, rebind anything and download a new preset.',
	siteName: 'Orbital Preflight',
	// siteUrl: 'https://<you>.github.io/orbital-preflight',
	homeUrl: 'https://github.com/orbital-controls/orbital-preflight',
	sim: 'elite-dangerous',
	presets: [{ file: 'demo.binds', label: 'Demo HOTAS setup' }]
	// brand: { wordmark: 'CMDR Vex', mark: '<svg viewBox="0 0 100 100">…</svg>' }, // or mark: false
	// theme: { '--color-trail': '#ff6a00' },
	// poweredBy: true,
	// analytics: { googleMeasurementId: 'G-XXXXXXXXXX', umamiWebsiteId: '<uuid>' }
});
