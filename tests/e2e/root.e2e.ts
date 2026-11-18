import { expect, test } from '@playwright/test';
import { fakeGamepads, press } from './controllers.ts';
import { exportAndParse, ready, rebind } from './helpers.ts';

test('the pilot’s default preset loads on first visit', async ({ page }) => {
	await page.goto('./');
	await expect(page).toHaveTitle('Orbital Preflight: test my space sim binds');
	await expect(page.locator('h1')).toHaveText('Orbital Preflight Preflight');
	await expect(page.getByText("Pilot's binds · Demo HOTAS setup")).toBeVisible();
	await expect(page.getByRole('tab', { name: /Ship/ })).toHaveAttribute('aria-selected', 'true');
});

test('a key press fires its binds and the HUD says so', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await page.keyboard.press('KeyU');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Deploy hardpoints');
});

test('rebind one action, export, and parse the export', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await rebind(page, 'Flight', 'Throttle to 50%', 'KeyP');
	await expect(page.getByText('1 unsaved change')).toBeVisible();

	const { fileName, parsed } = await exportAndParse(page);
	expect(fileName).toBe('Demo HOTAS rebound.4.0.binds');
	expect(parsed.presetName).toBe('Demo HOTAS rebound');
	expect(parsed.bindings.SetSpeed50[0]).toEqual({ input: { kind: 'key', code: 'KeyP' } });
});

test('a taken input offers Move, Swap and Keep both', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Systems', exact: true })
		.click();
	await page.getByRole('button', { name: /^Change primary bind for Deploy heat sink,/ }).click();
	await page.keyboard.press('KeyL');
	const card = page.getByRole('group', { name: 'Rebinding Deploy heat sink' });
	await expect(card).toContainText('already does');
	await expect(card.getByRole('button', { name: 'Keep both' })).toBeVisible();
	await card.getByRole('button', { name: 'Swap' }).click();
	await expect(page.getByText('2 unsaved changes')).toBeVisible();
});

test('drawers are dialogs: focus moves in, Esc closes, focus returns', async ({ page }) => {
	await page.goto('./');
	const opener = page.getByRole('button', { name: /^Binding for/ });
	await opener.click();
	const dialog = page.getByRole('dialog', { name: 'Game & binds' });
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(opener).toBeFocused();
});

test('Leave asks first when there are unsaved changes', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await rebind(page, 'Flight', 'Throttle to 50%', 'KeyP');
	await page.getByRole('link', { name: 'Leave' }).click();
	await expect(page.getByRole('dialog', { name: 'Leave preflight?' })).toBeVisible();
	await page.getByRole('button', { name: 'Stay in preflight' }).click();
	await expect(page.getByRole('dialog', { name: 'Leave preflight?' })).toBeHidden();
});

test('the full editor shares the store and has mode tabs', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await page.getByRole('button', { name: 'Full editor' }).click();
	await expect(page.getByRole('heading', { name: 'Bind editor' })).toBeFocused();
	await page.getByRole('tab', { name: /SRV/ }).click();
	await expect(page.getByRole('table')).toContainText('Accelerate');
	await page.getByRole('button', { name: 'Done · fly with these' }).click();
	await expect(page.getByRole('tab', { name: /SRV/ })).toHaveAttribute('aria-selected', 'true');
});

test('below 1280 px the desktop notice shows instead of the tool', async ({ page }) => {
	await page.setViewportSize({ width: 1000, height: 800 });
	await page.goto('./');
	await expect(page.getByRole('heading', { name: /Preflight needs a desktop/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /Demo HOTAS setup/ })).toBeVisible();
});

test('controllers show up on the deck under their own names as they’re detected', async ({
	page
}) => {
	await fakeGamepads(page, [
		{ id: 'T.16000M (Vendor: 044f Product: b10a)', buttons: 16 },
		{ id: 'VKBsim Gladiator EVO (Vendor: 1234 Product: 5678)', buttons: 32 }
	]);
	await page.goto('./');
	await ready(page);
	const deck = page.getByRole('region', { name: 'Input deck' });
	await expect(deck.getByRole('heading', { name: 'T.16000M' })).toBeVisible();
	await expect(deck.getByRole('heading', { name: 'VKBsim Gladiator EVO' })).toBeVisible();
	await expect(deck.getByText('Stick 1')).toHaveCount(0);
	await expect(page.getByRole('button', { name: '2 controllers connected' })).toBeVisible();

	// The T.16000M pairs with the file's T16000M by USB id, so its trigger fires Primary fire.
	await press(page, 0, 0);
	await expect(page.locator('[aria-live="polite"]')).toContainText('Primary fire');
});

test('with no controllers detected, the deck asks for a button press', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await expect(
		page.getByText('Press a button on your stick or throttle and it shows up here.')
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'No controllers connected' })).toBeVisible();
});
