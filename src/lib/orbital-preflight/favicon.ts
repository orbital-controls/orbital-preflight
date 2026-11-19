import tokens from '@orbital-controls/theme/tokens.css?raw';

/**
 * A favicon can't read the page's CSS variables, so the mark's `var(--color-…)` colours
 * are filled in at build time: from the theme package's own tokens.css (the single source
 * of truth for the defaults), then the config's `theme` overrides on top.
 */

/** A crosshair for builds that set `mark: false`. Colours as in the mark. */
const PLAIN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="var(--color-void)"/><circle cx="16" cy="16" r="10" fill="none" stroke="var(--color-course)" stroke-width="2.5"/><path d="M16 3v7M16 22v7M3 16h7M22 16h7" stroke="var(--color-course)" stroke-width="2.5"/><circle cx="16" cy="16" r="3" fill="var(--color-trail)"/></svg>`;

/** `--name: value` pairs declared in a stylesheet, later ones winning. */
export function cssVariables(css: string): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) vars[m[1]] = m[2].trim();
	return vars;
}

/** `svg` with every `var(--x)` replaced by its value, as a data URL. */
export function faviconHref(
	svg: string | undefined,
	overrides: [string, string][],
	css = tokens
): string {
	const vars = { ...cssVariables(css), ...Object.fromEntries(overrides) };
	const filled = (svg ?? PLAIN).replace(
		/var\((--[\w-]+)\)/g,
		(whole, name: string) => vars[name] ?? whole
	);
	return `data:image/svg+xml,${encodeURIComponent(filled)}`;
}
