/**
 * Runs the Svelte team's autofixer (from @sveltejs/mcp, the Svelte MCP server) over every
 * component and .svelte.ts module. Issues fail the run; suggestions are heuristics
 * ("ignore this if you're sure…"), printed for review and failing only with --strict.
 *
 *   pnpm check:svelte            # issues fail, suggestions are listed
 *   pnpm check:svelte --strict   # suggestions fail too
 */
import { globSync, readFileSync } from 'node:fs';
import { svelteAutofixer } from '@sveltejs/mcp';

const strict = process.argv.includes('--strict');
const svelteVersion = JSON.parse(readFileSync('node_modules/svelte/package.json', 'utf8')).version;
const files = globSync(['src/**/*.svelte', 'src/**/*.svelte.ts']).sort();

let issues = 0;
let suggestions = 0;
for (const file of files) {
	const result = await svelteAutofixer({
		code: readFileSync(file, 'utf8'),
		desired_svelte_version: svelteVersion,
		filename: file,
		async: false
	});
	if (!result.issues.length && !result.suggestions.length) continue;
	console.log(`\n${file}`);
	for (const issue of result.issues) console.log(`  ✗ ${issue}`);
	for (const suggestion of new Set(result.suggestions)) console.log(`  · ${suggestion}`);
	issues += result.issues.length;
	suggestions += result.suggestions.length;
}

console.log(
	`\nsvelte-autofixer: ${files.length} files, ${issues} issues, ${suggestions} suggestions (Svelte ${svelteVersion})`
);
if (issues || (strict && suggestions)) process.exit(1);
