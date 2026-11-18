import { describe, expect, it } from 'vitest';
import { resolveConfig, themeCss } from './config.ts';
import shipped from '#orbital-preflight-config';

const base = {
	title: 'T',
	description: 'D',
	siteName: 'CMDR Test',
	homeUrl: 'https://example.com'
};

describe('config', () => {
	it('fills in defaults with no presets', () => {
		const config = resolveConfig(base);
		expect(config.presets).toEqual([]);
		expect(config.sim).toBe('elite-dangerous');
		expect(config.poweredBy).toBe(true);
		expect(config.brand).toEqual({
			wordmark: 'Orbital Preflight',
			label: 'CMDR Test',
			mark: undefined,
			markSmall: undefined
		});
		expect(config.siteUrl).toBeNull();
		expect(themeCss(config.theme)).toBe('');
	});

	it('resolves presets under static/binds', () => {
		const config = resolveConfig({
			...base,
			siteUrl: 'https://example.com/binds/',
			presets: [
				{ file: 'hotas.binds', label: 'My HOTAS setup' },
				{ file: 'kb.binds', label: 'Keyboard only' }
			]
		});
		expect(config.presets.map((p) => p.path)).toEqual(['binds/hotas.binds', 'binds/kb.binds']);
		expect(config.siteUrl).toBe('https://example.com/binds');
	});

	it('rejects preset paths outside static/binds', () => {
		expect(() =>
			resolveConfig({ ...base, presets: [{ file: '../x.binds', label: 'x' }] })
		).toThrow();
	});

	it('writes theme overrides as one :root rule and refuses unsafe values', () => {
		const config = resolveConfig({ ...base, theme: { '--color-trail': '#ff6a00' } });
		expect(themeCss(config.theme)).toBe(':root{--color-trail:#ff6a00}');
		expect(() => resolveConfig({ ...base, theme: { '--color-trail': 'red}</style>' } })).toThrow();
	});

	it('the shipped config resolves', () => {
		const config = resolveConfig(shipped);
		expect(config.presets[0]).toMatchObject({ file: 'demo.binds' });
	});
});
