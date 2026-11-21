import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseEliteBinds } from '../../src/lib/orbital-preflight/sims/elite/index.ts';

/** Waits for the shipped demo preset to load. */
export async function ready(page: Page) {
	await expect(page.getByText("Pilot's binds · Demo HOTAS setup")).toBeVisible();
}

/** Opens Load binds for the current game, through the game manifest. */
export async function openLoad(page: Page, abbr = 'ED') {
	await page.getByRole('button', { name: /^Binding for/ }).click();
	await page
		.getByRole('dialog', { name: 'Switch game' })
		.getByRole('button', { name: `Load a different ${abbr} file` })
		.click();
	await expect(page.getByRole('dialog', { name: 'Load binds' })).toBeVisible();
}

/** Rebinds an action's primary slot to a key through the panel, and applies it. */
export async function rebind(page: Page, category: string, action: string, key: string) {
	await page
		.getByRole('group', { name: 'Category' })
		.getByRole('button', { name: category, exact: true })
		.click();
	await page
		.getByRole('button', {
			name: new RegExp(`^Change primary bind for ${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`)
		})
		.click();
	await expect(page.getByText('Press the new input. Nothing fires')).toBeVisible();
	await page.keyboard.press(key);
	const card = page.getByRole('group', { name: `Rebinding ${action}` });
	await card.getByRole('button', { name: /^(Apply|Move it here)$/ }).click();
}

/** Clicks Export ED preset and parses what the browser downloads. */
export async function exportAndParse(page: Page) {
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export ED preset' }).click()
	]);
	const path = await download.path();
	return {
		fileName: download.suggestedFilename(),
		parsed: parseEliteBinds(await readFile(path, 'utf8'))
	};
}
