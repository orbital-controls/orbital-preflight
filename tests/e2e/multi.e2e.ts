import { expect, test, type Page } from '@playwright/test';
import { rebind } from './helpers.ts';

/**
 * Multi-game sessions, against the multi build: presets for Elite Dangerous and Star
 * Citizen, with Star Citizen standing in on Elite files (only Elite is `ready`).
 */

// Each test loads two games and mounts the 3D ship scene for both: on a two-core runner
// with software WebGL that runs past the default 30 s, as the scene tests do.
test.beforeEach(() => test.slow());

const bindingFor = (page: Page) => page.getByRole('button', { name: /^Binding for/ });
const manifest = (page: Page) => page.getByRole('dialog', { name: 'Switch game' });

/** Elite from the bay (its pilot's preset), one rebind, then Star Citizen from a file. */
async function twoGames(page: Page) {
	await page.goto('./');
	const bay = page.getByRole('region', { name: /Bring your binds/ });
	await expect(bay).toBeVisible();
	await bay.getByRole('button', { name: /Elite Dangerous/ }).click();
	await expect(page.getByText("Pilot's binds · Demo HOTAS setup").first()).toBeVisible();
	await rebind(page, 'Flight', 'Throttle to 50%', 'KeyP');
	await expect(page.getByText('1 unsaved in ED')).toBeVisible();

	await bindingFor(page).click();
	await manifest(page)
		.getByRole('button', { name: /Star Citizen/ })
		.click();
	await expect(page.getByText('Now your')).toBeVisible();
	await page.locator('#first-file').setInputFiles('tests/fixtures/hotas.binds');
	await expect(bindingFor(page)).toContainText('Star Citizen');
	await expect(bindingFor(page)).toContainText('hotas.binds');
}

test('first visit with presets for two games is the bay, with the pilot’s preset on each', async ({
	page
}) => {
	await page.goto('./');
	await expect(page.getByRole('heading', { name: /Bring your binds/ })).toBeVisible();
	await expect(bindingFor(page)).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'No game chosen. Load binds.' })).toBeVisible();
	const bay = page.getByRole('region', { name: /Bring your binds/ });
	await expect(bay.getByRole('button', { name: /Star Citizen.*Stand-in layout/ })).toBeVisible();
	// Coming later: listed, not offered.
	await expect(bay.getByText('DCS World')).toBeVisible();
	await expect(bay.getByRole('button', { name: /DCS World/ })).toHaveCount(0);
});

test('a rebind survives switching to another game and back', async ({ page }) => {
	await twoGames(page);
	await expect(page.getByText('0 unsaved in SC')).toBeVisible();
	await rebind(page, 'Flight', 'Throttle to zero', 'KeyO');
	await page.getByRole('tab', { name: /SRV/ }).click();

	await bindingFor(page).click();
	const loaded = manifest(page).getByRole('list', { name: 'Loaded this session' });
	await expect(loaded.getByRole('button', { name: /Elite Dangerous.*1 unsaved/ })).toBeVisible();
	await expect(
		loaded.getByRole('button', { name: /Star Citizen.*1 unsaved.*Binding now/ })
	).toBeVisible();
	await loaded.getByRole('button', { name: /Elite Dangerous/ }).click();
	await expect(manifest(page)).toBeHidden();

	// Elite's edit and its badge, in the mode it was left in (Ship).
	await expect(page.getByText('1 unsaved in ED')).toBeVisible();
	await expect(page.getByRole('tab', { name: /Ship/ })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByLabel('1 unsaved changes in Ship')).toBeVisible();
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Flight', exact: true })
		.click();
	await expect(
		page.getByRole('button', { name: /^Change primary bind for Throttle to 50%, now P$/ })
	).toBeVisible();

	// And Star Citizen kept its own, in SRV.
	await bindingFor(page).click();
	await manifest(page)
		.getByRole('button', { name: /Star Citizen/ })
		.click();
	await expect(page.getByText('1 unsaved in SC')).toBeVisible();
	await expect(page.getByRole('tab', { name: /SRV/ })).toHaveAttribute('aria-selected', 'true');
});

test('Leave counts every game and offers to export them all', async ({ page }) => {
	await twoGames(page);
	await rebind(page, 'Flight', 'Throttle to zero', 'KeyO');
	await page.getByRole('link', { name: 'Leave' }).click();
	const dialog = page.getByRole('dialog', { name: 'Leave preflight?' });
	await expect(dialog).toContainText('1 in Elite Dangerous, 1 in Star Citizen');
	await expect(
		dialog.getByRole('button', { name: 'Export all 2 games, then leave' })
	).toBeVisible();
});

test('the manifest closes on Esc and returns focus, and blocks binds while open', async ({
	page
}) => {
	await twoGames(page);
	await bindingFor(page).click();
	await expect(bindingFor(page)).toHaveAttribute('aria-expanded', 'true');
	// Focus moved in.
	await expect(manifest(page).getByRole('button').first()).toBeFocused();
	// U is Deploy hardpoints: nothing fires with the manifest open.
	await page.keyboard.press('KeyU');
	await expect(page.locator('[aria-live="polite"]')).not.toContainText('Deploy hardpoints');
	await page.keyboard.press('Escape');
	await expect(manifest(page)).toBeHidden();
	await expect(bindingFor(page)).toBeFocused();
	await expect(bindingFor(page)).toHaveAttribute('aria-expanded', 'false');

	// A click outside closes it too.
	await bindingFor(page).click();
	await page.mouse.click(1200, 900);
	await expect(manifest(page)).toBeHidden();
});

test('Load binds replaces the current game only', async ({ page }) => {
	await twoGames(page);
	await bindingFor(page).click();
	await manifest(page).getByRole('button', { name: 'Load a different SC file' }).click();
	const drawer = page.getByRole('dialog', { name: 'Load binds' });
	await expect(drawer).toContainText('A new file for Star Citizen');
	await drawer.locator('#drawer-file').setInputFiles('tests/fixtures/keyboard-only.binds');
	await expect(bindingFor(page)).toContainText('keyboard-only.binds');
	await bindingFor(page).click();
	await expect(
		manifest(page).getByRole('button', { name: /Elite Dangerous.*1 unsaved/ })
	).toBeVisible();
});

test('the full editor switches games in place and keeps its filter', async ({ page }) => {
	await twoGames(page);
	await page.getByRole('button', { name: 'Full editor' }).click();
	await expect(page.getByRole('heading', { name: 'Bind editor' })).toBeFocused();
	const changed = page
		.getByRole('group', { name: 'Show' })
		.getByRole('button', { name: /Changed/ });
	await changed.click();
	await expect(changed).toHaveAttribute('aria-pressed', 'true');

	await bindingFor(page).click();
	await manifest(page)
		.getByRole('button', { name: /Elite Dangerous/ })
		.click();
	await expect(page.getByRole('heading', { name: 'Bind editor' })).toBeVisible();
	await expect(bindingFor(page)).toContainText('Elite Dangerous');
	await expect(changed).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('table')).toContainText('Throttle to 50%');
	await expect(page.getByText('1 unsaved in ED')).toBeVisible();
});
