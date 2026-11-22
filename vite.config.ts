import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

// Where the built app is served from: an empty string at a domain root (Phil's instance),
// or `/<repo>` for a GitHub Pages project site. The Pages workflow sets it from the repo
// name. Unset in `vite dev` and `vite preview`.
const base = (process.env.BASE_PATH ?? '').replace(/\/$/, '') as '' | `/${string}`;

// The config a build reads. Forks edit `orbital-preflight.config.ts` at the repo root;
// another file can be swapped in (Phil's instance, the theme-override check) without
// touching it.
const configFile = path.resolve(
	root,
	process.env.ORBITAL_PREFLIGHT_CONFIG ?? 'orbital-preflight.config.ts'
);

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ pages: process.env.BUILD_DIR ?? 'build', strict: true }),
			paths: { base, relative: true },
			prerender: { entries: ['*'] }
		})
	],
	// three.js is one lazy chunk (~620 kB, ~160 kB gzipped), fetched only when the 3D
	// viewport mounts. Above this, a chunk has grown and is worth a look.
	build: { chunkSizeWarningLimit: 700 },
	resolve: {
		alias: { '#orbital-preflight-config': configFile }
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'tests/unit/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
