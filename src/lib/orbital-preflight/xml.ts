/**
 * A small XML scanner that keeps byte offsets.
 *
 * The writer never rebuilds a binds file from the model: it splices new text into the
 * original string at the offsets recorded here, so every element, comment, setting and
 * whitespace run it doesn't understand comes out exactly as it went in. That is also why
 * this isn't DOMParser: serialising a DOM back out normalises quoting, spacing and
 * self-closing tags.
 *
 * It handles what binds files contain (elements, attributes, comments, the XML
 * declaration) and nothing more: no CDATA, no DTDs, no entities beyond the five
 * predefined ones.
 */

export interface XmlAttribute {
	name: string;
	value: string;
	/** Offsets of the value between its quotes. */
	valueStart: number;
	valueEnd: number;
}

export interface XmlElement {
	name: string;
	attributes: XmlAttribute[];
	children: XmlElement[];
	/** Offset of the `<` that opens the element. */
	start: number;
	/** Offset just past the end of its closing tag (or of the self-closing tag). */
	end: number;
	/** Offset just past the `>` of the start tag. */
	startTagEnd: number;
	selfClosing: boolean;
}

export class XmlError extends Error {}

const TOKEN =
	/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!(?!--)[^>]*>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTRIBUTE = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

/** Parses `source` and returns its root element. Throws `XmlError` on malformed input. */
export function parseXml(source: string): XmlElement {
	const stack: XmlElement[] = [];
	let root: XmlElement | null = null;
	let cursor = 0;

	TOKEN.lastIndex = 0;
	for (let match = TOKEN.exec(source); match; match = TOKEN.exec(source)) {
		const between = source.slice(cursor, match.index);
		if (between.includes('<')) {
			throw new XmlError(`Unexpected "<" at offset ${cursor + between.indexOf('<')}`);
		}
		cursor = match.index + match[0].length;

		const [whole, closing, name, attributeText, selfClosing] = match;
		if (!name) {
			if (whole.startsWith('<![CDATA[')) throw new XmlError('CDATA sections are not supported');
			continue; // comment, declaration or doctype
		}

		if (closing) {
			const open = stack.pop();
			if (!open || open.name !== name) {
				throw new XmlError(`Unexpected </${name}> at offset ${match.index}`);
			}
			open.end = cursor;
			continue;
		}

		const attributesOffset = match.index + 1 + name.length;
		const element: XmlElement = {
			name,
			attributes: readAttributes(attributeText ?? '', attributesOffset),
			children: [],
			start: match.index,
			end: cursor,
			startTagEnd: cursor,
			selfClosing: Boolean(selfClosing)
		};

		const parent = stack.at(-1);
		if (parent) parent.children.push(element);
		else if (root) throw new XmlError('More than one root element');
		else root = element;

		if (!selfClosing) stack.push(element);
	}

	if (source.slice(cursor).includes('<')) throw new XmlError('Unexpected "<" after the last tag');
	if (stack.length) throw new XmlError(`<${stack.at(-1)?.name}> is never closed`);
	if (!root) throw new XmlError('No root element');
	return root;
}

function readAttributes(text: string, offset: number): XmlAttribute[] {
	const attributes: XmlAttribute[] = [];
	ATTRIBUTE.lastIndex = 0;
	for (let match = ATTRIBUTE.exec(text); match; match = ATTRIBUTE.exec(text)) {
		const raw = match[3] ?? match[4] ?? '';
		const valueStart = offset + match.index + match[0].length - raw.length - 1;
		attributes.push({
			name: match[1],
			value: decodeEntities(raw),
			valueStart,
			valueEnd: valueStart + raw.length
		});
	}
	return attributes;
}

export function attribute(element: XmlElement, name: string): XmlAttribute | undefined {
	return element.attributes.find((a) => a.name === name);
}

export function child(element: XmlElement, name: string): XmlElement | undefined {
	return element.children.find((c) => c.name === name);
}

const DECODE: Record<string, string> = {
	'&lt;': '<',
	'&gt;': '>',
	'&amp;': '&',
	'&quot;': '"',
	'&apos;': "'"
};

export function decodeEntities(text: string): string {
	return text.replace(/&(lt|gt|amp|quot|apos);/g, (entity) => DECODE[entity]);
}

export function encodeAttribute(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export interface Splice {
	start: number;
	end: number;
	text: string;
}

/** Applies non-overlapping replacements to `source`. */
export function splice(source: string, edits: Splice[]): string {
	const sorted = [...edits].sort((a, b) => a.start - b.start);
	let out = '';
	let cursor = 0;
	for (const edit of sorted) {
		if (edit.start < cursor) throw new Error('Overlapping edits');
		out += source.slice(cursor, edit.start) + edit.text;
		cursor = edit.end;
	}
	return out + source.slice(cursor);
}

/** The whitespace that starts the line `offset` is on. */
export function lineIndent(source: string, offset: number): string {
	const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
	return /^[ \t]*/.exec(source.slice(lineStart, offset))?.[0] ?? '';
}
