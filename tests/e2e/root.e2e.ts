import { expect, test } from '@playwright/test';
import { fakeGamepads, hold, press, unplug } from './controllers.ts';
import { exportAndParse, ready, rebind } from './helpers.ts';

test('the pilot’s default preset loads on first visit', async ({ page }) => {
	await page.goto('./');
	await expect(page).toHaveTitle('Orbital Preflight: test my space sim binds');
	await expect(page.locator('h1')).toHaveText('Orbital Preflight');
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

test('a rebind can be finished from the keyboard alone', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Flight', exact: true })
		.click();
	const slot = page.getByRole('button', { name: /^Change primary bind for Throttle to 50%,/ });
	await slot.focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('KeyP');
	const card = page.getByRole('group', { name: 'Rebinding Throttle to 50%' });
	await expect(card).toContainText('is free');
	// Tab to Apply and press Enter: it applies, rather than becoming the new bind.
	await card.getByRole('button', { name: 'Apply' }).focus();
	await page.keyboard.press('Enter');
	await expect(card).toBeHidden();
	await expect(page.getByText('1 unsaved change')).toBeVisible();
});

test('Esc leaves a rebind without binding Esc', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Flight', exact: true })
		.click();
	await page.getByRole('button', { name: /^Change primary bind for Throttle to 50%,/ }).click();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('group', { name: 'Rebinding Throttle to 50%' })).toBeHidden();
	await expect(page.getByText('0 unsaved changes')).toBeVisible();
});

test('holding Shift with a key captures Shift+key', async ({ page }) => {
	await page.goto('./');
	await ready(page);
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Flight', exact: true })
		.click();
	await page.getByRole('button', { name: /^Change primary bind for Throttle to 50%,/ }).click();
	await page.keyboard.down('ShiftLeft');
	await page.keyboard.down('KeyK');
	await page.keyboard.up('KeyK');
	await page.keyboard.up('ShiftLeft');
	const card = page.getByRole('group', { name: 'Rebinding Throttle to 50%' });
	await expect(card).toContainText('Shift+K is free');
});

test('a controller pulled out mid-press lets go of its button', async ({ page }) => {
	await fakeGamepads(page, [{ id: 'T.16000M (Vendor: 044f Product: b10a)', buttons: 16 }]);
	await page.goto('./');
	await ready(page);
	const deck = page.getByRole('region', { name: 'Input deck' });
	const toast = page.locator('[aria-live="polite"]');
	await expect(deck.getByRole('heading', { name: 'T.16000M' })).toBeVisible();

	// B2 is Secondary fire in the demo file. Hold it, then press something else.
	await hold(page, 0, 1);
	await expect(toast).toContainText('Secondary fire');
	await page.keyboard.press('KeyU');
	await expect(toast).toContainText('Deploy hardpoints');

	// Pull the cable with B2 still down, then plug it back in, still held.
	const replug = await unplug(page, 0);
	await expect(page.getByRole('button', { name: 'No controllers connected' })).toBeVisible();
	await replug();
	// Had B2 stayed held from before, this press would be ignored.
	await expect(toast).toContainText('Secondary fire');
});
