import { describe, expect, it } from 'vitest';
import { analyticsHead, googleSnippet, umamiSnippet } from './snippet.ts';

describe('analytics head', () => {
	it('writes nothing with no IDs', () => {
		expect(analyticsHead({ google: null, umami: null }, '')).toBe('');
	});

	it('writes the Google bootstrap without the remote tag, consent denied by default', () => {
		const html = googleSnippet('G-ABC123', '/my-binds');
		expect(html).toContain("gtag('config', 'G-ABC123', { send_page_view: false })");
		expect(html).toContain('analytics_storage: consent');
		expect(html).toContain("ad_storage: 'denied'");
		expect(html).toContain('"orbital-preflight:/my-binds:consent"');
		// Only inside the loader, never as a <script src> in the served HTML.
		expect(html).not.toMatch(/<script[^>]+googletagmanager/);
	});

	it('writes the Umami script with automatic page views off', () => {
		const html = umamiSnippet({
			websiteId: '0b9c2a1e-1234-4abc-9def-0123456789ab',
			host: 'https://umami.example.com'
		});
		expect(html).toContain('src="https://umami.example.com/script.js"');
		expect(html).toContain('data-website-id="0b9c2a1e-1234-4abc-9def-0123456789ab"');
		expect(html).toContain('data-auto-pageview="false"');
	});

	it('writes both when both are set', () => {
		const html = analyticsHead(
			{
				google: 'G-ABC123',
				umami: { websiteId: '0b9c2a1e-1234-4abc-9def-0123456789ab', host: 'https://cloud.umami.is' }
			},
			''
		);
		expect(html).toContain('gtag(');
		expect(html).toContain('cloud.umami.is/script.js');
	});
});
