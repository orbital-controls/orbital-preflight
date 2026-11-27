import { describe, expect, it } from 'vitest';
import { analyticsSettings } from './settings.ts';

const uuid = '0b9c2a1e-1234-4abc-9def-0123456789ab';

describe('analytics settings', () => {
	it('is off with nothing set, or only empty values', () => {
		expect(analyticsSettings({})).toEqual({ google: null, umami: null });
		expect(analyticsSettings({ GA_MEASUREMENT_ID: '', UMAMI_WEBSITE_ID: ' ' })).toEqual({
			google: null,
			umami: null
		});
	});

	it('turns on only the providers whose IDs are set', () => {
		expect(analyticsSettings({ GA_MEASUREMENT_ID: ' G-ABC123 ', UMAMI_WEBSITE_ID: uuid })).toEqual({
			google: 'G-ABC123',
			umami: { websiteId: uuid, host: 'https://cloud.umami.is' }
		});
		expect(
			analyticsSettings({ UMAMI_WEBSITE_ID: uuid, UMAMI_HOST: 'https://umami.example.com/' }).umami
				?.host
		).toBe('https://umami.example.com');
	});

	it('refuses values that are not the shapes they claim', () => {
		expect(() => analyticsSettings({ GA_MEASUREMENT_ID: "G-1');alert(1)//" })).toThrow();
		expect(() => analyticsSettings({ UMAMI_WEBSITE_ID: 'nope' })).toThrow();
		expect(() =>
			analyticsSettings({ UMAMI_WEBSITE_ID: uuid, UMAMI_HOST: 'http://x.com' })
		).toThrow();
	});
});
