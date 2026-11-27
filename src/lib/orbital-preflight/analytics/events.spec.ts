import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportBindsExport, reportPageView } from './events.ts';
import { GA_SCRIPT_ID } from './gtag.ts';
import { UMAMI_SCRIPT_ID } from './umami.ts';

/** A window and document carrying whichever tags the test says the page has. */
function page(tags: string[]) {
	const track = vi.fn();
	const win: { dataLayer?: IArguments[]; umami?: { track: typeof track } } = { umami: { track } };
	vi.stubGlobal('window', win);
	vi.stubGlobal('document', { getElementById: (id: string) => (tags.includes(id) ? {} : null) });
	return { win, track };
}

describe('events', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('is a no-op with no tags in the page', () => {
		const { win, track } = page([]);
		reportPageView('https://x/', 'X');
		reportBindsExport('elite-dangerous', 3);
		expect(win.dataLayer).toBeUndefined();
		expect(track).not.toHaveBeenCalled();
	});

	it('reports to both providers when both tags are present', () => {
		const { win, track } = page([GA_SCRIPT_ID, UMAMI_SCRIPT_ID]);
		reportBindsExport('elite-dangerous', 3);
		expect([...win.dataLayer![0]]).toEqual([
			'event',
			'binds_export',
			{ sim: 'elite-dangerous', changes: 3 }
		]);
		expect(track).toHaveBeenCalledWith('binds_export', { sim: 'elite-dangerous', changes: 3 });
	});

	it('leaves Google alone until consent has loaded its tag', () => {
		const { win, track } = page([UMAMI_SCRIPT_ID]);
		reportPageView('https://x/', 'X');
		expect(win.dataLayer).toBeUndefined();
		expect(track).toHaveBeenCalledOnce();
	});
});
