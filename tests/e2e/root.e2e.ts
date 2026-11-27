import { expect, test } from '@playwright/test';
import { fakeGamepads, hold, press, unplug } from './controllers.ts';
import { readFile } from 'node:fs/promises';
import {
	HOME,
	homeCamera,
	MAP_H,
	MAP_W,
	plotRoute,
	project,
	SYSTEMS,
	systemById
} from '../../src/lib/orbital-preflight/galaxy.ts';
import { exportAndParse, openElite, openLoad, ready, rebind } from './helpers.ts';

test('a first visit is the bay: the pilot’s Elite preset and Star Citizen’s defaults', async ({
	page
}) => {
	await page.goto('./');
	await expect(page).toHaveTitle('Orbital Preflight: test my space sim binds');
	await expect(page.locator('h1')).toHaveText('Orbital Preflight');
	const bay = page.getByRole('region', { name: /Bring your binds/ });
	await expect(
		bay.getByRole('button', { name: /Elite Dangerous.*Demo HOTAS setup/ })
	).toBeVisible();
	await expect(
		bay.getByRole('button', { name: /Star Citizen.*Star Citizen 4\.10\.2 defaults/ })
	).toBeVisible();
	await bay.getByRole('button', { name: /Elite Dangerous/ }).click();
	await ready(page);
	await expect(page.getByRole('tab', { name: /Ship/ })).toHaveAttribute('aria-selected', 'true');
});

test('a config with no analytics IDs writes no tags and asks nothing', async ({ page }) => {
	await page.goto('./');
	await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
	await expect(page.locator('#op-umami, script[src*="googletagmanager"]')).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);
	expect(await page.evaluate(() => 'dataLayer' in window)).toBe(false);
});

test('a key press fires its binds and the HUD says so', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await page.keyboard.press('KeyU');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Deploy hardpoints');
});

test('the galaxy map opens, plots a route and the drive jumps along it', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await page.keyboard.down('ShiftLeft');
	await page.keyboard.press('KeyM');
	await page.keyboard.up('ShiftLeft');
	const map = page.getByRole('region', { name: 'Galaxy map' });
	await expect(map).toBeVisible();
	await expect(map.getByText('Location · Halden')).toBeVisible();
	// On the map, W moves the map rather than pitching the ship.
	await page.keyboard.press('KeyW');
	await expect(map.getByText('Last input · Map forward')).toBeVisible();
	await page.keyboard.press('Home');

	// Click a system two or more jumps out, where the map draws it, and plot a route.
	const far = SYSTEMS.find((s) => (plotRoute(HOME, s.id)?.length ?? 0) >= 2)!;
	const at = project(homeCamera(), far.pos, MAP_W, MAP_H)!;
	const box = (await map.locator('canvas').boundingBox())!;
	await page.mouse.click(box.x + (at.x * box.width) / MAP_W, box.y + (at.y * box.height) / MAP_H);
	await expect(map.getByRole('heading', { name: far.name })).toBeVisible();
	await map.getByRole('button', { name: 'Plot route' }).click();
	const first = systemById(plotRoute(HOME, far.id)![0])!.name;
	await expect(map.getByRole('listitem').filter({ hasText: first })).toBeVisible();

	// Back to the cockpit: the HUD names the target, and the drive jumps there.
	await page.keyboard.press('Backspace');
	await expect(map).toBeHidden();
	await expect(page.locator('[data-op-next-jump]')).toContainText(first);
	await page.keyboard.press('KeyJ');
	const nextJump = page.locator('[data-op-next-jump]');
	await expect(nextJump).toContainText('charging');
	// The arrival toast lasts two seconds, so check what stays: the next system is targeted.
	const second = systemById(plotRoute(HOME, far.id)![1])!.name;
	await expect(nextJump).toContainText(second, { timeout: 20_000 });
	await expect(nextJump).not.toContainText('charging');
});

test('rebind one action, export, and parse the export', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await rebind(page, 'Flight', 'Throttle to 50%', 'KeyP');
	await expect(page.getByText('1 unsaved in ED')).toBeVisible();

	const { fileName, parsed } = await exportAndParse(page);
	expect(fileName).toBe('Demo HOTAS rebound.4.0.binds');
	expect(parsed.presetName).toBe('Demo HOTAS rebound');
	expect(parsed.bindings.SetSpeed50[0]).toEqual({ input: { kind: 'key', code: 'KeyP' } });
});

test('a taken input offers Move, Swap and Keep both', async ({ page }) => {
	await openElite(page);
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
	await expect(page.getByText('2 unsaved in ED')).toBeVisible();
});

test('drawers are dialogs: focus moves in, Esc closes, focus returns', async ({ page }) => {
	await openElite(page);
	await ready(page);
	const opener = page.getByRole('button', { name: 'No controllers connected' });
	await opener.click();
	const dialog = page.getByRole('dialog', { name: 'Controllers' });
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(opener).toBeFocused();
});

test('Leave asks first when there are unsaved changes', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await rebind(page, 'Flight', 'Throttle to 50%', 'KeyP');
	await page.getByRole('link', { name: 'Leave' }).click();
	await expect(page.getByRole('dialog', { name: 'Leave preflight?' })).toBeVisible();
	await page.getByRole('button', { name: 'Stay in preflight' }).click();
	await expect(page.getByRole('dialog', { name: 'Leave preflight?' })).toBeHidden();
});

test('the full editor shares the store and has mode tabs', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await page.getByRole('button', { name: 'Full editor' }).click();
	await expect(page.getByRole('heading', { name: 'Bind editor' })).toBeFocused();
	await page.getByRole('tab', { name: /SRV/ }).click();
	await expect(page.getByRole('table')).toContainText('Accelerate');
	await page.getByRole('button', { name: 'Done · fly with these' }).click();
	await expect(page.getByRole('tab', { name: /SRV/ })).toHaveAttribute('aria-selected', 'true');
});

test('Load binds offers the current game’s presets', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await openLoad(page);
	const drawer = page.getByRole('dialog', { name: 'Load binds' });
	await expect(drawer).toContainText('A new file for Elite Dangerous');
	await expect(drawer.getByText('Loaded', { exact: true })).toBeVisible();
	await expect(drawer.getByRole('group', { name: 'Sim' })).toHaveCount(0);
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
	await openElite(page);
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
	await openElite(page);
	await ready(page);
	await expect(
		page.getByText('Press a button on your stick or throttle and it shows up here.')
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'No controllers connected' })).toBeVisible();
});

test('a rebind can be finished from the keyboard alone', async ({ page }) => {
	await openElite(page);
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
	await expect(page.getByText('1 unsaved in ED')).toBeVisible();
});

test('Esc leaves a rebind without binding Esc', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Flight', exact: true })
		.click();
	await page.getByRole('button', { name: /^Change primary bind for Throttle to 50%,/ }).click();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('group', { name: 'Rebinding Throttle to 50%' })).toBeHidden();
	await expect(page.getByText('0 unsaved in ED')).toBeVisible();
});

test('holding Shift with a key captures Shift+key', async ({ page }) => {
	await openElite(page);
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
	await openElite(page);
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

test('with the Controllers drawer open, pressing a button pairs an unknown controller', async ({
	page
}) => {
	// No USB id in Gamepad.id, so it can't match by USB and waits for a press.
	await fakeGamepads(page, [{ id: 'Mystery Stick', buttons: 12 }]);
	await openElite(page);
	await ready(page);
	await page.getByRole('button', { name: '1 controller connected' }).click();
	const drawer = page.getByRole('dialog', { name: 'Controllers' });
	await expect(drawer.getByText('Press any button', { exact: true })).toBeVisible();
	await press(page, 0, 2);
	await expect(drawer.getByText('Paired', { exact: true })).toBeVisible();
	await expect(drawer.getByText('Mystery Stick', { exact: true })).toBeVisible();
	await expect(drawer.getByText(/Thrustmaster T\.16000M in your file/)).toBeVisible();
});

test('a gamepad pairs with the file’s gamepad and fires its binds by control name', async ({
	page
}) => {
	await fakeGamepads(page, [
		{ id: 'Xbox Controller (STANDARD GAMEPAD)', buttons: 16, mapping: 'standard' }
	]);
	await openElite(page);
	await ready(page);
	await openLoad(page);
	// A stick and a gamepad (Elite names unknown devices by USB id, here product 0000).
	const file = [
		'<Root PresetName="Pad" MajorVersion="4" MinorVersion="1">',
		'\t<UI_Select>',
		'\t\t<Primary Device="046D0000" Key="GamePad_FaceDown" />',
		'\t\t<Secondary Device="{NoDevice}" Key="" />',
		'\t</UI_Select>',
		'\t<PrimaryFire>',
		'\t\t<Primary Device="T16000M" Key="Joy_1" />',
		'\t\t<Secondary Device="{NoDevice}" Key="" />',
		'\t</PrimaryFire>',
		'</Root>',
		''
	].join('\n');
	await page
		.locator('#drawer-file')
		.setInputFiles({ name: 'pad.binds', mimeType: 'text/plain', buffer: Buffer.from(file) });
	await expect(page.getByText('pad.binds')).toBeVisible();

	await page.getByRole('button', { name: '1 controller connected' }).click();
	const drawer = page.getByRole('dialog', { name: 'Controllers' });
	await press(page, 0, 0);
	await expect(drawer.getByText('Paired', { exact: true })).toBeVisible();
	await expect(drawer.getByText(/Logitech gamepad in your file/)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(drawer).toBeHidden();
	// Let the pairing press go up, and the hub see it, before pressing again.
	await page.waitForFunction(
		() =>
			!(window as unknown as { __pads: { buttons: { pressed: boolean }[] }[] }).__pads[0].buttons[0]
				.pressed
	);
	await page.evaluate(
		() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
	);

	// A (GamePad_FaceDown) is Menu select.
	await press(page, 0, 0);
	await expect(page.locator('[aria-live="polite"]')).toContainText('Menu select');
});

test('switching to Star Citizen with no preset opens on the game’s defaults', async ({ page }) => {
	await openElite(page);
	await ready(page);
	await page.getByRole('button', { name: /^Binding for/ }).click();
	await page
		.getByRole('dialog', { name: 'Switch game' })
		.getByRole('button', { name: /Star Citizen/ })
		.click();
	await expect(page.getByText('Now your')).toHaveCount(0);
	const binding = page.getByRole('button', { name: /^Binding for/ });
	await expect(binding).toContainText('Star Citizen');
	await expect(binding).toContainText('Star Citizen 4.10.2 defaults');
	await expect(page.getByRole('tab', { name: /Vehicle/ })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /^Change primary bind for Throttle - Increase, now W$/ })
	).toBeVisible();
	// W is Throttle - Increase in the game's defaults.
	await page.keyboard.press('KeyW');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Throttle - Increase');
});

test('X4 opens on the game’s Keyboard and Mouse profile and exports an inputmap.xml', async ({
	page
}) => {
	await openElite(page);
	await ready(page);
	await page.getByRole('button', { name: /^Binding for/ }).click();
	await page
		.getByRole('dialog', { name: 'Switch game' })
		.getByRole('button', { name: /X4: Foundations/ })
		.click();
	const binding = page.getByRole('button', { name: /^Binding for/ });
	await expect(binding).toContainText('X4: Foundations');
	await expect(binding).toContainText('X4 9.00 defaults');
	await expect(page.getByRole('tab', { name: /First person/ })).toBeVisible();
	await expect(page.getByRole('tab', { name: /Vehicle|SRV/ })).toHaveCount(0);
	// X is Accelerate in the game's profile (its Boost is on Tab, which the browser keeps).
	await page.keyboard.press('KeyX');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Accelerate');

	await rebind(page, 'Steering: Digital', 'Boost', 'KeyJ');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export X4 preset' }).click()
	]);
	expect(download.suggestedFilename()).toBe('inputmap.xml');
	const text = await readFile(await download.path(), 'utf8');
	expect(text).toContain(
		'<state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_J" />'
	);
	expect(text).not.toContain(
		'<state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_TAB" />'
	);
});
