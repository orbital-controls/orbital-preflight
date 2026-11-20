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
	// On foot swaps in Pad 7 at once.
	await page.getByRole('tab', { name: /On foot/ }).click();
	await expect(canvas).toHaveAttribute('data-op-scene-mode', 'foot');
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE/)).toHaveCount(0);
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

/** Opens the on-foot scene, standing where `spawn` says (a stop, or "x,z,yawDegrees"). */
async function onFoot(page: import('@playwright/test').Page, spawn: string) {
	await page.goto(`./?op-spawn=${spawn}`);
	const canvas = page.locator(scene);
	await expect(canvas).toHaveAttribute('data-op-ready', 'true', { timeout: 15_000 });
	await page.getByRole('tab', { name: /On foot/ }).click();
	await expect(canvas).toHaveAttribute('data-op-scene-mode', 'foot');
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE/)).toHaveCount(0);
	return canvas;
}

test('on foot mounts Pad 7; fire spends a segment and lights a target, reload refills', async ({
	page
}) => {
	// Stop 5 faces the middle ring, with its prompts.
	const canvas = await onFoot(page, '5');
	await expect(page.locator('[data-op-stop-prompt="5"]')).toContainText('Fire');
	await expect(page.locator('[data-op-crosshair]')).toBeVisible();
	await expect(canvas).toHaveAttribute('data-op-ammo', '6');
	await expect(canvas).toHaveAttribute('data-op-hits', '0');

	// Fire weapon is the left mouse button in the demo preset: a click in the viewport.
	const box = (await canvas.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(canvas).toHaveAttribute('data-op-ammo', '5');
	await expect(canvas).toHaveAttribute('data-op-hits', '1');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Fire weapon');

	// R reloads: the cartridge refills to six.
	await page.keyboard.press('KeyR');
	await expect(canvas).toHaveAttribute('data-op-ammo', '6');
});

test('walking into stop 6 shows the interact prompt with the bound key', async ({ page }) => {
	// Four and a half metres south of the pad console, facing it.
	const canvas = await onFoot(page, '-4.05,-4.2,0');
	const prompt = page.locator('[data-op-stop-prompt="6"]');
	await expect(prompt).toHaveCount(0);
	await page.keyboard.down('KeyW');
	await expect(prompt).toBeVisible({ timeout: 20_000 });
	await page.keyboard.up('KeyW');
	// E is Interact in the demo preset (tap, and hold); scan has no bind.
	await expect(prompt).toContainText('Stop 6 · Pad console');
	const use = prompt.locator('span', { hasText: /Use console$/ });
	await expect(use.getByText('E', { exact: true })).toBeVisible();
	await expect(prompt.getByText('E', { exact: true })).toHaveCount(2);
	await expect(prompt).toContainText('Not bound');
	await expect(page.getByText('Pad 7 · 1 of 7 stops')).toBeVisible();
	await expect(canvas).toHaveAttribute('data-op-scene-mode', 'foot');
});

test('without WebGL on foot keeps its 2D placeholder', async ({ page }) => {
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
	await page.getByRole('tab', { name: /On foot/ }).click();
	await expect(page.getByText(/PLACEHOLDER · 3D SCENE · ON FOOT/)).toBeVisible();
	await expect(page.locator(scene)).toHaveCount(0);
	// The board's interact prompt is still there, and the binds still fire.
	await expect(page.getByText('Interact · [Terminal]')).toBeVisible();
	await page.keyboard.press('KeyR');
	await expect(page.locator('[aria-live="polite"]')).toContainText('Reload');
});
