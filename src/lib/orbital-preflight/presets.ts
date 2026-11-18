/**
 * The shipped presets in static/binds/, read at build time so the app never fetches at
 * runtime. The same files are served as-is for the download buttons.
 */
const files = import.meta.glob('../../../static/binds/*', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export const presetSources: Record<string, string> = Object.fromEntries(
	Object.entries(files).map(([path, text]) => [path.split('/').pop() ?? path, text])
);

/**
 * A preset's download URL under the base path. `asset()` is typed to the files that
 * exist at build time; a fork's file names aren't known to the framework's types.
 */
export function presetHref(path: string, asset: (file: never) => string): string {
	return asset(path as never);
}
