/**
 * Builds the variants the Playwright tests run against, one after another:
 *
 * - root:  the shipped config at a domain root
 * - base:  the same under /orbital-preflight, as a GitHub Pages project site serves it
 * - theme: tests/fixtures/theme.config.ts, a theme override with no presets
 * - analytics: the shipped config with both providers on, as the Pages workflow would set them
 */
import { execFileSync } from 'node:child_process';

export const VARIANTS = {
	root: { port: 4173, base: '', env: {} },
	base: { port: 4174, base: '/orbital-preflight', env: { BASE_PATH: '/orbital-preflight' } },
	theme: {
		port: 4175,
		base: '',
		env: { ORBITAL_PREFLIGHT_CONFIG: 'tests/fixtures/theme.config.ts' }
	},
	analytics: {
		port: 4176,
		base: '',
		env: {
			GA_MEASUREMENT_ID: 'G-TEST000000',
			UMAMI_WEBSITE_ID: '00000000-0000-4000-8000-000000000000',
			UMAMI_HOST: 'https://umami.invalid'
		}
	}
} as const;

// Analytics IDs only reach the variant that sets them, never from the shell.
const { GA_MEASUREMENT_ID, UMAMI_WEBSITE_ID, UMAMI_HOST, ...shell } = process.env;
void [GA_MEASUREMENT_ID, UMAMI_WEBSITE_ID, UMAMI_HOST];

if (import.meta.main) {
	for (const [name, variant] of Object.entries(VARIANTS)) {
		console.log(`Building ${name}…`);
		execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'warn'], {
			stdio: 'inherit',
			env: { ...shell, ...variant.env, BUILD_DIR: `build-e2e/${name}` }
		});
	}
}
