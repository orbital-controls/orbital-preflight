import type { Action, Bind, BindingMap, FileDevice, ParsedBinds, Slot } from '../../types.ts';
import { sameBind } from '../../bindings.ts';
import {
	attribute,
	child,
	encodeAttribute,
	lineIndent,
	parseXml,
	splice,
	XmlError,
	type Splice,
	type XmlElement
} from '../../xml.ts';
import { BindsFormatError, type SimAdapter } from '../types.ts';
import { compareActions, describeAction } from './actions.ts';
import {
	cannotBind,
	decodeInput,
	describeDevice,
	encodeInput,
	isPairableDevice,
	newDeviceId
} from './inputs.ts';

/**
 * Elite Dangerous `.binds`. The shape, as this reads it:
 *
 *   <Root PresetName="Custom" MajorVersion="4" MinorVersion="0">
 *     <KeyboardLayout>en-US</KeyboardLayout>          settings: left alone
 *     <YawAxisRaw>                                     an axis action
 *       <Binding Device="T16000M" Key="Joy_XAxis" />
 *       <Inverted Value="0" />
 *     </YawAxisRaw>
 *     <ToggleFlightAssist>                             a button action
 *       <Primary Device="Keyboard" Key="Key_Z">
 *         <Modifier Device="Keyboard" Key="Key_LeftShift" />
 *       </Primary>
 *       <Secondary Device="{NoDevice}" Key="" />
 *       <ToggleOn Value="1" />
 *     </ToggleFlightAssist>
 *   </Root>
 *
 * UNVERIFIED: written from memory of real files and tested only against the synthetic
 * fixtures in tests/fixtures. See the README's "Unverified" list.
 */

const SLOT_TAGS = ['Primary', 'Secondary'] as const;

function slotFromElement(element: XmlElement | undefined): Slot {
	if (!element) return null;
	const input = decodeInput(
		attribute(element, 'Device')?.value ?? '',
		attribute(element, 'Key')?.value ?? ''
	);
	if (!input) return null;
	const modifiers = element.children
		.filter((c) => c.name === 'Modifier')
		.map((m) => decodeInput(attribute(m, 'Device')?.value ?? '', attribute(m, 'Key')?.value ?? ''))
		.filter((m): m is NonNullable<typeof m> => m !== null);
	return modifiers.length ? { input, modifiers } : { input };
}

function readRoot(source: string): XmlElement {
	let root: XmlElement;
	try {
		// A byte-order mark is just text before the first tag, so offsets stay true to the file.
		root = parseXml(source);
	} catch (error) {
		throw new BindsFormatError(
			`This doesn't read as a binds file: ${error instanceof XmlError ? error.message : String(error)}`
		);
	}
	if (root.name !== 'Root') {
		throw new BindsFormatError(`Expected an Elite Dangerous binds file, found <${root.name}>`);
	}
	return root;
}

function isAction(element: XmlElement): boolean {
	return element.children.some(
		(c) => c.name === 'Primary' || c.name === 'Secondary' || c.name === 'Binding'
	);
}

export function parseEliteBinds(source: string): ParsedBinds {
	const root = readRoot(source);
	const actions: Action[] = [];
	const bindings: BindingMap = {};
	const deviceIds = new Set<string>();

	for (const element of root.children) {
		if (!isAction(element) || bindings[element.name]) continue;
		const axisElement = child(element, 'Binding');
		const action = describeAction(element.name, Boolean(axisElement));
		actions.push(action);
		bindings[element.name] = axisElement
			? [slotFromElement(axisElement), null]
			: [slotFromElement(child(element, 'Primary')), slotFromElement(child(element, 'Secondary'))];

		for (const tag of ['Binding', ...SLOT_TAGS]) {
			const slot = child(element, tag);
			if (!slot) continue;
			for (const el of [slot, child(slot, 'Modifier')]) {
				const device = el && attribute(el, 'Device')?.value;
				if (device && isPairableDevice(device)) deviceIds.add(device);
			}
		}
	}

	if (!actions.length) throw new BindsFormatError('No binds found in this file');

	// In the order the file first uses them: usually stick, then throttle.
	const devices: FileDevice[] = [...deviceIds].map(describeDevice);
	return {
		sim: 'elite-dangerous',
		presetName: attribute(root, 'PresetName')?.value ?? '',
		actions: actions.sort(compareActions),
		bindings,
		devices,
		source
	};
}

function newline(source: string): string {
	return source.includes('\r\n') ? '\r\n' : '\n';
}

/** One indent step, in the file's own style. */
function indentUnit(indent: string): string {
	return indent.includes('\t') || !indent ? '\t' : '  ';
}

function modifierMarkup(input: Bind['input']): string {
	const { device, key } = encodeInput(input);
	return `<Modifier Device="${encodeAttribute(device)}" Key="${encodeAttribute(key)}" />`;
}

/** Device and Key values replaced inside `element`'s own start tag, other attributes kept. */
function startTag(source: string, element: XmlElement, input: Bind['input'] | null): string {
	const { device, key } = encodeInput(input);
	let tag = source.slice(element.start, element.startTagEnd);
	const swaps: [number, number, string][] = [];
	for (const [name, value] of [
		['Device', device],
		['Key', key]
	] as const) {
		const attr = attribute(element, name);
		if (attr)
			swaps.push([
				attr.valueStart - element.start,
				attr.valueEnd - element.start,
				encodeAttribute(value)
			]);
		else
			swaps.push([
				element.name.length + 1,
				element.name.length + 1,
				` ${name}="${encodeAttribute(value)}"`
			]);
	}
	for (const [from, to, text] of swaps.sort((x, y) => y[0] - x[0])) {
		tag = tag.slice(0, from) + text + tag.slice(to);
	}
	return tag;
}

/**
 * Edits that turn a Primary, Secondary or Binding element into `after`. Changing only
 * the input, or modifiers one for one, touches only attribute values. Otherwise the
 * element is rewritten from its own start tag (so extra attributes stay) with its
 * modifiers and any other children it had (settings the game keeps there).
 */
function slotEdits(source: string, element: XmlElement, before: Slot, after: Slot): Splice[] {
	if (sameBind(before, after)) return [];
	const oldMods = element.children.filter((c) => c.name === 'Modifier');
	const others = element.children.filter((c) => c.name !== 'Modifier');
	const newMods = after?.modifiers ?? [];

	const valueEdits = (el: XmlElement, input: Bind['input'] | null): Splice[] => {
		const { device, key } = encodeInput(input);
		const d = attribute(el, 'Device');
		const k = attribute(el, 'Key');
		if (!d || !k) return [];
		return [
			{ start: d.valueStart, end: d.valueEnd, text: encodeAttribute(device) },
			{ start: k.valueStart, end: k.valueEnd, text: encodeAttribute(key) }
		];
	};
	const attrsPresent = attribute(element, 'Device') && attribute(element, 'Key');
	const modsHaveAttrs = oldMods.every((m) => attribute(m, 'Device') && attribute(m, 'Key'));
	if (attrsPresent && modsHaveAttrs && oldMods.length === newMods.length) {
		return [
			...valueEdits(element, after?.input ?? null),
			...oldMods.flatMap((m, i) => valueEdits(m, newMods[i]))
		];
	}

	const tag = startTag(source, element, after?.input ?? null);
	const open = tag.replace(/\s*\/>$/, '>');
	const children = [
		...newMods.map(modifierMarkup),
		...others.map((c) => source.slice(c.start, c.end))
	];
	if (!children.length) {
		const text = element.selfClosing ? tag : open.replace(/\s*>$/, ' />');
		return [{ start: element.start, end: element.end, text }];
	}
	const indent = lineIndent(source, element.start);
	const nl = newline(source);
	const inner = children.map((c) => `${nl}${indent}${indentUnit(indent)}${c}`).join('');
	return [
		{
			start: element.start,
			end: element.end,
			text: `${open}${inner}${nl}${indent}</${element.name}>`
		}
	];
}

/**
 * A Primary or Secondary the file doesn't have, written after its sibling (or at the top
 * of the action) on a line of its own.
 */
function insertSlot(
	source: string,
	action: XmlElement,
	tag: (typeof SLOT_TAGS)[number],
	bind: Bind
): Splice {
	const primary = child(action, 'Primary');
	const firstChild = action.children[0];
	const anchor = tag === 'Secondary' && primary ? primary : null;
	const indent = firstChild
		? lineIndent(source, firstChild.start)
		: lineIndent(source, action.start) + indentUnit(lineIndent(source, action.start));
	const nl = newline(source);
	const mods = bind.modifiers ?? [];
	const { device, key } = encodeInput(bind.input);
	const open = `<${tag} Device="${encodeAttribute(device)}" Key="${encodeAttribute(key)}"`;
	const markup = mods.length
		? `${open}>${mods.map((m) => `${nl}${indent}${indentUnit(indent)}${modifierMarkup(m)}`).join('')}${nl}${indent}</${tag}>`
		: `${open} />`;
	const at = anchor ? anchor.end : action.startTagEnd;
	return { start: at, end: at, text: `${nl}${indent}${markup}` };
}

/** A preset name the game will accept as a file name. */
export function cleanPresetName(name: string): string {
	return (
		name
			.replace(/[^\w .-]/g, '')
			.trim()
			.slice(0, 60) || 'Custom'
	);
}

export function writeEliteBinds(
	parsed: ParsedBinds,
	bindings: BindingMap,
	presetName: string
): string {
	const { source } = parsed;
	const root = readRoot(source);
	const edits: Splice[] = [];

	const name = attribute(root, 'PresetName');
	const cleaned = encodeAttribute(cleanPresetName(presetName));
	if (name) edits.push({ start: name.valueStart, end: name.valueEnd, text: cleaned });
	else
		edits.push({
			start: root.start + '<Root'.length,
			end: root.start + '<Root'.length,
			text: ` PresetName="${cleaned}"`
		});

	const seen = new Set<string>();
	for (const element of root.children) {
		if (!isAction(element) || seen.has(element.name)) continue;
		seen.add(element.name);
		const original = parsed.bindings[element.name];
		const next = bindings[element.name];
		if (!original || !next) continue;

		const axisElement = child(element, 'Binding');
		if (axisElement) {
			edits.push(...slotEdits(source, axisElement, original[0], next[0]));
			continue;
		}
		SLOT_TAGS.forEach((tag, index) => {
			const slotElement = child(element, tag);
			if (slotElement) edits.push(...slotEdits(source, slotElement, original[index], next[index]));
			else if (next[index]) edits.push(insertSlot(source, element, tag, next[index]!));
		});
	}

	return splice(source, edits);
}

/** `Custom.4.0.binds`: the name, then the file's own version. UNVERIFIED naming. */
export function eliteFileName(parsed: ParsedBinds, presetName: string): string {
	const root = readRoot(parsed.source);
	const major = attribute(root, 'MajorVersion')?.value;
	const minor = attribute(root, 'MinorVersion')?.value;
	const version = major ? `.${major}.${minor ?? 0}` : '';
	return `${cleanPresetName(presetName)}${version}.binds`;
}

export const elite: SimAdapter = {
	id: 'elite-dangerous',
	name: 'Elite Dangerous',
	short: 'ED',
	status: 'ready',
	extensions: ['.binds'],
	fileLabel: '.binds file',
	// UNVERIFIED: flagged for Phil to confirm.
	help: {
		path: '%LOCALAPPDATA%\\Frontier Developments\\Elite Dangerous\\Options\\Bindings\\',
		tip: 'Pick the newest .binds file in that folder. That is the preset you last saved in game.'
	},
	parse: parseEliteBinds,
	write: writeEliteBinds,
	cannotBind,
	newDeviceId,
	fileName: eliteFileName
};
