import { describe, expect, it } from 'vitest';
import { pageName, resolveConfig, themeCss } from './config.ts';
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

	it('turns analytics on only for the IDs that are set, and checks their shapes', () => {
		expect(resolveConfig(base).analytics).toEqual({ google: null, umami: null });
		const uuid = '0b9c2a1e-1234-4abc-9def-0123456789ab';
		expect(
			resolveConfig({
				...base,
				analytics: { googleMeasurementId: ' G-ABC123 ', umamiWebsiteId: uuid }
			}).analytics
		).toEqual({ google: 'G-ABC123', umami: { websiteId: uuid, host: 'https://cloud.umami.is' } });
		expect(
			resolveConfig({
				...base,
				analytics: { umamiWebsiteId: uuid, umamiHost: 'https://umami.example.com/' }
			}).analytics.umami?.host
		).toBe('https://umami.example.com');
		expect(() =>
			resolveConfig({ ...base, analytics: { googleMeasurementId: "G-1');alert(1)//" } })
		).toThrow();
		expect(() => resolveConfig({ ...base, analytics: { umamiWebsiteId: 'nope' } })).toThrow();
		expect(() =>
			resolveConfig({ ...base, analytics: { umamiWebsiteId: uuid, umamiHost: 'http://x.com' } })
		).toThrow();
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
});
