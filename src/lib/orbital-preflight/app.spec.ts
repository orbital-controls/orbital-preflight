import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OrbitalPreflight } from './app.svelte.ts';
import { resolveConfig } from './config.ts';
import { HOME_SYSTEM, plotRoute, SYSTEMS } from './scene/galaxy-map.ts';

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
		app.setMode('foot');
		app.onInput({ input: { kind: 'key', code: 'KeyB' }, pressed: true });
		expect(app.lastActs).toEqual(['HumanoidEmoteWheelButton']);
		expect(app.flight.msg).toBe('Emote wheel would open');
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
	describe('the maps', () => {
		const bind = (id: string, key: string, mod?: string) =>
			`\t<${id}>\n\t\t<Primary Device="Keyboard" Key="${key}"${mod ? '>\n\t\t\t<Modifier Device="Keyboard" Key="' + mod + '" />\n\t\t</Primary>' : ' />'}\n\t\t<Secondary Device="{NoDevice}" Key="" />\n\t</${id}>\n`;
		const file = [
			'<?xml version="1.0" encoding="UTF-8" ?>\n<Root PresetName="Map" MajorVersion="4" MinorVersion="0">\n',
			bind('SystemMapOpen', 'Key_M'),
			bind('GalaxyMapOpen', 'Key_M', 'Key_LeftShift'),
			bind('SystemMapOpen_Humanoid', 'Key_M'),
			bind('TargetNextRouteSystem', 'Key_K'),
			bind('PitchUpButton', 'Key_W'),
			bind('CamTranslateForward', 'Key_W'),
			bind('CamYawRight', 'Key_E'),
			bind('UI_Right', 'Key_D'),
			bind('UI_Select', 'Key_Space'),
			bind('UI_Back', 'Key_Backspace'),
			bind('HumanoidForwardButton', 'Key_W'),
			'</Root>\n'
		].join('');
		const key = (code: string) => ({ kind: 'key' as const, code });
		const press = (app: OrbitalPreflight, code: string) =>
			app.onInput({ input: key(code), pressed: true });
		function loadedMaps() {
			const app = new OrbitalPreflight(config, {});
			app.loadText(file, { kind: 'upload', fileName: 'map.binds' });
			return app;
		}
		function openSystem() {
			const app = loadedMaps();
			press(app, 'KeyM');
			return app;
		}
		const system = (app: OrbitalPreflight) => {
			if (app.map?.kind !== 'system') throw new Error('expected the system map');
			return app.map.state;
		};
		const galaxy = (app: OrbitalPreflight) => {
			if (app.map?.kind !== 'galaxy') throw new Error('expected the galaxy map');
			return app.map.state;
		};

		it('System map opens the system map, shows its binds in the panel, and closes it again', () => {
			const app = openSystem();
			expect(app.map?.kind).toBe('system');
			expect(app.lastActs).toEqual(['SystemMapOpen']);
			expect(app.flight.msgT).toBe(0);
			expect(app.cat).toBe('Galaxy map');
			press(app, 'KeyM');
			expect(app.map).toBeNull();
			expect(app.cat).toBe('All');
		});

		it('Shift+M opens the galaxy map instead, and only Galaxy map or Menu back close it', () => {
			const app = loadedMaps();
			app.hub.press(key('ShiftLeft'));
			press(app, 'KeyM');
			app.hub.release(key('ShiftLeft'));
			expect(app.lastActs).toEqual(['GalaxyMapOpen']);
			expect(app.map?.kind).toBe('galaxy');
			// M alone is the system map's: it does nothing on the galaxy map.
			press(app, 'KeyM');
			expect(app.map?.kind).toBe('galaxy');
			expect(app.lastActs).toEqual([]);
			press(app, 'Backspace');
			expect(app.map).toBeNull();
		});

		it('while open, only the map binds fire: W pans the map, not the ship', () => {
			const app = openSystem();
			const before = system(app).focus;
			press(app, 'KeyW');
			expect(app.lastActs).toEqual(['CamTranslateForward']);
			expect(system(app).focus).not.toEqual(before);
		});

		it('a held key keeps the camera turning each tick, frozen while listening', () => {
			const app = openSystem();
			app.hub.press(key('KeyE'));
			const yaw = system(app).yaw;
			app.step();
			expect(system(app).yaw).toBeGreaterThan(yaw);
			app.startCapture({ actionId: 'UI_Select', slot: 1 });
			const frozen = system(app).yaw;
			app.step();
			expect(system(app).yaw).toBe(frozen);
		});

		it('on the system map, Menu right and select target the next body', () => {
			const app = openSystem();
			const sel = system(app).sel;
			press(app, 'KeyD');
			press(app, 'Space');
			expect(system(app).target).toBe(sel + 1);
			expect(app.flight.msg).toMatch(/targeted$/);
		});

		it('a route plotted on the galaxy map is what Target next system in route names', () => {
			const app = loadedMaps();
			press(app, 'KeyK');
			expect(app.flight.msg).toBe('Next system in route targeted');
			app.openMap('galaxy');
			const far = SYSTEMS.findIndex((s, i) => i > 0 && plotRoute(HOME_SYSTEM, i).length > 3);
			app.map = { kind: 'galaxy', state: { ...galaxy(app), focus: SYSTEMS[far].at } };
			press(app, 'Space');
			press(app, 'Space');
			expect(app.route).toEqual(plotRoute(HOME_SYSTEM, far));
			press(app, 'Backspace');
			press(app, 'KeyK');
			expect(app.flight.msg).toBe(`Next in route · ${SYSTEMS[app.route[1]].name}`);
			// The route is still there next time.
			app.openMap('galaxy');
			expect(galaxy(app).route).toEqual(app.route);
		});

		it('on foot, the mode’s own System map opens it, and the ship’s map binds drive it', () => {
			const app = loadedMaps();
			app.setMode('foot');
			press(app, 'KeyM');
			expect(app.lastActs).toEqual(['SystemMapOpen_Humanoid']);
			const before = system(app).focus;
			press(app, 'KeyW');
			expect(app.lastActs).toEqual(['CamTranslateForward']);
			expect(system(app).focus).not.toEqual(before);
			app.setMode('ship');
			expect(app.map).toBeNull();
		});
	});
});
