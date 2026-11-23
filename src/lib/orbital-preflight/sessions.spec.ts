import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { OrbitalPreflight } from './app.svelte.ts';
import { resolveConfig, type OrbitalPreflightConfig } from './config.ts';
import { leaveSummary } from './leave.ts';

// Session behaviour, not file formats: Star Citizen stands in here with Elite files, so
// both games read the same fixtures (multi.e2e.ts switches between real files).
vi.mock('./sims/index.ts', async (importOriginal) => {
	const real = await importOriginal<typeof import('./sims/index.ts')>();
	const elite = real.simById('elite-dangerous');
	const sims = real.SIMS.map((s) =>
		s.id === 'star-citizen'
			? {
					...elite,
					id: s.id,
					name: s.name,
					short: s.short,
					parse: (source: string) => ({ ...elite.parse!(source), sim: s.id })
				}
			: s
	);
	return {
		...real,
		SIMS: sims,
		// The stand-in reads Elite files and has no defaults of its own.
		SIMS_WITH_DEFAULTS: [],
		simById: (id: string) => {
			const sim = sims.find((s) => s.id === id);
			if (!sim) throw new Error(id);
			return sim;
		}
	};
});

const hotas = readFileSync('tests/fixtures/hotas.binds', 'utf8');
const keyboard = readFileSync('tests/fixtures/keyboard-only.binds', 'utf8');
const P = { input: { kind: 'key', code: 'KeyP' } } as const;
const O = { input: { kind: 'key', code: 'KeyO' } } as const;

function app(config: Partial<OrbitalPreflightConfig> = {}) {
	return new OrbitalPreflight(
		resolveConfig({ title: 't', description: 'd', siteName: 's', homeUrl: 'h', ...config }),
		{ 'demo.binds': hotas, 'kb.binds': keyboard }
	);
}

/** Elite from a file with one edit, then Star Citizen from another. */
function twoGames() {
	const a = app();
	a.switchTo('elite-dangerous');
	a.loadText(hotas, { kind: 'upload', fileName: 'hotas.binds' });
	a.store.settle({ actionId: 'SetSpeed50', slot: 0 }, { kind: 'apply' }, P);
	a.switchTo('star-citizen');
	a.loadText(hotas, { kind: 'upload', fileName: 'sc.binds' });
	return a;
}

describe('multi-game sessions', () => {
	it('switching keeps each game’s edits and mode', () => {
		const a = twoGames();
		expect(a.sim).toBe('star-citizen');
		expect(a.store.changes).toBe(0);
		a.store.settle({ actionId: 'SetSpeedZero', slot: 0 }, { kind: 'apply' }, O);
		a.setMode('srv');

		a.switchTo('elite-dangerous');
		expect(a.mode).toBe('ship');
		expect(a.store.bindings.SetSpeed50[0]).toEqual(P);
		expect(a.store.changes).toBe(1);
		expect(a.fileLine).toBe('hotas.binds');

		a.switchTo('star-citizen');
		expect(a.mode).toBe('srv');
		expect(a.store.bindings.SetSpeedZero[0]).toEqual(O);
		expect(a.store.bindings.SetSpeed50[0]).not.toEqual(P);
		expect(a.fileLine).toBe('sc.binds');
	});

	it('switching starts the mock flight over, but keeps the camera', () => {
		const a = twoGames();
		a.onInput({ input: { kind: 'key', code: 'KeyU' }, pressed: true });
		a.toggleCamera();
		expect(a.flight.hp).toBe(true);
		expect(a.last).not.toBeNull();
		a.switchTo('elite-dangerous');
		expect(a.flight.hp).toBe(false);
		expect(a.flight.cam).toBe('cockpit');
		expect(a.last).toBeNull();
		expect(a.lastActs).toEqual([]);
	});

	it('counts changes per game and across games', () => {
		const a = twoGames();
		a.store.settle({ actionId: 'SetSpeedZero', slot: 0 }, { kind: 'apply' }, O);
		a.store.settle({ actionId: 'SetSpeed50', slot: 0 }, { kind: 'apply' }, P);
		expect(a.games.changesBySim.get('elite-dangerous')).toBe(1);
		expect(a.games.changesBySim.get('star-citizen')).toBe(2);
		const sc = 2;
		expect(a.games.totalChanges).toBe(1 + sc);
		const rows = a.gameRows;
		expect(rows.find((r) => r.sim.id === 'elite-dangerous')?.status).toBe('1 unsaved');
		expect(rows.find((r) => r.sim.id === 'dcs')?.status).toBe('Coming later');
		expect(leaveSummary(rows)).toMatchObject({
			total: 1 + sc,
			exportLabel: 'Export all 2 games, then leave'
		});
		expect(leaveSummary(rows).body).toContain(`1 in Elite Dangerous, ${sc} in Star Citizen`);
	});

	it('loading a new file for one game leaves the others untouched', () => {
		const a = twoGames();
		a.loadText(keyboard, { kind: 'upload', fileName: 'kb.binds' });
		expect(a.fileLine).toBe('kb.binds');
		const elite = a.games.get('elite-dangerous')!;
		expect(elite.store.bindings.SetSpeed50[0]).toEqual(P);
		expect(elite.store.file?.origin).toEqual({ kind: 'upload', fileName: 'hotas.binds' });
	});

	it('a game picked but not loaded waits for its file, and the bay drops it', () => {
		const a = twoGames();
		a.switchTo('elite-dangerous');
		a.switchTo('dcs');
		expect(a.sim).toBe('elite-dangerous');
		a.openBay();
		expect(a.chosen).toBe(false);
		expect(a.loaded).toBe(false);
		expect(a.games.sessions.size).toBe(2);
		expect(a.gameRows.filter((r) => r.loaded)).toHaveLength(2);
	});

	it('bind inputs don’t fire with the manifest open', () => {
		const a = twoGames();
		a.toggleManifest(true);
		a.onInput({ input: { kind: 'key', code: 'KeyU' }, pressed: true });
		expect(a.flight.hp).toBe(false);
		a.toggleManifest(false);
		a.onInput({ input: { kind: 'key', code: 'KeyU' }, pressed: true });
		expect(a.flight.hp).toBe(true);
	});

	it('controller pairing is kept per game', () => {
		const a = twoGames();
		a.hub.pads = [
			{
				index: 0,
				id: 'Mystery Stick',
				name: 'Mystery Stick',
				buttons: 12,
				axes: 4,
				standard: false,
				deviceId: null,
				pairedBy: null
			}
		];
		a.hub.pair(0, 'T16000M', 'press');
		a.switchTo('elite-dangerous');
		a.hub.pair(0, null);
		expect(a.hub.pads[0].deviceId).toBeNull();
		a.switchTo('star-citizen');
		expect(a.hub.pads[0]).toMatchObject({ deviceId: 'T16000M', pairedBy: 'press' });
	});
});

describe('first visit', () => {
	it('with no presets, the bay', () => {
		const a = app();
		a.init();
		expect(a.chosen).toBe(false);
	});

	it('with presets for one sim, the first loads and the bay is skipped', () => {
		const a = app({
			presets: [
				{ file: 'demo.binds', label: 'Demo' },
				{ file: 'kb.binds', label: 'Keyboard' }
			]
		});
		a.init();
		expect(a.sim).toBe('elite-dangerous');
		expect(a.fileLine).toBe("Pilot's binds · Demo");
	});

	it('with presets for several sims, the bay, and a tile loads its preset', () => {
		const a = app({
			presets: [
				{ file: 'demo.binds', label: 'Demo' },
				{ file: 'kb.binds', label: 'Stand-in', sim: 'star-citizen' }
			]
		});
		a.init();
		expect(a.chosen).toBe(false);
		expect(a.gameRows.find((r) => r.sim.id === 'star-citizen')?.file).toBe(
			"Pilot's binds · Stand-in"
		);
		a.pickInBay('star-citizen');
		expect(a.sim).toBe('star-citizen');
		expect(a.fileLine).toBe("Pilot's binds · Stand-in");
		expect(a.presets.map((p) => p.label)).toEqual(['Stand-in']);
		// A tile for a game with no preset goes to its file drop.
		a.openBay();
		a.pickInBay('dcs');
		expect(a.chosen).toBe(false);
	});
});
