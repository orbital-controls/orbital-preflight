import { defineConfig, devices } from '@playwright/test';

// `pnpm test:e2e` builds three variants first (scripts/build-e2e.ts); each is served as
// plain static files, the way GitHub Pages would serve it.
const VARIANTS = [
	{ name: 'root', port: 4173, base: '', tests: ['root', 'scene'] },
	{ name: 'base', port: 4174, base: '/orbital-preflight', tests: ['base'] },
	{ name: 'theme', port: 4175, base: '', tests: ['theme'] }
];

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		trace: 'off',
		viewport: { width: 1440, height: 1150 },
		// Lets a local run use an already installed Chromium (PW_CHROMIUM_PATH).
		launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined }
	},
	projects: VARIANTS.map((v) => ({
		name: v.name,
		testMatch: v.tests.map((t) => `**/${t}.e2e.ts`),
		use: {
			...devices['Desktop Chrome'],
			viewport: { width: 1440, height: 1150 },
			baseURL: `http://localhost:${v.port}${v.base}/`
		}
	})),
	webServer: VARIANTS.map((v) => ({
		command: `node scripts/serve.ts build-e2e/${v.name} ${v.port} ${v.base}`,
		url: `http://localhost:${v.port}${v.base}/`,
		// Never reuse: a server left running on these ports would serve a stale build.
		reuseExistingServer: false
	}))
});
