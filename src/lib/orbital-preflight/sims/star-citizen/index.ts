import type { Action, Bind, BindingMap, FileDevice, ParsedBinds } from '../../types.ts';
import { sameBind } from '../../bindings.ts';
import {
	attribute,
	encodeAttribute,
	lineIndent,
	parseXml,
	splice,
	XmlError,
	type Splice,
	type XmlElement
} from '../../xml.ts';
import { BindsFormatError, type SimAdapter } from '../types.ts';
import { BY_ID, CATALOGUE, unknownAction } from './actions.ts';
import { GAME_VERSION } from './defaults.ts';
import {
	cannotBind,
	decodeBind,
	decodeRebind,
	describeDevice,
	deviceKind,
	encodeBind,
	newDeviceId,
	productAttribute,
	refuse,
	type DeviceKey
} from './inputs.ts';

/**
 * Star Citizen layouts: `layout_<name>_exported.xml`, saved in game from Options →
 * Keybindings → Control profiles. The shape, as the game writes it:
 *
 *   <ActionMaps version="1" optionsVersion="2" rebindVersion="2" profileName="Mine">
 *    <CustomisationUIHeader label="Mine" description="" image="">
 *     <devices><keyboard instance="1"/><joystick instance="1"/></devices>
 *    </CustomisationUIHeader>
 *    <options type="joystick" instance="1" Product="VKB Gladiator  {0200231D-…-504944564944}"/>
 *    <modifiers />
 *    <actionmap name="spaceship_movement">
 *     <action name="v_pitch">
 *      <rebind input="js1_y"/>
 *     </action>
 *    </actionmap>
 *   </ActionMaps>
 *
 * A layout holds only what differs from the game's defaults, one `rebind` per device; an
 * input of `js1_ ` clears that device's default. So the binds a pilot flies with are the
 * defaults (`defaults.ts`, from the game's defaultProfile.xml) with the layout laid over.
 *
 * Our two slots are the action's first two devices with a bind: keyboard and mouse first,
 * then joysticks and the gamepad (for an axis action, controllers first). A third device's
 * bind stays in the file untouched.
 */

function readRoot(source: string): XmlElement {
	let root: XmlElement;
	try {
		root = parseXml(source);
	} catch (error) {
		throw new BindsFormatError(
			`This doesn't read as a layout file: ${error instanceof XmlError ? error.message : String(error)}`
		);
	}
	if (root.name === 'profile') {
		throw new BindsFormatError(
			'This is the game’s defaultProfile.xml. Export a layout in game and load that instead.'
		);
	}
	if (root.name !== 'ActionMaps') {
		throw new BindsFormatError(`Expected a Star Citizen layout, found <${root.name}>`);
	}
	return root;
}

const elements = (parent: XmlElement, name: string) =>
	parent.children.filter((c) => c.name === name);
const nameOf = (el: XmlElement) => attribute(el, 'name')?.value ?? '';

/** One action's binds by device (`kb1`, `js2`…), null where a device is cleared. */
type DeviceBinds = Map<DeviceKey, Bind | null>;

interface Resolved {
	actions: Action[];
	/** By action id. */
	devices: Map<string, DeviceBinds>;
	/** By action id: which device each of our two slots shows. */
	slotDevices: Map<string, [DeviceKey | null, DeviceKey | null]>;
	bindings: BindingMap;
	/** Joystick and gamepad devices the layout names, by key, with their Product line. */
	options: Map<DeviceKey, string>;
}

function defaultsFor(id: string): DeviceBinds {
	const binds: DeviceBinds = new Map();
	const entry = BY_ID.get(id);
	if (!entry) return binds;
	const { kb, mo, js, gp } = entry.defaults;
	for (const [key, text] of [
		['kb1', kb],
		['mo1', mo],
		['js1', js],
		['gp1', gp]
	] as const) {
		const bind = decodeBind(key, text);
		if (bind) binds.set(key, bind);
	}
	return binds;
}

/** Device keys in the order our slots take them. */
function slotOrder(keys: Iterable<DeviceKey>, axis: boolean): DeviceKey[] {
	const rank = (k: DeviceKey) => {
		const kind = k.slice(0, 2);
		const order = axis ? ['js', 'gp', 'mo', 'kb'] : ['kb', 'mo', 'js', 'gp'];
		return order.indexOf(kind) * 1000 + Number(/\d+$/.exec(k)?.[0] ?? 0);
	};
	return [...keys].sort((a, b) => rank(a) - rank(b));
}

function resolve(source: string): Resolved {
	const root = readRoot(source);
	const options = new Map<DeviceKey, string>();
	for (const o of elements(root, 'options')) {
		const type = attribute(o, 'type')?.value;
		const instance = attribute(o, 'instance')?.value;
		if ((type === 'joystick' || type === 'gamepad') && instance) {
			options.set(
				`${type === 'joystick' ? 'js' : 'gp'}${instance}`,
				attribute(o, 'Product')?.value ?? ''
			);
		}
	}

	const devices = new Map<string, DeviceBinds>();
	const actions = new Map<string, Action>();
	for (const entry of CATALOGUE) {
		actions.set(entry.action.id, entry.action);
		devices.set(entry.action.id, defaultsFor(entry.action.id));
	}
	for (const map of elements(root, 'actionmap')) {
		for (const action of elements(map, 'action')) {
			const id = `${nameOf(map)}.${nameOf(action)}`;
			if (!actions.has(id)) {
				actions.set(id, unknownAction(nameOf(map), nameOf(action)));
				devices.set(id, new Map());
			}
			for (const rebind of elements(action, 'rebind')) {
				const decoded = decodeRebind(attribute(rebind, 'input')?.value ?? '');
				if (decoded) devices.get(id)!.set(decoded.device, decoded.bind);
			}
		}
	}

	const bindings: BindingMap = {};
	const slotDevices = new Map<string, [DeviceKey | null, DeviceKey | null]>();
	for (const [id, binds] of devices) {
		const bound = slotOrder(
			[...binds].filter(([, b]) => b).map(([k]) => k),
			Boolean(actions.get(id)!.axis)
		);
		const [a = null, b = null] = actions.get(id)!.axis ? bound.slice(0, 1) : bound.slice(0, 2);
		slotDevices.set(id, [a, b]);
		bindings[id] = [a ? binds.get(a)! : null, b ? binds.get(b)! : null];
	}
	return { actions: [...actions.values()], devices, slotDevices, bindings, options };
}

export function parseStarCitizenLayout(source: string): ParsedBinds {
	const root = readRoot(source);
	const { actions, bindings, options } = resolve(source);
	const header = root.children.find((c) => c.name === 'CustomisationUIHeader');

	// Controllers: the ones the layout names, then the first joystick and the gamepad the
	// defaults bind to, so either can be paired even in a keyboard-only layout.
	const keys = new Set<DeviceKey>(options.keys());
	for (const binding of Object.values(bindings)) {
		for (const slot of binding) {
			for (const input of slot ? [slot.input, ...(slot.modifiers ?? [])] : []) {
				if ('deviceId' in input && /^(js|gp)\d+$/.test(input.deviceId)) keys.add(input.deviceId);
			}
		}
	}
	const devices: FileDevice[] = slotOrder(keys, true).map((k) => describeDevice(k, options.get(k)));

	return {
		sim: 'star-citizen',
		presetName:
			attribute(root, 'profileName')?.value ?? (header && attribute(header, 'label')?.value) ?? '',
		actions,
		bindings,
		devices,
		source
	};
}

function newline(source: string): string {
	return source.includes('\r\n') ? '\r\n' : '\n';
}

/** The file's indent step: how far its first child sits in from the root. */
function indentUnit(source: string, root: XmlElement): string {
	const first = root.children[0];
	const indent = first ? lineIndent(source, first.start) : '';
	return indent || ' ';
}

/** A preset name the game accepts as a profile and file name. */
function cleanPresetName(name: string): string {
	return (
		name
			.replace(/[^\w -]/g, '')
			.trim()
			.slice(0, 60) || 'Custom'
	);
}

/** Device keys for controllers the layout doesn't name yet (`js:231d0200` → `js3`). */
function allocate(
	bindings: BindingMap,
	options: Map<DeviceKey, string>
): Map<string, { key: DeviceKey; vendor: string; product: string }> {
	const used = new Set<DeviceKey>(options.keys());
	const fresh = new Set<string>();
	for (const binding of Object.values(bindings)) {
		for (const slot of binding) {
			for (const input of slot ? [slot.input, ...(slot.modifiers ?? [])] : []) {
				if (!('deviceId' in input)) continue;
				if (input.deviceId.startsWith('js:')) fresh.add(input.deviceId);
				else used.add(input.deviceId);
			}
		}
	}
	const out = new Map<string, { key: DeviceKey; vendor: string; product: string }>();
	let n = 1;
	for (const id of fresh) {
		while (used.has(`js${n}`)) n++;
		used.add(`js${n}`);
		out.set(id, { key: `js${n}`, vendor: id.slice(3, 7), product: id.slice(7, 11) });
	}
	return out;
}

/** The device a new bind goes on: the slot's old device if it can hold it, else its own. */
function deviceFor(bind: Bind, previous: DeviceKey | null, fresh: Map<string, { key: DeviceKey }>) {
	const kind = deviceKind(bind.input);
	if (kind === 'kb')
		return previous?.startsWith('mo') && bind.input.kind !== 'key' ? previous : 'kb1';
	if (bind.input.kind === 'raw') return bind.input.device;
	const id = 'deviceId' in bind.input ? bind.input.deviceId : 'js1';
	return fresh.get(id)?.key ?? id;
}

/** `bind` with any new controller ids swapped for the instance the file will use. */
function onInstance(bind: Bind, fresh: Map<string, { key: DeviceKey }>): Bind {
	const swap = (input: Bind['input']): Bind['input'] =>
		'deviceId' in input && fresh.has(input.deviceId)
			? { ...input, deviceId: fresh.get(input.deviceId)!.key }
			: input;
	return {
		input: swap(bind.input),
		...(bind.modifiers && { modifiers: bind.modifiers.map(swap) })
	};
}

const rebindValue = (key: DeviceKey, bind: Bind | null) =>
	`${key}_${bind ? encodeBind(bind) : ' '}`;

export function writeStarCitizenLayout(
	parsed: ParsedBinds,
	bindings: BindingMap,
	presetName: string
): string {
	const { source } = parsed;
	const root = readRoot(source);
	const before = resolve(source);
	const fresh = allocate(bindings, before.options);
	const edits: Splice[] = [];
	const nl = newline(source);
	const unit = indentUnit(source, root);
	const rootIndent = lineIndent(source, root.start);

	// The preset name, on the root and in the header the game shows.
	const name = encodeAttribute(cleanPresetName(presetName));
	const profile = attribute(root, 'profileName');
	if (profile) edits.push({ start: profile.valueStart, end: profile.valueEnd, text: name });
	else {
		const at = root.start + '<ActionMaps'.length;
		edits.push({ start: at, end: at, text: ` profileName="${name}"` });
	}
	const header = root.children.find((c) => c.name === 'CustomisationUIHeader');
	const label = header && attribute(header, 'label');
	if (label) edits.push({ start: label.valueStart, end: label.valueEnd, text: name });

	// What each changed action's devices should hold now, against what they hold.
	const changes = new Map<string, Map<string, string[]>>(); // map → action → rebind values
	for (const [id, original] of Object.entries(parsed.bindings)) {
		const next = bindings[id];
		if (!next || (sameBind(original[0], next[0]) && sameBind(original[1], next[1]))) continue;
		const was = before.devices.get(id) ?? new Map();
		const slots = before.slotDevices.get(id) ?? [null, null];
		const now: DeviceBinds = new Map(was);
		for (const i of [0, 1] as const) {
			if (!sameBind(original[i], next[i]) && slots[i]) now.set(slots[i]!, null);
		}
		for (const i of [0, 1] as const) {
			const bind = next[i];
			if (!bind || sameBind(original[i], bind)) continue;
			now.set(deviceFor(bind, slots[i], fresh), onInstance(bind, fresh));
		}
		const values: string[] = [];
		for (const key of slotOrder(new Set([...was.keys(), ...now.keys()]), false)) {
			const a = was.get(key) ?? null;
			const b = now.get(key) ?? null;
			if (!sameBind(a, b)) values.push(rebindValue(key, b));
		}
		if (!values.length) continue;
		const dot = id.indexOf('.');
		const map = id.slice(0, dot);
		if (!changes.has(map)) changes.set(map, new Map());
		changes.get(map)!.set(id.slice(dot + 1), values);
	}

	// Into the file: replace a device's rebind where it has one, else add one.
	const maps = new Map(elements(root, 'actionmap').map((m) => [nameOf(m), m]));
	const newMaps: string[] = [];
	for (const [mapName, actions] of changes) {
		const map = maps.get(mapName);
		const mapIndent = map ? lineIndent(source, map.start) : rootIndent + unit;
		const actionIndent = mapIndent + unit;
		const rebindIndent = actionIndent + unit;
		const actionMarkup = (actionName: string, values: string[]) =>
			[
				`${actionIndent}<action name="${encodeAttribute(actionName)}">`,
				...values.map((v) => `${rebindIndent}<rebind input="${encodeAttribute(v)}"/>`),
				`${actionIndent}</action>`
			].join(nl);

		const newActions: string[] = [];
		for (const [actionName, values] of actions) {
			const action = map && elements(map, 'action').find((a) => nameOf(a) === actionName);
			if (!action) {
				newActions.push(actionMarkup(actionName, values));
				continue;
			}
			const rebinds = elements(action, 'rebind');
			const added: string[] = [];
			for (const value of values) {
				const prefix = value.slice(0, value.indexOf('_') + 1);
				const existing = rebinds.find((r) => attribute(r, 'input')?.value.startsWith(prefix));
				const input = existing && attribute(existing, 'input');
				if (input)
					edits.push({
						start: input.valueStart,
						end: input.valueEnd,
						text: encodeAttribute(value)
					});
				else added.push(value);
			}
			if (!added.length) continue;
			const indent = rebinds[0]
				? lineIndent(source, rebinds[0].start)
				: lineIndent(source, action.start) + unit;
			const lines = added
				.map((v) => `${nl}${indent}<rebind input="${encodeAttribute(v)}"/>`)
				.join('');
			if (action.selfClosing) {
				const open = source.slice(action.start, action.startTagEnd).replace(/\s*\/>$/, '>');
				edits.push({
					start: action.start,
					end: action.end,
					text: `${open}${lines}${nl}${lineIndent(source, action.start)}</action>`
				});
			} else {
				const at = (rebinds.at(-1) ?? null)?.end ?? action.startTagEnd;
				edits.push({ start: at, end: at, text: lines });
			}
		}
		if (!newActions.length) continue;
		if (map && !map.selfClosing) {
			const last = map.children.at(-1);
			const at = last ? last.end : map.startTagEnd;
			edits.push({ start: at, end: at, text: `${nl}${newActions.join(nl)}` });
		} else if (map) {
			const open = source.slice(map.start, map.startTagEnd).replace(/\s*\/>$/, '>');
			edits.push({
				start: map.start,
				end: map.end,
				text: `${open}${nl}${newActions.join(nl)}${nl}${mapIndent}</actionmap>`
			});
		} else {
			newMaps.push(
				[
					`${mapIndent}<actionmap name="${encodeAttribute(mapName)}">`,
					...newActions,
					`${mapIndent}</actionmap>`
				].join(nl)
			);
		}
	}

	// New controllers: an <options> line each (and a device in the header), after the
	// last one the file has.
	if (fresh.size) {
		const lines = [...fresh.values()].map(
			({ key, vendor, product }) =>
				`${rootIndent + unit}<options type="joystick" instance="${key.slice(2)}" Product="${encodeAttribute(productAttribute('Joystick', vendor, product))}"/>`
		);
		const anchor = elements(root, 'options').at(-1) ?? header;
		const at = anchor ? anchor.end : root.startTagEnd;
		edits.push({ start: at, end: at, text: `${nl}${lines.join(nl)}` });
		const list = header?.children.find((c) => c.name === 'devices');
		if (list && !list.selfClosing) {
			const last = list.children.at(-1);
			const indent = last ? lineIndent(source, last.start) : lineIndent(source, list.start) + unit;
			const at2 = last ? last.end : list.startTagEnd;
			const text = [...fresh.values()]
				.map(({ key }) => `${nl}${indent}<joystick instance="${key.slice(2)}"/>`)
				.join('');
			edits.push({ start: at2, end: at2, text });
		}
	}

	if (newMaps.length) {
		const last = root.children.at(-1);
		const at = last ? last.end : root.startTagEnd;
		edits.push({ start: at, end: at, text: `${nl}${newMaps.join(nl)}` });
	}

	return splice(source, edits);
}

/** `layout_Mine_exported.xml`, as the game names its own exports. */
export function starCitizenFileName(_parsed: ParsedBinds, presetName: string): string {
	return `layout_${cleanPresetName(presetName).replace(/\s+/g, '_')}_exported.xml`;
}

export const starCitizen: SimAdapter = {
	id: 'star-citizen',
	name: 'Star Citizen',
	short: 'SC',
	status: 'ready',
	extensions: ['.xml'],
	fileLabel: 'Exported layout .xml',
	modes: ['ship', 'srv', 'foot'],
	// UNVERIFIED: the menu path, flagged for Phil to confirm.
	help: {
		step: 'Export first, in game: Options → Keybindings → Advanced controls customization → Control profiles → Save.',
		path: '…\\StarCitizen\\LIVE\\USER\\Client\\0\\Controls\\Mappings\\',
		tip: 'Pick the layout_…_exported.xml file you just saved.'
	},
	parse: parseStarCitizenLayout,
	write: writeStarCitizenLayout,
	cannotBind,
	refuse,
	newDeviceId,
	fileName: starCitizenFileName,
	words: {
		modes: { srv: 'Vehicle' },
		modeNotes: {
			ship: `Ship binds. Your layout holds only what you changed; everything else is the game's ${GAME_VERSION} default.`,
			srv: 'Ground vehicles have their own set. Same keys, different jobs: Space sounds the horn, not strafe up.',
			foot: 'On-foot binds, with EVA and interaction. Keyboard and mouse first; bind a stick or gamepad here if you walk with one.'
		},
		text: {
			'FA OFF': 'DECOUPLED',
			'FA off': 'Decoupled',
			'Flight assist on': 'Coupled',
			'Flight assist off': 'Decoupled',
			HARDPOINTS: 'SCM',
			'Hardpoints are stowed': 'Weapons need SCM mode',
			'FSD charging · mass locked': 'Quantum drive spooling · no target',
			Supercruise: 'Quantum',
			'Supercruise engaged': 'Quantum mode',
			'Dropped from supercruise': 'Flight mode',
			'Chaff away': 'Decoys away',
			'Heat sink launched': 'Noise deployed',
			SYS: 'SHD',
			'Gear down · speed limited': 'Landing gear down · speed limited',
			Handbrake: 'Brake',
			HANDBRAKE: 'BRAKE'
		}
	}
};
