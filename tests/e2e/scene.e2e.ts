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
	const toast = page.locator('[aria-live="polite"]');

	// The button first, before any key: the left mouse button is Primary fire in the demo
	// preset, and the button sits outside the mouse zone, so nothing fires.
	const button = page.getByRole('button', { name: /Cockpit view/ });
	await button.click();
	await expect(canvas).toHaveAttribute('data-op-camera', 'cockpit');
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await expect(toast).toContainText('Press anything');
	// A click doesn't focus it, so Space and Enter don't press it again.
	await expect(button).not.toBeFocused();
	await page.keyboard.press('Space');
	await page.keyboard.press('Enter');
	await expect(canvas).toHaveAttribute('data-op-camera', 'cockpit');

	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: 'Panels', exact: true })
		.click();
	await expect(page.getByText('Toggle camera')).toBeVisible();
	await page.keyboard.press('KeyK');
	await expect(canvas).toHaveAttribute('data-op-camera', 'chase');
	await expect(toast).toContainText('Toggle camera');
});

test('a lost WebGL context falls back to the placeholder', async ({ page }) => {
	await page.goto('./');
	const canvas = page.locator(scene);
	await expect(canvas).toHaveAttribute('data-op-ready', 'true', { timeout: 15_000 });
	await canvas.evaluate((el) => {
		const gl = (el as HTMLCanvasElement).getContext('webgl2');
		gl?.getExtension('WEBGL_lose_context')?.loseContext();
	});
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE · SHIP/)).toBeVisible();
	await expect(canvas).toHaveCount(0);
	await page.keyboard.press('KeyU');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Deploy hardpoints');
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

/** Every value an attribute of the scene canvas takes, from now on (timers end steps fast). */
async function recordAttribute(page: import('@playwright/test').Page, name: string) {
	await page.evaluate((attr) => {
		const el = document.querySelector('[data-op-scene="3d"]')!;
		const seen: string[] = [el.getAttribute(attr) ?? ''];
		(window as unknown as Record<string, string[]>)[`op-seen-${attr}`] = seen;
		new MutationObserver(() => seen.push(el.getAttribute(attr) ?? '')).observe(el, {
			attributes: true,
			attributeFilter: [attr]
		});
	}, name);
	return () =>
		page.evaluate(
			(attr) => (window as unknown as Record<string, string[]>)[`op-seen-${attr}`],
			name
		);
}

test('SRV mode mounts the Wick LR scene; steer and thruster keys reach it', async ({ page }) => {
	await page.goto('./');
	const canvas = page.locator(scene);
	await expect(canvas).toHaveAttribute('data-op-ready', 'true', { timeout: 15_000 });
	await expect(canvas).toHaveAttribute('data-op-scene-mode', 'ship');

	await page.getByRole('tab', { name: /SRV/ }).click();
	await expect(canvas).toHaveAttribute('data-op-scene-mode', 'srv');
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE/)).toHaveCount(0);
	await expect(canvas).toHaveAttribute('data-op-steer', '0');
	await expect(canvas).toHaveAttribute('data-op-jets', 'idle');

	// A and D are Steer left and right in the demo preset: the front wheels yaw ±20°.
	const steer = await recordAttribute(page, 'data-op-steer');
	await page.keyboard.press('KeyA');
	await expect.poll(steer).toContain('20');
	await page.keyboard.press('KeyD');
	await expect.poll(steer).toContain('-20');
	await expect(canvas).toHaveAttribute('data-op-steer', '0');

	// Space is Vertical thrusters: the hop jets go to the bright violet boost state.
	const jets = await recordAttribute(page, 'data-op-jets');
	await page.keyboard.press('Space');
	await expect.poll(jets).toContain('boost');
	await expect(canvas).toHaveAttribute('data-op-jets', 'idle');

	// U is Turret mode: the roof turret rises and the reticle shows; U again stows it.
	await expect(canvas).toHaveAttribute('data-op-turret', 'stowed');
	await expect(page.locator('[data-op-reticle]')).toHaveCount(0);
	await page.keyboard.press('KeyU');
	await expect(canvas).toHaveAttribute('data-op-turret', 'up');
	await expect(page.locator('[data-op-reticle]')).toBeVisible();
	await page.keyboard.press('KeyU');
	await expect(canvas).toHaveAttribute('data-op-turret', 'stowed');

	// K toggles the same camera in SRV: the driver's seat.
	const button = page.getByRole('button', { name: /Driver's view/ });
	await page.keyboard.press('KeyK');
	await expect(canvas).toHaveAttribute('data-op-camera', 'cockpit');
	await expect(button).toHaveAttribute('aria-pressed', 'true');

	// Back to the ship: its scene comes back, the SRV's is dropped.
	await page.getByRole('tab', { name: /Ship/ }).click();
	await expect(canvas).toHaveAttribute('data-op-scene-mode', 'ship');
	// On foot has no 3D scene yet: the placeholder, and no scene built.
	await page.getByRole('tab', { name: /On foot/ }).click();
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE · ON FOOT/)).toBeVisible();
	await expect(canvas).toHaveAttribute('data-op-scene-mode', 'none');
});

test('without WebGL the SRV keeps its 2D placeholder', async ({ page }) => {
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
	await page.getByRole('tab', { name: /SRV/ }).click();
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE · SRV/)).toBeVisible();
	await expect(page.locator(scene)).toHaveCount(0);
	// The tab keeps focus after the click, and Space would press it: steer instead.
	await page.keyboard.press('KeyA');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Steer left');
});
