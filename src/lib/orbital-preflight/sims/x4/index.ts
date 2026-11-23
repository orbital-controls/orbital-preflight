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
import { BY_ID, CATALOGUE } from './actions.ts';
import { GAME_VERSION } from './controls.ts';
import DEFAULT_INPUTMAP from '../../../../../data/x4/inputmap.xml?raw';
import {
	cannotBind,
	decodeEntry,
	describeDevice,
	encodeBind,
	isPadShaped,
	isPhysical,
	newDeviceId,
	refuse,
	slotOf,
	type Entry
} from './inputs.ts';

/**
 * X4: Foundations binds: `Documents\Egosoft\X4\<player id>\inputmap.xml`, which the game
 * writes whenever controls change. The shape:
 *
 *   <inputmap version="196">
 *     <config>
 *       <param name="invert_throttle" value="false"/>
 *     </config>
 *     <action id="INPUT_ACTION_OPEN_MAP" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_M"/>
 *     <state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_TAB"/>
 *     <range id="INPUT_RANGE_THROTTLE" source="INPUT_SOURCE_JOYAXES" code="INPUT_JOYAXIS_Z"/>
 *   </inputmap>
 *
 * The file holds every bind, one element per input: a control with three inputs has three
 * elements. The profiles the game ships (libraries/inputmap*.xml) are the same shape with
 * upgrade notes on some entries (`sinceversion`, and `removed="true"` for a bind a later
 * version took away, which isn't a bind).
 *
 * Our two slots are a control's first two physical inputs: keyboard and mouse first, then
 * controllers by slot (for a range, controllers first). Radial menu entries and any third
 * input stay in the file untouched.
 */

function readRoot(source: string): XmlElement {
	let root: XmlElement;
	try {
		root = parseXml(source);
	} catch (error) {
		throw new BindsFormatError(
			`This doesn't read as an inputmap.xml file: ${error instanceof XmlError ? error.message : String(error)}`
		);
	}
	if (root.name !== 'inputmap') {
		throw new BindsFormatError(`Expected X4's inputmap.xml, found <${root.name}>`);
	}
	return root;
}

const TAGS = new Set(['action', 'state', 'range']);
const tagFor = (id: string) =>
	id.startsWith('INPUT_ACTION_') ? 'action' : id.startsWith('INPUT_STATE_') ? 'state' : 'range';

interface FileEntry extends Entry {
	id: string;
	element: XmlElement;
}

function fileEntries(root: XmlElement): FileEntry[] {
	const out: FileEntry[] = [];
	for (const el of root.children) {
		if (!TAGS.has(el.name)) continue;
		if (attribute(el, 'removed')?.value === 'true') continue;
		const value = (name: string) => attribute(el, name)?.value ?? '';
		out.push({
			id: value('id'),
			source: value('source'),
			code: value('code'),
			sgn: value('sgn'),
			element: el
		});
	}
	return out;
}

/** Controller slots whose every input is one a gamepad has. */
function gamepadSlots(entries: Entry[]): Set<number> {
	const used = new Map<number, boolean>();
	for (const e of entries) {
		const slot = slotOf(e.source);
		if (slot === null) continue;
		used.set(slot, (used.get(slot) ?? true) && isPadShaped(e));
	}
	return new Set([...used].filter(([, pad]) => pad).map(([slot]) => slot));
}

/** Keyboard and mouse first (controllers first for a range), then by controller slot. */
function rank(entry: Entry, axis: boolean): number {
	const slot = slotOf(entry.source);
	const controller = slot !== null;
	return (controller === axis ? 0 : 100) + (slot ?? 0);
}

interface Resolved {
	actions: Action[];
	bindings: BindingMap;
	/** By action id: the file entry each of our two slots shows. */
	slotEntries: Map<string, [FileEntry | null, FileEntry | null]>;
	entries: FileEntry[];
	gamepads: Set<number>;
}

function resolve(source: string): Resolved {
	const root = readRoot(source);
	const entries = fileEntries(root);
	const gamepads = gamepadSlots(entries.filter(isPhysical));
	const byId = new Map<string, FileEntry[]>();
	for (const e of entries) {
		if (!isPhysical(e)) continue;
		if (!byId.has(e.id)) byId.set(e.id, []);
		byId.get(e.id)!.push(e);
	}
	const bindings: BindingMap = {};
	const slotEntries = new Map<string, [FileEntry | null, FileEntry | null]>();
	for (const { action } of CATALOGUE) {
		const axis = Boolean(action.axis);
		const own = [...(byId.get(action.id) ?? [])].sort((a, b) => rank(a, axis) - rank(b, axis));
		const [a = null, b = null] = axis ? own.slice(0, 1) : own.slice(0, 2);
		slotEntries.set(action.id, [a, b]);
		bindings[action.id] = [
			a ? decodeEntry(a, gamepads) : null,
			b ? decodeEntry(b, gamepads) : null
		];
	}
	return {
		actions: CATALOGUE.map((e) => e.action),
		bindings,
		slotEntries,
		entries,
		gamepads
	};
}

/** A profile's own name, unless it's a text reference (`{1023,1001}`) only the game reads. */
function presetName(root: XmlElement): string {
	const name = attribute(root, 'name')?.value ?? '';
	return /^\{\d+,\s*\d+\}$/.test(name) ? '' : name;
}

export function parseX4Inputmap(source: string): ParsedBinds {
	const root = readRoot(source);
	const { actions, bindings, entries, gamepads } = resolve(source);
	const slots = new Set<number>();
	for (const e of entries) {
		const slot = slotOf(e.source);
		if (slot !== null) slots.add(slot);
	}
	const devices: FileDevice[] = [...slots]
		.sort((a, b) => a - b)
		.map((slot) => describeDevice(slot, gamepads.has(slot)));
	return { sim: 'x4', presetName: presetName(root), actions, bindings, devices, source };
}

function newline(source: string): string {
	return source.includes('\r\n') ? '\r\n' : '\n';
}

/** The span of an element's whole line, newline included, so removing it leaves no gap. */
function lineSpan(source: string, el: XmlElement): Splice {
	const lineStart = source.lastIndexOf('\n', el.start - 1) + 1;
	const start = /^[ \t]*$/.test(source.slice(lineStart, el.start)) ? lineStart : el.start;
	const after = source.slice(el.end);
	const nl = /^[ \t]*\r?\n/.exec(after)?.[0] ?? '';
	return { start, end: el.end + nl.length, text: '' };
}

/** Controller ids the file doesn't use yet (`joy:044fb10a`) → free slots, in order. */
function allocate(bindings: BindingMap, entries: Entry[]): Map<string, string> {
	const used = new Set<number>();
	for (const e of entries) {
		const slot = slotOf(e.source);
		if (slot !== null) used.add(slot);
	}
	const out = new Map<string, string>();
	for (const binding of Object.values(bindings)) {
		for (const slot of binding) {
			const input = slot?.input;
			if (!input || !('deviceId' in input) || !input.deviceId.startsWith('joy:')) continue;
			if (out.has(input.deviceId)) continue;
			let n = 1;
			while (used.has(n)) n++;
			if (n > 8) continue;
			used.add(n);
			out.set(input.deviceId, `joy${n}`);
		}
	}
	return out;
}

function onSlot(bind: Bind, fresh: Map<string, string>): Bind {
	const input = bind.input;
	if ('deviceId' in input && fresh.has(input.deviceId)) {
		return { ...bind, input: { ...input, deviceId: fresh.get(input.deviceId)! } };
	}
	return bind;
}

const sameEntry = (a: Entry, b: Entry) =>
	a.source === b.source && a.code === b.code && a.sgn === b.sgn;

export function writeX4Inputmap(parsed: ParsedBinds, bindings: BindingMap, name: string): string {
	const { source } = parsed;
	const root = readRoot(source);
	const before = resolve(source);
	const fresh = allocate(bindings, before.entries);
	const nl = newline(source);
	const elements = root.children.filter((c) => TAGS.has(c.name));
	const sample = elements[0];
	const indent = sample ? lineIndent(source, sample.start) : '  ';
	const spaced = sample ? /\s\/>$/.test(source.slice(sample.start, sample.end)) : false;
	const edits: Splice[] = [];
	const removed = new Set<XmlElement>();
	const added = new Map<XmlElement | null, string[]>();

	const markup = (id: string, e: Entry) =>
		`${indent}<${tagFor(id)} id="${encodeAttribute(id)}" source="${encodeAttribute(e.source)}" code="${encodeAttribute(e.code)}"${e.sgn ? ` sgn="${encodeAttribute(e.sgn)}"` : ''}${spaced ? ' />' : '/>'}`;

	/** Where a new entry for `id` goes: after its last one, or after the last of its kind. */
	const anchorFor = (id: string): XmlElement | null => {
		const own = before.entries.filter((e) => e.id === id && !removed.has(e.element));
		if (own.length) return own.at(-1)!.element;
		const tag = tagFor(id);
		return elements.filter((el) => el.name === tag).at(-1) ?? elements.at(-1) ?? null;
	};

	for (const [id, original] of Object.entries(parsed.bindings)) {
		const next = bindings[id];
		if (!next || (sameBind(original[0], next[0]) && sameBind(original[1], next[1]))) continue;
		const entry = BY_ID.get(id);
		if (!entry) continue;
		const axis = Boolean(entry.action.axis);
		const slots = before.slotEntries.get(id) ?? [null, null];
		for (const i of [0, 1] as const) {
			if (sameBind(original[i], next[i])) continue;
			const old = slots[i];
			const bind = next[i];
			const now = bind ? encodeBind(onSlot(bind, fresh), axis) : null;
			for (const member of entry.ids) {
				// The old input goes, from the row's every control.
				if (old) {
					for (const e of before.entries) {
						if (e.id === member && sameEntry(e, old) && !removed.has(e.element)) {
							removed.add(e.element);
							edits.push(lineSpan(source, e.element));
						}
					}
				}
				if (!now) continue;
				const exists = before.entries.some(
					(e) => e.id === member && sameEntry(e, now) && !removed.has(e.element)
				);
				if (exists) continue;
				const anchor = anchorFor(member);
				const list = added.get(anchor) ?? [];
				list.push(markup(member, now));
				added.set(anchor, list);
			}
		}
	}

	for (const [anchor, lines] of added) {
		if (anchor && !removed.has(anchor)) {
			edits.push({ start: anchor.end, end: anchor.end, text: lines.map((l) => nl + l).join('') });
			continue;
		}
		// The anchor went too: after the last element that stays, else first in the root.
		const keep = elements.filter((el) => !removed.has(el)).at(-1);
		const at = keep ? keep.end : root.startTagEnd;
		edits.push({ start: at, end: at, text: lines.map((l) => nl + l).join('') });
	}

	// A saved profile's own name, where it has one. inputmap.xml itself has none.
	const profile = attribute(root, 'name');
	if (profile && presetName(root) && name.trim()) {
		edits.push({
			start: profile.valueStart,
			end: profile.valueEnd,
			text: encodeAttribute(name.trim())
		});
	}

	return splice(source, edits);
}

/** The game reads the binds from inputmap.xml in the pilot's folder, under that name. */
export function x4FileName(): string {
	return 'inputmap.xml';
}

export const x4: SimAdapter = {
	id: 'x4',
	name: 'X4: Foundations',
	short: 'X4',
	status: 'ready',
	extensions: ['.xml'],
	fileLabel: 'inputmap.xml',
	modes: ['ship', 'foot'],
	// UNVERIFIED: the path, flagged for Phil to confirm.
	help: {
		path: 'Documents\\Egosoft\\X4\\[your id number]\\inputmap.xml',
		tip: 'The number folder is your player id. There is usually only one.'
	},
	parse: parseX4Inputmap,
	write: writeX4Inputmap,
	cannotBind,
	refuse,
	newDeviceId,
	fileName: x4FileName,
	// The game's own "Keyboard and Mouse" profile, as it ships (data/x4/inputmap.xml).
	defaults: { label: `X4 ${GAME_VERSION} defaults`, source: DEFAULT_INPUTMAP },
	words: {
		modes: { foot: 'First person' },
		modeNotes: {
			ship: `Space flight, weapons, camera and the map. Everything starts on the game's ${GAME_VERSION} Keyboard and Mouse profile.`,
			foot: 'Walking on stations and ships. X4 has no ground vehicles, so there is no vehicle tab.'
		},
		text: {
			Supercruise: 'Travel mode',
			'Supercruise engaged': 'Travel mode engaged',
			'Dropped from supercruise': 'Travel mode off',
			'Chaff away': 'Countermeasures away',
			'Ping sent': 'Long range scan'
		}
	}
};
