import { expect, test } from '@playwright/test';

test('a theme override takes effect and the fonts come from the package', async ({ page }) => {
	const fonts: string[] = [];
	page.on('response', (r) => {
		if (r.url().endsWith('.woff2')) fonts.push(`${r.status()} ${r.url()}`);
	});
	await page.goto('./');
	await page.getByRole('button', { name: /Elite Dangerous/ }).click();
	const trail = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--color-trail').trim()
	);
	expect(trail).toBe('#ff6a00');
	// The "Choose a file" button is drawn in the trail colour.
	await expect(page.getByText('Choose a file').first()).toHaveCSS(
		'background-color',
		'rgb(255, 106, 0)'
	);

	await page.evaluate(() => document.fonts.ready);
	const loaded = await page.evaluate(() =>
		[
			'900 20px "Big Shoulders Display"',
			'600 12px Oxanium',
			'400 16px "IBM Plex Sans Condensed"'
		].map((f) => document.fonts.check(f))
	);
	expect(loaded).toEqual([true, true, true]);
	expect(fonts.length).toBeGreaterThan(0);
	expect(fonts.every((f) => f.startsWith('200 ') && f.includes('/_app/immutable/assets/'))).toBe(
		true
	);
});

test('the favicon takes its colours from the theme, overrides included', async ({ page }) => {
	await page.goto('./');
	const href = await page.locator('link[rel="icon"]').getAttribute('href');
	const svg = decodeURIComponent((href ?? '').split(',')[1] ?? '');
	expect(svg).toContain('<svg');
	expect(svg).not.toContain('var(');
	expect(svg).toContain('#ff6a00');
});

test('with no presets, the first visit is the bay, then the file drop', async ({ page }) => {
	await page.goto('./');
	await expect(page.getByRole('heading', { name: /Bring your binds/ })).toBeVisible();
	await expect(page.getByRole('button', { name: 'No game chosen. Load binds.' })).toBeVisible();
	await expect(page.getByText('Powered by Orbital Preflight')).toHaveCount(0);

	await page.getByRole('button', { name: /Elite Dangerous/ }).click();
	await expect(page.getByText('Now your')).toBeVisible();
	await page.getByRole('button', { name: 'Pick another game' }).click();
	await expect(page.getByRole('heading', { name: /Bring your binds/ })).toBeVisible();
	await page.getByRole('button', { name: /Elite Dangerous/ }).click();

	await page.locator('#first-file').setInputFiles('tests/fixtures/keyboard-only.binds');
	await expect(page.getByText('keyboard-only.binds')).toBeVisible();
	await expect(page.getByRole('tab', { name: /Ship/ })).toContainText('binds');
});

test('the head carries the canonical and Open Graph tags when siteUrl is set', async ({ page }) => {
	await page.goto('./');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://example.com/theme/'
	);
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		'https://example.com/theme/og.png'
	);
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		'content',
		'A build with a theme override and no shipped presets.'
	);
});

test('with no presets, Star Citizen from the bay opens on the game’s defaults', async ({
	page
}) => {
	await page.goto('./');
	const bay = page.getByRole('region', { name: /Bring your binds/ });
	await expect(
		bay.getByRole('button', { name: /Star Citizen.*Star Citizen 4\.10\.2 defaults/ })
	).toBeVisible();
	await bay.getByRole('button', { name: /Star Citizen/ }).click();
	await expect(page.getByText('Now your')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Binding for/ })).toContainText(
		'Star Citizen 4.10.2 defaults'
	);
});
