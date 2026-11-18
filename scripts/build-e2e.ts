/**
 * Builds the variants the Playwright tests run against, one after another:
 *
 * - root:  the shipped config at a domain root
 * - base:  the same under /orbital-preflight, as a GitHub Pages project site serves it
 * - theme: tests/fixtures/theme.config.ts, a theme override with no presets
 */
import { execFileSync } from 'node:child_process';

export const VARIANTS = {
	root: { port: 4173, base: '', env: {} },
	base: { port: 4174, base: '/orbital-preflight', env: { BASE_PATH: '/orbital-preflight' } },
	theme: {
		port: 4175,
		base: '',
		env: { ORBITAL_PREFLIGHT_CONFIG: 'tests/fixtures/theme.config.ts' }
	}
} as const;

if (import.meta.main) {
	for (const [name, variant] of Object.entries(VARIANTS)) {
		console.log(`Building ${name}…`);
		execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'warn'], {
			stdio: 'inherit',
			env: { ...process.env, ...variant.env, BUILD_DIR: `build-e2e/${name}` }
		});
	}
}
