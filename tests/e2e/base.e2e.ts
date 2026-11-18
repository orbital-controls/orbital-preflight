import { expect, test } from '@playwright/test';
import { exportAndParse, rebind } from './helpers.ts';

const BASE = '/orbital-preflight';

test('works under a non-root base path', async ({ page }) => {
	const failed: string[] = [];
	page.on('response', (r) => {
		if (r.status() >= 400) failed.push(r.url());
	});
	await page.goto('./');
	await expect(page.getByText("Pilot's binds · Demo HOTAS setup")).toBeVisible();
	expect(failed).toEqual([]);

	await page.getByRole('button', { name: /^Binding for/ }).click();
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

test('remembered layouts are kept per base path', async ({ page }) => {
	await page.goto('./');
	await page.getByRole('button', { name: /^Binding for/ }).click();
	await page.getByRole('checkbox', { name: 'Remember this layout on this browser' }).check();
	const keys = await page.evaluate(() => Object.keys(localStorage));
	expect(keys).toContain(`orbital-preflight:${BASE}:layout`);
});
