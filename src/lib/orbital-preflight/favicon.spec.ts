import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cssVariables, faviconHref } from './favicon.ts';
import { MARK_SMALL } from './brand.ts';

// Vitest hands CSS `?raw` imports over empty, so the test reads the package file itself.
const tokens = readFileSync('node_modules/@orbital-controls/theme/tokens.css', 'utf8');

describe('favicon', () => {
	it('fills colours from the theme package tokens, with config overrides on top', () => {
		const svg = decodeURIComponent(
			faviconHref(MARK_SMALL, [['--color-trail', '#ff6a00']], tokens).split(',')[1]
		);
		expect(svg).not.toContain('var(');
		expect(svg).toContain('#ff6a00');
		expect(svg).toContain(cssVariables(tokens)['--color-course']);
	});

	it('reads the package tokens rather than a copy', () => {
		const svg = decodeURIComponent(
			faviconHref('<svg fill="var(--color-x)"/>', [], ':root{--color-x: #123456}').split(',')[1]
		);
		expect(svg).toBe('<svg fill="#123456"/>');
	});

	it('draws a plain icon when there is no mark', () => {
		expect(decodeURIComponent(faviconHref(undefined, [], tokens))).toContain('<circle');
	});
});
