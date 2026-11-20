import { defineConfig } from '../../src/lib/orbital-preflight/config.ts';
import shipped from '../../orbital-preflight.config.ts';

/** The shipped config with both analytics providers on, for the analytics e2e variant. */
export default defineConfig({
	...shipped,
	analytics: {
		googleMeasurementId: 'G-TEST000000',
		umamiWebsiteId: '00000000-0000-4000-8000-000000000000',
		umamiHost: 'https://umami.invalid'
	}
});
