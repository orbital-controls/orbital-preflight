import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers.ts';

/**
 * The analytics variant: both providers configured. Every third-party request is
 * answered locally, so the tests see what the page asks for without reaching anyone.
 */
async function trackRequests(page: Page): Promise<string[]> {
	const seen: string[] = [];
	await page.route(/googletagmanager\.com|umami\.invalid/, (route) => {
		seen.push(route.request().url());
		return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
	});
	return seen;
}

const banner = (page: Page) => page.getByRole('region', { name: 'Analytics consent' });

test('nothing goes to Google before the visitor allows it; Umami loads regardless', async ({
	page
}) => {
	const seen = await trackRequests(page);
	await page.goto('./');
	await ready(page);
	await expect(banner(page)).toBeVisible();
	await expect(banner(page)).toContainText('A count of visits is kept either way');
	expect(seen.some((url) => url.includes('googletagmanager'))).toBe(false);
	expect(seen.some((url) => url.includes('umami.invalid/script.js'))).toBe(true);
});

test('Allow loads the Google tag, and the choice is remembered', async ({ page }) => {
	const seen = await trackRequests(page);
	await page.goto('./');
	await banner(page).getByRole('button', { name: 'Allow' }).click();
	await expect(banner(page)).toBeHidden();
	await expect(page.locator('#op-gtag')).toHaveAttribute('src', /id=G-TEST000000/);
	expect(seen.some((url) => url.includes('googletagmanager'))).toBe(true);

	await page.reload();
	await ready(page);
	await expect(banner(page)).toBeHidden();
	await expect(page.locator('#op-gtag')).toHaveCount(1);
});

test('Decline keeps Google out, and the banner stays gone', async ({ page }) => {
	const seen = await trackRequests(page);
	await page.goto('./');
	await banner(page).getByRole('button', { name: 'Decline' }).click();
	await expect(banner(page)).toBeHidden();

	await page.reload();
	await ready(page);
	await expect(banner(page)).toBeHidden();
	await expect(page.locator('#op-gtag')).toHaveCount(0);
	expect(seen.some((url) => url.includes('googletagmanager'))).toBe(false);
});
