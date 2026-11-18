import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OrbitalPreflight } from './app.svelte.ts';
import { resolveConfig } from './config.ts';

const config = resolveConfig({ title: 't', description: 'd', siteName: 's', homeUrl: 'h' });
const demo = readFileSync('tests/fixtures/hotas.binds', 'utf8');

function loaded() {
	const app = new OrbitalPreflight(config, '', {});
	app.loadText(demo, { kind: 'upload', fileName: 'hotas.binds' });
	return app;
}

describe('OrbitalPreflight', () => {
	it('an action with no effect of its own says it would open, as on the board', () => {
		const app = loaded();
		app.onInput({ input: { kind: 'key', code: 'KeyY' }, pressed: true });
		expect(app.lastActs).toEqual(['CycleNextSubsystem']);
		expect(app.flight.msg).toBe('Next subsystem would open');
	});

	it('refuses an input the export could not write, and says why', () => {
		const app = loaded();
		app.startCapture({ actionId: 'SetSpeed50', slot: 0 });
		app.hub.press({ kind: 'key', code: 'NumLock' });
		expect(app.cap?.cand).toBeNull();
		expect(app.capNotice).toMatch(/no name for that key/);
		app.hub.press({ kind: 'button', deviceId: 'browser-0', button: 3 });
		expect(app.capNotice).toMatch(/USB id/);
		app.hub.press({ kind: 'key', code: 'KeyP' });
		expect(app.cap?.cand).toEqual({ input: { kind: 'key', code: 'KeyP' } });
		expect(app.capNotice).toBeNull();
	});

	it('binding the key already on the other slot of the same action is not a clash', () => {
		const app = loaded();
		app.startCapture({ actionId: 'SetSpeedZero', slot: 1 });
		app.hub.press({ kind: 'key', code: 'KeyX' });
		expect(app.holderOf(app.cap!.target, app.cap!.cand)).toBeNull();
	});
});
