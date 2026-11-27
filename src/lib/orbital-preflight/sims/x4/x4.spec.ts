import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clashingActions } from '../../bindings.ts';
import { act, initialFlight } from '../../flight.ts';
import type { Bind, BindingMap, ParsedBinds } from '../../types.ts';
import { KNOWN } from '../elite/actions.ts';
import { CATALOGUE } from './actions.ts';
import { CONTROLS } from './controls.ts';
import { cannotBind, decodeEntry, encodeBind, refuse } from './inputs.ts';
import { parseX4Inputmap, writeX4Inputmap, x4, x4FileName } from './index.ts';

const pilot = readFileSync('tests/fixtures/x4.xml', 'utf8');
const shipped = readFileSync('data/x4/inputmap.xml', 'utf8');
const wasd = readFileSync('data/x4/inputmap_defaults_keyboard_mouse_wasd.xml', 'utf8');

const key = (code: string, ...mods: string[]): Bind => ({
	input: { kind: 'key', code },
	...(mods.length && { modifiers: mods.map((c) => ({ kind: 'key', code: c }) as const) })
});
const entry = (source: string, code: string, sgn = '') => ({ source, code, sgn });
const NONE = new Set<number>();
const PAD1 = new Set([1]);

function edit(parsed: ParsedBinds, id: string, slot: 0 | 1, bind: Bind | null): BindingMap {
	const next = { ...parsed.bindings, [id]: [...parsed.bindings[id]] as [Bind | null, Bind | null] };
	next[id][slot] = bind;
	return next;
}

/** The lines `after` has that `before` hasn't, and the other way round. */
function diff(before: string, after: string) {
	const a = before.split(/\r?\n/);
	const b = after.split(/\r?\n/);
	return { added: b.filter((l) => !a.includes(l)), gone: a.filter((l) => !b.includes(l)) };
}

describe('X4 inputs', () => {
	it('reads keys with their modifiers, mouse buttons and the wheel', () => {
		expect(decodeEntry(entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_A_SHIFT'), NONE)).toEqual(
			key('KeyA', 'ShiftLeft')
		);
		expect(
			decodeEntry(entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_LEFT_SHIFT_CONTROL'), NONE)
		).toEqual(key('ArrowLeft', 'ShiftLeft', 'ControlLeft'));
		expect(decodeEntry(entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_PRIOR'), NONE)).toEqual(
			key('PageUp')
		);
		expect(decodeEntry(entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_LMENU'), NONE)).toEqual(
			key('AltLeft')
		);
		expect(decodeEntry(entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_NUMPAD5'), NONE)).toEqual(
			key('Numpad5')
		);
		expect(
			decodeEntry(entry('INPUT_SOURCE_MOUSEBUTTONS', 'INPUT_MOUSEBUTTON_MIDDLE_SHIFT'), NONE)
		).toEqual({
			input: { kind: 'mouse', button: 1 },
			modifiers: [{ kind: 'key', code: 'ShiftLeft' }]
		});
		expect(
			decodeEntry(entry('INPUT_SOURCE_MOUSEAXES', 'INPUT_MOUSEAXIS_Z_SHIFT', '-1'), NONE)
		).toEqual({
			input: { kind: 'wheel', dir: 'down' },
			modifiers: [{ kind: 'key', code: 'ShiftLeft' }]
		});
		expect(decodeEntry(entry('INPUT_SOURCE_MOUSEAXES', 'INPUT_MOUSEAXIS_X'), NONE)).toEqual({
			input: { kind: 'raw', device: 'INPUT_SOURCE_MOUSEAXES', key: 'INPUT_MOUSEAXIS_X' }
		});
	});

	it('reads a gamepad slot by its controls and a stick slot by number', () => {
		const a = entry('INPUT_SOURCE_JOYBUTTONS', 'INPUT_XBUTTON_A');
		expect(decodeEntry(a, PAD1).input).toEqual({
			kind: 'pad',
			deviceId: 'joy1',
			control: 'FaceDown'
		});
		expect(decodeEntry(a, NONE).input).toEqual({ kind: 'button', deviceId: 'joy1', button: 1 });
		expect(
			decodeEntry(entry('INPUT_SOURCE_JOYBUTTONS_3', 'INPUT_XBUTTON_DPAD_LEFT'), NONE).input
		).toEqual({ kind: 'hat', deviceId: 'joy3', hat: 1, dir: 'left' });
		expect(decodeEntry(entry('INPUT_SOURCE_JOYBUTTONS_2', 'INPUT_XBUTTON_17'), NONE).input).toEqual(
			{ kind: 'button', deviceId: 'joy2', button: 17 }
		);
		expect(
			decodeEntry(entry('INPUT_SOURCE_JOYAXES_2', 'INPUT_JOYAXIS_SLIDER1', '1'), NONE).input
		).toEqual({ kind: 'axis', deviceId: 'joy2', axis: 'U', half: 'pos' });
		expect(decodeEntry(entry('INPUT_SOURCE_JOYAXES', 'INPUT_JOYAXIS_RX'), PAD1).input).toEqual({
			kind: 'pad',
			deviceId: 'joy1',
			control: 'RStickX'
		});
		expect(
			decodeEntry(entry('INPUT_SOURCE_JOYAXES', 'INPUT_JOYAXIS_RZ', '-1'), PAD1).input
		).toEqual({ kind: 'pad', deviceId: 'joy1', control: 'RTrigger' });
	});

	it('writes what it reads', () => {
		const cases = [
			entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_A_SHIFT'),
			entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_RETURN_CONTROL'),
			entry('INPUT_SOURCE_KEYBOARD', 'INPUT_KEYCODE_LEFT_SHIFT_CONTROL'),
			entry('INPUT_SOURCE_MOUSEBUTTONS', 'INPUT_MOUSEBUTTON_SIDE1'),
			entry('INPUT_SOURCE_MOUSEAXES', 'INPUT_MOUSEAXIS_Z', '1'),
			entry('INPUT_SOURCE_MOUSEAXES', 'INPUT_MOUSEAXIS_Y'),
			entry('INPUT_SOURCE_JOYBUTTONS_2', 'INPUT_XBUTTON_BIGBUTTON'),
			entry('INPUT_SOURCE_JOYBUTTONS_2', 'INPUT_XBUTTON_32'),
			entry('INPUT_SOURCE_JOYAXES_4', 'INPUT_JOYAXIS_RY', '-1')
		];
		for (const e of cases) expect(encodeBind(decodeEntry(e, NONE)), e.code).toEqual(e);
		const pad = [
			entry('INPUT_SOURCE_JOYBUTTONS', 'INPUT_XBUTTON_LEFT_SHOULDER'),
			entry('INPUT_SOURCE_JOYBUTTONS', 'INPUT_XBUTTON_DPAD_DOWN'),
			entry('INPUT_SOURCE_JOYAXES', 'INPUT_JOYAXIS_X', '1'),
			entry('INPUT_SOURCE_JOYAXES', 'INPUT_JOYAXIS_RZ', '-1'),
			entry('INPUT_SOURCE_JOYAXES', 'INPUT_JOYAXIS_Z', '1')
		];
		for (const e of pad) expect(encodeBind(decodeEntry(e, PAD1)), e.code).toEqual(e);
		// A trigger on a range is the whole axis.
		const lt = decodeEntry(entry('INPUT_SOURCE_JOYAXES', 'INPUT_JOYAXIS_Z'), PAD1);
		expect(encodeBind(lt, true)).toEqual(entry('INPUT_SOURCE_JOYAXES', 'INPUT_JOYAXIS_Z'));
	});

	it('refuses what an inputmap.xml can’t hold', () => {
		expect(refuse(key('KeyF', 'AltLeft'))).toMatch(/Shift or Ctrl/);
		expect(refuse(key('KeyF', 'ControlRight'))).toBeNull();
		expect(
			refuse({
				input: { kind: 'button', deviceId: 'joy2', button: 3 },
				modifiers: [{ kind: 'button', deviceId: 'joy2', button: 1 }]
			})
		).toMatch(/in game/);
		expect(cannotBind({ kind: 'key', code: 'F20' })).toMatch(/no name/);
		expect(cannotBind({ kind: 'mouse', button: 7 })).toMatch(/five/);
		expect(cannotBind({ kind: 'hat', deviceId: 'joy2', hat: 2, dir: 'up' })).toMatch(/one hat/);
		expect(cannotBind({ kind: 'axis', deviceId: 'joy2', axis: 'X', half: 'neg' })).toBeNull();
	});
});

describe('X4 catalogue', () => {
	it('lists every rebindable row of the game’s Controls screen once', () => {
		const ids = CATALOGUE.map((e) => e.action.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(CATALOGUE.length).toBe(CONTROLS.length);
		const modes = new Set(CATALOGUE.map((e) => e.action.mode));
		expect([...modes].sort()).toEqual(['foot', 'ship']);
		const map = CATALOGUE.find((e) => e.action.id === 'INPUT_ACTION_OPEN_MAP');
		expect(map?.ids).toContain('INPUT_ACTION_ADDON_DETAILMONITOR_CLOSE_MAP');
		expect(map?.action.category).toBe('Menu Access');
	});

	it('names controls the game’s own profiles bind', () => {
		const ids = (source: string) =>
			[...source.matchAll(/id="(INPUT_[A-Z0-9_]+)"/g)].map((m) => m[1]);
		const bound = new Set([...ids(shipped), ...ids(wasd)]);
		const named = CATALOGUE.flatMap((e) => e.ids);
		const missing = named.filter((id) => !bound.has(id));
		// Some rows ship unbound on keyboard and mouse (the diagonals, deployables, chat). The
		// game's contexts.xml names all of them; most must be bound in its own profiles.
		expect(missing.length).toBeLessThan(named.length / 4);
		for (const id of ['INPUT_STATE_BOOST', 'INPUT_RANGE_THROTTLE', 'INPUT_ACTION_OPEN_MAP']) {
			expect(bound).toContain(id);
		}
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

	it('flies, fires and walks the 3D scenes', () => {
		const effects = new Set(CATALOGUE.flatMap((e) => e.action.effect?.split('|') ?? []));
		for (const e of [
			'thrUp',
			'yawL',
			'rollR',
			'boost',
			'fire',
			'tgt',
			'walkF',
			'jump',
			'interact'
		]) {
			expect(effects).toContain(e);
		}
		const roles = new Set(CATALOGUE.map((e) => e.action.analog).filter(Boolean));
		expect([...roles].sort()).toEqual(
			['lookX', 'lookY', 'moveX', 'moveY', 'pitch', 'roll', 'throttle', 'yaw'].sort()
		);
	});

	it('says which Walk is the axis', () => {
		const walks = CATALOGUE.filter((e) => e.action.mode === 'foot' && /^Walk/.test(e.action.name));
		expect(walks.map((e) => e.action.name).sort()).toEqual(['Walk', 'Walk (axis)']);
	});
});

describe('X4 inputmap.xml', () => {
	it('reads the shipped Keyboard and Mouse profile', () => {
		const parsed = parseX4Inputmap(shipped);
		const b = parsed.bindings;
		expect(b.INPUT_STATE_BOOST[0]).toEqual(key('Tab'));
		expect(b.INPUT_STATE_FIRE_PRIMARY_WEAPON[0]).toEqual(key('Space'));
		expect(b.INPUT_ACTION_OPEN_MAP[0]).toEqual(key('KeyM'));
		expect(b.INPUT_ACTION_TARGET_NEXT_ENEMY[0]).toEqual(key('KeyE', 'ShiftLeft'));
		expect(b.INPUT_ACTION_TOGGLE_TRAVEL_MODE[0]).toEqual(key('Digit1', 'ShiftLeft'));
		// The shipped profile pairs it with an Xbox pad in slot 1.
		expect(parsed.devices).toEqual([{ id: 'joy1', name: 'Gamepad', gamepad: true }]);
		expect(b.INPUT_RANGE_THROTTLE[0]?.input).toEqual({
			kind: 'pad',
			deviceId: 'joy1',
			control: 'LTrigger'
		});
		expect(parsed.presetName).toBe('');
	});

	it('skips binds a later version removed', () => {
		// 131 took T off Target closest hostile and gave it Shift+E.
		const parsed = parseX4Inputmap(shipped);
		const all = parsed.bindings.INPUT_ACTION_TARGET_NEXT_ENEMY.filter(Boolean);
		expect(all).not.toContainEqual(key('KeyT'));
	});

	it('makes no clashes out of the game’s own profiles', () => {
		for (const source of [shipped, wasd]) {
			const parsed = parseX4Inputmap(source);
			for (const mode of ['ship', 'foot'] as const) {
				const clashes = [...clashingActions(parsed.actions, parsed.bindings, mode)];
				expect(clashes, mode).toEqual([]);
			}
		}
	});

	it('reads a pilot’s file: keyboard first, a gamepad and a stick by slot', () => {
		const parsed = parseX4Inputmap(pilot);
		const b = parsed.bindings;
		expect(parsed.devices).toEqual([
			{ id: 'joy1', name: 'Gamepad', gamepad: true },
			{ id: 'joy2', name: 'Joystick 2' }
		]);
		expect(b.INPUT_STATE_BOOST).toEqual([
			key('Tab'),
			{ input: { kind: 'button', deviceId: 'joy2', button: 3 } }
		]);
		// Three inputs: the slots show keyboard and mouse first.
		expect(b.INPUT_STATE_FIRE_PRIMARY_WEAPON).toEqual([
			{ input: { kind: 'mouse', button: 0 } },
			{ input: { kind: 'pad', deviceId: 'joy1', control: 'RTrigger' } }
		]);
		// A range shows a controller first.
		expect(b.INPUT_RANGE_THROTTLE[0]?.input).toEqual({
			kind: 'pad',
			deviceId: 'joy1',
			control: 'LTrigger'
		});
		// The radial menu isn't a slot.
		expect(b.INPUT_ACTION_TARGET_NEXT_TARGET).toEqual([key('KeyT'), null]);
		expect(b.INPUT_STATE_CAMERA_ZOOMIN[0]).toEqual({
			input: { kind: 'wheel', dir: 'up' },
			modifiers: [{ kind: 'key', code: 'ShiftLeft' }]
		});
	});

	it('refuses a file that isn’t an inputmap', () => {
		expect(() => parseX4Inputmap('<ActionMaps version="1"/>')).toThrow(/inputmap/);
		expect(() => parseX4Inputmap('not xml <')).toThrow();
	});
});

describe('X4 writer', () => {
	it('leaves the file as it was when nothing changed', () => {
		for (const source of [pilot, shipped]) {
			const parsed = parseX4Inputmap(source);
			expect(writeX4Inputmap(parsed, parsed.bindings, 'Mine')).toBe(source);
		}
	});

	it('swaps one line for a rebind and drops it for a cleared slot', () => {
		const parsed = parseX4Inputmap(pilot);
		let out = writeX4Inputmap(
			parsed,
			edit(parsed, 'INPUT_STATE_BOOST', 0, key('KeyB', 'ShiftLeft')),
			''
		);
		expect(diff(pilot, out)).toEqual({
			added: [
				'  <state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_B_SHIFT"/>'
			],
			gone: [
				'  <state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_TAB"/>'
			]
		});
		expect(parseX4Inputmap(out).bindings.INPUT_STATE_BOOST[0]).toEqual(key('KeyB', 'ShiftLeft'));

		out = writeX4Inputmap(parsed, edit(parsed, 'INPUT_ACTION_STOP', 0, null), '');
		expect(diff(pilot, out).gone).toEqual([
			'  <action id="INPUT_ACTION_STOP" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_BACK"/>'
		]);
		expect(diff(pilot, out).added).toEqual([]);
		expect(parseX4Inputmap(out).bindings.INPUT_ACTION_STOP).toEqual([null, null]);
	});

	it('keeps the radial menu and third inputs, and adds a bind to an empty control', () => {
		const parsed = parseX4Inputmap(pilot);
		let out = writeX4Inputmap(
			parsed,
			edit(parsed, 'INPUT_ACTION_TARGET_NEXT_TARGET', 0, key('KeyY')),
			''
		);
		expect(out).toContain('source="INPUT_SOURCE_COMPASSMENU" code="INPUT_COMPASSMENU_1"');
		out = writeX4Inputmap(
			parsed,
			edit(parsed, 'INPUT_STATE_FIRE_PRIMARY_WEAPON', 0, key('Space')),
			''
		);
		expect(out).toContain('code="INPUT_XBUTTON_A"');
		const lines = out.split('\n');
		const at = lines.findIndex(
			(l) => l.includes('INPUT_KEYCODE_SPACE"') && l.includes('FIRE_PRIMARY')
		);
		expect(lines[at - 1]).toContain('INPUT_STATE_FIRE_PRIMARY_WEAPON');

		out = writeX4Inputmap(parsed, edit(parsed, 'INPUT_STATE_LOOTMAGNET', 1, key('KeyL')), '');
		expect(diff(pilot, out).added).toEqual([
			'  <state id="INPUT_STATE_LOOTMAGNET" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_L"/>'
		]);
		expect(parseX4Inputmap(out).bindings.INPUT_STATE_LOOTMAGNET[0]).toEqual(key('KeyL'));
	});

	it('writes a row to every control it rebinds', () => {
		const parsed = parseX4Inputmap(pilot);
		const out = writeX4Inputmap(parsed, edit(parsed, 'INPUT_ACTION_OPEN_MAP', 0, key('KeyN')), '');
		const { added, gone } = diff(pilot, out);
		expect(added.sort()).toEqual(
			[
				'  <action id="INPUT_ACTION_OPEN_MAP" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_N"/>',
				'  <action id="INPUT_ACTION_ADDON_DETAILMONITOR_CLOSE_MAP" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_N"/>'
			].sort()
		);
		expect(gone).toEqual([
			'  <action id="INPUT_ACTION_OPEN_MAP" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_M"/>',
			'  <action id="INPUT_ACTION_ADDON_DETAILMONITOR_CLOSE_MAP" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_M"/>'
		]);
	});

	it('puts a new controller in the next free slot', () => {
		const parsed = parseX4Inputmap(pilot);
		const bind: Bind = { input: { kind: 'button', deviceId: 'joy:044fb10a', button: 5 } };
		const out = writeX4Inputmap(parsed, edit(parsed, 'INPUT_STATE_BOOST', 1, bind), '');
		expect(out).toContain(
			'<state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_JOYBUTTONS_3" code="INPUT_XBUTTON_LEFT_SHOULDER"/>'
		);
		expect(parseX4Inputmap(out).devices.map((d) => d.id)).toEqual(['joy1', 'joy2', 'joy3']);
	});

	it('writes into the shipped profile in its own style, CRLF and all', () => {
		const parsed = parseX4Inputmap(shipped);
		const out = writeX4Inputmap(parsed, edit(parsed, 'INPUT_STATE_BOOST', 0, key('KeyJ')), '');
		expect(out.replace(/\r\n/g, '')).not.toContain('\n');
		expect(out).toContain(
			'<state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_J" />'
		);
		expect(parseX4Inputmap(out).bindings.INPUT_STATE_BOOST[0]).toEqual(key('KeyJ'));
	});

	it('names the file as the game reads it', () => {
		expect(x4FileName()).toBe('inputmap.xml');
	});
});

describe('X4 adapter', () => {
	it('opens on the shipped profile', () => {
		expect(x4.status).toBe('ready');
		expect(x4.defaults?.label).toMatch(/^X4 \d+\.\d+ defaults$/);
		expect(x4.defaults?.source).toBe(shipped);
	});

	it('says travel mode where the mock flight says supercruise', () => {
		const s = act(initialFlight(), 'sc', 'Toggle Travel Mode');
		expect(x4.words?.text?.[s.msg]).toBe('Travel mode engaged');
	});

	it('fires without hardpoints to deploy', () => {
		expect(act(initialFlight(), 'fire', 'Fire', false).fireT).toBeGreaterThan(0);
		expect(act(initialFlight(), 'fire', 'Fire').msg).toBe('Hardpoints are stowed');
	});
});
