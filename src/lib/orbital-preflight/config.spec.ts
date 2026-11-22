import { describe, expect, it } from 'vitest';
import { firstVisit, pageName, presetFor, resolveConfig, themeCss } from './config.ts';
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
		expect(config.brand).toMatchObject({ wordmark: 'Preflight', label: 'CMDR Test Preflight' });
		expect(config.brand.mark).toContain('<svg');
		expect(resolveConfig({ ...base, brand: { mark: false, wordmark: 'Vex' } }).brand).toMatchObject(
			{
				wordmark: 'Vex',
				mark: undefined,
				markSmall: undefined
			}
		);
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

describe('page name', () => {
	it('adds Preflight once', () => {
		expect(pageName('CMDR Vex')).toBe('CMDR Vex Preflight');
		expect(pageName('Orbital Preflight')).toBe('Orbital Preflight');
	});

	it('gives each preset a sim, the config’s unless it names its own', () => {
		const config = resolveConfig({
			...base,
			presets: [
				{ file: 'a.binds', label: 'A' },
				{ file: 'b.xml', label: 'B', sim: 'star-citizen' }
			]
		});
		expect(config.presets.map((p) => p.sim)).toEqual(['elite-dangerous', 'star-citizen']);
		expect(presetFor(config.presets, 'star-citizen')).toBe(1);
		expect(presetFor(config.presets, 'x4')).toBe(-1);
	});

	it('routes a first visit: one sim’s presets open, else the bay', () => {
		const one = resolveConfig({
			...base,
			presets: [
				{ file: 'a.binds', label: 'A' },
				{ file: 'b.binds', label: 'B' }
			]
		}).presets;
		const several = resolveConfig({
			...base,
			presets: [
				{ file: 'a.binds', label: 'A' },
				{ file: 'b.xml', label: 'B', sim: 'star-citizen' }
			]
		}).presets;
		expect(firstVisit([])).toEqual({ kind: 'bay' });
		expect(firstVisit(one)).toEqual({ kind: 'preset', index: 0 });
		expect(firstVisit(several)).toEqual({ kind: 'bay' });
	});
});
