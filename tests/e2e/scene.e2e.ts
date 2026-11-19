import { expect, test } from '@playwright/test';

/** The 3D viewport: it mounts, reacts to the flight state, and falls back without WebGL. */

const scene = '[data-op-scene="3d"]';

test('the ship view mounts a WebGL canvas and the gear key moves the gear target', async ({
	page
}) => {
	await page.goto('./');
	await page.getByRole('button', { name: /^Binding for/ }).click();
	await page.locator('#drawer-file').setInputFiles('tests/fixtures/hotas.binds');
	await expect(page.getByText('hotas.binds')).toBeVisible();

	const canvas = page.locator(scene);
	await expect(canvas).toHaveAttribute('data-op-ready', 'true', { timeout: 15_000 });
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE/)).toHaveCount(0);
	await expect(canvas).toHaveAttribute('data-op-gear', '0');

	// L is landing gear in the fixture.
	await page.keyboard.press('KeyL');
	await expect(canvas).toHaveAttribute('data-op-gear', '1');
	await page.keyboard.press('KeyL');
	await expect(canvas).toHaveAttribute('data-op-gear', '0');
});

test('Toggle camera is a bind in Panels, and the viewport button does the same', async ({
	page
}) => {
	await page.goto('./');
	const canvas = page.locator(scene);
	await expect(canvas).toHaveAttribute('data-op-ready', 'true', { timeout: 15_000 });
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Panels', exact: true })
		.click();
	await expect(page.getByText('Toggle camera')).toBeVisible();

	await page.keyboard.press('KeyK');
	await expect(canvas).toHaveAttribute('data-op-camera', 'cockpit');
	const button = page.getByRole('button', { name: /Cockpit view/ });
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await button.click();
	await expect(canvas).toHaveAttribute('data-op-camera', 'chase');
	// The button isn't a mouse bind: clicking it fired nothing else.
	await expect(page.locator('[aria-live="polite"]')).toContainText('Toggle camera');
});

test('without WebGL the 2D placeholder stays and the page still works', async ({ page }) => {
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			type: string,
			...rest: unknown[]
		) {
			if (/webgl/.test(type)) return null;
			return (original as (...args: unknown[]) => RenderingContext | null).call(
				this,
				type,
				...rest
			);
		} as typeof original;
	});
	await page.goto('./');
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE · SHIP/)).toBeVisible();
	await expect(page.locator(scene)).toHaveCount(0);
	await page.keyboard.press('KeyU');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Deploy hardpoints');
});
