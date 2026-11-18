import type { Page } from '@playwright/test';

export interface FakePad {
	id: string;
	buttons: number;
}

/**
 * Stands in for the Gamepad API: the page sees `pads` as connected controllers. Call
 * `press(page, index, button)` to hold a button for a moment.
 */
export async function fakeGamepads(page: Page, pads: FakePad[]) {
	await page.addInitScript((list: FakePad[]) => {
		const state = list.map((p, index) => ({
			index,
			id: p.id,
			connected: true,
			mapping: '',
			timestamp: 0,
			axes: [0, 0, 0, 0],
			buttons: Array.from({ length: p.buttons }, () => ({
				pressed: false,
				touched: false,
				value: 0
			}))
		}));
		(window as unknown as { __pads: typeof state }).__pads = state;
		Object.defineProperty(navigator, 'getGamepads', { value: () => state });
	}, pads);
}

export async function press(page: Page, index: number, button: number) {
	await page.evaluate(
		([i, b]) => {
			const pads = (
				window as unknown as { __pads: { buttons: { pressed: boolean; value: number }[] }[] }
			).__pads;
			pads[i].buttons[b] = { ...pads[i].buttons[b], pressed: true, value: 1 };
			setTimeout(
				() => (pads[i].buttons[b] = { ...pads[i].buttons[b], pressed: false, value: 0 }),
				150
			);
		},
		[index, button]
	);
}
