import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clashingActions } from '../../bindings.ts';
import type { BindingMap } from '../../types.ts';
import { parseXml } from '../../xml.ts';
import { classifyMode, prettify } from './actions.ts';
import {
	cleanPresetName,
	elite,
	eliteFileName,
	parseEliteBinds,
	writeEliteBinds
} from './index.ts';
import { decodeInput, encodeInput, keyNameForCode } from './inputs.ts';

const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8');
const FIXTURES = ['hotas.binds', 'keyboard-only.binds'];

/** Splits both strings into lines and returns the lines that differ. */
function changedLines(a: string, b: string): [string, string][] {
	const la = a.split('\n');
	const lb = b.split('\n');
	const out: [string, string][] = [];
	for (let i = 0; i < Math.max(la.length, lb.length); i++) {
		if (la[i] !== lb[i]) out.push([la[i], lb[i]]);
	}
	return out;
}

describe('Elite Dangerous .binds', () => {
	it.each(FIXTURES)(
		'%s: writing unchanged binds under the same name gives the same bytes',
		(name) => {
			const source = fixture(name);
			const parsed = parseEliteBinds(source);
			expect(writeEliteBinds(parsed, parsed.bindings, parsed.presetName)).toBe(source);
		}
	);

	it.each(FIXTURES)('%s: a new name changes only PresetName', (name) => {
		const source = fixture(name);
		const parsed = parseEliteBinds(source);
		const out = writeEliteBinds(parsed, parsed.bindings, 'My New Preset');
		const diff = changedLines(source, out);
		expect(diff).toHaveLength(1);
		expect(diff[0][1]).toContain('PresetName="My New Preset"');
	});

	it.each(FIXTURES)('%s: changing one bind changes only that slot', (name) => {
		const source = fixture(name);
		const parsed = parseEliteBinds(source);
		const bindings: BindingMap = {
			...parsed.bindings,
			SetSpeedZero: [{ input: { kind: 'key', code: 'KeyP' } }, parsed.bindings.SetSpeedZero[1]]
		};
		const out = writeEliteBinds(parsed, bindings, parsed.presetName);
		const diff = changedLines(source, out);
		const was = encodeInput(parsed.bindings.SetSpeedZero[0]?.input ?? null);
		expect(diff).toEqual([
			[
				`\t\t<Primary Device="${was.device}" Key="${was.key}" />`,
				'\t\t<Primary Device="Keyboard" Key="Key_P" />'
			].map((line) => (source.includes('\r\n') ? `${line}\r` : line))
		]);
		expect(parseEliteBinds(out).bindings.SetSpeedZero[0]).toEqual({
			input: { kind: 'key', code: 'KeyP' }
		});
	});

	it('adds and removes modifiers, keeping indentation and line endings', () => {
		const source = fixture('keyboard-only.binds');
		const parsed = parseEliteBinds(source);
		const bindings: BindingMap = {
			...parsed.bindings,
			SetSpeedZero: [
				{ input: { kind: 'key', code: 'KeyX' }, modifiers: [{ kind: 'key', code: 'AltLeft' }] },
				null
			],
			ForwardKey: [{ input: { kind: 'key', code: 'KeyW' } }, null]
		};
		const out = writeEliteBinds(parsed, bindings, parsed.presetName);
		expect(out).toContain(
			'\t\t<Primary Device="Keyboard" Key="Key_X">\r\n\t\t\t<Modifier Device="Keyboard" Key="Key_LeftAlt" />\r\n\t\t</Primary>\r\n'
		);
		expect(out.split('\r\n').every((line) => !line.includes('\n'))).toBe(true);
		const reparsed = parseEliteBinds(out);
		expect(reparsed.bindings.SetSpeedZero).toEqual(bindings.SetSpeedZero);
		expect(reparsed.bindings.ForwardKey).toEqual(bindings.ForwardKey);
		// The rest of the file still parses to the same model.
		for (const id of Object.keys(parsed.bindings)) {
			if (id === 'SetSpeedZero' || id === 'ForwardKey') continue;
			expect(reparsed.bindings[id]).toEqual(parsed.bindings[id]);
		}
	});

	it('clears a slot to {NoDevice}', () => {
		const parsed = parseEliteBinds(fixture('hotas.binds'));
		const out = writeEliteBinds(
			parsed,
			{ ...parsed.bindings, ToggleFlightAssist: [null, null] },
			'x'
		);
		expect(parseEliteBinds(out).bindings.ToggleFlightAssist).toEqual([null, null]);
		expect(out).toContain('<ToggleFlightAssist>\n\t\t<Primary Device="{NoDevice}" Key="" />');
		parseXml(out);
	});

	it('reads modes, axes, modifiers, devices and the preset name', () => {
		const parsed = parseEliteBinds(fixture('hotas.binds'));
		expect(parsed.presetName).toBe('Demo HOTAS');
		const byId = Object.fromEntries(parsed.actions.map((a) => [a.id, a]));
		expect(byId.ThrottleAxis).toMatchObject({ mode: 'ship', axis: true, name: 'Throttle' });
		expect(byId.SteeringAxis).toMatchObject({ mode: 'srv', axis: true });
		expect(byId.HumanoidJumpButton).toMatchObject({ mode: 'foot', name: 'Jump' });
		expect(byId.EjectAllCargo_Buggy).toMatchObject({ mode: 'srv', category: 'Systems' });
		expect(byId.UI_Up).toMatchObject({ mode: 'ship', category: 'Menus', context: 'menus' });
		expect(parsed.bindings.ToggleFlightAssist).toEqual([
			{ input: { kind: 'key', code: 'KeyZ' }, modifiers: [{ kind: 'key', code: 'ShiftLeft' }] },
			{ input: { kind: 'button', deviceId: 'T16000M', button: 7 } }
		]);
		expect(parsed.bindings.YawLeftButton[1]).toEqual({
			input: { kind: 'hat', deviceId: 'T16000M', hat: 1, dir: 'left' }
		});
		expect(parsed.bindings.ThrottleAxis).toEqual([
			{ input: { kind: 'axis', deviceId: 'T16000MTHROTTLE', axis: 'Z' } },
			null
		]);
		expect(parsed.devices.map((d) => d.id)).toEqual(['T16000M', 'T16000MTHROTTLE', '231D0200']);
		expect(parsed.devices[2]).toMatchObject({ vendor: '231d', product: '0200', name: 'VKB 0200' });
	});

	it('rejects files that are not binds', () => {
		expect(() => parseEliteBinds('<Other />')).toThrow(/Expected an Elite Dangerous binds file/);
		expect(() => parseEliteBinds('not xml <')).toThrow(/doesn't read as a binds file/);
		expect(() => parseEliteBinds('<Root PresetName="x"><A Value="1" /></Root>')).toThrow(
			/No binds/
		);
	});

	it('names the export after the preset and the file version', () => {
		const parsed = parseEliteBinds(fixture('hotas.binds'));
		expect(eliteFileName(parsed, 'My HOTAS / v2')).toBe('My HOTAS  v2.4.0.binds');
		expect(cleanPresetName('<>')).toBe('Custom');
	});
});

describe('mode classification', () => {
	it.each([
		['HumanoidSomethingNewButton', 'foot'],
		['SomethingNew_Humanoid', 'foot'],
		['SomethingNew_Buggy', 'srv'],
		['BuggyNewThing', 'srv'],
		['SteerLeftButton', 'srv'],
		['RecallDismissShip', 'srv'],
		['SomethingNew', 'ship']
	] as const)('%s → %s', (id, mode) => {
		expect(classifyMode(id)).toBe(mode);
	});

	it('prettifies unknown ids', () => {
		expect(prettify('HumanoidToggleShieldsButton')).toBe('Toggle shields');
		expect(prettify('IncreaseEnginesPower_Buggy')).toBe('Increase engines power');
		expect(prettify('UI_Up')).toBe('Ui up');
		expect(prettify('SomethingNew_Humanoid')).toBe('Something new');
	});
});

describe('inputs', () => {
	it.each([
		['Keyboard', 'Key_A'],
		['Keyboard', 'Key_LeftShift'],
		['Keyboard', 'Key_Numpad_7'],
		['Keyboard', 'Key_F12'],
		['Mouse', 'Mouse_2'],
		['Mouse', 'Mouse_3'],
		['Mouse', 'Neg_Mouse_ZAxis'],
		['T16000M', 'Joy_12'],
		['T16000M', 'Joy_POV2Right'],
		['T16000M', 'Joy_RZAxis'],
		['T16000MTHROTTLE', 'Neg_Joy_ZAxis'],
		['GamePad', 'GamePad_FaceA'],
		['046D0000', 'GamePad_FaceDown'],
		['046D0000', 'Pos_GamePad_RTrigger'],
		['046D0000', 'GamePad_LStickX'],
		['Keyboard', 'Key_SomethingOdd']
	])('%s %s round-trips', (device, key) => {
		expect(encodeInput(decodeInput(device, key))).toEqual({ device, key });
	});

	it('maps ED mouse buttons to browser buttons', () => {
		expect(decodeInput('Mouse', 'Mouse_2')).toEqual({ kind: 'mouse', button: 2 });
		expect(decodeInput('Mouse', 'Mouse_3')).toEqual({ kind: 'mouse', button: 1 });
	});

	it('maps browser key codes', () => {
		expect(keyNameForCode('KeyQ')).toBe('Key_Q');
		expect(keyNameForCode('Digit0')).toBe('Key_0');
		expect(keyNameForCode('ArrowUp')).toBe('Key_UpArrow');
		expect(keyNameForCode('IntlBackslash')).toBeNull();
	});
});

describe('writer edge cases', () => {
	const file = (body: string) =>
		`<?xml version="1.0" encoding="UTF-8" ?>\n<Root PresetName="T" MajorVersion="4" MinorVersion="0">\n${body}\n</Root>\n`;
	const key = (code: string) => ({ kind: 'key', code }) as const;

	it('reads every modifier and keeps them all through an edit', () => {
		const source = file(
			'\t<A>\n\t\t<Primary Device="Keyboard" Key="Key_B">\n\t\t\t<Modifier Device="Keyboard" Key="Key_LeftShift" />\n\t\t\t<Modifier Device="Keyboard" Key="Key_LeftControl" />\n\t\t</Primary>\n\t\t<Secondary Device="{NoDevice}" Key="" />\n\t</A>'
		);
		const parsed = parseEliteBinds(source);
		expect(parsed.bindings.A[0]).toEqual({
			input: key('KeyB'),
			modifiers: [key('ShiftLeft'), key('ControlLeft')]
		});
		const out = writeEliteBinds(
			parsed,
			{ A: [{ input: key('KeyN'), modifiers: [key('ShiftLeft'), key('ControlLeft')] }, null] },
			'T'
		);
		expect(out).toBe(source.replace('Key_B', 'Key_N'));
	});

	it('keeps extra attributes and children when the modifiers change', () => {
		const source = file(
			'\t<A>\n\t\t<Primary Device="Keyboard" Key="Key_B" Hold="1">\n\t\t\t<Setting Value="2" />\n\t\t</Primary>\n\t\t<Secondary Device="{NoDevice}" Key="" />\n\t</A>'
		);
		const parsed = parseEliteBinds(source);
		const out = writeEliteBinds(
			parsed,
			{ A: [{ input: key('KeyB'), modifiers: [key('AltLeft')] }, null] },
			'T'
		);
		expect(out).toContain(
			'\t\t<Primary Device="Keyboard" Key="Key_B" Hold="1">\n\t\t\t<Modifier Device="Keyboard" Key="Key_LeftAlt" />\n\t\t\t<Setting Value="2" />\n\t\t</Primary>'
		);
		expect(parseEliteBinds(out).bindings.A[0]).toEqual({
			input: key('KeyB'),
			modifiers: [key('AltLeft')]
		});
	});

	it('writes a Secondary the file never had', () => {
		const source = file('\t<A>\n\t\t<Primary Device="Keyboard" Key="Key_B" />\n\t</A>');
		const parsed = parseEliteBinds(source);
		const out = writeEliteBinds(parsed, { A: [parsed.bindings.A[0], { input: key('KeyM') }] }, 'T');
		expect(out).toContain(
			'\t\t<Primary Device="Keyboard" Key="Key_B" />\n\t\t<Secondary Device="Keyboard" Key="Key_M" />\n\t</A>'
		);
		expect(parseEliteBinds(out).bindings.A[1]).toEqual({ input: key('KeyM') });
	});

	it('names keys and controllers the game can read, and refuses the rest', () => {
		expect(elite.cannotBind?.(key('KeyQ'))).toBeNull();
		expect(elite.cannotBind?.(key('NumLock'))).toMatch(/no name for that key/);
		expect(elite.cannotBind?.({ kind: 'mouse', button: 7 })).toMatch(/five mouse buttons/);
		expect(elite.newDeviceId?.('044f', 'b10a')).toBe('T16000M');
		expect(elite.newDeviceId?.('231d', '0200')).toBe('231D0200');
	});
});

/** A binds file holding just these actions, each with one Primary. */
function binds(actions: [id: string, device: string, key: string][]): string {
	const body = actions
		.map(
			([id, device, key]) =>
				`\t<${id}>\n\t\t<Primary Device="${device}" Key="${key}" />\n\t\t<Secondary Device="{NoDevice}" Key="" />\n\t</${id}>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8" ?>\n<Root PresetName="Test" MajorVersion="4" MinorVersion="1">\n${body}\n</Root>\n`;
}

describe('the 4.1 catalogue', () => {
	it('files actions the game lists outside their name’s mode', () => {
		const parsed = parseEliteBinds(
			`<Root PresetName="T">\n\t<IncreaseSpeedButtonPartial>\n\t\t<Binding Device="T16000MTHROTTLE" Key="Joy_ZAxis" />\n\t</IncreaseSpeedButtonPartial>\n</Root>\n`
		);
		expect(parsed.actions[0]).toMatchObject({ mode: 'srv', axis: true, name: 'Speed up' });
		expect(classifyMode('PhotoCameraToggle_Humanoid')).toBe('foot');
		expect(classifyMode('SystemMapOpen_Humanoid')).toBe('foot');
	});

	it('names and files known actions instead of leaving them in Other', () => {
		const parsed = parseEliteBinds(
			binds([
				['SetSpeedMinus100', 'Keyboard', 'Key_1'],
				['TargetWingman0', 'Keyboard', 'Key_2'],
				['HumanoidHideWeaponButton', 'Keyboard', 'Key_3'],
				['HumanoidPing', 'Keyboard', 'Key_4']
			])
		);
		expect(parsed.actions.map((a) => [a.id, a.category, a.name])).toEqual([
			['SetSpeedMinus100', 'Flight', 'Throttle to −100%'],
			['TargetWingman0', 'Wing', 'Target wingman 1'],
			['HumanoidHideWeaponButton', 'Combat', 'Holster weapon'],
			['HumanoidPing', 'Tools', 'Ping']
		]);
	});

	it('does not count one input in two screens the game reads apart as a clash', () => {
		const parsed = parseEliteBinds(
			binds([
				['ExplorationFSSEnter', 'Keyboard', 'Key_Apostrophe'],
				['ExplorationFSSQuit', 'Keyboard', 'Key_Apostrophe'],
				['ExplorationSAAExitThirdPerson', 'T16000M', 'Joy_5'],
				['UI_Up', 'Keyboard', 'Key_W'],
				['CamTranslateForward', 'Keyboard', 'Key_W'],
				['PitchDownButton', 'Keyboard', 'Key_W'],
				['VanityCameraScrollLeft', 'Keyboard', 'Key_LeftArrow'],
				['FStopDec', 'Keyboard', 'Key_LeftArrow'],
				['HumanoidForwardButton', 'Keyboard', 'Key_W'],
				['HumanoidItemWheelButton_YUp', 'Keyboard', 'Key_W'],
				['SystemMapOpen', 'T16000M', 'Joy_16'],
				['DeployHeatSink', 'T16000M', 'Joy_16']
			])
		);
		expect([...clashingActions(parsed.actions, parsed.bindings, 'ship')].sort()).toEqual([
			'DeployHeatSink',
			'SystemMapOpen'
		]);
		expect(clashingActions(parsed.actions, parsed.bindings, 'foot').size).toBe(0);
	});
});

describe('gamepads', () => {
	it('reads a device bound by gamepad control names as a gamepad', () => {
		const parsed = parseEliteBinds(
			binds([
				['UI_Select', '046D0000', 'GamePad_FaceDown'],
				['PrimaryFire', 'T16000M', 'Joy_1'],
				['SecondaryFire', '046D0000', 'Pos_GamePad_RTrigger']
			])
		);
		expect(parsed.devices).toEqual([
			{
				id: '046D0000',
				name: 'Logitech gamepad',
				vendor: '046d',
				product: '0000',
				gamepad: true
			},
			{ id: 'T16000M', name: 'Thrustmaster T.16000M', vendor: '044f', product: 'b10a' }
		]);
		expect(parsed.bindings.SecondaryFire[0]).toEqual({
			input: { kind: 'pad', deviceId: '046D0000', control: 'RTrigger', half: 'pos' }
		});
		const raw = Object.values(parsed.bindings)
			.flat()
			.filter((slot) => slot?.input.kind === 'raw');
		expect(raw).toEqual([]);
	});
});
