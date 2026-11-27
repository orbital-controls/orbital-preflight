import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OrbitalPreflight } from './app.svelte.ts';
import { resolveConfig } from './config.ts';
import { CHARGE_TICKS, HOME, plotRoute, SYSTEMS } from './galaxy.ts';

const config = resolveConfig({ title: 't', description: 'd', siteName: 's', homeUrl: 'h' });
const demo = readFileSync('tests/fixtures/hotas.binds', 'utf8');

function loaded() {
	const app = new OrbitalPreflight(config, {});
	app.loadText(demo, { kind: 'upload', fileName: 'hotas.binds' });
	return app;
}

describe('OrbitalPreflight', () => {
	it('a panel says it would open', () => {
		const app = loaded();
		app.onInput({ input: { kind: 'key', code: 'KeyM' }, pressed: true });
		expect(app.lastActs).toEqual(['SystemMapOpen']);
		expect(app.flight.msg).toBe('System map would open');
	});

	describe('the galaxy map', () => {
		const key = (code: string) => ({ kind: 'key' as const, code });
		function onMap() {
			const app = loaded();
			app.hub.press(key('ShiftLeft'));
			app.onInput({ input: key('KeyM'), pressed: true });
			app.hub.release(key('ShiftLeft'));
			return app;
		}
		const press = (app: OrbitalPreflight, code: string) =>
			app.onInput({ input: key(code), pressed: true });

		it('opens, and only its own binds fire while it is open', () => {
			const app = onMap();
			expect(app.galaxy.open).toBe(true);
			press(app, 'KeyW');
			// W pitches the ship and steps menus too, but on the map it only moves the map.
			expect(app.lastActs).toEqual(['CamTranslateForward']);
			press(app, 'Backspace');
			expect(app.galaxy.open).toBe(false);
			press(app, 'KeyW');
			expect(app.lastActs).not.toContain('CamTranslateForward');
		});

		it('moves while a map bind is held, and goes home', () => {
			const app = onMap();
			app.hub.press(key('KeyW'));
			for (let i = 0; i < 10; i++) app.step();
			app.hub.release(key('KeyW'));
			expect(app.galaxy.cam.focus).not.toEqual([0, 0, 0]);
			press(app, 'Home');
			expect(app.galaxy.cam.focus).toEqual([0, 0, 0]);
		});

		it('plots a route, and the drive follows it', () => {
			const app = onMap();
			const far = SYSTEMS.find((s) => (plotRoute(HOME, s.id)?.length ?? 0) >= 2)!;
			app.selectSystem(far.id);
			press(app, 'Space');
			expect(app.galaxy.route.at(-1)).toBe(far.id);
			expect(app.flight.msg).toMatch(/^Route plotted/);
			const first = app.galaxy.route[0];
			press(app, 'Backspace');
			press(app, 'KeyJ');
			expect(app.flight.msg).toMatch(/^Charging FSD · jumping to/);
			for (let i = 0; i < CHARGE_TICKS; i++) app.step();
			expect(app.galaxy.location).toBe(first);
			expect(app.galaxy.target).toBe(app.galaxy.route[0]);
		});

		it('has no route to jump along until one is plotted', () => {
			const app = loaded();
			press(app, 'KeyJ');
			expect(app.flight.msg).toBe('FSD charging · mass locked');
		});
	});

	it('an action with no effect of its own only shows in the toast', () => {
		const app = loaded();
		app.onInput({ input: { kind: 'key', code: 'KeyY' }, pressed: true });
		expect(app.lastActs).toEqual(['CycleNextSubsystem']);
		expect(app.flight.msgT).toBe(0);
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

	it('K toggles the camera, the viewport button does the same, and a reload keeps it', () => {
		const app = loaded();
		app.onInput({ input: { kind: 'key', code: 'KeyK' }, pressed: true });
		expect(app.flight.cam).toBe('cockpit');
		expect(app.lastActs).toEqual(['OrbitalPreflightToggleCamera']);
		app.toggleCamera();
		expect(app.flight.cam).toBe('chase');
		app.toggleCamera();
		app.loadText(demo, { kind: 'upload', fileName: 'again.binds' });
		expect(app.flight.cam).toBe('cockpit');
	});

	it('bound stick axes reach the scene, and freeze while listening for a rebind', () => {
		const app = loaded();
		const pitch = app.store.bindings.PitchAxisRaw[0]!.input;
		if (pitch.kind !== 'axis') throw new Error('expected an axis');
		app.hub.axes.set(`${pitch.deviceId}:${pitch.axis}`, 0.8);
		expect(app.analog.has.pitch).toBe(true);
		expect(app.analog.pitch).toBeGreaterThan(0.7);
		app.startCapture({ actionId: 'SetSpeed50', slot: 0 });
		expect(app.analog.pitch).toBe(0);
		app.cancelCapture();
		expect(app.analog.pitch).toBeGreaterThan(0.7);
	});

	it('K toggles the same camera in SRV mode, and the steering axis reaches the scene', () => {
		const app = loaded();
		app.setMode('srv');
		app.onInput({ input: { kind: 'key', code: 'KeyK' }, pressed: true });
		expect(app.flight.cam).toBe('cockpit');
		expect(app.lastActs).toEqual(['OrbitalPreflightToggleCameraSrv']);
		const steer = app.store.bindings.SteeringAxis[0]!.input;
		if (steer.kind !== 'axis') throw new Error('expected an axis');
		app.hub.axes.set(`${steer.deviceId}:${steer.axis}`, -0.9);
		expect(app.analog.has.steer).toBe(true);
		expect(app.analog.steer).toBeLessThan(-0.8);
		expect(app.analog.has.pitch).toBe(false);
		app.startCapture({ actionId: 'SteerLeftButton', slot: 0 });
		expect(app.analog.steer).toBe(0);
	});

	it('the camera button is ignored while listening for a rebind or with a drawer open', () => {
		const app = loaded();
		app.startCapture({ actionId: 'SetSpeed50', slot: 0 });
		app.toggleCamera();
		expect(app.flight.cam).toBe('chase');
		app.cancelCapture();
		app.openDrawer('load');
		app.toggleCamera();
		expect(app.flight.cam).toBe('chase');
		app.closeDrawer();
		app.toggleCamera();
		expect(app.flight.cam).toBe('cockpit');
	});
});
