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
import { decodeInput, describeDevice, encodeInput, isPairableDevice } from './inputs.ts';

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
	const modifierElement = child(element, 'Modifier');
	const modifier = modifierElement
		? decodeInput(
				attribute(modifierElement, 'Device')?.value ?? '',
				attribute(modifierElement, 'Key')?.value ?? ''
			)
		: null;
	return modifier ? { input, modifier } : { input };
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

/** The slot element written fresh, indented to match the line it sits on. */
function slotMarkup(source: string, element: XmlElement, bind: Bind): string {
	const { device, key } = encodeInput(bind.input);
	const open = `<${element.name} Device="${encodeAttribute(device)}" Key="${encodeAttribute(key)}"`;
	if (!bind.modifier) return `${open} />`;
	const indent = lineIndent(source, element.start);
	const unit = indent.includes('\t') || !indent ? '\t' : '  ';
	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const mod = encodeInput(bind.modifier);
	return (
		`${open}>${newline}${indent}${unit}<Modifier Device="${encodeAttribute(mod.device)}" Key="${encodeAttribute(mod.key)}" />` +
		`${newline}${indent}</${element.name}>`
	);
}

/** Edits that turn `element` into `bind`, touching as few bytes as possible. */
function slotEdits(source: string, element: XmlElement, before: Slot, after: Slot): Splice[] {
	if (sameBind(before, after)) return [];
	const modifierElement = child(element, 'Modifier');
	const valueEdits = (el: XmlElement, input: Bind['input'] | null): Splice[] => {
		const { device, key } = encodeInput(input);
		const edits: Splice[] = [];
		const d = attribute(el, 'Device');
		const k = attribute(el, 'Key');
		if (!d || !k) return [];
		edits.push({ start: d.valueStart, end: d.valueEnd, text: encodeAttribute(device) });
		edits.push({ start: k.valueStart, end: k.valueEnd, text: encodeAttribute(key) });
		return edits;
	};

	const hadModifier = Boolean(modifierElement);
	const hasModifier = Boolean(after?.modifier);
	const attrsPresent = attribute(element, 'Device') && attribute(element, 'Key');

	if (attrsPresent && !hadModifier && !hasModifier)
		return valueEdits(element, after?.input ?? null);
	if (
		attrsPresent &&
		hadModifier &&
		hasModifier &&
		modifierElement &&
		element.children.length === 1
	) {
		return [...valueEdits(element, after!.input), ...valueEdits(modifierElement, after!.modifier!)];
	}
	const text = after
		? slotMarkup(source, element, after)
		: `<${element.name} Device="{NoDevice}" Key="" />`;
	return [{ start: element.start, end: element.end, text }];
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
	fileName: eliteFileName
};
