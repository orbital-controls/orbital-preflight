import { expect, test } from '@playwright/test';
import { exportAndParse, openElite, openLoad, ready, rebind } from './helpers.ts';

const BASE = '/orbital-preflight';

test('works under a non-root base path', async ({ page }) => {
	const failed: string[] = [];
	page.on('response', (r) => {
		if (r.status() >= 400) failed.push(r.url());
	});
	await openElite(page);
	await ready(page);
	expect(failed).toEqual([]);

	await openLoad(page);
	const href = await page.getByRole('link', { name: /Download/ }).getAttribute('href');
	const url = new URL(href ?? '', page.url());
	expect(url.pathname).toBe(`${BASE}/binds/demo.binds`);
	const file = await page.request.get(url.href);
	expect(file.ok()).toBe(true);
	await page.keyboard.press('Escape');

	await rebind(page, 'Flight', 'Throttle to 50%', 'KeyP');
	const { parsed } = await exportAndParse(page);
	expect(parsed.presetName).toBe('Demo HOTAS rebound');
});
