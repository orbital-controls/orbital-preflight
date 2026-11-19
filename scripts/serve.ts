/**
 * A tiny static server for the built app, for the Playwright tests. Serves `dir` under
 * `base` (e.g. `/orbital-preflight`) the way GitHub Pages serves a project site.
 *
 *   node scripts/serve.ts <dir> <port> [base]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [dir = 'build', port = '4173', base = ''] = process.argv.slice(2);
const root = path.resolve(dir);
const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.woff2': 'font/woff2',
	'.json': 'application/json',
	'.txt': 'text/plain',
	'.binds': 'application/xml'
};

createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://localhost');
	if (base && !url.pathname.startsWith(base)) {
		res.writeHead(404).end('Not under the base path');
		return;
	}
	let file = path.join(root, decodeURIComponent(url.pathname.slice(base.length)));
	if (!file.startsWith(root)) {
		res.writeHead(403).end();
		return;
	}
	try {
		if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
		const body = await readFile(file);
		res
			.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
			.end(body);
	} catch {
		res.writeHead(404).end('Not found');
	}
}).listen(Number(port), () => console.log(`Serving ${root} at http://localhost:${port}${base}/`));
