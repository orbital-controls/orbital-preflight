import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clashingActions } from '../../bindings.ts';
import { initialFlight, act } from '../../flight.ts';
import type { Bind, BindingMap, ParsedBinds } from '../../types.ts';
import { KNOWN } from '../elite/actions.ts';
import { CATALOGUE } from './actions.ts';
import { decodeBind, decodeRebind, encodeBind, refuse, usbIds } from './inputs.ts';
import {
	parseStarCitizenLayout,
	starCitizen,
	starCitizenFileName,
	writeStarCitizenLayout
} from './index.ts';

const demo = readFileSync('tests/fixtures/star-citizen.xml', 'utf8');
const EMPTY =
	'<ActionMaps version="1" optionsVersion="2" rebindVersion="2" profileName="Empty">\n <modifiers />\n</ActionMaps>\n';

const key = (code: string, ...mods: string[]): Bind => ({
	input: { kind: 'key', code },
	...(mods.length && { modifiers: mods.map((c) => ({ kind: 'key', code: c }) as const) })
});

function edit(parsed: ParsedBinds, id: string, slot: 0 | 1, bind: Bind | null): BindingMap {
	const next = { ...parsed.bindings, [id]: [...parsed.bindings[id]] as [Bind | null, Bind | null] };
	next[id][slot] = bind;
	return next;
}

describe('Star Citizen inputs', () => {
	it('reads keys, modifiers either side, mouse buttons, sticks and the gamepad', () => {
		expect(decodeBind('kb1', 'lalt+n')).toEqual(key('KeyN', 'AltLeft'));
		expect(decodeBind('kb1', 'f6+lalt')).toEqual(key('F6', 'AltLeft'));
		expect(decodeBind('kb1', 'np_add')).toEqual(key('NumpadAdd'));
		expect(decodeBind('kb1', 'K')).toEqual(key('KeyK'));
		expect(decodeBind('kb1', 'mouse2')).toEqual({ input: { kind: 'mouse', button: 2 } });
		expect(decodeBind('kb1', 'mwheel_up')).toEqual({ input: { kind: 'wheel', dir: 'up' } });
		expect(decodeBind('js2', 'rotz')).toEqual({
			input: { kind: 'axis', deviceId: 'js2', axis: 'RZ' }
		});
		expect(decodeBind('js1', 'hat1_left')).toEqual({
			input: { kind: 'hat', deviceId: 'js1', hat: 1, dir: 'left' }
		});
		expect(decodeBind('gp1', 'shoulderl+a')).toEqual({
			input: { kind: 'pad', deviceId: 'gp1', control: 'FaceDown' },
			modifiers: [{ kind: 'pad', deviceId: 'gp1', control: 'LBumper' }]
		});
		expect(decodeBind('gp1', 'shoulderl+shoulderr')?.input).toEqual({
			kind: 'pad',
			deviceId: 'gp1',
			control: 'RBumper'
		});
		expect(decodeBind('mo1', 'maxis_x')).toEqual({
			input: { kind: 'raw', device: 'mo1', key: 'maxis_x' }
		});
		expect(decodeBind('js1', ' ')).toBeNull();
	});

	it('writes what it reads, modifiers first', () => {
		for (const [device, text] of [
			['kb1', 'lalt+n'],
			['kb1', 'mouse1'],
			['kb1', 'mwheel_down'],
			['kb1', 'np_period'],
			['js1', 'button12'],
			['js2', 'slider1'],
			['js1', 'hat1_up'],
			['gp1', 'shoulderl+thumbr'],
			['gp1', 'thumbl_up'],
			['mo1', 'maxis_y']
		] as const) {
			expect(encodeBind(decodeBind(device, text)!)).toBe(text);
		}
		expect(encodeBind(decodeBind('kb1', 'f6+lalt')!)).toBe('lalt+f6');
	});

	it('splits a rebind into its device and bind', () => {
		expect(decodeRebind('js2_button5')).toEqual({
			device: 'js2',
			bind: { input: { kind: 'button', deviceId: 'js2', button: 5 } }
		});
		expect(decodeRebind('kb1_ ')).toEqual({ device: 'kb1', bind: null });
		expect(decodeRebind('nonsense')).toBeNull();
	});

	it('reads USB ids from a DirectInput PIDVID guid', () => {
		expect(usbIds(' VKB-Sim Gladiator NXT R  {0200231D-0000-0000-0000-504944564944}')).toEqual({
			vendor: '231d',
			product: '0200'
		});
		expect(usbIds('Keyboard  {6F1D2B61-D5A0-11CF-BFC7-444553540000}')).toBeNull();
	});

	it('refuses what a layout can’t hold', () => {
		const js = (button: number): Bind => ({ input: { kind: 'button', deviceId: 'js1', button } });
		expect(refuse(key('KeyN', 'AltLeft'), null)).toBeNull();
		expect(refuse(key('KeyN', 'KeyQ'), null)).toMatch(/Shift, Ctrl or Alt/);
		expect(
			refuse({ ...js(1), modifiers: [{ kind: 'button', deviceId: 'js1', button: 2 }] }, null)
		).toMatch(/joystick modifiers/);
		expect(refuse(key('KeyN'), key('KeyM'))).toMatch(/one bind per device/);
		expect(refuse({ input: { kind: 'mouse', button: 0 } }, key('KeyM'))).toMatch(
			/one bind per device/
		);
		expect(refuse(js(1), key('KeyM'))).toBeNull();
		expect(refuse(js(1), { input: { kind: 'button', deviceId: 'js2', button: 1 } })).toBeNull();
		expect(
			starCitizen.cannotBind!({ kind: 'axis', deviceId: 'js1', axis: 'X', half: 'pos' })
		).toMatch(/whole axis/);
	});
});

describe('Star Citizen catalogue', () => {
	it('files every action under a mode, with ids unique across maps', () => {
		const ids = CATALOGUE.map((e) => e.action.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain('spaceship_movement.v_yaw');
		expect(ids).toContain('vehicle_driver.v_yaw');
	});

	it('uses only effects the mock flight knows', () => {
		const known = new Set(
			[...KNOWN.values()].flatMap((k) => (k.effect ? k.effect.split('|') : []))
		);
		for (const { action } of CATALOGUE) {
			for (const effect of action.effect?.split('|') ?? []) {
				expect(known, `${action.id} → ${effect}`).toContain(effect);
			}
		}
	});

	it('has an action for every effect the 3D scenes drive by', () => {
		const effects = new Set(CATALOGUE.flatMap((e) => e.action.effect?.split('|') ?? []));
		for (const e of [
			'thrUp',
			'yawL',
			'rollR',
			'boost',
			'gear',
			'fire',
			'hp',
			'drvFwd',
			'steerL',
			'walkF',
			'jump',
			'primary'
		]) {
			expect(effects).toContain(e);
		}
		const roles = new Set(CATALOGUE.map((e) => e.action.analog).filter(Boolean));
		expect([...roles].sort()).toEqual(
			[
				'drive',
				'lookX',
				'lookY',
				'moveX',
				'moveY',
				'pitch',
				'roll',
				'steer',
				'throttle',
				'yaw'
			].sort()
		);
	});

	it('makes no clashes out of the game’s own defaults', () => {
		const parsed = parseStarCitizenLayout(EMPTY);
		for (const mode of ['ship', 'srv', 'foot'] as const) {
			expect(clashingActions(parsed.actions, parsed.bindings, mode).size, mode).toBe(0);
		}
	});

	it('takes an axis only on actions with no button default', () => {
		const byId = new Map(CATALOGUE.map((e) => [e.action.id, e.action]));
		expect(byId.get('spaceship_movement.v_pitch')?.axis).toBe(true);
		expect(byId.get('spaceship_movement.v_strafe_up')?.axis).toBeUndefined();
		expect(byId.get('spaceship_movement.v_strafe_forward')?.axis).toBeUndefined();
	});
});

describe('parseStarCitizenLayout', () => {
	it('reads an empty layout as the game’s defaults', () => {
		const { bindings, presetName, devices } = parseStarCitizenLayout(EMPTY);
		expect(presetName).toBe('Empty');
		expect(bindings['spaceship_movement.v_strafe_forward']).toEqual([key('KeyW'), null]);
		expect(bindings['spaceship_general.v_flightready']).toEqual([key('KeyR', 'AltRight'), null]);
		// An axis action shows its controller default first.
		expect(bindings['spaceship_movement.v_pitch'][0]).toEqual({
			input: { kind: 'axis', deviceId: 'js1', axis: 'Y' }
		});
		// Keyboard first, then a controller.
		expect(bindings['spaceship_movement.v_afterburner']).toEqual([
			key('ShiftLeft'),
			{ input: { kind: 'button', deviceId: 'js1', button: 8 } }
		]);
		expect(devices.map((d) => d.id)).toEqual(['js1', 'gp1']);
	});

	it('lays the layout over the defaults and names its controllers', () => {
		const { bindings, devices } = parseStarCitizenLayout(demo);
		expect(devices.slice(0, 2)).toEqual([
			{ id: 'js1', name: 'VKB-Sim Gladiator NXT R', vendor: '231d', product: '0200' },
			{ id: 'js2', name: 'Thrustmaster TWCS Throttle', vendor: '044f', product: 'b687' }
		]);
		expect(bindings['spaceship_movement.v_strafe_longitudinal'][0]).toEqual({
			input: { kind: 'axis', deviceId: 'js2', axis: 'Z' }
		});
		expect(bindings['spaceship_movement.v_toggle_landing_system']).toEqual([
			key('KeyK'),
			{ input: { kind: 'button', deviceId: 'js1', button: 12 } }
		]);
		// `kb1_ ` clears the J default.
		expect(bindings['spaceship_defensive.v_weapon_countermeasure_noise_launch']).toEqual([
			{ input: { kind: 'button', deviceId: 'js1', button: 5 } },
			null
		]);
		expect(bindings['player.toggle_flashlight'][0]).toEqual({
			input: { kind: 'mouse', button: 3 }
		});
	});

	it('finds the clash the fixture holds on purpose', () => {
		const { actions, bindings } = parseStarCitizenLayout(demo);
		expect([...clashingActions(actions, bindings, 'ship')].sort()).toEqual([
			'spaceship_movement.v_toggle_landing_system',
			'spaceship_movement.v_vtol_toggle'
		]);
	});

	it('says what to load instead of defaultProfile.xml, and refuses other XML', () => {
		expect(() => parseStarCitizenLayout('<profile version="1"></profile>')).toThrow(
			/Export a layout/
		);
		expect(() => parseStarCitizenLayout('<Root PresetName="x"></Root>')).toThrow(
			/Star Citizen layout/
		);
	});
});

describe('writeStarCitizenLayout', () => {
	it('writes an unchanged layout back byte for byte, but for the name', () => {
		const parsed = parseStarCitizenLayout(demo);
		expect(writeStarCitizenLayout(parsed, parsed.bindings, 'Demo HOTAS')).toBe(demo);
		const renamed = writeStarCitizenLayout(parsed, parsed.bindings, 'Mine 2');
		expect(renamed).toContain('profileName="Mine 2"');
		expect(renamed).toContain('<CustomisationUIHeader label="Mine 2"');
	});

	it('replaces a device’s rebind in place', () => {
		const parsed = parseStarCitizenLayout(demo);
		const out = writeStarCitizenLayout(
			parsed,
			edit(parsed, 'spaceship_movement.v_toggle_landing_system', 0, key('KeyG', 'ShiftLeft')),
			'Demo HOTAS'
		);
		expect(out).toBe(demo.replace('kb1_k"', 'kb1_lshift+g"'));
	});

	it('adds an action, and a map, for a default the layout didn’t touch', () => {
		const parsed = parseStarCitizenLayout(demo);
		const out = writeStarCitizenLayout(
			parsed,
			edit(parsed, 'spaceship_quantum.v_toggle_qdrive_engagement', 0, key('KeyB')),
			'Demo HOTAS'
		);
		expect(out).toContain(
			' <actionmap name="spaceship_quantum">\n  <action name="v_toggle_qdrive_engagement">\n   <rebind input="kb1_b"/>\n  </action>\n </actionmap>\n</ActionMaps>'
		);
		const again = parseStarCitizenLayout(out);
		expect(again.bindings['spaceship_quantum.v_toggle_qdrive_engagement'][0]).toEqual(key('KeyB'));
	});

	it('clears a default with an empty rebind, and clears the old device when a bind moves', () => {
		const parsed = parseStarCitizenLayout(EMPTY);
		// W → nothing: `kb1_ `.
		let out = writeStarCitizenLayout(
			parsed,
			edit(parsed, 'spaceship_movement.v_strafe_forward', 0, null),
			'Empty'
		);
		expect(out).toContain('<rebind input="kb1_ "/>');
		expect(parseStarCitizenLayout(out).bindings['spaceship_movement.v_strafe_forward']).toEqual([
			null,
			null
		]);

		// Fire on Mouse 1 (the default's mouse device) → F: the mouse default is cleared too.
		const fire = 'player.attack1';
		expect(parsed.bindings[fire][0]).toEqual({ input: { kind: 'mouse', button: 0 } });
		out = writeStarCitizenLayout(parsed, edit(parsed, fire, 0, key('KeyF')), 'Empty');
		expect(out).toContain('<rebind input="kb1_f"/>');
		expect(out).toContain('<rebind input="mo1_ "/>');
		expect(parseStarCitizenLayout(out).bindings[fire][0]).toEqual(key('KeyF'));
	});

	it('gives a new controller the next joystick instance and an options line', () => {
		const parsed = parseStarCitizenLayout(demo);
		const bind: Bind = { input: { kind: 'button', deviceId: 'js:3344412f', button: 3 } };
		const out = writeStarCitizenLayout(
			parsed,
			edit(parsed, 'spaceship_movement.v_autoland', 1, bind),
			'Demo HOTAS'
		);
		expect(out).toContain('<rebind input="js3_button3"/>');
		expect(out).toContain('<joystick instance="3"/>');
		expect(out).toContain(
			'<options type="joystick" instance="3" Product="Joystick  {412F3344-0000-0000-0000-504944564944}"/>'
		);
		const again = parseStarCitizenLayout(out);
		expect(again.devices.find((d) => d.id === 'js3')).toMatchObject({
			vendor: '3344',
			product: '412f'
		});
		expect(again.bindings['spaceship_movement.v_autoland'][1]).toEqual({
			input: { kind: 'button', deviceId: 'js3', button: 3 }
		});
	});

	it('keeps CRLF line endings', () => {
		const crlf = demo.replace(/\n/g, '\r\n');
		const parsed = parseStarCitizenLayout(crlf);
		const out = writeStarCitizenLayout(
			parsed,
			edit(parsed, 'player.jump', 0, key('KeyJ')),
			'Demo HOTAS'
		);
		expect(out.replace(/\r\n/g, '')).not.toContain('\n');
	});

	it('names the file as the game does', () => {
		expect(starCitizenFileName(parseStarCitizenLayout(demo), 'My binds')).toBe(
			'layout_My_binds_exported.xml'
		);
	});
});

describe('Star Citizen defaults', () => {
	it('ships the game’s defaults as a layout that changes nothing', () => {
		const parsed = parseStarCitizenLayout(starCitizen.defaults!.source);
		expect(starCitizen.defaults!.label).toMatch(/^Star Citizen \d+\.\d+/);
		expect(parsed.bindings).toEqual(parseStarCitizenLayout(EMPTY).bindings);
	});
});

describe('Star Citizen words', () => {
	it('names what the mock flight says in Star Citizen’s terms', () => {
		const s = act(initialFlight(), 'fa', 'Decoupled');
		expect(starCitizen.words?.text?.[s.msg]).toBe('Decoupled');
		expect(starCitizen.words?.modes?.srv).toBe('Vehicle');
	});
});
